(function (global) {
  let catalog = null;
  let overlayEl = null;
  let onSelectCompetition = null;
  let onExitToWorldCup = null;
  let openCountryCode = null;
  let openContinentId = 'sudamerica';

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function flagUrl(iso) {
    return iso ? `https://flagcdn.com/w40/${iso}.png` : null;
  }

  function tierIcon(tier) {
    if (tier === 'top') return '🏆';
    if (tier === 'second') return '🥈';
    return '🎽';
  }

  function competitionRowHtml(countryCode, comp) {
    const disabled = !comp.available;
    return `<button type="button" class="league-comp-row${disabled ? ' is-disabled' : ''}" data-comp-id="${comp.id}" ${disabled ? 'disabled' : ''}>
      <span class="league-comp-icon" aria-hidden="true">${tierIcon(comp.tier)}</span>
      <span class="league-comp-name">${esc(comp.officialName)}</span>
      <span class="league-comp-tag">${disabled ? 'Próximamente' : esc(comp.tierLabel)}</span>
    </button>`;
  }

  function countryRowHtml(country) {
    const open = openCountryCode === country.code;
    const flag = flagUrl(country.iso);
    return `<div class="league-country${open ? ' is-open' : ''}">
      <button type="button" class="league-country-row" data-country="${country.code}">
        ${flag ? `<img class="league-country-flag" src="${flag}" alt="" width="24" height="18" loading="lazy">` : '<span class="league-country-flag" aria-hidden="true">🏳️</span>'}
        <span class="league-country-name">${esc(country.name)}</span>
        <span class="league-country-chevron" aria-hidden="true">${open ? '▾' : '▸'}</span>
      </button>
      ${open ? `<div class="league-comp-list">${country.competitions.map((c) => competitionRowHtml(country.code, c)).join('')}</div>` : ''}
    </div>`;
  }

  function continentRowHtml(continent) {
    const open = openContinentId === continent.id;
    const disabled = !continent.available;
    return `<div class="league-continent${open ? ' is-open' : ''}">
      <button type="button" class="league-continent-row${disabled ? ' is-disabled' : ''}" data-continent="${continent.id}" ${disabled ? 'disabled' : ''}>
        <span class="league-continent-name">${esc(continent.name)}</span>
        <span class="league-continent-tag">${disabled ? 'Próximamente' : `${continent.countries.length} países`}</span>
      </button>
      ${open && !disabled ? `<div class="league-country-list">${continent.countries.map(countryRowHtml).join('')}</div>` : ''}
    </div>`;
  }

  function renderMenuBody() {
    if (!overlayEl) return;
    const body = overlayEl.querySelector('.league-panel-body');
    if (!body || !catalog) return;
    body.innerHTML = `
      <button type="button" class="league-worldcup-row" id="btnLeagueExit">
        <span class="league-comp-icon" aria-hidden="true">🌎</span>
        <span class="league-comp-name">Mundial 2026</span>
      </button>
      ${catalog.map(continentRowHtml).join('')}
    `;
    bindMenuBodyEvents(body);
  }

  function bindMenuBodyEvents(body) {
    body.querySelector('#btnLeagueExit')?.addEventListener('click', () => {
      closeMenu();
      onExitToWorldCup?.();
    });
    body.querySelectorAll('.league-continent-row:not(.is-disabled)').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.continent;
        openContinentId = openContinentId === id ? null : id;
        openCountryCode = null;
        renderMenuBody();
      });
    });
    body.querySelectorAll('.league-country-row').forEach((btn) => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.country;
        openCountryCode = openCountryCode === code ? null : code;
        renderMenuBody();
      });
    });
    body.querySelectorAll('.league-comp-row:not(.is-disabled)').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.compId;
        closeMenu();
        onSelectCompetition?.(id);
      });
    });
  }

  function buildOverlay() {
    const el = document.createElement('div');
    el.className = 'tools-overlay league-overlay hidden';
    el.id = 'leaguesOverlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'leaguesTitle');
    el.innerHTML = `
      <div class="tools-panel league-panel">
        <div class="sheet-handle" data-drag-handle aria-hidden="true"></div>
        <header class="tools-header">
          <div>
            <h2 id="leaguesTitle">Ligas</h2>
            <p>Explora fútbol de clubes por continente y país</p>
          </div>
          <button type="button" class="bracket-close" id="btnCloseLeagues" aria-label="Cerrar">&times;</button>
        </header>
        <div class="tools-body league-panel-body"></div>
      </div>
    `;
    document.body.appendChild(el);
    el.querySelector('#btnCloseLeagues').addEventListener('click', closeMenu);
    el.addEventListener('click', (e) => { if (e.target === el) closeMenu(); });
    return el;
  }

  async function fetchCatalog() {
    if (catalog) return catalog;
    const res = await fetch('/api/leagues?action=catalog', { cache: 'no-store' });
    const data = await res.json();
    catalog = data.continents || [];
    return catalog;
  }

  function openMenu() {
    if (!overlayEl) overlayEl = buildOverlay();
    overlayEl.classList.remove('hidden');
    fetchCatalog().then(renderMenuBody);
    if (global.CodedSportsGestures) {
      global.CodedSportsGestures.createDraggableSheet(
        overlayEl.querySelector('.league-panel'),
        overlayEl.querySelector('.sheet-handle'),
        'btnCloseLeagues'
      );
    }
  }

  function closeMenu() {
    overlayEl?.classList.add('hidden');
  }

  function getCountryMeta(countryCode) {
    if (!catalog) return null;
    for (const continent of catalog) {
      const country = continent.countries.find((c) => c.code === countryCode);
      if (country) return { ...country, continentName: continent.name };
    }
    return null;
  }

  function getCompetitionMeta(competitionId) {
    if (!catalog) return null;
    for (const continent of catalog) {
      for (const country of continent.countries) {
        const comp = country.competitions.find((c) => c.id === competitionId);
        if (comp) {
          return {
            competition: comp,
            country: { code: country.code, name: country.name, iso: country.iso },
            continentName: continent.name,
          };
        }
      }
    }
    return null;
  }

  function init(opts = {}) {
    onSelectCompetition = opts.onSelectCompetition || null;
    onExitToWorldCup = opts.onExitToWorldCup || null;
    fetchCatalog();
  }

  global.CodedSportsLeagues = {
    init,
    openMenu,
    closeMenu,
    getCountryMeta,
    getCompetitionMeta,
    getCatalog: () => catalog,
  };
})(window);
