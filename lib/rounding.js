/**
 * Redondeo tipo cuota: solo enteros o +0.5 (nunca 5.1 ni 5.7).
 * · &lt; .25 del decimal → baja al entero (5.1 → 5)
 * · &gt; .75 del decimal → sube al entero (5.7 → 6)
 * · entre .25 y .75 → línea +0.5 (5.4 → 5.5)
 */
export function roundBettingLine(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const base = Math.floor(n);
  const frac = n - base;
  if (frac < 0.25) return base;
  if (frac > 0.75) return base + 1;
  return base + 0.5;
}

export function displayBettingLine(value) {
  const v = roundBettingLine(value);
  return v === 1 ? 0.5 : v;
}

export function formatBettingLine(value) {
  const v = displayBettingLine(value);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function roundPercent(value) {
  return Math.round(Number(value) || 0);
}

/** Línea Over más conservadora: un escalón abajo del proyección bruto. */
export function conservativeOverLine(projected) {
  return roundBettingLine(Math.max(0.5, Number(projected) - 1.5));
}

/** Córners: N proyectados → Over (N − 0.5). Ej.: 8 córners → Más de 7.5. */
export function cornerOverLine(projected) {
  return roundBettingLine(Math.max(0.5, Number(projected) - 0.5));
}
