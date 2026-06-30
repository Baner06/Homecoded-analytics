/** Esquema relacional de referencia (persistencia local + API). */

export const TABLES = {
  equipos: {
    id: 'number | string',
    nombre: 'string',
    iso: 'string | null',
    flagUrl: 'string | null',
    originalName: 'string',
  },
  partidos: {
    id: 'number',
    equipoLocal: 'string',
    equipoVisitante: 'string',
    fecha: 'YYYY-MM-DD',
    estado: 'scheduled | live | finished',
    torneo: 'string',
    stage: 'string',
  },
  usuarios: {
    id: 'string',
    alias: 'string',
    createdAt: 'ISO8601',
  },
  pronosticos_guardados: {
    id: 'string',
    userId: 'string',
    partidoId: 'number',
    mercado: 'string',
    cuota: 'number | null',
    stake: 'number | null',
    resultado: 'pending | hit | miss | void',
    createdAt: 'ISO8601',
  },
  rollover: {
    bonusAmount: 'number',
    multiplier: 'number',
    minOdds: 'number',
    wagered: 'number',
    updatedAt: 'ISO8601',
  },
};

export function validatePortfolioBet(bet) {
  if (!bet || typeof bet !== 'object') return false;
  return !!(bet.id && bet.match && bet.label);
}

export function validateRolloverInput(input) {
  const bonus = Number(input?.bonusAmount);
  const mult = Number(input?.multiplier);
  const minOdds = Number(input?.minOdds);
  const wagered = Number(input?.wagered ?? 0);
  if (!Number.isFinite(bonus) || bonus <= 0) return null;
  if (!Number.isFinite(mult) || mult <= 0) return null;
  if (!Number.isFinite(minOdds) || minOdds < 1) return null;
  if (!Number.isFinite(wagered) || wagered < 0) return null;
  return { bonusAmount: bonus, multiplier: mult, minOdds, wagered };
}
