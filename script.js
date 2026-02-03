// ===== 설정 =====
const HISTORY_KEY = "typing_punch_history_v1";
const HISTORY_LIMIT = 20;

// ===== 상태 =====
let duration = 30;
let timeLeft = 0;
let timerId = null;

let score = 0;
let combo = 0;
let bestCombo = 0;

let current = "";
let lastWord = ""; // ✅ 직전 단어 기억(연속 방지)
let locked = false;
let composing = false;
let running = false;

// 정확도/오타/WPM용 카운터
let mistakes = 0;
let wrongChars = 0;
let correctChars = 0;

// ===== DOM =====
const wordEl = document.getElementById("word");
const inputEl = document.getElementById("input");

const timeLeftEl = document.getElementById("timeLeft");
const scoreEl = document.getElementById("score");
const comboEl = document.getElementById("combo");
const bestComboEl = document.getElementById("bestCombo");

const accEl = document.getElementById("acc");
const mistakesEl = document.getElementById("mistakes");
const wpmEl = document.getElementById("wpm");
const rankEl = document.getElementById("rank");

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
const mAcc = document.getElementById("mAcc");
const mMistakes = document.getElementById("mMistakes");
const mWpm = document.getElementById("mWpm");
const mRank = document.getElementById("mRank");

const playAgainBtn = document.getElementById("playAgainBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const historyList = document.getElementById("historyList");
const historyEmpty = document.getElementById("historyEmpty");

// ===== 유틸 =====
function setActiveDurationButtons() {
  btn30.classList.toggle("active", duration === 30);
  btn60.classList.toggle("active", duration === 60);
}

function setResult(text = "", className = "") {
  resultEl.textContent = text;
  resultEl.className = "result" + (className ? ` ${className}` : "");
}

function closeModal() {
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

function openModal() {
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function pickWord() {
  const list = window.WORDS ?? [];
  if (!list.length) return "WORDS가 비어있음";
  if (list.length === 1) return list[0];

  let w = list[Math.floor(Math.random() * list.length)];
  let tries = 0;

  // ✅ 연속 동일 단어 방지
  while (w === lastWord && tries < 10) {
    w = list[Math.floor(Math.random() * list.length)];
    tries += 1;
  }
  return w;
}

function newWord() {
  // ✅ 먼저 직전 단어 업데이트
  lastWord = current;

  current = pickWord();
  wordEl.textContent = current;

  inputEl.value = "";
  inputEl.classList.remove("error", "shake");
  setResult("");

  composing = false;
  inputEl.focus();
}

function calcAccuracy() {
  const total = correctChars + wrongChars;
  if (total === 0) return 0;
  return (correctChars / total) * 100;
}

function calcWPM() {
  const minutes = duration / 60;
  if (minutes <= 0) return 0;
  return correctChars / 5 / minutes;
}

function calcRank(acc, wpm) {
  if (acc >= 97 && wpm >= 32) return "S";
  if (acc >= 94 && wpm >= 25) return "A";
  if (acc >= 90 && wpm >= 18) return "B";
  return "C";
}

function updateLiveStats() {
  const acc = calcAccuracy();
  const wpm = calcWPM();
  const rank = calcRank(acc, wpm);

  accEl.textContent = running ? `${acc.toFixed(1)}%` : "—";
  mistakesEl.textContent = String(mistakes);
  wpmEl.textContent = running ? `${Math.round(wpm)}` : "—";
  rankEl.textContent = running ? rank : "—";
}

function updateUI() {
  timeLeftEl.textContent = running ? `${timeLeft}s` : "—";
  scoreEl.textContent = String(score);
  comboEl.textContent = String(combo);
  bestComboEl.textContent = String(bestCombo);
  updateLiveStats();
}

// ===== 기록 저장 =====
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveHistory(list) {
  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(list.slice(0, HISTORY_LIMIT)),
    );
  } catch {}
}

function formatTime(ts) {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function renderHistory() {
  const list = loadHistory();
  historyList.innerHTML = "";

  if (!list.length) {
    historyEmpty.style.display = "block";
    return;
  }
  historyEmpty.style.display = "none";

  list.forEach((r) => {
    const row = document.createElement("div");
    row.className = "hrow";
    row.innerHTML = `
      <div class="muted">${formatTime(r.ts)} / ${r.duration}s</div>
      <div>점수 ${r.score}</div>
      <div class="hide-sm">정확도 ${r.acc.toFixed(1)}%</div>
      <div class="hide-sm">WPM ${Math.round(r.wpm)}</div>
      <div class="hide-sm">오타 ${r.mistakes}</div>
      <div><span class="badge">${r.rank}</span></div>
    `;
    historyList.appendChild(row);
  });
}

// ===== 게임 흐름 =====
function stopGame() {
  running = false;
  locked = false;
  composing = false;

  clearInterval(timerId);
  timerId = null;

  inputEl.disabled = true;

  const acc = calcAccuracy();
  const wpm = calcWPM();
  const rank = calcRank(acc, wpm);

  setResult(`끝! 점수 ${score} / 최고 콤보 ${bestCombo}`, "end");
  hintEl.textContent = "리셋 후 시작하거나, 모달에서 다시 하기!";

  // 기록 저장
  const record = {
    ts: Date.now(),
    duration,
    score,
    bestCombo,
    acc,
    wpm,
    rank,
    mistakes,
    correctChars,
    wrongChars,
  };

  const history = loadHistory();
  history.unshift(record);
  saveHistory(history);

  // 모달 값 채우기
  mScore.textContent = String(score);
  mBestCombo.textContent = String(bestCombo);
  mAcc.textContent = `${acc.toFixed(1)}%`;
  mMistakes.textContent = String(mistakes);
  mWpm.textContent = String(Math.round(wpm));
  mRank.textContent = rank;

  updateUI();
  renderHistory();
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

  mistakes = 0;
  wrongChars = 0;
  correctChars = 0;

  // ✅ 시작할 때 lastWord 초기화 (연속 방지 안정)
  lastWord = "";
  current = "";

  timeLeft = duration;

  inputEl.disabled = false;
  inputEl.focus();

  hintEl.textContent =
    "단어를 입력한 뒤 Enter를 눌러 펀치! (오타면 콤보 초기화)";
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

  mistakes = 0;
  wrongChars = 0;
  correctChars = 0;

  // ✅ reset에서도 초기화
  lastWord = "";
  current = "";

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

// ===== 오타 효과 =====
function punchError(typedAtError) {
  mistakes += 1;
  wrongChars += typedAtError.length;
  combo = 0;

  inputEl.classList.add("error", "shake");
  void inputEl.offsetWidth;

  inputEl.value = "";

  setTimeout(() => {
    inputEl.classList.remove("error", "shake");
  }, 260);

  updateUI();
}

function normalizeText(s) {
  // 공백 여러 개는 1개로, 앞뒤 공백은 제거 (난이도 완화)
  return s.replace(/\s+/g, " ").trim();
}

function judgeOnEnter() {
  if (!running) return;
  if (composing) return;
  if (locked) return;

  const typedRaw = inputEl.value;
  if (!typedRaw) return;

  const typed = normalizeText(typedRaw);
  const target = normalizeText(current);

  if (typed !== target) {
    punchError(typedRaw);
    return;
  }

  locked = true;

  score += 1;
  combo += 1;
  if (combo > bestCombo) bestCombo = combo;

  correctChars += current.length;

  updateUI();
  setResult("HIT!", "hit");

  requestAnimationFrame(() => {
    newWord();
    locked = false;
  });
}

// ===== 이벤트 =====
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

inputEl.addEventListener("compositionstart", () => {
  composing = true;
});

inputEl.addEventListener("compositionend", () => {
  composing = false;
});

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    judgeOnEnter();
  }
});

playAgainBtn.addEventListener("click", () => {
  closeModal();
  resetGame();
  startGame();
});

closeModalBtn.addEventListener("click", () => {
  closeModal();
});

clearHistoryBtn.addEventListener("click", () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal.classList.contains("show")) {
    closeModal();
  }
});

// 초기 상태
setActiveDurationButtons();
renderHistory();
resetGame();
