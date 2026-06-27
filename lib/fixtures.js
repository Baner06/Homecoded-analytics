import { getDateISOInColombia, isSameDayColombia, isTodayDateIso } from './timezone.js';
import { resolveTeam, teamStats } from './teams.js';
import { assignReferee, formatRefereeDisplay } from './referees.js';
import { computePredictions, buildLiveProbableActions } from './predictions.js';
import {
  buildActualStats,
  evaluatePredictions,
  parseOpenFootballScore,
  computeLiveProgress,
} from './evaluation.js';
import { computeLiveClock, liveEvalContext, LIVE_MATCH_WINDOW_MS } from './liveClock.js';
import { getLiveResultForMatch, loadLiveScoresMap, liveStatsPayload, mergeLiveResult } from './liveScores.js';
import { getVerifiedStats } from './matchStats.js';

const FIXTURES_URL = 'https://www.thestatsapi.com/world-cup/data/fixtures.json';
const FALLBACK_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

const MATCH_DURATION_MS = LIVE_MATCH_WINDOW_MS;

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'HomeCoded-Analytics/1.0' },
  });
  if (!res.ok) throw new Error(`No se pudo cargar fixture desde ${url} (${res.status})`);
  return res.json();
}

function matchResultKey(date, homeTeam, awayTeam) {
  const home = resolveTeam(homeTeam);
  const away = resolveTeam(awayTeam);
  return `${date}|${home.displayName}|${away.displayName}`;
}

function normalizeStatsApi(fixtures) {
  return fixtures.map((f) => ({
    matchNumber: f.matchNumber,
    date: f.date,
    kickoffUtc: f.kickoffUtc,
    stage: f.stage,
    group: f.group ? `Grupo ${f.group}` : '',
    homeTeam: f.homeTeam,
    awayTeam: f.awayTeam,
    venue: f.stadium || f.hostCity || '',
    status: 'scheduled',
    result: null,
  }));
}

function parseOpenFootballTime(timeStr) {
  const m = String(timeStr || '').match(/(\d{1,2}):(\d{2})\s*UTC([+-]?\d+)/i);
  if (!m) return null;
  const hour = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const offset = parseInt(m[3], 10);
  return { hour, min, offsetHours: offset };
}

function openFootballToUtcIso(date, timeStr) {
  const parsed = parseOpenFootballTime(timeStr);
  if (!parsed) return `${date}T18:00:00Z`;
  const utcHour = parsed.hour - parsed.offsetHours;
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCHours(utcHour, parsed.min, 0, 0);
  return d.toISOString();
}

function normalizeOpenFootball(matches) {
  return matches.map((m, i) => {
    const result = parseOpenFootballScore(m);
    return {
      matchNumber: i + 1,
      date: m.date,
      kickoffUtc: openFootballToUtcIso(m.date, m.time),
      stage: m.round || 'group-stage',
      group: m.group || '',
      homeTeam: m.team1,
      awayTeam: m.team2,
      venue: m.ground || '',
      status: result ? 'finished' : 'scheduled',
      result,
    };
  });
}

async function loadOpenFootballResultsMap() {
  try {
    const data = await fetchJson(FALLBACK_URL);
    const map = new Map();
    for (const m of data.matches || []) {
      const result = parseOpenFootballScore(m);
      if (!result) continue;
      map.set(matchResultKey(m.date, m.team1, m.team2), result);
    }
    return map;
  } catch {
    return new Map();
  }
}

function mergeResults(fixtures, resultsMap) {
  return fixtures.map((f) => {
    const result = resultsMap.get(matchResultKey(f.date, f.homeTeam, f.awayTeam));
    if (!result) return f;
    return { ...f, status: 'finished', result };
  });
}

async function loadAllFixtures() {
  const resultsMap = await loadOpenFootballResultsMap();
  try {
    const data = await fetchJson(FIXTURES_URL);
    return mergeResults(normalizeStatsApi(data.fixtures || []), resultsMap);
  } catch (_) {
    return normalizeOpenFootball((await fetchJson(FALLBACK_URL)).matches || []);
  }
}

function resolveStatus(raw) {
  const now = Date.now();
  const kickoff = new Date(raw.kickoffUtc).getTime();
  if (raw.status === 'finished' && raw.result) return 'finished';
  if (now >= kickoff && now <= kickoff + MATCH_DURATION_MS) return 'live';
  return 'scheduled';
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
  const clock = computeLiveClock(raw.kickoffUtc);
  const progressPct = Math.min(100, Math.round((clock.minute / 90) * 100));

  const partial = buildActualStats(
    matchResult,
    resolveTeam(raw.homeTeam),
    resolveTeam(raw.awayTeam),
    raw.date,
    liveStatsPayload(liveFeed)
  );

  const ctx = liveEvalContext(clock);
  const actions = analysis.probableActions.map((action) => ({
    rank: action.rank,
    label: action.label,
    progress: computeLiveProgress(partial, action, clock.minute),
  }));

  return { ...clock, progressPct, actions };
}

function enrichMatch(raw, liveScoresMap = new Map()) {
  const home = resolveTeam(raw.homeTeam);
  const away = resolveTeam(raw.awayTeam);
  const referee = assignReferee(raw.matchNumber, home.displayName, away.displayName, raw.date);
  const homeStats = teamStats(home);
  const awayStats = teamStats(away);

  const analysis = computePredictions(
    { ...home, ...homeStats },
    { ...away, ...awayStats },
    referee
  );

  const status = resolveStatus(raw);
  const liveFeed = getLiveResultForMatch(liveScoresMap, raw.date, raw.homeTeam, raw.awayTeam);
  const matchResult = mergeLiveResult(raw.result, liveFeed);

  const isFinished = status === 'finished';
  let review = null;
  let score = null;
  let actualStats = null;
  let live = null;

  if (isFinished) {
    score = {
      home: raw.result.homeGoals,
      away: raw.result.awayGoals,
      htHome: raw.result.htHomeGoals,
      htAway: raw.result.htAwayGoals,
    };
    actualStats = buildActualStats(
      raw.result,
      home,
      away,
      raw.date,
      liveStatsPayload(liveFeed)
    );
    review = evaluatePredictions(analysis.probableActions, actualStats);
  } else if (status === 'live') {
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
  }

  return {
    id: raw.matchNumber,
    matchNumber: raw.matchNumber,
    date: raw.date,
    kickoffUtc: raw.kickoffUtc,
    stage: raw.stage,
    group: raw.group,
    status,
    venue: raw.venue,
    score,
    actualStats: formatActualStats(actualStats),
    live,
    review,
    home: {
      name: home.displayName,
      originalName: raw.homeTeam,
      flag: home.flag,
      iso: home.iso,
      flagUrl: home.flagUrl,
      logo: home.logo,
      stats: homeStats,
    },
    away: {
      name: away.displayName,
      originalName: raw.awayTeam,
      flag: away.flag,
      iso: away.iso,
      flagUrl: away.flagUrl,
      logo: away.logo,
      stats: awayStats,
    },
    referee: {
      name: referee.name,
      country: referee.country,
      rigor: referee.rigor,
      assigned: referee.assigned !== false,
      label: formatRefereeDisplay(referee),
    },
    analysis,
  };
}

export async function getTodayMatches(dateIso = getDateISOInColombia()) {
  const [all, liveScoresMap] = await Promise.all([
    loadAllFixtures(),
    loadLiveScoresMap(dateIso),
  ]);
  const tournamentDates = [...new Set(all.map((f) => f.date))].sort();
  const todayRaw = all.filter((f) => isSameDayColombia(f.kickoffUtc, dateIso));

  const matches = todayRaw
    .map((raw) => enrichMatch(raw, liveScoresMap))
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
