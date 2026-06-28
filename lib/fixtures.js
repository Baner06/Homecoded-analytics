import { getDateISOInColombia, isSameDayColombia, isTodayDateIso } from './timezone.js';
import { resolveTeam, teamStats } from './teams.js';
import { formatRefereeDisplay, resolveReferee, UNASSIGNED_REFEREE } from './referees.js';
import { computePredictions, buildLiveProbableActions } from './predictions.js';
import {
  buildActualStats,
  evaluatePredictions,
  parseOpenFootballScore,
  computeLiveProgress,
} from './evaluation.js';
import { computeLiveClock, liveEvalContext, liveWindowMs } from './liveClock.js';
import { buildKnockoutLiveView, mergeKnockoutLiveClock } from './knockoutLive.js';
import {
  getLiveResultForMatch,
  loadLiveScoresMap,
  loadEspnResultsForDates,
  liveStatsPayload,
  mergeLiveResult,
  invalidateLiveScoresCache,
} from './liveScores.js';
import { loadRefereesForDate, invalidateRefereeCache } from './refereeFeed.js';
import { loadSofaStatsForDate, getSofaStatsForMatch, invalidateSofaScoreCache } from './sofascore.js';
import {
  normalizeOpenFootballTeamName,
  openFootballRoundToStage,
  resolveKnockoutBracket,
  stageLabel,
  isKnockoutStageLabel,
  UNDEFINED_TEAM,
} from './bracket.js';
import { syncSquadRegistry, getWcTeamMetricsSync } from './squadRegistry.js';
import { teamPairKey } from './teamKeys.js';
import { buildKnockoutBracketPayload } from './knockoutView.js';

const FIXTURES_URL = 'https://www.thestatsapi.com/world-cup/data/fixtures.json';
const OPEN_FOOTBALL_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
const FIXTURES_CACHE_MS = 5 * 60 * 1000;
const FIXTURES_CACHE_KO_MS = 60 * 1000;

let fixturesCache = { at: 0, data: null };

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'HomeCoded-Analytics/1.0' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`No se pudo cargar fixture desde ${url} (${res.status})`);
  return res.json();
}

function parseOpenFootballTime(timeStr) {
  const m = String(timeStr || '').match(/(\d{1,2}):(\d{2})\s*UTC([+-]?\d+)/i);
  if (!m) return null;
  return {
    hour: parseInt(m[1], 10),
    min: parseInt(m[2], 10),
    offsetHours: parseInt(m[3], 10),
  };
}

function openFootballToUtcIso(date, timeStr) {
  const parsed = parseOpenFootballTime(timeStr);
  if (!parsed) return `${date}T18:00:00Z`;
  const utcHour = parsed.hour - parsed.offsetHours;
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCHours(utcHour, parsed.min, 0, 0);
  return d.toISOString();
}

function normalizeGroupLabel(group) {
  if (!group) return '';
  const g = String(group).replace(/^Group\s*/i, '').trim();
  return g ? `Grupo ${g}` : '';
}

function espnResultToScore(espn) {
  if (!espn?.isFinished) return null;
  return {
    homeGoals: espn.homeGoals,
    awayGoals: espn.awayGoals,
    htHomeGoals: espn.htHomeGoals ?? 0,
    htAwayGoals: espn.htAwayGoals ?? 0,
  };
}

function applyEspnResults(fixtures, espnByPair) {
  if (!espnByPair?.size) return fixtures;
  return fixtures.map((f) => {
    if (f.result) return f;
    const espn = espnByPair.get(teamPairKey(f.date, f.homeTeam, f.awayTeam));
    const result = espnResultToScore(espn);
    if (!result) return f;
    return { ...f, result, status: 'finished' };
  });
}

function buildOpenFootballIndexes(matches, espnByPair) {
  const byNum = new Map();
  const byPair = new Map();

  for (const m of matches) {
    if (m.num) byNum.set(m.num, m);
    const result = parseOpenFootballScore(m);
    const home = normalizeOpenFootballTeamName(m.team1);
    const away = normalizeOpenFootballTeamName(m.team2);
    if (home !== UNDEFINED_TEAM && away !== UNDEFINED_TEAM) {
      byPair.set(teamPairKey(m.date, home, away), { ...m, home, away, result });
    }
  }

  return {
    byNum,
    byPair,
    knockoutResolved: resolveKnockoutBracket(matches.filter((m) => m.num), espnByPair),
  };
}

function pickTeamsFromStatsFixture(statsRow, openFootball) {
  const { byNum, byPair, knockoutResolved } = openFootball;

  if (statsRow.matchNumber >= 73) {
    const resolved = knockoutResolved.get(statsRow.matchNumber);
    if (resolved) {
      return {
        homeTeam: resolved.homeTeam,
        awayTeam: resolved.awayTeam,
        result: resolved.result,
        source: 'openfootball-bracket',
      };
    }
    const raw = byNum.get(statsRow.matchNumber);
    if (raw) {
      return {
        homeTeam: normalizeOpenFootballTeamName(raw.team1),
        awayTeam: normalizeOpenFootballTeamName(raw.team2),
        result: parseOpenFootballScore(raw),
        source: 'openfootball-knockout',
      };
    }
  }

  const pair = byPair.get(teamPairKey(statsRow.date, statsRow.homeTeam, statsRow.awayTeam));
  if (pair) {
    return {
      homeTeam: pair.home,
      awayTeam: pair.away,
      result: pair.result,
      source: 'openfootball-group',
    };
  }

  return {
    homeTeam: normalizeOpenFootballTeamName(statsRow.homeTeam),
    awayTeam: normalizeOpenFootballTeamName(statsRow.awayTeam),
    result: null,
    source: 'thestatsapi',
  };
}

function mergeStatsWithOpenFootball(statsFixtures, openFootballMatches, espnByPair) {
  const openFootball = buildOpenFootballIndexes(openFootballMatches, espnByPair);

  return statsFixtures.map((row) => {
    const picked = pickTeamsFromStatsFixture(row, openFootball);
    const group = row.group ? normalizeGroupLabel(row.group) : normalizeGroupLabel(
      openFootball.byNum.get(row.matchNumber)?.group
    );
    const stage = row.stage || openFootballRoundToStage(
      openFootball.byNum.get(row.matchNumber)?.round
    );

    return {
      matchNumber: row.matchNumber,
      date: row.date,
      kickoffUtc: row.kickoffUtc,
      stage,
      stageLabel: stageLabel(stage, group),
      group,
      homeTeam: picked.homeTeam,
      awayTeam: picked.awayTeam,
      venue: row.stadium || row.hostCity || openFootball.byNum.get(row.matchNumber)?.ground || '',
      status: picked.result ? 'finished' : 'scheduled',
      result: picked.result,
    };
  });
}

function normalizeOpenFootballOnly(matches, espnByPair) {
  const knockoutResolved = resolveKnockoutBracket(matches.filter((m) => m.num), espnByPair);

  return matches.map((m, i) => {
    const matchNumber = m.num || i + 1;
    const stage = openFootballRoundToStage(m.round);
    const group = normalizeGroupLabel(m.group);
    let homeTeam = normalizeOpenFootballTeamName(m.team1);
    let awayTeam = normalizeOpenFootballTeamName(m.team2);
    let result = parseOpenFootballScore(m);

    if (m.num && knockoutResolved.has(m.num)) {
      const resolved = knockoutResolved.get(m.num);
      homeTeam = resolved.homeTeam;
      awayTeam = resolved.awayTeam;
      result = resolved.result;
    }

    return {
      matchNumber,
      date: m.date,
      kickoffUtc: openFootballToUtcIso(m.date, m.time),
      stage,
      stageLabel: stageLabel(stage, group),
      group,
      homeTeam,
      awayTeam,
      venue: m.ground || '',
      status: result ? 'finished' : 'scheduled',
      result,
    };
  });
}

async function buildAllFixtures({ forceSquadSync = false } = {}) {
  const [statsData, openFootballData] = await Promise.all([
    fetchJson(FIXTURES_URL).catch(() => null),
    fetchJson(OPEN_FOOTBALL_URL).catch(() => null),
  ]);

  const openMatches = openFootballData?.matches || [];
  const fixtureDates = statsData?.fixtures?.map((f) => f.date) || [];
  const allDates = [...new Set([
    ...openMatches.map((m) => m.date),
    ...fixtureDates,
  ])];
  const espnByPair = allDates.length
    ? await loadEspnResultsForDates(allDates)
    : new Map();

  let fixtures;
  if (statsData?.fixtures?.length) {
    fixtures = mergeStatsWithOpenFootball(
      statsData.fixtures.map((f) => ({
        matchNumber: f.matchNumber,
        date: f.date,
        kickoffUtc: f.kickoffUtc,
        stage: f.stage,
        group: f.group,
        homeTeam: f.homeTeam,
        awayTeam: f.awayTeam,
        stadium: f.stadium,
        hostCity: f.hostCity,
      })),
      openMatches,
      espnByPair
    );
  } else if (openMatches.length) {
    fixtures = normalizeOpenFootballOnly(openMatches, espnByPair);
  } else {
    throw new Error('No se pudieron cargar los partidos del torneo');
  }

  fixtures = applyEspnResults(fixtures, espnByPair);
  fixtures = applyKnockoutBracket(fixtures, openMatches, espnByPair);
  await syncSquadRegistry({ fixtures, espnByPair, force: forceSquadSync });
  return fixtures;
}

function applyKnockoutBracket(fixtures, openMatches, espnByPair) {
  const resolved = resolveKnockoutBracket(
    openMatches.filter((m) => m.num),
    espnByPair
  );

  return fixtures.map((f) => {
    if (f.matchNumber < 73) return f;
    const r = resolved.get(f.matchNumber);
    if (!r) return f;

    const result = r.result || f.result;
    let status = f.status;
    if (result) status = 'finished';
    else if (r.homeTeam !== UNDEFINED_TEAM && r.awayTeam !== UNDEFINED_TEAM) {
      const espn = espnByPair.get(teamPairKey(f.date, r.homeTeam, r.awayTeam));
      if (espn?.isLive) status = 'live';
      else if (!status || status === 'finished') status = 'scheduled';
    }

    return {
      ...f,
      homeTeam: r.homeTeam,
      awayTeam: r.awayTeam,
      result,
      status,
    };
  });
}

async function loadAllFixtures({ forceSquadSync = false } = {}) {
  const now = Date.now();
  const today = getDateISOInColombia();
  const inKnockoutPhase = today >= '2026-06-28';
  const ttl = inKnockoutPhase ? FIXTURES_CACHE_KO_MS : FIXTURES_CACHE_MS;

  if (fixturesCache.data && now - fixturesCache.at < ttl) {
    return fixturesCache.data;
  }

  invalidateLiveScoresCache();
  const data = await buildAllFixtures({ forceSquadSync });
  fixturesCache = { at: now, data };
  return data;
}

function resolveMatchResult(raw, liveFeed) {
  if (raw.result) return raw.result;
  return espnResultToScore(liveFeed);
}

function resolveStatus(raw, liveFeed) {
  if (raw.homeTeam === UNDEFINED_TEAM || raw.awayTeam === UNDEFINED_TEAM) {
    return 'scheduled';
  }
  if (raw.status === 'finished' && raw.result) return 'finished';
  if (liveFeed?.isFinished) return 'finished';
  if (liveFeed?.isLive) return 'live';

  const now = Date.now();
  const kickoff = new Date(raw.kickoffUtc).getTime();
  const windowMs = liveWindowMs(raw.stage);

  if (now >= kickoff && now <= kickoff + windowMs) return 'live';

  const result = resolveMatchResult(raw, liveFeed);
  if (result && (raw.result || liveFeed?.isFinished)) return 'finished';

  return 'scheduled';
}

function emptyAnalysis() {
  return {
    pending: true,
    dominance: { home: 0, away: 0 },
    winOutlook: null,
    corners: { home: 0, away: 0, total: 0 },
    shotsOnTarget: { home: 0, away: 0, total: 0, homePlayers: [], awayPlayers: [] },
    discipline: { yellowCards: 0, redProb: 0, combinedAgg: 0 },
    probableActions: [],
    liveProbableActions: [],
    liveReview: null,
  };
}

function formatActualStats(actualStats) {
  if (!actualStats) return null;
  return {
    homeCorners: actualStats.homeCorners,
    awayCorners: actualStats.awayCorners,
    totalCorners: actualStats.totalCorners,
    homeShotsOnTarget: actualStats.homeShotsOnTarget,
    awayShotsOnTarget: actualStats.awayShotsOnTarget,
    totalShotsOnTarget: actualStats.totalShotsOnTarget,
    yellowCards: actualStats.yellowCards,
    redCards: actualStats.redCards,
    verified: !!actualStats.verified,
    liveStats: !!actualStats.liveStats,
  };
}

function buildLiveState(raw, analysis, matchResult, liveFeed) {
  const baseClock = computeLiveClock(raw.kickoffUtc);
  const koView = buildKnockoutLiveView(raw.stage, liveFeed, matchResult);
  const clock = mergeKnockoutLiveClock(baseClock, koView, liveFeed, matchResult, raw.stage);
  const progressPct = Math.min(100, Math.round((clock.minute / 90) * 100));

  const partial = buildActualStats(
    matchResult,
    resolveTeam(raw.homeTeam),
    resolveTeam(raw.awayTeam),
    raw.date,
    liveStatsPayload(liveFeed)
  );

  const actions = analysis.probableActions.map((action) => ({
    rank: action.rank,
    label: action.label,
    progress: computeLiveProgress(partial, action, clock.minute),
  }));

  return { ...clock, progressPct, actions, knockout: koView };
}

function mergeLiveFeedWithSofa(liveFeed, sofaStats) {
  if (!sofaStats?.hasStats) return liveFeed;

  const base = liveFeed || {
    homeGoals: 0,
    awayGoals: 0,
    htHomeGoals: 0,
    htAwayGoals: 0,
    hasStats: false,
  };

  if (base.hasStats) return base;

  return {
    ...base,
    homeCorners: sofaStats.homeCorners,
    awayCorners: sofaStats.awayCorners,
    totalCorners: sofaStats.totalCorners,
    homeShotsOnTarget: sofaStats.homeShotsOnTarget,
    awayShotsOnTarget: sofaStats.awayShotsOnTarget,
    totalShotsOnTarget: sofaStats.totalShotsOnTarget,
    yellowCards: sofaStats.yellowCards ?? base.yellowCards,
    hasStats: true,
    statsSource: 'sofascore',
  };
}

function enrichMatch(raw, liveScoresMap = new Map(), refereeMap = new Map(), sofaStats = null) {
  const teamsPending = raw.homeTeam === UNDEFINED_TEAM || raw.awayTeam === UNDEFINED_TEAM;
  const home = resolveTeam(raw.homeTeam);
  const away = resolveTeam(raw.awayTeam);
  const referee = teamsPending
    ? { ...UNASSIGNED_REFEREE }
    : resolveReferee(raw.homeTeam, raw.awayTeam, raw.date, refereeMap, raw.matchNumber);

  const liveFeed = mergeLiveFeedWithSofa(
    getLiveResultForMatch(liveScoresMap, raw.date, raw.homeTeam, raw.awayTeam),
    sofaStats
  );
  const status = resolveStatus(raw, liveFeed);
  const result = resolveMatchResult(raw, liveFeed);
  const matchResult = mergeLiveResult(result, liveFeed);

  const homeStats = teamStats(home);
  const awayStats = teamStats(away);
  const homeWc = getWcTeamMetricsSync(home.displayName);
  const awayWc = getWcTeamMetricsSync(away.displayName);
  const analysis = teamsPending
    ? emptyAnalysis()
    : computePredictions(
      { ...home, ...homeStats, ...homeWc },
      { ...away, ...awayStats, ...awayWc },
      referee
    );

  let review = null;
  let score = null;
  let actualStats = null;
  let live = null;
  let knockout = null;

  if (status === 'finished' && result) {
    score = {
      home: result.homeGoals,
      away: result.awayGoals,
      htHome: result.htHomeGoals ?? 0,
      htAway: result.htAwayGoals ?? 0,
    };
    actualStats = buildActualStats(
      result,
      home,
      away,
      raw.date,
      liveStatsPayload(liveFeed)
    );
    if (!teamsPending) {
      review = evaluatePredictions(analysis.probableActions, actualStats);
    }
    knockout = buildKnockoutLiveView(raw.stage, liveFeed, matchResult);
    if (knockout && !knockout.showShootout && liveFeed?.shootout) {
      knockout = buildKnockoutLiveView(raw.stage, {
        ...liveFeed,
        compPeriod: 5,
        statusName: 'STATUS_FINAL_PEN',
        statusDetail: 'FT-Pens',
      }, matchResult);
    }
  } else if (status === 'live' && !teamsPending) {
    live = buildLiveState(raw, analysis, matchResult, liveFeed);
    const partial = buildActualStats(matchResult, home, away, raw.date, liveStatsPayload(liveFeed));
    actualStats = partial;
    const liveData = buildLiveProbableActions(
      analysis.probableActions,
      liveEvalContext(live),
      partial
    );
    analysis.liveProbableActions = liveData.pending;
    analysis.liveReview = liveData.review;
    score = {
      home: matchResult.homeGoals,
      away: matchResult.awayGoals,
      htHome: matchResult.htHomeGoals ?? 0,
      htAway: matchResult.htAwayGoals ?? 0,
    };
    knockout = live?.knockout ?? null;
  }

  return {
    id: raw.matchNumber,
    matchNumber: raw.matchNumber,
    date: raw.date,
    kickoffUtc: raw.kickoffUtc,
    stage: raw.stage,
    stageLabel: raw.stageLabel,
    group: raw.group,
    isKnockout: isKnockoutStageLabel(raw.stage),
    status,
    venue: raw.venue,
    score,
    actualStats: formatActualStats(actualStats),
    live,
    knockout,
    review,
    teamsPending,
    home: {
      name: home.displayName,
      originalName: raw.homeTeam,
      flag: home.flag,
      iso: home.iso,
      flagUrl: home.flagUrl,
      logo: home.logo,
      stats: homeStats,
      pending: raw.homeTeam === UNDEFINED_TEAM,
    },
    away: {
      name: away.displayName,
      originalName: raw.awayTeam,
      flag: away.flag,
      iso: away.iso,
      flagUrl: away.flagUrl,
      logo: away.logo,
      stats: awayStats,
      pending: raw.awayTeam === UNDEFINED_TEAM,
    },
    referee: {
      name: referee.name,
      country: referee.country,
      rigor: referee.rigor,
      assigned: referee.assigned !== false,
      source: referee.source || null,
      verified: referee.verified !== false,
      label: formatRefereeDisplay(referee),
    },
    analysis,
  };
}

export async function getTodayMatches(dateIso = getDateISOInColombia()) {
  const [all, liveScoresMap, refereeMap, sofaStatsMap] = await Promise.all([
    loadAllFixtures(),
    loadLiveScoresMap(dateIso),
    loadRefereesForDate(dateIso),
    loadSofaStatsForDate(dateIso),
  ]);
  const tournamentDates = [...new Set(all.map((f) => f.date))].sort();
  const todayRaw = all.filter((f) => isSameDayColombia(f.kickoffUtc, dateIso));

  const matches = todayRaw
    .map((raw) => enrichMatch(
      raw,
      liveScoresMap,
      refereeMap,
      getSofaStatsForMatch(sofaStatsMap, raw.date, raw.homeTeam, raw.awayTeam)
    ))
    .sort((a, b) => new Date(a.kickoffUtc) - new Date(b.kickoffUtc));

  return {
    date: dateIso,
    matches,
    totalFixtures: all.length,
    tournamentMinDate: tournamentDates[0] || dateIso,
    tournamentMaxDate: tournamentDates[tournamentDates.length - 1] || dateIso,
    isToday: isTodayDateIso(dateIso),
  };
}

export function invalidateSoftCaches() {
  invalidateLiveScoresCache();
  invalidateRefereeCache();
  invalidateSofaScoreCache();
}

export function invalidateFixturesCache() {
  fixturesCache = { at: 0, data: null };
  invalidateSoftCaches();
}

export async function getKnockoutBracket() {
  const all = await loadAllFixtures();
  const koDates = [...new Set(all.filter((f) => f.matchNumber >= 73).map((f) => f.date))];
  const [espnByPair, openFootballData] = await Promise.all([
    koDates.length ? loadEspnResultsForDates(koDates) : Promise.resolve(new Map()),
    fetchJson(OPEN_FOOTBALL_URL).catch(() => null),
  ]);
  const rawKo = openFootballData?.matches || [];
  return buildKnockoutBracketPayload(all, espnByPair, rawKo);
}
