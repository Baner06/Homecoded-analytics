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

/** Alinea goles y stats de ESPN al local/visitante del fixture. */
export function orientLiveFeedToFixture(liveFeed, fixtureHome, fixtureAway) {
  if (!liveFeed) return null;
  const feedHome = liveFeed.homeName;
  if (!feedHome) return liveFeed;
  if (sameTeam(feedHome, fixtureHome)) return liveFeed;
  if (!sameTeam(feedHome, fixtureAway)) return liveFeed;

  return {
    ...liveFeed,
    homeName: fixtureHome,
    awayName: fixtureAway,
    homeGoals: liveFeed.awayGoals,
    awayGoals: liveFeed.homeGoals,
    htHomeGoals: liveFeed.htAwayGoals ?? 0,
    htAwayGoals: liveFeed.htHomeGoals ?? 0,
    homeCorners: liveFeed.awayCorners,
    awayCorners: liveFeed.homeCorners,
    homeShotsOnTarget: liveFeed.awayShotsOnTarget,
    awayShotsOnTarget: liveFeed.homeShotsOnTarget,
    homeWinner: liveFeed.awayWinner,
    awayWinner: liveFeed.homeWinner,
    homeShootoutScore: liveFeed.awayShootoutScore ?? null,
    awayShootoutScore: liveFeed.homeShootoutScore ?? null,
  };
}
