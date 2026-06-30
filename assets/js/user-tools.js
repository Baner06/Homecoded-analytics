(() => {
  const BET_KEY = 'hc_mi_apuesta';
  const USER_KEY = 'cs_user_v1';
  const H2H_PENDING = new Map();
  const COP_MAX = 100_000_000;

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function formatCop(n) {
    if (!Number.isFinite(n) || n <= 0) return '';
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(n));
  }

  function formatCopDisplay(n) {
    return `$ ${formatCop(n || 0)} COP`;
  }

  function parseCop(str) {
    const digits = String(str || '').replace(/\./g, '').replace(/\D/g, '');
    if (!digits) return 0;
    return Math.min(COP_MAX, parseInt(digits, 10));
  }

  function bindCopInputs(form) {
    form.querySelectorAll('.cop-input-wrap input').forEach((input) => {
      if (input.dataset.copBound) return;
      input.dataset.copBound = '1';
      input.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (allowed.includes(e.key)) return;
        if (/^\d$/.test(e.key)) return;
        e.preventDefault();
      });
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
        const n = parseCop(text);
        input.value = n ? formatCop(n) : '';
      });
      input.addEventListener('input', () => {
        const n = parseCop(input.value);
        input.value = n ? formatCop(n) : '';
      });
    });
  }

  function loadUserStore() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveUserStore(data) {
    localStorage.setItem(USER_KEY, JSON.stringify(data));
  }

  function loadBets() {
    try {
      return JSON.parse(localStorage.getItem(BET_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function loadingHtml(label) {
    return `<span class="tool-loading"><span class="spinner"></span> ${esc(label)}</span>`;
  }

  async function fetchJson(url, options = {}) {
    const timeoutMs = options.timeout ?? 45000;
    const { timeout, ...fetchOpts } = options;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { cache: 'no-store', ...fetchOpts, signal: ctrl.signal });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { throw new Error('Respuesta inválida del servidor'); }
      if (!res.ok || data?.ok === false) throw new Error(data?.error || `Error ${res.status}`);
      return data;
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Tiempo de espera agotado. Reintenta en unos segundos.');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  function renderRollover(state) {
    const el = document.getElementById('rolloverPanel');
    if (!el) return;
    const pct = state.progressPct ?? 0;
    el.innerHTML = `
      <div class="tool-progress">
        <div class="tool-progress-label">${esc(state.label || '')}</div>
        <div class="tool-progress-bar"><i style="width:${pct}%"></i></div>
        <p style="font-size:.625rem;color:var(--muted);margin:.35rem 0 0">
          Meta: ${formatCopDisplay(state.target)} · Cuota mín. ${state.minOdds} · Bono ${formatCopDisplay(state.bonusAmount)} × ${state.multiplier}
        </p>
      </div>`;
  }

  function renderPortfolio(data) {
    const el = document.getElementById('portfolioPanel');
    if (!el) return;
    const p = data.portfolio || {};
    const bars = (p.chart || []).map((pt) => {
      const h = Math.min(100, Math.abs(pt.cumulative) * 20 + 8);
      return `<div class="yield-bar${pt.cumulative < 0 ? ' neg' : ''}" style="height:${h}%" title="${esc(pt.label)}: ${pt.cumulative}u"></div>`;
    }).join('') || '<span style="font-size:.6875rem;color:var(--muted)">Sin apuestas cerradas aún</span>';

    el.innerHTML = `
      <div class="tool-stat-grid">
        <div class="tool-stat"><strong>${p.hitRate != null ? p.hitRate + '%' : '—'}</strong><span>Acierto</span></div>
        <div class="tool-stat"><strong>${p.yieldPct != null ? (p.yieldPct > 0 ? '+' : '') + p.yieldPct + '%' : '—'}</strong><span>Yield</span></div>
        <div class="tool-stat"><strong>${p.total || 0}</strong><span>Total</span></div>
      </div>
      <div class="yield-chart">${bars}</div>
      <p style="font-size:.625rem;color:var(--muted)">${p.hits || 0} aciertos · ${p.misses || 0} fallos · ${p.pending || 0} pendientes</p>`;
  }

  function renderPortfolioError(message) {
    const el = document.getElementById('portfolioPanel');
    if (!el) return;
    el.innerHTML = `<p class="tool-error">${esc(message)}</p><button type="button" class="btn btn-accent btn-sm" id="btnRetryPortfolio">Reintentar</button>`;
    document.getElementById('btnRetryPortfolio')?.addEventListener('click', () => syncPortfolio());
  }

  function renderEngineTiers() {
    const el = document.getElementById('enginePanel');
    if (!el) return;
    el.innerHTML = `
      <div class="engine-tier"><span class="engine-tier-id">Alta</span><span>Mercados conservadores (goles 1.5, córners, disparos) con score ≥ 78. Mayor tasa de acierto histórica.</span></div>
      <div class="engine-tier"><span class="engine-tier-id">Media</span><span>Probabilidad razonable (62–77). Conviene combinar con líneas más seguras.</span></div>
      <div class="engine-tier"><span class="engine-tier-id">Baja</span><span>Alta varianza: tarjetas, doble chance, HT. No recomendada como apuesta única.</span></div>
      <p style="font-size:.625rem;color:var(--muted);margin-top:.75rem">En cada partido verás las predicciones en verde (recomendable), ámbar (probable) y rojo (poco probable).</p>`;
  }

  async function syncPortfolio({ bustCache = false, silent = false } = {}) {
    const el = document.getElementById('portfolioPanel');
    if (!silent && el) el.innerHTML = loadingHtml('Analizando tu portafolio…');
    try {
      const store = loadUserStore();
      const body = { bets: loadBets(), rollover: store.rollover || null };
      if (bustCache) body.refresh = true;
      const data = await fetchJson('/api/v1/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      renderPortfolio(data);
      if (data.rollover) renderRollover(data.rollover);
    } catch (err) {
      if (!silent) renderPortfolioError(err.message || 'No se pudo cargar el portafolio');
    }
  }

  function bindRolloverForm() {
    const form = document.getElementById('rolloverForm');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';
    const store = loadUserStore();
    const r = store.rollover || { bonusAmount: 100000, multiplier: 5, minOdds: 1.5, wagered: 0 };
    form.bonusAmount.value = formatCop(r.bonusAmount);
    form.multiplier.value = r.multiplier;
    form.minOdds.value = r.minOdds;
    form.wagered.value = r.wagered ? formatCop(r.wagered) : '';
    bindCopInputs(form);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rollover = {
        bonusAmount: parseCop(form.bonusAmount.value),
        multiplier: Number(form.multiplier.value),
        minOdds: Number(form.minOdds.value),
        wagered: parseCop(form.wagered.value),
      };
      saveUserStore({ ...loadUserStore(), rollover });
      const panel = document.getElementById('rolloverPanel');
      if (panel) panel.innerHTML = loadingHtml('Calculando rollover…');
      await syncPortfolio();
    });
  }

  function switchToolsTab(name) {
    document.querySelectorAll('.tools-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === name);
    });
    document.querySelectorAll('.tools-section').forEach((s) => {
      s.classList.toggle('active', s.dataset.section === name);
    });
    if (name === 'portfolio') syncPortfolio();
  }

  function openToolsPanel(tab = 'rollover') {
    document.getElementById('toolsOverlay')?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    switchToolsTab(tab);
    bindRolloverForm();
    renderEngineTiers();
    const store = loadUserStore();
    if (store.rollover && tab !== 'portfolio') {
      fetchJson('/api/v1/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bets: [], rollover: store.rollover }),
      }).then((d) => renderRollover(d.rollover)).catch((err) => {
        const panel = document.getElementById('rolloverPanel');
        if (panel) panel.innerHTML = `<p class="tool-error">${esc(err.message)}</p>`;
      });
    }
  }

  function closeToolsPanel() {
    document.getElementById('toolsOverlay')?.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function h2hTarget(matchId) {
    return document.getElementById(`h2h-${matchId}`);
  }

  async function loadH2hPanel(container, matchId, { bustCache = false, silent = false } = {}) {
    if (!matchId) return;
    const reqId = (H2H_PENDING.get(matchId) || 0) + 1;
    H2H_PENDING.set(matchId, reqId);

    const target = h2hTarget(matchId) || container;
    if (!target) return;

    if (!silent) {
      target.dataset.loaded = '';
      target.innerHTML = loadingHtml('Cargando frente a frente…');
    }

    try {
      const refreshFlag = bustCache ? '&refresh=1' : '';
      const data = await fetchJson(`/api/h2h?matchId=${matchId}&_=${Date.now()}${refreshFlag}`);
      const el = h2hTarget(matchId);
      if (!el || H2H_PENDING.get(matchId) !== reqId) return;

      const meetings = (data.meetings || []).filter((m) => m.score).map((m) =>
        `<tr><td>${esc(m.date)}</td><td>${esc(m.score)}</td><td>${esc(m.stage || '')}</td></tr>`
      ).join('') || '<tr><td colspan="3">Sin enfrentamientos previos en el torneo</td></tr>';

      const homeMetrics = (data.comparison || []).map((row) =>
        `<div class="h2h-metric"><span>${esc(row.label)}</span><strong>${esc(row.home)}</strong></div>`
      ).join('');

      const awayMetrics = (data.comparison || []).map((row) =>
        `<div class="h2h-metric"><span>${esc(row.label)}</span><strong>${esc(row.away)}</strong></div>`
      ).join('');

      el.dataset.loaded = '1';
      el.innerHTML = `
        <div class="h2h-summary">
          <span class="h2h-pill">${data.summary?.played || 0} jugados</span>
          <span class="h2h-pill">${data.home?.name}: ${data.summary?.homeWins || 0}G</span>
          <span class="h2h-pill">${data.away?.name}: ${data.summary?.awayWins || 0}G</span>
          <span class="h2h-pill">${data.summary?.draws || 0} empates</span>
        </div>
        <div class="h2h-compare">
          <div class="h2h-team-box"><h4>${esc(data.home?.name)}</h4>${homeMetrics}</div>
          <div class="h2h-team-box"><h4>${esc(data.away?.name)}</h4>${awayMetrics}</div>
        </div>
        <table class="h2h-table"><thead><tr><th>Fecha</th><th>Resultado</th><th>Fase</th></tr></thead><tbody>${meetings}</tbody></table>`;
    } catch (err) {
      const el = h2hTarget(matchId);
      if (!el || H2H_PENDING.get(matchId) !== reqId) return;
      el.dataset.loaded = '';
      el.innerHTML = `<p class="tool-error">${esc(err.message)}</p><button type="button" class="btn btn-accent btn-sm h2h-retry" data-mid="${matchId}">Reintentar</button>`;
      el.querySelector('.h2h-retry')?.addEventListener('click', () => loadH2hPanel(el, matchId));
    }
  }

  function initUserTools() {
    document.getElementById('btnToolsFab')?.addEventListener('click', () => openToolsPanel('rollover'));
    document.getElementById('btnToolsHeader')?.addEventListener('click', () => openToolsPanel('portfolio'));
    document.getElementById('btnCloseTools')?.addEventListener('click', closeToolsPanel);
    document.querySelectorAll('.tools-tab').forEach((tab) => {
      tab.addEventListener('click', () => switchToolsTab(tab.dataset.tab));
    });
    document.getElementById('toolsOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'toolsOverlay') closeToolsPanel();
    });
  }

  function refreshPortfolioIfNeeded({ bustCache = false } = {}) {
    if (!loadBets().length) return;
    const overlay = document.getElementById('toolsOverlay');
    const toolsOpen = overlay && !overlay.classList.contains('hidden');
    const portfolioActive = document.querySelector('.tools-tab.active')?.dataset.tab === 'portfolio';
    if (toolsOpen && portfolioActive) {
      syncPortfolio({ bustCache, silent: true });
    }
  }

  initUserTools();
  window.CodedSportsTools = {
    openToolsPanel,
    closeToolsPanel,
    loadH2hPanel,
    syncPortfolio,
    refreshPortfolioIfNeeded,
  };
})();
