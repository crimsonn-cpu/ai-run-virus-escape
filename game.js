// AI RUN : 바이러스 탈출 작전
// HTML + CSS + JavaScript만 사용한 3레인 러너 실습용 게임

const MAX_LIVES = 5;
const LANES = 3;
const BEST_KEY = "ai-run-best-score";

const characters = {
  piya: { name: "삐야", file: "piya.png" },
  oru: { name: "오르", file: "oru.png" },
};

const screens = {
  select: document.getElementById("screen-select"),
  play: document.getElementById("screen-play"),
  over: document.getElementById("screen-over"),
};

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const difficultyEl = document.getElementById("difficulty");
const bestLiveEl = document.getElementById("best-live");
const finalScoreEl = document.getElementById("final-score");
const bestScoreEl = document.getElementById("best-score");

let selectedId = "piya";
let sprites = {};
let running = false;
let lastTime = 0;
let state = createState();

function createState() {
  return {
    characterId: selectedId,
    lane: 1, // 0 왼쪽, 1 가운데, 2 오른쪽
    lives: MAX_LIVES,
    score: 0,
    distanceTimer: 0,
    invincible: 1.4, // 시작 직후 잠깐 무적
    jump: 0, // 0이면 땅에 있음
    jumpVel: 0,
    spawnTimer: 0,
    objects: [],
    time: 0,
    overlayAlpha: 0,
  };
}

function show(name) {
  Object.values(screens).forEach((el) => el.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

function pad(n) {
  return String(Math.floor(n)).padStart(6, "0");
}

function getBest() {
  return Number(localStorage.getItem(BEST_KEY) || 0);
}

function saveBest(score) {
  const best = Math.max(getBest(), score);
  localStorage.setItem(BEST_KEY, String(best));
  return best;
}

function difficultyInfo(seconds) {
  if (seconds < 30) return { name: "EASY", speed: 1 };
  if (seconds < 60) return { name: "NORMAL", speed: 1.25 };
  if (seconds < 90) return { name: "HARD", speed: 1.55 };
  return { name: "EXTREME", speed: 1.9 };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function prepareCharacters() {
  for (const [id, info] of Object.entries(characters)) {
    sprites[id] = await loadImage(info.file);
    const portrait = document.getElementById(id === "piya" ? "portrait-piya" : "portrait-oru");
    portrait.src = info.file;
  }
}

function laneX(lane) {
  const left = canvas.width * 0.22;
  const right = canvas.width * 0.78;
  return left + ((right - left) / 2) * lane;
}

function spawnObject() {
  const nearbyVirusLanes = new Set(
    state.objects
      .filter((obj) => obj.type === "virus" && obj.y < 220)
      .map((obj) => obj.lane)
  );
  const freeLanes = [0, 1, 2].filter((lane) => !nearbyVirusLanes.has(lane));
  if (freeLanes.length === 0) return; // 3레인을 동시에 막지 않음

  const lane = freeLanes[Math.floor(Math.random() * freeLanes.length)];
  const isVaccine = Math.random() < 0.22;
  state.objects.push({
    type: isVaccine ? "vaccine" : "virus",
    lane,
    y: -60,
    scored: false,
  });
}

function updateHud() {
  scoreEl.textContent = pad(state.score);
  livesEl.textContent = "❤️".repeat(state.lives) + "🖤".repeat(MAX_LIVES - state.lives);
  difficultyEl.textContent = difficultyInfo(state.time).name;
  bestLiveEl.textContent = "BEST " + pad(getBest());
}

function startGame() {
  state = createState();
  state.characterId = selectedId;
  running = true;
  lastTime = 0;
  canvas.tabIndex = 0;
  canvas.focus();
  show("play");
  updateHud();
  requestAnimationFrame(loop);
}

function gameOver() {
  running = false;
  const best = saveBest(state.score);
  updateHud();
  finalScoreEl.textContent = state.score.toLocaleString();
  bestScoreEl.textContent = best.toLocaleString();
  screens.over.classList.remove("hidden");
}

function tryJump() {
  if (state.jump === 0) {
    state.jumpVel = 13;
    state.jump = 0.01;
  }
}

function moveLane(dir) {
  state.lane = Math.max(0, Math.min(LANES - 1, state.lane + dir));
}

function loop(now) {
  if (!running) return;
  if (!lastTime) lastTime = now;
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  const diff = difficultyInfo(state.time);
  state.time += dt;
  state.invincible = Math.max(0, state.invincible - dt);
  state.overlayAlpha = Math.max(0, state.overlayAlpha - dt * 2);

  // 점프 물리
  if (state.jump > 0 || state.jumpVel > 0) {
    state.jumpVel -= 28 * dt;
    state.jump += state.jumpVel * 18 * dt;
    if (state.jump <= 0) {
      state.jump = 0;
      state.jumpVel = 0;
    }
  }

  const fallSpeed = 180 * diff.speed;
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnObject();
    state.spawnTimer = Math.max(0.75, 1.55 - state.time * 0.008);
  }

  // 거리 점수
  state.distanceTimer += dt;
  if (state.distanceTimer >= 0.35) {
    state.score += 10;
    state.distanceTimer = 0;
  }

  const playerY = canvas.height - 90;
  for (const obj of state.objects) {
    obj.y += fallSpeed * dt;

    const sameLane = obj.lane === state.lane;
    const near = obj.y > playerY - 34 && obj.y < playerY + 18;
    const jumpingOver = state.jump > 34 && obj.type === "virus";

    if (sameLane && near && !obj.hit) {
      if (obj.type === "vaccine") {
        obj.hit = true;
        state.score += 50;
        if (state.lives < MAX_LIVES) state.lives += 1;
      } else if (!jumpingOver && state.invincible <= 0) {
        obj.hit = true;
        state.lives -= 1;
        state.invincible = 1.1;
        state.overlayAlpha = 0.55;
        if (state.lives <= 0) {
          updateHud();
          draw(diff);
          gameOver();
          return;
        }
      }
    }

    if (!obj.scored && obj.type === "virus" && obj.y > playerY + 40) {
      obj.scored = true;
      state.score += 20;
    }
  }

  state.objects = state.objects.filter((obj) => obj.y < canvas.height + 80 && !obj.hit);
  updateHud();
  draw(diff);
  requestAnimationFrame(loop);
}

function drawCyberBackground(speed) {
  ctx.fillStyle = "#070b18";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 원근감 있는 3레인 사이버 도로
  const vanishX = canvas.width / 2;
  const vanishY = 70;
  const edges = [0.16, 0.38, 0.62, 0.84];
  ctx.strokeStyle = "rgba(80, 220, 255, 0.35)";
  ctx.lineWidth = 2;
  for (const edge of edges) {
    ctx.beginPath();
    ctx.moveTo(vanishX, vanishY);
    ctx.lineTo(canvas.width * edge, canvas.height);
    ctx.stroke();
  }

  const offset = (state.time * 180 * speed) % 70;
  ctx.strokeStyle = "rgba(108, 240, 255, 0.18)";
  for (let y = vanishY + offset; y < canvas.height; y += 70) {
    ctx.beginPath();
    ctx.moveTo(80, y);
    ctx.lineTo(canvas.width - 80, y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(120, 255, 210, 0.35)";
  ctx.font = "12px monospace";
  for (let i = 0; i < 18; i++) {
    const x = (i * 97 + state.time * 40) % canvas.width;
    const y = (i * 53 + state.time * 90 * speed) % canvas.height;
    ctx.fillText(i % 2 ? "010101" : "DATA", x, y);
  }
}

function draw(diff) {
  drawCyberBackground(diff.speed);

  const playerY = canvas.height - 90 - state.jump;

  for (const obj of state.objects) {
    const x = laneX(obj.lane);
    ctx.save();
    ctx.translate(x, obj.y);
    if (obj.type === "virus") {
      ctx.fillStyle = "#7cff6c";
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#123018";
      ctx.font = "22px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🦠", 0, 1);
    } else {
      ctx.fillStyle = "#6cf0ff";
      ctx.beginPath();
      ctx.roundRect(-16, -22, 32, 44, 8);
      ctx.fill();
      ctx.font = "24px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("💉", 0, 0);
    }
    ctx.restore();
  }

  const sprite = sprites[state.characterId];
  const x = laneX(state.lane);
  const w = 92;
  const h = 108;
  ctx.save();
  if (state.invincible > 0) {
    ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(state.time * 14));
  }
  ctx.drawImage(sprite, x - w / 2, playerY - h + 20, w, h);
  ctx.restore();

  if (state.overlayAlpha > 0) {
    ctx.fillStyle = `rgba(255, 70, 110, ${state.overlayAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

document.querySelectorAll(".character-card").forEach((card) => {
  card.addEventListener("click", () => {
    selectedId = card.dataset.id;
    document.querySelectorAll(".character-card").forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
  });
});

const startBtn = document.getElementById("btn-start");
startBtn.disabled = true;
startBtn.addEventListener("click", startGame);
document.getElementById("btn-retry").addEventListener("click", startGame);
document.getElementById("btn-home").addEventListener("click", () => {
  screens.over.classList.add("hidden");
  show("select");
});

document.addEventListener("keydown", (e) => {
  if (!running) return;
  if (e.key === "ArrowLeft") moveLane(-1);
  if (e.key === "ArrowRight") moveLane(1);
  if (e.key === "ArrowUp" || e.key === " ") {
    e.preventDefault();
    tryJump();
  }
  if (e.key === "ArrowDown") {
    state.jumpVel = -24;
  }
});

document.getElementById("btn-left").addEventListener("click", () => running && moveLane(-1));
document.getElementById("btn-jump").addEventListener("click", () => running && tryJump());
document.getElementById("btn-right").addEventListener("click", () => running && moveLane(1));

canvas.addEventListener("pointerdown", (e) => {
  if (!running) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (y < rect.height * 0.35) tryJump();
  else if (x < rect.width / 2) moveLane(-1);
  else moveLane(1);
});

prepareCharacters()
  .then(() => {
    startBtn.disabled = false;
  })
  .catch((err) => {
    console.error("캐릭터 이미지를 불러오지 못했습니다.", err);
  });
