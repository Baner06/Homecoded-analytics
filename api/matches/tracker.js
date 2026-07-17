import { getMatchById } from '../../lib/fixtures.js';
import { loadLiveScoresMap, getLiveResultForMatch } from '../../lib/liveScores.js';
import { fetchLiveTracker, invalidateLiveTrackerCache } from '../../lib/liveTracker.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const matchId = Number(req.query?.matchId || req.query?.id);
    if (!matchId) {
      return res.status(400).json({ ok: false, error: 'matchId requerido' });
    }

    if (req.query?.refresh === '1') {
      invalidateLiveTrackerCache();
    }

    const match = await getMatchById(matchId);
    if (!match) {
      return res.status(404).json({ ok: false, error: 'Partido no encontrado' });
    }

    if (match.status !== 'live') {
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
      return res.status(200).json({
        ok: true,
        live: false,
        matchId: match.id,
        status: match.status,
      });
    }

    const liveMap = await loadLiveScoresMap(match.date, req.query?.refresh === '1');
    const feed = getLiveResultForMatch(
      liveMap,
      match.date,
      match.home.originalName,
      match.away.originalName
    );

    const espnEventId = feed?.espnEventId || match.espnEventId;
    if (!espnEventId) {
      return res.status(200).json({
        ok: false,
        live: true,
        matchId: match.id,
        error: 'Sin feed ESPN para este partido',
      });
    }

    const tracker = await fetchLiveTracker(
      espnEventId,
      match.home.name,
      match.away.name,
      true
    );

    res.setHeader('Cache-Control', 'no-store, max-age=0, s-maxage=0');
    return res.status(200).json({
      ok: true,
      live: true,
      matchId: match.id,
      tracker,
    });
  } catch (err) {
    console.error('[api/matches/tracker]', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Error al cargar tablero en vivo',
    });
  }
}
