import { listTeamsCatalog } from '../teams.js';
import { loadAllFixtures } from '../fixtures.js';

export { listTeamsCatalog };

export function listMatchesCatalog(allFixtures = []) {
  return allFixtures.map((f) => ({
    id: f.matchNumber,
    equipoLocal: f.homeTeam,
    equipoVisitante: f.awayTeam,
    fecha: f.date,
    estado: f.status || 'scheduled',
    torneo: 'Mundial FIFA 2026',
    stage: f.stageLabel || f.stage,
    venue: f.venue || null,
  }));
}

export async function loadCatalog() {
  const fixtures = await loadAllFixtures();
  return {
    equipos: listTeamsCatalog(),
    partidos: listMatchesCatalog(fixtures),
  };
}
