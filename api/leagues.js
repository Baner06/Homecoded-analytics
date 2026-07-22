/**
 * Agrupa /api/leagues (catálogo), /matches y /standings en una sola función
 * serverless mediante ?action=, en vez de rutas anidadas dinámicas — el plan
 * Hobby de Vercel limita a 12 funciones por deployment.
 */
import { buildCatalogTree, getCompetition, listAvailableCompetitions } from '../lib/competitions.js';
import { getFinishedMatches, getTodayMatches } from '../lib/fixtures.js';
import { getLeagueTodayMatches, invalidateLeagueCaches } from '../lib/leagueFixtures.js';
import { getStandings } from '../lib/leagueStandings.js';
import { loadCompetitionMatches } from '../lib/liveScores.js';
import { loadSofaCompetitionMatches } from '../lib/sofaCompetitionMatches.js';
import { sameTeam } from '../lib/teamKeys.js';
import { listTeamsCatalog } from '../lib/teams.js';
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

/**
 * "Inicio": todos los partidos del día (Mundial + toda liga/copa de clubes
 * disponible) en una sola respuesta, para no disparar 30+ fetches desde el
 * cliente (mismo motivo que buildTeamIndex más abajo: límite de 12 funciones
 * serverless del plan Hobby de Vercel).
 */
async function handleHome(req, res) {
  const requested = parseDateParam(req.query?.date);
  const dateIso = requested || getDateISOInColombia();
  const force = req.query?.refresh === '1';

  const [worldCup, ...clubs] = await Promise.all([
    getTodayMatches(dateIso).catch(() => ({ matches: [] })),
    ...listAvailableCompetitions().map((c) =>
      getLeagueTodayMatches(c.id, dateIso, force).catch(() => ({ matches: [] }))
    ),
  ]);

  const matches = [worldCup, ...clubs]
    .flatMap((d) => d.matches || [])
    .sort((a, b) => new Date(a.kickoffUtc) - new Date(b.kickoffUtc));

  const hasLive = matches.some((m) => m.status === 'live');
  res.setHeader(
    'Cache-Control',
    hasLive ? 'public, s-maxage=60, stale-while-revalidate=30' : 'public, s-maxage=300, stale-while-revalidate=120'
  );

  return res.status(200).json({
    ok: true,
    source: 'coded-sports-api',
    date: dateIso,
    dateLabel: formatDateLongColombia(new Date(`${dateIso}T12:00:00`)),
    isToday: dateIso === getDateISOInColombia(),
    tournamentMinDate: addDaysToDateIso(dateIso, -60),
    tournamentMaxDate: addDaysToDateIso(dateIso, 60),
    matchCount: matches.length,
    totalTournamentFixtures: matches.length,
    matches,
  });
}

async function getRecentFinishedMatches(competition) {
  const today = getDateISOInColombia();
  const dates = Array.from({ length: 14 }, (_, i) => addDaysToDateIso(today, -i));
  const loader = competition.provider === 'sofascore'
    ? (d) => loadSofaCompetitionMatches(d, competition.sofaTournamentId, competition.sofaSeasonId)
    : (d) => loadCompetitionMatches(d, competition.espnSlug);
  const perDay = await Promise.all(dates.map(loader));
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

let teamIndexCache = { at: 0, teams: [] };
const TEAM_INDEX_CACHE_MS = 20 * 60 * 1000;

/** Selecciones del Mundial (lib/teams.js) + equipos de cada liga de clubes disponible (vía standings). */
async function buildTeamIndex() {
  const nationalTeams = listTeamsCatalog().map((t) => ({
    name: t.nombre,
    logo: t.flagUrl || null,
    competitionId: null,
    competitionName: 'Mundial 2026',
    countryCode: null,
  }));

  const competitions = listAvailableCompetitions();
  const perCompetition = await Promise.all(competitions.map(async (comp) => {
    try {
      const { groups } = await getStandings(comp.id, () => getRecentFinishedMatches(comp));
      const seen = new Set();
      const teams = [];
      for (const group of groups || []) {
        for (const row of group.rows || []) {
          if (!row.team || row.team === '—' || seen.has(row.team)) continue;
          seen.add(row.team);
          teams.push({
            name: row.team,
            logo: row.logo || null,
            competitionId: comp.id,
            competitionName: comp.officialName,
            countryCode: comp.countryCode,
          });
        }
      }
      return teams;
    } catch (err) {
      console.error('[api/leagues/teamIndex]', comp.id, err.message);
      return [];
    }
  }));

  return [...nationalTeams, ...perCompetition.flat()];
}

async function handleTeamIndex(req, res) {
  const now = Date.now();
  if (req.query?.refresh === '1') teamIndexCache = { at: 0, teams: [] };

  if (!teamIndexCache.teams.length || now - teamIndexCache.at > TEAM_INDEX_CACHE_MS) {
    const teams = await buildTeamIndex();
    teamIndexCache = { at: now, teams };
  }

  res.setHeader('Cache-Control', 'public, s-maxage=1200, stale-while-revalidate=600');
  return res.status(200).json({ ok: true, source: 'coded-sports-api', teams: teamIndexCache.teams });
}

const TEAM_REVIEW_LIMIT = 10;
const CLUB_TEAM_REVIEW_WINDOW_DAYS = 60;

/** Convierte un partido ya enriquecido (con .review) en una fila del historial de un equipo. */
function buildTeamReviewEntry(m, teamName) {
  const isHome = sameTeam(m.home.name, teamName) || sameTeam(m.home.originalName, teamName);
  const team = isHome ? m.home : m.away;
  const opponent = isHome ? m.away : m.home;
  const teamGoals = isHome ? m.score?.home : m.score?.away;
  const oppGoals = isHome ? m.score?.away : m.score?.home;

  let result = 'draw';
  if (teamGoals != null && oppGoals != null) {
    if (teamGoals > oppGoals) result = 'win';
    else if (teamGoals < oppGoals) result = 'loss';
  }

  return {
    matchId: m.id,
    date: m.date,
    team: team.name,
    opponent: opponent.name,
    opponentLogo: opponent.logo || opponent.flagUrl || null,
    score: teamGoals != null && oppGoals != null ? `${teamGoals}-${oppGoals}` : null,
    result,
    stageLabel: m.stageLabel || null,
    review: m.review || null,
  };
}

function matchesTeamName(m, teamName) {
  return sameTeam(m.home.name, teamName) || sameTeam(m.away.name, teamName);
}

async function handleTeamReviewWorldCup(res, teamName) {
  const finished = await getFinishedMatches();
  const matches = finished
    .filter((m) => matchesTeamName(m, teamName))
    .sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id))
    .slice(0, TEAM_REVIEW_LIMIT)
    .map((m) => buildTeamReviewEntry(m, teamName));

  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=600');
  return res.status(200).json({ ok: true, team: { name: teamName }, competitionName: 'Mundial 2026', matches });
}

/** Fechas recientes (crudas, sin enriquecer) en las que este equipo tuvo un partido finalizado. */
async function findClubTeamMatchDates(competition, teamName) {
  const today = getDateISOInColombia();
  const dates = Array.from({ length: CLUB_TEAM_REVIEW_WINDOW_DAYS }, (_, i) => addDaysToDateIso(today, -i));
  const loader = competition.provider === 'sofascore'
    ? (d) => loadSofaCompetitionMatches(d, competition.sofaTournamentId, competition.sofaSeasonId)
    : (d) => loadCompetitionMatches(d, competition.espnSlug);

  const hits = await Promise.all(dates.map(async (date) => {
    const raw = await loader(date).catch(() => []);
    const played = raw.some((m) => m.isFinished && (sameTeam(m.homeName, teamName) || sameTeam(m.awayName, teamName)));
    return played ? date : null;
  }));

  return hits.filter(Boolean).sort((a, b) => b.localeCompare(a)).slice(0, TEAM_REVIEW_LIMIT);
}

async function handleTeamReviewClub(res, teamName, competitionId) {
  const competition = getCompetition(competitionId);
  if (!competition || !competition.available) {
    return res.status(404).json({ ok: false, error: 'Competición no disponible' });
  }

  const dates = await findClubTeamMatchDates(competition, teamName);
  const perDate = await Promise.all(dates.map((d) => getLeagueTodayMatches(competitionId, d).catch(() => ({ matches: [] }))));
  const matches = perDate
    .flatMap(({ matches }) => matches)
    .filter((m) => m.status === 'finished' && matchesTeamName(m, teamName))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, TEAM_REVIEW_LIMIT)
    .map((m) => buildTeamReviewEntry(m, teamName));

  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=600');
  return res.status(200).json({ ok: true, team: { name: teamName }, competitionName: competition.officialName, matches });
}

async function handleTeamReview(req, res) {
  const teamName = req.query?.teamName;
  if (!teamName) return res.status(400).json({ ok: false, error: 'teamName requerido' });

  const competitionId = req.query?.competitionId || null;
  return competitionId
    ? await handleTeamReviewClub(res, teamName, competitionId)
    : await handleTeamReviewWorldCup(res, teamName);
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
    if (action === 'home') return await handleHome(req, res);
    if (action === 'matches') return await handleMatches(req, res, competitionId);
    if (action === 'standings') return await handleStandings(req, res, competitionId);
    if (action === 'teamIndex') return await handleTeamIndex(req, res);
    if (action === 'teamReview') return await handleTeamReview(req, res);
    return res.status(400).json({ ok: false, error: 'Parámetro action inválido' });
  } catch (err) {
    console.error('[api/leagues]', action, competitionId, err);
    return res.status(500).json({ ok: false, error: err.message || 'Error en la API de ligas' });
  }
}
