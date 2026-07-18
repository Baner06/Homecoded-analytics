/**
 * Agrupa /api/leagues (catálogo), /matches y /standings en una sola función
 * serverless mediante ?action=, en vez de rutas anidadas dinámicas — el plan
 * Hobby de Vercel limita a 12 funciones por deployment.
 */
import { buildCatalogTree, getCompetition } from '../lib/competitions.js';
import { getLeagueTodayMatches, invalidateLeagueCaches } from '../lib/leagueFixtures.js';
import { getStandings } from '../lib/leagueStandings.js';
import { loadCompetitionMatches } from '../lib/liveScores.js';
import { formatDateLongColombia, getDateISOInColombia, addDaysToDateIso } from '../lib/timezone.js';

export const config = { runtime: 'nodejs' };

function parseDateParam(value) {
  if (!value || typeof value !== 'string') return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

async function handleCatalog(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=3600');
  return res.status(200).json({
    ok: true,
    source: 'coded-sports-api',
    continents: buildCatalogTree(),
  });
}

async function handleMatches(req, res, competitionId) {
  const competition = getCompetition(competitionId);
  if (!competition || !competition.available) {
    return res.status(404).json({ ok: false, error: 'Competición no disponible' });
  }

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
}

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

async function handleStandings(req, res, competitionId) {
  const competition = getCompetition(competitionId);
  if (!competition || !competition.available) {
    return res.status(404).json({ ok: false, error: 'Competición no disponible' });
  }

  const data = await getStandings(competitionId, () => getRecentFinishedMatches(competition));
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=600');
  return res.status(200).json({
    ok: true,
    competitionId,
    competitionName: competition.officialName,
    ...data,
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const action = req.query?.action;
  const competitionId = req.query?.competitionId;

  try {
    if (action === 'catalog') return await handleCatalog(req, res);
    if (action === 'matches') return await handleMatches(req, res, competitionId);
    if (action === 'standings') return await handleStandings(req, res, competitionId);
    return res.status(400).json({ ok: false, error: 'Parámetro action inválido' });
  } catch (err) {
    console.error('[api/leagues]', action, competitionId, err);
    return res.status(500).json({ ok: false, error: err.message || 'Error en la API de ligas' });
  }
}
