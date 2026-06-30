import { loadCatalog } from '../../lib/db/catalog.js';
import { TABLES } from '../../lib/db/schema.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const catalog = await loadCatalog();
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json({
      ok: true,
      source: 'coded-sports-api',
      schema: TABLES,
      ...catalog,
    });
  } catch (err) {
    console.error('[api/v1/teams]', err);
    return res.status(500).json({ ok: false, error: err.message || 'Error catálogo' });
  }
}
