import { normalizeOpenFootballTeamName } from './bracket.js';
import { resolveTeam } from './teams.js';

/** Clave de emparejamiento independiente del orden local/visitante. */
export function teamPairKey(date, home, away) {
  const h = resolveTeam(normalizeOpenFootballTeamName(home)).displayName.toLowerCase();
  const a = resolveTeam(normalizeOpenFootballTeamName(away)).displayName.toLowerCase();
  return `${date}|${[h, a].sort().join('|')}`;
}
