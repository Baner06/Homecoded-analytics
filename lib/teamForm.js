import { parseOpenFootballScore } from './evaluation.js';
import { normalizeOpenFootballTeamName, UNDEFINED_TEAM } from './bracket.js';
import { resolveTeam } from './teams.js';
import { canonicalTeamKey, sameTeam } from './teamKeys.js';

function norm(name) {
  return normalizeOpenFootballTeamName(name);
}

function resolveFixtureResult(f) {
  if (f.result) return f.result;
  return parseOpenFootballScore(f.raw || f);
}

function teamPlayedInFixture(f, teamEn) {
  const team = canonicalTeamKey(teamEn);
  if (team === canonicalTeamKey(UNDEFINED_TEAM)) return false;
  return sameTeam(f.homeTeam, teamEn) || sameTeam(f.awayTeam, teamEn);
}

/** Últimos N partidos finalizados de un equipo antes del partido actual. */
export function getTeamRecentResults(allFixtures, teamEn, { limit = 4, excludeMatchId = null, beforeDate = null, beforeMatchId = null } = {}) {
  const team = norm(teamEn);
  if (team === UNDEFINED_TEAM || canonicalTeamKey(teamEn) === canonicalTeamKey(UNDEFINED_TEAM)) return [];

  const played = allFixtures
    .filter((f) => resolveFixtureResult(f))
    .filter((f) => {
      if (excludeMatchId && f.matchNumber === excludeMatchId) return false;
      if (beforeDate) {
        if (f.date > beforeDate) return false;
        if (f.date === beforeDate && beforeMatchId && f.matchNumber >= beforeMatchId) return false;
      }
      return teamPlayedInFixture(f, teamEn);
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.matchNumber - a.matchNumber)
    .slice(0, limit);

  return played.map((f) => {
    const isHome = sameTeam(f.homeTeam, teamEn);
    const result = resolveFixtureResult(f);
    const hg = result.homeGoals;
    const ag = result.awayGoals;
    const teamGoals = isHome ? hg : ag;
    const oppGoals = isHome ? ag : hg;
    let outcome = 'draw';
    if (teamGoals > oppGoals) outcome = 'win';
    else if (teamGoals < oppGoals) outcome = 'loss';

    const homeTeam = resolveTeam(f.homeTeam);
    const awayTeam = resolveTeam(f.awayTeam);
    const oppTeam = resolveTeam(isHome ? f.awayTeam : f.homeTeam);
    const stage = f.stageLabel || f.stage || '';

    return {
      matchId: f.matchNumber,
      date: f.date,
      opponent: oppTeam.displayName,
      opponentFlag: oppTeam.flag,
      opponentFlagUrl: oppTeam.flagUrl,
      opponentIso: oppTeam.iso,
      score: `${hg}-${ag}`,
      result: outcome,
      stage,
      label: `${homeTeam.displayName} vs ${awayTeam.displayName} · ${hg}-${ag}${stage ? ` · ${stage}` : ''}`,
    };
  });
}

export function attachRecentForm(matches, allFixtures) {
  return matches.map((m) => ({
    ...m,
    recentForm: {
      home: m.home?.pending ? [] : getTeamRecentResults(allFixtures, m.home.originalName, {
        excludeMatchId: m.id,
        beforeDate: m.date,
        beforeMatchId: m.id,
      }),
      away: m.away?.pending ? [] : getTeamRecentResults(allFixtures, m.away.originalName, {
        excludeMatchId: m.id,
        beforeDate: m.date,
        beforeMatchId: m.id,
      }),
    },
  }));
}
