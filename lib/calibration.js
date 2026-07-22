/**
 * Calibración semanal automática del modelo de predicciones.
 *
 * Cada día (vía api/cron/calibrate.js) se suman los aciertos/fallos reales
 * de los partidos recién terminados a un contador por tipo de mercado en
 * Supabase. Cada lunes se recalcula el factor de corrección de cada mercado
 * comparando la tasa de acierto real contra la probabilidad que predijimos,
 * y el contador se reinicia para la siguiente semana.
 *
 * El barrido de ligas/copas de club usa el perfil GENÉRICO de resolveTeam()
 * (sin el ajuste de forma reciente que sí ven los usuarios) a propósito:
 * así medimos el sesgo de la fórmula base en sí, sin que el barrido diario
 * tenga que repetir la ventana de 30 días de forma por cada una de las
 * ~150 competiciones disponibles (sería muy caro para un cron diario).
 *
 * Si SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no están configuradas, todo
 * este módulo queda inerte: getCalibrationFactors() devuelve {} (sin
 * ajuste) y runDailyCalibrationTick() no hace nada.
 */
import { getDateISOInColombia, addDaysToDateIso } from './timezone.js';
import { listAvailableCompetitions } from './competitions.js';
import { loadCompetitionMatches } from './liveScores.js';
import { loadSofaCompetitionMatches } from './sofaCompetitionMatches.js';
import { resolveTeam, teamStats } from './teams.js';
import { UNASSIGNED_REFEREE } from './referees.js';
import { computePredictions } from './predictions.js';
import { buildActualStats, evaluatePredictions } from './evaluation.js';
import { getFinishedMatches } from './fixtures.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MIN_SAMPLES_TO_CALIBRATE = 30;
const FACTOR_MIN = 0.85;
const FACTOR_MAX = 1.15;
const EMA_WEIGHT_NEW = 0.5;
const HISTORY_KEEP = 10;
// Tope bajo a propósito: si el cron estuvo caído varios días, se pone al día
// gradualmente en varias ejecuciones diarias en vez de arriesgar el límite
// de 60s de una función serverless escaneando ~150 competiciones x N días.
const MAX_CATCHUP_DAYS = 3;
const COMPETITION_BATCH_SIZE = 20;

const FACTORS_CACHE_MS = 10 * 60 * 1000;
let factorsCache = { at: 0, data: {} };

function isConfigured() {
  return !!(SUPABASE_URL && SERVICE_KEY);
}

export function isMondayIso(dateIso) {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 1;
}

function restHeaders(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function maskedUrlHost() {
  try {
    return SUPABASE_URL ? new URL(SUPABASE_URL).host : '(sin URL)';
  } catch {
    return `URL inválida: "${SUPABASE_URL}"`;
  }
}

async function describeError(res) {
  let bodyText = '';
  try {
    bodyText = await res.text();
  } catch { /* sin cuerpo legible */ }
  return `${res.status} en host "${maskedUrlHost()}" | body: ${bodyText.slice(0, 300)}`;
}

async function sbGet(table, query = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, { headers: restHeaders() });
  if (!res.ok) throw new Error(`Supabase GET ${table} -> ${await describeError(res)}`);
  return res.json();
}

async function sbUpsert(table, rows, onConflict) {
  if (!rows.length) return [];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: restHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Supabase UPSERT ${table} -> ${await describeError(res)}`);
  return res.json();
}

async function sbPatch(table, filter, patch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: restHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Supabase PATCH ${table} -> ${await describeError(res)}`);
}

/** Mapa tipo de mercado -> factor de corrección (1 = sin ajuste). Cacheado en memoria. */
export async function getCalibrationFactors() {
  if (!isConfigured()) return {};
  const now = Date.now();
  if (now - factorsCache.at < FACTORS_CACHE_MS) return factorsCache.data;

  try {
    const rows = await sbGet('market_calibration', '?select=market_type,factor');
    const map = {};
    for (const r of rows) map[r.market_type] = Number(r.factor) || 1;
    factorsCache = { at: now, data: map };
    return map;
  } catch (err) {
    console.error('[calibration] getCalibrationFactors falló, se mantiene el último valor conocido', err.message);
    return factorsCache.data;
  }
}

function addOutcome(tallies, evalType, outcome, probability) {
  if (!evalType || (outcome !== 'hit' && outcome !== 'miss')) return;
  const t = tallies.get(evalType) || { hits: 0, misses: 0, sumProb: 0, count: 0 };
  if (outcome === 'hit') t.hits += 1; else t.misses += 1;
  t.sumProb += probability;
  t.count += 1;
  tallies.set(evalType, t);
}

async function tallyWorldCupForDate(dateIso, tallies) {
  try {
    const matches = await getFinishedMatches();
    for (const m of matches) {
      if (m.date !== dateIso || !m.review) continue;
      for (const item of m.review.items || []) addOutcome(tallies, item.evalType, item.outcome, item.probability);
    }
  } catch (err) {
    console.error('[calibration] barrido del Mundial falló', err.message);
  }
}

async function tallyCompetitionForDate(competition, dateIso, tallies) {
  const raw = competition.provider === 'sofascore'
    ? await loadSofaCompetitionMatches(dateIso, competition.sofaTournamentId, competition.sofaSeasonId)
    : await loadCompetitionMatches(dateIso, competition.espnSlug);

  for (const entry of raw) {
    if (!entry.isFinished) continue;
    const home = resolveTeam(entry.homeName);
    const away = resolveTeam(entry.awayName);
    // Sin factores de calibración aquí a propósito: queremos medir el sesgo
    // de la fórmula base, no perseguir un valor ya corregido.
    const analysis = computePredictions(
      { ...home, ...teamStats(home) },
      { ...away, ...teamStats(away) },
      UNASSIGNED_REFEREE
    );
    const matchResult = {
      homeGoals: entry.homeGoals || 0,
      awayGoals: entry.awayGoals || 0,
      htHomeGoals: entry.htHomeGoals || 0,
      htAwayGoals: entry.htAwayGoals || 0,
    };
    const actualStats = buildActualStats(matchResult, home, away, entry.dateIso, entry.hasStats ? entry : null);
    const review = evaluatePredictions(analysis.probableActions, actualStats);
    for (const item of review.items) addOutcome(tallies, item.evalType, item.outcome, item.probability);
  }
}

async function tallyMarketOutcomesForDate(dateIso) {
  const tallies = new Map();
  await tallyWorldCupForDate(dateIso, tallies);

  const competitions = listAvailableCompetitions();
  for (let i = 0; i < competitions.length; i += COMPETITION_BATCH_SIZE) {
    const batch = competitions.slice(i, i + COMPETITION_BATCH_SIZE);
    await Promise.all(batch.map(async (comp) => {
      try {
        await tallyCompetitionForDate(comp, dateIso, tallies);
      } catch (err) {
        console.error(`[calibration] barrido de "${comp.id}" falló`, err.message);
      }
    }));
  }

  return tallies;
}

async function applyDailyDeltas(deltas) {
  if (!deltas.size) return;
  const existing = await sbGet('market_calibration', '?select=*');
  const byType = new Map(existing.map((r) => [r.market_type, r]));
  const upserts = [];

  for (const [type, delta] of deltas) {
    const row = byType.get(type) || {
      market_type: type, factor: 1, hits: 0, misses: 0, sum_predicted_prob: 0, sample_count: 0, history: [],
    };
    upserts.push({
      market_type: type,
      factor: row.factor,
      hits: row.hits + delta.hits,
      misses: row.misses + delta.misses,
      sum_predicted_prob: Number(row.sum_predicted_prob) + delta.sumProb,
      sample_count: row.sample_count + delta.count,
      history: row.history || [],
    });
  }

  await sbUpsert('market_calibration', upserts, 'market_type');
}

/**
 * Combina el factor anterior con la tasa de acierto real observada (promedio
 * móvil, acotado a [FACTOR_MIN, FACTOR_MAX] para que ningún ciclo mueva la
 * predicción más de ese margen de golpe). Pura para poder testearla sin Supabase.
 */
export function computeNewFactor(oldFactor, hits, misses, sumPredictedProbPct, sampleCount) {
  const actualHitRate = hits / (hits + misses || 1);
  const avgPredicted = (sumPredictedProbPct / sampleCount) / 100;
  const target = avgPredicted > 0 ? actualHitRate / avgPredicted : 1;
  const blended = oldFactor * (1 - EMA_WEIGHT_NEW) + target * EMA_WEIGHT_NEW;
  return Math.min(FACTOR_MAX, Math.max(FACTOR_MIN, blended));
}

/** Recalcula el factor de cada mercado desde lo acumulado y reinicia el contador. */
async function recomputeFactors() {
  const rows = await sbGet('market_calibration', '?select=*');
  const updates = [];
  const summary = [];

  for (const row of rows) {
    if (row.sample_count < MIN_SAMPLES_TO_CALIBRATE) {
      summary.push({ marketType: row.market_type, skipped: true, sampleCount: row.sample_count });
      continue;
    }

    const newFactor = computeNewFactor(row.factor, row.hits, row.misses, Number(row.sum_predicted_prob), row.sample_count);

    const historyEntry = {
      at: new Date().toISOString(),
      oldFactor: row.factor,
      newFactor,
      hits: row.hits,
      misses: row.misses,
      sampleCount: row.sample_count,
    };
    const history = [...(row.history || []), historyEntry].slice(-HISTORY_KEEP);

    updates.push({
      market_type: row.market_type,
      factor: newFactor,
      hits: 0,
      misses: 0,
      sum_predicted_prob: 0,
      sample_count: 0,
      history,
    });
    summary.push({ marketType: row.market_type, oldFactor: row.factor, newFactor, sampleCount: row.sample_count });
  }

  await sbUpsert('market_calibration', updates, 'market_type');
  return summary;
}

/** Punto de entrada del cron diario: suma resultados nuevos y, si toca, recalibra. */
export async function runDailyCalibrationTick() {
  if (!isConfigured()) {
    return { ok: true, skipped: true, reason: 'Supabase no configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' };
  }

  const rows = await sbGet('calibration_state', '?id=eq.1&select=*');
  const state = rows[0] || null;
  const today = getDateISOInColombia();
  const yesterday = addDaysToDateIso(today, -1);

  const bootstrapCursor = addDaysToDateIso(yesterday, -1);
  const cursor = state?.last_scanned_date || bootstrapCursor;

  const datesToScan = [];
  let d = addDaysToDateIso(cursor, 1);
  while (d <= yesterday && datesToScan.length < MAX_CATCHUP_DAYS) {
    datesToScan.push(d);
    d = addDaysToDateIso(d, 1);
  }

  const deltas = new Map();
  for (const dateIso of datesToScan) {
    const dayTallies = await tallyMarketOutcomesForDate(dateIso);
    for (const [type, t] of dayTallies) {
      const acc = deltas.get(type) || { hits: 0, misses: 0, sumProb: 0, count: 0 };
      acc.hits += t.hits;
      acc.misses += t.misses;
      acc.sumProb += t.sumProb;
      acc.count += t.count;
      deltas.set(type, acc);
    }
  }

  await applyDailyDeltas(deltas);

  if (datesToScan.length) {
    await sbPatch('calibration_state', 'id=eq.1', { last_scanned_date: datesToScan[datesToScan.length - 1] });
  }

  // Calibra los lunes (hora Colombia), una sola vez por lunes aunque el cron
  // se dispare más de una vez ese día.
  const lastCalibratedDate = state?.last_calibrated_at
    ? getDateISOInColombia(new Date(state.last_calibrated_at))
    : null;
  const dueForCalibration = isMondayIso(today) && lastCalibratedDate !== today;

  let recalibrated = null;
  if (dueForCalibration) {
    recalibrated = await recomputeFactors();
    await sbPatch('calibration_state', 'id=eq.1', { last_calibrated_at: new Date().toISOString() });
    factorsCache = { at: 0, data: {} };
  }

  return {
    ok: true,
    scannedDates: datesToScan,
    marketsWithNewData: [...deltas.keys()],
    recalibrated,
  };
}
