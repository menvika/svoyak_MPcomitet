/* ===================================================================
   СВОЯ ИГРА — Game Logic (Dual-View: Host + Projector Display)
   #МПКомитет
   =================================================================== */
// ===================== НАСТРОЙКИ (меняет только владелец) =====================
// Имена игроков. Порядок важен: он же порядок кнопок у участников.
const PLAYER_NAMES = ['Ксюша', 'Мила', 'Денис', 'Юля', 'Катя'];
// Скорость бегущей строки с категориями (пикселей в секунду)
const CREDITS_SPEED = 110;
// Снимать очки, если нажавший первым ответил неверно (как в телеигре)
const PENALTY_ON_WRONG = true;
// Адрес сервера синхронизации и кнопок
const SYNC_BASE = 'port/3001'.startsWith('__') ? 'http://localhost:3001' : 'port/3001';

(() => {
  'use strict';

  // ===================== VIEW MODE =====================
  const VIEW = new URLSearchParams(location.search).get('view') || 'host'; // 'host' | 'display'

  const ROUND1_PRICES = [100, 200, 300, 400, 500];
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
  };

  // ===================== SYNC (backend server) =====================
  const SYNC_URL = SYNC_BASE + '/state';
  let syncSeq = 0; // растёт с каждой отправкой: сервер игнорирует устаревшие запросы

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
        question: state.currentQuestion.question,
        image: state.currentQuestion.image,
        answer: state.answerRevealed ? state.currentQuestion.answer : null,
      } : null,
      answerRevealed: state.answerRevealed,
      timer: { seconds: state.timer.seconds, max: state.timer.max, running: state.timer.running },
      finalBets: state.finalBets,
      finalAnswerRevealed: state.finalAnswerRevealed,
    };
  }

  function broadcastState() {
    const data = buildSyncState();
    try {
      fetch(SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => {});
    } catch (e) {}
  }

  // ===================== UTILS =====================
  function esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  async function apiJson(path, method, body) {
    const resp = await fetch(SYNC_BASE + path, {
      method: method || 'GET',
      cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return resp.json();
  }

  function buildCreditsHTML() {
    const rounds = [
      { title: 'Раунд 1', data: QUESTIONS.round1 },
      { title: 'Раунд 2', data: QUESTIONS.round2 },
      { title: 'Раунд 3', data: QUESTIONS.round3 },
    ];
    let html = '<div class="credits-title">Своя игра</div>';
    rounds.forEach(r => {
      html += `<div class="credits-round">${r.title}</div>`;
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

  function showScreen(name) {
    state.phase = name;
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
    updateScoreEditButton();
    broadcastState();
  }

  // ===================== EDGE FLASH =====================
  function flashEdge(correct) {
    const el = document.getElementById('edge-flash');
    el.className = 'edge-flash';
    el.classList.add('show', correct ? 'correct' : 'wrong');
    setTimeout(() => { el.className = 'edge-flash'; }, 1100);
  }

  // ===================== START SCREEN =====================
  document.getElementById('btn-start').addEventListener('click', () => {
    ensureAudio();
    playClick();
    startBgMusic();
    state.players = PLAYER_NAMES.map(name => ({ name, score: 0 }));
    state.round = 1;
    state.usedQuestions.clear();
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
    showScreen('board');
  }
  document.getElementById('btn-credits-skip').addEventListener('click', finishCredits);

  document.getElementById('btn-open-display').addEventListener('click', () => {
    playClick();
    window.open(location.href.split('?')[0] + '?view=display', '_blank');
  });

  document.getElementById('btn-mute-start').addEventListener('click', toggleMute);

  // ===================== ССЫЛКА ДЛЯ УЧАСТНИКОВ (кнопки) =====================
  const BUZZER_URL = location.href.split('#')[0].split('?')[0] + '?view=buzzer';
  (function initBuzzerLink() {
    const a = document.getElementById('buzzer-link');
    if (a) { a.textContent = BUZZER_URL; a.href = BUZZER_URL; }
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

    document.getElementById('round-badge').textContent = `Раунд ${state.round}`;
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
      if (state.round < 3) {
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
  function openQuestion(ci, qi, qKey, category, qData) {
    state.currentQuestion = { ...qData, category, qKey, ci, qi };
    state.usedQuestions.add(qKey);
    state.answerRevealed = false;

    document.getElementById('question-price').textContent = qData.price;
    document.getElementById('question-category').textContent = category;
    document.getElementById('question-text').textContent = qData.question;

    // Host always sees the answer
    document.getElementById('host-answer-text').textContent = qData.answer;

    const imgWrap = document.getElementById('question-image-wrapper');
    const img = document.getElementById('question-image');
    if (qData.image) {
      img.src = qData.image;
      imgWrap.style.display = 'block';
    } else {
      imgWrap.style.display = 'none';
      img.src = '';
    }

    // Hide display answer section
    document.getElementById('answer-section').style.display = 'none';
    document.getElementById('btn-reveal-answer').style.display = 'inline-flex';

    // Render scoring immediately (host can score at any time)
    renderScoringPlayers('scoring-players', 'btn-question-done');

    buzzControl('new'); // сбросить кнопки участников для нового вопроса
    resetBuzzUI();
    showScreen('question');
  }

  // Выход из вопроса на поле (общее для «← К полю» и «Готово»)
  function leaveQuestion() {
    state.currentQuestion = null;
    state.answerRevealed = false;
    buzzControl('new');
    renderBoard();
    renderPlayersBar();
    checkRoundTransition();
    showScreen('board');
  }

  document.getElementById('btn-back-to-board').addEventListener('click', () => {
    playClick();
    leaveQuestion();
  });

  // Reveal answer to display (and show on host too)
  document.getElementById('btn-reveal-answer').addEventListener('click', () => {
    playClick();
    state.answerRevealed = true;
    const q = state.currentQuestion;
    document.getElementById('answer-text').textContent = q.answer;
    document.getElementById('answer-section').style.display = 'block';
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
    state.players[playerIndex].score += amount;
    flashEdge(correct);
    if (correct) playCorrect(); else playWrong();
    renderPlayersBar();
    bumpScore(playerIndex);
    broadcastState();
  }

  document.getElementById('btn-question-done').addEventListener('click', () => {
    playClick();
    leaveQuestion();
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
    if (buzz.winner !== null && prevWinner === null && state.phase === 'question') playBuzzSound();
    renderBuzzPanel();
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
    else if (buzz.open) { text = 'Кнопки открыты — ждём нажатия'; cls = 'open'; }
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

  document.getElementById('btn-buzz-open').addEventListener('click', () => { playClick(); buzzControl('open'); });
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

  // Горячие клавиши на экране вопроса (как на timbrica): Пробел — открыть, Enter — верно, Backspace — неверно
  document.addEventListener('keydown', e => {
    if (state.phase !== 'question' || e.repeat) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (document.getElementById('score-modal').style.display !== 'none') return;
    if (e.code === 'Space' && !buzz.open && buzz.winner === null) { e.preventDefault(); buzzControl('open'); }
    else if (e.code === 'Enter' && buzz.winner !== null) { e.preventDefault(); buzzCorrect(); }
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
  function startFinalRound() {
    stopBgMusic();
    state.finalBets = state.players.map(() => 0);
    state.finalAnswerRevealed = false;

    const container = document.getElementById('final-bet-inputs');
    container.innerHTML = '';
    state.players.forEach((player, i) => {
      const row = document.createElement('div');
      row.className = 'final-bet-row';
      row.innerHTML = `
        <label>${esc(player.name)}</label>
        <div class="score-hint">Очки: ${player.score}</div>
        <input type="number" min="0" max="${Math.max(0, player.score)}" value="0" data-player="${i}" />
      `;
      container.appendChild(row);
    });

    document.getElementById('final-bets').style.display = 'block';
    document.getElementById('final-question-section').style.display = 'none';
    document.getElementById('final-answer-section').style.display = 'none';
    document.getElementById('final-host-answer-text').textContent = '';

    showScreen('final');
    startBgMusic();
  }

  document.getElementById('btn-final-show-question').addEventListener('click', () => {
    playClick();
    const inputs = document.querySelectorAll('#final-bet-inputs input');
    state.finalBets = Array.from(inputs).map((inp, i) => {
      const val = parseInt(inp.value, 10) || 0;
      return Math.min(val, Math.max(0, state.players[i].score));
    });

    // Set currentQuestion so display view syncs
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

    document.getElementById('final-bets').style.display = 'none';
    document.getElementById('final-question-section').style.display = 'block';

    // Render final scoring
    const scoringContainer = document.getElementById('final-scoring-players');
    scoringContainer.innerHTML = '';
    state.players.forEach((player, i) => {
      const bet = state.finalBets[i] || 0;
      const row = document.createElement('div');
      row.className = 'scoring-player-row';
      row.innerHTML = `
        <div class="scoring-player-name">${esc(player.name)}</div>
        <div style="font-size:var(--text-xs);color:var(--color-text-muted)">Ставка: ${bet}</div>
        <div class="scoring-buttons">
          <button class="score-btn minus" data-action="minus" data-player="${i}" aria-label="Неверно">−</button>
          <button class="score-btn plus" data-action="plus" data-player="${i}" aria-label="Верно">+</button>
        </div>
      `;
      scoringContainer.appendChild(row);
    });

    scoringContainer.querySelectorAll('.score-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const idx = parseInt(btn.dataset.player, 10);
        const bet = state.finalBets[idx] || 0;
        adjustScore(idx, action === 'plus' ? bet : -bet, action === 'plus');
      });
    });

    stopTimer();
    state.timer.max = 60;
    state.timer.seconds = 60;
    state.timer.running = false;
    updateFinalTimerUI();
    document.getElementById('btn-final-timer-toggle').textContent = '⏱️ Старт';
    broadcastState();
  });

  document.getElementById('btn-final-timer-toggle').addEventListener('click', () => {
    playClick();
    if (state.timer.running) {
      stopTimer();
      document.getElementById('btn-final-timer-toggle').textContent = '⏱️ Продолжить';
      broadcastState();
    } else if (state.timer.seconds > 0) {
      startFinalTimer();
    } else {
      state.timer.max = 60;
      state.timer.seconds = 60;
      startFinalTimer();
    }
  });

  function startFinalTimer() {
    stopTimer();
    state.timer.running = true;
    document.getElementById('btn-final-timer-toggle').textContent = '⏸️ Пауза';
    state.timer.interval = setInterval(() => {
      state.timer.seconds--;
      updateFinalTimerUI();
      if (state.timer.seconds <= 5 && state.timer.seconds > 0) playTimerTick();
      if (state.timer.seconds <= 0) {
        stopTimer();
        document.getElementById('btn-final-timer-toggle').textContent = '⏱️ Время!';
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
  function showResults() {
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

    playRoundEnd();
    showScreen('results');
  }

  document.getElementById('btn-play-again').addEventListener('click', () => {
    playClick();
    state.players = [];
    state.round = 1;
    state.usedQuestions.clear();
    state.currentQuestion = null;
    state.finalBets = [];
    state.answerRevealed = false;
    state.finalAnswerRevealed = false;
    stopTimer();
    buzzControl('new');
    resetBuzzUI();
    startBgMusic();
    showScreen('start');
  });

  document.getElementById('btn-mute-game').addEventListener('click', toggleMute);

  // ===================== INIT =====================
  updateMuteButtons();
  showScreen('start');


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
    const connEl = document.getElementById('buzzer-conn');

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
      else if (net.open) { cls = 'ready'; label = 'ЖМИ!'; sub = 'Кнопки открыты'; }
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

    // pointerdown, а не click: срабатывает сразу при касании, без задержки
    btn.addEventListener('pointerdown', e => { e.preventDefault(); press(); });
    document.addEventListener('keydown', e => {
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); press(); }
    });

    async function poll() {
      const myEpoch = epoch;
      try {
        const d = await apiJson('/buzz', 'GET');
        connEl.style.display = 'none';
        if (myEpoch === epoch && !sending) applyNet(d);
      } catch (e) {
        connEl.style.display = 'block';
      }
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
    const SYNC_URL_DISP = SYNC_BASE + '/state';

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

    // Индикатор связи: красная плашка, если сервер недоступен
    let failCount = 0;
    let lastJson = '';
    function setConn(ok) {
      const el = document.getElementById('display-conn');
      if (el) el.style.display = ok ? 'none' : 'block';
    }

    async function fetchState() {
      try {
        const resp = await fetch(SYNC_URL_DISP, { cache: 'no-store' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        failCount = 0;
        setConn(true);
        if (data && data.phase) {
          const json = JSON.stringify(data);
          if (json !== lastJson) {
            lastJson = json;
            displayState = data;
            renderDisplay();
          }
        }
      } catch (e) {
        failCount++;
        if (failCount >= 3) setConn(false);
      }
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

      document.getElementById('display-round-badge').textContent = `Раунд ${displayState.round}`;
      renderDisplayPlayersBar('display-players-bar');
    }

    function renderDisplayQuestion() {
      const q = displayState.currentQuestion;
      if (!q) return;

      document.getElementById('display-question-price').textContent = q.price;
      document.getElementById('display-question-category').textContent = q.category;
      document.getElementById('display-question-text').textContent = q.question;

      const imgWrap = document.getElementById('display-question-image-wrapper');
      const img = document.getElementById('display-question-image');
      if (q.image) {
        img.src = q.image;
        imgWrap.style.display = 'block';
      } else {
        imgWrap.style.display = 'none';
      }

      // Only show answer if revealed
      const answerReveal = document.getElementById('display-answer-reveal');
      if (displayState.answerRevealed && q.answer) {
        document.getElementById('display-answer-text').textContent = q.answer;
        answerReveal.style.display = 'block';
      } else {
        answerReveal.style.display = 'none';
      }

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
        el.className = 'display-buzz open';
        el.innerHTML = '<span class="display-buzz-icon">🔔</span><span class="display-buzz-label">Кнопки открыты — жмите!</span>';
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
