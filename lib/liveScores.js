import { resolveTeam } from './teams.js';
import { normalizeOpenFootballTeamName } from './bracket.js';
import { teamPairKey, orientLiveFeedToFixture } from './teamKeys.js';
import { parseShootoutFromDetails, parseShootoutFromSummary } from './knockoutLive.js';

const DEFAULT_SLUG = 'fifa.world';
const scoreboardUrl = (slug = DEFAULT_SLUG) => `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`;
const summaryUrl = (slug = DEFAULT_SLUG) => `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary`;
const FALLBACK_GAMES_URL = 'https://worldcup26.ir/get/games';
const CACHE_MS = 55_000;
const FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Coded-Sports/1.0',
};

const ESPN_TEAM_ALIASES = {
  'korea republic': 'South Korea',
  'ir iran': 'Iran',
  usa: 'United States',
  "cote d'ivoire": 'Ivory Coast',
  'democratic republic of the congo': 'DR Congo',
  'bosnia and herzegovina': 'Bosnia and Herzegovina',
  'czech republic': 'Czech Republic',
  czechia: 'Czech Republic',
  'cape verde': 'Cape Verde',
};

let cache = { at: 0, map: new Map(), dateKey: null };

export function espnToFixtureName(displayName) {
  const key = (displayName || '').toLowerCase().trim();
  return ESPN_TEAM_ALIASES[key] || displayName;
}

export function liveKey(dateIso, homeName, awayName) {
  return teamPairKey(dateIso, homeName, awayName);
}

function parseMinute(displayValue) {
  if (!displayValue) return 0;
  const m = String(displayValue).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function statValue(competitor, name) {
  const raw = competitor?.statistics?.find((s) => s.name === name)?.displayValue;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

function parseDetails(details, homeTeamId, awayTeamId) {
  let htHomeGoals = 0;
  let htAwayGoals = 0;
  let yellowCards = 0;
  let redCards = 0;

  for (const item of details || []) {
    const text = item.type?.text || '';
    const minute = parseMinute(item.clock?.displayValue);
    const period = item.clock?.period ?? item.period?.number;
    const isHome = String(item.team?.id) === String(homeTeamId);
    const firstHalf = period === 1 || period === '1' || minute <= 45;

    if (text === 'Goal' && !item.shootout && firstHalf) {
      if (isHome) htHomeGoals += 1;
      else htAwayGoals += 1;
    }
    if (text === 'Yellow Card') yellowCards += 1;
    if (text === 'Red Card') redCards += 1;
  }

  return { htHomeGoals, htAwayGoals, yellowCards, redCards };
}

function parseCornerHalves(commentary) {
  let firstHalfCorners = 0;
  let secondHalfCorners = 0;
  let inSecondHalf = false;

  for (const item of commentary || []) {
    const text = item.text || '';
    if (/second half begins/i.test(text)) inSecondHalf = true;
    if (/^Corner,/i.test(text)) {
      if (inSecondHalf) secondHalfCorners += 1;
      else firstHalfCorners += 1;
    }
  }

  return { firstHalfCorners, secondHalfCorners };
}

function parseScoreboardEvent(event, dateIso, { includeScheduled = false } = {}) {
  const comp = event.competitions?.[0];
  if (!comp) return null;

  const home = comp.competitors?.find((c) => c.homeAway === 'home');
  const away = comp.competitors?.find((c) => c.homeAway === 'away');
  if (!home || !away) return null;

  const state = event.status?.type?.state;
  if (state !== 'in' && state !== 'post' && !(includeScheduled && state === 'pre')) return null;

  if (state === 'pre') {
    return {
      espnEventId: event.id,
      dateIso,
      homeName: espnToFixtureName(home.team?.displayName),
      awayName: espnToFixtureName(away.team?.displayName),
      homeTeamId: home.team?.id,
      awayTeamId: away.team?.id,
      homeLogo: home.team?.logo || null,
      awayLogo: away.team?.logo || null,
      kickoffUtc: event.date,
      venue: comp.venue?.fullName || null,
      homeGoals: 0,
      awayGoals: 0,
      htHomeGoals: 0,
      htAwayGoals: 0,
      isLive: false,
      isFinished: false,
      hasStats: false,
    };
  }

  const homeName = espnToFixtureName(home.team?.displayName);
  const awayName = espnToFixtureName(away.team?.displayName);
  const homeGoals = parseInt(home.score, 10) || statValue(home, 'totalGoals');
  const awayGoals = parseInt(away.score, 10) || statValue(away, 'totalGoals');
  const homeCorners = statValue(home, 'wonCorners');
  const awayCorners = statValue(away, 'wonCorners');
  const homeShotsOnTarget = statValue(home, 'shotsOnTarget');
  const awayShotsOnTarget = statValue(away, 'shotsOnTarget');
  const homeYellow = statValue(home, 'yellowCards');
  const awayYellow = statValue(away, 'yellowCards');
  const homeRed = statValue(home, 'redCards');
  const awayRed = statValue(away, 'redCards');

  const fromDetails = parseDetails(comp.details, home.team?.id, away.team?.id);
  const homeWinner = !!home.winner;
  const awayWinner = !!away.winner;
  const winnerTeam = homeWinner
    ? resolveTeam(homeName).displayName
    : awayWinner
      ? resolveTeam(awayName).displayName
      : null;

  const compStatus = comp.status;
  const statusType = compStatus?.type || event.status?.type;

  return {
    espnEventId: event.id,
    dateIso,
    homeName,
    awayName,
    homeTeamId: home.team?.id,
    awayTeamId: away.team?.id,
    homeLogo: home.team?.logo || null,
    awayLogo: away.team?.logo || null,
    kickoffUtc: event.date,
    venue: comp.venue?.fullName || null,
    homeGoals,
    awayGoals,
    homeShootoutScore: home.shootoutScore ?? null,
    awayShootoutScore: away.shootoutScore ?? null,
    compPeriod: compStatus?.period ?? null,
    displayClock: compStatus?.displayClock ?? null,
    statusName: statusType?.name ?? null,
    statusDetail: statusType?.detail || statusType?.shortDetail || null,
    details: comp.details || [],
    htHomeGoals: fromDetails.htHomeGoals,
    htAwayGoals: fromDetails.htAwayGoals,
    homeCorners,
    awayCorners,
    totalCorners: homeCorners + awayCorners,
    homeShotsOnTarget,
    awayShotsOnTarget,
    totalShotsOnTarget: homeShotsOnTarget + awayShotsOnTarget,
    yellowCards: (homeYellow + awayYellow) || fromDetails.yellowCards,
    redCards: (homeRed + awayRed) || fromDetails.redCards,
    firstHalfCorners: null,
    secondHalfCorners: null,
    isLive: state === 'in',
    isFinished: state === 'post',
    homeWinner,
    awayWinner,
    winnerTeam,
    hasStats: true,
  };
}

async function enrichFromSummary(entry, sportSlug = DEFAULT_SLUG) {
  if (!entry?.espnEventId) return entry;

  try {
    const res = await fetch(`${summaryUrl(sportSlug)}?event=${entry.espnEventId}`, { headers: FETCH_HEADERS });
    if (!res.ok) return entry;

    const summary = await res.json();
    const teams = summary.boxscore?.teams || [];
    const homeBox = teams.find((t) => t.homeAway === 'home');
    const awayBox = teams.find((t) => t.homeAway === 'away');

    const boxStat = (team, name) => {
      const raw = team?.statistics?.find((s) => s.name === name)?.displayValue;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : null;
    };

    const homeCorners = boxStat(homeBox, 'wonCorners') ?? entry.homeCorners;
    const awayCorners = boxStat(awayBox, 'wonCorners') ?? entry.awayCorners;
    const homeShots = boxStat(homeBox, 'shotsOnTarget') ?? entry.homeShotsOnTarget;
    const awayShots = boxStat(awayBox, 'shotsOnTarget') ?? entry.awayShotsOnTarget;
    const homeYellow = boxStat(homeBox, 'yellowCards');
    const awayYellow = boxStat(awayBox, 'yellowCards');
    const homeRed = boxStat(homeBox, 'redCards');
    const awayRed = boxStat(awayBox, 'redCards');

    const summaryYellow = (homeYellow ?? 0) + (awayYellow ?? 0);
    const summaryRed = (homeRed ?? 0) + (awayRed ?? 0);

    const { firstHalfCorners, secondHalfCorners } = parseCornerHalves(summary.commentary);

    const headerComp = summary.header?.competitions?.[0];
    const headerStatus = headerComp?.status;
    const headerType = headerStatus?.type;

    let shootout = parseShootoutFromSummary(
      summary.shootout,
      entry.homeTeamId,
      entry.awayTeamId
    );
    if (!shootout) {
      shootout = parseShootoutFromDetails(
        headerComp?.details || entry.details,
        entry.homeTeamId,
        entry.awayTeamId
      );
    }

    return {
      ...entry,
      homeCorners,
      awayCorners,
      totalCorners: homeCorners + awayCorners,
      homeShotsOnTarget: homeShots,
      awayShotsOnTarget: awayShots,
      totalShotsOnTarget: homeShots + awayShots,
      yellowCards: summaryYellow > 0 ? summaryYellow : entry.yellowCards,
      redCards: summaryRed > 0 ? summaryRed : entry.redCards,
      firstHalfCorners,
      secondHalfCorners,
      compPeriod: headerStatus?.period ?? entry.compPeriod,
      displayClock: headerStatus?.displayClock ?? entry.displayClock,
      statusName: headerType?.name ?? entry.statusName,
      statusDetail: headerType?.detail || headerType?.shortDetail || entry.statusDetail,
      shootout,
      hasStats: true,
    };
  } catch {
    return entry;
  }
}

async function fetchEspnLiveMap(dateIso, sportSlug = DEFAULT_SLUG, { includeScheduled = false } = {}) {
  const espnDate = dateIso.replace(/-/g, '');
  const res = await fetch(`${scoreboardUrl(sportSlug)}?dates=${espnDate}`, { headers: FETCH_HEADERS });
  if (!res.ok) return new Map();

  const data = await res.json();
  const map = new Map();
  const pending = [];

  for (const event of data.events || []) {
    const parsed = parseScoreboardEvent(event, dateIso, { includeScheduled });
    if (!parsed) continue;

    const key = liveKey(dateIso, parsed.homeName, parsed.awayName);

    if (parsed.isLive === false && parsed.isFinished === false) {
      map.set(key, parsed);
      continue;
    }

    pending.push(
      enrichFromSummary(parsed, sportSlug).then((enriched) => {
        map.set(key, enriched);
      })
    );
  }

  await Promise.all(pending);
  return map;
}

function parseLocalDate(localDate) {
  const m = String(localDate || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[1]}-${m[2]}`;
}

async function fetchFallbackScores(dateIso) {
  const map = new Map();
  try {
    const res = await fetch(FALLBACK_GAMES_URL, { headers: FETCH_HEADERS });
    if (!res.ok) return map;

    const data = await res.json();
    for (const game of data.games || []) {
      const finished = String(game.finished).toUpperCase() === 'TRUE';
      const active = game.time_elapsed === 'live'
        || (!finished && game.time_elapsed !== 'notstarted');
      if (!active && !finished) continue;

      const gameDate = parseLocalDate(game.local_date);
      if (gameDate !== dateIso) continue;

      const key = liveKey(dateIso, game.home_team_name_en, game.away_team_name_en);
      if (map.has(key)) continue;

      map.set(key, {
        homeName: game.home_team_name_en,
        awayName: game.away_team_name_en,
        homeGoals: parseInt(game.home_score, 10) || 0,
        awayGoals: parseInt(game.away_score, 10) || 0,
        htHomeGoals: 0,
        htAwayGoals: 0,
        isLive: game.time_elapsed === 'live',
        isFinished: finished,
        hasStats: false,
      });
    }
  } catch (err) {
    console.error('[liveScores/fallback]', err.message);
  }
  return map;
}

export async function loadLiveScoresMap(dateIso, force = false) {
  const now = Date.now();
  const cacheKey = dateIso || 'today';
  if (!force && now - cache.at < CACHE_MS && cache.dateKey === cacheKey) {
    return cache.map;
  }

  let map = new Map();
  if (dateIso) {
    try {
      map = await fetchEspnLiveMap(dateIso);
    } catch (err) {
      console.error('[liveScores/espn]', err.message);
    }

    if (!map.size) {
      const fallback = await fetchFallbackScores(dateIso);
      fallback.forEach((v, k) => map.set(k, v));
    }
  }

  cache = { at: now, dateKey: cacheKey, map };
  return map;
}

/** Carga resultados ESPN para varias fechas (cuadro eliminatorio). */
export async function loadEspnResultsForDates(dates = []) {
  const merged = new Map();
  const unique = [...new Set(dates.filter(Boolean))];
  await Promise.all(unique.map(async (dateIso) => {
    const dayMap = await fetchEspnLiveMap(dateIso);
    dayMap.forEach((v, k) => merged.set(k, v));
  }));
  return merged;
}

const competitionMatchesCache = new Map(); // `${sportSlug}|${dateIso}` -> { at, matches }
const COMPETITION_CACHE_MS = 55_000;

/**
 * Carga todos los partidos (programados, en vivo y finalizados) de una liga/copa
 * para una fecha, directamente desde ESPN — a diferencia de loadLiveScoresMap
 * (que solo trae partidos en vivo/finalizados para superponer sobre un fixture
 * ya conocido de otra fuente), esta función ES la fuente primaria de partidos
 * para competiciones de clubes.
 */
export async function loadCompetitionMatches(dateIso, sportSlug, force = false) {
  const cacheKey = `${sportSlug}|${dateIso}`;
  const now = Date.now();
  const cached = competitionMatchesCache.get(cacheKey);
  if (!force && cached && now - cached.at < COMPETITION_CACHE_MS) {
    return cached.matches;
  }

  const map = await fetchEspnLiveMap(dateIso, sportSlug, { includeScheduled: true });
  const matches = [...map.values()].sort((a, b) => new Date(a.kickoffUtc) - new Date(b.kickoffUtc));
  competitionMatchesCache.set(cacheKey, { at: now, matches });
  return matches;
}

export function invalidateCompetitionMatchesCache(sportSlug) {
  if (!sportSlug) {
    competitionMatchesCache.clear();
    return;
  }
  [...competitionMatchesCache.keys()]
    .filter((k) => k.startsWith(`${sportSlug}|`))
    .forEach((k) => competitionMatchesCache.delete(k));
}

export function getLiveResultForMatch(liveMap, dateIso, homeTeam, awayTeam) {
  const key = liveKey(dateIso, homeTeam, awayTeam);
  const feed = liveMap.get(key) ?? null;
  return orientLiveFeedToFixture(feed, homeTeam, awayTeam);
}

export function mergeLiveResult(baseResult, liveFeed) {
  if (!liveFeed) {
    return baseResult || { homeGoals: 0, awayGoals: 0, htHomeGoals: 0, htAwayGoals: 0 };
  }

  return {
    homeGoals: liveFeed.homeGoals,
    awayGoals: liveFeed.awayGoals,
    htHomeGoals: liveFeed.htHomeGoals ?? 0,
    htAwayGoals: liveFeed.htAwayGoals ?? 0,
  };
}

export function liveStatsPayload(liveFeed) {
  if (!liveFeed?.hasStats) return null;

  return {
    homeCorners: liveFeed.homeCorners ?? 0,
    awayCorners: liveFeed.awayCorners ?? 0,
    totalCorners: liveFeed.totalCorners ?? 0,
    homeShotsOnTarget: liveFeed.homeShotsOnTarget ?? 0,
    awayShotsOnTarget: liveFeed.awayShotsOnTarget ?? 0,
    totalShotsOnTarget: liveFeed.totalShotsOnTarget ?? 0,
    yellowCards: liveFeed.yellowCards ?? 0,
    redCards: liveFeed.redCards ?? 0,
    firstHalfCorners: liveFeed.firstHalfCorners,
    secondHalfCorners: liveFeed.secondHalfCorners,
  };
}

export function invalidateLiveScoresCache() {
  cache = { at: 0, map: new Map(), dateKey: null };
}
