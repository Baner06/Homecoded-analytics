import { checkActionHit } from './evaluation.js';

/** Portafolio de pronósticos y yield (Módulo Gestión). */

export function resolveBetOutcome(bet, finishedMatches = []) {
  const match = finishedMatches.find((m) =>
    m.id === bet.matchId
    || m.matchNumber === bet.matchId
    || `${m.id}` === `${bet.matchId}`
  );
  if (!match || match.status !== 'finished' || !match.actualStats) {
    return { ...bet, outcome: bet.outcome || 'pending', yieldPct: null };
  }

  const evalType = bet.eval?.type || bet.evalType;
  if (!evalType) {
    return { ...bet, outcome: bet.outcome || 'pending', yieldPct: null };
  }

  const action = {
    eval: {
      type: evalType,
      line: bet.eval?.line ?? bet.evalLine ?? undefined,
    },
  };

  const hit = checkActionHit(action, match.actualStats, match.score);
  const outcome = hit === true ? 'hit' : hit === false ? 'miss' : 'unknown';
  const odds = Number(bet.odds ?? bet.betanoOdds) || null;
  let yieldPct = null;
  if (outcome === 'hit' && odds) yieldPct = Math.round((odds - 1) * 100);
  if (outcome === 'miss') yieldPct = -100;

  return { ...bet, outcome, yieldPct, resolvedMatchId: match.id };
}

export function analyzePortfolio(bets = [], finishedMatches = []) {
  const enriched = bets.map((b) => resolveBetOutcome({
    ...b,
    matchId: b.matchId ?? b.mid ?? parseInt(String(b.id).split('-')[0], 10),
  }, finishedMatches));

  const settled = enriched.filter((b) => b.outcome === 'hit' || b.outcome === 'miss');
  const hits = settled.filter((b) => b.outcome === 'hit').length;
  const misses = settled.filter((b) => b.outcome === 'miss').length;
  const pending = enriched.filter((b) => b.outcome === 'pending' || b.outcome === 'unknown').length;
  const hitRate = settled.length ? Math.round((hits / settled.length) * 100) : null;

  const withOdds = settled.filter((b) => (b.odds || b.betanoOdds) && b.outcome === 'hit');
  const avgOdds = withOdds.length
    ? +(withOdds.reduce((s, b) => s + Number(b.odds ?? b.betanoOdds), 0) / withOdds.length).toFixed(2)
    : null;

  const stakeUnit = 1;
  const profitUnits = settled.reduce((sum, b) => {
    if (b.outcome === 'hit') return sum + ((Number(b.odds ?? b.betanoOdds) || 1.5) - 1) * stakeUnit;
    if (b.outcome === 'miss') return sum - stakeUnit;
    return sum;
  }, 0);
  const yieldPct = settled.length
    ? Math.round((profitUnits / (settled.length * stakeUnit)) * 100)
    : null;

  return {
    total: enriched.length,
    hits,
    misses,
    pending,
    hitRate,
    yieldPct,
    avgOdds,
    bets: enriched,
    chart: buildYieldSeries(enriched),
  };
}

function buildYieldSeries(bets) {
  let cumulative = 0;
  return bets
    .filter((b) => b.outcome === 'hit' || b.outcome === 'miss')
    .map((b, i) => {
      if (b.outcome === 'hit') cumulative += (Number(b.odds ?? b.betanoOdds) || 1.5) - 1;
      else cumulative -= 1;
      return { index: i + 1, label: b.label?.slice(0, 24) || b.match, cumulative: +cumulative.toFixed(2) };
    });
}
