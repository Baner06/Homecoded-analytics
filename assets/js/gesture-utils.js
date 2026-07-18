(function (global) {
  const SHEET_DISMISS_DISTANCE = 90;
  const SHEET_DISMISS_VELOCITY = 0.5; // px/ms
  const SWIPE_DAY_DISTANCE = 60;
  const PULL_REFRESH_DISTANCE = 70;

  // ---------------------------------------------------------------
  // Generic pointer-drag primitive
  // ---------------------------------------------------------------
  function bindDrag(el, { onStart, onMove, onEnd } = {}) {
    if (!el) return () => {};
    let active = false;
    let startX = 0;
    let startY = 0;
    let startT = 0;

    function down(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      active = true;
      startX = e.clientX;
      startY = e.clientY;
      startT = performance.now();
      el.setPointerCapture?.(e.pointerId);
      onStart && onStart(e);
    }
    function move(e) {
      if (!active) return;
      onMove && onMove({ dx: e.clientX - startX, dy: e.clientY - startY, originalEvent: e });
    }
    function up(e) {
      if (!active) return;
      active = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const dt = Math.max(1, performance.now() - startT);
      onEnd && onEnd({ dx, dy, velocity: Math.abs(dy) / dt, originalEvent: e });
    }

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);

    return function unbind() {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }

  // ---------------------------------------------------------------
  // Draggable bottom sheet: drag the handle, release past threshold
  // to trigger the panel's own existing close button.
  // ---------------------------------------------------------------
  function createDraggableSheet(panelEl, handleEl, closeBtnId) {
    if (!panelEl || !handleEl) return;
    let dragY = 0;

    bindDrag(handleEl, {
      onStart() {
        panelEl.classList.add('sheet-dragging');
      },
      onMove({ dy }) {
        dragY = Math.max(0, dy);
        panelEl.style.transform = dragY ? `translateY(${dragY}px)` : '';
      },
      onEnd({ dy, velocity }) {
        panelEl.classList.remove('sheet-dragging');
        panelEl.style.transform = '';
        const shouldDismiss = dragY > SHEET_DISMISS_DISTANCE || (dy > 20 && velocity > SHEET_DISMISS_VELOCITY);
        dragY = 0;
        if (shouldDismiss) document.getElementById(closeBtnId)?.click();
      },
    });
  }

  function initSheets() {
    createDraggableSheet(
      document.querySelector('#installSheet .install-card'),
      document.querySelector('#installSheet .sheet-handle'),
      'btnInstallLater'
    );
    createDraggableSheet(
      document.querySelector('#toolsOverlay .tools-panel'),
      document.querySelector('#toolsOverlay .sheet-handle'),
      'btnCloseTools'
    );
    createDraggableSheet(
      document.querySelector('#bracketOverlay .bracket-panel'),
      document.querySelector('#bracketOverlay .sheet-handle'),
      'btnCloseBracket'
    );
  }

  // ---------------------------------------------------------------
  // Swipe between days
  // ---------------------------------------------------------------
  function initSwipeDays() {
    const zone = document.getElementById('matchesContainer');
    if (!zone) return;
    let startX = 0;
    let startY = 0;
    let tracking = false;

    zone.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    }, { passive: true });

    zone.addEventListener('touchend', (e) => {
      if (!tracking) return;
      tracking = false;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) < SWIPE_DAY_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      const calendarBar = document.getElementById('calendarBar');
      if (calendarBar && calendarBar.style.display === 'none') return;
      document.getElementById(dx < 0 ? 'btnNextDay' : 'btnPrevDay')?.click();
    }, { passive: true });
  }

  // ---------------------------------------------------------------
  // Pull to refresh
  // ---------------------------------------------------------------
  function initPullToRefresh() {
    const indicator = document.getElementById('pullToRefreshIndicator');
    const refreshBtn = document.getElementById('btnRefreshFab');
    if (!indicator || !refreshBtn) return;
    let startY = 0;
    let pulling = false;
    let dist = 0;

    window.addEventListener('touchstart', (e) => {
      if (window.scrollY > 0 || e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      pulling = true;
      dist = 0;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!pulling) return;
      dist = Math.max(0, e.touches[0].clientY - startY);
      if (dist <= 0) return;
      const clamped = Math.min(dist, PULL_REFRESH_DISTANCE * 1.6);
      indicator.style.setProperty('--ptr-dist', `${clamped}px`);
      indicator.classList.add('is-pulling');
      indicator.classList.toggle('is-armed', clamped >= PULL_REFRESH_DISTANCE);
    }, { passive: true });

    window.addEventListener('touchend', () => {
      if (!pulling) return;
      pulling = false;
      const armed = dist >= PULL_REFRESH_DISTANCE;
      indicator.classList.remove('is-pulling', 'is-armed');
      indicator.style.setProperty('--ptr-dist', '0px');
      dist = 0;
      if (armed) refreshBtn.click();
    }, { passive: true });
  }

  function init() {
    initSheets();
    initSwipeDays();
    initPullToRefresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.CodedSportsGestures = {
    bindDrag,
    createDraggableSheet,
  };
})(window);
