import { resolveTeam } from './teams.js';
import { pickMatchWinner } from './evaluation.js';
import { resolveKnockoutBracket, UNDEFINED_TEAM } from './bracket.js';
import { teamPairKey } from './teamKeys.js';
import { formatKickoffColombia, getDateISOInColombia } from './timezone.js';

/** Mitad izquierda del cuadro (ruta hacia semifinal 101). */
export const BRACKET_LEFT = {
  'round-of-32': [73, 74, 75, 77, 81, 82, 83, 84],
  'round-of-16': [90, 89, 93, 94],
  'quarter-finals': [97, 98],
  'semi-finals': [101],
};

/** Mitad derecha del cuadro (ruta hacia semifinal 102). */
export const BRACKET_RIGHT = {
  'round-of-32': [76, 78, 79, 80, 85, 87, 86, 88],
  'round-of-16': [91, 92, 95, 96],
  'quarter-finals': [99, 100],
  'semi-finals': [102],
};

export const BRACKET_CENTER = {
  'third-place': 103,
  final: 104,
};

const PHASE_ORDER = ['round-of-32', 'round-of-16', 'quarter-finals', 'semi-finals'];

const PHASE_SHORT = {
  'round-of-32': '32vos',
  'round-of-16': '16vos',
  'quarter-finals': 'CF',
  'semi-finals': 'SF',
  'third-place': '3°',
  final: 'Final',
};

function formatTeam(englishName) {
  if (!englishName || englishName === UNDEFINED_TEAM) {
    return { name: 'Por definir', flagUrl: null, iso: null, pending: true };
  }
  const t = resolveTeam(englishName);
  return {
    name: t.displayName,
    originalName: englishName,
    flagUrl: t.flagUrl,
    iso: t.iso,
    pending: false,
  };
}

function formatBracketDateLabel(dateIso) {
  if (!dateIso) return null;
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const parts = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).formatToParts(dt);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  return `${cap(get('weekday'))} ${get('day')} ${get('month')}`;
}

function buildScheduleLabel(dateIso, kickoffUtc) {
  const datePart = formatBracketDateLabel(dateIso);
  if (!datePart) return null;
  if (kickoffUtc) return `${datePart} · ${formatKickoffColombia(kickoffUtc)} COT`;
  return datePart;
}

function formatScore(result) {
  if (!result) return null;
  return `${result.homeGoals}-${result.awayGoals}`;
}

function resolveWinner(fixture, resolvedEntry, espnFeed) {
  if (resolvedEntry?.winnerTeam && resolvedEntry.winnerTeam !== UNDEFINED_TEAM) {
    return resolveTeam(resolvedEntry.winnerTeam).displayName;
  }
  if (!fixture?.result && espnFeed?.isFinished) {
    const w = pickMatchWinner(fixture.homeTeam, fixture.awayTeam, {
      homeGoals: espnFeed.homeGoals,
      awayGoals: espnFeed.awayGoals,
      htHomeGoals: espnFeed.htHomeGoals ?? 0,
      htAwayGoals: espnFeed.htAwayGoals ?? 0,
    }, espnFeed);
    if (w && w !== UNDEFINED_TEAM) return resolveTeam(w).displayName;
  }
  if (!fixture?.result) return null;
  const w = pickMatchWinner(fixture.homeTeam, fixture.awayTeam, fixture.result, espnFeed);
  if (!w || w === UNDEFINED_TEAM) return null;
  return resolveTeam(w).displayName;
}

function resolveStatus(fixture, resolvedEntry, espnFeed) {
  if (fixture?.status === 'live' || espnFeed?.isLive) return 'live';
  if (fixture?.result || resolvedEntry?.result || espnFeed?.isFinished) return 'finished';
  return fixture?.status || 'scheduled';
}

function resolveScore(fixture, resolvedEntry, espnFeed) {
  const result = fixture?.result || resolvedEntry?.result;
  if (result) return formatScore(result);
  if (espnFeed?.isFinished || espnFeed?.isLive) {
    return `${espnFeed.homeGoals}-${espnFeed.awayGoals}`;
  }
  return null;
}

function formatMatch(fixture, today, resolvedEntry = null, espnByPair = null) {
  if (!fixture) {
    return {
      matchNumber: null,
      pending: true,
      home: formatTeam(UNDEFINED_TEAM),
      away: formatTeam(UNDEFINED_TEAM),
      score: null,
      winner: null,
      status: 'scheduled',
      isToday: false,
    };
  }

  const homeName = resolvedEntry?.homeTeam ?? fixture.homeTeam;
  const awayName = resolvedEntry?.awayTeam ?? fixture.awayTeam;
  const espnFeed = espnByPair && fixture
    ? espnByPair.get(teamPairKey(fixture.date, homeName, awayName))
    : null;

  const home = formatTeam(homeName);
  const away = formatTeam(awayName);
  const winner = resolveWinner(
    { ...fixture, homeTeam: homeName, awayTeam: awayName },
    resolvedEntry,
    espnFeed
  );

  return {
    matchNumber: fixture.matchNumber,
    stage: fixture.stage,
    stageLabel: fixture.stageLabel,
    date: fixture.date,
    dateLabel: formatBracketDateLabel(fixture.date),
    kickoffUtc: fixture.kickoffUtc || null,
    kickoff: fixture.kickoffUtc ? formatKickoffColombia(fixture.kickoffUtc) : null,
    scheduleLabel: buildScheduleLabel(fixture.date, fixture.kickoffUtc),
    home,
    away,
    score: resolveScore(fixture, resolvedEntry, espnFeed),
    winner,
    status: resolveStatus(fixture, resolvedEntry, espnFeed),
    pending: home.pending || away.pending,
    isToday: fixture.date === today,
  };
}

function buildSide(layout, byNum, resolved, today, espnByPair) {
  const side = {};
  for (const phase of PHASE_ORDER) {
    const ids = layout[phase] || [];
    side[phase] = ids.map((id) => formatMatch(
      byNum.get(id),
      today,
      resolved.get(id),
      espnByPair
    ));
  }
  return side;
}

function detectCurrentPhase(byNum, today) {
  const nums = [...byNum.keys()].filter((n) => n >= 73).sort((a, b) => a - b);
  for (const num of nums) {
    const f = byNum.get(num);
    if (!f?.result && f?.date >= today) {
      return f.stage || 'round-of-32';
    }
  }
  const final = byNum.get(104);
  if (final?.result) return 'finished';
  return 'round-of-32';
}

export function buildKnockoutBracketPayload(allFixtures = [], espnByPair = null, rawKnockoutMatches = null) {
  const ko = allFixtures.filter((f) => f.matchNumber >= 73);
  const byNum = new Map(ko.map((f) => [f.matchNumber, f]));
  const today = getDateISOInColombia();

  const resolved = rawKnockoutMatches?.length
    ? resolveKnockoutBracket(rawKnockoutMatches.filter((m) => m.num), espnByPair || new Map())
    : new Map();

  return {
    ok: true,
    date: today,
    currentPhase: detectCurrentPhase(byNum, today),
    phaseLabels: PHASE_SHORT,
    left: buildSide(BRACKET_LEFT, byNum, resolved, today, espnByPair),
    right: buildSide(BRACKET_RIGHT, byNum, resolved, today, espnByPair),
    center: {
      third: formatMatch(
        byNum.get(BRACKET_CENTER['third-place']),
        today,
        resolved.get(BRACKET_CENTER['third-place']),
        espnByPair
      ),
      final: formatMatch(
        byNum.get(BRACKET_CENTER.final),
        today,
        resolved.get(BRACKET_CENTER.final),
        espnByPair
      ),
    },
    matchCount: ko.length,
  };
}
