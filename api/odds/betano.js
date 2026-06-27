import { resolveBetanoOddsBatch } from '../../lib/betanoOdds.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  }

  try {
    let bets = [];
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      bets = Array.isArray(body?.bets) ? body.bets : [];
    } else if (req.query?.bets) {
      bets = JSON.parse(decodeURIComponent(req.query.bets));
    }

    if (!bets.length) {
      return res.status(400).json({ ok: false, error: 'Se requiere al menos una apuesta' });
    }

    const odds = resolveBetanoOddsBatch(bets);

    return res.status(200).json({
      ok: true,
      provider: 'HomeCoded Betano Reference',
      disclaimer: 'Cuotas Betano de referencia. No influyen en las predicciones del modelo.',
      refreshSeconds: 600,
      odds,
    });
  } catch (err) {
    console.error('[api/odds/betano]', err);
    return res.status(500).json({ ok: false, error: err.message || 'Error al obtener cuotas' });
  }
}
