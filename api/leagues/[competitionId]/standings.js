import { getStandings } from '../../../lib/leagueStandings.js';
import { getCompetition } from '../../../lib/competitions.js';
import { loadCompetitionMatches } from '../../../lib/liveScores.js';
import { getDateISOInColombia, addDaysToDateIso } from '../../../lib/timezone.js';

export const config = { runtime: 'nodejs' };

async function getRecentFinishedMatches(competition) {
  const today = getDateISOInColombia();
  const dates = Array.from({ length: 14 }, (_, i) => addDaysToDateIso(today, -i));
  const perDay = await Promise.all(dates.map((d) => loadCompetitionMatches(d, competition.espnSlug)));
  return perDay.flat()
    .filter((m) => m.isFinished)
    .map((m) => ({
      home: { name: m.homeName, logo: m.homeLogo },
      away: { name: m.awayName, logo: m.awayLogo },
      score: { home: m.homeGoals, away: m.awayGoals },
    }));
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
    const data = await getStandings(competitionId, () => getRecentFinishedMatches(competition));
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=600');
    return res.status(200).json({
      ok: true,
      competitionId,
      competitionName: competition.officialName,
      ...data,
    });
  } catch (err) {
    console.error('[api/leagues/standings]', err);
    return res.status(500).json({ ok: false, error: err.message || 'Error al cargar tabla de posiciones' });
  }
}
