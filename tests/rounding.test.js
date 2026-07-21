import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  roundBettingLine,
  displayBettingLine,
  formatBettingLine,
  roundPercent,
  conservativeOverLine,
  cornerOverLine,
} from '../lib/rounding.js';

describe('lib/rounding', () => {
  test('roundBettingLine snaps < .25 down to the integer', () => {
    assert.equal(roundBettingLine(5.1), 5);
    assert.equal(roundBettingLine(5.24), 5);
  });

  test('roundBettingLine snaps > .75 up to the next integer', () => {
    assert.equal(roundBettingLine(5.76), 6);
    assert.equal(roundBettingLine(5.99), 6);
  });

  test('roundBettingLine snaps the middle band to +0.5', () => {
    assert.equal(roundBettingLine(5.25), 5.5);
    assert.equal(roundBettingLine(5.4), 5.5);
    assert.equal(roundBettingLine(5.75), 5.5);
  });

  test('roundBettingLine falls back to 0 for non-finite input', () => {
    assert.equal(roundBettingLine(NaN), 0);
    assert.equal(roundBettingLine(undefined), 0);
    assert.equal(roundBettingLine('not a number'), 0);
  });

  test('displayBettingLine rewrites a bare "1" line as 0.5', () => {
    // roundBettingLine(0.9) -> 1, but a betting line of exactly 1 goal reads as 0.5 to bettors.
    assert.equal(displayBettingLine(0.9), 0.5);
    assert.equal(displayBettingLine(2.4), 2.5);
  });

  test('formatBettingLine prints integers without a decimal and halves with one', () => {
    assert.equal(formatBettingLine(2.1), '2');
    assert.equal(formatBettingLine(2.4), '2.5');
  });

  test('roundPercent rounds to the nearest whole percent and defaults falsy input to 0', () => {
    assert.equal(roundPercent(54.6), 55);
    assert.equal(roundPercent(undefined), 0);
  });

  test('conservativeOverLine steps one goal below the projection, floored at 0.5', () => {
    assert.equal(conservativeOverLine(3.2), 1.5);
    assert.equal(conservativeOverLine(0.2), 0.5);
  });

  test('cornerOverLine steps half a corner below the projection, floored at 0.5', () => {
    assert.equal(cornerOverLine(8), 7.5);
    assert.equal(cornerOverLine(0.2), 0.5);
  });
});
