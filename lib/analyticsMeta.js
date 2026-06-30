/** Metadatos del motor analítico (Módulo 3). */

export const CONFIDENCE_TIERS = [
  {
    id: 'recomendable',
    label: 'Alta tasa de acierto',
    minScore: 78,
    description: 'Mercados conservadores con historial favorable en el Mundial (goles, córners, disparos).',
  },
  {
    id: 'probable',
    label: 'Acierto posible',
    minScore: 62,
    description: 'Probabilidad razonable; conviene combinar con líneas más seguras.',
  },
  {
    id: 'poco',
    label: 'Bajo margen de acierto',
    minScore: 0,
    description: 'Mayor varianza estadística; no recomendada como apuesta única.',
  },
];

export const ENGINE_SOURCES = [
  'Estadísticas WC por jugador/equipo (ESPN)',
  'Fixtures y cuadro (OpenFootball + TheStatsAPI)',
  'Designación árbitros (FIFA + ESPN + SofaScore)',
  'Stats en vivo (ESPN / complemento SofaScore)',
];

export function summarizePredictions(match) {
  if (!match?.analysis?.probableActions?.length) {
    return { ok: false, matchId: match?.id ?? null };
  }
  const actions = match.analysis.probableActions;
  const byTier = { recomendable: 0, probable: 0, poco: 0 };
  actions.forEach((a) => {
    const id = a.category?.id || 'poco';
    byTier[id] = (byTier[id] || 0) + 1;
  });
  return {
    ok: true,
    matchId: match.id,
    matchNumber: match.matchNumber,
    match: `${match.home?.name} vs ${match.away?.name}`,
    top: actions.slice(0, 3).map((a) => ({
      rank: a.rank,
      label: a.label,
      probability: a.probability,
      category: a.category?.id,
      eval: a.eval,
    })),
    distribution: byTier,
    engine: 'coded-sports-analytics-v1',
    tiers: CONFIDENCE_TIERS,
  };
}
