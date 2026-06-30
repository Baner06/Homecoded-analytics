/** Calculadora de rollover de bono (Módulo Gestión). */

export function computeRollover({ bonusAmount, multiplier, minOdds, wagered = 0 }) {
  const bonus = Number(bonusAmount) || 0;
  const mult = Number(multiplier) || 0;
  const min = Number(minOdds) || 1;
  const done = Math.max(0, Number(wagered) || 0);
  const target = bonus * mult;
  const remaining = Math.max(0, target - done);
  const progressPct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
  const completed = remaining <= 0;

  return {
    bonusAmount: bonus,
    multiplier: mult,
    minOdds: min,
    wagered: done,
    target,
    remaining,
    progressPct,
    completed,
    label: completed
      ? 'Rollover completado'
      : `Llevas apostado $${formatMoney(done)} COP de $${formatMoney(target)} COP`,
  };
}

function formatMoney(n) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(n));
}

export function applyRolloverBet(state, stake, odds) {
  const stakeNum = Number(stake) || 0;
  const oddsNum = Number(odds) || 0;
  if (stakeNum <= 0 || oddsNum < state.minOdds) {
    return { ...state, rejected: true, reason: `Cuota mínima ${state.minOdds}` };
  }
  return computeRollover({
    ...state,
    wagered: state.wagered + stakeNum,
  });
}
