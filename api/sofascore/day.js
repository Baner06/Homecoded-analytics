import { loadRefereesForDate } from '../../lib/refereeFeed.js';
import {
  loadSofaRefereesForDate,
  loadSofaStatsForDate,
  SOFA_WC,
} from '../../lib/sofascore.js';

export const config = { runtime: 'nodejs' };

function parseDateParam(value) {
  if (!value || typeof value !== 'string') return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function mapToObject(map) {
  return Object.fromEntries(map.entries());
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=60');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const date = parseDateParam(req.query?.date);
    if (!date) {
      return res.status(400).json({ ok: false, error: 'Parámetro date requerido (YYYY-MM-DD)' });
    }

    const force = req.query?.refresh === '1';
    const [mergedReferees, sofaReferees, sofaStats] = await Promise.all([
      loadRefereesForDate(date, force),
      loadSofaRefereesForDate(date, force),
      loadSofaStatsForDate(date, force),
    ]);

    return res.status(200).json({
      ok: true,
      date,
      tournament: SOFA_WC,
      referees: mapToObject(mergedReferees),
      sofaReferees: mapToObject(sofaReferees),
      stats: mapToObject(sofaStats),
    });
  } catch (err) {
    console.error('[api/sofascore/day]', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Error al cargar datos SofaScore',
    });
  }
}
