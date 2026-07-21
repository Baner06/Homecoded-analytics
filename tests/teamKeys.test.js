import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalTeamKey, teamPairKey, sameTeam, orientLiveFeedToFixture } from '../lib/teamKeys.js';

describe('lib/teamKeys', () => {
  test('canonicalTeamKey is stable across the English/Spanish aliases of a World Cup team', () => {
    assert.equal(canonicalTeamKey('Mexico'), canonicalTeamKey('México'));
    assert.equal(canonicalTeamKey('South Korea'), canonicalTeamKey('Corea del Sur'));
  });

  test('sameTeam treats aliases of the same team as equal', () => {
    assert.equal(sameTeam('USA', 'Estados Unidos'), true);
    assert.equal(sameTeam('Mexico', 'Brazil'), false);
  });

  test('teamPairKey is independent of home/away order', () => {
    const a = teamPairKey('2026-07-21', 'Mexico', 'Brazil');
    const b = teamPairKey('2026-07-21', 'Brazil', 'Mexico');
    assert.equal(a, b);
  });

  test('teamPairKey differs by date for the same matchup', () => {
    const a = teamPairKey('2026-07-21', 'Mexico', 'Brazil');
    const b = teamPairKey('2026-07-22', 'Mexico', 'Brazil');
    assert.notEqual(a, b);
  });

  test('orientLiveFeedToFixture passes through a null feed', () => {
    assert.equal(orientLiveFeedToFixture(null, 'Mexico', 'Brazil'), null);
  });

  test('orientLiveFeedToFixture leaves an already-aligned feed untouched', () => {
    const feed = { homeName: 'Mexico', awayName: 'Brazil', homeGoals: 2, awayGoals: 1 };
    const oriented = orientLiveFeedToFixture(feed, 'Mexico', 'Brazil');
    assert.equal(oriented.homeGoals, 2);
    assert.equal(oriented.awayGoals, 1);
  });

  test('orientLiveFeedToFixture swaps scores when the live feed reports the opposite home/away order', () => {
    const feed = {
      homeName: 'Brazil',
      awayName: 'Mexico',
      homeGoals: 1,
      awayGoals: 2,
      htHomeGoals: 0,
      htAwayGoals: 1,
      homeCorners: 3,
      awayCorners: 5,
    };
    const oriented = orientLiveFeedToFixture(feed, 'Mexico', 'Brazil');
    assert.equal(oriented.homeName, 'Mexico');
    assert.equal(oriented.awayName, 'Brazil');
    assert.equal(oriented.homeGoals, 2);
    assert.equal(oriented.awayGoals, 1);
    assert.equal(oriented.htHomeGoals, 1);
    assert.equal(oriented.htAwayGoals, 0);
    assert.equal(oriented.homeCorners, 5);
    assert.equal(oriented.awayCorners, 3);
  });
});
