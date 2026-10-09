/* ==========================================================
   QUAKE JS — рейкастинг-шутер + редактор уровней
   ========================================================== */
(function () {
'use strict';

/* ----------------------------------------------------------
   КОНСТАНТЫ
   ---------------------------------------------------------- */
const VIEW_W = 640;
const VIEW_H = 400;
const TEX = 64;
const MAP_W = 24;
const MAP_H = 24;
const PLANE_LEN = Math.tan(Math.PI / 6); // FOV 60°
const STORAGE_KEY = 'quakejs_world_v1';

/* ----------------------------------------------------------
   DOM
   ---------------------------------------------------------- */
const canvas     = document.getElementById('screen');
const ctx        = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const hudEl      = document.getElementById('hud');
const overlayEl  = document.getElementById('overlay');
const editorbarEl= document.getElementById('editorbar');
const ovTitle    = document.getElementById('ovTitle');
const ovSub      = document.getElementById('ovSub');
const btnPlay    = document.getElementById('btnPlay');
const btnEditor  = document.getElementById('btnEditor');
const btnExitEditor = document.getElementById('btnExitEditor');
const btnSave    = document.getElementById('btnSave');
const btnLoad    = document.getElementById('btnLoad');
const btnReset   = document.getElementById('btnReset');
const elHealth   = document.getElementById('health');
const elAmmo     = document.getElementById('ammo');
const elScore    = document.getElementById('score');
const elMessage  = document.getElementById('message');
const elDamage   = document.getElementById('damage');

/* ----------------------------------------------------------
   КАРТА ПО УМОЛЧАНИЮ (24 x 24)
   ---------------------------------------------------------- */
const DEFAULT_MAP = [
  "111111111111111111111111",
  "1......................1",
  "1..2222......2222......1",
  "1..2..2......2..2......1",
  "1..2..2......2..2......1",
  "1..2222......2222......1",
  "1......................1",
  "1..333333333333333333..1",
  "1..3................3..1",
  "1..3................3..1",
  "1..3................3..1",
  "1..333333......333333..1",
  "1......................1",
  "1..4444......4444......1",
  "1..4..4......4..4......1",
  "1..4..4......4..4......1",
  "1..4444......4444......1",
  "1......................1",
  "1..2222......3333......1",
  "1..2..2......3..3......1",
  "1..2222......3333......1",
  "1......................1",
  "1......................1",
  "111111111111111111111111"
];

function parseMap(rows) {
  const g = [];
  for (let y = 0; y < MAP_H; y++) {
    const row = [];
    const s = rows[y] || '';
    for (let x = 0; x < MAP_W; x++) {
      const ch = s[x];
      const v = (ch && ch !== '.') ? (parseInt(ch, 10) || 0) : 0;
      row.push(v);
    }
    g.push(row);
  }
  return g;
}

function defaultLevel() {
  return {
    grid: parseMap(DEFAULT_MAP),
    spawn: { x: 2.5, y: 2.5, angle: 0.35 },
    enemies: [
      { x: 11.5, y: 2.5 },
      { x: 19.5, y: 3.5 },
      { x: 11.5, y: 20.5 },
      { x: 4.5,  y: 12.5 },
      { x: 19.5, y: 19.5 }
    ],
    items: [
      { x: 3.5,  y: 6.5,  type: 'health' },
      { x: 20.5, y: 2.5,  type: 'ammo' },
      { x: 12.5, y: 12.5, type: 'ammo' },
      { x: 6.5,  y: 21.5, type: 'health' },
      { x: 21.5, y: 21.5, type: 'ammo' }
    ]
  };
}

/* ----------------------------------------------------------
   ГЕНЕРАЦИЯ ТЕКСТУР
   ---------------------------------------------------------- */
function newTexCanvas() {
  const c = document.createElement('canvas');
  c.width = TEX;
  c.height = TEX;
  return c;
}

function makeBrick() {
  const c = newTexCanvas();
  const g = c.getContext('2d');
  g.fillStyle = '#1a0d08';
  g.fillRect(0, 0, TEX, TEX);

  const bh = 16, bw = 32;
  for (let row = 0; row < TEX / bh; row++) {
    const off = (row % 2) * (bw / 2);
    for (let x = -bw; x < TEX; x += bw) {
      const px = x + off;
      const r = (115 + Math.random() * 45) | 0;
      const gr = (42 + Math.random() * 22) | 0;
      const b = (28 + Math.random() * 16) | 0;
      g.fillStyle = 'rgb(' + r + ',' + gr + ',' + b + ')';
      g.fillRect(px + 1, row * bh + 1, bw - 2, bh - 2);
    }
  }
  // шум
  for (let i = 0; i < 400; i++) {
    g.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.25).toFixed(2) + ')';
    g.fillRect((Math.random() * TEX) | 0, (Math.random() * TEX) | 0, 2, 2);
  }
  return c;
}

function makeStone() {
  const c = newTexCanvas();
  const g = c.getContext('2d');
  g.fillStyle = '#232327';
  g.fillRect(0, 0, TEX, TEX);

  for (let i = 0; i < 240; i++) {
    const w = 6 + Math.random() * 12;
    const h = 5 + Math.random() * 9;
    const v = (75 + Math.random() * 80) | 0;
    g.fillStyle = 'rgba(' + v + ',' + v + ',' + ((v + 10) | 0) + ',0.9)';
    g.fillRect(Math.random() * TEX, Math.random() * TEX, w, h);
  }
  // тёмные швы
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 2;
  for (let y = 0; y <= TEX; y += 16) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(TEX, y);
    g.stroke();
  }
  return c;
}

function makeMetal() {
  const c = newTexCanvas();
  const g = c.getContext('2d');
  g.fillStyle = '#31353b';
  g.fillRect(0, 0, TEX, TEX);

  for (let y = 0; y < TEX; y += 32) {
    for (let x = 0; x < TEX; x += 32) {
      const r = (58 + Math.random() * 26) | 0;
      const gr = (62 + Math.random() * 26) | 0;
      const b = (70 + Math.random() * 26) | 0;
      g.fillStyle = 'rgb(' + r + ',' + gr + ',' + b + ')';
      g.fillRect(x + 2, y + 2, 28, 28);
      g.strokeStyle = '#1c1f24';
      g.lineWidth = 2;
      g.strokeRect(x + 2, y + 2, 28, 28);
    }
  }
  // заклёпки
  g.fillStyle = '#9aa2ae';
  for (let y = 6; y < TEX; y += 32) {
    for (let x = 6; x < TEX; x += 32) {
      g.beginPath();
      g.arc(x, y, 2, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(x + 20, y + 20, 2, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}

function makeTech() {
  const c = newTexCanvas();
  const g = c.getContext('2d');
  g.fillStyle = '#101a22';
  g.fillRect(0, 0, TEX, TEX);

  g.fillStyle = '#16283a';
  for (let y = 0; y < TEX; y += 8) {
    g.fillRect(0, y, TEX, 4);
  }

  // светящиеся линии
  g.strokeStyle = 'rgba(80,220,255,0.85)';
  g.lineWidth = 2;
  g.shadowColor = '#4cd8ff';
  g.shadowBlur = 6;
  for (let i = 0; i < 5; i++) {
    const y = 8 + i * 12;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(TEX, y);
    g.stroke();
  }
  g.shadowBlur = 0;

  // рамки
  g.strokeStyle = '#2c4a60';
  g.lineWidth = 4;
  g.strokeRect(2, 2, TEX - 4, TEX - 4);
  return c;
}

function makeEnemyTex() {
  const c = newTexCanvas();
  const g = c.getContext('2d');

  // руки
  g.fillStyle = '#5e2d1b';
  g.beginPath(); g.ellipse(11, 46, 6, 15, 0.32, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(53, 46, 6, 15, -0.32, 0, Math.PI * 2); g.fill();

  // тело
  g.fillStyle = '#7a3b22';
  g.beginPath(); g.ellipse(32, 42, 16, 20, 0, 0, Math.PI * 2); g.fill();

  // голова
  g.fillStyle = '#8a4a2a';
  g.beginPath(); g.arc(32, 20, 13, 0, Math.PI * 2); g.fill();

  // рога
  g.fillStyle = '#4a2312';
  g.beginPath(); g.moveTo(22, 10); g.lineTo(16, 0); g.lineTo(26, 6); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(42, 10); g.lineTo(48, 0); g.lineTo(38, 6); g.closePath(); g.fill();

  // глаза
  g.fillStyle = '#ffdd33';
  g.shadowColor = '#ffaa00';
  g.shadowBlur = 6;
  g.beginPath(); g.arc(26, 18, 4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(38, 18, 4, 0, Math.PI * 2); g.fill();
  g.shadowBlur = 0;

  g.fillStyle = '#000';
  g.beginPath(); g.arc(26, 18, 2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(38, 18, 2, 0, Math.PI * 2); g.fill();

  // рот
  g.fillStyle = '#2a0d06';
  g.fillRect(24, 27, 16, 5);
  g.fillStyle = '#e8e0d0';
  for (let i = 0; i < 4; i++) {
    g.fillRect(25 + i * 4, 27, 2, 3);
  }

  return c;
}

function makeHealthTex() {
  const c = newTexCanvas();
  const g = c.getContext('2d');
  g.fillStyle = '#e8e8e8';
  g.fillRect(6, 14, 52, 38);
  g.strokeStyle = '#9a9a9a';
  g.lineWidth = 3;
  g.strokeRect(6, 14, 52, 38);
  g.fillStyle = '#d02020';
  g.fillRect(27, 20, 10, 26);
  g.fillRect(16, 31, 32, 10);
  return c;
}

function makeAmmoTex() {
  const c = newTexCanvas();
  const g = c.getContext('2d');
  g.fillStyle = '#4a3a1c';
  g.fillRect(8, 18, 48, 34);
  g.strokeStyle = '#2a2010';
  g.lineWidth = 3;
  g.strokeRect(8, 18, 48, 34);

  // патроны
  for (let i = 0; i < 3; i++) {
    const x = 15 + i * 13;
    g.fillStyle = '#c8a020';
    g.fillRect(x, 6, 9, 18);
    g.fillStyle = '#8a6a10';
    g.fillRect(x, 20, 9, 5);
  }
  return c;
}

const wallTextures = [null, makeBrick(), makeStone(), makeMetal(), makeTech()];
const texEnemy  = makeEnemyTex();
const texHealth = makeHealthTex();
const texAmmo   = makeAmmoTex();

const WALL_COLORS = [null, '#8a3a22', '#6a6a72', '#5a6068', '#2a6a8a'];

/* ----------------------------------------------------------
   ГРАДИЕНТЫ ФОНА
   ---------------------------------------------------------- */
const skyGrad = ctx.createLinearGradient(0, 0, 0, VIEW_H / 2);
skyGrad.addColorStop(0, '#080b12');
skyGrad.addColorStop(1, '#1a1f2b');

const floorGrad = ctx.createLinearGradient(0, VIEW_H / 2, 0, VIEW_H);
floorGrad.addColorStop(0, '#100d09');
floorGrad.addColorStop(1, '#2a2118');

/* ----------------------------------------------------------
   СОСТОЯНИЕ ИГРЫ
   ---------------------------------------------------------- */
let state = 'menu';   // menu | play | paused | dead | editor

let grid = [];        // мастер-сетка
let spawn = { x: 2.5, y: 2.5, angle: 0 };
let enemiesData = []; // мастер-данные врагов
let itemsData   = []; // мастер-данные предметов

let enemies = [];     // рантайм
let items   = [];     // рантайм

const player = {
  x: 2.5, y: 2.5, angle: 0,
  health: 100, ammo: 50, score: 0,
  speed: 3.4
};

let bobPhase = 0;
let bobAmount = 0;
let recoil = 0;
let damageFlash = 0;
let msgTimer = 0;
let deathTimer = 0;

const zbuf = new Float32Array(VIEW_W);

const keys = Object.create(null);

/* ----------------------------------------------------------
   ЗВУК
   ---------------------------------------------------------- */
let actx = null;

function initAudio() {
  if (!actx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) actx = new AC();
    } catch (e) { actx = null; }
  }
  if (actx && actx.state === 'suspended') actx.resume();
}

function sfx(freq, dur, type, vol, slideTo) {
  if (!actx) return;
  try {
    const t = actx.currentTime;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.07, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(actx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch (e) { /* ignore */ }
}

function sfxShot()   { sfx(220, 0.16, 'square', 0.10, 40); }
function sfxHit()    { sfx(520, 0.08, 'sawtooth', 0.07, 200); }
function sfxPickup() { sfx(700, 0.10, 'square', 0.06, 1200); }
function sfxHurt()   { sfx(180, 0.20, 'sawtooth', 0.09, 70); }
function sfxDry()    { sfx(90, 0.06, 'square', 0.05); }
function sfxDie()    { sfx(300, 0.60, 'sawtooth', 0.12, 50); }

/* ----------------------------------------------------------
   РАБОТА С УРОВНЕМ
   ---------------------------------------------------------- */
function loadLevelFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.grid)) return null;

    const g = [];
    for (let y = 0; y < MAP_H; y++) {
      const row = [];
      const src = d.grid[y] || [];
      for (let x = 0; x < MAP_W; x++) {
        const v = parseInt(src[x], 10);
        row.push(isFinite(v) && v > 0 && v <= 4 ? v : 0);
      }
      g.push(row);
    }

    const sp = d.spawn || { x: 2.5, y: 2.5, angle: 0 };

    const en = (Array.isArray(d.enemies) ? d.enemies : [])
      .filter(e => e && isFinite(e.x) && isFinite(e.y))
      .map(e => ({ x: +e.x, y: +e.y }));

    const it = (Array.isArray(d.items) ? d.items : [])
      .filter(i => i && isFinite(i.x) && isFinite(i.y))
      .map(i => ({ x: +i.x, y: +i.y, type: i.type === 'health' ? 'health' : 'ammo' }));

    return {
      grid: g,
      spawn: { x: +sp.x || 2.5, y: +sp.y || 2.5, angle: +sp.angle || 0 },
      enemies: en,
      items: it
    };
  } catch (e) {
    return null;
  }
}

function saveLevelToStorage() {
  try {
    const data = {
      grid: grid,
      spawn: { x: spawn.x, y: spawn.y, angle: spawn.angle },
      enemies: enemiesData.map(e => ({ x: e.x, y: e.y })),
      items: itemsData.map(i => ({ x: i.x, y: i.y, type: i.type })),
      savedAt: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

function applyLevel(lv) {
  grid = lv.grid;
  spawn = lv.spawn;
  enemiesData = lv.enemies;
  itemsData = lv.items;
}

/* ----------------------------------------------------------
   СТАРТ / ПЕРЕЗАПУСК
   ---------------------------------------------------------- */
function startGame() {
  // рантайм-копии
  enemies = enemiesData.map(e => ({
    x: e.x, y: e.y, hp: 100, alive: true, cool: 0, hurt: 0
  }));
  items = itemsData.map(i => ({
    x: i.x, y: i.y, type: i.type, taken: false
  }));

  player.x = spawn.x;
  player.y = spawn.y;
  player.angle = spawn.angle;
  player.health = 100;
  player.ammo = 50;
  player.score = 0;

  bobPhase = 0;
  bobAmount = 0;
  recoil = 0;
  damageFlash = 0;
  deathTimer = 0;

  updateHUD();
  setState('play');
  lockPointer();
}

function setState(s) {
  state = s;

  hudEl.classList.toggle('hidden', !(s === 'play' || s === 'dead'));
  editorbarEl.classList.toggle('hidden', s !== 'editor');

  if (s === 'editor') {
    overlayEl.classList.add('hidden');
  } else if (s === 'menu') {
    overlayEl.classList.remove('hidden');
    ovTitle.innerHTML = 'QUAKE<span>JS</span>';
    ovSub.textContent = 'Рейкастинг-шутер от первого лица';
    btnPlay.textContent = 'ИГРАТЬ';
    btnEditor.classList.remove('hidden');
  } else if (s === 'paused') {
    overlayEl.classList.remove('hidden');
    ovTitle.innerHTML = 'ПАУЗА';
    ovSub.textContent = 'Нажмите, чтобы продолжить';
    btnPlay.textContent = 'ПРОДОЛЖИТЬ';
    btnEditor.classList.remove('hidden');
  } else if (s === 'dead') {
    overlayEl.classList.remove('hidden');
    ovTitle.innerHTML = 'ВЫ ПОГИБЛИ';
    ovSub.textContent = 'Фраги: ' + player.score;
    btnPlay.textContent = 'ЗАНОВО';
    btnEditor.classList.remove('hidden');
  } else if (s === 'play') {
    overlayEl.classList.add('hidden');
  }
}

function lockPointer() {
  if (canvas.requestPointerLock) {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(function () {});
  }
}

/* ----------------------------------------------------------
   HUD
   ---------------------------------------------------------- */
function updateHUD() {
  elHealth.textContent = Math.max(0, Math.round(player.health));
  elAmmo.textContent = Math.max(0, Math.round(player.ammo));
  elScore.textContent = player.score;
}

function showMessage(text) {
  elMessage.textContent = text;
  elMessage.classList.add('show');
  msgTimer = 2.2;
}

/* ----------------------------------------------------------
   КОЛЛИЗИИ И ЛУЧИ
   ---------------------------------------------------------- */
function isWallAt(x, y) {
  const mx = Math.floor(x);
  const my = Math.floor(y);
  if (mx < 0 || my < 0 || mx >= MAP_W || my >= MAP_H) return true;
  return grid[my][mx] > 0;
}

function canStand(x, y) {
  const r = 0.22;
  return !isWallAt(x - r, y - r) &&
         !isWallAt(x + r, y - r) &&
         !isWallAt(x - r, y + r) &&
         !isWallAt(x + r, y + r);
}

function castRay(px, py, rdx, rdy) {
  let mapX = Math.floor(px);
  let mapY = Math.floor(py);

  const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
  const ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);

  let stepX, stepY, sdx, sdy;

  if (rdx < 0) { stepX = -1; sdx = (px - mapX) * ddx; }
  else         { stepX = 1;  sdx = (mapX + 1 - px) * ddx; }

  if (rdy < 0) { stepY = -1; sdy = (py - mapY) * ddy; }
  else         { stepY = 1;  sdy = (mapY + 1 - py) * ddy; }

  let side = 0;
  let tile = 0;
  let hit = false;
  let guard = 0;

  while (!hit && guard++ < 512) {
    if (sdx < sdy) {
      sdx += ddx;
      mapX += stepX;
      side = 0;
    } else {
      sdy += ddy;
      mapY += stepY;
      side = 1;
    }

    if (mapX < 0 || mapX >= MAP_W || mapY < 0 || mapY >= MAP_H) {
      return { dist: 1e30, tile: 0, side: side, texX: 0 };
    }

    if (grid[mapY][mapX] > 0) {
      hit = true;
      tile = grid[mapY][mapX];
    }
  }

  let dist = side === 0 ? (sdx - ddx) : (sdy - ddy);
  if (!isFinite(dist) || dist <= 0.0001) dist = 0.0001;

  let wallX = side === 0 ? py + dist * rdy : px + dist * rdx;
  wallX -= Math.floor(wallX);

  let texX = Math.floor(wallX * TEX);
  if (side === 0 && rdx > 0) texX = TEX - texX - 1;
  if (side === 1 && rdy < 0) texX = TEX - texX - 1;
  if (texX < 0) texX = 0;
  if (texX >= TEX) texX = TEX - 1;

  return { dist: dist, tile: tile, side: side, texX: texX };
}

function lineOfSight(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(2, Math.ceil(dist * 10));

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    const mx = Math.floor(x);
    const my = Math.floor(y);
    if (mx < 0 || my < 0 || mx >= MAP_W || my >= MAP_H) return false;
    if (grid[my][mx] > 0) return false;
  }
  return true;
}

/* ----------------------------------------------------------
   ОБНОВЛЕНИЕ ИГРЫ
   ---------------------------------------------------------- */
function update(dt) {
  /* ---- поворот с клавиатуры ---- */
  const rotSpeed = 2.6;
  if (keys['ArrowLeft'] || keys['KeyQ'])  player.angle -= rotSpeed * dt;
  if (keys['ArrowRight'] || keys['KeyE']) player.angle += rotSpeed * dt;

  /* ---- движение ---- */
  let mf = 0, ms = 0;
  if (keys['KeyW'] || keys['ArrowUp'])   mf += 1;
  if (keys['KeyS'] || keys['ArrowDown']) mf -= 1;
  if (keys['KeyD']) ms += 1;
  if (keys['KeyA']) ms -= 1;

  const dirX = Math.cos(player.angle);
  const dirY = Math.sin(player.angle);
  const rightX = -dirY;
  const rightY = dirX;

  let len = Math.sqrt(mf * mf + ms * ms);
  if (len > 0) {
    mf /= len;
    ms /= len;
  }

  const step = player.speed * dt;
  const nx = player.x + (dirX * mf + rightX * ms) * step;
  const ny = player.y + (dirY * mf + rightY * ms) * step;

  if (canStand(nx, player.y)) player.x = nx;
  if (canStand(player.x, ny)) player.y = ny;

  /* ---- покачивание ---- */
  if (len > 0) {
    bobPhase += dt * 11;
    bobAmount += (1 - bobAmount) * Math.min(1, dt * 8);
  } else {
    bobAmount += (0 - bobAmount) * Math.min(1, dt * 8);
  }

  if (recoil > 0) recoil = Math.max(0, recoil - dt * 5);
  if (damageFlash > 0) {
    damageFlash = Math.max(0, damageFlash - dt * 2.2);
    elDamage.style.opacity = (damageFlash * 0.85).toFixed(2);
  }

  if (msgTimer > 0) {
    msgTimer -= dt;
    if (msgTimer <= 0) elMessage.classList.remove('show');
  }

  /* ---- враги ---- */
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.alive) continue;

    if (e.hurt > 0) e.hurt = Math.max(0, e.hurt - dt * 3);

    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d > 13) continue;
    if (!lineOfSight(e.x, e.y, player.x, player.y)) continue;

    // движение к игроку
    if (d > 1.05) {
      const sp = 1.5 * dt;
      const ex = e.x + (dx / d) * sp;
      const ey = e.y + (dy / d) * sp;
      if (canStand(ex, e.y)) e.x = ex;
      if (canStand(e.x, ey)) e.y = ey;
    }

    // атака
    e.cool -= dt;
    if (d < 1.3 && e.cool <= 0) {
      e.cool = 1.1;
      damagePlayer(7 + Math.random() * 7);
    }
  }

  /* ---- предметы ---- */
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.taken) continue;
    const dx = it.x - player.x;
    const dy = it.y - player.y;
    if (dx * dx + dy * dy < 0.32) {
      if (it.type === 'health') {
        if (player.health >= 100) continue;
        player.health = Math.min(100, player.health + 25);
        showMessage('+25 ЗДОРОВЬЯ');
      } else {
        player.ammo = Math.min(200, player.ammo + 12);
        showMessage('+12 ПАТРОНОВ');
      }
      it.taken = true;
      sfxPickup();
      updateHUD();
    }
  }
}

function damagePlayer(amount) {
  if (state !== 'play') return;
  player.health -= amount;
  damageFlash = 1;
  elDamage.style.opacity = '0.85';
  sfxHurt();

  if (player.health <= 0) {
    player.health = 0;
    updateHUD();
    sfxDie();
    setState('dead');
    if (document.exitPointerLock) document.exitPointerLock();
    return;
  }
  updateHUD();
}

/* ----------------------------------------------------------
   СТРЕЛЬБА
   ---------------------------------------------------------- */
function shoot() {
  if (state !== 'play') return;

  if (player.ammo <= 0) {
    sfxDry();
    showMessage('НЕТ ПАТРОНОВ');
    return;
  }

  player.ammo--;
  recoil = 1;
  sfxShot();
  updateHUD();

  const dirX = Math.cos(player.angle);
  const dirY = Math.sin(player.angle);

  const wallHit = castRay(player.x, player.y, dirX, dirY);
  const wallDist = wallHit.dist;

  let best = null;
  let bestDist = Infinity;

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.alive) continue;

    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.001) continue;
    if (d >= wallDist) continue;

    const dot = (dx * dirX + dy * dirY) / d;
    if (dot < 0.90) continue; // конус ~25°

    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }

  if (best) {
    best.hp -= 34;
    best.hurt = 1;
    sfxHit();

    if (best.hp <= 0) {
      best.alive = false;
      player.score++;
      updateHUD();
      sfx(160, 0.35, 'sawtooth', 0.10, 40);
    }
  }
}

/* ----------------------------------------------------------
   РЕНДЕР 3D
   ---------------------------------------------------------- */
function render3D() {
  const px = player.x;
  const py = player.y;

  const dirX = Math.cos(player.angle);
  const dirY = Math.sin(player.angle);
  const planeX = -dirY * PLANE_LEN;
  const planeY = dirX * PLANE_LEN;

  /* ---- фон ---- */
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H / 2);
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, VIEW_H / 2, VIEW_W, VIEW_H / 2);

  /* ---- стены ---- */
  for (let x = 0; x < VIEW_W; x++) {
    const cameraX = 2 * x / VIEW_W - 1;
    const rdx = dirX + planeX * cameraX;
    const rdy = dirY + planeY * cameraX;

    const r = castRay(px, py, rdx, rdy);

    zbuf[x] = r.dist;

    if (r.tile === 0) continue;

    const lineH = Math.floor(VIEW_H / r.dist);
    const drawStart = Math.floor(-lineH / 2 + VIEW_H / 2);

    const tex = wallTextures[r.tile] || wallTextures[1];

    ctx.drawImage(tex, r.texX, 0, 1, TEX, x, drawStart, 1, lineH);

    let shade = Math.min(0.92, r.dist / 14);
    if (r.side === 1) shade = Math.min(0.94, shade + 0.22);

    if (shade > 0.02) {
      ctx.fillStyle = 'rgba(0,0,0,' + shade.toFixed(3) + ')';
      ctx.fillRect(x, drawStart, 1, lineH);
    }
  }

  /* ---- спрайты ---- */
  const sprites = [];

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.alive) continue;
    const dx = e.x - px;
    const dy = e.y - py;
    sprites.push({
      x: e.x, y: e.y,
      tex: texEnemy,
      h: 0.92,
      z: -0.04,
      dist: dx * dx + dy * dy
    });
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.taken) continue;
    const dx = it.x - px;
    const dy = it.y - py;
    sprites.push({
      x: it.x, y: it.y,
      tex: it.type === 'health' ? texHealth : texAmmo,
      h: 0.38,
      z: -0.31,
      dist: dx * dx + dy * dy
    });
  }

  sprites.sort(function (a, b) { return b.dist - a.dist; });

  const det = planeX * dirY - dirX * planeY;
  const invDet = det === 0 ? 0 : 1 / det;

  for (let i = 0; i < sprites.length; i++) {
    const s = sprites[i];
    const sx = s.x - px;
    const sy = s.y - py;

    const tX = invDet * (dirY * sx - dirX * sy);
    const tY = invDet * (-planeY * sx + planeX * sy);

    if (tY <= 0.12) continue;

    const screenX = Math.floor((VIEW_W / 2) * (1 + tX / tY));

    const unit = VIEW_H / tY;
    let h = s.h * unit;
    if (h > 5000) h = 5000;

    const centerY = VIEW_H / 2 - s.z * unit;
    const yStart = Math.floor(centerY - h / 2);

    const w = h;
    const xStart = Math.floor(screenX - w / 2);
    const xEnd = Math.floor(screenX + w / 2);

    let alpha = 1 - tY / 18;
    if (alpha < 0.14) alpha = 0.14;
    if (alpha > 1) alpha = 1;

    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha;

    const from = Math.max(0, xStart);
    const to = Math.min(VIEW_W, xEnd);

    for (let x = from; x < to; x++) {
      if (tY >= zbuf[x]) continue;
      const texX = Math.floor((x - xStart) / w * TEX);
      if (texX < 0 || texX >= TEX) continue;
      ctx.drawImage(s.tex, texX, 0, 1, TEX, x, yStart, 1, h);
    }

    ctx.globalAlpha = prevAlpha;
  }

  /* ---- оружие ---- */
  drawWeapon();
}

function drawWeapon() {
  const bobX = Math.sin(bobPhase) * 12 * bobAmount;
  const bobY = Math.abs(Math.cos(bobPhase)) * 9 * bobAmount;
  const kick = recoil * 16;

  const cx = VIEW_W * 0.63 + bobX;
  const cy = VIEW_H + 20 + bobY + kick;

  ctx.save();
  ctx.translate(cx, cy);

  // ствол
  ctx.fillStyle = '#2b2b30';
  ctx.fillRect(-13, -118, 26, 96);
  ctx.fillStyle = '#15151a';
  ctx.fillRect(-8, -128, 16, 22);
  ctx.fillStyle = '#3a3a42';
  ctx.fillRect(-13, -118, 5, 96);

  // корпус
  ctx.fillStyle = '#5a3a1e';
  ctx.beginPath();
  ctx.moveTo(-42, 4);
  ctx.lineTo(-30, -74);
  ctx.lineTo(30, -74);
  ctx.lineTo(42, 4);
  ctx.closePath();
  ctx.fill();

  // блик
  ctx.fillStyle = 'rgba(255,200,120,0.13)';
  ctx.fillRect(-30, -74, 12, 78);

  // руки
  ctx.fillStyle = '#7a5030';
  ctx.fillRect(-48, -34, 28, 40);
  ctx.fillRect(22, -30, 28, 40);

  ctx.restore();
}

/* ----------------------------------------------------------
   РЕДАКТОР
   ---------------------------------------------------------- */
const editor = {
  active: false,
  selected: '1',
  cell: 16,
  ox: 0,
  oy: 0
};

editor.cell = Math.floor(Math.min(VIEW_W / MAP_W, VIEW_H / MAP_H)); // 16
editor.ox = Math.floor((VIEW_W - MAP_W * editor.cell) / 2);
editor.oy = Math.floor((VIEW_H - MAP_H * editor.cell) / 2);

let painting = false;
let paintButton = 0;

function renderEditor() {
  const c = editor.cell;
  const ox = editor.ox;
  const oy = editor.oy;

  ctx.fillStyle = '#0a0a0d';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // сетка
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const v = grid[y][x];
      ctx.fillStyle = v > 0 ? WALL_COLORS[v] : '#15151b';
      ctx.fillRect(ox + x * c, oy + y * c, c - 1, c - 1);
    }
  }

  // рамка карты
  ctx.strokeStyle = '#4a3a26';
  ctx.lineWidth = 1;
  ctx.strokeRect(ox - 0.5, oy - 0.5, MAP_W * c + 1, MAP_H * c + 1);

  // маркеры
  for (let i = 0; i < enemiesData.length; i++) {
    drawMarker(enemiesData[i].x, enemiesData[i].y, '#e04040', 'E');
  }
  for (let i = 0; i < itemsData.length; i++) {
    const it = itemsData[i];
    drawMarker(it.x, it.y, it.type === 'health' ? '#40e060' : '#e0c040',
      it.type === 'health' ? 'H' : 'A');
  }

  drawMarker(spawn.x, spawn.y, '#40a0ff', 'P');

  // статус
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, VIEW_W, 22);
  ctx.fillStyle = '#e0b070';
  ctx.font = '13px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('РЕДАКТОР УРОВНЯ  |  ЛКМ — поставить  |  ПКМ — стереть  |  TAB — выход', 8, 11);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#8ae08a';
  ctx.fillText('ВЫБРАНО: ' + editor.selected, VIEW_W - 8, 11);
  ctx.textAlign = 'left';
}

function drawMarker(wx, wy, color, letter) {
  const c = editor.cell;
  const x = editor.ox + wx * c;
  const y = editor.oy + wy * c;

  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(x, y, c * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#000';
  ctx.font = 'bold ' + Math.floor(c * 0.8) + 'px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, x, y + 1);
  ctx.textAlign = 'left';
}

function canvasToCell(evt) {
  const rect = canvas.getBoundingClientRect();
  const mx = (evt.clientX - rect.left) * (VIEW_W / rect.width);
  const my = (evt.clientY - rect.top) * (VIEW_H / rect.height);
  const cx = Math.floor((mx - editor.ox) / editor.cell);
  const cy = Math.floor((my - editor.oy) / editor.cell);
  return { cx: cx, cy: cy };
}

function insideMap(cx, cy) {
  return cx >= 0 && cy >= 0 && cx < MAP_W && cy < MAP_H;
}

function eraseCell(cx, cy) {
  grid[cy][cx] = 0;
  enemiesData = enemiesData.filter(function (e) {
    return !(Math.floor(e.x) === cx && Math.floor(e.y) === cy);
  });
  itemsData = itemsData.filter(function (i) {
    return !(Math.floor(i.x) === cx && Math.floor(i.y) === cy);
  });
}

function applyBrush(cx, cy, erase) {
  if (!insideMap(cx, cy)) return;

  if (erase) {
    eraseCell(cx, cy);
    return;
  }

  const sel = editor.selected;

  if (sel === 'P') {
    spawn.x = cx + 0.5;
    spawn.y = cy + 0.5;
    grid[cy][cx] = 0;
    return;
  }

  if (sel === 'E') {
    grid[cy][cx] = 0;
    itemsData = itemsData.filter(function (i) {
      return !(Math.floor(i.x) === cx && Math.floor(i.y) === cy);
    });
    const exists = enemiesData.some(function (e) {
      return Math.floor(e.x) === cx && Math.floor(e.y) === cy;
    });
    if (!exists) enemiesData.push({ x: cx + 0.5, y: cy + 0.5 });
    return;
  }

  if (sel === 'H' || sel === 'A') {
    grid[cy][cx] = 0;
    const type = sel === 'H' ? 'health' : 'ammo';
    itemsData = itemsData.filter(function (i) {
      return !(Math.floor(i.x) === cx && Math.floor(i.y) === cy);
    });
    itemsData.push({ x: cx + 0.5, y: cy + 0.5, type: type });
    return;
  }

  // стена
  const v = parseInt(sel, 10) || 0;
  grid[cy][cx] = v;

  if (v > 0) {
    enemiesData = enemiesData.filter(function (e) {
      return !(Math.floor(e.x) === cx && Math.floor(e.y) === cy);
    });
    itemsData = itemsData.filter(function (i) {
      return !(Math.floor(i.x) === cx && Math.floor(i.y) === cy);
    });
  }
}

function syncTileButtons() {
  const btns = editorbarEl.querySelectorAll('.tile-btn');
  for (let i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].dataset.tile === editor.selected);
  }
}

/* ----------------------------------------------------------
   ГЛАВНЫЙ ЦИКЛ
   ---------------------------------------------------------- */
let lastTime = performance.now();

function loop(now) {
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.05) dt = 0.05;
  if (dt < 0) dt = 0;

  if (state === 'play') {
    update(dt);
  } else if (state === 'dead') {
    deathTimer += dt;
    if (damageFlash > 0) {
      damageFlash = Math.max(0, damageFlash - dt * 2);
      elDamage.style.opacity = (damageFlash * 0.85).toFixed(2);
    }
  } else if (state === 'editor') {
    // пауза игры
  }

  if (state === 'editor') {
    renderEditor();
  } else {
    render3D();
  }

  requestAnimationFrame(loop);
}

/* ----------------------------------------------------------
   ВВОД
   ---------------------------------------------------------- */
window.addEventListener('keydown', function (e) {
  if (e.code === 'Tab') {
    e.preventDefault();
    if (state === 'editor') {
      exitEditor();
    } else if (state === 'play' || state === 'paused' || state === 'menu' || state === 'dead') {
      enterEditor();
    }
    return;
  }

  keys[e.code] = true;

  if (state === 'play') {
    if (e.code === 'KeyR') {
      shoot(); // альтернативная стрельба
    }
    if (e.code === 'Escape') {
      // pointer lock сам снимет, но подстрахуемся
    }
  }

  if (state === 'editor') {
    if (e.code === 'Digit0') { editor.selected = '0'; syncTileButtons(); }
    if (e.code === 'Digit1') { editor.selected = '1'; syncTileButtons(); }
    if (e.code === 'Digit2') { editor.selected = '2'; syncTileButtons(); }
    if (e.code === 'Digit3') { editor.selected = '3'; syncTileButtons(); }
    if (e.code === 'Digit4') { editor.selected = '4'; syncTileButtons(); }
    if (e.code === 'KeyP')   { editor.selected = 'P'; syncTileButtons(); }
    if (e.code === 'KeyE')   { editor.selected = 'E'; syncTileButtons(); }
    if (e.code === 'KeyH')   { editor.selected = 'H'; syncTileButtons(); }
    if (e.code === 'KeyA')   { editor.selected = 'A'; syncTileButtons(); }

    if (e.code === 'KeyS' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (saveLevelToStorage()) {
        editorStatus('УРОВЕНЬ СОХРАНЁН');
      } else {
        editorStatus('ОШИБКА СОХРАНЕНИЯ');
      }
    }
  }
});

window.addEventListener('keyup', function (e) {
  keys[e.code] = false;
});

/* ---- мышь: обзор ---- */
document.addEventListener('mousemove', function (e) {
  if (state !== 'play') return;
  if (!document.pointerLockElement) return;
  player.angle += e.movementX * 0.0022;
});

/* ---- мышь: выстрел / редактор ---- */
canvas.addEventListener('mousedown', function (e) {
  initAudio();

  if (state === 'editor') {
    painting = true;
    paintButton = e.button;
    const p = canvasToCell(e);
    applyBrush(p.cx, p.cy, e.button === 2);
    e.preventDefault();
    return;
  }

  if (state === 'play') {
    if (e.button === 0) shoot();
  }
});

canvas.addEventListener('mousemove', function (e) {
  if (state !== 'editor' || !painting) return;
  const p = canvasToCell(e);
  applyBrush(p.cx, p.cy, paintButton === 2);
});

window.addEventListener('mouseup', function () {
  painting = false;
});

canvas.addEventListener('contextmenu', function (e) {
  e.preventDefault();
});

/* ---- pointer lock ---- */
document.addEventListener('pointerlockchange', function () {
  if (state === 'play' && !document.pointerLockElement) {
    setState('paused');
  }
});

/* ---- кнопки оверлея ---- */
btnPlay.addEventListener('click', function () {
  initAudio();
  if (state === 'paused') {
    setState('play');
    lockPointer();
  } else {
    startGame();
  }
});

btnEditor.addEventListener('click', function () {
  initAudio();
  enterEditor();
});

btnExitEditor.addEventListener('click', function () {
  exitEditor();
});

btnSave.addEventListener('click', function () {
  if (saveLevelToStorage()) {
    editorStatus('УРОВЕНЬ СОХРАНЁН');
  } else {
    editorStatus('ОШИБКА СОХРАНЕНИЯ');
  }
});

btnLoad.addEventListener('click', function () {
  const lv = loadLevelFromStorage();
  if (lv) {
    applyLevel(lv);
    editorStatus('УРОВЕНЬ ЗАГРУЖЕН');
  } else {
    editorStatus('СОХРАНЕНИЙ НЕ НАЙДЕНО');
  }
});

btnReset.addEventListener('click', function () {
  const lv = defaultLevel();
  applyLevel(lv);
  editorStatus('УРОВЕНЬ СБРОШЕН');
});

/* ---- кнопки тайлов ---- */
const tileButtons = editorbarEl.querySelectorAll('.tile-btn');
for (let i = 0; i < tileButtons.length; i++) {
  tileButtons[i].addEventListener('click', function () {
    editor.selected = this.dataset.tile;
    syncTileButtons();
  });
}

/* ----------------------------------------------------------
   РЕЖИМ РЕДАКТОРА
   ---------------------------------------------------------- */
let statusTimer = 0;
let statusText = '';

function editorStatus(text) {
  statusText = text;
  statusTimer = 2;
}

function enterEditor() {
  if (document.exitPointerLock) document.exitPointerLock();
  editor.active = true;
  setState('editor');
  syncTileButtons();
  statusText = 'ЛКМ — поставить, ПКМ — стереть';
  statusTimer = 3;
}

function exitEditor() {
  editor.active = false;
  painting = false;
  startGame();
}

/* ----------------------------------------------------------
   ХУК СТАТУСА В РЕНДЕР РЕДАКТОРА
   ---------------------------------------------------------- */
const _origRenderEditor = renderEditor;
renderEditor = function () {
  _origRenderEditor();
  if (statusTimer > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(VIEW_W / 2 - 160, VIEW_H - 34, 320, 24);
    ctx.strokeStyle = '#7a5a2a';
    ctx.strokeRect(VIEW_W / 2 - 160, VIEW_H - 34, 320, 24);
    ctx.fillStyle = '#ffcf7f';
    ctx.font = '13px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(statusText, VIEW_W / 2, VIEW_H - 22);
    ctx.textAlign = 'left';
  }
};

/* ----------------------------------------------------------
   ИНИЦИАЛИЗАЦИЯ
   ---------------------------------------------------------- */
function init() {
  const saved = loadLevelFromStorage();
  applyLevel(saved || defaultLevel());

  // стартовый вид
  player.x = spawn.x;
  player.y = spawn.y;
  player.angle = spawn.angle;

  updateHUD();
  setState('menu');

  requestAnimationFrame(loop);
}

init();

})();