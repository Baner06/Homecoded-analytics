/**
 * Estadísticas verificadas post-partido (fuentes: FotMob/Opta, bettingstats.org).
 * Clave: fecha|local|visitante (nombres en español de resolveTeam).
 */
export const VERIFIED_STATS = {
  '2026-06-26|Noruega|Francia': {
    homeCorners: 4,
    awayCorners: 5,
    totalCorners: 9,
    homeShotsOnTarget: 4,
    awayShotsOnTarget: 9,
    totalShotsOnTarget: 13,
    yellowCards: 2,
    redCards: 0,
    firstHalfCorners: 4,
    secondHalfCorners: 5,
  },
  '2026-06-26|Senegal|Irak': {
    homeCorners: 12,
    awayCorners: 3,
    totalCorners: 15,
    homeShotsOnTarget: 12,
    awayShotsOnTarget: 1,
    totalShotsOnTarget: 13,
    yellowCards: 4,
    redCards: 1,
    firstHalfCorners: 5,
    secondHalfCorners: 10,
  },
  '2026-06-26|Cabo Verde|Arabia Saudita': {
    homeCorners: 4,
    awayCorners: 2,
    totalCorners: 6,
    homeShotsOnTarget: 2,
    awayShotsOnTarget: 3,
    totalShotsOnTarget: 5,
    yellowCards: 4,
    redCards: 0,
    firstHalfCorners: null,
    secondHalfCorners: null,
  },
  '2026-06-26|Uruguay|España': {
    homeCorners: 1,
    awayCorners: 6,
    totalCorners: 7,
    homeShotsOnTarget: 1,
    awayShotsOnTarget: 1,
    totalShotsOnTarget: 2,
    yellowCards: 4,
    redCards: 0,
    firstHalfCorners: null,
    secondHalfCorners: null,
  },
};

export function statsKey(date, homeName, awayName) {
  return `${date}|${homeName}|${awayName}`;
}

export function getVerifiedStats(date, homeName, awayName) {
  return VERIFIED_STATS[statsKey(date, homeName, awayName)] ?? null;
}
