/**
 * Reto 35K — Runner con final por distancia (tiempo por nivel).
 * Listo para GitHub Pages: sin build, solo HTML/CSS/JS.
 */

(function () {
  'use strict';

  // --- Configuración de niveles: km narrativos, duración real (~5–6 min total), tema y dificultad suave ---
  const LEVELS = [
    {
      km: 5,
      label: 'Nivel 1 · Calle (5K)',
      theme: 'street',
      durationMs: 45_000,
      scroll: 220,
      spawnMin: 1.4,
      spawnMax: 2.4,
      obstacleChance: 0.45,
    },
    {
      km: 10,
      label: 'Nivel 2 · Trial (10K)',
      theme: 'trial',
      durationMs: 60_000,
      scroll: 280,
      spawnMin: 1.15,
      spawnMax: 2.0,
      obstacleChance: 0.5,
    },
    {
      km: 15,
      label: 'Nivel 3 · Calle (15K)',
      theme: 'street',
      durationMs: 90_000,
      scroll: 320,
      spawnMin: 1.0,
      spawnMax: 1.75,
      obstacleChance: 0.55,
    },
    {
      km: 21,
      label: 'Nivel 4 · Trial final (21K)',
      theme: 'trial',
      durationMs: 120_000,
      scroll: 380,
      spawnMin: 0.85,
      spawnMax: 1.55,
      obstacleChance: 0.58,
    },
  ];

  const STREET_TYPES = ['cone', 'pothole', 'dog'];
  const TRIAL_TYPES = ['rock', 'log', 'cow'];

  // --- DOM ---
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

  // --- Estado del juego ---
  let currentLevelIndex = 0;
  let levelStartTime = 0;
  let obstacles = [];
  let spawnTimer = 0;
  let nextSpawnIn = 1.5;
  let bgOffset = 0;
  let parallaxOffset = 0;
  let running = false;
  let rafId = 0;
  let lastTs = 0;

  // Física del personaje (salto)
  const GROUND_H = 78;
  let playerY = 0;
  let playerVy = 0;
  const GRAVITY = 2600;
  const JUMP_V = -720;
  const PLAYER_X = 130;
  let runPhase = 0;

  const LOGICAL_W = 800;
  const LOGICAL_H = 400;

  /** Tamaño lógico del área de dibujo en píxeles CSS (tras DPR). */
  let cssCanvasW = LOGICAL_W;
  let cssCanvasH = LOGICAL_H;

  function showScreen(name) {
    Object.values(screens).forEach((el) => el.classList.remove('active'));
    screens[name].classList.add('active');
  }

  function startGame() {
    currentLevelIndex = 0;
    showScreen('game');
    beginLevel(0);
  }

  /** Inicia un nivel: reinicia temporizador, obstáculos y posición del jugador. */
  function beginLevel(idx) {
    currentLevelIndex = idx;
    const L = LEVELS[idx];
    levelStartTime = performance.now();
    obstacles = [];
    spawnTimer = 0;
    nextSpawnIn = 1.2 + Math.random() * 0.8;
    bgOffset = 0;
    parallaxOffset = 0;
    playerY = groundLevel();
    playerVy = 0;
    running = true;
    hudLevel.textContent = L.label;
    lastTs = 0;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(gameLoop);
  }

  function groundLevel() {
    return LOGICAL_H - GROUND_H - 86;
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

  function jump() {
    if (!running) return;
    const ground = groundLevel();
    if (playerY >= ground - 0.5) {
      playerVy = JUMP_V;
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      if (screens.game.classList.contains('active')) jump();
    }
  });

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (screens.game.classList.contains('active')) jump();
  });

  /** Bucle principal: actualiza tiempo, spawn, física, colisiones y dibujo. */
  function gameLoop(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;

    const L = LEVELS[currentLevelIndex];
    const elapsed = ts - levelStartTime;

    // Victoria de nivel por tiempo (progreso = distancia recorrida en la narrativa)
    if (elapsed >= L.durationMs) {
      running = false;
      cancelAnimationFrame(rafId);
      onLevelComplete();
      return;
    }

    const progress = elapsed / L.durationMs;
    updateHud(L, progress);

    spawnTimer += dt;
    if (spawnTimer >= nextSpawnIn) {
      spawnTimer = 0;
      nextSpawnIn = L.spawnMin + Math.random() * (L.spawnMax - L.spawnMin);
      if (Math.random() < L.obstacleChance) {
        spawnObstacle(L);
      }
    }

    const speed = L.scroll;
    bgOffset = (bgOffset + speed * 0.15 * dt) % 200;
    parallaxOffset = (parallaxOffset + speed * 0.08 * dt) % 300;
    runPhase += dt * 12;

    // Mover obstáculos hacia la izquierda
    for (let i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].x -= speed * dt;
      if (obstacles[i].x < -120) obstacles.splice(i, 1);
    }

    // Física salto
    playerVy += GRAVITY * dt;
    playerY += playerVy * dt;
    const g = groundLevel();
    if (playerY > g) {
      playerY = g;
      playerVy = 0;
    }

    if (checkCollisions()) {
      restartCurrentLevel();
      return;
    }

    drawWorld(L);
    rafId = requestAnimationFrame(gameLoop);
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
    const ground = groundLevel();
    let y = ground + 40;
    let w = 50;
    let h = 52;
    let hitY = ground + 10;
    let hitH = 76;

    if (type === 'pothole') {
      y = LOGICAL_H - 40;
      w = 70;
      h = 24;
      hitY = LOGICAL_H - 88;
      hitH = 28;
    } else if (type === 'dog') {
      h = 44;
      hitY = ground + 28;
      hitH = 50;
    } else if (type === 'rock') {
      w = 46;
      h = 40;
      hitY = ground + 35;
      hitH = 55;
    } else if (type === 'log') {
      w = 72;
      h = 36;
      hitY = ground + 38;
      hitH = 48;
    } else if (type === 'cow') {
      w = 64;
      h = 56;
      hitY = ground + 22;
      hitH = 62;
    } else if (type === 'cone') {
      w = 36;
      h = 48;
      hitY = ground + 32;
      hitH = 54;
    }

    obstacles.push({
      type,
      x: LOGICAL_W + 30,
      y,
      w,
      h,
      hitX: 0,
      hitY,
      hitW: w,
      hitH,
    });
  }

  /** AABB simple entre jugadora y cada obstáculo (caja un poco más benigna en el cuerpo). */
  function checkCollisions() {
    const px = PLAYER_X + 16;
    const py = playerY + 12;
    const pw = 40;
    const ph = 72;

    for (const o of obstacles) {
      const ox = o.x + (o.w - o.hitW) / 2;
      const oy = o.hitY;
      const ow = o.hitW;
      const oh = o.hitH;
      if (px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy) {
        return true;
      }
    }
    return false;
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
      playerY = groundLevel();
      playerVy = 0;
      lastTs = 0;
      rafId = requestAnimationFrame(gameLoop);
    }, 650);
  }

  function onLevelComplete() {
    const L = LEVELS[currentLevelIndex];
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

  // --- Dibujo: fondos Colombia (calle / trial), obstáculos con emoji, personaje personalizado ---

  function drawWorld(L) {
    ctx.save();
    ctx.scale(cssCanvasW / LOGICAL_W, cssCanvasH / LOGICAL_H);

    if (L.theme === 'street') drawStreetBg();
    else drawTrialBg();

    drawGround(L.theme);
    drawObstacles(L.theme);
    drawPlayer();

    ctx.restore();
  }

  function drawStreetBg() {
    const grd = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    grd.addColorStop(0, '#6ecff6');
    grd.addColorStop(0.45, '#b8e0f5');
    grd.addColorStop(1, '#dfe8ec');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Cerros tipo ciudad colombiana
    ctx.fillStyle = '#5a7d6c';
    ctx.beginPath();
    ctx.moveTo(-50 + (parallaxOffset % 400), 220);
    ctx.lineTo(180 + (parallaxOffset % 400), 120);
    ctx.lineTo(400 + (parallaxOffset % 400), 200);
    ctx.lineTo(620 + (parallaxOffset % 400), 100);
    ctx.lineTo(900, 240);
    ctx.lineTo(900, 280);
    ctx.lineTo(-50, 280);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 200, 80, 0.35)';
    ctx.fillRect(0, 0, LOGICAL_W, 70);

    // Palma / sol tropical
    ctx.font = '48px serif';
    ctx.fillText('🌴', 40 - (bgOffset % 40), 95);
    ctx.fillText('☀️', LOGICAL_W - 100, 72);
  }

  function drawTrialBg() {
    const grd = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    grd.addColorStop(0, '#87ceeb');
    grd.addColorStop(0.5, '#c5e8b8');
    grd.addColorStop(1, '#e8f5e0');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Montañas andinas simplificadas
    ctx.fillStyle = '#4a6fa5';
    for (let i = 0; i < 4; i++) {
      const bx = i * 260 - (parallaxOffset * 0.5 % 260);
      ctx.beginPath();
      ctx.moveTo(bx, 280);
      ctx.lineTo(bx + 120, 100);
      ctx.lineTo(bx + 240, 280);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#3d7c47';
    ctx.beginPath();
    ctx.moveTo(0, 260);
    ctx.quadraticCurveTo(200, 200, 400, 270);
    ctx.quadraticCurveTo(600, 220, LOGICAL_W, 265);
    ctx.lineTo(LOGICAL_W, LOGICAL_H);
    ctx.lineTo(0, LOGICAL_H);
    ctx.fill();

    ctx.font = '40px serif';
    ctx.fillText('🌿', 500 - (bgOffset % 30), 200);
  }

  function drawGround(theme) {
    const y0 = LOGICAL_H - GROUND_H;
    if (theme === 'street') {
      ctx.fillStyle = '#4a4a52';
      ctx.fillRect(0, y0, LOGICAL_W, GROUND_H);
      ctx.strokeStyle = '#f4d03f';
      ctx.lineWidth = 4;
      ctx.setLineDash([22, 18]);
      ctx.beginPath();
      ctx.moveTo(0, y0 + GROUND_H / 2);
      ctx.lineTo(LOGICAL_W, y0 + GROUND_H / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#6d6d75';
      ctx.fillRect(0, y0, LOGICAL_W, 12);
    } else {
      ctx.fillStyle = '#8b6914';
      ctx.fillRect(0, y0, LOGICAL_W, GROUND_H);
      ctx.fillStyle = '#5c4a0f';
      for (let x = -((bgOffset * 2) % 80); x < LOGICAL_W; x += 80) {
        ctx.fillRect(x, y0 + 20, 40, 8);
      }
    }
  }

  const EMOJI = {
    cone: '🚧',
    pothole: '🕳️',
    dog: '🐕',
    rock: '🪨',
    log: '🪵',
    cow: '🐄',
  };

  function drawObstacles(theme) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const o of obstacles) {
      const cy = o.type === 'pothole' ? o.y : o.y - o.h / 2 + 8;
      ctx.font = `${Math.min(o.h + 18, 64)}px serif`;
      ctx.fillText(EMOJI[o.type] || '▪', o.x + o.w / 2, cy);
      if (theme === 'street' && o.type === 'cone') {
        ctx.fillStyle = '#ff7f27';
        ctx.fillRect(o.x + o.w / 2 - 8, o.y - 40, 16, 36);
      }
    }
  }

  /**
   * Personaje: mujer trigueña, pelo negro, lentes — dibujo vectorial en canvas.
   */
  function drawPlayer() {
    const x = PLAYER_X;
    const y = playerY;
    const bob = Math.sin(runPhase) * 3;

    // Pelo negro (atrás y volumen)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(x + 34, y + 28 + bob, 38, 32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Brazo/cuerpo camiseta
    ctx.fillStyle = '#e85d75';
    ctx.fillRect(x + 18, y + 48 + bob, 36, 42);
    ctx.fillStyle = '#c4475e';
    ctx.fillRect(x + 22, y + 88 + bob, 28, 8);

    // Piel trigueña
    ctx.fillStyle = '#b8734d';
    ctx.beginPath();
    ctx.ellipse(x + 36, y + 36 + bob, 22, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    // Frente pelo
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(x + 36, y + 22 + bob, 20, Math.PI * 1.1, Math.PI * 1.9);
    ctx.fill();

    // Lentes
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(200, 230, 255, 0.5)';
    ctx.strokeRect(x + 22, y + 30 + bob, 14, 10);
    ctx.fillRect(x + 23, y + 31 + bob, 12, 8);
    ctx.strokeRect(x + 38, y + 30 + bob, 14, 10);
    ctx.fillRect(x + 39, y + 31 + bob, 12, 8);
    ctx.beginPath();
    ctx.moveTo(x + 36, y + 35 + bob);
    ctx.lineTo(x + 38, y + 35 + bob);
    ctx.stroke();

    // Piernas (shorts)
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(x + 22, y + 86 + bob, 12, 28 + Math.sin(runPhase) * 6);
    ctx.fillRect(x + 38, y + 86 + bob, 12, 28 - Math.sin(runPhase) * 6);

    // Zapatillas
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 18, y + 108 + bob, 22, 10);
    ctx.fillRect(x + 36, y + 108 + bob, 22, 10);
  }

  /** Escala el canvas con devicePixelRatio para nitidez en móviles. */
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

  // Dibujo inicial en menú (fondo en coordenadas CSS)
  ctx.fillStyle = '#1d2b3a';
  ctx.fillRect(0, 0, cssCanvasW, cssCanvasH);
})();
