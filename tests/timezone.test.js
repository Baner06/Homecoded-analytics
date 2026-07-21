import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDateISOInColombia,
  formatDateLongColombia,
  formatKickoffColombia,
  isSameDayColombia,
  addDaysToDateIso,
  isTodayDateIso,
} from '../lib/timezone.js';

describe('lib/timezone', () => {
  test('getDateISOInColombia returns a YYYY-MM-DD string', () => {
    const iso = getDateISOInColombia(new Date('2026-03-15T04:00:00Z'));
    assert.match(iso, /^\d{4}-\d{2}-\d{2}$/);
  });

  test('getDateISOInColombia shifts a UTC-past-midnight timestamp back to the previous Colombia day', () => {
    // 2026-03-15T03:00:00Z is 2026-03-14T22:00:00 in Bogotá (UTC-5).
    assert.equal(getDateISOInColombia(new Date('2026-03-15T03:00:00Z')), '2026-03-14');
  });

  test('addDaysToDateIso rolls over month and year boundaries', () => {
    assert.equal(addDaysToDateIso('2026-01-31', 1), '2026-02-01');
    assert.equal(addDaysToDateIso('2026-12-31', 1), '2027-01-01');
    assert.equal(addDaysToDateIso('2026-03-01', -1), '2026-02-28');
  });

  test('addDaysToDateIso with 0 days is a no-op', () => {
    assert.equal(addDaysToDateIso('2026-07-21', 0), '2026-07-21');
  });

  test('isSameDayColombia compares a UTC instant against a Colombia-local date', () => {
    assert.equal(isSameDayColombia('2026-03-15T03:00:00Z', '2026-03-14'), true);
    assert.equal(isSameDayColombia('2026-03-15T03:00:00Z', '2026-03-15'), false);
  });

  test('isTodayDateIso matches only the current Colombia date', () => {
    const today = getDateISOInColombia();
    assert.equal(isTodayDateIso(today), true);
    assert.equal(isTodayDateIso(addDaysToDateIso(today, 1)), false);
  });

  test('formatKickoffColombia renders an HH:mm-style local time', () => {
    const label = formatKickoffColombia('2026-03-15T00:30:00Z');
    assert.match(label, /^\d{1,2}:\d{2}\s?(a\.?\s?m\.?|p\.?\s?m\.?)$/i);
  });

  test('formatDateLongColombia capitalizes weekday and month in Spanish', () => {
    const label = formatDateLongColombia(new Date('2026-07-21T12:00:00-05:00'));
    assert.match(label, /^[A-ZÁÉÍÓÚ][a-záéíóú]+, \d{1,2} de [a-záéíóú]+ de \d{4}$/);
  });
});
