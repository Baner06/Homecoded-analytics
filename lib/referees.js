import { getRefereeForMatch } from './refereeFeed.js';

/** Perfiles de árbitros del Mundial 2026 (país y tendencia disciplinaria). */
const REFEREE_PROFILES = {
  'szymon marciniak': { name: 'Szymon Marciniak', country: 'Polonia', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.4 },
  'clement turpin': { name: 'Clément Turpin', country: 'Francia', rigor: 'Medio-Alto', multiplier: 1.2, cardsPerGame: 4.2 },
  'anthony taylor': { name: 'Anthony Taylor', country: 'Inglaterra', rigor: 'Bajo', multiplier: 0.72, cardsPerGame: 2.4 },
  'michael oliver': { name: 'Michael Oliver', country: 'Inglaterra', rigor: 'Medio', multiplier: 1.05, cardsPerGame: 3.6 },
  'slavko vincic': { name: 'Slavko Vinčić', country: 'Eslovenia', rigor: 'Medio-Alto', multiplier: 1.15, cardsPerGame: 3.9 },
  'slavko vincici': { name: 'Slavko Vinčić', country: 'Eslovenia', rigor: 'Medio-Alto', multiplier: 1.15, cardsPerGame: 3.9 },
  'ismail elfath': { name: 'Ismail Elfath', country: 'Estados Unidos', rigor: 'Medio', multiplier: 0.95, cardsPerGame: 3.2 },
  'jesus valenzuela': { name: 'Jesús Valenzuela', country: 'Venezuela', rigor: 'Medio-Bajo', multiplier: 0.85, cardsPerGame: 3.1 },
  'felix zwayer': { name: 'Felix Zwayer', country: 'Alemania', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.5 },
  'danny makkelie': { name: 'Danny Makkelie', country: 'Países Bajos', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.3 },
  'glenn nyberg': { name: 'Glenn Nyberg', country: 'Suecia', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.2 },
  'istvan kovacs': { name: 'Istvan Kovacs', country: 'Rumania', rigor: 'Medio-Alto', multiplier: 1.1, cardsPerGame: 3.8 },
  'espen eskas': { name: 'Espen Eskas', country: 'Noruega', rigor: 'Medio', multiplier: 0.95, cardsPerGame: 3.1 },
  'ilgiz tantashev': { name: 'Ilgiz Tantashev', country: 'Uzbekistán', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.3 },
  'francois letexier': { name: 'Francois Letexier', country: 'Francia', rigor: 'Medio-Alto', multiplier: 1.15, cardsPerGame: 3.9 },
  'wilton pereira sampaio': { name: 'Wilton Pereira Sampaio', country: 'Brasil', rigor: 'Medio-Alto', multiplier: 1.1, cardsPerGame: 3.7 },
  'raphael claus': { name: 'Raphael Claus', country: 'Brasil', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.4 },
  'dario herrera': { name: 'Dario Herrera', country: 'Argentina', rigor: 'Medio', multiplier: 1.05, cardsPerGame: 3.5 },
  'facundo tello': { name: 'Facundo Tello', country: 'Argentina', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.3 },
  'ramon abatti abel': { name: 'Ramon Abatti Abel', country: 'Brasil', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.4 },
  'cristian garay': { name: 'Cristián Garay', country: 'Chile', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.3 },
  'gustavo tejera': { name: 'Gustavo Tejera', country: 'Uruguay', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.2 },
  'ivan arcides barton cisneros': { name: 'Iván Arcides Barton Cisneros', country: 'El Salvador', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.3 },
  'cesar arturo ramos palazuelos': { name: 'César Arturo Ramos Palazuelos', country: 'México', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.4 },
  'katia itzel garcia': { name: 'Katia Itzel García', country: 'México', rigor: 'Medio', multiplier: 0.95, cardsPerGame: 3.1 },
  'alejandro jose hernandez hernandez': { name: 'Alejandro José Hernández Hernández', country: 'México', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.3 },
  'tori penso': { name: 'Tori Penso', country: 'Estados Unidos', rigor: 'Medio', multiplier: 0.95, cardsPerGame: 3.0 },
  'drew fischer': { name: 'Drew Fischer', country: 'Canadá', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.2 },
  'alireza faghani': { name: 'Alireza Faghani', country: 'Irán', rigor: 'Medio-Alto', multiplier: 1.1, cardsPerGame: 3.7 },
  'abdulrahman al-jassim': { name: 'Abdulrahman Al-Jassim', country: 'Qatar', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.3 },
  'omar al ali': { name: 'Omar Al Ali', country: 'Emiratos Árabes Unidos', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.2 },
  'adham mohammad': { name: 'Adham Mohammad', country: 'Jordania', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.2 },
  'amin omar': { name: 'Amin Omar', country: 'Malasia', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.2 },
  'ma ning': { name: 'Ma Ning', country: 'China', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.3 },
  'mustapha ghorbal': { name: 'Mustapha Ghorbal', country: 'Argelia', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.4 },
  'pierre atcho': { name: 'Pierre Atcho', country: 'Benín', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.2 },
  'jalal jayed': { name: 'Jalal Jayed', country: 'Marruecos', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.3 },
  'beida damane': { name: 'Beida Damane', country: 'Mauritania', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.2 },
  'joao pedro pinheiro': { name: 'João Pedro Pinheiro', country: 'Portugal', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 4.7 },
  'joao pedro silva pinheiro': { name: 'João Pedro Pinheiro', country: 'Portugal', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 4.7 },
  'joao pinheiro': { name: 'João Pedro Pinheiro', country: 'Portugal', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 4.7 },
  'juan gabriel benitez': { name: 'Juan Gabriel Benítez', country: 'Paraguay', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.2 },
  'martinez, hector': { name: 'Héctor Martínez', country: 'Uruguay', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.3 },
  'hector martinez': { name: 'Héctor Martínez', country: 'Uruguay', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.3 },
  'maurizio mariani': { name: 'Maurizio Mariani', country: 'Italia', rigor: 'Medio-Alto', multiplier: 1.1, cardsPerGame: 3.7 },
  'yael falcon perez': { name: 'Yael Falcón Pérez', country: 'Uruguay', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.2 },
};

export const UNASSIGNED_REFEREE = {
  name: 'Por definir',
  country: 'No asignado',
  rigor: 'Por definir',
  assigned: false,
  multiplier: 1.0,
  cardsPerGame: 3.0,
};

function normalizeRefereeName(name) {
  return (name || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function rigorFromCardsPerGame(cpg) {
  if (cpg == null || !Number.isFinite(cpg)) return { rigor: 'Medio', multiplier: 1.0 };
  if (cpg < 3.0) return { rigor: 'Bajo', multiplier: 0.75 };
  if (cpg < 3.5) return { rigor: 'Medio', multiplier: 1.0 };
  if (cpg < 4.0) return { rigor: 'Medio-Alto', multiplier: 1.15 };
  return { rigor: 'Alto', multiplier: 1.3 };
}

function lookupProfile(rawName, feedEntry = null) {
  if (!rawName) return null;

  const normalized = normalizeRefereeName(rawName);
  let profile = REFEREE_PROFILES[normalized];

  if (!profile) {
    const lastFirst = normalized.match(/^([^,]+),\s*(.+)$/);
    if (lastFirst) {
      profile = REFEREE_PROFILES[`${lastFirst[2]} ${lastFirst[1]}`.trim()];
    }
  }

  if (!profile) {
    profile = {
      name: rawName,
      country: feedEntry?.country || 'Internacional',
      rigor: 'Medio',
      multiplier: 1.0,
      cardsPerGame: 3.4,
    };
  } else {
    profile = { ...profile };
  }

  if (feedEntry?.country && feedEntry.country !== 'Internacional') {
    profile.country = feedEntry.country;
  }

  if (feedEntry?.cardsPerGame != null) {
    profile.cardsPerGame = feedEntry.cardsPerGame;
    const tone = rigorFromCardsPerGame(feedEntry.cardsPerGame);
    profile.rigor = tone.rigor;
    profile.multiplier = tone.multiplier;
  }

  return profile;
}

/** Resuelve un árbitro a partir de un nombre crudo (p. ej. ESPN gameInfo.officials), sin mapa de partidos. */
export function resolveRefereeFromName(rawName, source = 'espn') {
  if (!rawName) return { ...UNASSIGNED_REFEREE };
  const profile = lookupProfile(rawName, null);
  return { ...profile, assigned: true, source, verified: true, conflict: false };
}

/**
 * Resuelve el árbitro de un partido de liga/copa de clubes cruzando el nombre
 * de ESPN (gameInfo.officials, puede faltar en ligas con poca cobertura como
 * la Liga BetPlay Dimayor) con la designación de Sofascore (trae también
 * tarjetas/partido para el "rigor"). Si solo hay uno de los dos, se usa ese.
 */
export function resolveLeagueReferee(espnName, sofaEntry = null) {
  if (!espnName && !sofaEntry?.name) return { ...UNASSIGNED_REFEREE };

  const primaryName = espnName || sofaEntry.name;
  const profile = lookupProfile(primaryName, sofaEntry);

  let conflict = false;
  if (espnName && sofaEntry?.name) {
    const a = normalizeRefereeName(espnName);
    const b = normalizeRefereeName(sofaEntry.name);
    conflict = a !== b && !a.includes(b) && !b.includes(a);
  }

  const source = espnName && sofaEntry?.name
    ? (conflict ? 'sofascore' : 'espn+sofascore')
    : sofaEntry?.name
      ? 'sofascore'
      : 'espn';

  return {
    ...profile,
    assigned: true,
    source,
    verified: !conflict,
    conflict,
  };
}

export function resolveReferee(homeTeam, awayTeam, date, refereeMap = new Map(), matchNumber = null) {
  const feedEntry = getRefereeForMatch(refereeMap, date, homeTeam, awayTeam, matchNumber);

  if (feedEntry?.name) {
    const profile = lookupProfile(feedEntry.name, feedEntry);
    return {
      ...profile,
      assigned: true,
      source: feedEntry.source || 'fifa',
      verified: feedEntry.verified !== false,
      conflict: !!feedEntry.conflict,
    };
  }

  return { ...UNASSIGNED_REFEREE };
}

export function formatRefereeDisplay(referee) {
  if (referee.assigned === false) {
    return 'Por definir · No asignado';
  }

  const sourceNote = referee.source === 'fifa'
    ? ''
    : referee.source === 'sofascore'
      ? ' · SofaScore'
      : referee.source?.includes('sofascore')
        ? ' · SofaScore'
        : referee.source?.includes('espn')
          ? ' · ESPN'
          : '';

  return `${referee.name} · ${referee.country} · ${referee.rigor}${sourceNote}`;
}
