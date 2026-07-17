const ESPN_SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary';
const FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Coded-Sports/1.0',
};
const CACHE_MS = 8_000;

let cache = new Map();

function readStat(team, name) {
  const row = (team?.statistics || []).find((s) => s.name === name);
  if (!row) return null;
  const raw = String(row.displayValue ?? row.value ?? '').replace(',', '.');
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

function readPct(team, name) {
  const value = readStat(team, name);
  if (value == null) return null;
  if (value <= 1) return Math.round(value * 100);
  return Math.round(value);
}

function pair(homeTeam, awayTeam, homeKey, awayKey = homeKey) {
  return {
    home: readStat(homeTeam, homeKey),
    away: readStat(awayTeam, awayKey),
  };
}

function pairPct(homeTeam, awayTeam, key) {
  return {
    home: readPct(homeTeam, key),
    away: readPct(awayTeam, key),
  };
}

function shotsOffTarget(totalShots, onTarget, blocked) {
  if (totalShots == null || onTarget == null) return null;
  return Math.max(0, Math.round(totalShots - onTarget - (blocked || 0)));
}

function hasAnyValue(row) {
  return row && (row.home != null || row.away != null);
}

function buildRow(label, home, away, opts = {}) {
  if (home == null && away == null) return null;
  const barHome = opts.barHome ?? home;
  const barAway = opts.barAway ?? away;
  const bars = computeDisciplineBars(barHome, barAway);
  return {
    label,
    home: home ?? 0,
    away: away ?? 0,
    homeDisplay: opts.homeDisplay ?? (home != null ? String(home) : '—'),
    awayDisplay: opts.awayDisplay ?? (away != null ? String(away) : '—'),
    isPct: !!opts.isPct,
    barHome: bars.home,
    barAway: bars.away,
  };
}

/** Misma lógica de barras que Disciplina: proporción por equipo, tope 38% de cada mitad. */
function computeDisciplineBars(home, away) {
  const h = Math.max(Number(home) || 0, 0);
  const a = Math.max(Number(away) || 0, 0);
  const total = h + a;
  if (total <= 0) return { home: 0, away: 0 };
  const cap = 38;
  return {
    home: Math.min(cap, (h / total) * 100),
    away: Math.min(cap, (a / total) * 100),
  };
}

export function parseMatchStatsFromSummary(summary) {
  const teams = summary?.boxscore?.teams || [];
  const homeTeam = teams.find((t) => t.homeAway === 'home');
  const awayTeam = teams.find((t) => t.homeAway === 'away');
  if (!homeTeam || !awayTeam) return null;

  const possession = pairPct(homeTeam, awayTeam, 'possessionPct');
  const totalShots = pair(homeTeam, awayTeam, 'totalShots');
  const onTarget = pair(homeTeam, awayTeam, 'shotsOnTarget');
  const blocked = pair(homeTeam, awayTeam, 'blockedShots');
  const corners = pair(homeTeam, awayTeam, 'wonCorners');
  const offsides = pair(homeTeam, awayTeam, 'offsides');

  const shotsOff = {
    home: shotsOffTarget(totalShots.home, onTarget.home, blocked.home),
    away: shotsOffTarget(totalShots.away, onTarget.away, blocked.away),
  };

  const passes = pair(homeTeam, awayTeam, 'accuratePasses');
  const passTotal = pair(homeTeam, awayTeam, 'totalPasses');
  const passPct = pairPct(homeTeam, awayTeam, 'passPct');

  const crosses = pair(homeTeam, awayTeam, 'accurateCrosses');
  const crossTotal = pair(homeTeam, awayTeam, 'totalCrosses');
  const crossPct = pairPct(homeTeam, awayTeam, 'crossPct');

  const longBalls = pair(homeTeam, awayTeam, 'accurateLongBalls');
  const longBallTotal = pair(homeTeam, awayTeam, 'totalLongBalls');
  const longBallPct = pairPct(homeTeam, awayTeam, 'longballPct');

  const interceptions = pair(homeTeam, awayTeam, 'interceptions');
  const clearances = pair(homeTeam, awayTeam, 'totalClearance');
  const tackles = pair(homeTeam, awayTeam, 'effectiveTackles');
  const saves = pair(homeTeam, awayTeam, 'saves');

  const fouls = pair(homeTeam, awayTeam, 'foulsCommitted');
  const yellow = pair(homeTeam, awayTeam, 'yellowCards');
  const red = pair(homeTeam, awayTeam, 'redCards');

  const fmtPass = (acc, tot, pct) => {
    if (acc == null && tot == null) return '—';
    const count = acc != null ? Math.round(acc) : '—';
    const p = pct != null ? `${pct}%` : null;
    return p ? `${count} (${p})` : String(count);
  };

  const general = [
    buildRow('Posesión del balón', possession.home, possession.away, {
      homeDisplay: possession.home != null ? `${possession.home}%` : '—',
      awayDisplay: possession.away != null ? `${possession.away}%` : '—',
      isPct: true,
    }),
    buildRow('Tiros totales', totalShots.home, totalShots.away),
    buildRow('Fueras de juego', offsides.home, offsides.away),
    buildRow('Córners', corners.home, corners.away),
  ].filter(Boolean);

  const attack = {
    shotsOff: buildRow('Tiros fuera', shotsOff.home, shotsOff.away),
    onTarget: buildRow('Disparos a puerta', onTarget.home, onTarget.away),
  };

  const defense = [
    buildRow('Intercepciones', interceptions.home, interceptions.away),
    buildRow('Despejes', clearances.home, clearances.away),
    buildRow('Entradas', tackles.home, tackles.away),
    buildRow('Paradas', saves.home, saves.away),
  ].filter(Boolean);

  const distribution = [
    buildRow('Pases completados', passes.home, passes.away, {
      homeDisplay: fmtPass(passes.home, passTotal.home, passPct.home),
      awayDisplay: fmtPass(passes.away, passTotal.away, passPct.away),
      barHome: passPct.home ?? passes.home,
      barAway: passPct.away ?? passes.away,
    }),
    buildRow('Centros', crosses.home, crosses.away, {
      homeDisplay: fmtPass(crosses.home, crossTotal.home, crossPct.home),
      awayDisplay: fmtPass(crosses.away, crossTotal.away, crossPct.away),
      barHome: crossPct.home ?? crosses.home,
      barAway: crossPct.away ?? crosses.away,
    }),
    buildRow('Balones largos', longBalls.home, longBalls.away, {
      homeDisplay: fmtPass(longBalls.home, longBallTotal.home, longBallPct.home),
      awayDisplay: fmtPass(longBalls.away, longBallTotal.away, longBallPct.away),
      barHome: longBallPct.home ?? longBalls.home,
      barAway: longBallPct.away ?? longBalls.away,
    }),
  ].filter(Boolean);

  const discipline = [
    buildRow('Faltas', fouls.home, fouls.away),
    buildRow('Tarjetas amarillas', yellow.home, yellow.away),
    buildRow('Tarjetas rojas', red.home, red.away),
  ].filter(Boolean);

  const hasData = [
    ...general,
    attack.shotsOff,
    attack.onTarget,
    ...defense,
    ...distribution,
    ...discipline,
  ].some(hasAnyValue);

  if (!hasData) return null;

  return {
    general,
    attack,
    defense,
    distribution,
    discipline,
    updatedAt: new Date().toISOString(),
    provider: 'espn',
  };
}

export async function fetchMatchStatsPanel(espnEventId, { force = false } = {}) {
  const cacheKey = String(espnEventId);
  const now = Date.now();
  const cached = cache.get(cacheKey);

  if (!force && cached && now - cached.at < CACHE_MS) {
    return cached.data;
  }

  const res = await fetch(`${ESPN_SUMMARY}?event=${espnEventId}`, {
    headers: FETCH_HEADERS,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`ESPN summary ${res.status}`);

  const summary = await res.json();
  const stats = parseMatchStatsFromSummary(summary);
  const data = stats
    ? { available: true, stats }
    : { available: false, stats: null };

  cache.set(cacheKey, { at: now, data });
  return data;
}

export function invalidateMatchStatsPanelCache() {
  cache = new Map();
}
