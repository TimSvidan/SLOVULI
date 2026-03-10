// Словарь русских слов из 5 букв.
// Используем открытый словарь Wordle (~27k слов)
// из репозитория mediahope/Wordle-Russian-Dictionary.
//
// При запуске мини‑приложения:
// - загружаем текстовый файл Russian.txt по сети,
// - нормализуем слова (нижний регистр, ё→е, только буквы),
// - берём первые ~12000 слов (по алфавиту, от простых к более редким).
//
// В игре используются глобальные переменные WORDS и WORDS_READY.

let WORDS = [];
let WORDS_READY = false;

const DICT_URL =
  "https://raw.githubusercontent.com/mediahope/Wordle-Russian-Dictionary/main/Russian.txt";

(async () => {
  try {
    const res = await fetch(DICT_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();

    const rawWords = text.split(/\r?\n/);

    // нормализация и фильтрация только 5‑буквенных слов
    const normalized = rawWords
      .map((w) =>
        w
          .trim()
          .toLowerCase()
          .replace(/ё/g, "е")
      )
      .filter((w) => /^[а-я]{5}$/.test(w));

    // берём весь словарь 5‑буквенных слов (~27k)
    WORDS = normalized;
    WORDS_READY = true;
    console.log("Словарь WORDS загружен:", WORDS.length, "слов");
  } catch (e) {
    console.error("Не удалось загрузить словарь WORDS:", e);
    // На крайний случай — небольшой запас слов, чтобы игра не ломалась вовсе.
    WORDS = [
      "мирок",
      "слива",
      "книга",
      "домик",
      "стена",
      "зебра",
      "лампа",
      "кошка",
      "мышь",
    ]
      .map((w) =>
        w
          .trim()
          .toLowerCase()
          .replace(/ё/g, "е")
      )
      .filter((w) => /^[а-я]{5}$/.test(w));
    WORDS_READY = true;
  }
})();

