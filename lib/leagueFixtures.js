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
import { sameTeam } from './teamKeys.js';
import { computePredictions, buildLiveProbableActions } from './predictions.js';
import { buildActualStats, evaluatePredictions, computeLiveProgress } from './evaluation.js';
import { computeLiveClock, liveEvalContext } from './liveClock.js';
import { resolveRefereeFromName, formatRefereeDisplay } from './referees.js';
import { emptyAnalysis, formatActualStats } from './fixtures.js';
import { getDateISOInColombia, formatKickoffColombia, addDaysToDateIso } from './timezone.js';

const RECENT_FORM_WINDOW_DAYS = 30;
const RECENT_FORM_LIMIT = 4;

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
  const referee = resolveRefereeFromName(entry.refereeName);

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
    const liveData = buildLiveProbableActions(analysis.probableActions, liveEvalContext(live), actualStats);
    analysis.liveProbableActions = liveData.pending;
    analysis.liveReview = liveData.review;
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

function teamPlayedInEntry(entry, teamName) {
  return sameTeam(entry.homeName, teamName) || sameTeam(entry.awayName, teamName);
}

/** Últimos N partidos finalizados de un equipo dentro de la competición, antes de una fecha dada. */
function getTeamRecentFormFromEntries(entries, teamName, { excludeEventId, beforeDate, limit = RECENT_FORM_LIMIT } = {}) {
  const played = entries
    .filter((e) => String(e.espnEventId) !== String(excludeEventId))
    .filter((e) => !beforeDate || e.dateIso <= beforeDate)
    .filter((e) => teamPlayedInEntry(e, teamName))
    .sort((a, b) => b.dateIso.localeCompare(a.dateIso) || String(b.espnEventId).localeCompare(String(a.espnEventId)))
    .slice(0, limit);

  return played.map((e) => {
    const isHome = sameTeam(e.homeName, teamName);
    const teamGoals = isHome ? e.homeGoals : e.awayGoals;
    const oppGoals = isHome ? e.awayGoals : e.homeGoals;
    let outcome = 'draw';
    if (teamGoals > oppGoals) outcome = 'win';
    else if (teamGoals < oppGoals) outcome = 'loss';

    const oppName = isHome ? e.awayName : e.homeName;
    const oppTeam = resolveTeam(oppName);

    return {
      matchId: e.espnEventId,
      date: e.dateIso,
      opponent: oppTeam.displayName,
      opponentFlag: oppTeam.flag,
      opponentFlagUrl: oppTeam.flagUrl,
      opponentIso: oppTeam.iso,
      score: `${teamGoals}-${oppGoals}`,
      result: outcome,
      stage: '',
      label: `${e.homeName} vs ${e.awayName} · ${e.homeGoals}-${e.awayGoals}`,
    };
  });
}

/** Partidos finalizados de la competición en los últimos N días, para calcular la forma reciente. */
async function getRecentFinishedEntries(competition, days = RECENT_FORM_WINDOW_DAYS) {
  const today = getDateISOInColombia();
  const dates = Array.from({ length: days }, (_, i) => addDaysToDateIso(today, -i));
  const perDay = await Promise.all(dates.map((d) => loadRawMatches(competition, d, false)));
  return perDay.flat().filter((e) => e.isFinished);
}

function attachLeagueRecentForm(matches, recentEntries) {
  return matches.map((m) => ({
    ...m,
    recentForm: {
      home: getTeamRecentFormFromEntries(recentEntries, m.home.originalName, {
        excludeEventId: m.espnEventId,
        beforeDate: m.date,
      }),
      away: getTeamRecentFormFromEntries(recentEntries, m.away.originalName, {
        excludeEventId: m.espnEventId,
        beforeDate: m.date,
      }),
    },
  }));
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
  const enriched = raw
    .map((entry) => enrichLeagueMatch(entry, competition))
    .sort((a, b) => new Date(a.kickoffUtc) - new Date(b.kickoffUtc));

  const recentEntries = await getRecentFinishedEntries(competition).catch(() => []);
  const matches = attachLeagueRecentForm(enriched, recentEntries);

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
