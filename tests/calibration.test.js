import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeNewFactor, getCalibrationFactors, isMondayIso } from '../lib/calibration.js';

describe('lib/calibration isMondayIso', () => {
  test('recognizes a known Monday', () => {
    assert.equal(isMondayIso('2026-07-27'), true);
  });

  test('rejects the surrounding days', () => {
    assert.equal(isMondayIso('2026-07-26'), false); // domingo
    assert.equal(isMondayIso('2026-07-28'), false); // martes
  });
});

describe('lib/calibration computeNewFactor', () => {
  test('moves the factor up when the market hits more than we predicted', () => {
    // 40 aciertos / 20 fallos = 66.7% real, predijimos 60% en promedio.
    const factor = computeNewFactor(1, 40, 20, 60 * 60, 60);
    assert.ok(factor > 1, `esperaba > 1, dio ${factor}`);
    assert.equal(factor, 1.0555555555555556);
  });

  test('moves the factor down when the market hits less than we predicted', () => {
    // 20 aciertos / 40 fallos = 33.3% real, predijimos 60% en promedio.
    const factor = computeNewFactor(1, 20, 40, 60 * 60, 60);
    assert.ok(factor < 1, `esperaba < 1, dio ${factor}`);
  });

  test('never overshoots FACTOR_MAX even with an extreme observed bias', () => {
    const factor = computeNewFactor(1, 100, 0, 30 * 100, 100);
    assert.ok(factor <= 1.15, `esperaba <= 1.15, dio ${factor}`);
  });

  test('never undershoots FACTOR_MIN even with an extreme observed bias', () => {
    const factor = computeNewFactor(1, 0, 100, 90 * 100, 100);
    assert.ok(factor >= 0.85, `esperaba >= 0.85, dio ${factor}`);
  });

  test('stays put when predicted probability already matches the real hit rate', () => {
    const factor = computeNewFactor(1, 60, 40, 60 * 100, 100);
    assert.equal(factor, 1);
  });

  test('blends toward the target instead of jumping straight to it (EMA)', () => {
    // Con factor previo de 1 y objetivo de ~1.11, el nuevo debe quedar a mitad de camino.
    const factor = computeNewFactor(1, 40, 20, 60 * 60, 60);
    const target = (40 / 60) / 0.6;
    assert.ok(Math.abs(factor - (1 + target) / 2) < 1e-9);
  });
});

describe('lib/calibration getCalibrationFactors', () => {
  // SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY se leen una sola vez al cargar el
  // módulo, así que este test solo es significativo cuando corre sin esas
  // variables definidas (el caso real de "no configurado todavía").
  test('returns {} (no-op) when Supabase env vars are not configured', async () => {
    assert.equal(process.env.SUPABASE_URL, undefined);
    const factors = await getCalibrationFactors();
    assert.deepEqual(factors, {});
  });
});
