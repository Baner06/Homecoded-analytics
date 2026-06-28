import {
  parseOpenFootballScore,
  pickMatchWinner,
  pickMatchLoser,
} from './evaluation.js';
import { resolveTeam } from './teams.js';
import { teamPairKey } from './teamKeys.js';

export const UNDEFINED_TEAM = 'Por definir';

const OPEN_FOOTBALL_ALIASES = {
  'Bosnia & Herzegovina': 'Bosnia and Herzegovina',
  USA: 'United States',
  'Korea Republic': 'South Korea',
  'Czech Republic': 'Czechia',
  'Cote d\'Ivoire': 'Ivory Coast',
  'Cape Verde': 'Cape Verde',
};

export function normalizeOpenFootballTeamName(name) {
  if (!name) return UNDEFINED_TEAM;
  return OPEN_FOOTBALL_ALIASES[name] || name;
}

export function openFootballRoundToStage(round = '') {
  const r = String(round).toLowerCase();
  if (r.includes('round of 32')) return 'round-of-32';
  if (r.includes('round of 16')) return 'round-of-16';
  if (r.includes('quarter')) return 'quarter-finals';
  if (r.includes('semi')) return 'semi-finals';
  if (r.includes('third')) return 'third-place';
  if (r === 'final') return 'final';
  return 'group-stage';
}

export function stageLabel(stage, group = '') {
  const map = {
    'group-stage': group
      ? (String(group).startsWith('Grupo') ? group : `Grupo ${group.replace(/^Group\s*/i, '')}`)
      : 'Fase de grupos',
    'round-of-32': 'Dieciseisavos de final',
    'round-of-16': 'Octavos de final',
    'quarter-finals': 'Cuartos de final',
    'semi-finals': 'Semifinal',
    'third-place': 'Tercer puesto',
    final: 'Final',
  };
  return map[stage] || stage;
}

function espnFeedForPair(espnByPair, date, homeTeam, awayTeam) {
  if (!espnByPair?.size) return null;
  if (homeTeam === UNDEFINED_TEAM || awayTeam === UNDEFINED_TEAM) return null;
  return espnByPair.get(teamPairKey(date, homeTeam, awayTeam)) ?? null;
}

function mergeKnockoutResult(openFootballResult, espn) {
  if (openFootballResult) return openFootballResult;
  if (!espn?.isFinished) return null;
  return {
    homeGoals: espn.homeGoals,
    awayGoals: espn.awayGoals,
    htHomeGoals: espn.htHomeGoals ?? 0,
    htAwayGoals: espn.htAwayGoals ?? 0,
  };
}

function resolveBracketName(name, resolved, espnByPair) {
  if (!name) return UNDEFINED_TEAM;
  const winnerRef = String(name).match(/^W(\d+)$/i);
  if (winnerRef) {
    const entry = resolved.get(Number(winnerRef[1]));
    if (!entry) return UNDEFINED_TEAM;
    return entry.winnerTeam || UNDEFINED_TEAM;
  }
  const loserRef = String(name).match(/^L(\d+)$/i);
  if (loserRef) {
    const entry = resolved.get(Number(loserRef[1]));
    if (!entry) return UNDEFINED_TEAM;
    return entry.loserTeam || UNDEFINED_TEAM;
  }
  return normalizeOpenFootballTeamName(name);
}

/** Resuelve W74 / L101 etc. según resultados + ESPN (penales). */
export function resolveKnockoutBracket(knockoutMatches, espnByPair = new Map()) {
  const resolved = new Map();

  const sorted = [...knockoutMatches]
    .filter((m) => m.num)
    .sort((a, b) => a.num - b.num);

  for (const m of sorted) {
    const homeTeam = resolveBracketName(m.team1, resolved, espnByPair);
    const awayTeam = resolveBracketName(m.team2, resolved, espnByPair);
    const espn = espnFeedForPair(espnByPair, m.date, homeTeam, awayTeam);
    const result = mergeKnockoutResult(parseOpenFootballScore(m), espn);
    const winnerTeam = pickMatchWinner(homeTeam, awayTeam, result, espn);
    const loserTeam = pickMatchLoser(homeTeam, awayTeam, result, espn);

    resolved.set(m.num, {
      homeTeam,
      awayTeam,
      result,
      winnerTeam,
      loserTeam,
      raw: m,
    });
  }

  return resolved;
}

export function isPlaceholderTeam(name) {
  if (!name) return true;
  return /^(W|L)\d+$/i.test(name)
    || /^Group\s/i.test(name)
    || /^Winner\s/i.test(name)
    || name === UNDEFINED_TEAM;
}

export function isKnockoutStageLabel(stage) {
  return stage && stage !== 'group-stage';
}
