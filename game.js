/* ═══════════════════════════════════════════════════════════════
   TETRIS  –  game.js
   ═══════════════════════════════════════════════════════════════ */

// ── CONFIG ──────────────────────────────────────────────────────
const COLS        = 10;
const ROWS        = 20;
const SOFT_SPEED  = 50;   // ms per row when holding ↓ (fast drop)

const LEVEL_SPEEDS = [800,720,630,550,470,380,300,220,130,100,80,70,60,50,40];
const SCORE_TABLE  = [0, 100, 300, 500, 800];

// Retro green palette per piece (same hue, different brightness)
const PIECE_COLORS = {
  I: '#39ff14',   // bright green
  O: '#2cc910',
  T: '#22a80d',
  S: '#33e012',
  Z: '#1d8c0b',
  J: '#4dff29',
  L: '#16700a',
};

const PIECES = {
  I: [[1,1,1,1]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1]],
  S: [[0,1,1],[1,1,0]],
  Z: [[1,1,0],[0,1,1]],
  J: [[1,0,0],[1,1,1]],
  L: [[0,0,1],[1,1,1]],
};
const PIECE_KEYS = Object.keys(PIECES);


// ── CANVAS SETUP ────────────────────────────────────────────────
const canvas     = document.getElementById('game-canvas');
const ctx        = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx    = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx    = holdCanvas.getContext('2d');

let CELL = 30;

function resizeCanvas() {
  const avH = window.innerHeight - 200;
  const avW = Math.min(window.innerWidth - 230, 400);
  CELL = Math.max(18, Math.min(32, Math.floor(Math.min(avH / ROWS, avW / COLS))));
  canvas.width  = COLS * CELL;
  canvas.height = ROWS * CELL;
}

resizeCanvas();
window.addEventListener('resize', () => {
  resizeCanvas();
  render();
});


// ── STATE ────────────────────────────────────────────────────────
let board, current, nextPiece, holdPiece, canHold;
let score, lines, level;
let gameState = 'idle';   // idle | playing | paused | over
let dropTimer = 0;
let lastTimestamp = 0;
let softDropping = false; // true while ↓ is held
let animFrame;
let bag = [];


// ── BAG RANDOMISER ───────────────────────────────────────────────
function refillBag() {
  bag = [...PIECE_KEYS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
}

function drawFromBag() {
  if (!bag.length) refillBag();
  return bag.pop();
}


// ── PIECE HELPERS ────────────────────────────────────────────────
function makePiece(key) {
  const shape = PIECES[key].map(r => [...r]);
  return {
    key,
    shape,
    color: PIECE_COLORS[key],
    x: Math.floor(COLS / 2) - Math.ceil(shape[0].length / 2),
    y: 0,
  };
}

function rotateCW(shape) {
  const R = shape.length, C = shape[0].length;
  return Array.from({ length: C }, (_, c) =>
    Array.from({ length: R }, (_, r) => shape[R - 1 - r][c])
  );
}

function isValid(shape, ox, oy, b = board) {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) {
        const nx = ox + c, ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
        if (ny >= 0 && b[ny][nx] !== null)       return false;
      }
  return true;
}

function ghostRow() {
  let gy = current.y;
  while (isValid(current.shape, current.x, gy + 1)) gy++;
  return gy;
}


// ── BOARD HELPERS ────────────────────────────────────────────────
function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function lockPiece() {
  current.shape.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell && current.y + r >= 0)
        board[current.y + r][current.x + c] = current.color;
    })
  );

  const cleared = sweepLines();
  if (cleared) {
    score  += SCORE_TABLE[cleared] * level;
    lines  += cleared;
    level   = Math.floor(lines / 10) + 1;
    updateUI();
  }

  canHold   = true;
  current   = makePiece(nextPiece);
  nextPiece = drawFromBag();
  drawMini(nextCtx, nextPiece);
  dropTimer = 0;

  if (!isValid(current.shape, current.x, current.y)) {
    triggerGameOver();
  }
}

function sweepLines() {
  let count = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(c => c !== null)) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(null));
      count++;
      r++; // re-check same index
    }
  }
  return count;
}


// ── ACTIONS ──────────────────────────────────────────────────────
function moveLeft()  { if (isValid(current.shape, current.x - 1, current.y)) current.x--; }
function moveRight() { if (isValid(current.shape, current.x + 1, current.y)) current.x++; }

function rotate() {
  const rot = rotateCW(current.shape);
  // Wall-kick offsets
  for (const kick of [0, -1, 1, -2, 2]) {
    if (isValid(rot, current.x + kick, current.y)) {
      current.shape = rot;
      current.x    += kick;
      return;
    }
  }
}

function softDrop() {
  if (isValid(current.shape, current.x, current.y + 1)) {
    current.y++;
    dropTimer = 0;
  } else {
    lockPiece();
  }
}

function hardDrop() {
  current.y = ghostRow();
  lockPiece();
}

function doHold() {
  if (!canHold) return;
  canHold = false;
  if (holdPiece) {
    const tmp  = holdPiece;
    holdPiece  = current.key;
    current    = makePiece(tmp);
  } else {
    holdPiece  = current.key;
    current    = makePiece(nextPiece);
    nextPiece  = drawFromBag();
    drawMini(nextCtx, nextPiece);
  }
  dropTimer = 0;
  drawMini(holdCtx, holdPiece);
}

function getNormalSpeed() {
  return LEVEL_SPEEDS[Math.min(level - 1, LEVEL_SPEEDS.length - 1)];
}


// ── GAME LIFECYCLE ───────────────────────────────────────────────
function initGame() {
  board     = createBoard();
  bag       = [];
  score     = 0;
  lines     = 0;
  level     = 1;
  holdPiece = null;
  canHold   = true;
  softDropping = false;

  nextPiece = drawFromBag();
  current   = makePiece(drawFromBag());
  nextPiece = drawFromBag();

  updateUI();
  drawMini(nextCtx, nextPiece);
  drawMini(holdCtx, null);
}

function startGame() {
  initGame();
  gameState   = 'playing';
  dropTimer   = 0;
  lastTimestamp = performance.now();
  hideOverlay();
  animFrame = requestAnimationFrame(loop);
}

function pauseGame() {
  if (gameState === 'playing') {
    gameState = 'paused';
    cancelAnimationFrame(animFrame);
    showOverlay('PAUSED', 'PRESS P TO RESUME', 'RESUME');
  } else if (gameState === 'paused') {
    gameState = 'playing';
    hideOverlay();
    lastTimestamp = performance.now();
    animFrame = requestAnimationFrame(loop);
  }
}

function triggerGameOver() {
  gameState = 'over';
  cancelAnimationFrame(animFrame);
  setTimeout(() => {
    showOverlay('GAME OVER', `SCORE  ${String(score).padStart(6,'0')}\nLINES  ${String(lines).padStart(3,'0')}`, 'RETRY');
  }, 400);
}


// ── GAME LOOP ────────────────────────────────────────────────────
function loop(timestamp) {
  if (gameState !== 'playing') return;

  const dt = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  dropTimer += dt;
  const speed = softDropping ? SOFT_SPEED : getNormalSpeed();

  if (dropTimer >= speed) {
    dropTimer = 0;
    if (isValid(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }

  render();
  animFrame = requestAnimationFrame(loop);
}


// ── RENDERING ────────────────────────────────────────────────────
const GREEN      = '#39ff14';
const GREEN_DIM  = '#1a7a06';
const GRID_COLOR = 'rgba(30,80,10,0.25)';
const GHOST_CLR  = 'rgba(57,255,20,0.12)';
const BG_COLOR   = '#060c03';

function drawCell(c, x, y, color, cellSize = CELL) {
  const px = x * cellSize;
  const py = y * cellSize;
  const s  = cellSize;

  // fill
  c.fillStyle = color;
  c.fillRect(px + 1, py + 1, s - 2, s - 2);

  // top/left highlight
  c.fillStyle = 'rgba(255,255,255,0.18)';
  c.fillRect(px + 2, py + 2, s - 4, 2);
  c.fillRect(px + 2, py + 2, 2, s - 4);

  // bottom/right shadow
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(px + 2, py + s - 4, s - 4, 2);
  c.fillRect(px + s - 4, py + 2, 2, s - 4);

  // phosphor inner glow
  c.shadowColor = color;
  c.shadowBlur  = 6;
  c.fillStyle   = color;
  c.fillRect(px + 3, py + 3, s - 6, s - 6);
  c.shadowBlur  = 0;
}

function render() {
  // Background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid lines
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth   = 0.5;
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(canvas.width, r * CELL);
    ctx.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, canvas.height);
    ctx.stroke();
  }

  // Placed cells
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]) drawCell(ctx, c, r, board[r][c]);

  if (!current) return;

  // Ghost piece
  const gy = ghostRow();
  if (gy !== current.y) {
    current.shape.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (cell) {
          ctx.fillStyle = GHOST_CLR;
          ctx.fillRect(
            (current.x + c) * CELL + 1,
            (gy + r) * CELL + 1,
            CELL - 2, CELL - 2
          );
          ctx.strokeStyle = 'rgba(57,255,20,0.3)';
          ctx.lineWidth   = 1;
          ctx.strokeRect(
            (current.x + c) * CELL + 1,
            (gy + r) * CELL + 1,
            CELL - 2, CELL - 2
          );
        }
      })
    );
  }

  // Active piece
  current.shape.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell && current.y + r >= 0)
        drawCell(ctx, current.x + c, current.y + r, current.color);
    })
  );
}

// Mini preview (next / hold)
function drawMini(c, key) {
  const SIZE = 80;
  c.fillStyle = BG_COLOR;
  c.fillRect(0, 0, SIZE, SIZE);

  if (!key) return;

  const shape    = PIECES[key];
  const color    = PIECE_COLORS[key];
  const cellSize = 14;
  const offX     = Math.floor((SIZE - shape[0].length * cellSize) / 2);
  const offY     = Math.floor((SIZE - shape.length    * cellSize) / 2);

  shape.forEach((row, r) =>
    row.forEach((cell, col) => {
      if (!cell) return;
      const px = offX + col * cellSize;
      const py = offY + r   * cellSize;

      c.fillStyle  = color;
      c.shadowColor = color;
      c.shadowBlur  = 5;
      c.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
      c.shadowBlur  = 0;

      c.fillStyle = 'rgba(255,255,255,0.2)';
      c.fillRect(px + 2, py + 2, cellSize - 2, 2);
    })
  );
}


// ── UI HELPERS ───────────────────────────────────────────────────
function pad(n, len) { return String(n).padStart(len, '0'); }

function updateUI() {
  document.getElementById('score-display').textContent = pad(score, 6);
  document.getElementById('lines-display').textContent = pad(lines, 3);
  document.getElementById('level-display').textContent = pad(level, 2);
}

function showOverlay(title, sub, btnLabel) {
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-sub').textContent   = sub;
  document.getElementById('overlay-btn').textContent   = `[ ${btnLabel} ]`;
  document.getElementById('overlay').classList.remove('hidden');
}

function hideOverlay() {
  document.getElementById('overlay').classList.add('hidden');
}


// ── KEYBOARD INPUT ───────────────────────────────────────────────
const held = new Set();

document.addEventListener('keydown', e => {
  if (held.has(e.code)) return; // no key-repeat for most actions
  held.add(e.code);

  // Pause toggle (always available during play/pause)
  if (e.code === 'KeyP') {
    if (gameState === 'playing' || gameState === 'paused') pauseGame();
    return;
  }

  if (gameState !== 'playing') return;

  switch (e.code) {
    case 'ArrowLeft':  case 'KeyA': moveLeft();  break;
    case 'ArrowRight': case 'KeyD': moveRight(); break;
    case 'ArrowUp':    case 'KeyW': case 'KeyZ': rotate(); break;
    case 'Space':      e.preventDefault(); hardDrop(); break;
    case 'KeyC':       case 'ShiftLeft': doHold(); break;

    // Soft drop: start on keydown
    case 'ArrowDown': case 'KeyS':
      softDropping = true;
      dropTimer    = getNormalSpeed(); // trigger immediately
      break;
  }
  render();
});

document.addEventListener('keyup', e => {
  held.delete(e.code);
  if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    softDropping = false;
    dropTimer    = 0;
  }
});


// ── OVERLAY BUTTON ───────────────────────────────────────────────
document.getElementById('overlay-btn').addEventListener('click', startGame);


// ── MOBILE BUTTONS ───────────────────────────────────────────────
// Single-tap buttons
function onTap(id, fn) {
  const el = document.getElementById(id);
  el.addEventListener('touchstart', e => { e.preventDefault(); fn(); }, { passive: false });
  el.addEventListener('mousedown',  fn);
}

// Repeating press (for left / right / down)
function onRepeat(id, fn) {
  const el = document.getElementById(id);
  let iv;
  const start = e => {
    e.preventDefault();
    fn();
    iv = setInterval(() => { if (gameState === 'playing') fn(); render(); }, 110);
  };
  const stop = () => clearInterval(iv);
  el.addEventListener('touchstart', start, { passive: false });
  el.addEventListener('touchend',   stop);
  el.addEventListener('touchcancel',stop);
  el.addEventListener('mousedown',  start);
  el.addEventListener('mouseup',    stop);
  el.addEventListener('mouseleave', stop);
}

// Soft-drop button: hold = fast drop
function onSoftDrop(id) {
  const el = document.getElementById(id);
  const start = e => {
    e.preventDefault();
    if (gameState !== 'playing') return;
    softDropping = true;
    dropTimer    = getNormalSpeed();
  };
  const stop = () => { softDropping = false; dropTimer = 0; };
  el.addEventListener('touchstart', start, { passive: false });
  el.addEventListener('touchend',   stop);
  el.addEventListener('touchcancel',stop);
  el.addEventListener('mousedown',  start);
  el.addEventListener('mouseup',    stop);
  el.addEventListener('mouseleave', stop);
}

onRepeat('btn-left',  () => { if (gameState === 'playing') { moveLeft();  render(); } });
onRepeat('btn-right', () => { if (gameState === 'playing') { moveRight(); render(); } });
onSoftDrop('btn-down');
onTap('btn-rotate', () => { if (gameState === 'playing') { rotate(); render(); } });
onTap('btn-drop',   () => { if (gameState === 'playing') hardDrop(); });
onTap('btn-hold',   () => { if (gameState === 'playing') { doHold(); render(); } });
onTap('btn-pause',  () => { if (gameState === 'playing' || gameState === 'paused') pauseGame(); });


// ── SWIPE ON CANVAS (mobile shortcut) ───────────────────────────
let tx0, ty0, tt0;
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  tx0 = e.touches[0].clientX;
  ty0 = e.touches[0].clientY;
  tt0 = Date.now();
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  if (gameState !== 'playing') return;
  const dx = e.changedTouches[0].clientX - tx0;
  const dy = e.changedTouches[0].clientY - ty0;
  const dt = Date.now() - tt0;
  // Quick tap on canvas = rotate
  if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && dt < 220) {
    rotate();
    render();
  }
}, { passive: false });


// ── INITIAL STATE ────────────────────────────────────────────────
board  = createBoard();
score  = 0; lines = 0; level = 1;
updateUI();
render();
showOverlay('TETRIS', 'INSERT COIN\nTO PLAY', 'START');
