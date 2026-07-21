/** Catálogo de continentes, países y competiciones de clubes (fuera del Mundial 2026). */

export const CONTINENTS = [
  { id: 'sudamerica', name: 'Sudamérica', available: true },
  { id: 'europa', name: 'Europa', available: true },
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
  // Europa (Fase 1: 18 países con al menos primera división confirmada en ESPN)
  { code: 'eng', continent: 'europa', name: 'Inglaterra', iso: 'gb-eng' },
  { code: 'esp', continent: 'europa', name: 'España', iso: 'es' },
  { code: 'ita', continent: 'europa', name: 'Italia', iso: 'it' },
  { code: 'ger', continent: 'europa', name: 'Alemania', iso: 'de' },
  { code: 'fra', continent: 'europa', name: 'Francia', iso: 'fr' },
  { code: 'por', continent: 'europa', name: 'Portugal', iso: 'pt' },
  { code: 'ned', continent: 'europa', name: 'Países Bajos', iso: 'nl' },
  { code: 'bel', continent: 'europa', name: 'Bélgica', iso: 'be' },
  { code: 'tur', continent: 'europa', name: 'Turquía', iso: 'tr' },
  { code: 'sco', continent: 'europa', name: 'Escocia', iso: 'gb-sct' },
  { code: 'sui', continent: 'europa', name: 'Suiza', iso: 'ch' },
  { code: 'aut', continent: 'europa', name: 'Austria', iso: 'at' },
  { code: 'gre', continent: 'europa', name: 'Grecia', iso: 'gr' },
  { code: 'den', continent: 'europa', name: 'Dinamarca', iso: 'dk' },
  { code: 'swe', continent: 'europa', name: 'Suecia', iso: 'se' },
  { code: 'nor', continent: 'europa', name: 'Noruega', iso: 'no' },
  { code: 'cze', continent: 'europa', name: 'República Checa', iso: 'cz' },
  { code: 'rus', continent: 'europa', name: 'Rusia', iso: 'ru' },
];

/**
 * tier: 'top' | 'second' | 'cup'
 * espnSlug: null hasta confirmar cobertura real en ESPN (site.api.espn.com).
 * available: solo true cuando hay espnSlug confirmado y probado (Fase 1: las 10 ligas top).
 */
export const COMPETITIONS = [
  // Argentina
  { id: 'arg-top', countryCode: 'arg', tier: 'top', officialName: 'Liga Profesional de Fútbol', espnSlug: 'arg.1', available: true },
  { id: 'arg-second', countryCode: 'arg', tier: 'second', officialName: 'Primera Nacional', espnSlug: 'arg.2', available: true },
  { id: 'arg-cup', countryCode: 'arg', tier: 'cup', officialName: 'Copa Argentina', espnSlug: 'arg.copa', available: true },
  // Bolivia
  { id: 'bol-top', countryCode: 'bol', tier: 'top', officialName: 'División Profesional', espnSlug: 'bol.1', available: true },
  { id: 'bol-second', countryCode: 'bol', tier: 'second', officialName: 'Copa Simón Bolívar', espnSlug: null, available: false },
  { id: 'bol-cup', countryCode: 'bol', tier: 'cup', officialName: 'Copa Bolivia', espnSlug: 'bol.copa', available: true },
  // Brasil
  { id: 'bra-top', countryCode: 'bra', tier: 'top', officialName: 'Campeonato Brasileiro Série A', espnSlug: 'bra.1', available: true },
  { id: 'bra-second', countryCode: 'bra', tier: 'second', officialName: 'Campeonato Brasileiro Série B', espnSlug: 'bra.2', available: true },
  { id: 'bra-cup', countryCode: 'bra', tier: 'cup', officialName: 'Copa do Brasil', espnSlug: 'bra.copa_do_brazil', available: true },
  // Chile
  { id: 'chi-top', countryCode: 'chi', tier: 'top', officialName: 'Liga de Primera', espnSlug: 'chi.1', available: true },
  { id: 'chi-second', countryCode: 'chi', tier: 'second', officialName: 'Primera B de Chile', espnSlug: 'chi.2', available: true },
  { id: 'chi-cup', countryCode: 'chi', tier: 'cup', officialName: 'Copa Chile', espnSlug: 'chi.copa_chi', available: true },
  // Colombia
  { id: 'col-top', countryCode: 'col', tier: 'top', officialName: 'Categoría Primera A', espnSlug: 'col.1', available: true },
  { id: 'col-second', countryCode: 'col', tier: 'second', officialName: 'Categoría Primera B', espnSlug: 'col.2', available: true },
  { id: 'col-cup', countryCode: 'col', tier: 'cup', officialName: 'Copa Colombia', espnSlug: 'col.copa', available: true },
  // Ecuador
  { id: 'ecu-top', countryCode: 'ecu', tier: 'top', officialName: 'Serie A de Ecuador', espnSlug: 'ecu.1', available: true },
  { id: 'ecu-second', countryCode: 'ecu', tier: 'second', officialName: 'Serie B de Ecuador', espnSlug: 'ecu.2', available: true },
  { id: 'ecu-cup', countryCode: 'ecu', tier: 'cup', officialName: 'Copa Ecuador', espnSlug: null, provider: 'sofascore', sofaTournamentId: 13684, sofaSeasonId: 92671, available: true },
  // Paraguay
  { id: 'par-top', countryCode: 'par', tier: 'top', officialName: 'Primera División de Paraguay', espnSlug: 'par.1', available: true },
  { id: 'par-second', countryCode: 'par', tier: 'second', officialName: 'División Intermedia', espnSlug: 'par.2', available: true },
  { id: 'par-cup', countryCode: 'par', tier: 'cup', officialName: 'Copa Paraguay', espnSlug: null, provider: 'sofascore', sofaTournamentId: 13614, sofaSeasonId: 98037, available: true },
  // Perú
  { id: 'per-top', countryCode: 'per', tier: 'top', officialName: 'Liga 1', espnSlug: 'per.1', available: true },
  { id: 'per-second', countryCode: 'per', tier: 'second', officialName: 'Liga 2', espnSlug: 'per.2', available: true },
  // Copa Bicentenario (Sofascore id 13685) no juega temporada desde 2021: torneo inactivo, no falta de datos.
  { id: 'per-cup', countryCode: 'per', tier: 'cup', officialName: 'Copa de la Liga', espnSlug: null, available: false },
  // Uruguay
  { id: 'uru-top', countryCode: 'uru', tier: 'top', officialName: 'Liga AUF Uruguaya', espnSlug: 'uru.1', available: true },
  { id: 'uru-second', countryCode: 'uru', tier: 'second', officialName: 'Campeonato Uruguayo de Segunda División', espnSlug: 'uru.2', available: true },
  // Copa Uruguay existe en Sofascore (id 18877) pero aún no tiene temporada 2026 creada; revisar más adelante.
  { id: 'uru-cup', countryCode: 'uru', tier: 'cup', officialName: 'Copa AUF Uruguay', espnSlug: null, available: false },
  // Venezuela
  { id: 'ven-top', countryCode: 'ven', tier: 'top', officialName: 'Liga FUTVE', espnSlug: 'ven.1', available: true },
  { id: 'ven-second', countryCode: 'ven', tier: 'second', officialName: 'Segunda División de Venezuela', espnSlug: 'ven.2', available: true },
  { id: 'ven-cup', countryCode: 'ven', tier: 'cup', officialName: 'Copa Venezuela', espnSlug: null, provider: 'sofascore', sofaTournamentId: 10528, sofaSeasonId: 96884, available: true },

  // Europa (Fase 1)
  // Inglaterra
  { id: 'eng-top', countryCode: 'eng', tier: 'top', officialName: 'Premier League', espnSlug: 'eng.1', available: true },
  { id: 'eng-second', countryCode: 'eng', tier: 'second', officialName: 'EFL Championship', espnSlug: 'eng.2', available: true },
  { id: 'eng-cup', countryCode: 'eng', tier: 'cup', officialName: 'FA Cup', espnSlug: 'eng.fa', available: true },
  // España
  { id: 'esp-top', countryCode: 'esp', tier: 'top', officialName: 'LaLiga', espnSlug: 'esp.1', available: true },
  { id: 'esp-second', countryCode: 'esp', tier: 'second', officialName: 'LaLiga 2', espnSlug: 'esp.2', available: true },
  { id: 'esp-cup', countryCode: 'esp', tier: 'cup', officialName: 'Copa del Rey', espnSlug: 'esp.copa_del_rey', available: true },
  // Italia
  { id: 'ita-top', countryCode: 'ita', tier: 'top', officialName: 'Serie A', espnSlug: 'ita.1', available: true },
  { id: 'ita-second', countryCode: 'ita', tier: 'second', officialName: 'Serie B', espnSlug: 'ita.2', available: true },
  { id: 'ita-cup', countryCode: 'ita', tier: 'cup', officialName: 'Coppa Italia', espnSlug: 'ita.coppa_italia', available: true },
  // Alemania
  { id: 'ger-top', countryCode: 'ger', tier: 'top', officialName: 'Bundesliga', espnSlug: 'ger.1', available: true },
  { id: 'ger-second', countryCode: 'ger', tier: 'second', officialName: '2. Bundesliga', espnSlug: 'ger.2', available: true },
  { id: 'ger-cup', countryCode: 'ger', tier: 'cup', officialName: 'DFB-Pokal', espnSlug: 'ger.dfb_pokal', available: true },
  // Francia
  { id: 'fra-top', countryCode: 'fra', tier: 'top', officialName: 'Ligue 1', espnSlug: 'fra.1', available: true },
  { id: 'fra-second', countryCode: 'fra', tier: 'second', officialName: 'Ligue 2', espnSlug: 'fra.2', available: true },
  { id: 'fra-cup', countryCode: 'fra', tier: 'cup', officialName: 'Copa de Francia', espnSlug: 'fra.coupe_de_france', available: true },
  // Portugal
  { id: 'por-top', countryCode: 'por', tier: 'top', officialName: 'Primeira Liga', espnSlug: 'por.1', available: true },
  { id: 'por-second', countryCode: 'por', tier: 'second', officialName: 'Liga Portugal 2', espnSlug: null, available: false },
  { id: 'por-cup', countryCode: 'por', tier: 'cup', officialName: 'Taça de Portugal', espnSlug: 'por.taca.portugal', available: true },
  // Países Bajos
  { id: 'ned-top', countryCode: 'ned', tier: 'top', officialName: 'Eredivisie', espnSlug: 'ned.1', available: true },
  { id: 'ned-second', countryCode: 'ned', tier: 'second', officialName: 'Eerste Divisie', espnSlug: 'ned.2', available: true },
  { id: 'ned-cup', countryCode: 'ned', tier: 'cup', officialName: 'Copa KNVB', espnSlug: 'ned.cup', available: true },
  // Bélgica
  { id: 'bel-top', countryCode: 'bel', tier: 'top', officialName: 'Pro League', espnSlug: 'bel.1', available: true },
  { id: 'bel-second', countryCode: 'bel', tier: 'second', officialName: 'Challenger Pro League', espnSlug: null, available: false },
  { id: 'bel-cup', countryCode: 'bel', tier: 'cup', officialName: 'Copa de Bélgica', espnSlug: null, available: false },
  // Turquía
  { id: 'tur-top', countryCode: 'tur', tier: 'top', officialName: 'Süper Lig', espnSlug: 'tur.1', available: true },
  { id: 'tur-second', countryCode: 'tur', tier: 'second', officialName: '1. Lig', espnSlug: 'tur.2', available: true },
  { id: 'tur-cup', countryCode: 'tur', tier: 'cup', officialName: 'Copa de Turquía', espnSlug: null, available: false },
  // Escocia
  { id: 'sco-top', countryCode: 'sco', tier: 'top', officialName: 'Premiership', espnSlug: 'sco.1', available: true },
  { id: 'sco-second', countryCode: 'sco', tier: 'second', officialName: 'Championship', espnSlug: 'sco.2', available: true },
  { id: 'sco-cup', countryCode: 'sco', tier: 'cup', officialName: 'Copa de Escocia', espnSlug: 'sco.tennents', available: true },
  // Suiza
  { id: 'sui-top', countryCode: 'sui', tier: 'top', officialName: 'Super League', espnSlug: 'sui.1', available: true },
  { id: 'sui-second', countryCode: 'sui', tier: 'second', officialName: 'Challenge League', espnSlug: 'sui.2', available: true },
  { id: 'sui-cup', countryCode: 'sui', tier: 'cup', officialName: 'Copa de Suiza', espnSlug: null, available: false },
  // Austria
  { id: 'aut-top', countryCode: 'aut', tier: 'top', officialName: 'Bundesliga', espnSlug: 'aut.1', available: true },
  { id: 'aut-second', countryCode: 'aut', tier: 'second', officialName: '2. Liga', espnSlug: 'aut.2', available: true },
  { id: 'aut-cup', countryCode: 'aut', tier: 'cup', officialName: 'Copa de Austria', espnSlug: null, available: false },
  // Grecia
  { id: 'gre-top', countryCode: 'gre', tier: 'top', officialName: 'Super League', espnSlug: 'gre.1', available: true },
  { id: 'gre-second', countryCode: 'gre', tier: 'second', officialName: 'Super League 2', espnSlug: null, available: false },
  { id: 'gre-cup', countryCode: 'gre', tier: 'cup', officialName: 'Copa de Grecia', espnSlug: null, available: false },
  // Dinamarca
  { id: 'den-top', countryCode: 'den', tier: 'top', officialName: 'Superliga', espnSlug: 'den.1', available: true },
  { id: 'den-second', countryCode: 'den', tier: 'second', officialName: '1. Division', espnSlug: 'den.2', available: true },
  { id: 'den-cup', countryCode: 'den', tier: 'cup', officialName: 'Copa de Dinamarca', espnSlug: null, available: false },
  // Suecia
  { id: 'swe-top', countryCode: 'swe', tier: 'top', officialName: 'Allsvenskan', espnSlug: 'swe.1', available: true },
  { id: 'swe-second', countryCode: 'swe', tier: 'second', officialName: 'Superettan', espnSlug: 'swe.2', available: true },
  { id: 'swe-cup', countryCode: 'swe', tier: 'cup', officialName: 'Copa de Suecia', espnSlug: null, available: false },
  // Noruega
  { id: 'nor-top', countryCode: 'nor', tier: 'top', officialName: 'Eliteserien', espnSlug: 'nor.1', available: true },
  { id: 'nor-second', countryCode: 'nor', tier: 'second', officialName: '1. Division', espnSlug: 'nor.2', available: true },
  { id: 'nor-cup', countryCode: 'nor', tier: 'cup', officialName: 'Copa de Noruega', espnSlug: null, available: false },
  // República Checa
  { id: 'cze-top', countryCode: 'cze', tier: 'top', officialName: 'Chance Liga', espnSlug: 'cze.1', available: true },
  { id: 'cze-second', countryCode: 'cze', tier: 'second', officialName: 'FNL', espnSlug: null, available: false },
  { id: 'cze-cup', countryCode: 'cze', tier: 'cup', officialName: 'Copa de República Checa', espnSlug: null, available: false },
  // Rusia
  { id: 'rus-top', countryCode: 'rus', tier: 'top', officialName: 'Liga Premier', espnSlug: 'rus.1', available: true },
  { id: 'rus-second', countryCode: 'rus', tier: 'second', officialName: 'Liga Nacional de Fútbol', espnSlug: null, available: false },
  { id: 'rus-cup', countryCode: 'rus', tier: 'cup', officialName: 'Copa de Rusia', espnSlug: null, available: false },
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

/** Árbol continente -> países -> competiciones, para el menú y /api/leagues?action=catalog. */
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
