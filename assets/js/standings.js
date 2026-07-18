(function (global) {
  let overlayEl = null;

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildOverlay() {
    const el = document.createElement('div');
    el.className = 'tools-overlay hidden';
    el.id = 'standingsOverlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'standingsTitle');
    el.innerHTML = `
      <div class="tools-panel">
        <div class="sheet-handle" data-drag-handle aria-hidden="true"></div>
        <header class="tools-header">
          <div>
            <h2 id="standingsTitle">Tabla de posiciones</h2>
            <p class="standings-subtitle"></p>
          </div>
          <button type="button" class="bracket-close" id="btnCloseStandings" aria-label="Cerrar">&times;</button>
        </header>
        <div class="tools-body standings-body"></div>
      </div>
    `;
    document.body.appendChild(el);
    el.querySelector('#btnCloseStandings').addEventListener('click', close);
    el.addEventListener('click', (e) => { if (e.target === el) close(); });
    if (global.CodedSportsGestures) {
      global.CodedSportsGestures.createDraggableSheet(
        el.querySelector('.tools-panel'),
        el.querySelector('.sheet-handle'),
        'btnCloseStandings'
      );
    }
    return el;
  }

  function rowHtml(row, i) {
    return `<tr>
      <td class="standings-rank">${row.rank || i + 1}</td>
      <td class="standings-team">${row.logo ? `<img src="${row.logo}" alt="" width="18" height="18" loading="lazy">` : ''}${esc(row.team)}</td>
      <td>${row.played}</td>
      <td>${row.won}</td>
      <td>${row.drawn}</td>
      <td>${row.lost}</td>
      <td>${row.goalDiff > 0 ? '+' : ''}${row.goalDiff}</td>
      <td class="standings-pts">${row.points}</td>
    </tr>`;
  }

  function groupHtml(group) {
    if (!group.rows.length) {
      return `<p class="standings-empty">Sin datos para "${esc(group.name)}" todavía.</p>`;
    }
    return `
      <h3 class="standings-group-title">${esc(group.name)}</h3>
      <div class="standings-scroll">
        <table class="standings-table">
          <thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>DG</th><th>Pts</th></tr></thead>
          <tbody>${group.rows.map(rowHtml).join('')}</tbody>
        </table>
      </div>`;
  }

  async function open(competitionId, competitionLabel) {
    if (!overlayEl) overlayEl = buildOverlay();
    overlayEl.classList.remove('hidden');
    const body = overlayEl.querySelector('.standings-body');
    const subtitle = overlayEl.querySelector('.standings-subtitle');
    subtitle.textContent = competitionLabel || '';
    body.innerHTML = '<p class="standings-loading">Cargando tabla…</p>';

    try {
      const res = await fetch(`/api/leagues/${competitionId}/standings`, { cache: 'no-store' });
      const data = await res.json();
      if (!data.ok || !data.groups?.length) {
        body.innerHTML = '<p class="standings-empty">Todavía no hay tabla disponible para esta competición.</p>';
        return;
      }
      const approxNote = data.partial
        ? '<p class="standings-note">Tabla aproximada, calculada a partir de resultados recientes.</p>'
        : '';
      body.innerHTML = approxNote + data.groups.map(groupHtml).join('');
    } catch {
      body.innerHTML = '<p class="standings-empty">No se pudo cargar la tabla. Intenta de nuevo.</p>';
    }
  }

  function close() {
    overlayEl?.classList.add('hidden');
  }

  global.CodedSportsStandings = { open, close };
})(window);
