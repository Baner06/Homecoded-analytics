/**
 * Pipeline de partidos para ligas/copas de clubes (fuera del Mundial 2026).
 * Produce el mismo formato de partido "enriquecido" que lib/fixtures.js,
 * pero mucho más simple: ESPN es la única fuente (fixture + marcador en vivo
 * en un solo llamado), así que no hace falta el cruce entre proveedores ni
 * la lógica de cuadro eliminatorio que tiene el pipeline del Mundial.
 */
import { getCompetition } from './competitions.js';
import { loadCompetitionMatches, invalidateCompetitionMatchesCache } from './liveScores.js';
import { loadSofaCompetitionMatches, invalidateSofaCompetitionCache } from './sofaCompetitionMatches.js';
import { resolveTeam, teamStats } from './teams.js';
import { computePredictions } from './predictions.js';
import { buildActualStats, evaluatePredictions, computeLiveProgress } from './evaluation.js';
import { computeLiveClock, liveEvalContext } from './liveClock.js';
import { UNASSIGNED_REFEREE, formatRefereeDisplay } from './referees.js';
import { emptyAnalysis, formatActualStats } from './fixtures.js';
import { getDateISOInColombia, formatKickoffColombia, addDaysToDateIso } from './timezone.js';

const REFEREE = { ...UNASSIGNED_REFEREE };

function leagueTeam(name, logo) {
  const resolved = resolveTeam(name);
  return {
    resolved,
    view: {
      name: resolved.displayName,
      originalName: name,
      flag: resolved.flag,
      iso: resolved.iso,
      flagUrl: resolved.flagUrl,
      logo: logo || null,
      stats: teamStats(resolved),
      pending: false,
    },
  };
}

function buildLiveState(kickoffUtc, analysis, matchResult, home, away, dateIso) {
  const clock = computeLiveClock(kickoffUtc);
  const partial = buildActualStats(matchResult, home, away, dateIso, null);
  const actions = (analysis.probableActions || []).map((action) => ({
    rank: action.rank,
    label: action.label,
    progress: computeLiveProgress(partial, action, clock.minute),
  }));
  return { ...clock, progressPct: Math.min(100, Math.round((clock.minute / 90) * 100)), actions, knockout: null };
}

function enrichLeagueMatch(entry, competition) {
  const homeT = leagueTeam(entry.homeName, entry.homeLogo);
  const awayT = leagueTeam(entry.awayName, entry.awayLogo);
  const referee = REFEREE;

  const status = entry.isFinished ? 'finished' : entry.isLive ? 'live' : 'scheduled';
  const matchResult = {
    homeGoals: entry.homeGoals || 0,
    awayGoals: entry.awayGoals || 0,
    htHomeGoals: entry.htHomeGoals || 0,
    htAwayGoals: entry.htAwayGoals || 0,
  };

  const analysis = computePredictions(
    { ...homeT.resolved, ...homeT.view.stats },
    { ...awayT.resolved, ...awayT.view.stats },
    referee
  );

  let score = null;
  let actualStats = null;
  let review = null;
  let live = null;

  if (status === 'finished') {
    score = { home: matchResult.homeGoals, away: matchResult.awayGoals, htHome: matchResult.htHomeGoals, htAway: matchResult.htAwayGoals };
    actualStats = buildActualStats(matchResult, homeT.resolved, awayT.resolved, entry.dateIso, entry.hasStats ? entry : null);
    review = evaluatePredictions(analysis.probableActions, actualStats);
  } else if (status === 'live') {
    score = { home: matchResult.homeGoals, away: matchResult.awayGoals, htHome: matchResult.htHomeGoals, htAway: matchResult.htAwayGoals };
    live = buildLiveState(entry.kickoffUtc, analysis, matchResult, homeT.resolved, awayT.resolved, entry.dateIso);
    actualStats = buildActualStats(matchResult, homeT.resolved, awayT.resolved, entry.dateIso, entry.hasStats ? entry : null);
  }

  return {
    id: entry.espnEventId,
    matchNumber: entry.espnEventId,
    date: entry.dateIso,
    kickoffUtc: entry.kickoffUtc,
    kickoffLabel: `${formatKickoffColombia(entry.kickoffUtc)} COT`,
    stage: 'league',
    stageLabel: competition.officialName,
    group: null,
    isKnockout: false,
    status,
    venue: entry.venue,
    score,
    actualStats: formatActualStats(actualStats),
    live,
    knockout: null,
    review,
    teamsPending: false,
    home: homeT.view,
    away: awayT.view,
    referee: {
      name: referee.name,
      country: referee.country,
      rigor: referee.rigor,
      assigned: referee.assigned !== false,
      source: referee.source || null,
      verified: referee.verified !== false,
      label: formatRefereeDisplay(referee),
    },
    espnEventId: String(entry.espnEventId),
    analysis: status === 'scheduled' ? { ...analysis, pending: false } : analysis,
    competitionId: competition.id,
    competitionName: competition.officialName,
    countryCode: competition.countryCode,
  };
}

function hasDataSource(competition) {
  if (competition.provider === 'sofascore') {
    return !!(competition.sofaTournamentId && competition.sofaSeasonId);
  }
  return !!competition.espnSlug;
}

function loadRawMatches(competition, dateIso, force) {
  if (competition.provider === 'sofascore') {
    return loadSofaCompetitionMatches(dateIso, competition.sofaTournamentId, competition.sofaSeasonId, force);
  }
  return loadCompetitionMatches(dateIso, competition.espnSlug, force);
}

export async function getLeagueTodayMatches(competitionId, dateIso = getDateISOInColombia(), force = false) {
  const competition = getCompetition(competitionId);
  if (!competition || !competition.available || !hasDataSource(competition)) {
    throw new Error(`Competición no disponible: ${competitionId}`);
  }

  const raw = await loadRawMatches(competition, dateIso, force);
  const matches = raw
    .map((entry) => enrichLeagueMatch(entry, competition))
    .sort((a, b) => new Date(a.kickoffUtc) - new Date(b.kickoffUtc));

  return {
    date: dateIso,
    matches,
    matchCount: matches.length,
    totalTournamentFixtures: matches.length,
    tournamentMinDate: addDaysToDateIso(dateIso, -60),
    tournamentMaxDate: addDaysToDateIso(dateIso, 60),
    isToday: dateIso === getDateISOInColombia(),
    competition: { id: competition.id, officialName: competition.officialName, countryCode: competition.countryCode, tier: competition.tier },
  };
}

export async function getLeagueMatchById(competitionId, matchId, dateIso = getDateISOInColombia()) {
  const { matches } = await getLeagueTodayMatches(competitionId, dateIso);
  return matches.find((m) => String(m.id) === String(matchId)) || null;
}

export function invalidateLeagueCaches(competitionId) {
  const competition = getCompetition(competitionId);
  if (!competition) return;
  if (competition.provider === 'sofascore') {
    invalidateSofaCompetitionCache(competition.sofaTournamentId, competition.sofaSeasonId);
  } else {
    invalidateCompetitionMatchesCache(competition.espnSlug);
  }
}
