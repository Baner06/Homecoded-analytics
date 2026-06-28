import { teamPairKey } from './teamKeys.js';

const SOFA_BASE = 'https://api.sofascore.com/api/v1';
const WC_TOURNAMENT_ID = 16;
const WC_SEASON_ID = 58210;
const CACHE_MS = 5 * 60 * 1000;
const CACHE_KO_MS = 60 * 1000;

const SOFA_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
  Origin: 'https://www.sofascore.com',
  Referer: 'https://www.sofascore.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

const SOFA_TEAM_ALIASES = {
  turkiye: 'Turkey',
  'cote d\'ivoire': 'Ivory Coast',
  'democratic republic of the congo': 'DR Congo',
  'korea republic': 'South Korea',
  'ir iran': 'Iran',
  usa: 'United States',
  'cape verde': 'Cape Verde',
  czechia: 'Czech Republic',
};

let cache = { at: 0, dateKey: null, referees: new Map(), stats: new Map() };

function sofaToFixtureName(name) {
  const key = (name || '').toLowerCase().trim();
  return SOFA_TEAM_ALIASES[key] || name;
}

function eventDateIso(event) {
  if (!event?.startTimestamp) return null;
  return new Date(event.startTimestamp * 1000).toISOString().slice(0, 10);
}

function normalizeName(name) {
  return (name || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function namesMatch(a, b) {
  if (!a || !b) return false;
  const na = normalizeName(a);
  const nb = normalizeName(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function cardsPerGameFromRef(ref) {
  if (!ref?.games) return null;
  const yellow = ref.yellowCards ?? 0;
  const red = ref.redCards ?? 0;
  const yrc = ref.yellowRedCards ?? 0;
  return (yellow + red * 2 + yrc) / ref.games;
}

function parseReferee(ref) {
  if (!ref?.name) return null;
  const cardsPerGame = cardsPerGameFromRef(ref);
  return {
    name: ref.name,
    country: ref.country?.name || 'Internacional',
    yellowCards: ref.yellowCards ?? null,
    redCards: ref.redCards ?? null,
    games: ref.games ?? null,
    cardsPerGame: cardsPerGame != null ? Math.round(cardsPerGame * 100) / 100 : null,
    source: 'sofascore',
  };
}

async function fetchSofaJson(path) {
  const res = await fetch(`${SOFA_BASE}${path}`, { headers: SOFA_HEADERS, cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

async function fetchTournamentEvents(direction, maxPages = 4) {
  const events = [];
  for (let page = 0; page < maxPages; page += 1) {
    const data = await fetchSofaJson(
      `/unique-tournament/${WC_TOURNAMENT_ID}/season/${WC_SEASON_ID}/events/${direction}/${page}`
    );
    if (!data?.events?.length) break;
    events.push(...data.events);
    if (!data.hasNextPage) break;
  }
  return events;
}

async function fetchAllTournamentEvents() {
  const [last, next] = await Promise.all([
    fetchTournamentEvents('last', 4),
    fetchTournamentEvents('next', 2),
  ]);
  const byId = new Map();
  for (const ev of [...last, ...next]) {
    if (ev?.id) byId.set(ev.id, ev);
  }
  return [...byId.values()];
}

async function fetchEventDetail(eventId) {
  const data = await fetchSofaJson(`/event/${eventId}`);
  return data?.event ?? null;
}

function parseStatistics(data) {
  if (!data?.statistics?.length) return null;

  const read = (group, key) => {
    const block = data.statistics.find((s) => s.period === group);
    const item = block?.groups?.flatMap((g) => g.statisticsItems || [])
      .find((s) => s.key === key || s.name === key);
    if (!item) return { home: null, away: null };
    const home = parseFloat(item.homeValue ?? item.home);
    const away = parseFloat(item.awayValue ?? item.away);
    return {
      home: Number.isFinite(home) ? home : null,
      away: Number.isFinite(away) ? away : null,
    };
  };

  const corners = read('ALL', 'cornerKicks');
  const shots = read('ALL', 'shotsOnGoal');
  const yellow = read('ALL', 'yellowCards');

  const homeCorners = corners.home ?? 0;
  const awayCorners = corners.away ?? 0;
  const homeShots = shots.home ?? 0;
  const awayShots = shots.away ?? 0;

  return {
    homeCorners,
    awayCorners,
    totalCorners: homeCorners + awayCorners,
    homeShotsOnTarget: homeShots,
    awayShotsOnTarget: awayShots,
    totalShotsOnTarget: homeShots + awayShots,
    yellowCards: (yellow.home ?? 0) + (yellow.away ?? 0),
    hasStats: true,
    source: 'sofascore',
  };
}

async function fetchEventStatistics(eventId) {
  const data = await fetchSofaJson(`/event/${eventId}/statistics`);
  return parseStatistics(data);
}

async function mapWithLimit(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index;
      index += 1;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function cacheTtlMs(dateIso) {
  return dateIso >= '2026-06-28' ? CACHE_KO_MS : CACHE_MS;
}

/** Árbitros SofaScore por fecha (fecha|equipos). */
export async function loadSofaRefereesForDate(dateIso, force = false) {
  const now = Date.now();
  const ttl = cacheTtlMs(dateIso);

  if (!force && cache.dateKey === dateIso && now - cache.at < ttl && cache.referees.size) {
    return cache.referees;
  }

  const map = new Map();
  try {
    const allEvents = await fetchAllTournamentEvents();
    const dayEvents = allEvents.filter((ev) => eventDateIso(ev) === dateIso);

    await mapWithLimit(dayEvents, 3, async (ev) => {
      const homeName = sofaToFixtureName(ev.homeTeam?.name);
      const awayName = sofaToFixtureName(ev.awayTeam?.name);
      if (!homeName || !awayName) return;

      const key = teamPairKey(dateIso, homeName, awayName);
      let ref = parseReferee(ev.referee);

      if (!ref && ev.id) {
        const detail = await fetchEventDetail(ev.id);
        ref = parseReferee(detail?.referee);
      }

      if (ref) map.set(key, ref);
    });
  } catch (err) {
    console.error('[sofascore/referees]', err.message);
  }

  cache = { ...cache, at: now, dateKey: dateIso, referees: map };
  return map;
}

/** Stats SofaScore por fecha (complemento ESPN). */
export async function loadSofaStatsForDate(dateIso, force = false) {
  const now = Date.now();
  const ttl = cacheTtlMs(dateIso);

  if (!force && cache.dateKey === dateIso && now - cache.at < ttl && cache.stats.size) {
    return cache.stats;
  }

  const map = new Map();
  try {
    const allEvents = await fetchAllTournamentEvents();
    const dayEvents = allEvents.filter((ev) => {
      if (eventDateIso(ev) !== dateIso) return false;
      const type = ev.status?.type;
      return type === 'inprogress' || type === 'finished';
    });

    await mapWithLimit(dayEvents, 3, async (ev) => {
      const homeName = sofaToFixtureName(ev.homeTeam?.name);
      const awayName = sofaToFixtureName(ev.awayTeam?.name);
      if (!homeName || !awayName || !ev.id) return;

      const stats = await fetchEventStatistics(ev.id);
      if (!stats?.hasStats) return;

      const key = teamPairKey(dateIso, homeName, awayName);
      map.set(key, stats);
    });
  } catch (err) {
    console.error('[sofascore/stats]', err.message);
  }

  cache = { ...cache, at: now, dateKey: dateIso, stats: map };
  return map;
}

export function getSofaRefereeForMatch(map, dateIso, homeTeam, awayTeam) {
  const key = teamPairKey(dateIso, homeTeam, awayTeam);
  return map.get(key) ?? null;
}

export function getSofaStatsForMatch(map, dateIso, homeTeam, awayTeam) {
  const key = teamPairKey(dateIso, homeTeam, awayTeam);
  return map.get(key) ?? null;
}

export function verifyRefereeNames(espnName, sofaName) {
  if (!espnName || !sofaName) return { match: true, conflict: false };
  const match = namesMatch(espnName, sofaName);
  return { match, conflict: !match };
}

export function invalidateSofaScoreCache() {
  cache = { at: 0, dateKey: null, referees: new Map(), stats: new Map() };
}

export const SOFA_WC = { tournamentId: WC_TOURNAMENT_ID, seasonId: WC_SEASON_ID };
