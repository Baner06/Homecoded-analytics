import { getMatchById } from '../../../lib/fixtures.js';
import { summarizePredictions, CONFIDENCE_TIERS, ENGINE_SOURCES } from '../../../lib/analyticsMeta.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const matchId = req.query?.matchId || req.query?.id;
    if (!matchId) return res.status(400).json({ ok: false, error: 'matchId requerido' });

    const match = await getMatchById(matchId);
    if (!match) return res.status(404).json({ ok: false, error: 'Partido no encontrado' });

    const summary = summarizePredictions(match);
    if (!summary.ok) {
      return res.status(200).json({
        ok: true,
        pending: true,
        matchId: match.id,
        message: 'Predicciones pendientes hasta confirmar equipos',
      });
    }

    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    return res.status(200).json({
      ok: true,
      source: 'coded-sports-api',
      version: 'v1',
      match: {
        id: match.id,
        date: match.date,
        status: match.status,
        home: match.home.name,
        away: match.away.name,
        stage: match.stageLabel,
      },
      predictions: summary,
      confidenceTiers: CONFIDENCE_TIERS,
      engineSources: ENGINE_SOURCES,
      actions: match.analysis.probableActions,
    });
  } catch (err) {
    console.error('[api/v1/predictions]', err);
    return res.status(500).json({ ok: false, error: err.message || 'Error de predicciones' });
  }
}
