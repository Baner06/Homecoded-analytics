import { getLeagueTodayMatches, invalidateLeagueCaches } from '../../../lib/leagueFixtures.js';
import { getCompetition } from '../../../lib/competitions.js';
import { formatDateLongColombia, getDateISOInColombia } from '../../../lib/timezone.js';

export const config = { runtime: 'nodejs' };

function parseDateParam(value) {
  if (!value || typeof value !== 'string') return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const competitionId = req.query?.competitionId;
  const competition = getCompetition(competitionId);
  if (!competition || !competition.available) {
    return res.status(404).json({ ok: false, error: 'Competición no disponible' });
  }

  try {
    if (req.query?.refresh === '1') invalidateLeagueCaches(competitionId);

    const requested = parseDateParam(req.query?.date);
    const dateIso = requested || getDateISOInColombia();

    const { date, matches, matchCount, totalTournamentFixtures, tournamentMinDate, tournamentMaxDate, isToday } =
      await getLeagueTodayMatches(competitionId, dateIso, req.query?.refresh === '1');

    const hasLive = matches.some((m) => m.status === 'live');
    res.setHeader(
      'Cache-Control',
      hasLive ? 'public, s-maxage=60, stale-while-revalidate=30' : 'public, s-maxage=300, stale-while-revalidate=120'
    );

    return res.status(200).json({
      ok: true,
      source: 'coded-sports-api',
      competitionId,
      competitionName: competition.officialName,
      countryCode: competition.countryCode,
      date,
      dateLabel: formatDateLongColombia(new Date(`${date}T12:00:00`)),
      isToday,
      tournamentMinDate,
      tournamentMaxDate,
      matchCount,
      totalTournamentFixtures,
      matches,
    });
  } catch (err) {
    console.error('[api/leagues/matches]', err);
    return res.status(500).json({ ok: false, error: err.message || 'Error al cargar partidos de la liga' });
  }
}
