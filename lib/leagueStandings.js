/** Tabla de posiciones para ligas de clubes, vía el endpoint público de standings de ESPN. */
import { getCompetition } from './competitions.js';

const FETCH_HEADERS = { Accept: 'application/json', 'User-Agent': 'Coded-Sports/1.0' };
const CACHE_MS = 20 * 60 * 1000;
const cache = new Map(); // competitionId -> { at, data }

function standingsUrl(slug) {
  return `https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings`;
}

function statMap(entryStats) {
  const map = {};
  for (const s of entryStats || []) map[s.name] = s.value ?? s.displayValue;
  return map;
}

function mapGroup(group) {
  const entries = group.standings?.entries || [];
  const rows = entries.map((e) => {
    const stats = statMap(e.stats);
    return {
      team: e.team?.displayName || '—',
      logo: e.team?.logos?.[0]?.href || null,
      played: Number(stats.gamesPlayed) || 0,
      won: Number(stats.wins) || 0,
      drawn: Number(stats.ties) || 0,
      lost: Number(stats.losses) || 0,
      goalsFor: Number(stats.pointsFor) || 0,
      goalsAgainst: Number(stats.pointsAgainst) || 0,
      goalDiff: Number(stats.pointDifferential) || 0,
      points: Number(stats.points) || 0,
      rank: Number(stats.rank) || 0,
    };
  }).sort((a, b) => (a.rank || 999) - (b.rank || 999));

  return { name: group.name || 'Tabla', rows };
}

function hasRealData(groups) {
  return groups.some((g) => g.rows.some((r) => r.played > 0 || r.points > 0));
}

async function fetchEspnStandings(slug) {
  const res = await fetch(standingsUrl(slug), { headers: FETCH_HEADERS });
  if (!res.ok) return null;
  const data = await res.json();
  const groups = (data.children || []).map(mapGroup).filter((g) => g.rows.length);
  if (!groups.length) return null;
  return groups;
}

/** Tabla aproximada agregada 3/1/0 a partir de resultados finalizados (respaldo). */
function aggregateFromResults(finishedMatches) {
  const table = new Map();

  const bump = (name, logo) => {
    if (!table.has(name)) {
      table.set(name, { team: name, logo, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 });
    }
    return table.get(name);
  };

  for (const m of finishedMatches) {
    if (!m.score) continue;
    const home = bump(m.home.name, m.home.logo);
    const away = bump(m.away.name, m.away.logo);
    const hg = m.score.home;
    const ag = m.score.away;

    home.played += 1; away.played += 1;
    home.goalsFor += hg; home.goalsAgainst += ag;
    away.goalsFor += ag; away.goalsAgainst += hg;

    if (hg > ag) { home.won += 1; home.points += 3; away.lost += 1; }
    else if (hg < ag) { away.won += 1; away.points += 3; home.lost += 1; }
    else { home.drawn += 1; away.drawn += 1; home.points += 1; away.points += 1; }
  }

  const rows = [...table.values()]
    .map((r) => ({ ...r, goalDiff: r.goalsFor - r.goalsAgainst }))
    .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor);

  return [{ name: 'Tabla aproximada', rows }];
}

export async function getStandings(competitionId, getFinishedMatchesFn) {
  const now = Date.now();
  const cached = cache.get(competitionId);
  if (cached && now - cached.at < CACHE_MS) return cached.data;

  const competition = getCompetition(competitionId);
  if (!competition?.espnSlug) {
    const empty = { competitionId, groups: [], source: 'none', partial: true };
    cache.set(competitionId, { at: now, data: empty });
    return empty;
  }

  let groups = null;
  let source = 'espn';
  try {
    groups = await fetchEspnStandings(competition.espnSlug);
    if (groups && !hasRealData(groups)) groups = null;
  } catch (err) {
    console.error('[leagueStandings/espn]', err.message);
  }

  if (!groups && typeof getFinishedMatchesFn === 'function') {
    source = 'aggregated';
    try {
      const finished = await getFinishedMatchesFn();
      groups = aggregateFromResults(finished);
    } catch (err) {
      console.error('[leagueStandings/aggregate]', err.message);
      groups = [];
    }
  }

  const data = { competitionId, groups: groups || [], source: groups?.length ? source : 'none', partial: source === 'aggregated' };
  cache.set(competitionId, { at: now, data });
  return data;
}

export function invalidateStandingsCache(competitionId) {
  if (competitionId) cache.delete(competitionId);
  else cache.clear();
}
