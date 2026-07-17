import { teamPairKey } from './teamKeys.js';
import { espnToFixtureName } from './liveScores.js';
import {
  loadSofaRefereesForDate,
  verifyRefereeNames,
  invalidateSofaScoreCache,
} from './sofascore.js';
import {
  loadFifaRefereesForDate,
  getFifaRefereeByMatchNumber,
  invalidateFifaRefereeCache,
} from './fifaReferees.js';

const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const ESPN_SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary';
const CACHE_MS = 5 * 60 * 1000;
const CACHE_KO_MS = 60 * 1000;
const FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Coded-Sports/1.0',
};

let cache = { at: 0, dateKey: null, map: new Map() };

async function fetchMainRefereeName(espnEventId) {
  try {
    const res = await fetch(`${ESPN_SUMMARY}?event=${espnEventId}`, { headers: FETCH_HEADERS });
    if (!res.ok) return null;

    const summary = await res.json();
    const officials = summary.gameInfo?.officials || [];
    const main = officials.find(
      (o) => o.position?.name === 'Referee' || o.position?.id === '1' || o.order === 1
    );
    return main?.fullName || main?.displayName || null;
  } catch {
    return null;
  }
}

async function fetchRefereesFromEspn(dateIso) {
  const espnDate = dateIso.replace(/-/g, '');
  const res = await fetch(`${ESPN_SCOREBOARD}?dates=${espnDate}`, { headers: FETCH_HEADERS });
  if (!res.ok) return new Map();

  const data = await res.json();
  const map = new Map();
  const pending = [];

  for (const event of data.events || []) {
    const comp = event.competitions?.[0];
    const home = comp?.competitors?.find((c) => c.homeAway === 'home');
    const away = comp?.competitors?.find((c) => c.homeAway === 'away');
    if (!home || !away || !event.id) continue;

    const homeName = espnToFixtureName(home.team?.displayName);
    const awayName = espnToFixtureName(away.team?.displayName);
    const key = teamPairKey(dateIso, homeName, awayName);

    pending.push(
      fetchMainRefereeName(event.id).then((name) => {
        if (name) {
          map.set(key, { name, source: 'espn', country: null, cardsPerGame: null });
        }
      })
    );
  }

  await Promise.all(pending);
  return map;
}

function mergeRefereeEntry(fifa, espn, sofa) {
  const sources = [fifa, espn, sofa].filter(Boolean);
  if (!sources.length) return null;

  const primary = fifa || sofa || espn;
  let name = primary.name;
  let country = primary.country || 'Internacional';
  let cardsPerGame = sofa?.cardsPerGame ?? fifa?.cardsPerGame ?? espn?.cardsPerGame ?? null;
  let source = primary.source || 'fifa';
  let verified = true;
  let conflict = false;

  if (fifa && espn) {
    const check = verifyRefereeNames(fifa.name, espn.name);
    if (!check.match) conflict = true;
  }
  if (fifa && sofa) {
    const check = verifyRefereeNames(fifa.name, sofa.name);
    if (!check.match) conflict = true;
  }

  if (fifa) {
    source = espn && verifyRefereeNames(fifa.name, espn.name).match
      ? 'fifa+espn'
      : sofa && verifyRefereeNames(fifa.name, sofa.name).match
        ? 'fifa+sofascore'
        : 'fifa';
    name = fifa.name;
    country = fifa.country || country;
  } else if (espn && sofa) {
    const check = verifyRefereeNames(espn.name, sofa.name);
    name = check.match ? espn.name : (sofa.name || espn.name);
    source = check.match ? 'espn+sofascore' : 'sofascore';
    conflict = !check.match;
  }

  return {
    name,
    country,
    cardsPerGame,
    yellowCards: sofa?.yellowCards ?? null,
    redCards: sofa?.redCards ?? null,
    games: sofa?.games ?? null,
    source,
    verified,
    conflict,
    fifaName: fifa?.name ?? null,
    espnName: espn?.name ?? null,
    sofaName: sofa?.name ?? null,
  };
}

function mergeRefereeMaps(fifaMap, espnMap, sofaMap) {
  const merged = new Map();
  const keys = new Set([
    ...fifaMap.keys(),
    ...espnMap.keys(),
    ...sofaMap.keys(),
  ]);

  for (const key of keys) {
    const entry = mergeRefereeEntry(
      fifaMap.get(key),
      espnMap.get(key),
      sofaMap.get(key)
    );
    if (entry) merged.set(key, entry);
  }

  return merged;
}

function cacheTtlMs(dateIso) {
  return dateIso >= '2026-06-28' ? CACHE_KO_MS : CACHE_MS;
}

/** Mapa fecha|equipos → datos del árbitro (FIFA + ESPN + SofaScore). */
export async function loadRefereesForDate(dateIso, force = false) {
  const now = Date.now();
  const ttl = cacheTtlMs(dateIso);

  if (!force && cache.dateKey === dateIso && now - cache.at < ttl) {
    return cache.map;
  }

  const [fifaMap, espnMap, sofaMap] = await Promise.all([
    loadFifaRefereesForDate(dateIso),
    fetchRefereesFromEspn(dateIso),
    loadSofaRefereesForDate(dateIso, force),
  ]);

  const map = mergeRefereeMaps(fifaMap, espnMap, sofaMap);
  cache = { at: now, dateKey: dateIso, map };
  return map;
}

export function getRefereeForMatch(refereeMap, dateIso, homeTeam, awayTeam, matchNumber = null) {
  if (matchNumber != null) {
    const numKey = `m:${matchNumber}`;
    if (refereeMap.has(numKey)) return refereeMap.get(numKey);
  }
  const key = teamPairKey(dateIso, homeTeam, awayTeam);
  if (refereeMap.has(key)) return refereeMap.get(key);

  if (matchNumber != null) {
    for (const [mapKey, entry] of refereeMap.entries()) {
      if (entry?.matchNumber === Number(matchNumber)) return entry;
    }
  }

  return null;
}

export async function getRefereeForMatchAsync(dateIso, homeTeam, awayTeam, matchNumber = null) {
  if (matchNumber != null) {
    const byNum = await getFifaRefereeByMatchNumber(matchNumber);
    if (byNum?.name) return byNum;
  }

  const map = await loadRefereesForDate(dateIso);
  return getRefereeForMatch(map, dateIso, homeTeam, awayTeam, matchNumber);
}

export async function loadRefereesForDates(dates = []) {
  const merged = new Map();
  const unique = [...new Set(dates.filter(Boolean))];

  await Promise.all(unique.map(async (dateIso) => {
    const dayMap = await loadRefereesForDate(dateIso);
    dayMap.forEach((entry, key) => merged.set(key, entry));
  }));

  return merged;
}

export function getRefereeNameForMatch(refereeMap, dateIso, homeTeam, awayTeam) {
  return getRefereeForMatch(refereeMap, dateIso, homeTeam, awayTeam)?.name ?? null;
}

export function invalidateRefereeCache() {
  cache = { at: 0, dateKey: null, map: new Map() };
  invalidateSofaScoreCache();
  invalidateFifaRefereeCache();
}
