(function (global) {
  const POLL_MS = 20000;
  const active = new Map();
  const frozen = new Map();

  const STAT_TIPS = {
    'Posesión del balón': 'Porcentaje de tiempo que cada equipo controló el balón durante el partido.',
    'Tiros totales': 'Todos los intentos de gol: a puerta, fuera del arco y bloqueados por un defensor.',
    'Fueras de juego': 'Veces que un jugador fue sorprendido en posición adelantada según el asistente.',
    'Córners': 'Saques de esquina a favor de cada equipo.',
    'Tiros fuera': 'Disparos que no fueron a puerta ni bloqueados; terminaron fuera del arco.',
    'Disparos a puerta': 'Tiros que obligaron intervención del portero o entraron en la portería.',
    'Intercepciones': 'Pases rivales cortados antes de llegar a su destino.',
    'Despejes': 'Alejamientos del balón del área defensiva bajo presión.',
    'Entradas': 'Entradas efectivas que recuperaron o impidieron el avance rival.',
    'Paradas': 'Intervenciones del portero que evitaron un gol.',
    'Pases completados': 'Pases que llegaron a un compañero. Entre paréntesis: total y porcentaje de acierto.',
    'Centros': 'Centros al área completados con éxito. Entre paréntesis: intentos y porcentaje.',
    'Balones largos': 'Envíos largos que encontraron compañero. Entre paréntesis: total y porcentaje.',
    'Faltas': 'Infracciones cometidas según el criterio del árbitro.',
    'Tarjetas amarillas': 'Amonestaciones registradas en el partido.',
    'Tarjetas rojas': 'Expulsiones directas o por doble amarilla.',
  };

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function barWidths(row) {
    if (row?.barHome != null || row?.barAway != null) {
      return {
        home: Number(row.barHome) || 0,
        away: Number(row.barAway) || 0,
      };
    }
    const h = Math.max(Number(row?.home) || 0, 0);
    const a = Math.max(Number(row?.away) || 0, 0);
    const total = h + a;
    if (total <= 0) return { home: 0, away: 0 };
    const cap = 38;
    return {
      home: Math.min(cap, (h / total) * 100),
      away: Math.min(cap, (a / total) * 100),
    };
  }

  function winnerSide(home, away) {
    const h = Number(home);
    const a = Number(away);
    if (!Number.isFinite(h) || !Number.isFinite(a)) return null;
    if (h === a) return null;
    return h > a ? 'home' : 'away';
  }

  function tipAttrs(label) {
    const text = STAT_TIPS[label];
    if (!text) return '';
    return ` class="ms-tip" data-tip-title="${esc(label)}" data-tip-text="${esc(text)}"`;
  }

  function renderRow(row) {
    if (!row) return '';
    const win = winnerSide(row.home, row.away);
    const homeCls = win === 'home' ? 'ms-val ms-val-home ms-win' : 'ms-val ms-val-home';
    const awayCls = win === 'away' ? 'ms-val ms-val-away ms-win' : 'ms-val ms-val-away';
    const widths = barWidths(row);
    const tip = tipAttrs(row.label);

    return `<div class="ms-row"${tip}>
      <div class="ms-row-head">
        <span class="${homeCls}">${esc(row.homeDisplay)}</span>
        <span class="ms-label">${esc(row.label)}</span>
        <span class="${awayCls}">${esc(row.awayDisplay)}</span>
      </div>
      <div class="ms-bars">
        <div class="ms-bar-zone ms-bar-zone-home">
          <div class="ms-bar-home" style="width:${widths.home.toFixed(2)}%"></div>
        </div>
        <div class="ms-bar-gap" aria-hidden="true"></div>
        <div class="ms-bar-zone ms-bar-zone-away">
          <div class="ms-bar-away" style="width:${widths.away.toFixed(2)}%"></div>
        </div>
      </div>
    </div>`;
  }

  function renderAttackGraph(attack) {
    const off = attack?.shotsOff;
    const on = attack?.onTarget;
    if (!off && !on) return '';

    const offTotal = Math.max(Number(off?.home) || 0, 0) + Math.max(Number(off?.away) || 0, 0);
    const offHomeW = offTotal ? ((Number(off?.home) || 0) / offTotal) * 100 : 50;
    const onTotal = Math.max(Number(on?.home) || 0, 0) + Math.max(Number(on?.away) || 0, 0);
    const onHomeW = onTotal ? ((Number(on?.home) || 0) / onTotal) * 100 : 50;
    const offTip = tipAttrs('Tiros fuera');
    const onTip = tipAttrs('Disparos a puerta');

    return `<div class="ms-attack-graph">
        <div class="ms-attack-off"${offTip}>
          <div class="ms-attack-off-side home" style="width:${offHomeW.toFixed(1)}%">
            <span class="ms-attack-off-val">${esc(off?.home ?? 0)}</span>
          </div>
          <div class="ms-attack-off-side away" style="flex:1">
            <span class="ms-attack-off-val">${esc(off?.away ?? 0)}</span>
          </div>
        </div>
        <div class="ms-attack-on"${onTip}>
          <div class="ms-attack-on-side home" style="width:${onHomeW.toFixed(1)}%">
            <span class="ms-attack-on-val">${esc(on?.home ?? 0)}</span>
          </div>
          <div class="ms-attack-on-side away" style="flex:1">
            <span class="ms-attack-on-val">${esc(on?.away ?? 0)}</span>
          </div>
        </div>
        <div class="ms-attack-labels">
          <span>Tiros fuera</span>
          <span>Disparos a puerta</span>
        </div>
      </div>`;
  }

  function renderSection(title, rows) {
    const content = (rows || []).map(renderRow).join('');
    if (!content) return '';
    return `<section class="ms-section">
      <h4 class="ms-section-title">${esc(title)}</h4>
      ${content}
    </section>`;
  }

  function renderPanel(payload) {
    const s = payload.stats;
    if (!s) {
      return '<div class="match-stats-empty">Estadísticas no disponibles todavía.</div>';
    }

    const attackHtml = renderAttackGraph(s.attack);
    const attackSection = attackHtml
      ? `<section class="ms-section"><h4 class="ms-section-title">Ataque</h4>${attackHtml}</section>`
      : '';

    return `<div class="ms-panel">
      ${renderSection('Estadísticas generales', s.general)}
      ${attackSection}
      ${renderSection('Defensa', s.defense)}
      ${renderSection('Distribución', s.distribution)}
      ${renderSection('Disciplina', s.discipline)}
    </div>`;
  }

  function panelSignature(payload) {
    if (!payload?.stats) return '';
    return JSON.stringify(payload.stats);
  }

  function freezePayload(matchId, payload, signature) {
    if (!matchId || !payload?.stats) return;
    frozen.set(matchId, {
      lastPayload: payload,
      lastSignature: signature ?? panelSignature(payload),
    });
  }

  function renderFrozen(matchId, container) {
    const fc = frozen.get(matchId);
    if (!fc?.lastPayload) return false;
    renderBody(container, fc.lastPayload, {
      lastPayload: fc.lastPayload,
      lastSignature: fc.lastSignature,
    });
    return true;
  }

  function showTip(title, body, evt) {
    const tip = document.getElementById('pieTooltip');
    if (!tip) return;
    tip.innerHTML = `<strong>${title}</strong>${body}`;
    tip.classList.remove('hidden');
    tip.setAttribute('aria-hidden', 'false');
    moveTip(evt);
  }

  function moveTip(evt) {
    const tip = document.getElementById('pieTooltip');
    if (!tip || tip.classList.contains('hidden')) return;
    const pad = 12;
    let x = evt.clientX;
    let y = evt.clientY - 10;
    const rect = tip.getBoundingClientRect();
    if (x - rect.width / 2 < pad) x = pad + rect.width / 2;
    if (x + rect.width / 2 > window.innerWidth - pad) x = window.innerWidth - pad - rect.width / 2;
    if (y - rect.height < pad) y = evt.clientY + 18;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }

  function hideTip() {
    const tip = document.getElementById('pieTooltip');
    if (!tip) return;
    tip.classList.add('hidden');
    tip.setAttribute('aria-hidden', 'true');
  }

  function bindTips(root) {
    if (!root) return;
    root.querySelectorAll('.ms-tip').forEach((el) => {
      el.addEventListener('mouseenter', (e) => {
        showTip(el.dataset.tipTitle || '', el.dataset.tipText || '', e);
      });
      el.addEventListener('mousemove', moveTip);
      el.addEventListener('mouseleave', hideTip);
    });
  }

  function matchContext(matchId) {
    const el = document.getElementById(`match-${matchId}`);
    const competitionId = el?.dataset.competitionId || '';
    const date = el?.dataset.date || '';
    return { competitionId, date };
  }

  async function fetchStats(matchId, bustCache) {
    const refresh = bustCache ? '&refresh=1' : '';
    const { competitionId, date } = matchContext(matchId);
    const ctx = competitionId ? `&competitionId=${encodeURIComponent(competitionId)}&date=${encodeURIComponent(date)}` : '';
    const res = await fetch(`/api/matches/stats?matchId=${matchId}${ctx}${refresh}&_=${Date.now()}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    return res.json();
  }

  function renderBody(container, payload, state) {
    if (!payload.ok) {
      if (state?.lastPayload) return;
      container.innerHTML = `<div class="match-stats-empty">${esc(payload.error || 'No se pudieron cargar las estadísticas.')}</div>`;
      return;
    }
    if (!payload.available || !payload.stats) {
      if (state?.lastPayload) {
        renderBody(container, state.lastPayload, state);
        return;
      }
      container.innerHTML = '';
      container.closest('.match-stats-card')?.remove();
      return;
    }

    const sig = panelSignature(payload);
    if (state && state.lastSignature === sig && container.querySelector('.ms-panel')) {
      return;
    }

    container.innerHTML = renderPanel(payload);
    bindTips(container);
    if (state) {
      state.lastPayload = payload;
      state.lastSignature = sig;
    }
  }

  function stopPolling(state) {
    if (!state) return;
    state.isLive = false;
    clearInterval(state.timer);
    state.timer = null;
  }

  async function poll(state) {
    if (!state.active || !state.isLive) return;
    try {
      const payload = await fetchStats(state.matchId, false);
      if (!payload.ok || !payload.available) {
        if (payload.status !== 'live') {
          freezePayload(state.matchId, state.lastPayload, state.lastSignature);
          stopPolling(state);
        }
        return;
      }
      renderBody(state.container, payload, state);
      if (payload.status !== 'live') {
        freezePayload(state.matchId, payload, state.lastSignature);
        stopPolling(state);
      }
    } catch {
      /* keep last panel */
    }
  }

  function start(matchId, container, isLive) {
    if (!matchId || !container) return;

    const prev = active.get(matchId);
    const cachedPayload = prev?.lastPayload;
    const sameContainer = prev?.container === container;

    if (prev) {
      prev.active = false;
      clearInterval(prev.timer);
      active.delete(matchId);
    }

    const card = container.closest('.match-stats-card');
    if (card) card.hidden = false;

    const state = {
      matchId,
      container,
      active: true,
      timer: null,
      isLive: !!isLive,
      lastPayload: sameContainer ? cachedPayload : null,
      lastSignature: sameContainer ? prev?.lastSignature : null,
    };
    active.set(matchId, state);

    if (cachedPayload && container.querySelector('.ms-panel')) {
      /* DOM intact — polling will refresh silently */
    } else if (cachedPayload) {
      renderBody(container, cachedPayload, state);
    } else {
      container.innerHTML = '<div class="match-stats-loading"><span class="spinner"></span> Cargando estadísticas…</div>';
    }

    const shouldFetch = isLive || !frozen.has(matchId);
    if (!shouldFetch && renderFrozen(matchId, container)) {
      return;
    }

    fetchStats(matchId, isLive && !cachedPayload).then((payload) => {
      if (!state.active || state.container !== container) return;
      renderBody(container, payload, state);
      if (payload.status === 'live' && state.isLive && !state.timer) {
        state.timer = setInterval(() => poll(state), POLL_MS);
        return;
      }
      if (payload.status !== 'live' && payload.available && payload.stats) {
        freezePayload(matchId, payload, state.lastSignature);
        stopPolling(state);
      }
    }).catch(() => {
      if (!state.active || state.container !== container) return;
      if (!state.lastPayload) {
        container.innerHTML = '<div class="match-stats-empty">No se pudieron cargar las estadísticas.</div>';
      }
    });
  }

  function stop(matchId) {
    const state = active.get(matchId);
    if (!state) return;
    if (!state.isLive && state.lastPayload?.stats) {
      freezePayload(matchId, state.lastPayload, state.lastSignature);
    }
    state.active = false;
    clearInterval(state.timer);
    active.delete(matchId);
  }

  function stopAll() {
    [...active.keys()].forEach(stop);
  }

  function loadForMatch(matchId, isLive) {
    const body = document.getElementById(`match-stats-${matchId}`);
    if (!body) return;

    if (!isLive) {
      if (renderFrozen(matchId, body)) return;
    } else {
      frozen.delete(matchId);
    }

    const state = active.get(matchId);
    if (state?.active && state.container === body && body.querySelector('.ms-panel')) {
      state.isLive = !!isLive;
      if (isLive && !state.timer) {
        state.timer = setInterval(() => poll(state), POLL_MS);
      } else if (!isLive) {
        freezePayload(matchId, state.lastPayload, state.lastSignature);
        stopPolling(state);
      }
      return;
    }

    start(matchId, body, isLive);
  }

  function renderSlot(m) {
    if (m.status !== 'live' && m.status !== 'finished') return '';
    return `<div class="card match-stats-card" data-match-stats data-match-id="${m.id}">
      <div class="card-title">Estadísticas del partido</div>
      <div class="match-stats-body" id="match-stats-${m.id}"></div>
    </div>`;
  }

  global.CodedSportsMatchStats = {
    start,
    stop,
    stopAll,
    loadForMatch,
    renderSlot,
  };
})(window);
