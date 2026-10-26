(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const LS_GAME = "qf_game_v1";
  const LS_SERVER = "qf_server_v1";

  const GENRES = ["cyberpunk","fantasy","sci-fi","adventure","mystery","dystopia","superhero","medieval"];
  const DIFFS  = ["easy","medium","hard"];

  const state = {
    quest: null,
    images: {},          // slide_id -> dataURL/objectURL
    idx: 0,
    answered: false,
    correct: 0,
    wrong: 0,
    configSnapshot: null,
  };

  /* ---------- утилиты ---------- */
  const loadLocal = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };
  const saveLocal = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    $(id).classList.add("active");
  }

  let toastTimer = null;
  function toast(msg, ms = 3500) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add("hidden"), ms);
  }

  const curSlide = () => state.quest?.slides?.[state.idx] ?? null;
  const isLast   = () => state.idx === (state.quest?.slides?.length ?? 1) - 1;

  /* ---------- настройки ---------- */
  function gameSettings() { return loadLocal(LS_GAME, APP_CONFIG.DEFAULTS); }

  function fillSelect(sel, items, current) {
    sel.innerHTML = "";
    items.forEach(v => {
      const o = document.createElement("option");
      o.value = v; o.textContent = v;
      if (v === current) o.selected = true;
      sel.appendChild(o);
    });
  }

  function openSettings() {
    const g = gameSettings();
    const s = loadLocal(LS_SERVER, {});
    $("set-n").value = g.n ?? 6;
    $("set-topic").value = g.topic ?? "";
    fillSelect($("set-genre"), GENRES, g.genre);
    fillSelect($("set-difficulty"), DIFFS, g.difficulty);
    $("set-theory").checked = !!g.includeTheory;
    $("set-snd-buttons").value = g.sound?.buttons ?? 70;
    $("set-snd-fx").value = g.sound?.fx ?? 50;
    $("set-snd-music").value = g.sound?.music ?? 80;

    // серверные поля: из снапшота конфига бэка, поверх — локальные правки
    const c = state.configSnapshot || {};
    $("set-llm-url").value   = s.llmUrl   ?? c?.llm?.base_url ?? "";
    $("set-llm-model").value = s.llmModel ?? c?.llm?.model ?? "";
    $("set-img-url").value   = s.imgUrl   ?? c?.image?.base_url ?? "";
    $("set-img-model").value = s.imgModel ?? c?.image?.model ?? "";
    $("set-llm-token").value = "";
    $("set-img-token").value = "";
    $("set-adapter").value   = s.adapter ?? "";

    $("modal-settings").classList.remove("hidden");
  }

  const closeSettings = () => $("modal-settings").classList.add("hidden");

  async function saveSettings() {
    const game = {
      n: Math.min(12, Math.max(3, parseInt($("set-n").value, 10) || 6)),
      topic: $("set-topic").value.trim(),
      genre: $("set-genre").value,
      difficulty: $("set-difficulty").value,
      includeTheory: $("set-theory").checked,
      sound: {
        buttons: +$("set-snd-buttons").value,
        fx: +$("set-snd-fx").value,
        music: +$("set-snd-music").value,
      },
    };
    saveLocal(LS_GAME, game);

    const server = {
      llmUrl: $("set-llm-url").value.trim(),
      imgUrl: $("set-img-url").value.trim(),
      llmModel: $("set-llm-model").value.trim(),
      imgModel: $("set-img-model").value.trim(),
      llmToken: $("set-llm-token").value.trim(),
      imgToken: $("set-img-token").value.trim(),
      adapter: $("set-adapter").value.trim(),
    };
    saveLocal(LS_SERVER, server);

    // PUT /config: берём снапшот и точечно меняем только непустые поля
    const cfg = state.configSnapshot
      ? JSON.parse(JSON.stringify(state.configSnapshot))
      : { llm: {}, image: {} };
    cfg.llm = cfg.llm || {}; cfg.image = cfg.image || {};
    if (server.llmUrl)   cfg.llm.base_url = server.llmUrl;
    if (server.llmModel) cfg.llm.model = server.llmModel;
    if (server.llmToken) cfg.llm.token = server.llmToken;
    if (server.imgUrl)   cfg.image.base_url = server.imgUrl;
    if (server.imgModel) cfg.image.model = server.imgModel;
    if (server.imgToken) cfg.image.token = server.imgToken;

    try {
      await Api.putConfig(cfg);
      state.configSnapshot = cfg;
      toast("НАСТРОЙКИ СОХРАНЕНЫ И ПРИМЕНЕНЫ");
    } catch (e) {
      toast("ЛОКАЛЬНО СОХРАНЕНО, НО БЭК НЕ ПРИНЯЛ КОНФИГ: " + e.message);
    }
    closeSettings();
  }

  /* ---------- игра ---------- */
  async function startGame() {
    const g = gameSettings();
    if (!g.topic) { toast("УКАЖИТЕ ТЕМУ В НАСТРОЙКАХ"); openSettings(); return; }

    showScreen("screen-loading");
    $("loading-text").textContent = "ГЕНЕРАЦИЯ КВЕСТА: " + g.topic.toUpperCase();
    try {
      const data = await Api.postQuest({
        topic: g.topic,
        genre: g.genre,
        difficulty: g.difficulty,
        n: g.n,
        include_theory: g.includeTheory,
      });
      state.quest = data.slides ? data : (data.quest ?? null);
      if (!state.quest) throw new Error("пустой ответ /quest");
      state.idx = 0; state.correct = 0; state.wrong = 0; state.images = {};
      showScreen("screen-game");
      renderSlide();
      preloadImages();
    } catch (e) {
      showError("НЕ УДАЛОСЬ СГЕНЕРИРОВАТЬ КВЕСТ: " + e.message);
    }
  }

  const showError = (msg) => { $("error-text").textContent = msg; showScreen("screen-error"); };

  // очередь с параллелизмом 2: сейчас заглушки мгновенные,
  // позже диффузионка не положит сервер одновременными запросами
  async function preloadImages() {
    const queue = (state.quest.slides || []).map(sl => async () => {
      try {
        const url = await Api.fetchSlideImage(sl.picture || "");
        if (url) {
          state.images[sl.slide_id] = url;
          if (curSlide()?.slide_id === sl.slide_id) applyImage(url);
        }
      } catch (_) { /* слайд останется с заглушкой-паттерном */ }
    });
    const workers = [0, 1].map(async () => { while (queue.length) await queue.shift()(); });
    await Promise.all(workers);
  }

  function applyImage(url) {
    const img = $("game-image"), ph = $("game-image-placeholder");
    if (url) { img.src = url; img.classList.remove("hidden"); ph.classList.add("hidden"); }
    else     { img.classList.add("hidden"); ph.classList.remove("hidden"); }
  }

  function renderSlide() {
    const sl = curSlide();
    if (!sl) return finish();
    state.answered = false;
    $("feedback").classList.add("hidden");
    $("burger-menu").classList.add("hidden");

    const isQ = sl.type === "question_select";
    $("dialog-speaker").textContent = isQ ? "НУЖНО ОТВЕТИТЬ НА ВОПРОС" : (sl.speaker || "РАССКАЗЧИК");
    $("dialog-text").textContent = sl.text;

    const box = $("answers");
    box.innerHTML = "";
    if (isQ) {
      box.classList.remove("hidden");
      (sl.answers || []).forEach(a => {
        const b = document.createElement("button");
        b.className = "btn answer-btn";
        b.textContent = a.answer_text;
        b.onclick = () => onAnswer(a, b);
        box.appendChild(b);
      });
      $("btn-next").classList.add("hidden");
    } else {
      box.classList.add("hidden");
      $("btn-next").classList.remove("hidden");
      $("btn-next").textContent = isLast() ? "ЗАВЕРШИТЬ" : "ДАЛЕЕ";
    }
    applyImage(state.images[sl.slide_id] || null);
  }

  function onAnswer(a, btn) {
    if (state.answered) return;
    state.answered = true;
    [...$("answers").children].forEach(b => (b.disabled = true));
    const fb = $("feedback");
    fb.classList.remove("hidden");

    if (a.is_correct) {
      state.correct++;
      btn.classList.add("answer-correct");
      fb.textContent = "ВЕРНО!";
      fb.className = "feedback ok";
      $("btn-next").classList.remove("hidden");
      $("btn-next").textContent = isLast() ? "ЗАВЕРШИТЬ" : "ДАЛЕЕ";
    } else {
      state.wrong++;
      btn.classList.add("answer-wrong");
      fb.textContent = "НЕВЕРНО! ВОЗВРАЩАЕМСЯ К НАЧАЛУ...";
      fb.className = "feedback bad";
      setTimeout(() => { state.idx = 0; renderSlide(); }, 1600); // по ТЗ: перезапуск со справки
    }
  }

  function finish() {
    $("finish-stats").textContent =
      `ВЕРНЫХ С ПЕРВОЙ ПОПЫТКИ: ${state.correct}   ОШИБОК: ${state.wrong}`;
    showScreen("screen-finish");
  }

  /* ---------- разводка кнопок ---------- */
  $("btn-start").onclick = startGame;
  $("btn-settings").onclick = openSettings;
  $("btn-settings-close").onclick = closeSettings;
  $("btn-settings-ok").onclick = saveSettings;
  $("btn-next").onclick = () => { isLast() ? finish() : (state.idx++, renderSlide()); };
  $("btn-retry").onclick = startGame;
  $("btn-error-menu").onclick = () => showScreen("screen-menu");
  $("btn-again").onclick = startGame;
  $("btn-finish-menu").onclick = () => showScreen("screen-menu");
  $("btn-to-menu").onclick = () => showScreen("screen-menu");
  $("btn-restart").onclick = () => { state.idx = 0; state.correct = 0; state.wrong = 0; renderSlide(); };
  $("btn-burger").onclick = () => $("burger-menu").classList.toggle("hidden");

  /* ---------- старт ---------- */
  (async function init() {
    fillSelect($("set-genre"), GENRES, APP_CONFIG.DEFAULTS.genre);
    fillSelect($("set-difficulty"), DIFFS, APP_CONFIG.DEFAULTS.difficulty);
    try { state.configSnapshot = await Api.getConfig(); } catch (_) {}
    try { await Api.health(); $("backend-status").textContent = "СЕРВЕР: ОНЛАЙН"; }
    catch { $("backend-status").textContent = "СЕРВЕР: НЕДОСТУПЕН"; }
  })();
})();