import { getTodayMatches, invalidateFixturesCache, invalidateSoftCaches } from '../../lib/fixtures.js';
import {
  formatDateLongColombia,
  formatKickoffColombia,
  getDateISOInColombia,
  TIMEZONE,
} from '../../lib/timezone.js';

export const config = { runtime: 'nodejs' };

function parseDateParam(value) {
  if (!value || typeof value !== 'string') return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    if (req.query?.refresh === '1') {
      invalidateSoftCaches();
    }
    if (req.query?.full === '1') {
      invalidateFixturesCache();
    }

    const requested = parseDateParam(req.query?.date);
    const dateIso = requested || getDateISOInColombia();

    const {
      date,
      matches,
      totalFixtures,
      tournamentMinDate,
      tournamentMaxDate,
      isToday,
    } = await getTodayMatches(dateIso);

    const hasLive = matches.some((m) => m.status === 'live');
    const cacheHeader = hasLive
      ? 'public, s-maxage=60, stale-while-revalidate=30'
      : isToday
        ? 'public, s-maxage=300, stale-while-revalidate=120'
        : 'public, s-maxage=1800, stale-while-revalidate=3600';
    res.setHeader('Cache-Control', cacheHeader);

    const payload = {
      ok: true,
      source: 'homecoded-api',
      timezone: TIMEZONE,
      date,
      dateLabel: formatDateLongColombia(new Date(`${date}T12:00:00`)),
      isToday,
      tournamentMinDate,
      tournamentMaxDate,
      matchCount: matches.length,
      totalTournamentFixtures: totalFixtures,
      fixturesProvider: 'openfootball + thestatsapi (equipos y cuadro actualizado)',
      refereesProvider: 'FIFA + ESPN + SofaScore (designación oficial, actualizada diariamente)',
      liveScoresProvider: hasLive ? 'ESPN / worldcup26.ir (marcador y stats en vivo)' : null,
      matches: matches.map((m) => ({
        ...m,
        kickoff: formatKickoffColombia(m.kickoffUtc),
        kickoffLabel: `${formatKickoffColombia(m.kickoffUtc)} COT`,
      })),
    };

    return res.status(200).json(payload);
  } catch (err) {
    console.error('[api/matches/today]', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Error interno al cargar partidos',
    });
  }
}
