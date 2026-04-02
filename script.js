/**
 * Reto 35K — Runner en perspectiva (vista desde atrás, estilo Pepsiman).
 * Solo 3 carriles: esquivar cambiando de carril (sin salto). Vanilla Canvas = ideal para GitHub Pages.
 * Opcional futuro: Phaser/Pixi vía CDN si quisieras partículas o atlases; este archivo prioriza carga rápida.
 */

(function () {
  'use strict';

  const LEVELS = [
    {
      km: 5,
      raceName: 'Media maratón de Tuluá',
      hudShort: '5K · Tuluá',
      theme: 'street',
      durationMs: 45_000,
      zSpeed: 380,
      spawnMin: 1.55,
      spawnMax: 2.65,
      spawnChance: 0.42,
    },
    {
      km: 10,
      raceName: 'Media maratón de Buga',
      hudShort: '10K · Buga',
      theme: 'trial',
      durationMs: 60_000,
      zSpeed: 460,
      spawnMin: 1.35,
      spawnMax: 2.25,
      spawnChance: 0.46,
    },
    {
      km: 15,
      raceName: 'Sevilla Trial',
      hudShort: '15K · Sevilla Trial',
      theme: 'trial',
      durationMs: 90_000,
      zSpeed: 520,
      spawnMin: 1.2,
      spawnMax: 2.05,
      spawnChance: 0.48,
    },
    {
      km: 21,
      raceName: 'Media maratón del Quindío',
      hudShort: '21K · Quindío',
      theme: 'street',
      durationMs: 120_000,
      zSpeed: 600,
      spawnMin: 1.05,
      spawnMax: 1.85,
      spawnChance: 0.5,
    },
  ];

  const TYPE_DEF = {
    cone: { emoji: '🚧', size: 1 },
    pothole: { emoji: '🕳️', size: 0.95 },
    dog: { emoji: '🐕', size: 1.05 },
    rock: { emoji: '🪨', size: 1 },
    log: { emoji: '🪵', size: 1 },
    cow: { emoji: '🐄', size: 1.15 },
  };
  const STREET_TYPES = ['cone', 'pothole', 'dog'];
  const TRIAL_TYPES = ['rock', 'log', 'cow'];

  /**
   * Audio con Web Audio API (sin archivos MP3): música en bucle + SFX. Compatible con GitHub Pages.
   * El navegador exige un gesto del usuario para iniciar el audio (al pulsar "Empezar carrera").
   */
  const GameAudio = (function () {
    let ctx = null;
    let masterGain = null;
    let musicGain = null;
    let sfxGain = null;
    let bgmTimer = null;
    let melStep = 0;
    let muted = false;
    let muteBtn = null;

    function loadMute() {
      try {
        muted = localStorage.getItem('cumplemafe_muted') === '1';
      } catch (e) {
        muted = false;
      }
    }

    function saveMute() {
      try {
        localStorage.setItem('cumplemafe_muted', muted ? '1' : '0');
      } catch (e) {}
    }

    const MELODY = [
      { f: 261.63, d: 0.11 },
      { f: 329.63, d: 0.11 },
      { f: 392.0, d: 0.11 },
      { f: 329.63, d: 0.11 },
      { f: 293.66, d: 0.11 },
      { f: 349.23, d: 0.11 },
      { f: 392.0, d: 0.11 },
      { f: 261.63, d: 0.14 },
    ];

    /** Volumen general (sube música + SFX a la vez). */
    const MASTER_VOL = 0.78;
    const MUSIC_BUS = 0.38;
    const SFX_BUS = 0.82;

    function init() {
      loadMute();
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!ctx) {
        ctx = new AC();
        masterGain = ctx.createGain();
        masterGain.gain.value = muted ? 0 : MASTER_VOL;
        masterGain.connect(ctx.destination);
        musicGain = ctx.createGain();
        musicGain.gain.value = MUSIC_BUS;
        musicGain.connect(masterGain);
        sfxGain = ctx.createGain();
        sfxGain.gain.value = SFX_BUS;
        sfxGain.connect(masterGain);
      }
      if (ctx.state === 'suspended') ctx.resume();
      if (masterGain && ctx) {
        masterGain.gain.cancelScheduledValues(ctx.currentTime);
        masterGain.gain.setValueAtTime(muted ? 0 : MASTER_VOL, ctx.currentTime);
      }
      return ctx;
    }

    function playNoteAt(freq, dur, dest, type, startT) {
      if (!ctx || muted) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, startT);
      g.gain.setValueAtTime(0.0001, startT);
      g.gain.exponentialRampToValueAtTime(0.38, startT + 0.028);
      g.gain.exponentialRampToValueAtTime(0.0001, startT + Math.max(0.06, dur));
      osc.connect(g);
      g.connect(dest);
      osc.start(startT);
      osc.stop(startT + dur + 0.1);
    }

    function bgmTick() {
      if (!ctx || muted) return;
      const n = MELODY[melStep % MELODY.length];
      melStep++;
      playNoteAt(n.f, n.d, musicGain, 'triangle', ctx.currentTime);
    }

    function startBgm() {
      stopBgm();
      if (muted) return;
      init();
      if (!ctx) return;
      melStep = 0;
      bgmTimer = setInterval(bgmTick, 178);
    }

    function stopBgm() {
      if (bgmTimer) {
        clearInterval(bgmTimer);
        bgmTimer = null;
      }
    }

    function updateMuteBtn() {
      if (!muteBtn) return;
      muteBtn.textContent = muted ? '🔇' : '🔊';
      muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    }

    function bindMuteButton(el) {
      muteBtn = el;
      loadMute();
      updateMuteBtn();
    }

    function toggleMute() {
      muted = !muted;
      saveMute();
      init();
      if (masterGain && ctx) {
        masterGain.gain.cancelScheduledValues(ctx.currentTime);
        masterGain.gain.setValueAtTime(muted ? 0 : MASTER_VOL, ctx.currentTime);
      }
      if (muted) stopBgm();
      else if (document.getElementById('screen-game').classList.contains('active')) {
        startBgm();
      }
      updateMuteBtn();
    }

    function sfxLane(direction) {
      init();
      if (!ctx || muted) return;
      const f = direction < 0 ? 440 : 660;
      playNoteAt(f, 0.055, sfxGain, 'sine', ctx.currentTime);
    }

    function sfxHit() {
      init();
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 0.18);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.48, t + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(g);
      g.connect(sfxGain);
      osc.start(t);
      osc.stop(t + 0.22);
    }

    function sfxLevelDone() {
      init();
      if (!ctx || muted) return;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      let t = ctx.currentTime + 0.04;
      notes.forEach((f, i) => {
        playNoteAt(f, 0.13, sfxGain, 'sine', t + i * 0.1);
      });
    }

    function sfxVictory() {
      init();
      if (!ctx || muted) return;
      const seq = [
        [392, 0.1],
        [523.25, 0.1],
        [659.25, 0.1],
        [783.99, 0.14],
        [1046.5, 0.28],
      ];
      let t = ctx.currentTime + 0.06;
      seq.forEach(([f, d]) => {
        playNoteAt(f, d, sfxGain, 'triangle', t);
        t += d * 0.92;
      });
    }

    return {
      init,
      startBgm,
      stopBgm,
      toggleMute,
      bindMuteButton,
      sfxLane,
      sfxHit,
      sfxLevelDone,
      sfxVictory,
    };
  })();

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const screens = {
    menu: document.getElementById('screen-menu'),
    game: document.getElementById('screen-game'),
    between: document.getElementById('screen-between'),
    victory: document.getElementById('screen-victory'),
  };
  const hudLevel = document.getElementById('hud-level');
  const hudKm = document.getElementById('hud-km');
  const progressFill = document.getElementById('progress-fill');
  const metricsTime = document.getElementById('metrics-time');
  const betweenTitle = document.getElementById('between-title');
  const betweenMsg = document.getElementById('between-msg');
  const hitFlash = document.getElementById('hit-flash');

  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-continue').addEventListener('click', continueAfterLevel);
  const btnMute = document.getElementById('btn-mute');
  if (btnMute) {
    GameAudio.bindMuteButton(btnMute);
    btnMute.addEventListener('click', () => GameAudio.toggleMute());
  }
  document.getElementById('btn-replay').addEventListener('click', () => {
    GameAudio.stopBgm();
    showScreen('menu');
    currentLevelIndex = 0;
  });

  // --- Perspectiva: z grande = lejos, z -> 0 se acerca al jugador ---
  const Z_SPAWN = 2600;
  const Z_REMOVE = -350;
  /** Solo una comprobación por obstáculo cuando cruza este plano (evita dobles golpes). */
  const Z_PASS = 130;

  const LOGICAL_W = 800;
  const LOGICAL_H = 480;
  const HORIZON_Y = 105;
  const ROAD_BOTTOM = LOGICAL_H - 8;
  const LANE_SPREAD_BOTTOM = 108;
  const CX = LOGICAL_W / 2;

  let cssCanvasW = LOGICAL_W;
  let cssCanvasH = LOGICAL_H;

  let currentLevelIndex = 0;
  let levelStartTime = 0;
  let obstacles = [];
  let spawnTimer = 0;
  let nextSpawnIn = 1.5;
  let roadPhase = 0;
  let running = false;
  let rafId = 0;
  let lastTs = 0;

  /** Carril lógico: -1 izquierda, 0 centro, 1 derecha */
  let playerLane = 0;
  /** Interpolación visual hacia playerLane */
  let laneVisual = 0;

  let runPhase = 0;

  function showScreen(name) {
    Object.values(screens).forEach((el) => el.classList.remove('active'));
    screens[name].classList.add('active');
  }

  function startGame() {
    GameAudio.init();
    currentLevelIndex = 0;
    showScreen('game');
    // El canvas vive en una sección que al inicio está oculta (display:none) → clientWidth 0.
    // Hay que medir tras el reflow; si no, el buffer queda 0×0 (pantalla negra hasta un resize).
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resizeCanvas();
        beginLevel(0);
      });
    });
  }

  function beginLevel(idx) {
    resizeCanvas();
    currentLevelIndex = idx;
    levelStartTime = performance.now();
    obstacles = [];
    spawnTimer = 0;
    nextSpawnIn = 1.4 + Math.random() * 0.6;
    roadPhase = 0;
    playerLane = 0;
    laneVisual = 0;
    running = true;
    hudLevel.textContent = LEVELS[idx].raceName + ' · ' + LEVELS[idx].km + 'K';
    lastTs = 0;
    if (rafId) cancelAnimationFrame(rafId);
    GameAudio.startBgm();
    rafId = requestAnimationFrame(gameLoop);
  }

  function continueAfterLevel() {
    const next = currentLevelIndex + 1;
    if (next >= LEVELS.length) {
      showScreen('victory');
      return;
    }
    showScreen('game');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resizeCanvas();
        beginLevel(next);
      });
    });
  }

  function moveLane(delta) {
    if (!running) return;
    const prev = playerLane;
    playerLane = Math.max(-1, Math.min(1, playerLane + delta));
    if (playerLane !== prev) GameAudio.sfxLane(delta);
  }

  window.addEventListener('keydown', (e) => {
    if (!screens.game.classList.contains('active')) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      e.preventDefault();
      moveLane(-1);
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      e.preventDefault();
      moveLane(1);
    }
  });

  /** Mitad izquierda / derecha del canvas: un toque = un carril hacia ese lado. */
  canvas.addEventListener('pointerdown', (e) => {
    if (!screens.game.classList.contains('active')) return;
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    if (nx < 0.5) moveLane(-1);
    else moveLane(1);
  });

  /**
   * Convierte carril y profundidad z a posición en pantalla (pseudo-3D).
   * t = 1 cerca del jugador, 0 en horizonte.
   */
  function project(lane, z) {
    const t = 1 - z / Z_SPAWN;
    const clampedT = Math.max(0, Math.min(1, t));
    const ease = clampedT * clampedT;
    const spread = LANE_SPREAD_BOTTOM * (0.2 + 0.8 * ease);
    const x = CX + lane * spread;
    const y = HORIZON_Y + (ROAD_BOTTOM - HORIZON_Y - 95) * ease;
    const scale = 0.22 + 0.78 * ease;
    return { x, y, scale, t: clampedT };
  }

  function gameLoop(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;

    const L = LEVELS[currentLevelIndex];
    const elapsed = ts - levelStartTime;

    if (elapsed >= L.durationMs) {
      running = false;
      cancelAnimationFrame(rafId);
      onLevelComplete();
      return;
    }

    const progress = elapsed / L.durationMs;
    updateHud(L, progress, elapsed);

    const zSpeed = L.zSpeed;
    roadPhase += zSpeed * 0.00012 * dt;

    spawnTimer += dt;
    if (spawnTimer >= nextSpawnIn) {
      spawnTimer = 0;
      nextSpawnIn = L.spawnMin + Math.random() * (L.spawnMax - L.spawnMin);
      if (progress < 0.86 && Math.random() < L.spawnChance) spawnObstacle(L);
    }

    // Obstáculos avanzan hacia el jugador (z baja)
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.z -= zSpeed * dt;

      if (!o.scored && o.z <= Z_PASS) {
        o.scored = true;
        if (checkHit(o)) {
          restartCurrentLevel();
          return;
        }
      }
      if (o.z < Z_REMOVE) obstacles.splice(i, 1);
    }

    // Suavizado de carril (evita saltos bruscos visuales)
    const target = playerLane;
    laneVisual += (target - laneVisual) * Math.min(1, 10 * dt);

    runPhase += dt * 11;

    drawWorld(L, progress);
    rafId = requestAnimationFrame(gameLoop);
  }

  /** Golpe si el obstáculo cruza el plano en el mismo carril que tú (solo esquivar con carril). */
  function checkHit(o) {
    return o.lane === playerLane;
  }

  function formatRaceTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function updateHud(L, progress, elapsedMs) {
    const kmLeft = L.km * (1 - progress);
    if (kmLeft < 0.05) {
      hudKm.textContent = '¡Meta! · ' + L.raceName;
    } else if (progress > 0.72) {
      hudKm.textContent = `${kmLeft.toFixed(1)} km · arco de llegada`;
    } else {
      hudKm.textContent = `${kmLeft.toFixed(1)} km restantes`;
    }
    progressFill.style.width = `${(progress * 100).toFixed(2)}%`;
    if (metricsTime) metricsTime.textContent = formatRaceTime(elapsedMs);
  }

  function spawnObstacle(L) {
    const types = L.theme === 'street' ? STREET_TYPES : TRIAL_TYPES;
    const type = types[(Math.random() * types.length) | 0];
    let lane = (Math.random() * 3 | 0) - 1;
    const recent = obstacles.filter((o) => o.z > Z_SPAWN - 700);
    if (recent.length > 0) {
      const last = recent[recent.length - 1];
      if (last.lane === lane && Math.random() < 0.7) {
        const opts = [-1, 0, 1].filter((l) => l !== lane);
        lane = opts[(Math.random() * opts.length) | 0];
      }
    }
    obstacles.push({
      type,
      lane,
      z: Z_SPAWN + 80 + Math.random() * 120,
      scored: false,
    });
  }

  function restartCurrentLevel() {
    GameAudio.sfxHit();
    running = false;
    cancelAnimationFrame(rafId);
    hitFlash.hidden = false;
    setTimeout(() => {
      hitFlash.hidden = true;
      running = true;
      levelStartTime = performance.now();
      obstacles = [];
      spawnTimer = 0;
      playerLane = 0;
      laneVisual = 0;
      lastTs = 0;
      rafId = requestAnimationFrame(gameLoop);
    }, 650);
  }

  function onLevelComplete() {
    GameAudio.stopBgm();
    const nextIdx = currentLevelIndex + 1;
    if (nextIdx >= LEVELS.length) {
      GameAudio.sfxVictory();
      showScreen('victory');
      return;
    }
    GameAudio.sfxLevelDone();
    const nextL = LEVELS[nextIdx];
    betweenTitle.textContent = `¡${LEVELS[currentLevelIndex].raceName} completada!`;
    betweenMsg.textContent = `Siguiente: ${nextL.raceName} (${nextL.km} K). ¡Tú puedes!`;
    showScreen('between');
  }

  function drawWorld(L, progress) {
    ctx.save();
    ctx.scale(cssCanvasW / LOGICAL_W, cssCanvasH / LOGICAL_H);

    if (L.theme === 'street') drawSkyStreet();
    else drawSkyTrial();

    drawRoad3D(L.theme);
    drawFinishArch(L, progress);
    drawObstacles3D(L.theme);
    drawPlayerBehind();

    ctx.restore();
  }

  /**
   * Arco inflable de meta en perspectiva (se acerca en los últimos ~30% del nivel).
   */
  function pathRoundRect(ctx2, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx2.beginPath();
    ctx2.moveTo(x + rr, y);
    ctx2.arcTo(x + w, y, x + w, y + h, rr);
    ctx2.arcTo(x + w, y + h, x, y + h, rr);
    ctx2.arcTo(x, y + h, x, y, rr);
    ctx2.arcTo(x, y, x + w, y, rr);
    ctx2.closePath();
  }

  function drawFinishArch(L, progress) {
    if (progress < 0.7) return;
    const t = (progress - 0.7) / 0.3;
    const zArch = 55 + Z_SPAWN * 0.72 * (1 - t);
    const pl = project(-1, zArch);
    const pr = project(1, zArch);
    const pm = project(0, zArch);
    if (pl.t < 0.03) return;

    const sc = pl.scale;
    const archH = 115 * sc;
    const thick = Math.max(10, 14 * sc);

    const yBaseL = pl.y + 35 * sc;
    const yBaseR = pr.y + 35 * sc;
    const yTopL = yBaseL - archH;
    const yTopR = yBaseR - archH;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 12 * sc;

    const colA = L.theme === 'street' ? '#f8f8f8' : '#fff8e8';
    const colB = L.theme === 'street' ? '#e63946' : '#2a9d8f';

    function pillar(px, pyB, pyT) {
      const g = ctx.createLinearGradient(px - thick, pyT, px + thick, pyB);
      g.addColorStop(0, colA);
      g.addColorStop(0.5, '#ffffff');
      g.addColorStop(1, '#d8d8d8');
      ctx.fillStyle = g;
      pathRoundRect(ctx, px - thick * 0.85, pyT, thick * 1.7, pyB - pyT, 6 * sc);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1.2 * sc;
      ctx.stroke();
    }

    pillar(pl.x, yBaseL, yTopL);
    pillar(pr.x, yBaseR, yTopR);

    const bandY = (yTopL + yTopR) / 2 - 8 * sc;
    ctx.shadowBlur = 0;
    ctx.strokeStyle = colB;
    ctx.lineWidth = Math.max(8, 11 * sc);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pl.x, yTopL + 5 * sc);
    ctx.quadraticCurveTo(pm.x, yTopL - 42 * sc, pr.x, yTopR + 5 * sc);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(3, 4 * sc);
    ctx.beginPath();
    ctx.moveTo(pl.x, yTopL + 5 * sc);
    ctx.quadraticCurveTo(pm.x, yTopL - 42 * sc, pr.x, yTopR + 5 * sc);
    ctx.stroke();

    ctx.fillStyle = colB;
    ctx.globalAlpha = 0.95;
    const bw = Math.min(220 * sc, 280);
    const bh = 30 * sc;
    pathRoundRect(ctx, pm.x - bw / 2, bandY - bh / 2, bw, bh, 5 * sc);
    ctx.fill();
    ctx.globalAlpha = 1;

    const fontStack = 'Segoe UI, system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.max(11, 13 * sc)}px ${fontStack}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('META', pm.x, bandY - 4 * sc);

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = `600 ${Math.max(7, 8.5 * sc)}px ${fontStack}`;
    const sub = L.raceName.length > 32 ? L.hudShort : L.raceName;
    ctx.fillText(sub, pm.x, bandY + 10 * sc);

    ctx.restore();
  }

  function drawSkyStreet() {
    const g = ctx.createLinearGradient(0, 0, 0, HORIZON_Y + 40);
    g.addColorStop(0, '#4facfe');
    g.addColorStop(0.55, '#a8d8ff');
    g.addColorStop(1, '#d4e9f7');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    ctx.fillStyle = '#5c8f72';
    ctx.beginPath();
    ctx.moveTo(0, HORIZON_Y + 35);
    ctx.lineTo(180 + (roadPhase * 80) % 200, HORIZON_Y - 15);
    ctx.lineTo(400, HORIZON_Y + 20);
    ctx.lineTo(620 - (roadPhase * 60) % 180, HORIZON_Y - 8);
    ctx.lineTo(LOGICAL_W, HORIZON_Y + 30);
    ctx.lineTo(LOGICAL_W, HORIZON_Y + 50);
    ctx.lineTo(0, HORIZON_Y + 50);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 220, 120, 0.45)';
    ctx.beginPath();
    ctx.arc(LOGICAL_W * 0.82, 68, 36, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSkyTrial() {
    const g = ctx.createLinearGradient(0, 0, 0, HORIZON_Y + 50);
    g.addColorStop(0, '#6eb5ff');
    g.addColorStop(0.4, '#b5e0c8');
    g.addColorStop(1, '#dcefd5');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    ctx.fillStyle = '#3d5a80';
    for (let i = 0; i < 5; i++) {
      const bx = i * 200 - (roadPhase * 100) % 200;
      ctx.beginPath();
      ctx.moveTo(bx, HORIZON_Y + 45);
      ctx.lineTo(bx + 100, HORIZON_Y - 40);
      ctx.lineTo(bx + 200, HORIZON_Y + 45);
      ctx.fill();
    }

    ctx.fillStyle = '#2d6a3e';
    ctx.beginPath();
    ctx.moveTo(0, HORIZON_Y + 40);
    ctx.quadraticCurveTo(LOGICAL_W * 0.35, HORIZON_Y - 5, LOGICAL_W * 0.5, HORIZON_Y + 25);
    ctx.quadraticCurveTo(LOGICAL_W * 0.7, HORIZON_Y, LOGICAL_W, HORIZON_Y + 35);
    ctx.lineTo(LOGICAL_W, HORIZON_Y + 55);
    ctx.lineTo(0, HORIZON_Y + 55);
    ctx.fill();
  }

  function drawRoad3D(theme) {
    const vanW = 14;
    const bottomW = LOGICAL_W - 36;
    const bx0 = CX - bottomW / 2;
    const bx1 = CX + bottomW / 2;

    ctx.fillStyle = theme === 'street' ? '#2f2f38' : '#4a3518';
    ctx.beginPath();
    ctx.moveTo(CX - vanW / 2, HORIZON_Y);
    ctx.lineTo(bx0, ROAD_BOTTOM);
    ctx.lineTo(bx1, ROAD_BOTTOM);
    ctx.lineTo(CX + vanW / 2, HORIZON_Y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = theme === 'street' ? 'rgba(255, 230, 120, 0.92)' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = theme === 'street' ? 3 : 2;
    const stripes = 10;
    for (let i = 0; i < stripes; i++) {
      const k = (i + roadPhase * 2) % stripes / stripes;
      const k2 = (i + 1 + roadPhase * 2) % stripes / stripes;
      const p0 = project(0, Z_SPAWN * (1 - k));
      const p1 = project(0, Z_SPAWN * (1 - k2));
      if (p0.t < 0.05 || p1.t < 0.05) continue;
      ctx.beginPath();
      ctx.moveTo(CX, p0.y);
      ctx.lineTo(CX, p1.y);
      ctx.stroke();
    }

    ctx.strokeStyle = theme === 'street' ? '#555' : '#6b5030';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(CX - vanW / 2, HORIZON_Y);
    ctx.lineTo(bx0, ROAD_BOTTOM);
    ctx.moveTo(CX + vanW / 2, HORIZON_Y);
    ctx.lineTo(bx1, ROAD_BOTTOM);
    ctx.stroke();
  }

  function drawObstacles3D(theme) {
    const sorted = [...obstacles].sort((a, b) => b.z - a.z);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const o of sorted) {
      const def = TYPE_DEF[o.type];
      const p = project(o.lane, o.z);
      if (p.t < 0.02) continue;
      const base = 52 * def.size * p.scale;
      const shadowY = p.y + base * 0.45;
      ctx.fillStyle = 'rgba(0,0,0,0.52)';
      ctx.beginPath();
      ctx.ellipse(p.x, shadowY, base * 0.58, base * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();

      const fontPx = Math.max(20, base * 1.28);
      ctx.font = `${fontPx}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - base * 0.12, base * 0.52, base * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(2, 2.2 * p.scale);
      ctx.strokeStyle = 'rgba(30, 30, 30, 0.35)';
      ctx.stroke();

      ctx.fillText(def.emoji, p.x, p.y - base * 0.15);

      if (theme === 'street' && o.type === 'cone') {
        ctx.fillStyle = '#ff8c42';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - base * 0.55);
        ctx.lineTo(p.x - base * 0.22, p.y + base * 0.2);
        ctx.lineTo(p.x + base * 0.22, p.y + base * 0.2);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  /**
   * Jugadora vista desde atrás: formas orgánicas (curvas + degradés), pelo lacio largo, menos “cuadrado”.
   * Sin librería externa: evita peso en GitHub Pages; un motor 2D (Pixi) solo aportaría sprites si tuvieras PNG.
   */
  function drawPlayerBehind() {
    const p = project(laneVisual, 0);
    const baseY = ROAD_BOTTOM - 118;
    const bob = Math.sin(runPhase) * 4;
    const x = p.x;
    const y = baseY + bob;
    const arm = Math.sin(runPhase) * 9;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y + 6, 34, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    const hairGrad = ctx.createLinearGradient(x - 40, y - 200, x + 40, y - 40);
    hairGrad.addColorStop(0, '#0a0a0a');
    hairGrad.addColorStop(0.45, '#1f1f1f');
    hairGrad.addColorStop(1, '#2a2a2a');
    ctx.fillStyle = hairGrad;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 188);
    ctx.bezierCurveTo(x - 42, y - 175, x - 48, y - 95, x - 34, y - 42);
    ctx.bezierCurveTo(x - 28, y - 28, x - 18, y - 32, x - 12, y - 48);
    ctx.bezierCurveTo(x - 20, y - 120, x - 18, y - 165, x - 6, y - 188);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 8, y - 188);
    ctx.bezierCurveTo(x + 42, y - 175, x + 48, y - 95, x + 34, y - 42);
    ctx.bezierCurveTo(x + 28, y - 28, x + 18, y - 32, x + 12, y - 48);
    ctx.bezierCurveTo(x + 20, y - 120, x + 18, y - 165, x + 6, y - 188);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = hairGrad;
    ctx.beginPath();
    ctx.moveTo(x - 14, y - 188);
    ctx.quadraticCurveTo(x, y - 125, x + 14, y - 188);
    ctx.lineTo(x + 10, y - 68);
    ctx.quadraticCurveTo(x, y - 58, x - 10, y - 68);
    ctx.closePath();
    ctx.fill();

    const skinG = ctx.createRadialGradient(x - 8, y - 178, 4, x, y - 168, 32);
    skinG.addColorStop(0, '#d4a078');
    skinG.addColorStop(1, '#a86b4a');
    ctx.fillStyle = skinG;
    ctx.beginPath();
    ctx.ellipse(x, y - 170, 24, 21, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(40,40,40,0.85)';
    ctx.lineWidth = 1.8;
    ctx.fillStyle = 'rgba(180, 210, 255, 0.35)';
    ctx.beginPath();
    pathRoundRect(ctx, x - 18, y - 182, 14, 9, 3);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    pathRoundRect(ctx, x + 4, y - 182, 14, 9, 3);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 177);
    ctx.quadraticCurveTo(x, y - 175, x + 4, y - 177);
    ctx.stroke();

    const topG = ctx.createLinearGradient(x, y - 155, x, y - 105);
    topG.addColorStop(0, '#f06292');
    topG.addColorStop(1, '#c2185b');
    ctx.fillStyle = topG;
    ctx.beginPath();
    ctx.moveTo(x, y - 158);
    ctx.quadraticCurveTo(x - 22, y - 148, x - 28, y - 128 + arm);
    ctx.quadraticCurveTo(x - 30, y - 118, x - 22, y - 112);
    ctx.quadraticCurveTo(x - 8, y - 118, x - 4, y - 138);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y - 158);
    ctx.quadraticCurveTo(x + 22, y - 148, x + 28, y - 128 - arm);
    ctx.quadraticCurveTo(x + 30, y - 118, x + 22, y - 112);
    ctx.quadraticCurveTo(x + 8, y - 118, x + 4, y - 138);
    ctx.closePath();
    ctx.fill();

    const waistG = ctx.createLinearGradient(x - 22, y - 118, x + 22, y - 78);
    waistG.addColorStop(0, '#d81b60');
    waistG.addColorStop(1, '#ad1457');
    ctx.fillStyle = waistG;
    ctx.beginPath();
    ctx.moveTo(x, y - 150);
    ctx.bezierCurveTo(x - 24, y - 118, x - 26, y - 100, x - 20, y - 82);
    ctx.quadraticCurveTo(x - 6, y - 74, x, y - 78);
    ctx.quadraticCurveTo(x + 6, y - 74, x + 20, y - 82);
    ctx.bezierCurveTo(x + 26, y - 100, x + 24, y - 118, x, y - 150);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(x, y - 88, 20, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    const legG = ctx.createLinearGradient(x - 22, y - 78, x - 2, y - 28);
    legG.addColorStop(0, '#c68642');
    legG.addColorStop(1, '#8d552f');
    ctx.fillStyle = legG;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 78);
    ctx.quadraticCurveTo(x - 18, y - 55, x - 16, y - 32);
    ctx.quadraticCurveTo(x - 12, y - 28, x - 4, y - 32);
    ctx.quadraticCurveTo(x - 12, y - 58, x - 6, y - 78);
    ctx.closePath();
    ctx.fill();
    const legG2 = ctx.createLinearGradient(x + 2, y - 78, x + 22, y - 28);
    legG2.addColorStop(0, '#c68642');
    legG2.addColorStop(1, '#8d552f');
    ctx.fillStyle = legG2;
    ctx.beginPath();
    ctx.moveTo(x + 8, y - 78);
    ctx.quadraticCurveTo(x + 18, y - 55, x + 16, y - 32);
    ctx.quadraticCurveTo(x + 12, y - 28, x + 4, y - 32);
    ctx.quadraticCurveTo(x + 12, y - 58, x + 6, y - 78);
    ctx.closePath();
    ctx.fill();

    const shortG = ctx.createLinearGradient(x - 20, y - 82, x, y - 38);
    shortG.addColorStop(0, '#1b5e20');
    shortG.addColorStop(1, '#2e7d32');
    ctx.fillStyle = shortG;
    ctx.beginPath();
    ctx.moveTo(x - 18, y - 80);
    ctx.lineTo(x - 22, y - 40);
    ctx.quadraticCurveTo(x - 10, y - 34, x - 2, y - 40);
    ctx.quadraticCurveTo(x - 6, y - 62, x - 6, y - 78);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 18, y - 80);
    ctx.lineTo(x + 22, y - 40);
    ctx.quadraticCurveTo(x + 10, y - 34, x + 2, y - 40);
    ctx.quadraticCurveTo(x + 6, y - 62, x + 6, y - 78);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f5f5f5';
    pathRoundRect(ctx, x - 22, y - 36, 20, 11, 4);
    ctx.fill();
    pathRoundRect(ctx, x + 2, y - 36, 20, 11, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    pathRoundRect(ctx, x - 22, y - 36, 20, 11, 4);
    ctx.stroke();
    pathRoundRect(ctx, x + 2, y - 36, 20, 11, 4);
    ctx.stroke();

    ctx.restore();
  }

  function resizeCanvas() {
    const wrap = canvas.parentElement;
    let rawW = wrap.clientWidth;
    if (rawW < 32) {
      const app = document.getElementById('app');
      rawW = app ? app.clientWidth - 48 : window.innerWidth - 32;
    }
    const maxW = Math.min(Math.max(rawW, 280), LOGICAL_W);
    const ratio = maxW / LOGICAL_W;
    const cssH = LOGICAL_H * ratio;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${maxW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.floor(maxW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    cssCanvasW = maxW;
    cssCanvasH = cssH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }

  window.addEventListener('resize', resizeCanvas);
  if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
    new ResizeObserver(() => resizeCanvas()).observe(canvas.parentElement);
  }
  resizeCanvas();

  ctx.fillStyle = '#1d2b3a';
  ctx.fillRect(0, 0, cssCanvasW, cssCanvasH);
})();
