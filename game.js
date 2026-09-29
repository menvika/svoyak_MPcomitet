/* ===================================================================
   СВОЯ ИГРА — Game Logic (Dual-View: Host + Projector Display)
   #МПКомитет
   =================================================================== */

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
  const SYNC_BASE = 'port/3001'.startsWith('__') ? 'http://localhost:3001' : 'port/3001';
  const SYNC_URL = SYNC_BASE + '/state';

  function buildSyncState() {
    return {
      type: 'sync',
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
    return d.innerHTML;
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
    setup: document.getElementById('screen-setup'),
    board: document.getElementById('screen-board'),
    question: document.getElementById('screen-question'),
    final: document.getElementById('screen-final'),
    results: document.getElementById('screen-results'),
  };

  function showScreen(name) {
    state.phase = name;
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
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
    showScreen('setup');
    renderPlayerInputs();
  });

  document.getElementById('btn-open-display').addEventListener('click', () => {
    playClick();
    window.open(location.href.split('?')[0] + '?view=display', '_blank');
  });

  document.getElementById('btn-mute-start').addEventListener('click', toggleMute);

  // ===================== PLAYER SETUP =====================
  function renderPlayerInputs() {
    const container = document.getElementById('player-inputs');
    container.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const row = document.createElement('div');
      row.className = 'player-input-row';
      row.innerHTML = `<span class="player-input-number">${i}</span><input type="text" placeholder="Игрок ${i}" value="Игрок ${i}" maxlength="14" />`;
      container.appendChild(row);
    }
  }

  document.getElementById('btn-setup-next').addEventListener('click', () => {
    playClick();
    const inputs = document.querySelectorAll('#player-inputs input');
    state.players = Array.from(inputs).map((inp, i) => ({
      name: inp.value.trim() || `Игрок ${i + 1}`,
      score: 0,
    }));
    state.round = 1;
    state.usedQuestions.clear();
    renderBoard();
    renderPlayersBar();
    showScreen('board');
  });

  document.getElementById('btn-setup-back').addEventListener('click', () => {
    playClick();
    showScreen('start');
  });

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

    resetTimer(30);
    showScreen('question');
  }

  document.getElementById('btn-back-to-board').addEventListener('click', () => {
    playClick();
    stopTimer();
    state.currentQuestion = null;
    state.answerRevealed = false;
    renderBoard();
    renderPlayersBar();
    checkRoundTransition();
    showScreen('board');
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
    state.currentQuestion = null;
    state.answerRevealed = false;
    renderBoard();
    renderPlayersBar();
    checkRoundTransition();
    showScreen('board');
  });

  // ===================== TIMER =====================
  function resetTimer(seconds) {
    stopTimer();
    state.timer.max = seconds;
    state.timer.seconds = seconds;
    state.timer.running = false;
    updateTimerUI();
    document.getElementById('btn-timer-toggle').textContent = '⏱️ Старт';
    broadcastState();
  }

  function stopTimer() {
    if (state.timer.interval) { clearInterval(state.timer.interval); state.timer.interval = null; }
    state.timer.running = false;
  }

  function startTimer() {
    stopTimer();
    state.timer.running = true;
    document.getElementById('btn-timer-toggle').textContent = '⏸️ Пауза';
    state.timer.interval = setInterval(() => {
      state.timer.seconds--;
      updateTimerUI();
      if (state.timer.seconds <= 5 && state.timer.seconds > 0) playTimerTick();
      if (state.timer.seconds <= 0) {
        stopTimer();
        document.getElementById('btn-timer-toggle').textContent = '⏱️ Время!';
        playWrong();
        flashEdge(false);
      }
      broadcastState();
    }, 1000);
  }

  function updateTimerUI() {
    const bar = document.getElementById('timer-bar');
    const text = document.getElementById('timer-text');
    if (!bar || !text) return;
    const pct = (state.timer.seconds / state.timer.max) * 100;
    bar.style.width = pct + '%';
    text.textContent = state.timer.seconds;
    bar.classList.toggle('warning', state.timer.seconds <= 5);
  }

  document.getElementById('btn-timer-toggle').addEventListener('click', () => {
    playClick();
    if (state.timer.running) {
      stopTimer();
      document.getElementById('btn-timer-toggle').textContent = '⏱️ Продолжить';
      broadcastState();
    } else if (state.timer.seconds > 0) {
      startTimer();
    } else {
      resetTimer(30);
      startTimer();
    }
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
    const winner = sorted[0];

    document.getElementById('winner-name').textContent = winner.score > 0 ? winner.name : 'Ничья!';

    const list = document.getElementById('results-list');
    list.innerHTML = '';
    sorted.forEach((player, rank) => {
      const row = document.createElement('div');
      row.className = 'results-row' + (rank === 0 && winner.score > 0 ? ' winner' : '');
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
    startBgMusic();
    showScreen('start');
  });

  document.getElementById('btn-mute-game').addEventListener('click', toggleMute);

  // ===================== INIT =====================
  updateMuteButtons();
  showScreen('start');

  // ==================================================================
  // DISPLAY VIEW LOGIC (projector)
  // ==================================================================
  function initDisplay() {
    const SYNC_URL_DISP = ('port/3001'.startsWith('__') ? 'http://localhost:3001' : 'port/3001') + '/state';

    // Initialize with local data so board shows immediately
    let displayState = {
      type: 'sync',
      phase: 'board',
      round: 1,
      players: [
        { name: 'Ксюша', score: 0 },
        { name: 'Мила', score: 0 },
        { name: 'Денис', score: 0 },
        { name: 'Юля', score: 0 },
        { name: 'Катя', score: 0 },
      ],
      usedQuestions: [],
      currentQuestion: null,
      answerRevealed: false,
      timer: { seconds: 30, max: 30, running: false },
      finalBets: [],
      finalAnswerRevealed: false,
    };

    // Fetch state from server immediately
    async function fetchState() {
      try {
        const resp = await fetch(SYNC_URL_DISP);
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.players && data.players.length > 0) {
            const newJson = JSON.stringify(data);
            const oldJson = JSON.stringify(displayState);
            if (newJson !== oldJson) {
              displayState = data;
              renderDisplay();
            }
          }
        }
      } catch (e) {}
    }

    // Initial fetch
    fetchState();

    // Poll server every 400ms
    setInterval(fetchState, 400);

    function showDisplayScreen(id) {
      document.querySelectorAll('.display-screen').forEach(s => s.classList.remove('active'));
      const el = document.getElementById(id);
      if (el) el.classList.add('active');
    }

    function renderDisplayPlayersBar(containerId) {
      const bar = document.getElementById(containerId);
      if (!bar) return;
      bar.innerHTML = '';
      const players = displayState.players;
      if (!players.length) return;
      const maxScore = Math.max(0, ...players.map(p => p.score));
      const leaders = players.filter(p => p.score === maxScore && maxScore > 0);

      players.forEach((player, i) => {
        const card = document.createElement('div');
        card.className = 'display-player-card' + (leaders.includes(player) ? ' leading' : '');
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

      // Timer
      const timerBar = document.getElementById('display-timer-bar');
      const timerText = document.getElementById('display-timer-text');
      if (timerBar && timerText) {
        const pct = (displayState.timer.seconds / displayState.timer.max) * 100;
        timerBar.style.width = pct + '%';
        timerText.textContent = displayState.timer.seconds;
        timerBar.classList.toggle('warning', displayState.timer.seconds <= 5);
      }

      renderDisplayPlayersBar('display-players-bar-question');
    }

    function renderDisplayFinal() {
      const content = document.getElementById('display-final-content');
      const q = QUESTIONS.final;

      let html = '';

      if (displayState.currentQuestion) {
        // Question shown
        html += `<div class="display-question-card">`;
        html += `<div class="display-question-text">${displayState.currentQuestion.question || q.question}</div>`;
        if (q.image) html += `<div class="display-question-image-wrapper"><img class="display-question-image" src="${q.image}" alt="" /></div>`;
        html += `</div>`;

        // Timer
        const pct = (displayState.timer.seconds / displayState.timer.max) * 100;
        html += `<div class="display-timer-wrapper"><div class="timer-bar" style="width:${pct}%"></div><span class="timer-text display-timer-text">${displayState.timer.seconds}</span></div>`;

        // Answer if revealed
        if (displayState.finalAnswerRevealed) {
          html += `<div class="display-answer-reveal"><div class="display-answer-label">Ответ:</div><div class="display-answer-text">${q.answer}</div></div>`;
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
      const winner = sorted[0];

      document.getElementById('display-winner-name').textContent = winner.score > 0 ? winner.name : 'Ничья!';

      const list = document.getElementById('display-results-list');
      list.innerHTML = '';
      sorted.forEach((player, rank) => {
        const row = document.createElement('div');
        row.className = 'display-results-row' + (rank === 0 && winner.score > 0 ? ' winner' : '');
        row.innerHTML = `<span>${rank + 1}. ${esc(player.name)}</span><span class="display-results-row-score">${player.score}</span>`;
        list.appendChild(row);
      });
    }

    function renderDisplay() {
      switch (displayState.phase) {
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
