(function (global) {
  const POLL_MS = 8000;
  const EVENT_FLASH_MS = 6000;
  const active = new Map();

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pitchSvg(ball, trail, patternId) {
    const bx = ball?.x ?? 50;
    const by = ball?.y ?? 32;
    const pid = patternId || 'ltGrass';
    const trailPts = (trail || [])
      .map((p) => `${p.x},${p.y}`)
      .join(' ');
    const trailLine = trailPts ? `<polyline class="pitch-trail" points="${trailPts} ${bx},${by}" />` : '';

    return `<svg class="live-tracker-pitch" viewBox="0 0 100 64" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <pattern id="${pid}" width="4" height="64" patternUnits="userSpaceOnUse">
          <rect width="2" height="64" fill="#2d6a3e"/>
          <rect x="2" width="2" height="64" fill="#358748"/>
        </pattern>
      </defs>
      <rect class="pitch-grass" x="0" y="0" width="100" height="64"/>
      <rect class="pitch-line" x="2" y="2" width="96" height="60" rx="0.5"/>
      <line class="pitch-line" x1="50" y1="2" x2="50" y2="62"/>
      <circle class="pitch-line" cx="50" cy="32" r="8"/>
      <rect class="pitch-line" x="2" y="16" width="14" height="32"/>
      <rect class="pitch-line" x="84" y="16" width="14" height="32"/>
      <rect class="pitch-line" x="2" y="24" width="5" height="16"/>
      <rect class="pitch-line" x="93" y="24" width="5" height="16"/>
      ${trailLine}
      <circle class="live-tracker-ball" cx="${bx}" cy="${by}" r="1.8" fill="#fff" stroke="#111" stroke-width="0.35"/>
      <circle cx="${bx}" cy="${by}" r="0.55" fill="#111"/>
    </svg>`;
  }

  function momentOverlay(moment) {
    if (!moment?.text) return '';

    if (moment.type === 'substitution' && moment.players) {
      return `<div class="live-tracker-event" data-lt-event>
        <div class="live-tracker-event-head">${esc(moment.team)}</div>
        <div class="live-tracker-event-title">Sustitución · ${esc(moment.minute)}</div>
        <div class="live-tracker-event-row">
          <div><div class="lt-player">${esc(moment.players.playerOut)}</div><div class="lt-meta">Sale</div></div>
          <span class="lt-badge out">SALE ▶</span>
        </div>
        <div class="live-tracker-event-row">
          <div><div class="lt-player">${esc(moment.players.playerIn)}</div><div class="lt-meta">Entra</div></div>
          <span class="lt-badge in">◀ ENTRA</span>
        </div>
      </div>`;
    }

    const head = moment.team || moment.typeLabel || 'Jugada';
    const title = `${moment.typeLabel || 'Jugada'}${moment.minute ? ` · ${moment.minute}` : ''}`;

    return `<div class="live-tracker-event" data-lt-event>
      <div class="live-tracker-event-head">${esc(head)}</div>
      <div class="live-tracker-event-title">${esc(title)}</div>
      <div class="live-tracker-event-row">
        <div><div class="lt-player">${esc(moment.text)}</div></div>
      </div>
    </div>`;
  }

  function statusBarHtml(data) {
    const moment = data.currentMoment || data.matchEvents?.[0] || {};
    const situation = data.situation || {};
    const level = situation.level || 'neutral';
    const minute = moment.minute || data.clock || '';
    const team = moment.team || situation.team || '';
    const text = moment.text || situation.label || 'Esperando jugada…';
    const typeLabel = moment.typeLabel || situation.typeLabel || '';

    return `<div class="live-tracker-status ${esc(level)}" data-lt-status>
      ${minute ? `<div class="live-tracker-status-minute">${esc(minute)} · ${esc(typeLabel || 'En juego')}</div>` : (typeLabel ? `<div class="live-tracker-status-minute">${esc(typeLabel)}</div>` : '')}
      ${team ? `<div class="live-tracker-status-team">${esc(team)}</div>` : ''}
      <div class="live-tracker-status-label">${esc(text)}</div>
    </div>`;
  }

  function eventsHtml(matchEvents, currentId) {
    if (!matchEvents?.length) {
      return '<div class="live-tracker-loading">Esperando jugadas del partido…</div>';
    }
    return matchEvents.map((p, index) =>
      `<div class="live-tracker-feed-item ${esc(p.type)}${p.id === currentId || index === 0 ? ' is-current' : ''}" data-event-id="${esc(p.id)}">
        <span class="live-tracker-feed-min" title="${esc(p.typeLabel)}">${esc(p.minute || '—')}</span>
        <span class="live-tracker-feed-text">${esc(p.text)}</span>
      </div>`
    ).join('');
  }

  function renderShell(matchId) {
    return `<section class="live-tracker" id="live-tracker-${matchId}" aria-label="Tablero en vivo">
      <div class="live-tracker-head">
        <span class="live-tracker-title">Tablero en vivo</span>
        <span class="live-tracker-live"><i></i> En vivo</span>
      </div>
      <div class="live-tracker-pitch-wrap" data-lt-pitch>
        <div class="live-tracker-pitch-inner">
          <div class="live-tracker-loading">Cargando tablero…</div>
        </div>
      </div>
      <div class="live-tracker-events card" data-lt-events>
        <div class="card-title live-tracker-events-title">Eventos del partido</div>
        <div class="live-tracker-feed" data-lt-feed></div>
      </div>
    </section>`;
  }

  function scrollFeedToTop(feed) {
    if (!feed) return;
    requestAnimationFrame(() => {
      feed.scrollTop = 0;
    });
  }

  function flashOverlay(pitchInner, state) {
    const overlay = pitchInner.querySelector('[data-lt-event]');
    if (!overlay) return;
    overlay.classList.remove('is-visible');
    requestAnimationFrame(() => {
      overlay.classList.add('is-visible');
      clearTimeout(state.flashTimer);
      state.flashTimer = setTimeout(() => {
        overlay.classList.remove('is-visible');
      }, EVENT_FLASH_MS);
    });
  }

  function updatePitch(pitchInner, data, matchId, state) {
    const patternId = `ltGrass-${matchId}`;
    const moment = data.currentMoment || data.matchEvents?.[0] || null;
    const overlayHtml = momentOverlay(moment);
    const seq = data.sequence ?? 0;
    const momentKey = moment?.id || '';
    const ballKey = `${data.ball?.x}-${data.ball?.y}`;

    pitchInner.innerHTML = `
      ${pitchSvg(data.ball, data.trail, patternId)}
      ${statusBarHtml(data)}
      ${overlayHtml}`;

    state.lastBallKey = ballKey;

    if (moment && (seq !== state.lastSequence || momentKey !== state.lastMomentId)) {
      flashOverlay(pitchInner, state);
    } else if (overlayHtml) {
      requestAnimationFrame(() => {
        pitchInner.querySelector('[data-lt-event]')?.classList.add('is-visible');
      });
    }
  }

  function updateFeed(feed, matchEvents, currentId, state) {
    const atTop = feed.scrollTop < 8;
    feed.innerHTML = eventsHtml(matchEvents, currentId);
    if (atTop) scrollFeedToTop(feed);
  }

  function updateDom(root, data, matchId, state) {
    const pitchInner = root.querySelector('.live-tracker-pitch-inner');
    const feed = root.querySelector('[data-lt-feed]');
    if (!pitchInner || !feed) return;

    updatePitch(pitchInner, data, matchId, state);
    updateFeed(feed, data.matchEvents, data.currentMoment?.id, state);
  }

  async function fetchTracker(matchId, bustCache) {
    const ts = Date.now();
    const refresh = bustCache ? '&refresh=1' : '';
    const res = await fetch(`/api/matches/tracker?matchId=${matchId}${refresh}&_=${ts}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    return res.json();
  }

  async function poll(state) {
    if (!state.active) return;
    try {
      const payload = await fetchTracker(state.matchId, false);
      if (!payload.ok || !payload.live) {
        stop(state.matchId);
        return;
      }

      updateDom(state.root, payload.tracker, state.matchId, state);
      state.lastSequence = payload.tracker?.sequence ?? 0;
      state.lastMomentId = payload.tracker?.currentMoment?.id ?? null;
    } catch {
      const feed = state.root.querySelector('[data-lt-feed]');
      if (feed && !feed.querySelector('.live-tracker-feed-item')) {
        feed.innerHTML = '<div class="live-tracker-error">No se pudo actualizar el tablero</div>';
      }
    }
  }

  function start(matchId, container) {
    if (!matchId || !container) return;
    stop(matchId);

    container.innerHTML = renderShell(matchId);
    const root = container.querySelector('.live-tracker');
    if (!root) return;

    const state = {
      matchId,
      root,
      container,
      active: true,
      lastSequence: -1,
      lastMomentId: null,
      lastBallKey: null,
      flashTimer: null,
      timer: null,
    };

    active.set(matchId, state);

    fetchTracker(matchId, true).then((payload) => {
      if (!state.active) return;
      if (payload.ok && payload.live && payload.tracker) {
        updateDom(root, payload.tracker, matchId, state);
        state.lastSequence = payload.tracker.sequence ?? 0;
        state.lastMomentId = payload.tracker.currentMoment?.id ?? null;
      } else if (payload.error) {
        const feed = root.querySelector('[data-lt-feed]');
        if (feed) feed.innerHTML = `<div class="live-tracker-error">${esc(payload.error)}</div>`;
      }
    }).catch(() => {});

    state.timer = setInterval(() => poll(state), POLL_MS);
  }

  function stop(matchId) {
    const state = active.get(matchId);
    if (!state) return;
    state.active = false;
    clearInterval(state.timer);
    clearTimeout(state.flashTimer);
    active.delete(matchId);
  }

  function stopAll() {
    [...active.keys()].forEach(stop);
  }

  function syncOpenLiveMatches() {
    document.querySelectorAll('.match.is-open[data-live="1"]').forEach((el) => {
      const matchId = Number(el.dataset.id);
      const slot = el.querySelector('[data-live-tracker]');
      if (slot && !active.has(matchId)) {
        start(matchId, slot);
      }
    });
    active.forEach((state, matchId) => {
      const el = document.getElementById(`match-${matchId}`);
      if (!el?.classList.contains('is-open') || el.dataset.live !== '1') {
        stop(matchId);
      }
    });
  }

  global.CodedSportsLiveTracker = {
    start,
    stop,
    stopAll,
    syncOpenLiveMatches,
    renderSlot(matchId) {
      return `<div class="live-tracker-slot" data-live-tracker data-match-id="${matchId}"></div>`;
    },
  };
})(window);
