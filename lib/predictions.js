import {
  roundBettingLine,
  roundPercent,
  formatBettingLine,
  conservativeOverLine,
  cornerOverLine,
  displayBettingLine,
} from './rounding.js';
import { checkActionHit, computeLiveSegments, resolveLiveOutcome } from './evaluation.js';

const TIER_ORDER = { recomendable: 0, probable: 1, poco: 2 };

const HIGH_HIT = new Set([
  'over_1_5_goals', 'goal_first_half', 'home_scores', 'away_scores', 'btts',
  'over_total_corners', 'over_shots_on_target',
]);
const LOW_HIT = new Set([
  'red_card', 'ht_draw', 'more_corners_second_half', 'home_double_chance', 'away_double_chance',
]);

function clampProb(n) {
  return roundPercent(Math.min(88, Math.max(12, n)));
}

function toLineNum(formatted) {
  return parseFloat(formatted);
}

export function actionCategory(probability, evalType, rank = 10) {
  let score = probability;
  if (HIGH_HIT.has(evalType)) score += 10;
  if (LOW_HIT.has(evalType)) score -= 15;
  if (rank <= 3) score += 6;
  if (rank <= 5) score += 3;

  if (score >= 78) {
    return {
      id: 'recomendable',
      label: 'Alta tasa de acierto',
      hint: 'Línea conservadora con historial favorable en este tipo de apuesta.',
    };
  }
  if (score >= 62) {
    return {
      id: 'probable',
      label: 'Acierto posible',
      hint: 'Probabilidad razonable; conviene combinar con apuestas más seguras.',
    };
  }
  return {
    id: 'poco',
    label: 'Bajo margen de acierto',
    hint: 'Mayor variabilidad; no recomendada si buscas la mayor tasa de aciertos.',
  };
}

function buildShooterListForTeam(team) {
  return team.shooters
    .filter((p) => !/medio ofensivo/i.test(p.name))
    .map((p) => ({
      name: p.name,
      projected: displayBettingLine(p.avgShots * 1.05),
    }))
    .sort((a, b) => b.projected - a.projected);
}

function attachPieShares(actions) {
  const sum = actions.reduce((s, a) => s + a.probability, 0) || 1;
  let used = 0;
  return actions.map((a, i) => {
    const pieShare = i === actions.length - 1
      ? 100 - used
      : roundPercent((a.probability / sum) * 100);
    used += pieShare;
    return { ...a, pieShare };
  });
}

function sortAndRankActions(items) {
  const withCat = items.map((item) => ({
    ...item,
    category: actionCategory(item.probability, item.eval.type, 99),
  }));

  withCat.sort((a, b) => {
    const tierDiff = TIER_ORDER[a.category.id] - TIER_ORDER[b.category.id];
    if (tierDiff !== 0) return tierDiff;
    return b.probability - a.probability;
  });

  return attachPieShares(
    withCat.slice(0, 10).map((item, i) => {
      const rank = i + 1;
      return {
        ...item,
        rank,
        category: actionCategory(item.probability, item.eval.type, rank),
      };
    })
  );
}

function buildProbableActions(home, away, referee, ctx) {
  const { dominance, corners, shotsOnTarget, discipline } = ctx;
  const hn = home.displayName;
  const an = away.displayName;

  const cornerLine = formatBettingLine(cornerOverLine(corners.total));
  const shotsLine = formatBettingLine(conservativeOverLine(shotsOnTarget.total));
  const yellowLine = formatBettingLine(conservativeOverLine(discipline.yellowCards));

  const candidates = [
    {
      label: `Más de ${cornerLine} córners en total`,
      prob: 58 + Math.max(0, corners.total - toLineNum(cornerLine)) * 8,
      eval: { type: 'over_total_corners', line: toLineNum(cornerLine) },
    },
    {
      label: 'Ambos equipos marcan',
      prob: 42 + Math.min(home.cornersFav, away.cornersFav) * 5,
      eval: { type: 'btts' },
    },
    {
      label: `Más de ${yellowLine} tarjetas amarillas`,
      prob: 50 + Math.max(0, discipline.yellowCards - toLineNum(yellowLine)) * 6,
      eval: { type: 'over_yellow_cards', line: toLineNum(yellowLine) },
    },
    {
      label: `Más de ${shotsLine} disparos a puerta`,
      prob: 55 + Math.max(0, shotsOnTarget.total - toLineNum(shotsLine)) * 5,
      eval: { type: 'over_shots_on_target', line: toLineNum(shotsLine) },
    },
    {
      label: 'Más de 1.5 goles en el partido',
      prob: 52 + (home.cornersFav + away.cornersFav) * 1.6,
      eval: { type: 'over_1_5_goals' },
    },
    {
      label: `${hn} gana o empata (1X)`,
      prob: 30 + dominance.home * 0.5,
      eval: { type: 'home_double_chance' },
    },
    {
      label: `${an} gana o empata (X2)`,
      prob: 30 + dominance.away * 0.5,
      eval: { type: 'away_double_chance' },
    },
    {
      label: `${hn} saca más córners que ${an}`,
      prob: 38 + Math.max(0, corners.home - corners.away) * 7,
      eval: { type: 'home_more_corners' },
    },
    {
      label: 'Gol en la primera mitad',
      prob: 62 + (home.cornersFav + away.cornersFav) * 0.9,
      eval: { type: 'goal_first_half' },
    },
    {
      label: 'Hay tarjeta roja en el partido',
      prob: discipline.redProb * 0.75,
      eval: { type: 'red_card' },
    },
    {
      label: `${hn} anota al menos 1 gol`,
      prob: 48 + home.cornersFav * 3.2,
      eval: { type: 'home_scores' },
    },
    {
      label: `${an} anota al menos 1 gol`,
      prob: 48 + away.cornersFav * 3.2,
      eval: { type: 'away_scores' },
    },
    {
      label: 'Menos de 3.5 goles totales',
      prob: 40 + (10 - (home.cornersFav + away.cornersFav)) * 2.5,
      eval: { type: 'under_3_5_goals' },
    },
    {
      label: 'Empate al descanso',
      prob: 24 + Math.abs(dominance.home - 50) * 0.28,
      eval: { type: 'ht_draw' },
    },
    {
      label: 'Más córners en el segundo tiempo',
      prob: 48 + referee.multiplier * 1.5,
      eval: { type: 'more_corners_second_half' },
    },
  ];

  const items = candidates.map(({ label, prob, eval: evalDef }) => ({
    label,
    probability: clampProb(prob),
    eval: evalDef,
  }));

  return sortAndRankActions(items);
}

export function buildLiveProbableActions(preActions, liveCtx, partialActual) {
  const remaining = Math.max(0.05, (90 - (liveCtx?.minute ?? 0)) / 90);
  const hits = [];
  const misses = [];
  const pendingItems = [];

  for (const action of preActions) {
    const outcome = partialActual
      ? resolveLiveOutcome(action.eval, partialActual, liveCtx)
      : 'pending';

    const reviewEntry = {
      label: action.label,
      probability: action.probability,
      category: action.category,
      rank: action.rank,
    };

    if (outcome === 'hit') {
      hits.push(reviewEntry);
      continue;
    }
    if (outcome === 'miss') {
      misses.push(reviewEntry);
      continue;
    }

    let probability = action.probability;
    let label = action.label;
    const hitNow = partialActual
      ? checkActionHit(action.eval, partialActual, liveCtx)
      : null;

    if (hitNow === false && (liveCtx?.minute ?? 0) >= 55) {
      probability = clampProb(Math.max(10, probability - 28));
      label = `${action.label} · en riesgo`;
    } else {
      probability = clampProb(probability * (0.55 + remaining * 0.55));
      label = `${action.label} · ${liveCtx?.isHalftime ? 'ENTRETIEMPO' : `min ${liveCtx?.display || liveCtx?.minute || 0}'`}`;
    }

    pendingItems.push({
      ...action,
      label,
      probability,
      liveSegments: partialActual
        ? computeLiveSegments(action.eval, partialActual, liveCtx)
        : null,
    });
  }

  return {
    pending: sortAndRankActions(
      pendingItems.map((item, i) => ({ ...item, rank: i + 1 }))
    ),
    review: { hits, misses },
  };
}

export function computePredictions(home, away, referee) {
  const homeWin = home.winRate ?? 0.33;
  const awayWin = away.winRate ?? 0.33;
  const homeStr = home.cornersFav * 0.35 + homeWin * 3 + home.cornersFav * 0.3;
  const awayStr = away.cornersFav * 0.35 + awayWin * 3 + away.cornersFav * 0.3;
  const totalStr = homeStr + awayStr || 1;
  const homeDom = roundPercent((homeStr / totalStr) * 100);

  const rawHomeCorners = (home.cornersFav + away.cornersAgainst) / 2;
  const rawAwayCorners = (away.cornersFav + home.cornersAgainst) / 2;
  const rawHomeShots = (home.shotsOnTargetFav + away.shotsOnTargetAgainst) / 2;
  const rawAwayShots = (away.shotsOnTargetFav + home.shotsOnTargetAgainst) / 2;

  const projHomeCorners = displayBettingLine(rawHomeCorners);
  const projAwayCorners = displayBettingLine(rawAwayCorners);
  const projTotalCorners = displayBettingLine(projHomeCorners + projAwayCorners);

  const projHomeShots = displayBettingLine(rawHomeShots);
  const projAwayShots = displayBettingLine(rawAwayShots);
  const projTotalShots = displayBettingLine(projHomeShots + projAwayShots);

  const combinedAgg = (home.aggressiveness + away.aggressiveness) / 2;
  const rawYellow = combinedAgg * referee.multiplier * 0.085 + referee.cardsPerGame * 0.15;
  const yellowCards = displayBettingLine(rawYellow);
  const redProb = roundPercent(Math.min(92, Math.max(4,
    ((home.redPerGame || 0) + (away.redPerGame || 0)) * 50 * referee.multiplier +
    (combinedAgg > 13 ? 10 : 0)
  )));

  const dominance = { home: homeDom, away: 100 - homeDom };
  const corners = {
    home: projHomeCorners,
    away: projAwayCorners,
    total: projTotalCorners,
  };
  const shotsOnTarget = {
    home: projHomeShots,
    away: projAwayShots,
    total: projTotalShots,
    homePlayers: buildShooterListForTeam(home),
    awayPlayers: buildShooterListForTeam(away),
  };
  const discipline = {
    yellowCards,
    redProb,
    combinedAgg: displayBettingLine(combinedAgg),
  };

  const probableActions = buildProbableActions(home, away, referee, {
    dominance,
    corners,
    shotsOnTarget,
    discipline,
  });

  const winOutlook = computeWinOutlook(home, away, dominance);

  return {
    dominance,
    winOutlook,
    corners,
    shotsOnTarget,
    probableActions,
    discipline,
  };
}

function computeWinOutlook(home, away, dominance) {
  const strengthGap = Math.abs(dominance.home - 50);
  const draw = roundPercent(Math.max(16, Math.min(34, 26 - strengthGap * 0.08)));
  const remaining = 100 - draw;
  let homePct = roundPercent((dominance.home / 100) * remaining);
  let awayPct = roundPercent((dominance.away / 100) * remaining);
  const drift = 100 - homePct - awayPct - draw;
  if (drift !== 0) {
    if (dominance.home >= dominance.away) homePct = roundPercent(homePct + drift);
    else awayPct = roundPercent(awayPct + drift);
  }
  return { home: homePct, draw, away: awayPct };
}
