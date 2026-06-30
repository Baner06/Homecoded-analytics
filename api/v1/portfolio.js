import { analyzePortfolio } from '../../lib/portfolio.js';
import { computeRollover } from '../../lib/rollover.js';
import { validatePortfolioBet, validateRolloverInput } from '../../lib/db/schema.js';
import { getFinishedMatches } from '../../lib/fixtures.js';

export const config = { runtime: 'nodejs' };

const FINISHED_CACHE_MS = 5 * 60 * 1000;
let finishedCache = { at: 0, data: null };

function invalidateFinishedCache() {
  finishedCache = { at: 0, data: null };
}

async function getFinishedCached() {
  const now = Date.now();
  if (finishedCache.data && now - finishedCache.at < FINISHED_CACHE_MS) {
    return finishedCache.data;
  }
  const data = await getFinishedMatches();
  finishedCache = { at: now, data };
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      return res.status(200).json({
        ok: true,
        endpoints: {
          POST: { bets: 'array', rollover: 'optional object' },
        },
      });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (body.refresh || req.query?.refresh === '1') {
      invalidateFinishedCache();
    }
    const bets = Array.isArray(body.bets) ? body.bets.filter(validatePortfolioBet) : [];
    const finished = await getFinishedCached();

    const portfolio = analyzePortfolio(bets, finished);
    let rollover = null;
    if (body.rollover) {
      const input = validateRolloverInput(body.rollover);
      rollover = input ? computeRollover(input) : null;
    }

    return res.status(200).json({
      ok: true,
      source: 'coded-sports-api',
      portfolio,
      rollover,
    });
  } catch (err) {
    console.error('[api/v1/portfolio]', err);
    return res.status(500).json({ ok: false, error: err.message || 'Error portafolio' });
  }
}
