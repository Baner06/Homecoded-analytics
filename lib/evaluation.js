import { getVerifiedStats } from './matchStats.js';

function normalizeCtx(ctxOrMinute) {
  if (typeof ctxOrMinute === 'object' && ctxOrMinute != null) {
    return {
      minute: ctxOrMinute.minute ?? 0,
      atOrAfterHT: !!ctxOrMinute.atOrAfterHT,
      isFirstHalf: !!ctxOrMinute.isFirstHalf,
      isHalftime: !!ctxOrMinute.isHalftime,
      finished: !!ctxOrMinute.finished,
    };
  }
  const minute = Number(ctxOrMinute) || 0;
  return {
    minute,
    atOrAfterHT: minute >= 45,
    isFirstHalf: minute <= 45 && minute < 45,
    isHalftime: false,
    finished: minute >= 90,
  };
}

export function checkActionHit(evalDef, actual, ctxOrMinute = null) {
  return checkAction(evalDef, actual, ctxOrMinute);
}

/** Resultado en vivo: pending | hit | miss */
export function resolveLiveOutcome(evalDef, actual, ctxOrMinute = null) {
  if (!evalDef?.type || !actual) return 'pending';

  const ctx = normalizeCtx(ctxOrMinute);
  const hit = checkAction(evalDef, actual, ctx);

  switch (evalDef.type) {
    case 'goal_first_half': {
      if (ctx.isFirstHalf) {
        return (actual.totalGoals ?? 0) > 0 ? 'hit' : 'pending';
      }
      if (ctx.isHalftime || ctx.atOrAfterHT) {
        const htGoals = (actual.htHomeGoals ?? 0) + (actual.htAwayGoals ?? 0);
        return htGoals > 0 ? 'hit' : 'miss';
      }
      return 'pending';
    }
    case 'ht_draw': {
      if (!ctx.atOrAfterHT) return 'pending';
      const htHome = actual.htHomeGoals ?? 0;
      const htAway = actual.htAwayGoals ?? 0;
      return htHome === htAway ? 'hit' : 'miss';
    }
    case 'more_corners_second_half': {
      if (ctx.isHalftime || !ctx.atOrAfterHT || ctx.minute < 46) return 'pending';
      if (actual.firstHalfCorners == null) return 'pending';
      const fh = actual.firstHalfCorners;
      const sh = actual.secondHalfCorners ?? 0;
      if (sh > fh) return 'hit';
      if (ctx.finished) return 'miss';
      return 'pending';
    }
    case 'under_3_5_goals': {
      if ((actual.totalGoals ?? 0) >= 4) return 'miss';
      if (ctx.finished) return 'hit';
      return 'pending';
    }
    case 'home_double_chance':
    case 'away_double_chance':
    case 'home_more_corners': {
      if (!ctx.finished) return 'pending';
      if (hit === null) return 'pending';
      return hit ? 'hit' : 'miss';
    }
    default: {
      if (hit === true) return 'hit';
      if (ctx.finished && hit === false) return 'miss';
      return 'pending';
    }
  }
}

function checkAction(evalDef, actual, ctxOrMinute = null) {
  if (!evalDef?.type) return null;

  const ctx = normalizeCtx(ctxOrMinute);
  const line = evalDef.line ?? 0;

  switch (evalDef.type) {
    case 'over_total_corners':
      if (actual.totalCorners == null) return null;
      return actual.totalCorners > line;
    case 'btts':
      return actual.homeGoals > 0 && actual.awayGoals > 0;
    case 'over_yellow_cards':
      if (actual.yellowCards == null) return null;
      return actual.yellowCards > line;
    case 'over_shots_on_target':
      if (actual.totalShotsOnTarget == null) return null;
      return actual.totalShotsOnTarget > line;
    case 'over_1_5_goals':
      return actual.totalGoals > 1.5;
    case 'home_double_chance':
      return actual.homeGoals >= actual.awayGoals;
    case 'away_double_chance':
      return actual.awayGoals >= actual.homeGoals;
    case 'home_more_corners':
      if (actual.homeCorners == null || actual.awayCorners == null) return null;
      return actual.homeCorners > actual.awayCorners;
    case 'goal_first_half': {
      if (ctx.isFirstHalf) {
        return (actual.totalGoals ?? 0) > 0;
      }
      return (actual.htHomeGoals + actual.htAwayGoals) > 0;
    }
    case 'red_card':
      if (actual.redCards == null) return null;
      return actual.redCards > 0;
    case 'home_scores':
      return actual.homeGoals >= 1;
    case 'away_scores':
      return actual.awayGoals >= 1;
    case 'under_3_5_goals':
      return actual.totalGoals < 3.5;
    case 'ht_draw': {
      if (!ctx.atOrAfterHT) return null;
      return actual.htHomeGoals === actual.htAwayGoals;
    }
    case 'more_corners_second_half': {
      if (ctx.isHalftime || !ctx.atOrAfterHT || ctx.minute < 46) return null;
      if (actual.firstHalfCorners == null || actual.secondHalfCorners == null) return null;
      return actual.secondHalfCorners > actual.firstHalfCorners;
    }
    default:
      return null;
  }
}

export function buildActualStats(result, home, away, date, liveStats = null) {
  const verified = getVerifiedStats(date, home.displayName, away.displayName);
  const base = {
    homeGoals: result.homeGoals,
    awayGoals: result.awayGoals,
    totalGoals: result.homeGoals + result.awayGoals,
    htHomeGoals: result.htHomeGoals ?? 0,
    htAwayGoals: result.htAwayGoals ?? 0,
  };

  if (verified) {
    return { ...base, ...verified, verified: true };
  }

  if (liveStats) {
    const firstHalfCorners = liveStats.firstHalfCorners ?? null;
    const totalCorners = liveStats.totalCorners ?? 0;
    let secondHalfCorners = liveStats.secondHalfCorners;
    if (secondHalfCorners == null && firstHalfCorners != null && totalCorners != null) {
      secondHalfCorners = Math.max(0, totalCorners - firstHalfCorners);
    }
    return {
      ...base,
      homeCorners: liveStats.homeCorners ?? 0,
      awayCorners: liveStats.awayCorners ?? 0,
      totalCorners,
      homeShotsOnTarget: liveStats.homeShotsOnTarget ?? 0,
      awayShotsOnTarget: liveStats.awayShotsOnTarget ?? 0,
      totalShotsOnTarget: liveStats.totalShotsOnTarget ?? 0,
      yellowCards: liveStats.yellowCards ?? 0,
      redCards: liveStats.redCards ?? 0,
      firstHalfCorners,
      secondHalfCorners,
      verified: false,
      liveStats: true,
    };
  }

  return {
    ...base,
    homeCorners: null,
    awayCorners: null,
    totalCorners: null,
    homeShotsOnTarget: null,
    awayShotsOnTarget: null,
    totalShotsOnTarget: null,
    yellowCards: null,
    redCards: null,
    firstHalfCorners: null,
    secondHalfCorners: null,
    verified: false,
  };
}

export function evaluatePredictions(probableActions, actual) {
  const hits = [];
  const misses = [];
  const items = [];
  const finishedCtx = {
    finished: true,
    atOrAfterHT: true,
    minute: 90,
    isFirstHalf: false,
    isHalftime: false,
  };

  for (const action of probableActions) {
    const ok = checkAction(action.eval, actual, finishedCtx);
    const entry = {
      rank: action.rank,
      label: action.label,
      probability: action.probability,
      category: action.category,
      outcome: ok === true ? 'hit' : ok === false ? 'miss' : 'unknown',
    };
    items.push(entry);
    if (ok === true) hits.push(entry);
    else if (ok === false) misses.push(entry);
  }

  return {
    hits,
    misses,
    items,
    statsVerified: !!(actual.verified || actual.liveStats),
  };
}

export function parseOpenFootballScore(match) {
  if (!match?.score?.ft) return null;
  return {
    homeGoals: match.score.ft[0],
    awayGoals: match.score.ft[1],
    htHomeGoals: match.score.ht?.[0] ?? 0,
    htAwayGoals: match.score.ht?.[1] ?? 0,
  };
}

export function computeLiveProgress(actualPartial, action, minute) {
  const timePct = Math.min(100, Math.round((minute / 90) * 100));
  const ok = checkAction(action.eval, actualPartial);
  if (ok === true) return 100;
  if (ok === false && minute >= 85) return Math.max(timePct, 95);
  return timePct;
}

/** Cajones de progreso en vivo: cada unidad necesaria para cumplir la predicción Over. */
export function computeLiveSegments(evalDef, actual, ctxOrMinute = null) {
  if (!evalDef?.type || !actual) return null;

  const ctx = normalizeCtx(ctxOrMinute);
  const line = evalDef.line ?? 0;

  function overLineSegments(currentValue, threshold = line) {
    const current = Math.max(0, Number(currentValue) || 0);
    const segments = Math.floor(threshold) + 1;
    const complete = current > threshold;
    const filled = complete ? segments : Math.min(segments, Math.floor(current));
    return {
      segments,
      filled,
      complete,
      current: Math.round(current * 10) / 10,
      target: segments,
    };
  }

  switch (evalDef.type) {
    case 'over_total_corners':
      return overLineSegments(actual.totalCorners ?? 0);
    case 'over_yellow_cards':
      return overLineSegments(actual.yellowCards ?? 0);
    case 'over_shots_on_target':
      return overLineSegments(actual.totalShotsOnTarget ?? 0);
    case 'over_1_5_goals':
      return overLineSegments(actual.totalGoals ?? 0, 1.5);
    case 'btts': {
      const home = actual.homeGoals > 0;
      const away = actual.awayGoals > 0;
      const filled = (home ? 1 : 0) + (away ? 1 : 0);
      return {
        segments: 2,
        filled,
        complete: home && away,
        current: filled,
        target: 2,
      };
    }
    case 'home_scores':
      return {
        segments: 1,
        filled: actual.homeGoals >= 1 ? 1 : 0,
        complete: actual.homeGoals >= 1,
        current: actual.homeGoals ?? 0,
        target: 1,
      };
    case 'away_scores':
      return {
        segments: 1,
        filled: actual.awayGoals >= 1 ? 1 : 0,
        complete: actual.awayGoals >= 1,
        current: actual.awayGoals ?? 0,
        target: 1,
      };
    case 'red_card': {
      const reds = actual.redCards ?? 0;
      return {
        segments: 1,
        filled: reds > 0 ? 1 : 0,
        complete: reds > 0,
        current: reds,
        target: 1,
      };
    }
    case 'goal_first_half': {
      const fhGoals = ctx.isFirstHalf
        ? (actual.totalGoals ?? 0)
        : (actual.htHomeGoals ?? 0) + (actual.htAwayGoals ?? 0);
      const outcome = resolveLiveOutcome(evalDef, actual, ctx);
      return {
        segments: 1,
        filled: fhGoals > 0 ? 1 : 0,
        complete: outcome === 'hit',
        current: fhGoals,
        target: 1,
      };
    }
    case 'home_double_chance': {
      const filled = actual.homeGoals >= actual.awayGoals ? 1 : 0;
      const outcome = resolveLiveOutcome(evalDef, actual, ctx);
      return {
        segments: 1,
        filled,
        complete: outcome === 'hit',
        current: `${actual.homeGoals ?? 0}-${actual.awayGoals ?? 0}`,
        target: 1,
      };
    }
    case 'away_double_chance': {
      const filled = actual.awayGoals >= actual.homeGoals ? 1 : 0;
      const outcome = resolveLiveOutcome(evalDef, actual, ctx);
      return {
        segments: 1,
        filled,
        complete: outcome === 'hit',
        current: `${actual.homeGoals ?? 0}-${actual.awayGoals ?? 0}`,
        target: 1,
      };
    }
    case 'ht_draw': {
      if (!ctx.atOrAfterHT) {
        const home = actual.homeGoals ?? 0;
        const away = actual.awayGoals ?? 0;
        return {
          segments: 1,
          filled: home === away ? 1 : 0,
          complete: false,
          current: `${home}-${away}`,
          target: 1,
        };
      }
      const htHome = actual.htHomeGoals ?? 0;
      const htAway = actual.htAwayGoals ?? 0;
      const outcome = resolveLiveOutcome(evalDef, actual, ctx);
      return {
        segments: 1,
        filled: htHome === htAway ? 1 : 0,
        complete: outcome === 'hit',
        current: `${htHome}-${htAway}`,
        target: 1,
      };
    }
    case 'home_more_corners': {
      const hc = actual.homeCorners ?? 0;
      const ac = actual.awayCorners ?? 0;
      if (actual.homeCorners == null && actual.awayCorners == null) return null;
      return {
        segments: 1,
        filled: hc > ac ? 1 : 0,
        complete: hc > ac,
        current: `${hc}-${ac}`,
        target: 1,
      };
    }
    case 'more_corners_second_half': {
      if (ctx.isHalftime || !ctx.atOrAfterHT || ctx.minute < 46) return null;
      if (actual.firstHalfCorners == null) return null;
      const fh = actual.firstHalfCorners;
      const sh = actual.secondHalfCorners ?? 0;
      const outcome = resolveLiveOutcome(evalDef, actual, ctx);
      return {
        segments: 1,
        filled: sh > fh ? 1 : 0,
        complete: outcome === 'hit',
        current: `${sh} vs ${fh}`,
        target: 1,
      };
    }
    case 'under_3_5_goals': {
      const g = actual.totalGoals ?? 0;
      const segments = 4;
      const safe = Math.max(0, segments - Math.min(segments, g));
      const outcome = resolveLiveOutcome(evalDef, actual, ctx);
      return {
        segments,
        filled: safe,
        complete: outcome === 'hit',
        current: g,
        target: '<4',
      };
    }
    default:
      return null;
  }
}
