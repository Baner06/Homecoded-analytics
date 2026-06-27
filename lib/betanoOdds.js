/**
 * Cuotas Betano de referencia para visualización (PDF / MI Apuesta).
 * NO se usan en computePredictions ni en evaluatePredictions.
 *
 * Fuentes (prioridad):
 * 1. Semilla manual BETANO_SEED (actualizable)
 * 2. Cuota estimada estilo casa con margen (~7%) a partir de la probabilidad del modelo
 */

const CACHE_MS = 10 * 60 * 1000;

/** @type {{ at: number, map: Map<string, object> }} */
let cache = { at: 0, map: new Map() };

/** Cuotas semilla — actualizar manualmente o vía script cuando haya datos reales. */
export const BETANO_SEED = {
  '2026-06-26|Egipto|Irán|goal_first_half': 1.72,
  '2026-06-26|Egipto|Irán|over_total_corners_8.5': 1.85,
  '2026-06-26|Nueva Zelanda|Bélgica|btts': 1.78,
  '2026-06-26|Uruguay|España|over_1_5_goals': 1.45,
  '2026-06-26|Uruguay|España|away_scores': 1.55,
};

const VIG_BY_TYPE = {
  over_total_corners: 0.08,
  over_yellow_cards: 0.09,
  over_shots_on_target: 0.08,
  over_1_5_goals: 0.06,
  btts: 0.07,
  home_double_chance: 0.07,
  away_double_chance: 0.07,
  home_scores: 0.07,
  away_scores: 0.07,
  goal_first_half: 0.08,
  red_card: 0.1,
  under_3_5_goals: 0.08,
  ht_draw: 0.09,
  home_more_corners: 0.09,
  more_corners_second_half: 0.09,
};

export function buildMarketKey(evalDef = {}) {
  const line = evalDef.line != null && evalDef.line !== '' ? `_${evalDef.line}` : '';
  return `${evalDef.type || 'unknown'}${line}`;
}

export function betanoLookupKey(date, homeName, awayName, marketKey) {
  return `${date}|${homeName}|${awayName}|${marketKey}`;
}

function roundOdds(n) {
  return Math.round(n * 100) / 100;
}

/** Estima cuota decimal tipo casa deportiva a partir de probabilidad del modelo. */
export function estimateBetanoOdds(probability, evalType = '') {
  const p = Math.min(88, Math.max(12, Number(probability) || 50)) / 100;
  const vig = VIG_BY_TYPE[evalType] ?? 0.07;
  const fair = 1 / p;
  return roundOdds(Math.max(1.01, fair * (1 + vig)));
}

export function resolveBetanoOdds({ date, homeName, awayName, marketKey, probability, evalType }) {
  const key = betanoLookupKey(date, homeName, awayName, marketKey);
  const seeded = BETANO_SEED[key];
  if (seeded != null) {
    return {
      odds: roundOdds(seeded),
      source: 'betano_seed',
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    odds: estimateBetanoOdds(probability, evalType),
    source: 'betano_ref',
    updatedAt: new Date().toISOString(),
  };
}

export function resolveBetanoOddsForBet(bet) {
  const parts = (bet.match || '').split(' vs ');
  const homeName = parts[0]?.trim() || '';
  const awayName = parts[1]?.trim() || '';
  const marketKey = bet.marketKey || buildMarketKey({ type: bet.evalType, line: bet.evalLine });
  return resolveBetanoOdds({
    date: bet.date,
    homeName,
    awayName,
    marketKey,
    probability: bet.probability,
    evalType: bet.evalType,
  });
}

export function getCachedOddsMap() {
  if (Date.now() - cache.at < CACHE_MS) return cache.map;
  return null;
}

export function setCachedOddsMap(map) {
  cache = { at: Date.now(), map };
}

export function resolveBetanoOddsBatch(bets) {
  const cached = getCachedOddsMap();
  const results = {};

  for (const bet of bets) {
    const cacheKey = bet.id || `${bet.match}-${bet.marketKey || bet.label}`;
    if (cached?.has(cacheKey)) {
      results[cacheKey] = cached.get(cacheKey);
      continue;
    }
    results[cacheKey] = resolveBetanoOddsForBet(bet);
  }

  const map = new Map(Object.entries(results));
  setCachedOddsMap(map);
  return results;
}
