const ESPN_SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary';
const FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Coded-Sports/1.0',
};
const CACHE_MS = 5_000;

let cache = new Map();

const EVENT_TYPES = new Set([
  'goal',
  'substitution',
  'yellow-card',
  'red-card',
  'corner-awarded',
  'shot-on-target',
  'shot-off-target',
  'shot-blocked',
  'kickoff',
  'start-2nd-half',
  'end-regular-time',
  'var-referee-decision-cancelled',
]);

const TYPE_LABELS_ES = {
  goal: 'Gol',
  substitution: 'Sustitución',
  'yellow-card': 'Tarjeta amarilla',
  'red-card': 'Tarjeta roja',
  'corner-awarded': 'Córner',
  'shot-on-target': 'Disparo a puerta',
  'shot-off-target': 'Disparo desviado',
  'shot-blocked': 'Disparo bloqueado',
  foul: 'Falta',
  offside: 'Fuera de juego',
  kickoff: 'Inicio',
  'start-delay': 'Juego detenido',
  'end-delay': 'Reanudación',
  'end-regular-time': 'Fin del tiempo',
  'var-referee-decision-cancelled': 'VAR',
  other: 'Jugada',
};

const SITUATION_LABELS = {
  safe: 'Balón controlado',
  danger: 'Ataque peligroso',
  neutral: 'Juego en curso',
  corner: 'Córner',
  goal: 'Gol',
  substitution: 'Sustitución',
  card: 'Tarjeta',
};

const SKIP_TIMELINE = [
  /^Lineups are announced/i,
  /players are warming up/i,
];

function normalizeTeam(name) {
  return (name || '').toLowerCase().trim();
}

function isHomeTeam(playTeam, homeName) {
  const pt = normalizeTeam(playTeam);
  const home = normalizeTeam(homeName);
  return pt === home || pt.includes(home) || home.includes(pt);
}

function mapPlayType(typeText, typeSlug) {
  const slug = (typeSlug || '').toLowerCase();
  const text = (typeText || '').toLowerCase();
  if (slug === 'goal' || text === 'goal') return 'goal';
  if (slug === 'substitution' || text === 'substitution') return 'substitution';
  if (slug === 'yellow-card' || text.includes('yellow')) return 'yellow-card';
  if (slug === 'red-card' || text.includes('red card')) return 'red-card';
  if (slug === 'corner-awarded' || text.includes('corner')) return 'corner-awarded';
  if (slug === 'shot-on-target') return 'shot-on-target';
  if (slug === 'shot-off-target') return 'shot-off-target';
  if (slug === 'shot-blocked') return 'shot-blocked';
  if (slug === 'foul' || text === 'foul') return 'foul';
  if (slug === 'offside') return 'offside';
  if (slug === 'kickoff' || slug === 'start-2nd-half') return 'kickoff';
  if (slug === 'start-delay') return 'start-delay';
  if (slug === 'end-delay') return 'end-delay';
  if (slug === 'end-regular-time') return 'end-regular-time';
  if (slug.includes('var')) return 'var-referee-decision-cancelled';
  return slug || 'other';
}

function translatePlayText(text) {
  if (!text) return '';

  const rules = [
    [/First Half begins\.?/gi, 'Comienza el primer tiempo.'],
    [/Second Half begins\.?/gi, 'Comienza el segundo tiempo.'],
    [/Second Half ends,?\s*(.+)\.?$/gi, 'Final del segundo tiempo: $1.'],
    [/End Regular Time\.?/gi, 'Fin del tiempo reglamentario.'],
    [/Substitution,\s*(.+?)\.\s*(.+?)\s+replaces\s+(.+?)\.?$/gi, 'Sustitución en $1: $2 entra por $3.'],
    [/Goal!\s*/gi, '¡Gol! '],
    [/Foul by\s+/gi, 'Falta de '],
    [/ wins a free kick in the ([^.]+)\.?/gi, ' gana tiro libre en $1.'],
    [/ wins a free kick\.?/gi, ' gana tiro libre.'],
    [/Dangerous Attack\.?/gi, 'Ataque peligroso.'],
    [/Ball Safe\.?/gi, 'Balón controlado.'],
    [/Attack\.?/gi, 'Ataque.'],
    [/Corner,\s*(.+?)\.\s*Conceded by\s+(.+?)\.?/gi, 'Córner para $1. Concedido por $2.'],
    [/Offside,\s*(.+?)\.\s*(.+?)\s+is caught offside\.?/gi, 'Fuera de juego de $2 ($1).'],
    [/Shot blocked\.?\s*(.*)$/gi, 'Disparo bloqueado. $1'],
    [/Attempt blocked\.?\s*(.*)$/gi, 'Disparo bloqueado. $1'],
    [/Attempt saved\.?\s*(.*)$/gi, 'Disparo atajado. $1'],
    [/Attempt missed\.?\s*(.*)$/gi, 'Disparo desviado. $1'],
    [/ is saved in the ([^.]+)\.?/gi, ' es atajado en $1.'],
    [/ from a difficult angle on the left/gi, ' desde un ángulo difícil por la izquierda'],
    [/ from the left/gi, ' por la izquierda'],
    [/Assisted by /gi, 'Asistencia de '],
    [/Shot On Target\.?/gi, 'Disparo a puerta.'],
    [/Shot Off Target\.?/gi, 'Disparo desviado.'],
    [/ is shown the yellow card\.?/gi, ' recibe tarjeta amarilla.'],
    [/ is shown the red card\.?/gi, ' recibe tarjeta roja.'],
    [/Yellow Card\s*/gi, 'Tarjeta amarilla: '],
    [/Red Card\s*/gi, 'Tarjeta roja: '],
    [/ right footed shot/gi, ' disparo con la derecha'],
    [/ left footed shot/gi, ' disparo con la izquierda'],
    [/ header from/gi, ' cabeceo desde'],
    [/ from outside the box/gi, ' desde fuera del área'],
    [/ from the centre of the box/gi, ' desde el centro del área'],
    [/ from very close range/gi, ' desde muy cerca'],
    [/ to the bottom left corner/gi, ' a la esquina inferior izquierda'],
    [/ to the bottom right corner/gi, ' a la esquina inferior derecha'],
    [/ to the top left corner/gi, ' a la esquina superior izquierda'],
    [/ to the top right corner/gi, ' a la esquina superior derecha'],
    [/Defensive half/gi, 'mediocampo defensivo'],
    [/Attacking half/gi, 'mediocampo ofensivo'],
    [/Defending half/gi, 'mediocampo defensivo'],
    [/Start Delay\.?/gi, 'Juego detenido.'],
    [/End Delay\.?/gi, 'Reanudación del juego.'],
    [/VAR - Referee decision cancelled\.?/gi, 'VAR: decisión del árbitro anulada.'],
    [/Kickoff\.?/gi, 'Saque inicial.'],
  ];

  let out = text.trim();
  for (const [regex, repl] of rules) {
    out = out.replace(regex, repl);
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

function parseSubstitution(play) {
  const parts = play.participants || [];
  const text = play.text || '';
  const replaceMatch = text.match(/(.+?)\s+replaces\s+(.+?)\.?$/i);
  const playerIn = parts[0]?.athlete?.displayName || replaceMatch?.[1]?.trim() || null;
  const playerOut = parts[1]?.athlete?.displayName || replaceMatch?.[2]?.trim() || null;
  return { playerIn, playerOut };
}

function parsePlayItem(item, homeName, awayName) {
  const play = item.play;
  if (!play) return null;

  const type = mapPlayType(play.type?.text, play.type?.type);
  const teamName = play.team?.displayName || null;
  const minute = item.time?.displayValue || play.clock?.displayValue || '';
  const sequence = item.sequence ?? play.id ?? 0;
  const rawText = item.text || play.text || play.shortText || '';

  let players = null;
  if (type === 'substitution') {
    players = parseSubstitution(play);
  } else if (play.participants?.length) {
    players = {
      primary: play.participants[0]?.athlete?.displayName || null,
    };
  }

  const ball = play.fieldPositionX != null && play.fieldPositionY != null
    ? { x: play.fieldPositionX, y: play.fieldPositionY }
    : null;

  const textEs = translatePlayText(rawText);

  return {
    id: String(play.id || sequence),
    sequence: Number(sequence),
    type,
    typeLabel: TYPE_LABELS_ES[type] || TYPE_LABELS_ES.other,
    minute,
    team: teamName,
    side: teamName ? (isHomeTeam(teamName, homeName) ? 'home' : 'away') : null,
    text: textEs,
    textRaw: rawText,
    shortText: play.shortText || null,
    players,
    ball,
    scoringPlay: type === 'goal',
    highlight: EVENT_TYPES.has(type),
  };
}

function shouldIncludeInTimeline(play) {
  if (SKIP_TIMELINE.some((re) => re.test(play.textRaw || play.text))) return false;
  if (!play.minute && play.type !== 'kickoff') {
    return /comienza|begins|inicio|saque/i.test(play.text);
  }
  return true;
}

function levelFromPlay(play) {
  if (!play) return 'neutral';
  if (play.type === 'goal') return 'goal';
  if (play.type === 'substitution') return 'substitution';
  if (play.type === 'yellow-card' || play.type === 'red-card') return 'card';
  if (play.type === 'corner-awarded') return 'corner';
  if (['shot-on-target', 'shot-off-target', 'shot-blocked'].includes(play.type)) return 'danger';
  if (play.type === 'var-referee-decision-cancelled') return 'danger';
  if (play.type === 'foul' || play.type === 'offside') return 'neutral';
  if (play.ball) {
    const side = play.side;
    let attackingX = play.ball.x;
    if (side === 'away') attackingX = 100 - play.ball.x;
    if (attackingX >= 68) return 'danger';
    if (attackingX <= 32) return 'safe';
  }
  return 'neutral';
}

function deriveSituation(lastPlay) {
  if (!lastPlay) {
    return {
      team: null,
      label: 'Esperando jugada…',
      typeLabel: null,
      level: 'neutral',
    };
  }
  return {
    team: lastPlay.team,
    label: lastPlay.text || lastPlay.typeLabel || 'Juego en curso',
    typeLabel: lastPlay.typeLabel,
    level: levelFromPlay(lastPlay),
  };
}

function findBallNearPlay(parsed, currentPlay) {
  if (currentPlay?.ball) return currentPlay.ball;
  const idx = parsed.findIndex((p) => p.id === currentPlay?.id);
  const start = idx >= 0 ? idx : parsed.length - 1;
  for (let i = start; i >= 0; i -= 1) {
    if (parsed[i].ball) return parsed[i].ball;
  }
  return { x: 50, y: 32 };
}

function buildTrail(playsWithBall, limit = 4) {
  return playsWithBall
    .slice(-limit)
    .map((p) => p.ball)
    .filter(Boolean);
}

function buildTrailFromPlay(parsed, currentPlay, limit = 4) {
  const idx = parsed.findIndex((p) => p.id === currentPlay?.id);
  if (idx < 0) return buildTrail(parsed.filter((p) => p.ball), limit);
  const slice = parsed.slice(Math.max(0, idx - limit + 1), idx + 1).filter((p) => p.ball);
  return slice.map((p) => p.ball);
}

function mapMomentForClient(p) {
  if (!p) return null;
  return {
    id: p.id,
    sequence: p.sequence,
    type: p.type,
    typeLabel: p.typeLabel,
    minute: p.minute,
    team: p.team,
    side: p.side,
    text: p.text,
    players: p.players,
    ball: p.ball,
  };
}

function overlayFromPlay(play) {
  return mapMomentForClient(play);
}

function mapEventForClient(p) {
  return {
    id: p.id,
    sequence: p.sequence,
    type: p.type,
    typeLabel: p.typeLabel,
    minute: p.minute,
    team: p.team,
    text: p.text,
  };
}

export async function fetchLiveTracker(espnEventId, homeName, awayName, force = false) {
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
  const commentary = summary.commentary || [];
  const parsed = commentary
    .map((item) => parsePlayItem(item, homeName, awayName))
    .filter(Boolean);

  const timelineParsed = parsed.filter(shouldIncludeInTimeline);
  const currentPlay = timelineParsed[timelineParsed.length - 1] || null;

  const matchEvents = timelineParsed
    .map(mapEventForClient)
    .reverse();

  const headerStatus = summary.header?.competitions?.[0]?.status;
  const ball = findBallNearPlay(parsed, currentPlay);
  const trail = buildTrailFromPlay(parsed, currentPlay);
  const situation = deriveSituation(currentPlay);
  const lastEvent = mapMomentForClient(currentPlay);
  const maxSequence = parsed.reduce((max, p) => Math.max(max, p.sequence || 0), 0);

  const data = {
    espnEventId: String(espnEventId),
    sequence: maxSequence,
    clock: headerStatus?.displayClock || null,
    period: headerStatus?.period ?? null,
    ball,
    trail,
    situation,
    currentMoment: mapMomentForClient(currentPlay),
    lastEvent: lastEvent ? {
      id: lastEvent.id,
      sequence: lastEvent.sequence,
      type: lastEvent.type,
      typeLabel: lastEvent.typeLabel,
      minute: lastEvent.minute,
      team: lastEvent.team,
      side: lastEvent.side,
      text: lastEvent.text,
      players: lastEvent.players,
    } : null,
    matchEvents,
    eventCount: matchEvents.length,
    homeTeam: homeName,
    awayTeam: awayName,
    provider: 'espn',
    updatedAt: new Date().toISOString(),
  };

  cache.set(cacheKey, { at: now, data });
  return data;
}

export function invalidateLiveTrackerCache() {
  cache = new Map();
}
