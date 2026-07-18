(function (global) {
  const reduceMotionQuery = typeof matchMedia === 'function'
    ? matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  function reduceMotion() {
    return !!(reduceMotionQuery && reduceMotionQuery.matches);
  }

  function hashHue(str) {
    const s = String(str || '');
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h) % 360;
  }

  // ---------------------------------------------------------------
  // Ambient background: gradient mesh reacting to pointer / tilt
  // ---------------------------------------------------------------
  let ambientEl = null;
  let ambientRaf = null;
  let motionRequested = false;
  const ambientTarget = { x: 50, y: 40 };
  const ambientCurrent = { x: 50, y: 40 };

  function ambientLoop() {
    ambientCurrent.x += (ambientTarget.x - ambientCurrent.x) * 0.06;
    ambientCurrent.y += (ambientTarget.y - ambientCurrent.y) * 0.06;
    if (ambientEl) {
      ambientEl.style.setProperty('--ambient-x', `${ambientCurrent.x}%`);
      ambientEl.style.setProperty('--ambient-y', `${ambientCurrent.y}%`);
    }
    ambientRaf = requestAnimationFrame(ambientLoop);
  }

  function onPointerMove(e) {
    if (reduceMotion()) return;
    ambientTarget.x = (e.clientX / window.innerWidth) * 100;
    ambientTarget.y = (e.clientY / window.innerHeight) * 100;
  }

  function onDeviceOrientation(e) {
    if (reduceMotion()) return;
    const gamma = typeof e.gamma === 'number' ? e.gamma : 0;
    const beta = typeof e.beta === 'number' ? e.beta : 0;
    ambientTarget.x = 50 + Math.max(-1, Math.min(1, gamma / 45)) * 40;
    ambientTarget.y = 50 + Math.max(-1, Math.min(1, (beta - 45) / 45)) * 40;
  }

  function requestMotionPermissionOnce() {
    if (motionRequested) return;
    motionRequested = true;
    const DOE = global.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      DOE.requestPermission()
        .then((state) => {
          if (state === 'granted') window.addEventListener('deviceorientation', onDeviceOrientation);
        })
        .catch(() => {});
    } else if ('ondeviceorientation' in window) {
      window.addEventListener('deviceorientation', onDeviceOrientation);
    }
  }

  function initAmbient() {
    ambientEl = document.getElementById('ambientBg');
    if (!ambientEl) return;
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('touchstart', requestMotionPermissionOnce, { passive: true, once: true });
    window.addEventListener('pointerdown', requestMotionPermissionOnce, { passive: true, once: true });
    if (reduceMotion()) {
      ambientEl.style.setProperty('--ambient-x', '50%');
      ambientEl.style.setProperty('--ambient-y', '40%');
    } else {
      ambientRaf = requestAnimationFrame(ambientLoop);
    }
  }

  // ---------------------------------------------------------------
  // Team-color tint on the open match card
  // ---------------------------------------------------------------
  function applyTint(matchEl) {
    const names = matchEl.querySelectorAll('.team-name');
    if (!names.length) return;
    const combined = Array.from(names).map((n) => n.textContent).join('|');
    matchEl.style.setProperty('--tint-hue', hashHue(combined));
  }

  function refreshOpenTint() {
    const openMatch = document.querySelector('#matchesContainer .match.is-open');
    if (openMatch) applyTint(openMatch);
  }

  function initTint() {
    const container = document.getElementById('matchesContainer');
    if (!container) return;
    refreshOpenTint();
    const observer = new MutationObserver(() => refreshOpenTint());
    observer.observe(container, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  // ---------------------------------------------------------------
  // Stadium atmosphere: canvas light sweep + bokeh, live matches only
  // ---------------------------------------------------------------
  let atmosphereCanvas = null;
  let atmosphereCtx = null;
  let atmosphereRaf = null;
  let atmosphereActive = false;
  let particles = [];

  function makeParticles(w, h) {
    const count = 16;
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 24 + Math.random() * 46,
        speed: 0.05 + Math.random() * 0.15,
        hue: 200 + Math.random() * 40,
      });
    }
    return arr;
  }

  function resizeAtmosphere() {
    if (!atmosphereCanvas) return;
    atmosphereCanvas.width = atmosphereCanvas.clientWidth;
    atmosphereCanvas.height = atmosphereCanvas.clientHeight;
    particles = makeParticles(atmosphereCanvas.width, atmosphereCanvas.height);
  }

  function drawAtmosphereFrame(t) {
    if (!atmosphereCtx || !atmosphereCanvas) return;
    const w = atmosphereCanvas.width;
    const h = atmosphereCanvas.height;
    if (!w || !h) return;
    atmosphereCtx.clearRect(0, 0, w, h);

    const sweepX = ((t / 6000) % 1) * (w + 400) - 200;
    const grad = atmosphereCtx.createLinearGradient(sweepX, 0, sweepX + 260, h);
    grad.addColorStop(0, 'rgba(94,179,246,0)');
    grad.addColorStop(0.5, 'rgba(94,179,246,0.07)');
    grad.addColorStop(1, 'rgba(94,179,246,0)');
    atmosphereCtx.fillStyle = grad;
    atmosphereCtx.fillRect(0, 0, w, h);

    particles.forEach((p) => {
      p.x += p.speed;
      if (p.x - p.r > w) p.x = -p.r;
      const bokeh = atmosphereCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      bokeh.addColorStop(0, `hsla(${p.hue}, 80%, 65%, 0.10)`);
      bokeh.addColorStop(1, `hsla(${p.hue}, 80%, 65%, 0)`);
      atmosphereCtx.fillStyle = bokeh;
      atmosphereCtx.beginPath();
      atmosphereCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      atmosphereCtx.fill();
    });
  }

  function atmosphereLoop(t) {
    drawAtmosphereFrame(t);
    if (atmosphereActive && !reduceMotion()) {
      atmosphereRaf = requestAnimationFrame(atmosphereLoop);
    }
  }

  function setAtmosphereActive(active) {
    if (!atmosphereCanvas || active === atmosphereActive) return;
    atmosphereActive = active;
    atmosphereCanvas.classList.toggle('hidden', !active);
    cancelAnimationFrame(atmosphereRaf);
    if (!active) return;
    resizeAtmosphere();
    if (reduceMotion()) {
      drawAtmosphereFrame(0);
    } else {
      atmosphereRaf = requestAnimationFrame(atmosphereLoop);
    }
  }

  function checkLiveMatches() {
    const hasLive = !!document.querySelector('#matchesContainer .match[data-live="1"]');
    setAtmosphereActive(hasLive);
  }

  function initAtmosphere() {
    atmosphereCanvas = document.getElementById('stadiumAtmosphere');
    const container = document.getElementById('matchesContainer');
    if (!atmosphereCanvas || !container) return;
    atmosphereCtx = atmosphereCanvas.getContext('2d');
    window.addEventListener('resize', () => {
      if (atmosphereActive) resizeAtmosphere();
    }, { passive: true });
    checkLiveMatches();
    const observer = new MutationObserver(() => checkLiveMatches());
    observer.observe(container, { childList: true, subtree: true });
  }

  // ---------------------------------------------------------------
  // Goal celebration
  // ---------------------------------------------------------------
  function celebrateGoal(pitchInner, moment) {
    if (!pitchInner) return;
    const hue = hashHue(moment && (moment.team || moment.typeLabel));
    const wrap = document.createElement('div');
    wrap.className = 'goal-celebration' + (reduceMotion() ? ' is-reduced' : '');
    wrap.style.setProperty('--celebrate-hue', hue);
    if (!reduceMotion()) {
      for (let i = 0; i < 14; i++) {
        const bit = document.createElement('span');
        bit.className = 'goal-confetti-bit';
        bit.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
        bit.style.setProperty('--dy', `${-60 - Math.random() * 80}px`);
        bit.style.setProperty('--delay', `${Math.random() * 0.15}s`);
        bit.style.setProperty('--hue', `${hue + (Math.random() - 0.5) * 60}`);
        wrap.appendChild(bit);
      }
    }
    pitchInner.appendChild(wrap);
    setTimeout(() => wrap.remove(), reduceMotion() ? 900 : 1600);
  }

  function init() {
    initAmbient();
    initTint();
    initAtmosphere();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.CodedSportsVisualFx = {
    celebrateGoal,
  };
})(window);
