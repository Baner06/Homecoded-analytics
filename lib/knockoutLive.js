import { isKnockoutStage } from './liveClock.js';

function formatEspnClock(displayClock) {
  if (!displayClock) return null;
  return String(displayClock).replace(/'+/g, "'");
}

function padShots(shots, slots) {
  const out = [];
  for (let i = 0; i < slots; i += 1) {
    out.push(i < shots.length ? shots[i] : null);
  }
  return out;
}

/** Fase ESPN: period 3 = TE1, 4 = TE2, 5 = penales. */
export function parseKnockoutPhase(compStatus, statusType) {
  const period = compStatus?.period;
  const name = String(statusType?.name || '');
  const detail = String(statusType?.detail || statusType?.shortDetail || '');
  const combined = `${name} ${detail}`.toUpperCase();

  if (period === 5 || /PEN|SHOOTOUT/.test(combined) || /STATUS.*PEN/.test(name)) {
    return {
      inExtraTime: true,
      inShootout: true,
      etPhase: 'shootout',
      etLabel: 'PENALES',
      display: 'PENALES',
      showExtraTime: false,
      showShootout: true,
    };
  }

  if (period === 4 || /2ND.*EXTRA|SECOND.*EXTRA|ET2/.test(combined)) {
    return {
      inExtraTime: true,
      inShootout: false,
      etPhase: 'et2',
      etLabel: 'TE2',
      display: formatEspnClock(compStatus?.displayClock) || 'TE2',
      showExtraTime: true,
      showShootout: false,
    };
  }

  if (period === 3 || /1ST.*EXTRA|FIRST.*EXTRA/.test(combined)) {
    return {
      inExtraTime: true,
      inShootout: false,
      etPhase: 'et1',
      etLabel: 'TE1',
      display: formatEspnClock(compStatus?.displayClock) || 'TE1',
      showExtraTime: true,
      showShootout: false,
    };
  }

  if (/HALFTIME.*EXTRA|EXTRA.*HALFTIME|DESCANSO.*EXTRA/.test(combined)) {
    return {
      inExtraTime: true,
      inShootout: false,
      etPhase: 'et_halftime',
      etLabel: 'DESC. TE',
      display: 'DESC. TE',
      showExtraTime: true,
      showShootout: false,
    };
  }

  if (/EXTRA.*TIME|STATUS.*EXTRA/.test(combined)) {
    return {
      inExtraTime: true,
      inShootout: false,
      etPhase: 'et1',
      etLabel: 'PRÓRROGA',
      display: formatEspnClock(compStatus?.displayClock) || 'PRÓRROGA',
      showExtraTime: true,
      showShootout: false,
    };
  }

  return null;
}

export function parseShootoutFromSummary(shootoutArr, homeTeamId, awayTeamId) {
  if (!Array.isArray(shootoutArr) || !shootoutArr.length) return null;

  const byId = new Map(shootoutArr.map((t) => [String(t.id), t.shots || []]));
  const homeShots = (byId.get(String(homeTeamId)) || []).map((s) => ({ scored: !!s.didScore }));
  const awayShots = (byId.get(String(awayTeamId)) || []).map((s) => ({ scored: !!s.didScore }));

  if (!homeShots.length && !awayShots.length) return null;

  const slotCount = Math.max(homeShots.length, awayShots.length, 5);
  return {
    home: padShots(homeShots, slotCount),
    away: padShots(awayShots, slotCount),
    slotCount,
    homeAttempts: homeShots.length,
    awayAttempts: awayShots.length,
  };
}

export function parseShootoutFromDetails(details, homeTeamId, awayTeamId) {
  const events = (details || []).filter((d) => d.shootout);
  if (!events.length) return null;

  const homeShots = [];
  const awayShots = [];

  for (const d of events) {
    const text = d.type?.text || '';
    const scored = d.scoringPlay === true || /scored/i.test(text);
    const missed = d.scoringPlay === false || /miss/i.test(text);
    const shot = { scored: scored ? true : missed ? false : null };
    if (String(d.team?.id) === String(homeTeamId)) homeShots.push(shot);
    else if (String(d.team?.id) === String(awayTeamId)) awayShots.push(shot);
  }

  if (!homeShots.length && !awayShots.length) return null;

  const slotCount = Math.max(homeShots.length, awayShots.length, 5);
  return {
    home: padShots(homeShots, slotCount),
    away: padShots(awayShots, slotCount),
    slotCount,
    homeAttempts: homeShots.length,
    awayAttempts: awayShots.length,
  };
}

export function buildKnockoutLiveView(stage, liveFeed, matchResult) {
  if (!isKnockoutStage(stage) || !liveFeed) return null;

  const phase = parseKnockoutPhase(
    { period: liveFeed.compPeriod, displayClock: liveFeed.displayClock },
    { name: liveFeed.statusName, detail: liveFeed.statusDetail }
  );

  let shootout = liveFeed.shootout || null;
  if (phase?.showShootout && !shootout) {
    shootout = parseShootoutFromDetails(
      liveFeed.details,
      liveFeed.homeTeamId,
      liveFeed.awayTeamId
    );
  }

  const tiedAfterRegulation = matchResult
    && matchResult.homeGoals === matchResult.awayGoals;

  if (!phase && liveFeed.isLive && tiedAfterRegulation && (liveFeed.compPeriod ?? 0) >= 3) {
    return {
      inExtraTime: true,
      inShootout: false,
      etPhase: 'et1',
      etLabel: 'PRÓRROGA',
      display: formatEspnClock(liveFeed.displayClock) || 'PRÓRROGA',
      showExtraTime: true,
      showShootout: false,
      shootout: null,
      penHome: liveFeed.homeShootoutScore ?? null,
      penAway: liveFeed.awayShootoutScore ?? null,
    };
  }

  if (!phase && !shootout) return null;

  const view = phase || {
    inExtraTime: false,
    inShootout: true,
    etPhase: 'shootout',
    etLabel: 'PENALES',
    display: 'PENALES',
    showExtraTime: false,
    showShootout: true,
  };

  if (view.showShootout && shootout) {
    view.shootout = shootout;
    const countScored = (shots) => shots.filter((s) => s?.scored === true).length;
    view.penHome = liveFeed.homeShootoutScore ?? countScored(shootout.home);
    view.penAway = liveFeed.awayShootoutScore ?? countScored(shootout.away);
  } else {
    view.shootout = null;
    view.penHome = null;
    view.penAway = null;
  }

  // ESPN conserva period/display de prórroga al finalizar; el panel amarillo es solo en vivo.
  if (!liveFeed.isLive && view.showExtraTime) {
    view.showExtraTime = false;
    view.inExtraTime = false;
  }

  if (!view.showExtraTime && !view.showShootout) return null;

  return view;
}

export function mergeKnockoutLiveClock(clock, koView, liveFeed, matchResult, stage) {
  if (!koView?.showExtraTime && !koView?.showShootout) {
    const tied = matchResult && matchResult.homeGoals === matchResult.awayGoals;
    if (liveFeed?.isLive && tied && clock.finished && isKnockoutStage(stage)) {
      return { ...clock, finished: false, phase: 'awaiting_et', display: 'FIN 90\'' };
    }
    return clock;
  }

  return {
    ...clock,
    finished: false,
    isHalftime: koView.etPhase === 'et_halftime',
    phase: koView.etPhase,
    display: koView.display || clock.display,
    atOrAfterHT: true,
  };
}
