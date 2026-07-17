import { getMatchById } from '../../lib/fixtures.js';
import { loadLiveScoresMap, getLiveResultForMatch } from '../../lib/liveScores.js';
import { fetchMatchStatsPanel, invalidateMatchStatsPanelCache } from '../../lib/matchStatsPanel.js';

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
      invalidateMatchStatsPanelCache();
    }

    const match = await getMatchById(matchId);
    if (!match) {
      return res.status(404).json({ ok: false, error: 'Partido no encontrado' });
    }

    if (match.status !== 'live' && match.status !== 'finished') {
      return res.status(200).json({
        ok: true,
        available: false,
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
        available: false,
        matchId: match.id,
        error: 'Sin datos ESPN para estadísticas',
      });
    }

    const result = await fetchMatchStatsPanel(espnEventId, { force: req.query?.refresh === '1' });

    res.setHeader('Cache-Control', match.status === 'live' ? 'no-store, max-age=0' : 'public, s-maxage=120');
    return res.status(200).json({
      ok: true,
      available: result.available,
      matchId: match.id,
      status: match.status,
      home: {
        name: match.home.name,
        flagUrl: match.home.flagUrl,
        flag: match.home.flag,
      },
      away: {
        name: match.away.name,
        flagUrl: match.away.flagUrl,
        flag: match.away.flag,
      },
      stats: result.stats,
    });
  } catch (err) {
    console.error('[api/matches/stats]', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Error al cargar estadísticas',
    });
  }
}
