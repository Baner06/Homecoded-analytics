import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTINENTS,
  COUNTRIES,
  COMPETITIONS,
  getCompetition,
  getCountry,
  listAvailableCompetitions,
  buildCatalogTree,
} from '../lib/competitions.js';

describe('lib/competitions catalog integrity', () => {
  test('continent ids are unique', () => {
    const ids = CONTINENTS.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('country codes are unique', () => {
    const codes = COUNTRIES.map((c) => c.code);
    assert.equal(new Set(codes).size, codes.length);
  });

  test('competition ids are unique', () => {
    const ids = COMPETITIONS.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('every country belongs to a real continent', () => {
    const continentIds = new Set(CONTINENTS.map((c) => c.id));
    for (const country of COUNTRIES) {
      assert.ok(
        continentIds.has(country.continent),
        `country "${country.code}" references unknown continent "${country.continent}"`
      );
    }
  });

  test('every competition belongs to a real country', () => {
    const countryCodes = new Set(COUNTRIES.map((c) => c.code));
    for (const comp of COMPETITIONS) {
      assert.ok(
        countryCodes.has(comp.countryCode),
        `competition "${comp.id}" references unknown country "${comp.countryCode}"`
      );
    }
  });

  test('every real country has a two-letter (or gb-xxx style) iso code for the flag CDN', () => {
    for (const country of COUNTRIES) {
      if (country.iso === null) continue; // pseudo-country (confederation grouping), see next test
      assert.match(
        country.iso,
        /^[a-z]{2}(-[a-z]{3})?$/,
        `country "${country.code}" has a malformed iso "${country.iso}"`
      );
    }
  });

  test('every pseudo-country (iso: null) has a flagEmoji fallback for the menu', () => {
    for (const country of COUNTRIES) {
      if (country.iso !== null) continue;
      assert.ok(
        country.flagEmoji,
        `pseudo-country "${country.code}" has no flagEmoji fallback`
      );
    }
  });

  test('every available competition has a usable data source', () => {
    for (const comp of COMPETITIONS) {
      if (!comp.available) continue;
      const hasSource = comp.provider === 'sofascore'
        ? Boolean(comp.sofaTournamentId && comp.sofaSeasonId)
        : Boolean(comp.espnSlug);
      assert.ok(hasSource, `competition "${comp.id}" is available but has no data source`);
    }
  });

  test('every competition tier is one of the known values', () => {
    for (const comp of COMPETITIONS) {
      assert.ok(
        ['top', 'second', 'cup', 'continental'].includes(comp.tier),
        `competition "${comp.id}" has unknown tier "${comp.tier}"`
      );
    }
  });

  test('getCompetition finds a known id and returns null for an unknown one', () => {
    assert.equal(getCompetition('mex-top')?.officialName, 'Liga MX');
    assert.equal(getCompetition('does-not-exist'), null);
  });

  test('getCountry finds a known code and returns null for an unknown one', () => {
    assert.equal(getCountry('jpn')?.name, 'Japón');
    assert.equal(getCountry('xx'), null);
  });

  test('listAvailableCompetitions only returns available competitions', () => {
    const available = listAvailableCompetitions();
    assert.ok(available.length > 0);
    assert.ok(available.every((c) => c.available));
  });

  test('listAvailableCompetitions can filter by tier', () => {
    const cups = listAvailableCompetitions('cup');
    assert.ok(cups.length > 0);
    assert.ok(cups.every((c) => c.tier === 'cup' && c.available));
  });
});

describe('buildCatalogTree', () => {
  const tree = buildCatalogTree();

  test('has one entry per continent, in the same order as CONTINENTS', () => {
    assert.deepEqual(tree.map((c) => c.id), CONTINENTS.map((c) => c.id));
  });

  test('every country in the tree lists all of its competitions', () => {
    for (const continent of tree) {
      for (const country of continent.countries) {
        const expected = COMPETITIONS.filter((c) => c.countryCode === country.code).length;
        assert.equal(country.competitions.length, expected);
      }
    }
  });

  test('tierLabel matches the Spanish label for each tier', () => {
    const labelByTier = { top: 'Primera división', second: 'Segunda división', cup: 'Copa nacional', continental: 'Torneo internacional' };
    for (const continent of tree) {
      for (const country of continent.countries) {
        for (const comp of country.competitions) {
          assert.equal(comp.tierLabel, labelByTier[comp.tier]);
        }
      }
    }
  });

  test('a disabled continent (Oceanía) still reports its available flag', () => {
    const oceania = tree.find((c) => c.id === 'oceania');
    assert.ok(oceania);
    assert.equal(oceania.available, false);
  });
});
