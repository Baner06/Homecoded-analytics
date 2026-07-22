(function (global) {
  let catalog = null;
  let teamIndex = null;
  let overlayEl = null;
  let onSelectCompetition = null;
  let onExitToWorldCup = null;
  let onSelectFavorites = null;
  let onSelectTeam = null;
  let getFavoriteCount = null;
  let openCountryCode = null;
  let openContinentId = 'sudamerica';
  let searchQuery = '';

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalize(s) {
    return String(s ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
  }

  function flagUrl(iso) {
    return iso ? `https://flagcdn.com/w40/${iso}.png` : null;
  }

  function tierIcon(tier) {
    if (tier === 'top') return '🏆';
    if (tier === 'second') return '🥈';
    if (tier === 'continental') return '🌍';
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
        ${flag ? `<img class="league-country-flag" src="${flag}" alt="" width="24" height="18" loading="lazy">` : `<span class="league-country-flag" aria-hidden="true">${esc(country.flagEmoji || '🏳️')}</span>`}
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

  function matchesSearch(country, comp, normQuery) {
    return normalize(country.name).includes(normQuery) || normalize(comp.officialName).includes(normQuery);
  }

  function matchesTeam(team, normQuery) {
    return normalize(team.name).includes(normQuery);
  }

  function teamRowHtml(team) {
    const logo = team.logo
      ? `<img class="league-team-logo" src="${esc(team.logo)}" alt="" width="20" height="20" loading="lazy">`
      : '<span class="league-team-logo" aria-hidden="true">⚽</span>';
    return `<button type="button" class="league-team-row" data-team-name="${esc(team.name)}" data-competition-id="${esc(team.competitionId || '')}">
      ${logo}
      <span class="league-comp-name">${esc(team.name)}</span>
      <span class="league-comp-tag">${esc(team.competitionName)}</span>
    </button>`;
  }

  function searchGroupHtml(country, continent, normQuery) {
    const matched = country.competitions.filter((c) => matchesSearch(country, c, normQuery));
    if (!matched.length) return '';
    const flag = flagUrl(country.iso);
    return `<div class="league-country is-open">
      <div class="league-country-row league-country-row-static">
        ${flag ? `<img class="league-country-flag" src="${flag}" alt="" width="24" height="18" loading="lazy">` : `<span class="league-country-flag" aria-hidden="true">${esc(country.flagEmoji || '🏳️')}</span>`}
        <span class="league-country-name">${esc(country.name)}</span>
        <span class="league-continent-tag">${esc(continent.name)}</span>
      </div>
      <div class="league-comp-list">${matched.map((c) => competitionRowHtml(country.code, c)).join('')}</div>
    </div>`;
  }

  function renderSearchResults(query) {
    const normQuery = normalize(query);
    const groups = [];
    for (const continent of catalog) {
      if (!continent.available) continue;
      for (const country of continent.countries) {
        const html = searchGroupHtml(country, continent, normQuery);
        if (html) groups.push(html);
      }
    }

    const matchedTeams = (teamIndex || []).filter((t) => matchesTeam(t, normQuery)).slice(0, 20);
    const teamsHtml = matchedTeams.length
      ? `<div class="league-team-results">${matchedTeams.map(teamRowHtml).join('')}</div>`
      : '';

    if (!groups.length && !teamsHtml) {
      return `<p class="league-search-empty">Sin resultados para «${esc(query)}»</p>`;
    }
    return `<div class="league-search-results">${teamsHtml}${groups.join('')}</div>`;
  }

  function renderMenuBody() {
    if (!overlayEl) return;
    const content = overlayEl.querySelector('#leaguePanelContent');
    if (!content || !catalog) return;

    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) {
      content.innerHTML = renderSearchResults(trimmedQuery);
      bindContentEvents(content);
      return;
    }

    const favCount = getFavoriteCount?.() ?? 0;
    content.innerHTML = `
      <button type="button" class="league-worldcup-row" id="btnLeagueFavorites">
        <span class="league-comp-icon" aria-hidden="true">❤</span>
        <span class="league-comp-name">Favoritos</span>
        <span class="league-continent-tag">${favCount} liga${favCount === 1 ? '' : 's'}</span>
      </button>
      <button type="button" class="league-worldcup-row" id="btnLeagueExit">
        <span class="league-comp-icon" aria-hidden="true">🌎</span>
        <span class="league-comp-name">Mundial 2026</span>
      </button>
      ${catalog.map(continentRowHtml).join('')}
    `;
    bindContentEvents(content);
  }

  function bindContentEvents(content) {
    content.querySelector('#btnLeagueFavorites')?.addEventListener('click', () => {
      closeMenu();
      onSelectFavorites?.();
    });
    content.querySelector('#btnLeagueExit')?.addEventListener('click', () => {
      closeMenu();
      onExitToWorldCup?.();
    });
    content.querySelectorAll('.league-continent-row:not(.is-disabled)').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.continent;
        openContinentId = openContinentId === id ? null : id;
        openCountryCode = null;
        renderMenuBody();
      });
    });
    content.querySelectorAll('.league-country-row:not(.league-country-row-static)').forEach((btn) => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.country;
        openCountryCode = openCountryCode === code ? null : code;
        renderMenuBody();
      });
    });
    content.querySelectorAll('.league-comp-row:not(.is-disabled)').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.compId;
        closeMenu();
        onSelectCompetition?.(id);
      });
    });
    content.querySelectorAll('.league-team-row').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.teamName;
        const competitionId = btn.dataset.competitionId || null;
        closeMenu();
        onSelectTeam?.({ name, competitionId });
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
        <div class="tools-body league-panel-body">
          <div class="league-search-wrap">
            <input type="search" id="leagueSearchInput" class="league-search-input" placeholder="Buscar liga o país..." autocomplete="off">
          </div>
          <div class="league-panel-content" id="leaguePanelContent"></div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    el.querySelector('#btnCloseLeagues').addEventListener('click', closeMenu);
    el.addEventListener('click', (e) => { if (e.target === el) closeMenu(); });
    el.querySelector('#leagueSearchInput').addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderMenuBody();
    });
    return el;
  }

  async function fetchCatalog() {
    if (catalog) return catalog;
    const res = await fetch('/api/leagues?action=catalog', { cache: 'no-store' });
    const data = await res.json();
    catalog = data.continents || [];
    return catalog;
  }

  async function fetchTeamIndex() {
    if (teamIndex) return teamIndex;
    try {
      const res = await fetch('/api/leagues?action=teamIndex', { cache: 'no-store' });
      const data = await res.json();
      teamIndex = data.teams || [];
    } catch {
      teamIndex = [];
    }
    return teamIndex;
  }

  function openMenu() {
    if (!overlayEl) overlayEl = buildOverlay();
    overlayEl.classList.remove('hidden');
    searchQuery = '';
    const searchInput = overlayEl.querySelector('#leagueSearchInput');
    if (searchInput) searchInput.value = '';
    fetchCatalog().then(renderMenuBody);
    fetchTeamIndex().then(() => { if (searchQuery.trim()) renderMenuBody(); });
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
    onSelectFavorites = opts.onSelectFavorites || null;
    onSelectTeam = opts.onSelectTeam || null;
    getFavoriteCount = opts.getFavoriteCount || null;
    return fetchCatalog();
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
