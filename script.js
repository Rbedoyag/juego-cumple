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
      label: 'Nivel 1 · Calle (5K)',
      theme: 'street',
      durationMs: 45_000,
      zSpeed: 380,
      spawnMin: 1.55,
      spawnMax: 2.65,
      spawnChance: 0.42,
    },
    {
      km: 10,
      label: 'Nivel 2 · Trial (10K)',
      theme: 'trial',
      durationMs: 60_000,
      zSpeed: 460,
      spawnMin: 1.35,
      spawnMax: 2.25,
      spawnChance: 0.46,
    },
    {
      km: 15,
      label: 'Nivel 3 · Calle (15K)',
      theme: 'street',
      durationMs: 90_000,
      zSpeed: 520,
      spawnMin: 1.2,
      spawnMax: 2.05,
      spawnChance: 0.48,
    },
    {
      km: 21,
      label: 'Nivel 4 · Trial final (21K)',
      theme: 'trial',
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
  const betweenTitle = document.getElementById('between-title');
  const betweenMsg = document.getElementById('between-msg');
  const hitFlash = document.getElementById('hit-flash');

  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-continue').addEventListener('click', continueAfterLevel);
  document.getElementById('btn-replay').addEventListener('click', () => {
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
    currentLevelIndex = 0;
    showScreen('game');
    beginLevel(0);
  }

  function beginLevel(idx) {
    currentLevelIndex = idx;
    levelStartTime = performance.now();
    obstacles = [];
    spawnTimer = 0;
    nextSpawnIn = 1.4 + Math.random() * 0.6;
    roadPhase = 0;
    playerLane = 0;
    laneVisual = 0;
    running = true;
    hudLevel.textContent = LEVELS[idx].label;
    lastTs = 0;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(gameLoop);
  }

  function continueAfterLevel() {
    const next = currentLevelIndex + 1;
    if (next >= LEVELS.length) {
      showScreen('victory');
      return;
    }
    showScreen('game');
    beginLevel(next);
  }

  function moveLane(delta) {
    if (!running) return;
    playerLane = Math.max(-1, Math.min(1, playerLane + delta));
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
    updateHud(L, progress);

    const zSpeed = L.zSpeed;
    roadPhase += zSpeed * 0.00012 * dt;

    spawnTimer += dt;
    if (spawnTimer >= nextSpawnIn) {
      spawnTimer = 0;
      nextSpawnIn = L.spawnMin + Math.random() * (L.spawnMax - L.spawnMin);
      if (Math.random() < L.spawnChance) spawnObstacle(L);
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

    drawWorld(L);
    rafId = requestAnimationFrame(gameLoop);
  }

  /** Golpe si el obstáculo cruza el plano en el mismo carril que tú (solo esquivar con carril). */
  function checkHit(o) {
    return o.lane === playerLane;
  }

  function updateHud(L, progress) {
    const kmLeft = L.km * (1 - progress);
    hudKm.textContent =
      kmLeft < 0.05
        ? '¡Meta a la vista!'
        : `${kmLeft.toFixed(1)} km restantes`;
    progressFill.style.width = `${(progress * 100).toFixed(2)}%`;
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
    const nextIdx = currentLevelIndex + 1;
    if (nextIdx >= LEVELS.length) {
      showScreen('victory');
      return;
    }
    const nextKm = LEVELS[nextIdx].km;
    betweenTitle.textContent = `¡Nivel ${currentLevelIndex + 1} completado!`;
    betweenMsg.textContent = `Siguen los ${nextKm} K. ¡Tú puedes!`;
    showScreen('between');
  }

  function drawWorld(L) {
    ctx.save();
    ctx.scale(cssCanvasW / LOGICAL_W, cssCanvasH / LOGICAL_H);

    if (L.theme === 'street') drawSkyStreet();
    else drawSkyTrial();

    drawRoad3D(L.theme);
    drawObstacles3D(L.theme);
    drawPlayerBehind();

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
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(p.x, shadowY, base * 0.55, base * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = `${Math.max(18, base * 1.15)}px "Segoe UI Emoji", "Apple Color Emoji", serif`;
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
   * Jugadora vista desde atrás: silueta femenina, cabello lacio largo, ropa deportiva.
   */
  function drawPlayerBehind() {
    const p = project(laneVisual, 0);
    const baseY = ROAD_BOTTOM - 118;
    const footY = baseY;
    const bob = Math.sin(runPhase) * 4;
    const x = p.x;
    const y = footY + bob;

    const hairLen = 95;
    ctx.fillStyle = '#121212';
    ctx.beginPath();
    ctx.moveTo(x - 22, y - 165);
    ctx.quadraticCurveTo(x - 38, y - 80, x - 28, y - 35);
    ctx.lineTo(x - 18, y - 40);
    ctx.quadraticCurveTo(x - 24, y - 100, x - 14, y - 168);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 22, y - 165);
    ctx.quadraticCurveTo(x + 38, y - 80, x + 28, y - 35);
    ctx.lineTo(x + 18, y - 40);
    ctx.quadraticCurveTo(x + 24, y - 100, x + 14, y - 168);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x - 10, y - 168, 20, hairLen);

    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(x, y - 172, 26, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#a86b4a';
    ctx.fillRect(x - 8, y - 178, 16, 10);

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 14, y - 182, 11, 7);
    ctx.strokeRect(x + 3, y - 182, 11, 7);
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 179);
    ctx.lineTo(x + 3, y - 179);
    ctx.stroke();

    ctx.fillStyle = '#d94f7a';
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 155);
    ctx.lineTo(x - 28, y - 125 + Math.sin(runPhase) * 8);
    ctx.lineTo(x - 22, y - 118 + Math.sin(runPhase) * 8);
    ctx.lineTo(x - 4, y - 138);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 6, y - 155);
    ctx.lineTo(x + 28, y - 125 - Math.sin(runPhase) * 8);
    ctx.lineTo(x + 22, y - 118 - Math.sin(runPhase) * 8);
    ctx.lineTo(x + 4, y - 138);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#c73e68';
    ctx.beginPath();
    ctx.moveTo(x, y - 158);
    ctx.lineTo(x - 20, y - 115);
    ctx.quadraticCurveTo(x - 24, y - 95, x - 18, y - 78);
    ctx.lineTo(x + 18, y - 78);
    ctx.quadraticCurveTo(x + 24, y - 95, x + 20, y - 115);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x - 16, y - 82, 32, 14);

    ctx.fillStyle = '#b8734d';
    ctx.fillRect(x - 14, y - 68, 10, 38 + Math.sin(runPhase) * 5);
    ctx.fillRect(x + 4, y - 68, 10, 38 - Math.sin(runPhase) * 5);

    ctx.fillStyle = '#1e3d2f';
    ctx.beginPath();
    ctx.moveTo(x - 16, y - 72);
    ctx.lineTo(x - 18, y - 38);
    ctx.lineTo(x - 6, y - 36);
    ctx.lineTo(x - 4, y - 70);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 16, y - 72);
    ctx.lineTo(x + 18, y - 38);
    ctx.lineTo(x + 6, y - 36);
    ctx.lineTo(x + 4, y - 70);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(x - 20, y - 34, 18, 9);
    ctx.fillRect(x + 2, y - 34, 18, 9);
  }

  function resizeCanvas() {
    const wrap = canvas.parentElement;
    const maxW = Math.min(wrap.clientWidth, LOGICAL_W);
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
  resizeCanvas();

  ctx.fillStyle = '#1d2b3a';
  ctx.fillRect(0, 0, cssCanvasW, cssCanvasH);
})();
