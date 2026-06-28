import { teamPairKey } from './teamKeys.js';

const FIFA_MATCHES_URL = 'https://api.fifa.com/api/v3/calendar/matches?language=en&count=500&idSeason=285023&idCompetition=17';
const CACHE_MS = 5 * 60 * 1000;
const FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'HomeCoded-Analytics/1.0',
};

const FIFA_COUNTRY = {
  POR: 'Portugal',
  BRA: 'Brasil',
  ENG: 'Inglaterra',
  FRA: 'Francia',
  GER: 'Alemania',
  ESP: 'España',
  ITA: 'Italia',
  POL: 'Polonia',
  NED: 'Países Bajos',
  BEL: 'Bélgica',
  USA: 'Estados Unidos',
  MEX: 'México',
  CAN: 'Canadá',
  ARG: 'Argentina',
  URU: 'Uruguay',
  CHI: 'Chile',
  COL: 'Colombia',
  ECU: 'Ecuador',
  PAR: 'Paraguay',
  JOR: 'Jordania',
  QAT: 'Qatar',
  KSA: 'Arabia Saudita',
  IRN: 'Irán',
  JPN: 'Japón',
  KOR: 'Corea del Sur',
  CHN: 'China',
  AUS: 'Australia',
  NZL: 'Nueva Zelanda',
  RSA: 'Sudáfrica',
  MAR: 'Marruecos',
  EGY: 'Egipto',
  SEN: 'Senegal',
  GHA: 'Ghana',
  NGA: 'Nigeria',
  ALG: 'Argelia',
  TUN: 'Túnez',
  CIV: 'Costa de Marfil',
  COD: 'RD Congo',
  SLO: 'Eslovenia',
  ROU: 'Rumania',
  SWE: 'Suecia',
  NOR: 'Noruega',
  SUI: 'Suiza',
  AUT: 'Austria',
  CRO: 'Croacia',
  SRB: 'Serbia',
  UKR: 'Ucrania',
  UZB: 'Uzbekistán',
  UAE: 'Emiratos Árabes Unidos',
  MAS: 'Malasia',
  BEN: 'Benín',
  MTN: 'Mauritania',
  CPV: 'Cabo Verde',
  PAN: 'Panamá',
  CRC: 'Costa Rica',
  HAI: 'Haití',
  JAM: 'Jamaica',
  SLV: 'El Salvador',
  VEN: 'Venezuela',
  PER: 'Perú',
  BIH: 'Bosnia y Herzegovina',
  CZE: 'República Checa',
  SCO: 'Escocia',
  WAL: 'Gales',
  IRL: 'Irlanda',
  DEN: 'Dinamarca',
  FIN: 'Finlandia',
  ISL: 'Islandia',
  GRE: 'Grecia',
  TUR: 'Turquía',
  HUN: 'Hungría',
  SVK: 'Eslovaquia',
  BUL: 'Bulgaria',
  GEO: 'Georgia',
  ARM: 'Armenia',
  AZE: 'Azerbaiyán',
  KAZ: 'Kazajistán',
  IRQ: 'Irak',
  OMA: 'Omán',
  BHR: 'Baréin',
  KUW: 'Kuwait',
  IDN: 'Indonesia',
  THA: 'Tailandia',
  VIE: 'Vietnam',
  IND: 'India',
};

const FIFA_TEAM_ALIASES = {
  'ir iran': 'Iran',
  'cote d\'ivoire': 'Ivory Coast',
  'congo dr': 'DR Congo',
  'korea republic': 'South Korea',
  'cape verde': 'Cape Verde',
  'czechia': 'Czech Republic',
  usa: 'United States',
  turkiye: 'Turkey',
};

let cache = { at: 0, byMatchNumber: new Map(), byPairKey: new Map() };

function fifaTeamName(raw) {
  const name = raw?.TeamName?.[0]?.Description || raw?.ShortClubName || '';
  const key = name.toLowerCase().trim();
  return FIFA_TEAM_ALIASES[key] || name;
}

function matchDateIso(match) {
  if (!match?.Date) return null;
  return String(match.Date).slice(0, 10);
}

function parseMainOfficial(match) {
  const officials = match?.Officials || [];
  const main = officials.find((o) => o.OfficialType === 1);
  if (!main?.Name?.[0]?.Description) return null;

  const countryCode = main.IdCountry || '';
  return {
    name: main.Name[0].Description,
    country: FIFA_COUNTRY[countryCode] || countryCode || 'Internacional',
    source: 'fifa',
    verified: true,
    conflict: false,
  };
}

async function loadFifaMatches() {
  const now = Date.now();
  if (cache.at && now - cache.at < CACHE_MS && cache.byMatchNumber.size) {
    return cache;
  }

  const byMatchNumber = new Map();
  const byPairKey = new Map();

  try {
    const res = await fetch(FIFA_MATCHES_URL, { headers: FETCH_HEADERS, cache: 'no-store' });
    if (!res.ok) throw new Error(`FIFA API ${res.status}`);

    const data = await res.json();
    for (const match of data.Results || []) {
      const entry = parseMainOfficial(match);
      if (!entry) continue;

      const matchNumber = match.MatchNumber ?? match.matchNumber;
      const dateIso = matchDateIso(match);
      const home = fifaTeamName(match.Home);
      const away = fifaTeamName(match.Away);
      if (!dateIso || !home || !away) continue;

      const payload = { ...entry, matchNumber, dateIso };

      if (matchNumber != null) {
        byMatchNumber.set(Number(matchNumber), payload);
      }
      byPairKey.set(teamPairKey(dateIso, home, away), payload);
    }
  } catch (err) {
    console.error('[fifa/referees]', err.message);
  }

  cache = { at: now, byMatchNumber, byPairKey };
  return cache;
}

/** Mapa fecha|equipos → árbitro FIFA para un día. */
export async function loadFifaRefereesForDate(dateIso) {
  const { byPairKey } = await loadFifaMatches();
  const map = new Map();

  for (const [key, entry] of byPairKey.entries()) {
    if (entry.dateIso === dateIso) {
      map.set(key, entry);
    }
  }

  return map;
}

export async function getFifaRefereeByMatchNumber(matchNumber) {
  const { byMatchNumber } = await loadFifaMatches();
  return byMatchNumber.get(Number(matchNumber)) ?? null;
}

export function invalidateFifaRefereeCache() {
  cache = { at: 0, byMatchNumber: new Map(), byPairKey: new Map() };
}
