import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pickMatchLoser } from './evaluation.js';
import { teamPairKey } from './teamKeys.js';
import { isKnockoutStage } from './liveClock.js';

const DISPLAY_ALIASES = {
  Brazil: 'Brasil',
  Japan: 'Japón',
  Algeria: 'Argelia',
  Belgium: 'Bélgica',
  Canada: 'Canadá',
  'Cape Verde': 'Cabo Verde',
  'Congo DR': 'RD Congo',
  Croatia: 'Croacia',
  Curaçao: 'Curazao',
  Czechia: 'Chequia',
  Egypt: 'Egipto',
  England: 'Inglaterra',
  France: 'Francia',
  Germany: 'Alemania',
  Haiti: 'Haití',
  Iran: 'Irán',
  Iraq: 'Irak',
  'Ivory Coast': 'Costa de Marfil',
  Jordan: 'Jordania',
  Mexico: 'México',
  Morocco: 'Marruecos',
  Netherlands: 'Países Bajos',
  'New Zealand': 'Nueva Zelanda',
  Norway: 'Noruega',
  Panama: 'Panamá',
  Qatar: 'Catar',
  'Saudi Arabia': 'Arabia Saudita',
  Scotland: 'Escocia',
  'South Africa': 'Sudáfrica',
  'South Korea': 'Corea del Sur',
  Spain: 'España',
  Sweden: 'Suecia',
  Switzerland: 'Suiza',
  Tunisia: 'Túnez',
  Türkiye: 'Turquía',
  'United States': 'Estados Unidos',
  Uzbekistan: 'Uzbekistán',
};

const ESPN_TEAMS = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams?limit=100';
const ESPN_ROSTER = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams';
const ESPN_SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary';
const FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'HomeCoded-Analytics/1.0',
};
const ROSTER_CACHE_MS = 6 * 60 * 60 * 1000;
const TEAM_MAP_CACHE_MS = 24 * 60 * 60 * 1000;

const __dirname = dirname(fileURLToPath(import.meta.url));
const overrides = loadOverrides();

const espnTeamIdByDisplay = new Map();
const rosterCache = new Map();
const appearedByTeam = new Map();
const wcPlayerStats = new Map();
const wcTeamStats = new Map();
const teamMatchesPlayed = new Map();
const eliminatedTeams = new Set();
const syncedEventIds = new Set();

const DEFAULT_WC_BASELINE = {
  cornersFav: 5.0,
  cornersAgainst: 5.0,
  shotsOnTargetFav: 2.9,
  shotsOnTargetAgainst: 2.9,
  aggressiveness: 12.5,
  redPerGame: 0.06,
  winRate: 0.33,
  goalsForAvg: 1.2,
  goalsAgainstAvg: 1.2,
};

let wcTournamentAvg = { ...DEFAULT_WC_BASELINE };
let teamMapLoadedAt = 0;
let registrySyncedAt = 0;

function loadOverrides() {
  try {
    const raw = readFileSync(join(__dirname, '../data/wc-squad-overrides.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return { ruledOut: {}, notes: {} };
  }
}

function normalizePlayerName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeTeamKey(name) {
  return DISPLAY_ALIASES[name] || name;
}

function ruledOutSet(teamDisplayName) {
  const key = normalizeTeamKey(teamDisplayName);
  const aliases = new Set([key, teamDisplayName]);
  const blocked = new Set();
  for (const alias of aliases) {
    for (const player of overrides.ruledOut?.[alias] || []) {
      blocked.add(normalizePlayerName(player));
    }
  }
  return blocked;
}

function isPlayerBlocked(teamDisplayName, playerName) {
  return ruledOutSet(teamDisplayName).has(normalizePlayerName(playerName));
}

function isAttackingAthlete(athlete) {
  const abbr = athlete?.position?.abbreviation || '';
  const label = athlete?.position?.displayName || '';
  if (abbr === 'F' || /forward|striker|winger|attacker/i.test(label)) return 'forward';
  if (abbr === 'M' || /midfield/i.test(label)) return 'midfield';
  return null;
}

function cleanDisplayName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim();
}

function getTeamStatsMap(teamDisplayName) {
  const key = normalizeTeamKey(teamDisplayName);
  if (!wcPlayerStats.has(key)) wcPlayerStats.set(key, new Map());
  return wcPlayerStats.get(key);
}

function bumpPlayerMatch(teamDisplayName, playerName) {
  const teamKey = normalizeTeamKey(teamDisplayName);
  const playerKey = normalizePlayerName(playerName);
  const teamMap = getTeamStatsMap(teamKey);
  const existing = teamMap.get(playerKey) || {
    name: cleanDisplayName(playerName),
    shotsOnTarget: 0,
    matches: 0,
  };
  existing.matches += 1;
  teamMap.set(playerKey, existing);
}

function addPlayerShotOnTarget(teamDisplayName, playerName) {
  const teamKey = normalizeTeamKey(teamDisplayName);
  const playerKey = normalizePlayerName(playerName);
  const teamMap = getTeamStatsMap(teamKey);
  const existing = teamMap.get(playerKey) || {
    name: cleanDisplayName(playerName),
    shotsOnTarget: 0,
    matches: 0,
  };
  existing.shotsOnTarget += 1;
  teamMap.set(playerKey, existing);
}

function parseShooterFromText(text) {
  const m = String(text || '').match(/(?:Goal!|Attempt saved\.|Shot on target\.?)\s*([^(]+)\s*\(/i);
  return m ? cleanDisplayName(m[1]) : null;
}

function parseBoxscoreStat(statistics, name) {
  const row = (statistics || []).find((s) => s.name === name);
  if (!row) return 0;
  const value = parseFloat(String(row.displayValue ?? row.value ?? '').replace(',', '.'));
  return Number.isFinite(value) ? value : 0;
}

function getWcTeamBucket(teamDisplayName) {
  const key = normalizeTeamKey(teamDisplayName);
  if (!wcTeamStats.has(key)) {
    wcTeamStats.set(key, {
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      cornersFav: 0,
      cornersAgainst: 0,
      shotsOnTargetFav: 0,
      shotsOnTargetAgainst: 0,
      yellowCards: 0,
      redCards: 0,
      fouls: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    });
  }
  return wcTeamStats.get(key);
}

function ingestMatchTeamStats(summary) {
  const boxTeams = summary.boxscore?.teams || [];
  if (boxTeams.length < 2) return;

  const scoreByKey = new Map();
  for (const comp of summary.header?.competitions?.[0]?.competitors || []) {
    const name = comp.team?.displayName;
    if (!name) continue;
    scoreByKey.set(normalizeTeamKey(name), parseInt(comp.score, 10) || 0);
  }

  const sides = boxTeams.map((entry) => ({
    name: entry.team?.displayName,
    key: normalizeTeamKey(entry.team?.displayName),
    stats: entry.statistics || [],
  })).filter((side) => side.name);

  if (sides.length < 2) return;

  for (let i = 0; i < sides.length; i += 1) {
    const team = sides[i];
    const opp = sides[(i + 1) % sides.length];
    const bucket = getWcTeamBucket(team.name);
    bucket.matches += 1;
    bucket.cornersFav += parseBoxscoreStat(team.stats, 'wonCorners');
    bucket.cornersAgainst += parseBoxscoreStat(opp.stats, 'wonCorners');
    bucket.shotsOnTargetFav += parseBoxscoreStat(team.stats, 'shotsOnTarget');
    bucket.shotsOnTargetAgainst += parseBoxscoreStat(opp.stats, 'shotsOnTarget');
    bucket.yellowCards += parseBoxscoreStat(team.stats, 'yellowCards');
    bucket.redCards += parseBoxscoreStat(team.stats, 'redCards');
    bucket.fouls += parseBoxscoreStat(team.stats, 'foulsCommitted');

    const goalsFor = scoreByKey.get(team.key) ?? 0;
    const goalsAgainst = scoreByKey.get(opp.key) ?? 0;
    bucket.goalsFor += goalsFor;
    bucket.goalsAgainst += goalsAgainst;
    if (goalsFor > goalsAgainst) bucket.wins += 1;
    else if (goalsFor === goalsAgainst) bucket.draws += 1;
    else bucket.losses += 1;
  }
}

function recomputeTournamentAverages() {
  const entries = [...wcTeamStats.values()].filter((t) => t.matches > 0);
  if (!entries.length) {
    wcTournamentAvg = { ...DEFAULT_WC_BASELINE };
    return;
  }

  const totals = {
    cornersFav: 0,
    cornersAgainst: 0,
    shotsOnTargetFav: 0,
    shotsOnTargetAgainst: 0,
    aggressiveness: 0,
    redPerGame: 0,
    winRate: 0,
    goalsForAvg: 0,
    goalsAgainstAvg: 0,
  };

  for (const team of entries) {
    const m = team.matches;
    totals.cornersFav += team.cornersFav / m;
    totals.cornersAgainst += team.cornersAgainst / m;
    totals.shotsOnTargetFav += team.shotsOnTargetFav / m;
    totals.shotsOnTargetAgainst += team.shotsOnTargetAgainst / m;
    totals.aggressiveness += (team.fouls / m) * 0.65 + (team.yellowCards / m) * 3.2 + (team.redCards / m) * 12;
    totals.redPerGame += team.redCards / m;
    totals.winRate += team.wins / m;
    totals.goalsForAvg += team.goalsFor / m;
    totals.goalsAgainstAvg += team.goalsAgainst / m;
  }

  const n = entries.length;
  wcTournamentAvg = {
    cornersFav: +(totals.cornersFav / n).toFixed(2),
    cornersAgainst: +(totals.cornersAgainst / n).toFixed(2),
    shotsOnTargetFav: +(totals.shotsOnTargetFav / n).toFixed(2),
    shotsOnTargetAgainst: +(totals.shotsOnTargetAgainst / n).toFixed(2),
    aggressiveness: +(totals.aggressiveness / n).toFixed(2),
    redPerGame: +(totals.redPerGame / n).toFixed(2),
    winRate: +(totals.winRate / n).toFixed(2),
    goalsForAvg: +(totals.goalsForAvg / n).toFixed(1),
    goalsAgainstAvg: +(totals.goalsAgainstAvg / n).toFixed(1),
  };
}

function buildWcTeamMetrics(teamDisplayName) {
  const key = normalizeTeamKey(teamDisplayName);
  const raw = wcTeamStats.get(key);
  const played = raw?.matches || 0;

  if (!played) {
    return { ...wcTournamentAvg, wcMatches: 0 };
  }

  return {
    cornersFav: +(raw.cornersFav / played).toFixed(2),
    cornersAgainst: +(raw.cornersAgainst / played).toFixed(2),
    shotsOnTargetFav: +(raw.shotsOnTargetFav / played).toFixed(2),
    shotsOnTargetAgainst: +(raw.shotsOnTargetAgainst / played).toFixed(2),
    aggressiveness: +((raw.fouls / played) * 0.65 + (raw.yellowCards / played) * 3.2 + (raw.redCards / played) * 12).toFixed(2),
    redPerGame: +(raw.redCards / played).toFixed(2),
    winRate: +(raw.wins / played).toFixed(2),
    goalsForAvg: +(raw.goalsFor / played).toFixed(1),
    goalsAgainstAvg: +(raw.goalsAgainst / played).toFixed(1),
    wcMatches: played,
  };
}

export function getWcTeamMetricsSync(teamDisplayName) {
  return buildWcTeamMetrics(teamDisplayName);
}

function ingestMatchPlayerStats(summary) {
  const seenPlays = new Set();
  const teamsInMatch = new Set();

  for (const block of summary.rosters || []) {
    const teamName = block.team?.displayName;
    if (!teamName) continue;
    teamsInMatch.add(normalizeTeamKey(teamName));
    for (const row of block.roster || []) {
      const player = row.athlete?.displayName;
      if (player) {
        registerAppearance(teamName, player);
        bumpPlayerMatch(teamName, player);
      }
    }
  }

  for (const teamKey of teamsInMatch) {
    teamMatchesPlayed.set(teamKey, (teamMatchesPlayed.get(teamKey) || 0) + 1);
  }

  for (const item of summary.commentary || []) {
    const play = item.play;
    if (!play?.id || seenPlays.has(play.id)) continue;

    const type = play.type?.type || '';
    const isShotOnTarget = type === 'shot-on-target' || type === 'goal';
    if (!isShotOnTarget) continue;

    seenPlays.add(play.id);
    const teamName = play.team?.displayName;
    const shooter = play.participants?.[0]?.athlete?.displayName
      || parseShooterFromText(item.text || play.text);
    if (!teamName || !shooter) continue;
    addPlayerShotOnTarget(teamName, shooter);
  }
}

function buildShootersFromWcStats(teamDisplayName, athletes) {
  const blocked = ruledOutSet(teamDisplayName);
  const teamKey = normalizeTeamKey(teamDisplayName);
  const teamMap = wcPlayerStats.get(teamKey);
  const played = teamMatchesPlayed.get(teamKey) || 0;

  let candidates = [];
  if (teamMap?.size) {
    candidates = [...teamMap.values()]
      .filter((stat) => stat.matches > 0 && !blocked.has(normalizePlayerName(stat.name)))
      .map((stat) => ({
        name: stat.name,
        avgShots: stat.shotsOnTarget / stat.matches,
        wcMatches: stat.matches,
        wcSot: stat.shotsOnTarget,
      }));
  }

  if (!candidates.length && played === 0) {
    const forwards = [];
    const mids = [];
    for (const athlete of athletes || []) {
      const name = cleanDisplayName(athlete.displayName);
      if (!name || blocked.has(normalizePlayerName(name))) continue;
      const role = isAttackingAthlete(athlete);
      if (!role) continue;
      (role === 'forward' ? forwards : mids).push({ name, avgShots: 0, wcMatches: 0, wcSot: 0 });
    }
    candidates = [...forwards, ...mids].slice(0, 4);
  }

  candidates.sort((a, b) => b.avgShots - a.avgShots || b.wcSot - a.wcSot || b.wcMatches - a.wcMatches);

  return candidates.slice(0, 4).map((c) => ({
    name: c.name,
    avgShots: +Math.max(c.avgShots, 0).toFixed(2),
    wcMatches: c.wcMatches,
    wcSot: c.wcSot,
  }));
}

async function ensureEspnTeamMap() {
  const now = Date.now();
  if (espnTeamIdByDisplay.size && now - teamMapLoadedAt < TEAM_MAP_CACHE_MS) return;

  const res = await fetch(ESPN_TEAMS, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`ESPN teams ${res.status}`);

  const data = await res.json();
  const list = data.sports?.[0]?.leagues?.[0]?.teams || [];

  espnTeamIdByDisplay.clear();
  for (const entry of list) {
    const team = entry.team || entry;
    if (!team?.id) continue;
    const displayName = normalizeTeamKey(team.displayName);
    espnTeamIdByDisplay.set(displayName, String(team.id));
    espnTeamIdByDisplay.set(team.displayName, String(team.id));
  }
  teamMapLoadedAt = now;
}

async function fetchTeamAthletes(teamDisplayName) {
  const now = Date.now();
  const cached = rosterCache.get(teamDisplayName);
  if (cached && now - cached.at < ROSTER_CACHE_MS) return cached.athletes;

  await ensureEspnTeamMap();
  const teamId = espnTeamIdByDisplay.get(teamDisplayName)
    || espnTeamIdByDisplay.get(normalizeTeamKey(teamDisplayName));
  if (!teamId) return null;

  const res = await fetch(`${ESPN_ROSTER}/${teamId}/roster`, { headers: FETCH_HEADERS });
  if (!res.ok) return null;

  const data = await res.json();
  const athletes = data.athletes || [];
  rosterCache.set(teamDisplayName, { at: now, athletes });
  return athletes;
}

function registerAppearance(teamName, playerName) {
  const key = normalizeTeamKey(teamName);
  if (!appearedByTeam.has(key)) appearedByTeam.set(key, new Set());
  appearedByTeam.get(key).add(normalizePlayerName(playerName));
}

async function syncMatchFromSummary(eventId) {
  if (!eventId || syncedEventIds.has(String(eventId))) return;

  try {
    const res = await fetch(`${ESPN_SUMMARY}?event=${eventId}`, { headers: FETCH_HEADERS });
    if (!res.ok) return;

    const summary = await res.json();
    ingestMatchPlayerStats(summary);
    ingestMatchTeamStats(summary);
    syncedEventIds.add(String(eventId));
  } catch (err) {
    console.error('[squadRegistry/match]', eventId, err.message);
  }
}

function markEliminatedTeams(fixtures, espnByPair) {
  for (const f of fixtures) {
    if (f.status !== 'finished' || !f.result || !isKnockoutStage(f.stage)) continue;

    const espn = espnByPair?.get(teamPairKey(f.date, f.homeTeam, f.awayTeam));
    const loser = pickMatchLoser(f.homeTeam, f.awayTeam, f.result, espn);
    if (loser) eliminatedTeams.add(normalizeTeamKey(loser));
  }
}

async function preloadRosters(teamNames) {
  const unique = [...new Set(teamNames.map(normalizeTeamKey))];
  await Promise.all(unique.map(async (name) => {
    if (eliminatedTeams.has(name)) return;
    await fetchTeamAthletes(name);
  }));
}

export function isTeamEliminated(teamName) {
  return eliminatedTeams.has(normalizeTeamKey(teamName));
}

export function getRosterShootersSync(teamDisplayName, teamMeta) {
  const key = normalizeTeamKey(teamDisplayName);
  const cached = rosterCache.get(key) || rosterCache.get(teamDisplayName);
  if (!cached?.athletes?.length) return null;

  const shooters = buildShootersFromWcStats(key, cached.athletes);
  return shooters.length ? shooters : null;
}

export function filterEligibleShooters(teamDisplayName, shooters = []) {
  const key = normalizeTeamKey(teamDisplayName);
  const blocked = ruledOutSet(key);
  return shooters.filter((p) => !blocked.has(normalizePlayerName(p.name)));
}

export async function syncSquadRegistry({ fixtures = [], espnByPair = new Map() } = {}) {
  const now = Date.now();
  wcPlayerStats.clear();
  wcTeamStats.clear();
  teamMatchesPlayed.clear();
  syncedEventIds.clear();

  markEliminatedTeams(fixtures, espnByPair);

  const finished = fixtures.filter((f) => f.status === 'finished');
  const seenEvents = new Set();
  for (const f of finished) {
    const espn = espnByPair.get(teamPairKey(f.date, f.homeTeam, f.awayTeam));
    const eventId = espn?.espnEventId;
    if (!eventId || seenEvents.has(String(eventId))) continue;
    seenEvents.add(String(eventId));
    await syncMatchFromSummary(eventId);
  }

  const activeTeams = fixtures
    .filter((f) => f.status !== 'finished' || !isKnockoutStage(f.stage))
    .flatMap((f) => [f.homeTeam, f.awayTeam])
    .filter(Boolean);

  const teamsStillIn = [...new Set(
    activeTeams.map(normalizeTeamKey).filter((t) => !eliminatedTeams.has(t))
  )];

  const upcomingTeams = fixtures
    .filter((f) => f.status === 'scheduled' || f.status === 'live')
    .flatMap((f) => [f.homeTeam, f.awayTeam]);

  await preloadRosters([...teamsStillIn, ...upcomingTeams.map(normalizeTeamKey)]);

  recomputeTournamentAverages();
  registrySyncedAt = now;
}

export function getSquadRegistryMeta() {
  return {
    syncedAt: registrySyncedAt,
    eliminated: [...eliminatedTeams],
    rosterTeams: [...rosterCache.keys()],
    syncedMatches: syncedEventIds.size,
    wcStatsTeams: [...wcPlayerStats.keys()],
    wcTeamStatsTeams: [...wcTeamStats.keys()],
    wcTournamentAvg,
  };
}
