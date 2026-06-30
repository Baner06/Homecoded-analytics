import { normalizeOpenFootballTeamName } from './bracket.js';
import { resolveTeam } from './teams.js';

/** Clave canónica estable para cruzar TheStatsAPI, OpenFootball y ESPN. */
export function canonicalTeamKey(name) {
  const normalized = normalizeOpenFootballTeamName(name);
  const t = resolveTeam(normalized);
  const key = t.keys?.[0] || normalized || name;
  return String(key).toLowerCase().trim();
}

/** Clave de emparejamiento independiente del orden local/visitante. */
export function teamPairKey(date, home, away) {
  const parts = [canonicalTeamKey(home), canonicalTeamKey(away)].sort();
  return `${date}|${parts.join('|')}`;
}

export function sameTeam(a, b) {
  return canonicalTeamKey(a) === canonicalTeamKey(b);
}
