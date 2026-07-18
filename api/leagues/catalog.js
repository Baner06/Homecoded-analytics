import { buildCatalogTree } from '../../lib/competitions.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  try {
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=3600');
    return res.status(200).json({
      ok: true,
      source: 'coded-sports-api',
      continents: buildCatalogTree(),
    });
  } catch (err) {
    console.error('[api/leagues/catalog]', err);
    return res.status(500).json({ ok: false, error: err.message || 'Error al cargar catálogo de ligas' });
  }
}
