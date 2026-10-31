/* ===================================================================
   СВОЯ ИГРА — Game Logic (Dual-View: Host + Projector Display)
   #МПКомитет
   =================================================================== */
// Имена игроков. Порядок важен: он же порядок кнопок у участников.
const PLAYER_NAMES = ['Ксюша', 'Мила', 'Денис', 'Юля', 'Катя'];
// Скорость бегущей строки с категориями (пикселей в секунду)
const CREDITS_SPEED = 110;
// Снимать очки, если нажавший первым ответил неверно (как в телеигре)
const PENALTY_ON_WRONG = true;
// ===================== ФОТО К ВОПРОСАМ =====================
// Фото лежат в image/<раунд>/<тема>.<вопрос>.jpg (или .png/.jpeg/.webp), например image/1/2.3.jpg.
// Если файла нет — фото не показываем (onMissing сообщает, что искали).
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'JPG', 'JPEG', 'PNG', 'WEBP', 'jfif'];
function imageCandidates(src) {
  if (/\.(jpe?g|png|webp|gif|svg|jfif)$/i.test(src) || /^(https?:|data:)/i.test(src)) return [src];
  const name = src.replace(/^images?\//, '');
  const list = [];
  ['image/', 'images/', ''].forEach(dir => IMAGE_EXTS.forEach(e => list.push(dir + name + '.' + e)));
  return list;
}
function loadQuestionImage(img, wrap, src, onMissing) {
  img.onload = null; img.onerror = null;
  if (!src) { wrap.style.display = 'none'; img.removeAttribute('src'); return; }
  const list = imageCandidates(src);
  let i = 0;
  wrap.style.display = 'none';
  img.onload = () => { wrap.style.display = 'block'; };
  img.onerror = () => {
    i++;
    if (i < list.length) img.src = list[i];
    else { wrap.style.display = 'none'; img.removeAttribute('src'); if (onMissing) onMissing(src); }
  };
  img.src = list[0];
}

// ===================== СВЯЗЬ С СЕРВЕРОМ =====================
// Игра сама ищет сервер (node server.js, порт 3001) по списку адресов:
//   1) тот же адрес, с которого открыта страница (если сайт отдаёт сам server.js)
//   2) port/3001 — схема с прокси хостинга
//   3) тот же компьютер, порт 3001 (сайт открыт отдельно, например двойным щелчком или Live Server)
const SYNC_CANDIDATES = (() => {
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    const list = ['', 'port/3001'];
    if (location.protocol === 'http:') list.push('http://' + location.hostname + ':3001');
    return list;
  }
  return ['http://localhost:3001'];
})();
const NET = { base: null, ok: null, fails: 0, missing: new Set(), detecting: null, lastDetect: 0, onUp: [], info: null };
const NET_VIEW = new URLSearchParams(location.search).get('view') || 'host';

function fetchTimeout(url, opts, ms) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => { if (ctl) ctl.abort(); }, ms);
  return fetch(url, Object.assign({}, opts, ctl ? { signal: ctl.signal } : {}))
    .finally(() => clearTimeout(timer));
}

async function probeBase(base) {
  try {
    const r = await fetchTimeout(base + '/state', { cache: 'no-store' }, 2500);
    if (!r.ok) return false;
    const d = await r.json();
    return !!d && typeof d === 'object' && !Array.isArray(d);
  } catch (e) { return false; }
}

function detectBase() {
  if (!NET.detecting) {
    NET.detecting = (async () => {
      for (const c of SYNC_CANDIDATES) {
        if (await probeBase(c)) { NET.base = c; return c; }
      }
      return null;
    })().then(r => { NET.lastDetect = Date.now(); NET.detecting = null; return r; });
  }
  return NET.detecting;
}

function netTriedList() {
  return SYNC_CANDIDATES.map(c => {
    try { return new URL(c + '/', location.href).href.replace(/\/$/, ''); } catch (e) { return c; }
  });
}

function renderNetPill() {
  const down = NET.ok === false;
  const stale = NET.missing.size > 0;

  const st = document.getElementById('server-status');
  if (st) {
    if (NET.ok === null) { st.textContent = 'Проверяю связь с сервером…'; st.className = 'server-status'; }
    else if (down) { st.textContent = '⚠ Сервер не найден — запустите node server.js'; st.className = 'server-status bad'; }
    else if (stale) { st.textContent = '⚠ Сервер устарел — замените server.js и перезапустите'; st.className = 'server-status bad'; }
    else { st.textContent = '✓ Сервер подключён'; st.className = 'server-status ok'; }
  }

  let el = document.getElementById('net-pill');
  if (!down && !stale) { if (el) el.style.display = 'none'; return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'net-pill';
    el.className = 'net-pill';
    el.innerHTML = '<b></b><span></span>';
    document.body.appendChild(el);
  }
  const title = el.querySelector('b');
  const hint = el.querySelector('span');
  if (down) {
    title.textContent = '⚠ Нет связи с сервером';
    hint.textContent = NET_VIEW === 'buzzer'
      ? 'Подключитесь к той же Wi-Fi сети, что и ведущий, и откройте ссылку, которую он показывает.'
      : 'Запустите на компьютере ведущего «node server.js» и откройте игру по адресу http://localhost:3001 . Пробовал: ' + netTriedList().join(' , ');
  } else {
    title.textContent = '⚠ Сервер устарел';
    hint.textContent = 'Замените файл server.js на новый, закройте окно со старым сервером и запустите «node server.js» заново.';
  }
  el.style.display = 'block';
}

function netSet(ok) {
  const was = NET.ok;
  if (ok) { NET.fails = 0; NET.ok = true; }
  else { NET.fails++; if (NET.fails >= 2) NET.ok = false; }
  renderNetPill();
  if (ok && was === false) NET.onUp.forEach(f => { try { f(); } catch (e) {} });
}

async function apiJson(path, method, body) {
  if (NET.base === null) {
    if (!NET.detecting && Date.now() - NET.lastDetect < 1500) throw new Error('no server');
    if (await detectBase() === null) { netSet(false); throw new Error('no server'); }
  }
  let resp;
  try {
    resp = await fetchTimeout(NET.base + path, {
      method: method || 'GET',
      cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }, 5000);
  } catch (e) {
    if (NET.fails >= 1) NET.base = null; // в следующий раз поищем сервер заново
    netSet(false);
    throw e;
  }
  if (resp.status === 404) { NET.missing.add(path); netSet(true); throw new Error('HTTP 404'); }
  if (!resp.ok) { netSet(false); throw new Error('HTTP ' + resp.status); }
  let data;
  try { data = await resp.json(); }
  catch (e) { NET.base = null; netSet(false); throw e; }
  NET.missing.delete(path);
  netSet(true);
  return data;
}

(() => {
  'use strict';

  // ===================== VIEW MODE =====================
  const VIEW = new URLSearchParams(location.search).get('view') || 'host'; // 'host' | 'display'

  // Сколько раундов в игре: если round3 пустой, после 2 раунда сразу финал
  const ROUNDS_TOTAL = (QUESTIONS.round3 && QUESTIONS.round3.length) ? 3 : 2;

  const ROUND1_PRICES = [200, 404, 607, 777, 869, 1007];
  const ROUND2_PRICES = [200, 400, 600, 800, 1000];
  const ROUND3_PRICES = [300, 600, 900, 1200, 1500];

  if (VIEW === 'display') {
    document.body.setAttribute('data-view', 'display');
    // Hide host screens, show display view
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('display-view').style.display = 'flex';
    initDisplay();
    return;
  }

  if (VIEW === 'buzzer') {
    document.body.setAttribute('data-view', 'buzzer');
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('buzzer-view').style.display = 'flex';
    initBuzzer();
    return;
  }

  // ===================== STATE =====================
  const state = {
    players: [],
    round: 1,
    phase: 'start',
    usedQuestions: new Set(),
    currentQuestion: null,
    answerRevealed: false,
    timer: { interval: null, seconds: 30, max: 30, running: false },
    finalBets: [],
    finalAnswerRevealed: false,
    muted: false,
    started: false,        // игра начата (есть что продолжать)
    lastPhase: 'start',    // последний игровой экран (для «Продолжить»)
    questionSpent: false,  // на текущем вопросе уже были очки/ответ — вопрос сгорает
    leaveDone: false,      // вышли из вопроса кнопкой «Готово»
    finalStarted: false,
    finalShown: false,     // финальный вопрос уже показан (ставки сделаны)
    finalJudged: [],       // кому из игроков уже засчитан финальный ответ
  };

  // ===================== SYNC (backend server) =====================
  let syncSeq = 0; // растёт с каждой отправкой: сервер игнорирует устаревшие запросы

  function secretHidden(q) {
    return !!(q && q.passQuestion && q.secretStage !== 'done');
  }

  function buildSyncState() {
    return {
      type: 'sync',
      seq: (syncSeq = Math.max(Date.now(), syncSeq + 1)),
      phase: state.phase,
      round: state.round,
      players: state.players.map(p => ({ name: p.name, score: p.score })),
      usedQuestions: Array.from(state.usedQuestions),
      currentQuestion: state.currentQuestion ? {
        category: state.currentQuestion.category,
        price: state.currentQuestion.price,
        passQuestion: !!state.currentQuestion.passQuestion,
        modifier: !!state.currentQuestion.modifier,
        secretStage: state.currentQuestion.passQuestion ? (state.currentQuestion.secretStage || 'intro') : null,
        secretTo: state.currentQuestion.secretTo || null,
        // у вопроса с секретом текст и фото скрыты, пока вопрос не передан
        question: secretHidden(state.currentQuestion) ? '' : state.currentQuestion.question,
        image: secretHidden(state.currentQuestion) ? null : state.currentQuestion.image,
        answerImage: state.answerRevealed ? (state.currentQuestion.answerImage || null) : null,
        answer: state.answerRevealed ? state.currentQuestion.answer : null,
      } : null,
      answerRevealed: state.answerRevealed,
      timer: { seconds: state.timer.seconds, max: state.timer.max, running: state.timer.running },
      finalBets: state.finalBets,
      finalAnswerRevealed: state.finalAnswerRevealed,
    };
  }

  function broadcastState() {
    saveGame();
    apiJson('/state', 'POST', buildSyncState()).catch(() => {});
  }

  // ===================== UTILS =====================
  function esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function buildCreditsHTML() {
    const rounds = [
      { data: QUESTIONS.round1 },
      { data: QUESTIONS.round2 },
      { data: QUESTIONS.round3 },
    ];
    let html = '<div class="credits-title">Синтарсус</div>';
    rounds.forEach(r => {
      r.data.forEach(cat => {
        html += `<div class="credits-category">${esc(cat.category)}</div>`;
      });
    });
    return html;
  }

  function playCredits(rollId, viewportId, onEnd) {
    const roll = document.getElementById(rollId);
    const vp = document.getElementById(viewportId);
    roll.innerHTML = buildCreditsHTML();
    roll.style.animation = 'none';
    void roll.offsetHeight;
    const vpH = vp.offsetHeight;
    roll.style.setProperty('--vp', vpH + 'px');
    const seconds = (roll.offsetHeight + vpH) / CREDITS_SPEED;
    roll.style.animation = `creditsScroll ${seconds}s linear forwards`;
    roll.onanimationend = onEnd || null;
  }

  // ===================== AUDIO (procedural) =====================
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function beep(freq, duration = 0.12, type = 'square', vol = 0.25) {
    if (state.muted) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function playClick() { beep(520, 0.06, 'sine', 0.18); }
  function playCorrect() {
    if (state.muted) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => beep(f, 0.22, 'sine', 0.22), i * 110));
  }
  function playWrong() {
    if (state.muted) return;
    [392, 294, 196].forEach((f, i) => setTimeout(() => beep(f, 0.28, 'sawtooth', 0.2), i * 130));
  }
  function playTimerTick() { beep(900, 0.05, 'square', 0.12); }
  function playRoundEnd() {
    if (state.muted) return;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => setTimeout(() => beep(f, 0.3, 'triangle', 0.22), i * 100));
  }

  let bgMusic = null, bgMusicTimer = null;
  function startBgMusic() {
    if (state.muted || bgMusic) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const notes = [392, 440, 523.25, 587.33, 523.25, 440];
    let i = 0;
    bgMusic = { active: true };
    bgMusicTimer = setInterval(() => {
      if (!state.muted) beep(notes[i % notes.length], 0.35, 'sine', 0.06);
      i++;
    }, 700);
  }
  function stopBgMusic() {
    if (bgMusicTimer) { clearInterval(bgMusicTimer); bgMusicTimer = null; }
    bgMusic = null;
  }
  function toggleMute() {
    state.muted = !state.muted;
    if (state.muted) stopBgMusic();
    else startBgMusic();
    updateMuteButtons();
  }

  function updateMuteButtons() {
    const svgOn = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
    const svgOff = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
    const html = state.muted ? svgOff : svgOn;
    document.querySelectorAll('#btn-mute-start, #btn-mute-game').forEach(b => {
      b.innerHTML = html;
      b.setAttribute('aria-label', state.muted ? 'Включить звук' : 'Выключить звук');
      b.classList.toggle('muted', state.muted);
    });
  }

  // ===================== SCREEN MANAGEMENT =====================
  const screens = {
    start: document.getElementById('screen-start'),
    credits: document.getElementById('screen-credits'),
    board: document.getElementById('screen-board'),
    question: document.getElementById('screen-question'),
    final: document.getElementById('screen-final'),
    results: document.getElementById('screen-results'),
  };

  // История браузера: кнопка «Назад» (и в браузере, и в игре) возвращает на прошлый экран
  let histDepth = (history.state && Number.isInteger(history.state.d)) ? history.state.d : 0;
  let ignorePop = false;

  function syncHistory(mode) {
    try {
      if (mode === 'push') { history.pushState({ d: histDepth + 1 }, ''); histDepth++; }
      else if (mode === 'replace') history.replaceState({ d: histDepth }, '');
    } catch (e) {}
  }

  // mode: 'push' (вперёд, по умолчанию) | 'replace' | 'pop' (уже вернулись назад)
  function showScreen(name, mode) {
    state.phase = name;
    if (name !== 'start') state.lastPhase = name;
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
    if (name === 'start') renderStartScreen();
    updateScoreEditButton();
    syncHistory(mode || 'push');
    broadcastState();
  }

  function requestBack() {
    if (histDepth > 0) { try { history.back(); return; } catch (e) {} }
    doBack();
  }

  // Что значит «назад» на каждом экране. Данные игры при этом не теряются.
  function doBack() {
    closeScoreEditor();
    switch (state.phase) {
      case 'credits': {
        const roll = document.getElementById('credits-roll');
        roll.onanimationend = null;
        roll.style.animation = 'none';
        showScreen('start', 'pop');
        break;
      }
      case 'board':
        showScreen('start', 'pop');
        break;
      case 'question':
        finishLeaveQuestion();
        break;
      case 'final':
        stopTimer();
        renderBoard();
        renderPlayersBar();
        showScreen('board', 'pop');
        break;
      case 'results':
        showScreen('final', 'pop');
        break;
      default: break; // на стартовом экране назад некуда
    }
  }

  window.addEventListener('popstate', e => {
    const d = (e.state && Number.isInteger(e.state.d)) ? e.state.d : 0;
    if (ignorePop) { ignorePop = false; histDepth = d; return; }
    if (d > histDepth) { histDepth = d; ignorePop = true; try { history.forward ? history.back() : 0; } catch (err) {} return; }
    histDepth = d;
    doBack();
  });

  // ===================== СОХРАНЕНИЕ ИГРЫ =====================
  const SAVE_KEY = 'svoyak_save_v1';

  function saveGame() {
    try {
      if (!state.started) { localStorage.removeItem(SAVE_KEY); return; }
      const used = Array.from(state.usedQuestions);
      const q = state.currentQuestion;
      if (state.phase === 'question' && q && q.qKey && state.questionSpent && !used.includes(q.qKey)) used.push(q.qKey);
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1,
        scores: state.players.map(p => p.score),
        round: state.round,
        used,
        lastPhase: state.lastPhase,
        finalStarted: state.finalStarted,
        finalShown: state.finalShown,
        finalBets: state.finalBets,
        finalJudged: state.finalJudged,
        finalAnswerRevealed: state.finalAnswerRevealed,
        timerSeconds: state.timer.seconds,
        timerMax: state.timer.max,
      }));
    } catch (e) {}
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (!s || s.v !== 1 || !Array.isArray(s.scores) || s.scores.length !== PLAYER_NAMES.length) {
        localStorage.removeItem(SAVE_KEY);
        return;
      }
      state.players = PLAYER_NAMES.map((name, i) => ({ name, score: Number(s.scores[i]) || 0 }));
      state.round = [1, 2, 3].includes(s.round) ? s.round : 1;
      state.usedQuestions = new Set(Array.isArray(s.used) ? s.used : []);
      state.lastPhase = ['credits', 'board', 'question', 'final', 'results'].includes(s.lastPhase) ? s.lastPhase : 'board';
      state.finalStarted = !!s.finalStarted;
      state.finalShown = !!s.finalShown;
      state.finalBets = Array.isArray(s.finalBets) ? s.finalBets : [];
      state.finalJudged = Array.isArray(s.finalJudged) ? s.finalJudged : [];
      state.finalAnswerRevealed = !!s.finalAnswerRevealed;
      if (Number.isFinite(s.timerMax) && Number.isFinite(s.timerSeconds)) {
        state.timer.max = s.timerMax; state.timer.seconds = s.timerSeconds;
      }
      state.started = true;
    } catch (e) {
      try { localStorage.removeItem(SAVE_KEY); } catch (e2) {}
    }
  }

  function resetGameData() {
    state.players = [];
    state.round = 1;
    state.usedQuestions.clear();
    state.currentQuestion = null;
    state.answerRevealed = false;
    state.questionSpent = false;
    state.leaveDone = false;
    state.finalBets = [];
    state.finalJudged = [];
    state.finalStarted = false;
    state.finalShown = false;
    state.finalAnswerRevealed = false;
    state.started = false;
    state.lastPhase = 'start';
    finalBuilt = false;
    stopTimer();
    state.timer.max = 30; state.timer.seconds = 30;
  }

  // ===================== ПОДТВЕРЖДЕНИЕ =====================
  function confirmDialog(title, text, okLabel) {
    return new Promise(resolve => {
      const m = document.createElement('div');
      m.className = 'modal';
      m.style.display = 'flex';
      m.innerHTML = '<div class="modal-card"><h3 class="modal-title"></h3><p class="modal-hint"></p>' +
        '<div class="modal-actions"><button type="button" class="btn btn-ghost" data-r="0">Отмена</button>' +
        '<button type="button" class="btn btn-danger" data-r="1"></button></div></div>';
      m.querySelector('.modal-title').textContent = title;
      m.querySelector('.modal-hint').textContent = text;
      m.querySelector('[data-r="1"]').textContent = okLabel || 'Да';
      const done = v => { m.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
      const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
      document.addEventListener('keydown', onKey, true);
      m.addEventListener('click', e => {
        if (e.target === m) done(false);
        const b = e.target.closest('[data-r]');
        if (b) done(b.dataset.r === '1');
      });
      document.body.appendChild(m);
    });
  }

  // ===================== EDGE FLASH =====================
  function flashEdge(correct) {
    const el = document.getElementById('edge-flash');
    el.className = 'edge-flash';
    el.classList.add('show', correct ? 'correct' : 'wrong');
    setTimeout(() => { el.className = 'edge-flash'; }, 1100);
  }

  // ===================== START SCREEN =====================
  function renderStartScreen() {
    const cont = document.getElementById('btn-continue');
    const st = document.getElementById('btn-start');
    if (!cont || !st) return;
    const has = state.started;
    cont.style.display = has ? '' : 'none';
    cont.textContent = state.lastPhase === 'results' ? '▶ К итогам' : state.lastPhase === 'final' ? '▶ Продолжить: финал' : '▶ Продолжить игру';
    st.textContent = has ? 'Начать заново' : 'Начать игру';
    st.classList.toggle('btn-large', !has);
    st.classList.toggle('btn-primary', !has);
    st.classList.toggle('btn-ghost', has);
  }

  document.getElementById('btn-continue').addEventListener('click', () => {
    ensureAudio();
    playClick();
    startBgMusic();
    renderBoard();
    renderPlayersBar();
    const t = state.lastPhase;
    if (t === 'final') { startFinalRound(); }
    else if (t === 'results') { showResults(true); }
    else showScreen('board');
  });

  document.getElementById('btn-start').addEventListener('click', async () => {
    if (state.started) {
      const ok = await confirmDialog('Начать заново?', 'Баллы и использованные вопросы будут сброшены. Чтобы вернуться в текущую игру, нажмите «Отмена» и выберите «Продолжить».', 'Начать заново');
      if (!ok) return;
    }
    ensureAudio();
    playClick();
    startBgMusic();
    resetGameData();
    state.players = PLAYER_NAMES.map(name => ({ name, score: 0 }));
    state.started = true;
    renderBoard();
    renderPlayersBar();
    buzzControl('new');
    showScreen('credits');
    startCredits();
  });

  function startCredits() {
    playCredits('credits-roll', 'credits-viewport', finishCredits);
  }
  function finishCredits() {
    if (state.phase !== 'credits') return; // защита от повторного вызова (анимация + кнопка)
    playClick();
    showScreen('board', 'replace');
  }
  document.getElementById('btn-credits-skip').addEventListener('click', finishCredits);
  document.getElementById('btn-credits-back').addEventListener('click', () => { playClick(); requestBack(); });
  document.getElementById('btn-board-back').addEventListener('click', () => { playClick(); requestBack(); });

  document.getElementById('btn-open-display').addEventListener('click', () => {
    playClick();
    window.open(location.href.split('?')[0] + '?view=display', '_blank');
  });

  document.getElementById('btn-mute-start').addEventListener('click', toggleMute);

  // ===================== ССЫЛКА ДЛЯ УЧАСТНИКОВ (кнопки) =====================
  // Телефоны не откроют localhost: если сервер знает адрес компьютера в сети, подставляем его.
  function computeBuzzerUrl() {
    const ips = (NET.info && Array.isArray(NET.info.ips)) ? NET.info.ips : [];
    const ip = ips[0] || '';
    const loc = location;
    if (loc.protocol !== 'http:' && loc.protocol !== 'https:') {
      return 'http://' + (ip || 'localhost') + ':' + ((NET.info && NET.info.port) || 3001) + '/?view=buzzer';
    }
    let host = loc.hostname;
    if (ip && (host === 'localhost' || host === '127.0.0.1' || host === '[::1]')) host = ip;
    return loc.protocol + '//' + host + (loc.port ? ':' + loc.port : '') + loc.pathname + '?view=buzzer';
  }

  let BUZZER_URL = computeBuzzerUrl();
  function updateBuzzerLink() {
    BUZZER_URL = computeBuzzerUrl();
    const a = document.getElementById('buzzer-link');
    if (a) { a.textContent = BUZZER_URL; a.href = BUZZER_URL; }
    const alt = document.getElementById('buzzer-alt');
    if (alt) {
      const ips = (NET.info && Array.isArray(NET.info.ips)) ? NET.info.ips : [];
      const port = (NET.info && NET.info.port) || 3001;
      const others = ips.slice(1).map(ip => 'http://' + ip + ':' + port + '/?view=buzzer');
      alt.innerHTML = others.length
        ? 'Если на телефоне не открывается, попробуйте другой адрес: ' + others.map(u => '<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>').join(' · ')
        : '';
    }
  }
  updateBuzzerLink();
  (function initBuzzerLink() {
    const btn = document.getElementById('btn-copy-buzzer-link');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(BUZZER_URL);
        btn.textContent = '✓ Скопировано';
      } catch (e) {
        window.prompt('Скопируйте ссылку для участников:', BUZZER_URL);
      }
      setTimeout(() => { btn.textContent = '📋 Копировать'; }, 1800);
    });
  })();

  // Связь с сервером: проверка раз в 3 с (заодно узнаём адрес для телефонов)
  // и повторная отправка состояния, если сервер перезапускали.
  NET.onUp.push(() => { broadcastState(); });
  function pingServer() {
    apiJson('/info', 'GET').then(d => { NET.info = d; updateBuzzerLink(); }).catch(() => {});
  }
  pingServer();
  setInterval(pingServer, 3000);

  // ===================== BOARD RENDERING =====================
  function getRoundData() {
    return state.round === 1 ? QUESTIONS.round1 : state.round === 2 ? QUESTIONS.round2 : QUESTIONS.round3;
  }

  function getRoundPrices() {
    return state.round === 1 ? ROUND1_PRICES : state.round === 2 ? ROUND2_PRICES : ROUND3_PRICES;
  }

  function renderBoard() {
    const board = document.getElementById('board');
    const data = getRoundData();
    board.innerHTML = '';
    board.style.setProperty('--cols', Math.max(...data.map(c => c.questions.length)));

    data.forEach((cat, ci) => {
      const row = document.createElement('div');
      row.className = 'board-row';
      const catCell = document.createElement('div');
      catCell.className = 'category-cell';
      catCell.textContent = cat.category;
      row.appendChild(catCell);

      cat.questions.forEach((q, qi) => {
        const qKey = `${state.round}-${ci}-${qi}`;
        const priceCell = document.createElement('div');
        priceCell.className = 'price-cell' + (state.usedQuestions.has(qKey) ? ' used' : '');
        priceCell.textContent = q.price;
        if (!state.usedQuestions.has(qKey)) {
          priceCell.addEventListener('click', () => {
            playClick();
            openQuestion(ci, qi, qKey, cat.category, q);
          });
        }
        row.appendChild(priceCell);
      });
      board.appendChild(row);
    });

    updateFinalRoundButton();
  }

  function allQuestionsUsed(round) {
    const data = round === 1 ? QUESTIONS.round1 : round === 2 ? QUESTIONS.round2 : QUESTIONS.round3;
    for (let ci = 0; ci < data.length; ci++) {
      for (let qi = 0; qi < data[ci].questions.length; qi++) {
        if (!state.usedQuestions.has(`${round}-${ci}-${qi}`)) return false;
      }
    }
    return true;
  }

  function updateFinalRoundButton() {
    const btn = document.getElementById('btn-final-round');
    const allDone = allQuestionsUsed(1) && allQuestionsUsed(2) && allQuestionsUsed(3);
    btn.style.display = allDone ? 'inline-flex' : 'none';
  }

  function checkRoundTransition() {
    if (allQuestionsUsed(state.round)) {
      if (state.round < ROUNDS_TOTAL) {
        state.round++;
        renderBoard();
        renderPlayersBar();
        playRoundEnd();
        broadcastState();
      } else if (allQuestionsUsed(1) && allQuestionsUsed(2) && allQuestionsUsed(3)) {
        updateFinalRoundButton();
        playRoundEnd();
        broadcastState();
      }
    }
  }

  document.getElementById('btn-final-round').addEventListener('click', () => {
    playClick();
    startFinalRound();
  });

  // ===================== PLAYERS BAR =====================
  function renderPlayersBar() {
    const bar = document.getElementById('players-bar');
    bar.innerHTML = '';
    const maxScore = Math.max(0, ...state.players.map(p => p.score));
    const leaders = state.players.filter(p => p.score === maxScore && maxScore > 0);

    state.players.forEach((player, i) => {
      const card = document.createElement('div');
      card.className = 'player-card' + (leaders.includes(player) ? ' leading' : '');
      const negative = player.score < 0;
      card.innerHTML = `
        <div class="player-card-name" title="${esc(player.name)}">${esc(player.name)}</div>
        <div class="player-card-score${negative ? ' negative' : ''}" id="score-${i}">${player.score}</div>
      `;
      bar.appendChild(card);
    });
  }

  function bumpScore(playerIndex) {
    const el = document.getElementById(`score-${playerIndex}`);
    if (el) {
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
  }

  // ===================== QUESTION FLOW =====================
  const BUZZ_AUTO_OPEN_MS = 3000;
  let buzzAutoTimer = null;
  function openQuestion(ci, qi, qKey, category, qData) {
    state.currentQuestion = { ...qData, category, qKey, ci, qi };
    modifierTriggeredFor = null;
    // Вопрос «сгорает» только после очков, показа ответа или «Готово» — иначе можно вернуться и выбрать другой
    state.questionSpent = false;
    state.leaveDone = false;
    state.answerRevealed = false;

    document.getElementById('question-price').textContent = qData.price;
    document.getElementById('question-category').textContent = category;
    document.getElementById('question-text').textContent = qData.question;
    document.getElementById('question-text').classList.toggle('modifier-text', !!qData.modifier);
    if (qData.passQuestion) { state.currentQuestion.secretStage = 'intro'; state.currentQuestion.secretTo = null; }

    // Host always sees the answer
    document.getElementById('host-answer-text').textContent = qData.answer;

    const imgWrap = document.getElementById('question-image-wrapper');
    const img = document.getElementById('question-image');
    const hint = document.getElementById('image-hint');
    const missing = [];
    const onMissing = src => {
      missing.push(src.replace(/^images?\//, ''));
      hint.textContent = 'Фото не найдено: положите файл ' + missing.join(' и ') + ' (jpg/png) в папку image';
      hint.style.display = 'block';
    };
    hint.style.display = 'none';
    // автоподобранные фото (image/<раунд>/<тема>.<вопрос>) молчат, если файла нет
    if (!qData.passQuestion) loadQuestionImage(img, imgWrap, qData.image, qData.autoImage ? null : onMissing);
    else imgWrap.style.display = 'none';
    loadQuestionImage(document.getElementById('host-answer-image'), document.getElementById('host-answer-image-wrapper'), qData.answerImage, onMissing);

    // Hide display answer section
    document.getElementById('answer-section').style.display = 'none';
    document.getElementById('btn-reveal-answer').style.display = 'inline-flex';

    // Render scoring immediately (host can score at any time)
    renderScoringPlayers('scoring-players', 'btn-question-done');

    buzzControl('new'); // сбросить кнопки участников для нового вопроса
    resetBuzzUI();
    showScreen('question');
    const questionCard = document.querySelector('.question-card');
    if (questionCard) {
      questionCard.classList.remove('question-pass-animation', 'question-modifier-animation');
      void questionCard.offsetWidth;
      questionCard.classList.toggle('question-pass-animation', !!qData.passQuestion);
      questionCard.classList.toggle('question-modifier-animation', !!qData.modifier);
    }
    renderSecretHost();
    if (qData.passQuestion) { broadcastState(); return; } // кнопки откроются только если нужно — вопрос с секретом отвечает выбранный игрок
    // кнопки у участников открываются сами через 3 секунды после показа вопроса
    clearTimeout(buzzAutoTimer);
    const openedFor = state.currentQuestion;
    buzzAutoTimer = setTimeout(() => {
      if (state.phase === 'question' && state.currentQuestion === openedFor && !buzz.open && buzz.winner === null) buzzControl('open');
    }, BUZZ_AUTO_OPEN_MS);
  }

  // ===== Вопрос с секретом: заставка → «Передать вопрос» → выбор игрока → текст вопроса =====
  function renderSecretHost() {
    const q = state.currentQuestion;
    const box = document.getElementById('secret-box');
    const banner = document.getElementById('secret-banner');
    const text = document.getElementById('question-text');
    if (!box || !q) return;
    const hidden = secretHidden(q);
    box.style.display = hidden ? 'flex' : 'none';
    text.style.display = hidden ? 'none' : '';
    if (hidden) {
      document.getElementById('btn-secret-pass').style.display = q.secretStage === 'intro' ? 'inline-flex' : 'none';
      const ch = document.getElementById('secret-choices');
      ch.style.display = q.secretStage === 'choose' ? 'flex' : 'none';
      document.getElementById('secret-sub').textContent = q.secretStage === 'choose'
        ? 'Кому передаём вопрос?' : 'Выбравший вопрос передаёт его другому игроку';
      ch.innerHTML = '';
      if (q.secretStage === 'choose') {
        state.players.forEach((p, i) => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'btn btn-ghost secret-choice'; b.textContent = p.name;
          b.addEventListener('click', () => passSecretTo(i));
          ch.appendChild(b);
        });
      }
    }
    if (q.passQuestion && q.secretStage === 'done') {
      banner.style.display = 'block';
      banner.textContent = '🎁 Вопрос передан: ' + (q.secretTo || '');
    } else banner.style.display = 'none';
  }

  function passSecretTo(i) {
    const q = state.currentQuestion;
    if (!q || !state.players[i]) return;
    playCorrect();
    q.secretStage = 'done';
    q.secretTo = state.players[i].name;
    const img = document.getElementById('question-image');
    const wrap = document.getElementById('question-image-wrapper');
    document.getElementById('question-text').textContent = q.question;
    loadQuestionImage(img, wrap, q.image, null);
    renderSecretHost();
    const card = document.querySelector('.question-card');
    if (card) { card.classList.remove('question-pass-animation'); void card.offsetWidth; card.classList.add('question-pass-animation'); }
    broadcastState();
  }

  document.getElementById('btn-secret-pass').addEventListener('click', () => {
    const q = state.currentQuestion;
    if (!q || !q.passQuestion) return;
    playClick();
    q.secretStage = 'choose';
    renderSecretHost();
    broadcastState();
  });

  // Выход из вопроса на поле: «← К полю» (done=false) и «Готово» (done=true).
  // Сам переход делает doBack → finishLeaveQuestion, чтобы кнопка «Назад» браузера работала так же.
  function leaveQuestion(done) {
    state.leaveDone = !!done;
    requestBack();
  }

  function finishLeaveQuestion() {
    clearTimeout(buzzAutoTimer);
    const q = state.currentQuestion;
    if (q && q.qKey && (state.leaveDone || state.questionSpent)) state.usedQuestions.add(q.qKey);
    state.leaveDone = false;
    state.questionSpent = false;
    state.currentQuestion = null;
    state.answerRevealed = false;
    buzzControl('new');
    renderBoard();
    renderPlayersBar();
    checkRoundTransition();
    showScreen('board', 'pop');
  }

  document.getElementById('btn-back-to-board').addEventListener('click', () => {
    playClick();
    leaveQuestion(false);
  });

  // Reveal answer to display (and show on host too)
  document.getElementById('btn-reveal-answer').addEventListener('click', () => {
    playClick();
    state.answerRevealed = true;
    state.questionSpent = true;
    const q = state.currentQuestion;
    document.getElementById('answer-text').textContent = q.answer;
    document.getElementById('answer-section').style.display = 'block';
    loadQuestionImage(document.getElementById('answer-image'), document.getElementById('answer-image-wrapper'), q.answerImage, null);
    document.getElementById('btn-reveal-answer').style.display = 'none';
    broadcastState();
  });

  function renderScoringPlayers(containerId, doneBtnId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const price = state.currentQuestion ? state.currentQuestion.price : 0;

    state.players.forEach((player, i) => {
      const row = document.createElement('div');
      row.className = 'scoring-player-row';
      row.innerHTML = `
        <div class="scoring-player-name">${esc(player.name)}</div>
        <div style="font-size:var(--text-xs);color:var(--color-text-muted)">±${price}</div>
        <div class="scoring-buttons">
          <button class="score-btn minus" data-action="minus" data-player="${i}" aria-label="Снять очки">−</button>
          <button class="score-btn plus" data-action="plus" data-player="${i}" aria-label="Начислить очки">+</button>
        </div>
      `;
      container.appendChild(row);
    });

    container.querySelectorAll('.score-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const idx = parseInt(btn.dataset.player, 10);
        adjustScore(idx, action === 'plus' ? price : -price, action === 'plus');
      });
    });
  }

  function adjustScore(playerIndex, amount, correct) {
    if (state.phase === 'question') state.questionSpent = true;
    state.players[playerIndex].score += amount;
    flashEdge(correct);
    if (correct) playCorrect(); else playWrong();
    renderPlayersBar();
    bumpScore(playerIndex);
    broadcastState();
  }

  document.getElementById('btn-question-done').addEventListener('click', () => {
    playClick();
    leaveQuestion(true);
  });

  // ===================== TIMER (только финальный раунд) =====================
  function stopTimer() {
    if (state.timer.interval) { clearInterval(state.timer.interval); state.timer.interval = null; }
    state.timer.running = false;
  }

  // ===================== КНОПКИ УЧАСТНИКОВ (ведущий) =====================
  // Состояние кнопок живёт на сервере (кто нажал первым решает порядок прихода
  // запросов). Здесь — его копия для панели ведущего.
  const buzz = { open: false, winner: null, locked: [], online: true, key: '', judged: false };
  let modifierTriggeredFor = null;
  let buzzEpoch = 0; // чтобы запоздавший опрос не затирал свежий ответ на команду

  function playBuzzSound() {
    if (state.muted) return;
    beep(880, 0.12, 'square', 0.22);
    setTimeout(() => beep(1175, 0.2, 'square', 0.22), 110);
  }

  function applyBuzz(d) {
    const prevWinner = buzz.winner;
    buzz.open = !!d.open;
    buzz.winner = (d.winner === null || d.winner === undefined) ? null : d.winner;
    buzz.locked = Array.isArray(d.locked) ? d.locked : [];
    buzz.online = true;
    const key = d.round + ':' + buzz.winner;
    if (key !== buzz.key) { buzz.key = key; buzz.judged = false; }
    if (buzz.winner !== null && prevWinner === null && state.phase === 'question') {
      playBuzzSound();
      const q = state.currentQuestion;
      if (q && q.modifier && modifierTriggeredFor !== q.qKey) {
        modifierTriggeredFor = q.qKey;
        executeModifierForPlayer(buzz.winner, q);
      }
    }
    renderBuzzPanel();
  }

  // Модификаторы применяются автоматически к игроку, который нажал первым.
  function executeModifierForPlayer(playerIndex, q) {
    if (!state.players[playerIndex]) return;
    const instruction = String(q.answer || '').toLocaleLowerCase('ru');
    const player = state.players[playerIndex];
    let message = '';
    if (instruction.includes('плюс на минус')) {
      player.score -= Number(q.price || 0);
      message = `${player.name}: модификатор «Плюс на минус» — ${q.price} баллов снято.`;
    } else if (instruction.includes('забери 1000 баллов')) {
      const leaderScore = Math.max(...state.players.map(p => p.score));
      const leaderIndex = state.players.findIndex(p => p.score === leaderScore);
      const lowestScore = Math.min(...state.players.map(p => p.score));
      const lowestIndex = state.players.findIndex(p => p.score === lowestScore);
      const fromIndex = leaderIndex;
      const toIndex = playerIndex === leaderIndex ? lowestIndex : playerIndex;
      if (fromIndex === toIndex) {
        message = `${player.name}: некому передать 1000 баллов — лидер и отстающий совпали.`;
      } else {
        state.players[fromIndex].score -= 1000;
        state.players[toIndex].score += 1000;
        message = `${state.players[toIndex].name} получает 1000 баллов от ${state.players[fromIndex].name}.`;
      }
    } else {
      // Для других инструкций из документа выводим текст ведущему, не придумывая эффект.
      message = `Модификатор для ${player.name}: ${q.answer}`;
    }
    buzz.judged = true;
    state.questionSpent = true;
    renderPlayersBar();
    broadcastState();
    showModifierNotice(message);
    buzzControl('close');
    renderBuzzPanel();
  }

  function showModifierNotice(message) {
    let notice = document.getElementById('modifier-notice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'modifier-notice';
      notice.className = 'modifier-notice';
      notice.setAttribute('role', 'status');
      document.body.appendChild(notice);
    }
    notice.textContent = message;
    notice.classList.remove('show');
    void notice.offsetWidth;
    notice.classList.add('show');
    clearTimeout(notice._hideTimer);
    notice._hideTimer = setTimeout(() => notice.classList.remove('show'), 6000);
  }

  function resetBuzzUI() {
    buzz.open = false; buzz.winner = null; buzz.locked = []; buzz.judged = false; buzz.key = '';
    renderBuzzPanel();
  }

  async function buzzControl(action) {
    buzzEpoch++;
    try { applyBuzz(await apiJson('/buzz/control', 'POST', { action })); }
    catch (e) { buzz.online = false; renderBuzzPanel(); }
  }

  async function pollBuzz() {
    if (state.phase !== 'question') return;
    const epoch = buzzEpoch;
    try {
      const d = await apiJson('/buzz', 'GET');
      if (epoch === buzzEpoch) applyBuzz(d);
    } catch (e) { buzz.online = false; renderBuzzPanel(); }
  }
  setInterval(pollBuzz, 250);

  function renderBuzzPanel() {
    const status = document.getElementById('buzz-status');
    if (!status) return;
    const winnerBox = document.getElementById('buzz-winner');
    const lockedBox = document.getElementById('buzz-locked');
    const q = state.currentQuestion;
    const price = q ? q.price : 0;
    const w = buzz.winner;
    const winnerName = (w !== null && state.players[w]) ? state.players[w].name : null;
    const allLocked = state.players.length > 0 && buzz.locked.length >= state.players.length;

    let text, cls;
    if (!buzz.online) { text = 'Нет связи с сервером кнопок'; cls = 'offline'; }
    else if (winnerName !== null && buzz.judged) { text = 'Ответ учтён'; cls = 'closed'; }
    else if (winnerName !== null) { text = 'Первым нажал — ждём ответ'; cls = 'winner'; }
    else if (buzz.open) { text = 'Ждём нажатия'; cls = 'open'; }
    else if (allLocked) { text = 'Все уже ответили неверно'; cls = 'closed'; }
    else { text = 'Кнопки закрыты'; cls = 'closed'; }
    status.textContent = text;
    status.className = 'buzz-status ' + cls;

    if (winnerName !== null) {
      winnerBox.style.display = 'flex';
      winnerBox.innerHTML = '<span class="buzz-winner-icon">🔔</span><span class="buzz-winner-name">' + esc(winnerName) + '</span>';
    } else {
      winnerBox.style.display = 'none';
      winnerBox.innerHTML = '';
    }

    const lockedNames = buzz.locked.map(i => state.players[i] ? state.players[i].name : '').filter(Boolean);
    lockedBox.textContent = lockedNames.length ? 'Уже отвечали неверно: ' + lockedNames.join(', ') : '';

    const judging = winnerName !== null && !buzz.judged;
    const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
    show('btn-buzz-open', !buzz.open && winnerName === null && !allLocked);
    show('btn-buzz-close', buzz.open && winnerName === null);
    show('btn-buzz-correct', judging);
    show('btn-buzz-wrong', judging);
    show('btn-buzz-reset', winnerName !== null || buzz.locked.length > 0);

    const bc = document.getElementById('btn-buzz-correct');
    const bw = document.getElementById('btn-buzz-wrong');
    if (bc) bc.textContent = '✓ Верно +' + price;
    if (bw) bw.textContent = PENALTY_ON_WRONG ? '✗ Неверно −' + price : '✗ Неверно';
  }

  document.getElementById('btn-buzz-close').addEventListener('click', () => { playClick(); buzzControl('close'); });
  document.getElementById('btn-buzz-reset').addEventListener('click', () => { playClick(); buzzControl('reset'); });

  function buzzCorrect() {
    const idx = buzz.winner;
    if (idx === null || buzz.judged || !state.currentQuestion || !state.players[idx]) return;
    buzz.judged = true;
    renderBuzzPanel();
    adjustScore(idx, state.currentQuestion.price, true);
    buzzControl('close');
  }

  function buzzWrong() {
    const idx = buzz.winner;
    if (idx === null || buzz.judged || !state.currentQuestion || !state.players[idx]) return;
    buzz.judged = true;
    renderBuzzPanel();
    adjustScore(idx, PENALTY_ON_WRONG ? -state.currentQuestion.price : 0, false);
    buzzControl('wrong');
  }

  document.getElementById('btn-buzz-correct').addEventListener('click', buzzCorrect);
  document.getElementById('btn-buzz-wrong').addEventListener('click', buzzWrong);

  // Горячие клавиши на экране вопроса: Enter — верно, Backspace — неверно
  document.addEventListener('keydown', e => {
    if (state.phase !== 'question' || e.repeat) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (document.getElementById('score-modal').style.display !== 'none') return;
    if (e.code === 'Enter' && buzz.winner !== null) { e.preventDefault(); buzzCorrect(); }
    else if (e.code === 'Backspace' && buzz.winner !== null) { e.preventDefault(); buzzWrong(); }
  });

  // ===================== РЕДАКТОР БАЛЛОВ (ведущий) =====================
  const SCORE_STEP = 100;

  function updateScoreEditButton() {
    const btn = document.getElementById('btn-edit-scores');
    if (!btn) return;
    btn.style.display = ['board', 'question', 'final'].includes(state.phase) ? '' : 'none';
  }

  function openScoreEditor() {
    const list = document.getElementById('score-edit-list');
    list.innerHTML = '';
    state.players.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'score-edit-row';
      row.innerHTML = `
        <div class="score-edit-name">${esc(p.name)}</div>
        <button class="score-btn minus" type="button" data-step="-1" aria-label="Минус ${SCORE_STEP}">−</button>
        <input type="number" step="${SCORE_STEP}" value="${p.score}" data-player="${i}" />
        <button class="score-btn plus" type="button" data-step="1" aria-label="Плюс ${SCORE_STEP}">+</button>
      `;
      const input = row.querySelector('input');
      row.querySelectorAll('button').forEach(b => {
        b.addEventListener('click', () => {
          input.value = (parseInt(input.value, 10) || 0) + SCORE_STEP * parseInt(b.dataset.step, 10);
        });
      });
      list.appendChild(row);
    });
    document.getElementById('score-modal').style.display = 'flex';
  }

  function closeScoreEditor() {
    document.getElementById('score-modal').style.display = 'none';
  }

  document.getElementById('btn-edit-scores').addEventListener('click', () => { playClick(); openScoreEditor(); });
  document.getElementById('btn-score-cancel').addEventListener('click', () => { playClick(); closeScoreEditor(); });
  document.getElementById('score-modal').addEventListener('click', e => {
    if (e.target.id === 'score-modal') closeScoreEditor();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeScoreEditor();
  });
  document.getElementById('btn-score-save').addEventListener('click', () => {
    playClick();
    document.querySelectorAll('#score-edit-list input').forEach(inp => {
      const i = parseInt(inp.dataset.player, 10);
      const v = parseInt(inp.value, 10);
      if (!Number.isNaN(v) && state.players[i]) state.players[i].score = v;
    });
    closeScoreEditor();
    renderPlayersBar();
    broadcastState();
  });

  // ===================== FINAL ROUND =====================
  let finalBuilt = false; // экран финала уже собран (при возврате назад не пересобираем — ставки не пропадут)

  function startFinalRound() {
    if (state.finalStarted && finalBuilt) {   // вернулись в начатый финал
      showScreen('final');
      return;
    }
    if (!state.finalStarted) {
      stopBgMusic();
      state.finalStarted = true;
      state.finalShown = false;
      state.finalBets = state.players.map(() => 0);
      state.finalJudged = state.players.map(() => false);
      state.finalAnswerRevealed = false;
      stopTimer();
      state.timer.max = 60;
      state.timer.seconds = 60;
      state.timer.running = false;
    }
    rebuildFinal();
    showScreen('final');
    startBgMusic();
  }

  // Собирает экран финала целиком из state (нужно и после перезагрузки страницы)
  function rebuildFinal() {
    finalBuilt = true;
    const container = document.getElementById('final-bet-inputs');
    container.innerHTML = '';
    state.players.forEach((player, i) => {
      const row = document.createElement('div');
      row.className = 'final-bet-row';
      row.innerHTML = `
        <label>${esc(player.name)}</label>
        <div class="score-hint">Очки: ${player.score}</div>
        <input type="number" min="0" max="${Math.max(0, player.score)}" value="${state.finalBets[i] || 0}" data-player="${i}" />
      `;
      container.appendChild(row);
    });

    const betsEl = document.getElementById('final-bets');
    const qSection = document.getElementById('final-question-section');
    if (!state.finalShown) {
      betsEl.style.display = 'block';
      qSection.style.display = 'none';
      return;
    }

    state.currentQuestion = { ...QUESTIONS.final, category: 'Финал', price: 0 };
    document.getElementById('final-question-text').textContent = QUESTIONS.final.question;
    document.getElementById('final-host-answer-text').textContent = QUESTIONS.final.answer;
    const imgWrap = document.getElementById('final-image-wrapper');
    const img = document.getElementById('final-image');
    if (QUESTIONS.final.image) {
      img.src = QUESTIONS.final.image;
      imgWrap.style.display = 'block';
    } else {
      imgWrap.style.display = 'none';
    }
    betsEl.style.display = 'none';
    qSection.style.display = 'block';

    document.getElementById('final-answer-text').textContent = state.finalAnswerRevealed ? QUESTIONS.final.answer : '';
    document.getElementById('final-answer-section').style.display = state.finalAnswerRevealed ? 'block' : 'none';
    document.getElementById('btn-final-reveal-answer').style.display = state.finalAnswerRevealed ? 'none' : '';

    // Очки за финал: каждому можно начислить один раз (дальше — через «✏️ Баллы»)
    const scoringContainer = document.getElementById('final-scoring-players');
    scoringContainer.innerHTML = '';
    state.players.forEach((player, i) => {
      const bet = state.finalBets[i] || 0;
      const judged = !!state.finalJudged[i];
      const row = document.createElement('div');
      row.className = 'scoring-player-row' + (judged ? ' judged' : '');
      row.innerHTML = `
        <div class="scoring-player-name">${esc(player.name)}</div>
        <div style="font-size:var(--text-xs);color:var(--color-text-muted)">Ставка: ${bet}${judged ? ' · учтено' : ''}</div>
        <div class="scoring-buttons">
          <button class="score-btn minus" data-action="minus" data-player="${i}" aria-label="Неверно"${judged ? ' disabled' : ''}>−</button>
          <button class="score-btn plus" data-action="plus" data-player="${i}" aria-label="Верно"${judged ? ' disabled' : ''}>+</button>
        </div>
      `;
      scoringContainer.appendChild(row);
    });
    scoringContainer.querySelectorAll('.score-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.player, 10);
        if (state.finalJudged[idx]) return;
        state.finalJudged[idx] = true;
        const plus = btn.dataset.action === 'plus';
        const bet = state.finalBets[idx] || 0;
        const row = btn.closest('.scoring-player-row');
        row.classList.add('judged');
        row.querySelectorAll('.score-btn').forEach(b => { b.disabled = true; });
        adjustScore(idx, plus ? bet : -bet, plus);
      });
    });

    updateFinalTimerUI();
  }

  document.getElementById('btn-final-show-question').addEventListener('click', () => {
    playClick();
    const inputs = document.querySelectorAll('#final-bet-inputs input');
    state.finalBets = Array.from(inputs).map((inp, i) => {
      const val = parseInt(inp.value, 10) || 0;
      return Math.min(Math.max(0, val), Math.max(0, state.players[i].score));
    });
    state.finalShown = true;
    state.finalJudged = state.players.map(() => false);
    state.finalAnswerRevealed = false;
    stopTimer();
    state.timer.max = 60;
    state.timer.seconds = 60;
    state.timer.running = false;
    rebuildFinal();
    startFinalTimer();   // таймер идёт сразу вместе с вопросом
    broadcastState();
  });

  document.getElementById('btn-final-back').addEventListener('click', () => { playClick(); requestBack(); });

  function startFinalTimer() {
    stopTimer();
    state.timer.running = true;
    state.timer.interval = setInterval(() => {
      state.timer.seconds--;
      updateFinalTimerUI();
      if (state.timer.seconds <= 5 && state.timer.seconds > 0) playTimerTick();
      if (state.timer.seconds <= 0) {
        stopTimer();
        playWrong();
        flashEdge(false);
      }
      broadcastState();
    }, 1000);
  }

  function updateFinalTimerUI() {
    const bar = document.getElementById('final-timer-bar');
    const text = document.getElementById('final-timer-text');
    if (!bar || !text) return;
    const pct = (state.timer.seconds / state.timer.max) * 100;
    bar.style.width = pct + '%';
    text.textContent = state.timer.seconds;
    bar.classList.toggle('warning', state.timer.seconds <= 5);
  }

  document.getElementById('btn-final-reveal-answer').addEventListener('click', () => {
    playClick();
    state.finalAnswerRevealed = true;
    document.getElementById('final-answer-text').textContent = QUESTIONS.final.answer;
    document.getElementById('final-answer-section').style.display = 'block';
    document.getElementById('btn-final-reveal-answer').style.display = 'none';
    broadcastState();
  });

  document.getElementById('btn-final-done').addEventListener('click', () => {
    playClick();
    stopBgMusic();
    showResults();
  });

  // ===================== RESULTS =====================
  function showResults(silent) {
    const sorted = [...state.players].map((p, i) => ({ ...p, index: i })).sort((a, b) => b.score - a.score);
    const top = sorted[0].score;
    const leaders = top > 0 ? sorted.filter(p => p.score === top) : [];

    document.getElementById('winner-name').textContent = leaders.length ? leaders.map(p => p.name).join(' и ') : 'Ничья!';

    const list = document.getElementById('results-list');
    list.innerHTML = '';
    sorted.forEach((player, rank) => {
      const row = document.createElement('div');
      row.className = 'results-row' + (top > 0 && player.score === top ? ' winner' : '');
      row.innerHTML = `<span>${rank + 1}. ${esc(player.name)}</span><span class="results-row-score">${player.score}</span>`;
      list.appendChild(row);
    });

    if (!silent) playRoundEnd();
    showScreen('results');
  }

  document.getElementById('btn-play-again').addEventListener('click', () => {
    playClick();
    resetGameData();
    buzzControl('new');
    resetBuzzUI();
    startBgMusic();
    showScreen('start', 'replace');
  });
  document.getElementById('btn-results-back').addEventListener('click', () => { playClick(); requestBack(); });

  document.getElementById('btn-mute-game').addEventListener('click', toggleMute);

  // ===================== INIT =====================
  updateMuteButtons();
  loadGame();
  renderNetPill();
  showScreen('start', 'replace');


  // ==================================================================
  // BUZZER VIEW (телефон участника)
  // ==================================================================
  function initBuzzer() {
    const KEY = 'svoyak_buzzer_player';
    const pickEl = document.getElementById('buzzer-pick');
    const playEl = document.getElementById('buzzer-play');
    const listEl = document.getElementById('buzzer-pick-list');
    const nameEl = document.getElementById('buzzer-name');
    const btn = document.getElementById('buzzer-btn');
    const statusEl = document.getElementById('buzzer-status');

    let me = null;
    let net = { open: false, winner: null, locked: [] };
    let sending = false;
    let flashText = '';
    let flashTimer = null;
    let epoch = 0;

    // Личная ссылка ?p=3 сразу выбирает игрока; иначе вспоминаем прошлый выбор
    const qp = parseInt(new URLSearchParams(location.search).get('p'), 10);
    if (qp >= 1 && qp <= PLAYER_NAMES.length) me = qp - 1;
    else {
      try {
        const saved = parseInt(localStorage.getItem(KEY), 10);
        if (saved >= 0 && saved < PLAYER_NAMES.length) me = saved;
      } catch (e) {}
    }

    PLAYER_NAMES.forEach((name, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-primary btn-large buzzer-pick-btn';
      b.textContent = name;
      b.addEventListener('click', () => {
        me = i;
        try { localStorage.setItem(KEY, String(i)); } catch (e) {}
        render();
      });
      listEl.appendChild(b);
    });

    document.getElementById('btn-buzzer-change').addEventListener('click', () => {
      me = null;
      render();
    });

    function showFlash(text) {
      flashText = text;
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => { flashText = ''; render(); }, 1600);
      render();
    }

    function applyNet(d) {
      if (d.open && !net.open) flashText = ''; // кнопки открылись — старое «Рано!» больше не нужно
      net = {
        open: !!d.open,
        winner: (d.winner === null || d.winner === undefined) ? null : d.winner,
        locked: Array.isArray(d.locked) ? d.locked : [],
      };
      render();
    }

    function render() {
      if (me === null) {
        pickEl.style.display = 'flex';
        playEl.style.display = 'none';
        return;
      }
      pickEl.style.display = 'none';
      playEl.style.display = 'flex';
      nameEl.textContent = PLAYER_NAMES[me];

      const locked = net.locked.includes(me);
      let cls, label, sub, disabled = false;
      if (locked) { cls = 'locked'; label = 'ЖДЁМ'; sub = 'Вы уже отвечали на этот вопрос'; disabled = true; }
      else if (net.winner !== null && net.winner === me) { cls = 'win'; label = 'ВЫ ПЕРВЫЙ!'; sub = 'Отвечайте ведущему'; disabled = true; }
      else if (net.winner !== null) { cls = 'lost'; label = 'НЕ УСПЕЛИ'; sub = 'Первым нажал: ' + PLAYER_NAMES[net.winner]; disabled = true; }
      else if (net.open) { cls = 'ready'; label = 'ЖМИ!'; sub = 'Нажмите как можно быстрее'; }
      else { cls = 'idle'; label = 'ЖДИТЕ'; sub = 'Ведущий читает вопрос…'; }

      btn.className = 'buzzer-btn ' + cls;
      btn.textContent = label;
      btn.disabled = disabled;
      statusEl.textContent = flashText || sub;
    }

    async function press() {
      if (me === null || sending || btn.disabled) return;
      sending = true;
      epoch++;
      try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) {}
      try {
        const r = await apiJson('/buzz', 'POST', { player: me });
        applyNet(r);
        if (!r.ok && r.reason === 'closed') showFlash('Рано! Кнопки ещё закрыты');
        else if (!r.ok && r.reason === 'late') showFlash('Не успели — первым нажал: ' + (PLAYER_NAMES[r.winner] || '…'));
      } catch (e) {
        showFlash('Нет связи, нажмите ещё раз');
      }
      sending = false;
    }

    // Мобильный Safari/Chrome: pointerdown даёт мгновенный отклик, click оставлен как резервный путь.
    let lastPointerPress = 0;
    btn.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' || e.pointerType === 'touch' || e.pointerType === 'pen') {
        lastPointerPress = Date.now();
        press();
      }
    });
    btn.addEventListener('click', e => {
      // Не отправляем второй запрос после pointerdown; click нужен браузерам без Pointer Events.
      if (Date.now() - lastPointerPress > 700) press();
    });
    document.addEventListener('keydown', e => {
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); press(); }
    });

    async function poll() {
      const myEpoch = epoch;
      try {
        const d = await apiJson('/buzz', 'GET');
        if (myEpoch === epoch && !sending) applyNet(d);
      } catch (e) { /* плашку покажет renderNetPill */ }
    }
    setInterval(poll, 250);
    poll();
    render();

    // Не давать телефону гаснуть, пока идёт игра (если браузер умеет)
    try {
      if (navigator.wakeLock) {
        const lock = () => navigator.wakeLock.request('screen').catch(() => {});
        lock();
        document.addEventListener('visibilitychange', () => { if (!document.hidden) lock(); });
      }
    } catch (e) {}
  }

  // ==================================================================
  // DISPLAY VIEW LOGIC (projector)
  // ==================================================================
  function initDisplay() {
    // До первого сообщения от ведущего показываем стартовый экран
    let displayState = {
      type: 'sync',
      phase: 'start',
      round: 1,
      players: PLAYER_NAMES.map(name => ({ name, score: 0 })),
      usedQuestions: [],
      currentQuestion: null,
      answerRevealed: false,
      timer: { seconds: 30, max: 30, running: false },
      finalBets: [],
      finalAnswerRevealed: false,
      buzz: { open: false, winner: null, locked: [] },
    };

    // Связь с сервером и красная плашка — в общем модуле (apiJson / renderNetPill)
    let lastJson = '';

    async function fetchState() {
      try {
        const data = await apiJson('/state', 'GET');
        if (data && data.phase) {
          const json = JSON.stringify(data);
          if (json !== lastJson) {
            lastJson = json;
            displayState = data;
            renderDisplay();
          }
        }
      } catch (e) { /* плашку покажет renderNetPill */ }
    }

    // Initial fetch
    fetchState();

    // Poll server (чаще, чтобы «кто первый» появлялся сразу)
    setInterval(fetchState, 250);

    function showDisplayScreen(id) {
      document.querySelectorAll('.display-screen').forEach(s => s.classList.remove('active'));
      const el = document.getElementById(id);
      if (el) el.classList.add('active');
    }

    function renderDisplayPlayersBar(containerId, buzzMode) {
      const bar = document.getElementById(containerId);
      if (!bar) return;
      bar.innerHTML = '';
      const players = displayState.players || [];
      if (!players.length) return;
      const bz = buzzMode ? (displayState.buzz || {}) : {};
      const lockedIdx = Array.isArray(bz.locked) ? bz.locked : [];
      const maxScore = Math.max(0, ...players.map(p => p.score));
      const leaders = players.filter(p => p.score === maxScore && maxScore > 0);

      players.forEach((player, i) => {
        const card = document.createElement('div');
        let cls = 'display-player-card' + (leaders.includes(player) ? ' leading' : '');
        if (buzzMode && bz.winner === i) cls += ' buzzed';
        else if (buzzMode && lockedIdx.includes(i)) cls += ' locked';
        card.className = cls;
        const negative = player.score < 0;
        card.innerHTML = `
          <div class="display-player-name" title="${esc(player.name)}">${esc(player.name)}</div>
          <div class="display-player-score${negative ? ' negative' : ''}">${player.score}</div>
        `;
        bar.appendChild(card);
      });
    }

    function renderDisplayBoard() {
      const board = document.getElementById('display-board');
      const data = displayState.round === 1 ? QUESTIONS.round1 : displayState.round === 2 ? QUESTIONS.round2 : QUESTIONS.round3;
      board.style.setProperty('--cols', Math.max(...data.map(c => c.questions.length)));
      const prices = displayState.round === 1 ? ROUND1_PRICES : displayState.round === 2 ? ROUND2_PRICES : ROUND3_PRICES;
      board.innerHTML = '';

      data.forEach((cat, ci) => {
        const row = document.createElement('div');
        row.className = 'board-row';
        const catCell = document.createElement('div');
        catCell.className = 'category-cell';
        catCell.textContent = cat.category;
        row.appendChild(catCell);

        cat.questions.forEach((q, qi) => {
          const qKey = `${displayState.round}-${ci}-${qi}`;
          const priceCell = document.createElement('div');
          priceCell.className = 'price-cell' + (displayState.usedQuestions.includes(qKey) ? ' used' : '');
          priceCell.textContent = q.price;
          row.appendChild(priceCell);
        });
        board.appendChild(row);
      });

      renderDisplayPlayersBar('display-players-bar');
    }

    function renderDisplayQuestion() {
      const q = displayState.currentQuestion;
      if (!q) return;

      document.getElementById('display-question-price').textContent = q.price;
      document.getElementById('display-question-category').textContent = q.category;
      const secretWait = !!(q.passQuestion && q.secretStage !== 'done');
      const dText = document.getElementById('display-question-text');
      dText.textContent = secretWait ? 'Вопрос с секретом' : q.question;
      dText.classList.toggle('secret-title-text', secretWait);
      dText.classList.toggle('modifier-text', !!q.modifier);
      const dBanner = document.getElementById('display-secret-banner');
      if (q.passQuestion) {
        dBanner.style.display = 'block';
        dBanner.textContent = q.secretStage === 'done' ? '🎁 Вопрос передан: ' + (q.secretTo || '')
          : q.secretStage === 'choose' ? 'Выбираем, кому передать вопрос…' : '🎁 Выбравший вопрос передаёт его другому игроку';
        const sig = q.category + '|' + q.price + '|' + q.secretStage;
        const dCard = document.getElementById('display-question-card');
        if (dCard.dataset.secretSig !== sig) {
          dCard.dataset.secretSig = sig;
          dCard.classList.remove('question-pass-animation'); void dCard.offsetWidth; dCard.classList.add('question-pass-animation');
        }
      } else dBanner.style.display = 'none';
      // Длинные вопросы с вариантами ответов должны помещаться на экран проектора
      const qText = String(q.question || '');
      const qLoad = qText.length + 45 * (qText.split('\n').length - 1) + (q.image ? 150 : 0);
      document.getElementById('display-question-text').style.fontSize =
        qLoad > 380 ? 'clamp(1rem, 1.9vw, 1.9rem)' : qLoad > 200 ? 'clamp(1.2rem, 2.3vw, 2.3rem)' : '';

      const imgWrap = document.getElementById('display-question-image-wrapper');
      const img = document.getElementById('display-question-image');
      // Фото перезагружаем только при смене вопроса (состояние приходит каждые 250 мс)
      if (img.dataset.src !== String(q.image || '')) {
        img.dataset.src = String(q.image || '');
        loadQuestionImage(img, imgWrap, q.image);
      }

      // Only show answer if revealed
      const answerReveal = document.getElementById('display-answer-reveal');
      if (displayState.answerRevealed && q.answer) {
        document.getElementById('display-answer-text').textContent = q.answer;
        const aImg = document.getElementById('display-answer-image');
        if (aImg.dataset.src !== String(q.answerImage || '')) {
          aImg.dataset.src = String(q.answerImage || '');
          loadQuestionImage(aImg, document.getElementById('display-answer-image-wrapper'), q.answerImage);
        }
        answerReveal.style.display = 'block';
      } else {
        answerReveal.style.display = 'none';
      }

      // Классы для раскладки: фото должно занимать всё свободное место
      const qScreen = document.getElementById('display-question-screen');
      const shown = !!(displayState.answerRevealed && q.answer);
      qScreen.classList.toggle('has-qimg', !!q.image);
      qScreen.classList.toggle('answer-open', shown);
      qScreen.classList.toggle('has-aimg', shown && !!q.answerImage);

      renderDisplayBuzz();
      renderDisplayPlayersBar('display-players-bar-question', true);
    }

    // Плашка «кто первый нажал» на экране вопроса
    function renderDisplayBuzz() {
      const el = document.getElementById('display-buzz');
      if (!el) return;
      const b = displayState.buzz || {};
      const players = displayState.players || [];
      const w = (b.winner === null || b.winner === undefined) ? null : b.winner;
      if (w !== null && players[w]) {
        el.className = 'display-buzz winner';
        el.innerHTML = '<span class="display-buzz-icon">🔔</span><span class="display-buzz-label">Первым нажал</span><span class="display-buzz-name">' + esc(players[w].name) + '</span>';
      } else if (b.open) {
        el.className = 'display-buzz';
        el.innerHTML = '';
      } else {
        el.className = 'display-buzz';
        el.innerHTML = '';
      }
    }

    function renderDisplayFinal() {
      const content = document.getElementById('display-final-content');
      const q = QUESTIONS.final;

      let html = '';

      if (displayState.currentQuestion) {
        // Question shown
        html += `<div class="display-question-card">`;
        html += `<div class="display-question-text">${esc(displayState.currentQuestion.question || q.question)}</div>`;
        if (q.image) html += `<div class="display-question-image-wrapper"><img class="display-question-image" src="${q.image}" alt="" /></div>`;
        html += `</div>`;

        // Timer
        const pct = (displayState.timer.seconds / displayState.timer.max) * 100;
        html += `<div class="display-timer-wrapper"><div class="timer-bar" style="width:${pct}%"></div><span class="timer-text display-timer-text">${displayState.timer.seconds}</span></div>`;

        // Answer if revealed
        if (displayState.finalAnswerRevealed) {
          html += `<div class="display-answer-reveal"><div class="display-answer-label">Ответ:</div><div class="display-answer-text">${esc(q.answer)}</div></div>`;
        }
      } else {
        // Betting phase
        html += `<p class="final-hint">Игроки делают ставки...</p>`;
      }

      content.innerHTML = html;
      renderDisplayPlayersBar('display-players-bar-final');
    }

    function renderDisplayResults() {
      const players = displayState.players;
      if (!players.length) return;
      const sorted = [...players].map((p, i) => ({ ...p, index: i })).sort((a, b) => b.score - a.score);
      const top = sorted[0].score;
      const leaders = top > 0 ? sorted.filter(p => p.score === top) : [];

      document.getElementById('display-winner-name').textContent = leaders.length ? leaders.map(p => p.name).join(' и ') : 'Ничья!';

      const list = document.getElementById('display-results-list');
      list.innerHTML = '';
      sorted.forEach((player, rank) => {
        const row = document.createElement('div');
        row.className = 'display-results-row' + (top > 0 && player.score === top ? ' winner' : '');
        row.innerHTML = `<span>${rank + 1}. ${esc(player.name)}</span><span class="display-results-row-score">${player.score}</span>`;
        list.appendChild(row);
      });
    }

    function renderDisplayStart() {
      const a = document.getElementById('display-buzzer-link');
      if (a) a.textContent = location.href.split('#')[0].split('?')[0] + '?view=buzzer';
    }

    let creditsShown = false;
    function renderDisplay() {
      if (displayState.phase !== 'credits') creditsShown = false;
      switch (displayState.phase) {
        case 'start':
          showDisplayScreen('display-start-screen');
          renderDisplayStart();
          break;
        case 'credits':
          showDisplayScreen('display-credits-screen');
          if (!creditsShown) {
            creditsShown = true;
            playCredits('display-credits-roll', 'display-credits-viewport');
          }
          break;
        case 'board':
          showDisplayScreen('display-board-screen');
          renderDisplayBoard();
          break;
        case 'question':
          showDisplayScreen('display-question-screen');
          renderDisplayQuestion();
          break;
        case 'final':
          showDisplayScreen('display-final-screen');
          renderDisplayFinal();
          break;
        case 'results':
          showDisplayScreen('display-results-screen');
          renderDisplayResults();
          break;
        default:
          showDisplayScreen('display-board-screen');
          renderDisplayBoard();
          break;
      }
    }

    // Initial render
    renderDisplay();
  }
})();
