import { getKnockoutBracket, invalidateFixturesCache } from '../../lib/fixtures.js';
import { getDateISOInColombia, TIMEZONE } from '../../lib/timezone.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    if (req.query?.refresh === '1') {
      invalidateFixturesCache();
    }

    const payload = await getKnockoutBracket();
    const today = getDateISOInColombia();
    const inKnockout = today >= '2026-06-28';

    res.setHeader(
      'Cache-Control',
      inKnockout
        ? 'public, s-maxage=60, stale-while-revalidate=30'
        : 'public, s-maxage=300, stale-while-revalidate=120'
    );

    return res.status(200).json({
      ...payload,
      timezone: TIMEZONE,
      source: 'homecoded-api',
    });
  } catch (err) {
    console.error('[api/bracket/knockout]', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Error al cargar cuadro eliminatorio',
    });
  }
}
