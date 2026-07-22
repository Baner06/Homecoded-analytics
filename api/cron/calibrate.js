import { runDailyCalibrationTick } from '../../lib/calibration.js';

export const config = { runtime: 'nodejs' };

/**
 * Disparado por Vercel Cron (ver "crons" en vercel.json) una vez al día.
 * La lógica de "cada 14 días" vive dentro de runDailyCalibrationTick():
 * este endpoint solo la ejecuta y reporta qué hizo.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ ok: false, error: 'No autorizado' });
    }
  }

  try {
    const result = await runDailyCalibrationTick();
    return res.status(200).json(result);
  } catch (err) {
    console.error('[api/cron/calibrate]', err);
    return res.status(500).json({ ok: false, error: err.message || 'Error en la calibración' });
  }
}
