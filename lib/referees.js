import { getDateISOInColombia } from './timezone.js';

/** Árbitros confirmados por partido (fecha|local|visitante en español). */
const CONFIRMED_REFEREES = {
  '2026-06-26|Noruega|Francia': { name: 'Slavko Vinčić', country: 'Eslovenia', rigor: 'Medio-Alto', multiplier: 1.15, cardsPerGame: 3.9 },
  '2026-06-26|Senegal|Irak': { name: 'Michael Oliver', country: 'Inglaterra', rigor: 'Medio', multiplier: 1.05, cardsPerGame: 3.6 },
  '2026-06-26|Cabo Verde|Arabia Saudita': { name: 'Ismail Elfath', country: 'Estados Unidos', rigor: 'Medio', multiplier: 0.95, cardsPerGame: 3.2 },
  '2026-06-26|Uruguay|España': { name: 'Szymon Marciniak', country: 'Polonia', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.4 },
  '2026-06-26|Egipto|Irán': { name: 'Anthony Taylor', country: 'Inglaterra', rigor: 'Bajo', multiplier: 0.72, cardsPerGame: 2.4 },
  '2026-06-26|Nueva Zelanda|Bélgica': { name: 'Clément Turpin', country: 'Francia', rigor: 'Medio-Alto', multiplier: 1.2, cardsPerGame: 4.2 },
};

const POOL = [
  { name: 'Szymon Marciniak', country: 'Polonia', rigor: 'Medio', multiplier: 1.0, cardsPerGame: 3.4 },
  { name: 'Clément Turpin', country: 'Francia', rigor: 'Medio-Alto', multiplier: 1.2, cardsPerGame: 4.2 },
  { name: 'Anthony Taylor', country: 'Inglaterra', rigor: 'Bajo', multiplier: 0.72, cardsPerGame: 2.4 },
  { name: 'Jesús Valenzuela', country: 'Venezuela', rigor: 'Medio-Bajo', multiplier: 0.85, cardsPerGame: 3.1 },
  { name: 'Daniele Orsato', country: 'Italia', rigor: 'Alto', multiplier: 1.45, cardsPerGame: 4.8 },
  { name: 'Michael Oliver', country: 'Inglaterra', rigor: 'Medio', multiplier: 1.05, cardsPerGame: 3.6 },
  { name: 'Slavko Vinčić', country: 'Eslovenia', rigor: 'Medio-Alto', multiplier: 1.15, cardsPerGame: 3.9 },
  { name: 'Ismail Elfath', country: 'Estados Unidos', rigor: 'Medio', multiplier: 0.95, cardsPerGame: 3.2 },
];

export const UNASSIGNED_REFEREE = {
  name: 'Por definir',
  country: 'No asignado',
  rigor: 'Por definir',
  assigned: false,
  multiplier: 1.0,
  cardsPerGame: 3.0,
};

function refereeKey(date, homeName, awayName) {
  return `${date}|${homeName}|${awayName}`;
}

function stablePoolIndex(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % POOL.length;
}

export function assignReferee(matchNumber, homeName, awayName, date) {
  const key = refereeKey(date, homeName, awayName);
  const confirmed = CONFIRMED_REFEREES[key];

  if (confirmed) {
    return { ...confirmed, assigned: true };
  }

  const today = getDateISOInColombia();
  if (date > today) {
    return { ...UNASSIGNED_REFEREE };
  }

  const fromPool = POOL[stablePoolIndex(key)] || POOL[matchNumber % POOL.length];
  return { ...fromPool, assigned: true };
}

export function formatRefereeDisplay(referee) {
  if (referee.assigned === false) {
    return 'Por definir · No asignado';
  }
  return `${referee.name} · ${referee.country} · ${referee.rigor}`;
}
