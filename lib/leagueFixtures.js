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
const FORM_PROFILE_SAMPLE_LIMIT = 6;
const MIN_FORM_SAMPLES = 2;

/**
 * Perfil de forma real de un equipo (córners, tiros a puerta, tasa de victorias)
 * calculado de sus últimos partidos en esta competición, en vez de la constante
 * genérica fija que usa resolveTeam() para clubes sin datos curados a mano.
 * Requiere al menos MIN_FORM_SAMPLES partidos para no confiar en una muestra chica.
 */
function computeTeamFormProfile(entries, teamName, { beforeDate, excludeEventId } = {}) {
  const played = getPlayedEntriesForTeam(entries, teamName, { beforeDate, excludeEventId, limit: FORM_PROFILE_SAMPLE_LIMIT });
  if (played.length < MIN_FORM_SAMPLES) return null;

  let wins = 0;
  let cornersForSum = 0, cornersForN = 0;
  let cornersAgainstSum = 0, cornersAgainstN = 0;
  let shotsForSum = 0, shotsForN = 0;
  let shotsAgainstSum = 0, shotsAgainstN = 0;

  for (const e of played) {
    const isHome = sameTeam(e.homeName, teamName);
    const goalsFor = (isHome ? e.homeGoals : e.awayGoals) ?? 0;
    const goalsAgainst = (isHome ? e.awayGoals : e.homeGoals) ?? 0;
    if (goalsFor > goalsAgainst) wins += 1;

    if (e.hasStats) {
      const cf = isHome ? e.homeCorners : e.awayCorners;
      const ca = isHome ? e.awayCorners : e.homeCorners;
      if (cf != null) { cornersForSum += cf; cornersForN += 1; }
      if (ca != null) { cornersAgainstSum += ca; cornersAgainstN += 1; }
      const sf = isHome ? e.homeShotsOnTarget : e.awayShotsOnTarget;
      const sa = isHome ? e.awayShotsOnTarget : e.homeShotsOnTarget;
      if (sf != null) { shotsForSum += sf; shotsForN += 1; }
      if (sa != null) { shotsAgainstSum += sa; shotsAgainstN += 1; }
    }
  }

  return {
    sampleSize: played.length,
    winRate: +(wins / played.length).toFixed(2),
    cornersFav: cornersForN >= MIN_FORM_SAMPLES ? +(cornersForSum / cornersForN).toFixed(2) : null,
    cornersAgainst: cornersAgainstN >= MIN_FORM_SAMPLES ? +(cornersAgainstSum / cornersAgainstN).toFixed(2) : null,
    shotsOnTargetFav: shotsForN >= MIN_FORM_SAMPLES ? +(shotsForSum / shotsForN).toFixed(2) : null,
    shotsOnTargetAgainst: shotsAgainstN >= MIN_FORM_SAMPLES ? +(shotsAgainstSum / shotsAgainstN).toFixed(2) : null,
  };
}

function applyFormProfile(resolved, form) {
  if (!form) return resolved;
  const out = { ...resolved };
  if (form.cornersFav != null) out.cornersFav = form.cornersFav;
  if (form.cornersAgainst != null) out.cornersAgainst = form.cornersAgainst;
  if (form.shotsOnTargetFav != null) out.shotsOnTargetFav = form.shotsOnTargetFav;
  if (form.shotsOnTargetAgainst != null) out.shotsOnTargetAgainst = form.shotsOnTargetAgainst;
  return out;
}

function leagueTeam(name, logo, formProfile) {
  const resolved = applyFormProfile(resolveTeam(name), formProfile);
  const stats = teamStats(resolved);
  if (formProfile?.winRate != null) stats.winRate = formProfile.winRate;
  return {
    resolved,
    view: {
      name: resolved.displayName,
      originalName: name,
      flag: resolved.flag,
      iso: resolved.iso,
      flagUrl: resolved.flagUrl,
      logo: logo || null,
      stats,
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

function enrichLeagueMatch(entry, competition, recentEntries = []) {
  const formOpts = { beforeDate: entry.dateIso, excludeEventId: entry.espnEventId };
  const homeForm = computeTeamFormProfile(recentEntries, entry.homeName, formOpts);
  const awayForm = computeTeamFormProfile(recentEntries, entry.awayName, formOpts);
  const homeT = leagueTeam(entry.homeName, entry.homeLogo, homeForm);
  const awayT = leagueTeam(entry.awayName, entry.awayLogo, awayForm);
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
    id: Number(entry.espnEventId),
    matchNumber: Number(entry.espnEventId),
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

/** Partidos de un equipo dentro de la competición, más recientes primero, antes de una fecha dada. */
function getPlayedEntriesForTeam(entries, teamName, { excludeEventId, beforeDate, limit } = {}) {
  const list = entries
    .filter((e) => !excludeEventId || String(e.espnEventId) !== String(excludeEventId))
    .filter((e) => !beforeDate || e.dateIso <= beforeDate)
    .filter((e) => teamPlayedInEntry(e, teamName))
    .sort((a, b) => b.dateIso.localeCompare(a.dateIso) || String(b.espnEventId).localeCompare(String(a.espnEventId)));
  return limit ? list.slice(0, limit) : list;
}

/** Últimos N partidos finalizados de un equipo dentro de la competición, antes de una fecha dada. */
function getTeamRecentFormFromEntries(entries, teamName, { excludeEventId, beforeDate, limit = RECENT_FORM_LIMIT } = {}) {
  const played = getPlayedEntriesForTeam(entries, teamName, { excludeEventId, beforeDate, limit });

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

  const [raw, recentEntries] = await Promise.all([
    loadRawMatches(competition, dateIso, force),
    getRecentFinishedEntries(competition).catch(() => []),
  ]);

  const enriched = raw
    .map((entry) => enrichLeagueMatch(entry, competition, recentEntries))
    .sort((a, b) => new Date(a.kickoffUtc) - new Date(b.kickoffUtc));

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
