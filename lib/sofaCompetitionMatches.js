/**
 * Fuente de datos alterna (Sofascore) para copas de club que ESPN no expone
 * en su API de scoreboard. Se usa solo para las competiciones marcadas con
 * provider: 'sofascore' en lib/competitions.js.
 *
 * A diferencia de ESPN (que filtra por fecha en el servidor), Sofascore no
 * ofrece un endpoint "por día" para un torneo: se trae la temporada completa
 * (paginada) una sola vez, se cachea, y el filtrado por fecha ocurre acá.
 * Esto funciona bien porque estas copas tienen pocas decenas de partidos
 * en total por temporada.
 */
import { isSameDayColombia } from './timezone.js';

const SOFA_BASE = 'https://api.sofascore.com/api/v1';
const SOFA_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
  Origin: 'https://www.sofascore.com',
  Referer: 'https://www.sofascore.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};
const SEASON_CACHE_MS = 5 * 60 * 1000;
const MAX_PAGES_PER_DIRECTION = 5;

const STATUS_FINISHED = new Set(['finished', 'canceled', 'abandoned', 'walkover']);
const STATUS_LIVE = new Set(['inprogress']);

let seasonCache = new Map(); // `${tournamentId}-${seasonId}` -> { at, events: Map<eventId, rawEvent> }

async function fetchSofaJson(path) {
  // Timeout defensivo: sin esto, una sola competición con Sofascore lento
  // puede estancar todo un Promise.all de decenas de competiciones (p. ej.
  // Inicio) hasta el límite de la función serverless.
  const res = await fetch(`${SOFA_BASE}${path}`, { headers: SOFA_HEADERS, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Sofascore ${res.status}`);
  return res.json();
}

async function fetchEventsDirection(tournamentId, seasonId, direction) {
  const events = [];
  for (let page = 0; page < MAX_PAGES_PER_DIRECTION; page++) {
    let data;
    try {
      data = await fetchSofaJson(`/unique-tournament/${tournamentId}/season/${seasonId}/events/${direction}/${page}`);
    } catch (err) {
      if (page === 0) throw err;
      break;
    }
    const list = data.events || [];
    if (!list.length) break;
    events.push(...list);
    if (!data.hasNextPage) break;
  }
  return events;
}

async function fetchAllSeasonEvents(tournamentId, seasonId) {
  const [past, upcoming] = await Promise.all([
    fetchEventsDirection(tournamentId, seasonId, 'last'),
    fetchEventsDirection(tournamentId, seasonId, 'next'),
  ]);
  const events = new Map();
  [...past, ...upcoming].forEach((e) => events.set(e.id, e));
  return events;
}

function sofaTeamLogo(teamId) {
  return teamId ? `https://api.sofascore.com/api/v1/team/${teamId}/image` : null;
}

function parseSofaEvent(event, dateIso) {
  const statusType = event.status?.type;
  const isFinished = STATUS_FINISHED.has(statusType);
  const isLive = STATUS_LIVE.has(statusType);
  const homeGoals = event.homeScore?.display ?? event.homeScore?.normaltime ?? 0;
  const awayGoals = event.awayScore?.display ?? event.awayScore?.normaltime ?? 0;

  return {
    espnEventId: `sofa-${event.id}`,
    dateIso,
    homeName: event.homeTeam?.name || 'Por definir',
    awayName: event.awayTeam?.name || 'Por definir',
    homeLogo: sofaTeamLogo(event.homeTeam?.id),
    awayLogo: sofaTeamLogo(event.awayTeam?.id),
    kickoffUtc: new Date(event.startTimestamp * 1000).toISOString(),
    venue: null,
    homeGoals: isFinished || isLive ? homeGoals : 0,
    awayGoals: isFinished || isLive ? awayGoals : 0,
    htHomeGoals: event.homeScore?.period1 ?? 0,
    htAwayGoals: event.awayScore?.period1 ?? 0,
    isLive,
    isFinished,
    hasStats: false,
  };
}

export async function loadSofaCompetitionMatches(dateIso, tournamentId, seasonId, force = false) {
  if (!tournamentId || !seasonId) return [];
  const cacheKey = `${tournamentId}-${seasonId}`;
  const now = Date.now();
  const cached = seasonCache.get(cacheKey);

  let events;
  if (!force && cached && now - cached.at < SEASON_CACHE_MS) {
    events = cached.events;
  } else {
    events = await fetchAllSeasonEvents(tournamentId, seasonId);
    seasonCache.set(cacheKey, { at: now, events });
  }

  return [...events.values()]
    .filter((e) => e.startTimestamp && isSameDayColombia(new Date(e.startTimestamp * 1000).toISOString(), dateIso))
    .map((e) => parseSofaEvent(e, dateIso))
    .sort((a, b) => new Date(a.kickoffUtc) - new Date(b.kickoffUtc));
}

export function invalidateSofaCompetitionCache(tournamentId, seasonId) {
  if (!tournamentId) {
    seasonCache.clear();
    return;
  }
  if (seasonId) {
    seasonCache.delete(`${tournamentId}-${seasonId}`);
    return;
  }
  [...seasonCache.keys()]
    .filter((k) => k.startsWith(`${tournamentId}-`))
    .forEach((k) => seasonCache.delete(k));
}
