import { parseOpenFootballScore } from './evaluation.js';
import { normalizeOpenFootballTeamName, UNDEFINED_TEAM } from './bracket.js';
import { getWcTeamMetricsSync } from './squadRegistry.js';
import { resolveTeam, teamStats } from './teams.js';

function norm(name) {
  return normalizeOpenFootballTeamName(name);
}

function meetingResult(f, homeEn, awayEn) {
  const result = f.result || parseOpenFootballScore(f.raw || f);
  if (!result) return null;
  const isHome = f.homeTeam === homeEn;
  const hg = isHome ? result.homeGoals : result.awayGoals;
  const ag = isHome ? result.awayGoals : result.homeGoals;
  let winner = 'draw';
  if (hg > ag) winner = isHome ? 'home' : 'away';
  if (ag > hg) winner = isHome ? 'away' : 'home';
  return {
    date: f.date,
    score: `${hg}-${ag}`,
    homeGoals: hg,
    awayGoals: ag,
    venue: f.venue || null,
    stage: f.stageLabel || f.stage || '',
    winner,
  };
}

function teamSnapshot(englishName) {
  const t = resolveTeam(englishName);
  const stats = teamStats(t);
  const wc = getWcTeamMetricsSync(t.displayName) || {};
  return {
    name: t.displayName,
    originalName: englishName,
    flagUrl: t.flagUrl,
    iso: t.iso,
    goalsForAvg: wc.goalsForAvg ?? stats.goalsForAvg,
    goalsAgainstAvg: wc.goalsAgainstAvg ?? stats.goalsAgainstAvg,
    winRate: wc.winRate ?? stats.winRate,
    form: wc.form ?? stats.form,
    matchesPlayed: wc.matchesPlayed ?? null,
  };
}

/** Historial H2H en el torneo + comparativa de forma (Módulo Core). */
export function buildH2hReport(allFixtures, homeTeamEn, awayTeamEn) {
  const homeEn = norm(homeTeamEn);
  const awayEn = norm(awayTeamEn);
  if (homeEn === UNDEFINED_TEAM || awayEn === UNDEFINED_TEAM) {
    return { ok: false, error: 'Equipos no definidos' };
  }

  const meetings = allFixtures
    .filter((f) => {
      const h = norm(f.homeTeam);
      const a = norm(f.awayTeam);
      return (h === homeEn && a === awayEn) || (h === awayEn && a === homeEn);
    })
    .map((f) => ({
      matchNumber: f.matchNumber,
      date: f.date,
      homeTeam: norm(f.homeTeam),
      awayTeam: norm(f.awayTeam),
      status: f.status,
      ...meetingResult(f, norm(f.homeTeam), norm(f.awayTeam)),
    }))
    .filter((m) => m.score || m.status === 'scheduled')
    .sort((a, b) => a.date.localeCompare(b.date));

  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  meetings.forEach((m) => {
    if (!m.winner || m.winner === 'draw') { draws += 1; return; }
    const homeSide = m.homeTeam === homeEn;
    if (m.winner === 'home') {
      if (homeSide) homeWins += 1; else awayWins += 1;
    } else if (m.winner === 'away') {
      if (homeSide) awayWins += 1; else homeWins += 1;
    }
  });

  const home = teamSnapshot(homeEn);
  const away = teamSnapshot(awayEn);

  return {
    ok: true,
    home,
    away,
    summary: {
      played: meetings.filter((m) => m.score).length,
      homeWins,
      awayWins,
      draws,
      scheduled: meetings.filter((m) => !m.score).length,
    },
    meetings,
    comparison: [
      { label: 'Goles a favor (prom.)', home: home.goalsForAvg, away: away.goalsForAvg },
      { label: 'Goles en contra (prom.)', home: home.goalsAgainstAvg, away: away.goalsAgainstAvg },
      { label: 'Win rate', home: home.winRate != null ? `${Math.round(home.winRate * 100)}%` : '—', away: away.winRate != null ? `${Math.round(away.winRate * 100)}%` : '—' },
      { label: 'Partidos WC', home: home.matchesPlayed ?? '—', away: away.matchesPlayed ?? '—' },
    ],
  };
}
