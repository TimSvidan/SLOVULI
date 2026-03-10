// Конфигурация
const WORD_LENGTH = 5;
const MAX_TRIES = 5;

const ruAlphabetRows = [
  "йцукенгшщзхъ".split(""),
  "фывапролджэ".split(""),
  ["ё", ...("ячсмитьбю".split(""))],
];

let secretWord = null;
let currentRow = 0;
let currentCol = 0;
let isGameOver = false;

const gridEl = document.getElementById("grid");
const keyboardEl = document.getElementById("keyboard");
const toastEl = document.getElementById("toast");
const setupScreenEl = document.getElementById("setup-screen");
const playScreenEl = document.getElementById("play-screen");
const secretInputEl = document.getElementById("secret-input");
const btnGenerateLink = document.getElementById("btn-generate-link");
const shareBlockEl = document.getElementById("share-block");
const shareLinkEl = document.getElementById("share-link");
const btnCopyLink = document.getElementById("btn-copy-link");
const btnTgShare = document.getElementById("btn-tg-share");
const playHintEl = document.getElementById("play-hint");

const resultModalEl = document.getElementById("result-modal");
const resultTitleEl = document.getElementById("result-title");
const resultWordEl = document.getElementById("result-word");
const resultSubtitleEl = document.getElementById("result-subtitle");
const btnAgain = document.getElementById("btn-again");
const btnShareResult = document.getElementById("btn-share-result");

// Безопасная base64 для кириллицы (стандартная и URL-совместимая)
function encodeBase64Unicode(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode("0x" + p1)));
}

function decodeBase64Unicode(str) {
  return decodeURIComponent(
    atob(str)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
}

// Вариант base64url, разрешённый Telegram для start_param
function encodeBase64UrlUnicode(str) {
  return encodeBase64Unicode(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64UrlUnicode(str) {
  let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) {
    b64 += "=";
  }
  return decodeBase64Unicode(b64);
}

function normalizeWord(raw) {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^а-я]/g, "");
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("visible");
  setTimeout(() => toastEl.classList.remove("visible"), 1800);
}

function switchScreen(mode) {
  if (mode === "setup") {
    setupScreenEl.classList.add("active");
    playScreenEl.classList.remove("active");
  } else {
    setupScreenEl.classList.remove("active");
    playScreenEl.classList.add("active");
  }
}

function initTelegram() {
  if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
  }
}

function initGrid() {
  gridEl.innerHTML = "";
  for (let r = 0; r < MAX_TRIES; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.row = r.toString();
      tile.dataset.col = c.toString();
      rowEl.appendChild(tile);
    }
    gridEl.appendChild(rowEl);
  }
}

function initKeyboard() {
  keyboardEl.innerHTML = "";
  ruAlphabetRows.forEach((row, rowIndex) => {
    const rowEl = document.createElement("div");
    rowEl.className = "keyboard-row";

    row.forEach((ch) => {
      const btn = document.createElement("button");
      btn.className = "key";
      btn.textContent = ch;
      btn.dataset.key = ch;
      rowEl.appendChild(btn);
    });

    if (rowIndex === 2) {
      const backKey = document.createElement("button");
      backKey.className = "key wide";
      backKey.textContent = "⌫";
      backKey.dataset.key = "backspace";
      rowEl.appendChild(backKey);
    }

    keyboardEl.appendChild(rowEl);
  });

  // Отдельная большая кнопка "Ввод" по центру снизу
  const enterRow = document.createElement("div");
  enterRow.className = "keyboard-row enter-row";

  const enterMain = document.createElement("button");
  enterMain.className = "key enter-main";
  enterMain.textContent = "Ввод";
  enterMain.dataset.key = "enter";

  enterRow.appendChild(enterMain);
  keyboardEl.appendChild(enterRow);

  keyboardEl.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const key = target.dataset.key;
    if (!key) return;
    handleVirtualKey(key);
  });
}

function getTile(row, col) {
  return gridEl.querySelector(`.tile[data-row="${row}"][data-col="${col}"]`);
}

function currentGuess() {
  let word = "";
  for (let c = 0; c < WORD_LENGTH; c++) {
    const tile = getTile(currentRow, c);
    word += (tile.textContent || "").toLowerCase();
  }
  return normalizeWord(word);
}

function setTileLetter(row, col, letter) {
  const tile = getTile(row, col);
  if (tile) {
    tile.textContent = letter.toUpperCase();
  }
}

function handleVirtualKey(key) {
  if (isGameOver) return;

  if (key === "enter") {
    submitGuess();
  } else if (key === "backspace") {
    if (currentCol > 0) {
      currentCol--;
      setTileLetter(currentRow, currentCol, "");
    }
  } else {
    // русская буква
    if (!/^[а-яё]$/.test(key)) return;
    if (currentCol >= WORD_LENGTH) return;
    setTileLetter(currentRow, currentCol, key);
    currentCol++;
  }
}

function submitGuess() {
  if (!secretWord) return;
  if (!WORDS_READY || !Array.isArray(WORDS) || WORDS.length === 0) {
    showToast("Словарь загружается, подожди секунду");
    return;
  }
  if (currentCol < WORD_LENGTH) {
    showToast("Недостаточно букв");
    return;
  }

  const guess = currentGuess();
  if (guess.length !== WORD_LENGTH) {
    showToast("Используй только русские буквы");
    return;
  }

  if (!WORDS.includes(guess)) {
    showToast("Нет в словаре");
    return;
  }

  const result = evaluateGuess(guess, secretWord);
  revealRow(result, () => {
    if (guess === secretWord) {
      finishGame(true);
    } else if (currentRow === MAX_TRIES - 1) {
      finishGame(false);
    } else {
      currentRow++;
      currentCol = 0;
    }
  });
}

function evaluateGuess(guess, target) {
  const result = Array(WORD_LENGTH).fill("absent");
  const targetLetters = target.split("");
  const used = Array(WORD_LENGTH).fill(false);

  // Сначала точные совпадения
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === targetLetters[i]) {
      result[i] = "correct";
      used[i] = true;
    }
  }

  // Затем буквы "не на месте"
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === "correct") continue;
    const ch = guess[i];
    const idx = targetLetters.findIndex((t, j) => !used[j] && t === ch);
    if (idx >= 0) {
      result[i] = "present";
      used[idx] = true;
    }
  }

  return result;
}

function updateKeyboardColors(guess, evaluation) {
  for (let i = 0; i < WORD_LENGTH; i++) {
    const ch = guess[i];
    const status = evaluation[i];
    const keyBtn = keyboardEl.querySelector(`.key[data-key="${ch}"]`);
    if (!keyBtn) continue;

    const currentClass = keyBtn.classList;
    if (status === "correct") {
      currentClass.remove("present", "absent");
      currentClass.add("correct");
    } else if (status === "present") {
      if (!currentClass.contains("correct")) {
        currentClass.remove("absent");
        currentClass.add("present");
      }
    } else if (status === "absent") {
      if (!currentClass.contains("correct") && !currentClass.contains("present")) {
        currentClass.add("absent");
      }
    }
  }
}

function revealRow(evaluation, onDone) {
  const guess = currentGuess();
  for (let i = 0; i < WORD_LENGTH; i++) {
    const tile = getTile(currentRow, i);
    if (!tile) continue;
    const status = evaluation[i];
    setTimeout(() => {
      tile.classList.add("flip");
      setTimeout(() => {
        tile.classList.remove("flip");
        tile.classList.add(status);
        if (i === WORD_LENGTH - 1) {
          updateKeyboardColors(guess, evaluation);
          if (typeof onDone === "function") onDone();
        }
      }, 200);
    }, i * 220);
  }
}

function finishGame(won) {
  isGameOver = true;
  resultModalEl.classList.add("active");
  resultTitleEl.textContent = won ? "Победа!" : "Попытки закончились";
  resultWordEl.textContent = secretWord.toUpperCase();
  resultSubtitleEl.textContent = won
    ? "Ты угадал слово. Поделись результатом с другом!"
    : "Не расстраивайся, попробуй ещё раз или загадай слово другу.";
}

function setupMode() {
  switchScreen("setup");
  shareBlockEl.style.display = "none";
  secretInputEl.value = "";
}

function playMode(withSecret) {
  secretWord = withSecret;
  currentRow = 0;
  currentCol = 0;
  isGameOver = false;

  document.querySelectorAll(".key").forEach((k) => {
    k.classList.remove("correct", "present", "absent");
  });

  initGrid();
  switchScreen("play");

  playHintEl.textContent = "Введи 5-буквенное слово на русском языке.";
}

function getSecretFromUrl() {
  // 1) Если мини‑приложение запущено внутри Telegram — читаем start_param (base64url)
  try {
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
      const startParam = window.Telegram.WebApp.initDataUnsafe.start_param;
      if (startParam) {
        const decoded = decodeBase64UrlUnicode(startParam);
        const normalized = normalizeWord(decoded);
        if (normalized.length === WORD_LENGTH) {
          return normalized;
        }
      }
    }
  } catch (e) {
    console.error("Ошибка чтения start_param:", e);
  }

  // 2) Фолбэк для запуска в обычном браузере:
  //    ?startapp=BASE64URL (новый формат) или ?word=BASE64 (старый формат)
  const params = new URLSearchParams(window.location.search);
  const encodedStartApp = params.get("startapp");
  const encodedWord = params.get("word");

  try {
    if (encodedStartApp) {
      const decoded = decodeBase64UrlUnicode(encodedStartApp);
      const normalized = normalizeWord(decoded);
      if (normalized.length === WORD_LENGTH) {
        return normalized;
      }
    }
  } catch (e) {
    console.error("Ошибка декодирования startapp:", e);
  }

  if (!encodedWord) return null;
  try {
    const decoded = decodeBase64Unicode(encodedWord);
    const normalized = normalizeWord(decoded);
    if (normalized.length === WORD_LENGTH) {
      return normalized;
    }
  } catch (e) {
    console.error("Ошибка декодирования слова:", e);
  }
  return null;
}

function buildBotLinkForSecret(secret) {
  const encoded = encodeBase64UrlUnicode(secret);
  const base = "https://t.me/lapuli5bukv_bot/SLOVULI";
  const url = new URL(base);
  url.searchParams.set("startapp", encoded);
  return url.toString();
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
  return Promise.resolve();
}

function initShareControls() {
  btnGenerateLink.addEventListener("click", () => {
    const raw = secretInputEl.value;
    const normalized = normalizeWord(raw);

    if (normalized.length !== WORD_LENGTH) {
      showToast("Нужно слово из 5 русских букв");
      return;
    }

    const link = buildBotLinkForSecret(normalized);
    shareLinkEl.value = link;
    shareBlockEl.style.display = "block";

    copyToClipboard(link).then(
      () => showToast("Ссылка скопирована"),
      () => showToast("Скопируй ссылку вручную")
    );
  });

  btnCopyLink.addEventListener("click", () => {
    const link = shareLinkEl.value;
    if (!link) return;
    copyToClipboard(link).then(
      () => showToast("Скопировано"),
      () => showToast("Не удалось скопировать")
    );
  });

  btnTgShare.addEventListener("click", () => {
    const link = shareLinkEl.value;
    if (!link) return;

    const text = "Угадай моё слово в Словули! 🎮";
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    window.open(shareUrl, "_blank");
  });

  btnAgain.addEventListener("click", () => {
    resultModalEl.classList.remove("active");
    // сбрасываем состояние игры и возвращаемся к экрану загадывания слова
    secretWord = null;
    currentRow = 0;
    currentCol = 0;
    isGameOver = false;
    setupMode();
  });

  btnShareResult.addEventListener("click", () => {
    const baseLink = buildBotLinkForSecret(secretWord);
    let text;
    if (resultTitleEl.textContent.startsWith("Победа")) {
      text = `Победа — слово: ${secretWord.toUpperCase()}`;
    } else {
      text = `Слово было: ${secretWord.toUpperCase()}`;
    }
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(baseLink)}&text=${encodeURIComponent(text)}`;
    window.open(shareUrl, "_blank");
  });

  resultModalEl.addEventListener("click", (e) => {
    if (e.target === resultModalEl) {
      resultModalEl.classList.remove("active");
    }
  });
}

function initGame() {
  initTelegram();
  initGrid();
  initKeyboard();
  initShareControls();

  const urlSecret = getSecretFromUrl();
  if (urlSecret) {
    // запускаем режим угадывания сразу
    playMode(urlSecret);
  } else {
    setupMode();
  }
}

window.addEventListener("load", initGame);

