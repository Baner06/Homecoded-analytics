/** Catálogo de continentes, países y competiciones de clubes (fuera del Mundial 2026). */

export const CONTINENTS = [
  { id: 'sudamerica', name: 'Sudamérica', available: true },
  { id: 'europa', name: 'Europa', available: false },
  { id: 'norteamerica', name: 'Norte y Centroamérica', available: false },
  { id: 'africa', name: 'África', available: false },
  { id: 'asia', name: 'Asia', available: false },
  { id: 'oceania', name: 'Oceanía', available: false },
];

export const COUNTRIES = [
  { code: 'arg', continent: 'sudamerica', name: 'Argentina', iso: 'ar' },
  { code: 'bol', continent: 'sudamerica', name: 'Bolivia', iso: 'bo' },
  { code: 'bra', continent: 'sudamerica', name: 'Brasil', iso: 'br' },
  { code: 'chi', continent: 'sudamerica', name: 'Chile', iso: 'cl' },
  { code: 'col', continent: 'sudamerica', name: 'Colombia', iso: 'co' },
  { code: 'ecu', continent: 'sudamerica', name: 'Ecuador', iso: 'ec' },
  { code: 'par', continent: 'sudamerica', name: 'Paraguay', iso: 'py' },
  { code: 'per', continent: 'sudamerica', name: 'Perú', iso: 'pe' },
  { code: 'uru', continent: 'sudamerica', name: 'Uruguay', iso: 'uy' },
  { code: 'ven', continent: 'sudamerica', name: 'Venezuela', iso: 've' },
];

/**
 * tier: 'top' | 'second' | 'cup'
 * espnSlug: null hasta confirmar cobertura real en ESPN (site.api.espn.com).
 * available: solo true cuando hay espnSlug confirmado y probado (Fase 1: las 10 ligas top).
 */
export const COMPETITIONS = [
  // Argentina
  { id: 'arg-top', countryCode: 'arg', tier: 'top', officialName: 'Liga Profesional de Fútbol', espnSlug: 'arg.1', available: true },
  { id: 'arg-second', countryCode: 'arg', tier: 'second', officialName: 'Primera Nacional', espnSlug: null, available: false },
  { id: 'arg-cup', countryCode: 'arg', tier: 'cup', officialName: 'Copa Argentina', espnSlug: 'arg.copa', available: false },
  // Bolivia
  { id: 'bol-top', countryCode: 'bol', tier: 'top', officialName: 'División Profesional', espnSlug: 'bol.1', available: true },
  { id: 'bol-second', countryCode: 'bol', tier: 'second', officialName: 'Copa Simón Bolívar', espnSlug: null, available: false },
  { id: 'bol-cup', countryCode: 'bol', tier: 'cup', officialName: 'Copa Bolivia', espnSlug: null, available: false },
  // Brasil
  { id: 'bra-top', countryCode: 'bra', tier: 'top', officialName: 'Campeonato Brasileiro Série A', espnSlug: 'bra.1', available: true },
  { id: 'bra-second', countryCode: 'bra', tier: 'second', officialName: 'Campeonato Brasileiro Série B', espnSlug: 'bra.2', available: false },
  { id: 'bra-cup', countryCode: 'bra', tier: 'cup', officialName: 'Copa do Brasil', espnSlug: 'bra.copa_do_brazil', available: false },
  // Chile
  { id: 'chi-top', countryCode: 'chi', tier: 'top', officialName: 'Liga de Primera', espnSlug: 'chi.1', available: true },
  { id: 'chi-second', countryCode: 'chi', tier: 'second', officialName: 'Primera B de Chile', espnSlug: null, available: false },
  { id: 'chi-cup', countryCode: 'chi', tier: 'cup', officialName: 'Copa Chile', espnSlug: null, available: false },
  // Colombia
  { id: 'col-top', countryCode: 'col', tier: 'top', officialName: 'Categoría Primera A', espnSlug: 'col.1', available: true },
  { id: 'col-second', countryCode: 'col', tier: 'second', officialName: 'Categoría Primera B', espnSlug: 'col.2', available: false },
  { id: 'col-cup', countryCode: 'col', tier: 'cup', officialName: 'Copa Colombia', espnSlug: null, available: false },
  // Ecuador
  { id: 'ecu-top', countryCode: 'ecu', tier: 'top', officialName: 'Serie A de Ecuador', espnSlug: 'ecu.1', available: true },
  { id: 'ecu-second', countryCode: 'ecu', tier: 'second', officialName: 'Serie B de Ecuador', espnSlug: null, available: false },
  { id: 'ecu-cup', countryCode: 'ecu', tier: 'cup', officialName: 'Copa Ecuador', espnSlug: null, available: false },
  // Paraguay
  { id: 'par-top', countryCode: 'par', tier: 'top', officialName: 'Primera División de Paraguay', espnSlug: 'par.1', available: true },
  { id: 'par-second', countryCode: 'par', tier: 'second', officialName: 'División Intermedia', espnSlug: null, available: false },
  { id: 'par-cup', countryCode: 'par', tier: 'cup', officialName: 'Copa Paraguay', espnSlug: null, available: false },
  // Perú
  { id: 'per-top', countryCode: 'per', tier: 'top', officialName: 'Liga 1', espnSlug: 'per.1', available: true },
  { id: 'per-second', countryCode: 'per', tier: 'second', officialName: 'Liga 2', espnSlug: null, available: false },
  { id: 'per-cup', countryCode: 'per', tier: 'cup', officialName: 'Copa de la Liga', espnSlug: null, available: false },
  // Uruguay
  { id: 'uru-top', countryCode: 'uru', tier: 'top', officialName: 'Liga AUF Uruguaya', espnSlug: 'uru.1', available: true },
  { id: 'uru-second', countryCode: 'uru', tier: 'second', officialName: 'Campeonato Uruguayo de Segunda División', espnSlug: null, available: false },
  { id: 'uru-cup', countryCode: 'uru', tier: 'cup', officialName: 'Copa AUF Uruguay', espnSlug: null, available: false },
  // Venezuela
  { id: 'ven-top', countryCode: 'ven', tier: 'top', officialName: 'Liga FUTVE', espnSlug: 'ven.1', available: true },
  { id: 'ven-second', countryCode: 'ven', tier: 'second', officialName: 'Segunda División de Venezuela', espnSlug: null, available: false },
  { id: 'ven-cup', countryCode: 'ven', tier: 'cup', officialName: 'Copa Venezuela', espnSlug: null, available: false },
];

const TIER_LABEL = { top: 'Primera división', second: 'Segunda división', cup: 'Copa nacional' };

export function getCompetition(id) {
  return COMPETITIONS.find((c) => c.id === id) || null;
}

export function getCountry(code) {
  return COUNTRIES.find((c) => c.code === code) || null;
}

export function listAvailableCompetitions(tier) {
  return COMPETITIONS.filter((c) => c.available && (!tier || c.tier === tier));
}

/** Árbol continente -> países -> competiciones, para el menú y /api/leagues/catalog. */
export function buildCatalogTree() {
  return CONTINENTS.map((continent) => ({
    id: continent.id,
    name: continent.name,
    available: continent.available,
    countries: COUNTRIES.filter((c) => c.continent === continent.id).map((country) => ({
      code: country.code,
      name: country.name,
      iso: country.iso,
      competitions: COMPETITIONS
        .filter((c) => c.countryCode === country.code)
        .map((c) => ({
          id: c.id,
          tier: c.tier,
          tierLabel: TIER_LABEL[c.tier],
          officialName: c.officialName,
          available: c.available,
        })),
    })),
  }));
}
