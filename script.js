// ====== 상태 ======
let duration = 30; // 30 or 60
let timeLeft = 0;
let timerId = null;

let score = 0;
let combo = 0;
let bestCombo = 0;

let current = "";
let locked = false; // 정답 처리 중 중복 방지
let composing = false; // 한글 IME 조합 입력 중
let running = false;

// ====== DOM ======
const wordEl = document.getElementById("word");
const inputEl = document.getElementById("input");

const timeLeftEl = document.getElementById("timeLeft");
const scoreEl = document.getElementById("score");
const comboEl = document.getElementById("combo");
const bestComboEl = document.getElementById("bestCombo");

const resultEl = document.getElementById("result");
const hintEl = document.getElementById("hint");

const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const btn30 = document.getElementById("btn30");
const btn60 = document.getElementById("btn60");

// 모달
const modal = document.getElementById("resultModal");
const mScore = document.getElementById("mScore");
const mBestCombo = document.getElementById("mBestCombo");
const playAgainBtn = document.getElementById("playAgainBtn");
const closeModalBtn = document.getElementById("closeModalBtn");

// ====== 유틸 ======
function setActiveDurationButtons() {
  btn30.classList.toggle("active", duration === 30);
  btn60.classList.toggle("active", duration === 60);
}

function setResult(text = "", className = "") {
  resultEl.textContent = text;
  resultEl.className = "result" + (className ? ` ${className}` : "");
}

function updateUI() {
  timeLeftEl.textContent = running ? `${timeLeft}s` : "—";
  scoreEl.textContent = String(score);
  comboEl.textContent = String(combo);
  bestComboEl.textContent = String(bestCombo);
}

function pickWord() {
  const list = window.WORDS ?? [];
  if (!list.length) return "WORDS가 비어있음";
  return list[Math.floor(Math.random() * list.length)];
}

function closeModal() {
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

function openModal() {
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function newWord() {
  current = pickWord();
  wordEl.textContent = current;

  inputEl.value = "";
  inputEl.classList.remove("error", "shake");
  setResult("");

  composing = false;
  inputEl.focus();
}

// ====== 게임 흐름 ======
function stopGame() {
  running = false;
  locked = false;
  composing = false;

  clearInterval(timerId);
  timerId = null;

  inputEl.disabled = true;
  setResult(`끝! 점수 ${score} / 최고 콤보 ${bestCombo}`, "end");
  hintEl.textContent = "리셋 후 시작하거나, 모달에서 다시 하기!";

  updateUI();

  // 모달 표시
  mScore.textContent = String(score);
  mBestCombo.textContent = String(bestCombo);
  openModal();
}

function tick() {
  timeLeft -= 1;
  if (timeLeft <= 0) {
    timeLeft = 0;
    updateUI();
    stopGame();
    return;
  }
  updateUI();
}

function startGame() {
  if (running) return;

  closeModal();

  running = true;
  score = 0;
  combo = 0;
  bestCombo = 0;

  timeLeft = duration;

  inputEl.disabled = false;
  inputEl.focus();

  hintEl.textContent = "타이핑해서 맞히면 점수 +1 / 오타면 콤보 초기화";
  setResult("");

  newWord();
  updateUI();

  timerId = setInterval(tick, 1000);
}

function resetGame() {
  running = false;
  locked = false;
  composing = false;

  clearInterval(timerId);
  timerId = null;

  score = 0;
  combo = 0;
  bestCombo = 0;
  timeLeft = 0;

  inputEl.value = "";
  inputEl.disabled = true;
  inputEl.classList.remove("error", "shake");

  wordEl.textContent = "시간 선택 → 시작!";
  setResult("");
  hintEl.textContent = "시간 선택 → 시작!";
  closeModal();
  updateUI();
}

// ====== 오타 효과 ======
function punchError() {
  combo = 0;
  updateUI();

  inputEl.classList.add("error", "shake");
  void inputEl.offsetWidth;

  // 오타 나면 입력을 비우는 방식(원하면 유지하도록 바꿀 수 있음)
  inputEl.value = "";

  setTimeout(() => {
    inputEl.classList.remove("error", "shake");
  }, 260);
}

// ====== 판정 ======
function isPrefix(typed, target) {
  return target.startsWith(typed);
}

function tryHitOrMistake() {
  if (!running) return;
  if (composing) return;
  if (locked) return;

  const typed = inputEl.value;
  if (!typed) return;

  // 오타: 접두사 아니면 틀림
  if (!isPrefix(typed, current)) {
    punchError();
    return;
  }

  // 정답
  if (typed === current) {
    locked = true;

    score += 1;
    combo += 1;
    if (combo > bestCombo) bestCombo = combo;

    updateUI();
    setResult("HIT!", "hit");

    requestAnimationFrame(() => {
      newWord();
      locked = false;
    });
  }
}

// ====== 이벤트 ======
btn30.addEventListener("click", () => {
  if (running) return;
  duration = 30;
  setActiveDurationButtons();
});

btn60.addEventListener("click", () => {
  if (running) return;
  duration = 60;
  setActiveDurationButtons();
});

startBtn.addEventListener("click", startGame);
resetBtn.addEventListener("click", resetGame);

// 한글 IME 조합 이벤트
inputEl.addEventListener("compositionstart", () => {
  composing = true;
});

inputEl.addEventListener("compositionend", () => {
  composing = false;
  tryHitOrMistake();
});

inputEl.addEventListener("input", () => {
  tryHitOrMistake();
});

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    tryHitOrMistake();
  }
});

// 모달 버튼
playAgainBtn.addEventListener("click", () => {
  closeModal();
  resetGame();
  startGame();
});

closeModalBtn.addEventListener("click", () => {
  closeModal();
});

// 모달 바깥 클릭 시 닫기
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

// ESC로 모달 닫기
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal.classList.contains("show")) {
    closeModal();
  }
});

// 초기 상태
setActiveDurationButtons();
resetGame();
