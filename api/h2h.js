import { buildH2hReport } from '../lib/h2h.js';
import { invalidateFixturesCache, invalidateSoftCaches, loadAllFixtures } from '../lib/fixtures.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  try {
    if (req.query?.refresh === '1') {
      invalidateSoftCaches();
      invalidateFixturesCache();
    }

    let home = req.query?.home;
    let away = req.query?.away;
    const fixtures = await loadAllFixtures();

    if (req.query?.matchId) {
      const raw = fixtures.find((f) => f.matchNumber === Number(req.query.matchId));
      if (!raw) return res.status(404).json({ ok: false, error: 'Partido no encontrado' });
      home = raw.homeTeam;
      away = raw.awayTeam;
    }

    if (!home || !away) {
      return res.status(400).json({ ok: false, error: 'Usa matchId o home+away' });
    }
    const report = buildH2hReport(fixtures, home, away);
    if (!report.ok) return res.status(400).json(report);

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ ok: true, source: 'coded-sports-api', ...report });
  } catch (err) {
    console.error('[api/h2h]', err);
    return res.status(500).json({ ok: false, error: err.message || 'Error H2H' });
  }
}
