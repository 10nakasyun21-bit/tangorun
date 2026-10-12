// 画面の切り替えとクイズの進行

const NEXT_DELAY_MS = 800;
const GOAL_WORDS = 800;
const HOT_COMBO = 3; // この数以上の連続正解で表示を強調

const TASK_TEXT = {
  1: '意味をえらぼう',
  2: '英語をえらぼう',
  3: 'つづりを書こう',
};

const USAGE_TICK_MS = 5000;
const IDLE_LIMIT_MS = 60 * 1000; // 1分操作がなければ使用時間を数えない
const PUSH_INTERVAL_MS = 60 * 1000; // アプリを閉じたときの送信は1分に1回まで

const state = {
  mode: 'words',     // 'words'（単語）・'idioms'（熟語）・'sentences'（文章）・'challenge'（1分チャレンジ）
  words: [],
  idioms: [],
  chapters: [],
  sentences: [],
  placed: [],        // 文章の並べ替えで、並べたタイルの番号
  openBefore: 0,     // セット開始時に開いていた章の数
  missionsBefore: [], // セット開始時に達成済みだったミッション
  challengePool: [], // 1分チャレンジでこれから出す単語
  challengeEnd: 0,
  challengeTimer: null,
  gachaSeries: 'regular', // ガチャ画面で選んでいるシリーズ
  gachaTimer: null,
  activeSeries: loadActiveSeries(), // 管理者が開始した期間限定シリーズ（なければ null）
  record: emptyRecord(),
  user: null,        // ログイン中の生徒 { uid, name }（ログインなしで使うときは null）
  synced: false,     // Firebase の記録と一度まとめたか
  pushing: null,     // 送信中の Promise
  lastPushAt: 0,
  dirtyDates: new Set(), // まだ送っていない使用時間の日付
  questions: [],
  index: 0,
  correctCount: 0,
  combo: 0,
  maxCombo: 0,
  answered: false,
  nextTimer: null,
};

const $ = id => document.getElementById(id);

function showScreen(name) {
  clearTimeout(state.nextTimer); // 「やめる」などで抜けたら、自動で次へ進む予約を取り消す
  clearInterval(state.challengeTimer); // 1分チャレンジの途中で抜けたらタイマーも止める
  state.challengeTimer = null;
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('is-active'));
  $('screen-' + name).classList.add('is-active');
  window.scrollTo(0, 0);
}

// 発音（Web Speech API）
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

// ---------- ホーム ----------

function showHome() {
  const streak = currentStreak(state.record);
  $('streak-days').textContent = streak;
  $('streak').classList.toggle('is-zero', streak === 0);

  const mastered = countMastered(state.record);
  $('mastered-count').textContent = mastered;
  $('goal-count').textContent = GOAL_WORDS;
  $('remaining-count').textContent = Math.max(GOAL_WORDS - mastered, 0);
  $('idiom-mastered').textContent = countMastered(state.record, 'idioms');
  $('idiom-total').textContent = state.idioms.length;
  renderStoryCard();
  renderChallengeCard();
  renderMissions();
  renderCoins();
  renderPartner();
  showScreen('home');
  // 画面が出てからバーを伸ばす（アニメーションさせるため）
  requestAnimationFrame(() => {
    $('meter-fill').style.width = Math.min(mastered / GOAL_WORDS, 1) * 100 + '%';
  });
}

// いま進めている章と、その章で正解した文の数
function storyProgress() {
  const open = unlockedChapterIds(state.chapters, state.sentences, state.record);
  const chapter = state.chapters.find(c => c.id === open[open.length - 1]);
  const inChapter = state.sentences.filter(s => s.chapter === chapter.id);
  const done = inChapter.filter(s => state.record.sentences[s.id] && state.record.sentences[s.id].correct > 0).length;
  return { chapter, done, total: inChapter.length, openCount: open.length };
}

function renderStoryCard() {
  if (!state.chapters.length) return;
  const p = storyProgress();
  $('story-chapter').textContent = `文章 第${p.chapter.id}章 ${p.done}/${p.total}文`;
}

function renderChallengeCard() {
  const met = Object.keys(state.record.words).length;
  const ready = state.words.length > 0 && met >= CHALLENGE_MIN_WORDS;
  $('btn-challenge').disabled = !ready;
  $('challenge-sub').textContent = ready
    ? `自己ベスト ${state.record.stats.challengeBest || 0}問`
    : `単語を${CHALLENGE_MIN_WORDS}語解くと遊べる`;
}

function renderMissions() {
  const list = missionStatus(state.record);
  const ul = $('mission-list');
  ul.innerHTML = '';
  for (const m of list) {
    const li = document.createElement('li');
    li.className = m.done ? 'is-done' : '';
    const check = document.createElement('span');
    check.className = 'mission-check';
    check.textContent = m.done ? '✓' : '';
    li.append(check, m.label);
    ul.append(li);
  }
  const done = list.filter(m => m.done).length;
  $('mission-count').textContent = done === list.length ? 'ぜんぶ達成！' : `${done}/${list.length}`;
  document.querySelector('.missions').classList.toggle('is-complete', done === list.length);
}

// ---------- クイズ ----------

function startSet(mode = state.mode) {
  unlockAudio();
  state.mode = mode;
  if (mode === 'sentences') {
    state.openBefore = unlockedChapterIds(state.chapters, state.sentences, state.record).length;
    state.questions = buildSentenceSet(state.chapters, state.sentences, state.record);
  } else if (mode === 'idioms') {
    state.questions = buildIdiomSet(state.idioms, state.record);
  } else {
    state.questions = buildSet(state.words, state.record);
  }
  beginRound();
  $('q-total').textContent = state.questions.length;
  $('screen-quiz').classList.toggle('is-sentence', mode === 'sentences');
  $('screen-quiz').classList.remove('is-challenge');
  $('q-sep').hidden = false;
  renderCombo();
  showScreen('quiz');
  renderQuestion();
}

// セット・チャレンジの始めに共通でやること
function beginRound() {
  state.index = 0;
  state.correctCount = 0;
  state.combo = 0;
  state.maxCombo = 0;
  // 結果画面で「このセットで達成したミッション」を出すため、始める前の状態を覚えておく
  state.missionsBefore = missionStatus(state.record).filter(m => m.done).map(m => m.id);
  state.usageBefore = { ...usageOf(state.record, localDate()) };
}

// ---------- 1分チャレンジ ----------
// 出会ったことのある単語だけを使う。レベル1の形（英語→日本語の4択）でテンポよく出す。
// 単語ごとの記録（復習の間隔・レベル）は変えない（急いで答える遊びなので、学習の記録をゆがめないため）

const CHALLENGE_SECONDS = 60;
const CHALLENGE_MIN_WORDS = 10;
const CHALLENGE_NEXT_CORRECT_MS = 250;
const CHALLENGE_NEXT_WRONG_MS = 900;

function startChallenge() {
  unlockAudio();
  state.mode = 'challenge';
  const met = state.words.filter(w => state.record.words[w.id]);
  state.challengePool = shuffle(met);
  state.questions = [];
  beginRound();
  state.challengeEnd = Date.now() + CHALLENGE_SECONDS * 1000;
  $('screen-quiz').classList.remove('is-sentence');
  $('screen-quiz').classList.add('is-challenge');
  $('q-sep').hidden = true; // 「1/10」ではなく「57秒」と出す
  renderCombo();
  showScreen('quiz');
  nextChallengeQuestion();
  clearInterval(state.challengeTimer);
  state.challengeTimer = setInterval(tickChallenge, 100);
  tickChallenge();
}

function nextChallengeQuestion() {
  // 用意した単語を出し切ったら、並べ直してもう一周（直前と同じ単語が続かないようにする）
  if (!state.challengePool.length) {
    const last = state.questions.length ? state.questions[state.questions.length - 1].word.id : null;
    const met = state.words.filter(w => state.record.words[w.id]);
    state.challengePool = shuffle(met);
    if (state.challengePool.length > 1 && state.challengePool[0].id === last) state.challengePool.push(state.challengePool.shift());
  }
  const word = state.challengePool.shift();
  state.questions.push({ word, level: 1, practice: true, isNew: false, choices: makeChoices(word, state.words) });
  state.index = state.questions.length - 1;
  renderQuestion();
}

function tickChallenge() {
  const left = Math.max(0, state.challengeEnd - Date.now());
  $('progress-fill').style.width = (left / (CHALLENGE_SECONDS * 1000)) * 100 + '%';
  $('progress-fill').classList.toggle('is-hurry', left <= 10000);
  $('q-num').textContent = Math.ceil(left / 1000);
  $('q-total').textContent = '秒';
  if (left <= 0) endChallenge();
}

function endChallenge() {
  stopChallenge();
  showResult();
}

function stopChallenge() {
  clearInterval(state.challengeTimer);
  clearTimeout(state.nextTimer);
  state.challengeTimer = null;
}

// いまの問題で読み上げる英語
function currentSpeakText() {
  const q = state.questions[state.index];
  if (q.sentence) return q.sentence.en;
  if (q.idiom) return idiomSpeakText(q.idiom);
  return q.word.word;
}

function renderQuestion() {
  const q = state.questions[state.index];
  const total = state.questions.length;
  state.answered = false;

  // 1分チャレンジでは、上のバーと数字は残り時間を表す（tickChallenge が書きかえる）
  if (state.mode !== 'challenge') {
    $('q-num').textContent = state.index + 1;
    $('progress-fill').style.width = (state.index / total) * 100 + '%';
  }
  $('btn-next').hidden = true;
  $('feedback').hidden = true;
  $('s-feedback').hidden = true;
  $('s-line').hidden = true;
  $('s-build').hidden = true;
  $('s-bank').hidden = true;

  if (q.sentence) {
    renderSentenceQuestion(q);
    return;
  }
  if (q.idiom) {
    renderIdiomQuestion(q);
    return;
  }

  $('q-task').textContent = state.mode === 'challenge' ? `正解 ${state.correctCount}問` : TASK_TEXT[q.level];
  $('q-pos').textContent = q.word.pos;

  const prompt = $('q-prompt');
  const isEnglishPrompt = q.level === 1;
  prompt.textContent = isEnglishPrompt ? q.word.word : q.word.meaning;
  prompt.classList.toggle('is-ja', !isEnglishPrompt);
  prompt.classList.toggle('is-long', isEnglishPrompt && q.word.word.length > 10);
  prompt.classList.remove('is-sentence', 'is-idiom');

  // レベル1は問題が英語なので、答える前から発音を聞ける（1分チャレンジはテンポ優先で出さない）
  $('btn-speak').hidden = q.level !== 1 || state.mode === 'challenge';

  const box = $('choices');
  const form = $('spell-form');
  box.innerHTML = '';
  box.classList.remove('is-locked', 'is-grid');
  $('screen-quiz').classList.toggle('is-spell', q.level === 3);

  if (q.level === 3) {
    box.hidden = true;
    $('spell-hint').hidden = false;
    $('spell-hint').textContent = spellingHint(q.word.word);
    openSpellForm();
  } else {
    form.hidden = true;
    box.hidden = false;
    q.choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'choice' + (q.level === 2 ? ' is-en' : '');
      btn.textContent = q.level === 1 ? choice.meaning : choice.word;
      btn.dataset.id = choice.id;
      btn.addEventListener('click', () => answerChoice(btn, choice));
      box.appendChild(btn);
    });
  }
}

// ---------- 熟語の問題 ----------

const IDIOM_TASK_TEXT = {
  1: '意味をえらぼう',
  2: '熟語をえらぼう',
  3: '（　）に入る語をえらぼう',
};

function renderIdiomQuestion(q) {
  const it = q.idiom;
  $('q-task').textContent = IDIOM_TASK_TEXT[q.level];
  $('q-pos').textContent = it.type;
  const prompt = $('q-prompt');
  // レベル1：熟語（英語）、レベル2：意味、レベル3：例文の日本語訳（英文は下に穴あきで出す）
  prompt.textContent = q.level === 1 ? it.idiom : q.level === 2 ? it.meaning : it.example_ja;
  prompt.className = 'prompt ' + (q.level === 1 ? 'is-idiom' : q.level === 2 ? 'is-ja' : 'is-ja is-sentence');
  $('btn-speak').hidden = q.level !== 1; // レベル1は問題が英語なので、答える前から聞ける
  $('spell-form').hidden = true;
  // レベル3は例文をすぐ下に出し、選択肢が離れすぎないようにする
  $('screen-quiz').classList.toggle('is-spell', q.level === 3);
  if (q.level === 3) {
    renderIdiomBlank(it, false);
    $('s-line').hidden = false;
  }

  const box = $('choices');
  box.innerHTML = '';
  box.classList.remove('is-locked');
  box.classList.toggle('is-grid', q.level === 3);
  box.hidden = false;
  if (q.level === 3) {
    q.blankChoices.forEach(text => {
      const btn = document.createElement('button');
      btn.className = 'choice is-en';
      btn.textContent = text;
      btn.dataset.answer = text === it.blank ? '1' : '';
      btn.addEventListener('click', () => answerIdiomChoice(btn, text === it.blank));
      box.appendChild(btn);
    });
  } else {
    q.choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'choice' + (q.level === 2 ? ' is-idiom' : ' is-meaning');
      btn.textContent = q.level === 1 ? choice.meaning : choice.idiom;
      btn.dataset.answer = choice.id === it.id ? '1' : '';
      btn.addEventListener('click', () => answerIdiomChoice(btn, choice.id === it.id));
      box.appendChild(btn);
    });
  }
}

// 穴うめの英文。答える前は「(　　)」、答えたあとは正解の語を入れて見せる
function renderIdiomBlank(it, revealed) {
  const { before, after } = idiomBlankParts(it);
  const line = $('s-line');
  line.innerHTML = '';
  const mid = document.createElement('span');
  mid.className = 's-hint';
  mid.textContent = revealed ? it.blank : '(　　)';
  line.append(before, mid, after);
}

function answerIdiomChoice(btn, isCorrect) {
  if (state.answered) return;
  const q = state.questions[state.index];
  const box = $('choices');
  box.classList.add('is-locked');
  if (isCorrect) {
    btn.classList.add('is-correct', 'is-picked');
  } else {
    btn.classList.add('is-wrong');
    box.querySelector('[data-answer="1"]').classList.add('is-correct');
  }
  if (q.level === 3) renderIdiomBlank(q.idiom, true);
  finishAnswer(isCorrect);
}

function openSpellForm() {
  $('spell-form').hidden = false;
  const input = $('spell-input');
  input.value = '';
  input.className = 'spell-input';
  input.readOnly = false;
  $('btn-spell').hidden = false;
  input.focus();
}

// ---------- 文章の問題 ----------

const SENTENCE_TASK_TEXT = {
  1: '日本語に合うように並べよう',
  2: '単語を並べて文を作ろう',
  3: '空いているところを書こう',
};

function renderSentenceQuestion(q) {
  const s = q.sentence;
  $('q-task').textContent = SENTENCE_TASK_TEXT[q.level];
  $('q-pos').textContent = `第${s.chapter}章`;
  const prompt = $('q-prompt');
  prompt.textContent = s.ja;
  prompt.className = 'prompt is-ja is-sentence';
  $('btn-speak').hidden = true; // 答えを聞けてしまうので、答えたあとに出す
  $('choices').hidden = true;
  $('screen-quiz').classList.toggle('is-spell', q.level === 3);

  if (q.level === 3) {
    renderBlankLine(s, false);
    $('s-line').hidden = false;
    $('spell-hint').hidden = true; // ヒントは文の中に出す
    openSpellForm();
    return;
  }
  $('spell-form').hidden = true;
  state.placed = [];
  $('s-build').className = 's-build';
  $('s-bank').className = 's-bank';
  $('s-build').hidden = false;
  $('s-bank').hidden = false;
  renderTiles();
}

// 穴うめの文：答える前はヒント（最初の1文字と文字数）、答えたあとは正解を入れて見せる
function renderBlankLine(s, revealed) {
  const at = s.en.indexOf(s.blank);
  const line = $('s-line');
  line.innerHTML = '';
  const mid = document.createElement('span');
  mid.className = 's-hint';
  mid.textContent = revealed ? s.blank : spellingHint(s.blank);
  line.append(s.en.slice(0, at), mid, s.en.slice(at + s.blank.length));
}

function renderTiles() {
  const q = state.questions[state.index];
  const build = $('s-build');
  const bank = $('s-bank');
  build.innerHTML = '';
  bank.innerHTML = '';
  for (const i of state.placed) {
    const tile = q.tiles.find(t => t.i === i);
    const btn = document.createElement('button');
    btn.className = 'tile';
    btn.textContent = tile.text;
    btn.addEventListener('click', () => unplaceTile(i));
    build.append(btn);
  }
  for (const tile of q.tiles) {
    const btn = document.createElement('button');
    btn.className = 'tile' + (state.placed.includes(tile.i) ? ' is-used' : '');
    btn.textContent = tile.text;
    btn.addEventListener('click', () => placeTile(tile.i));
    bank.append(btn);
  }
}

function placeTile(i) {
  if (state.answered || state.placed.includes(i)) return;
  state.placed.push(i);
  renderTiles();
  const q = state.questions[state.index];
  if (state.placed.length === q.tiles.length) checkTiles();
}

function unplaceTile(i) {
  if (state.answered) return;
  state.placed = state.placed.filter(p => p !== i);
  renderTiles();
}

function checkTiles() {
  const q = state.questions[state.index];
  const built = state.placed.map(i => q.tiles.find(t => t.i === i).text).join(' ');
  const isCorrect = built === q.sentence.en;
  $('s-build').classList.add(isCorrect ? 'is-correct' : 'is-wrong', 'is-locked');
  $('s-bank').classList.add('is-locked');
  finishAnswer(isCorrect);
}

function showSentenceFeedback(s) {
  $('sf-grammar').textContent = s.grammar;
  $('sf-en').textContent = s.en;
  $('sf-note').textContent = s.note;
  $('s-feedback').hidden = false;
}

// ---------- 単語の問題 ----------

function answerChoice(btn, choice) {
  if (state.answered) return;
  const q = state.questions[state.index];
  const isCorrect = choice.id === q.word.id;
  const box = $('choices');
  box.classList.add('is-locked');

  if (isCorrect) {
    btn.classList.add('is-correct', 'is-picked');
  } else {
    btn.classList.add('is-wrong');
    box.querySelector(`[data-id="${q.word.id}"]`).classList.add('is-correct');
  }
  finishAnswer(isCorrect);
}

function answerSpelling(e) {
  e.preventDefault();
  if (state.answered) return;
  const q = state.questions[state.index];
  const input = $('spell-input');
  if (!input.value.trim()) return;

  const isCorrect = q.sentence
    ? normalizeAnswer(input.value) === normalizeAnswer(q.sentence.blank)
    : normalizeSpelling(input.value) === normalizeSpelling(q.word.word);
  input.readOnly = true;
  input.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
  $('btn-spell').hidden = true;
  if (q.sentence) renderBlankLine(q.sentence, true);
  // 文章は答えのあとに解説を読ませるので、正解でもキーボードを閉じる
  if (!isCorrect || q.sentence) input.blur();
  finishAnswer(isCorrect);
}

// 正解・不正解の共通処理
function finishAnswer(isCorrect) {
  state.answered = true;
  const q = state.questions[state.index];
  const settings = state.record.settings;

  if (state.mode === 'challenge') {
    finishChallengeAnswer(isCorrect);
    return;
  }

  $('progress-fill').style.width = ((state.index + 1) / state.questions.length) * 100 + '%';
  if (q.sentence) recordAnswer(state.record, q.sentence.id, isCorrect, q.practice, 'sentences');
  else if (q.idiom) recordAnswer(state.record, q.idiom.id, isCorrect, q.practice, 'idioms');
  else recordAnswer(state.record, q.word.id, isCorrect, q.practice);

  if (settings.sound) isCorrect ? playCorrect() : playWrong();
  // 効果音と重ならないよう、発音は少しだけ遅らせる
  const text = currentSpeakText();
  if (settings.autoSpeak) setTimeout(() => speak(text), settings.sound ? 250 : 0);
  $('btn-speak').hidden = false;

  if (isCorrect) {
    state.correctCount++;
    state.combo++;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    renderCombo(true);
  } else {
    state.combo = 0;
    renderCombo();
  }

  if (q.sentence) {
    // 文章は正解でも文法ポイントを読んでから「次へ」で進む
    $('s-bank').hidden = true; // 並べ終わったら空きスペースはいらない
    showSentenceFeedback(q.sentence);
    $('btn-next').hidden = false;
    // 小さい画面でも解説と「次へ」が見えるようにする
    requestAnimationFrame(() => $('btn-next').scrollIntoView({ block: 'end', behavior: 'smooth' }));
  } else if (isCorrect) {
    state.nextTimer = setTimeout(nextQuestion, NEXT_DELAY_MS);
  } else {
    // 熟語も単語と同じ形で、正解・意味・例文を見せる
    showFeedback(q.idiom ? { word: q.idiom.idiom, meaning: q.idiom.meaning, example: q.idiom.example, example_ja: q.idiom.example_ja } : q.word);
    $('btn-next').hidden = false;
    // 小さい画面でも、正解・例文と「次へ」が見えるようにする
    requestAnimationFrame(() => $('btn-next').scrollIntoView({ block: 'end', behavior: 'smooth' }));
  }
}

// 1分チャレンジ：発音や解説は出さず、すぐ次の問題へ（まちがえたときは正解を少しだけ見せる）
function finishChallengeAnswer(isCorrect) {
  recordChallengeAnswer(state.record, isCorrect);
  if (state.record.settings.sound) isCorrect ? playCorrect() : playWrong();
  if (isCorrect) {
    state.correctCount++;
    state.combo++;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    renderCombo(true);
  } else {
    state.combo = 0;
    renderCombo();
  }
  state.nextTimer = setTimeout(nextChallengeQuestion, isCorrect ? CHALLENGE_NEXT_CORRECT_MS : CHALLENGE_NEXT_WRONG_MS);
}

function showFeedback(word) {
  $('fb-word').textContent = word.word;
  $('fb-meaning').textContent = word.meaning;
  $('fb-example').textContent = word.example;
  $('fb-example-ja').textContent = word.example_ja;
  $('feedback').hidden = false;
}

function renderCombo(animate = false) {
  const el = $('combo');
  if (state.combo < 2) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  $('combo-num').textContent = state.combo;
  el.classList.toggle('is-hot', state.combo >= HOT_COMBO);
  if (animate) {
    el.classList.remove('pop');
    void el.offsetWidth; // アニメーションを最初から再生させる
    el.classList.add('pop');
  }
}

function nextQuestion() {
  clearTimeout(state.nextTimer);
  state.index++;
  if (state.index < state.questions.length) {
    renderQuestion();
  } else {
    showResult();
  }
}

// ---------- 結果 ----------

function showResult() {
  const mode = state.mode;
  const unlock = $('r-unlock');
  unlock.hidden = true;
  if (mode === 'sentences') {
    const p = storyProgress();
    state.record.stats.storyChapter = p.chapter.id;
    if (p.openCount > state.openBefore) {
      unlock.textContent = `🎉 第${p.chapter.id}章「${p.chapter.title}」が開いた！`;
      unlock.hidden = false;
    }
  }
  const bestBefore = state.record.stats.challengeBest || 0;
  recordSetCompleted(state.record, { mode, maxCombo: state.maxCombo, score: state.correctCount });

  $('r-correct').textContent = state.correctCount;
  $('r-combo').textContent = state.maxCombo;
  $('btn-again').textContent = mode === 'challenge' ? 'もう一回' : 'もう1セット';
  if (mode === 'challenge') {
    $('r-score-unit').textContent = ' 問正解';
    $('r-stat2-label').textContent = '🏆 自己ベスト';
    $('r-stat2').textContent = `${state.record.stats.challengeBest}問`;
    if (state.correctCount > bestBefore && state.correctCount > 0) {
      unlock.textContent = '🎉 自己ベスト更新！';
      unlock.hidden = false;
    }
  } else {
    $('r-score-unit').textContent = ` / ${state.questions.length} 問正解`;
    $('r-stat2-label').textContent = '🔥 連続';
    $('r-stat2').textContent = `${currentStreak(state.record)}日`;
  }
  renderGrowth(mode);
  const newMissions = renderNewMissions();
  // コイン：正解1問ごと＋セットを終えたボーナス＋新しく達成したミッション
  const earned = (mode === 'challenge' ? COIN_PER_CHALLENGE : state.correctCount * COIN_PER_CORRECT + COIN_PER_SET)
    + newMissions * COIN_PER_MISSION;
  addCoins(state.record, earned);
  $('r-coins').textContent = `+${earned}`;
  showScreen('result');
  pushToCloud();
}

// 今日の「できた」：レベルアップした数と、新しく覚えた数（単語・文章・熟語のうち、遊んだものを出す）
function renderGrowth(mode) {
  const el = $('r-growth');
  const u = usageOf(state.record, localDate());
  const unit = { sentences: '文', idioms: '個' }[mode] || '語';
  const prefix = USAGE_PREFIX[mode] || 'word';
  const parts = [];
  if (mode !== 'challenge') {
    if (u[prefix + 'LevelUps']) parts.push(`📈 今日レベルアップ ${u[prefix + 'LevelUps']}${unit}`);
    if (u[prefix + 'Mastered']) parts.push(`⭐ 今日覚えた ${u[prefix + 'Mastered']}${unit}`);
  }
  el.textContent = parts.join('　');
  el.hidden = parts.length === 0;
}

// このセットで新しく達成したミッション
function renderNewMissions() {
  const ul = $('r-missions');
  ul.innerHTML = '';
  const now = missionStatus(state.record);
  const newlyDone = now.filter(m => m.done && !state.missionsBefore.includes(m.id));
  // このセットでぜんぶそろったら、まとめて1行で祝う（小さい画面で行が増えすぎないように）
  const lines = newlyDone.length && now.every(m => m.done)
    ? ['🎉 今日のミッションぜんぶ達成！']
    : newlyDone.map(m => `✅ ミッション達成：${m.label}`);
  for (const text of lines) {
    const li = document.createElement('li');
    li.textContent = text;
    ul.append(li);
  }
  ul.hidden = lines.length === 0;
  return newlyDone.length;
}

// ---------- コイン・相棒 ----------

function renderCoins() {
  ensureCollection(state.record);
  $('coin-count').textContent = state.record.coins;
  $('gacha-coins').textContent = state.record.coins;
}

// 相棒がいればロゴの代わりにホームに出す
function renderPartner() {
  const cat = state.record.partner && state.record.collection[state.record.partner] > 0 ? findCat(state.record.partner) : null;
  $('home-logo').hidden = !!cat;
  $('partner-box').hidden = !cat;
  if (!cat) return;
  $('partner-art').innerHTML = buildCatSVG(cat);
  $('partner-bubble').textContent = `「${cat.quote}」`;
}

// ---------- ガチャ ----------

// 管理者が期間限定シリーズを開始していれば、そのシリーズも引ける
function activeLimitedSeries() {
  return state.activeSeries ? limitedSeries(state.activeSeries) : null;
}

function gachaPool() {
  const s = state.gachaSeries !== 'regular' ? activeLimitedSeries() : null;
  return s ? s.cats : CATS;
}

function showGacha() {
  const limited = activeLimitedSeries();
  if (!limited) state.gachaSeries = 'regular';
  const tabs = $('gacha-tabs');
  tabs.innerHTML = '';
  tabs.hidden = !limited;
  if (limited) {
    for (const [id, label] of [['regular', '通常'], [limited.id, `★期間限定`]]) {
      const b = document.createElement('button');
      b.className = 'gacha-tab' + (state.gachaSeries === id ? ' is-active' : '');
      b.textContent = label;
      b.addEventListener('click', () => { state.gachaSeries = id; showGacha(); });
      tabs.append(b);
    }
  }
  $('gacha-series-name').textContent = state.gachaSeries === 'regular'
    ? `通常シリーズ（全${CATS.length}匹）`
    : `${limited.name}（全${limited.cats.length}匹）`;
  renderGachaButton();
  showScreen('gacha');
}

function renderGachaButton() {
  renderCoins();
  // 画面に出す確率は、実際に使っている数字から作る（書きかえ忘れを防ぐ）
  $('gacha-rate-text').textContent = GACHA_RATES.map(([r, p]) => `${r} ${p}%`).join('・');
  const coins = state.record.coins;
  const enough = coins >= GACHA_COST;
  $('btn-draw').disabled = !enough;
  $('gacha-need').textContent = enough
    ? `あと${Math.floor(coins / GACHA_COST)}回引けるよ`
    : `あと${GACHA_COST - coins}コインで引ける（問題に正解するとたまるよ）`;
}

function drawOnce() {
  const result = drawGacha(state.record, gachaPool());
  if (!result) {
    renderGachaButton();
    return;
  }
  renderCoins();
  pushToCloud();
  const { cat, isNew, fragments } = result;

  // カプセルがゆれて → 開いて → カードが出る
  const overlay = $('gacha-overlay');
  const capsule = $('gacha-capsule');
  const reveal = $('gacha-reveal');
  const capsuleColors = { N: ['#ff8fa3', '#7bc4ff', '#9be37a', '#ffb347'], R: ['#9fb3cf'], SR: ['#ff6ad5'] };
  const colors = capsuleColors[cat.rarity];
  capsule.style.setProperty('--capsule', colors[Math.floor(Math.random() * colors.length)]);
  capsule.className = 'gacha-capsule' + (cat.rarity === 'R' ? ' glow-r' : cat.rarity === 'SR' ? ' glow-sr' : '');
  capsule.hidden = false;
  reveal.hidden = true;
  overlay.hidden = false;
  if (state.record.settings.sound) playCorrect();

  clearTimeout(state.gachaTimer);
  state.gachaTimer = setTimeout(() => {
    capsule.classList.add('is-open');
    state.gachaTimer = setTimeout(() => {
      capsule.hidden = true;
      const head = cat.rarity === 'SR' ? '✨ SR ✨' : cat.rarity === 'R' ? 'R！' : '';
      $('gacha-label').innerHTML = isNew
        ? `${head ? head + '<br>' : ''}NEW！ なかまになった！`
        : `${head ? head + '<br>' : ''}ダブり！<small>${cat.rarity}のかけら +${fragments}（いま ${state.record.fragments[cat.rarity]}個・${FRAGMENTS_TO_EXCHANGE[cat.rarity]}個で${cat.rarity}と交換）</small>`;
      $('gacha-card').innerHTML = catCardHTML(cat);
      $('btn-draw-again').disabled = state.record.coins < GACHA_COST;
      $('btn-draw-again').textContent = state.record.coins < GACHA_COST ? 'コインが足りない' : `もう1回（${GACHA_COST}コイン）`;
      reveal.hidden = false;
      overlay.scrollTop = 0;
      if (state.record.settings.sound) playCorrect();
    }, 450);
  }, 950);
}

function closeGachaOverlay() {
  clearTimeout(state.gachaTimer);
  $('gacha-overlay').hidden = true;
}

// ---------- ネコ図鑑 ----------

function showZukan() {
  ensureCollection(state.record);
  const list = $('zukan-list');
  list.innerHTML = '';
  const sections = [{ name: `通常シリーズ`, cats: CATS }, ...LIMITED_SERIES.map(s => ({ name: s.name, cats: s.cats }))];
  for (const sec of sections) {
    const wrap = document.createElement('section');
    const title = document.createElement('h3');
    title.className = 'zukan-section-title';
    title.textContent = `${sec.name}　${ownedCount(state.record, sec.cats)}/${sec.cats.length}`;
    const grid = document.createElement('div');
    grid.className = 'zukan-grid';
    for (const cat of sec.cats) {
      const n = state.record.collection[cat.id] || 0;
      const cell = document.createElement('button');
      cell.className = `zukan-cell ${cat.rarity.toLowerCase()}` + (n ? '' : ' is-locked');
      cell.setAttribute('aria-label', n ? cat.name : `No.${cat.id} まだ持っていない`);
      cell.innerHTML = buildCatSVG(cat, { noBg: !n })
        + `<span class="zukan-no">${cat.id}</span>`
        + (n > 1 ? `<span class="zukan-count">×${n}</span>` : '')
        + (state.record.partner === cat.id ? '<span class="zukan-partner">⭐</span>' : '');
      cell.addEventListener('click', () => openCardDialog(cat));
      grid.append(cell);
    }
    wrap.append(title, grid);
    list.append(wrap);
  }
  $('zk-owned').textContent = ownedCount(state.record, allCats());
  $('zk-total').textContent = allCats().length;
  $('zk-fragments').textContent = RARITIES.map(r => `${r} ${state.record.fragments[r]}`).join('・');
  showScreen('zukan');
}

function openCardDialog(cat) {
  const owned = state.record.collection[cat.id] || 0;
  const view = $('card-view');
  const action = $('btn-card-action');
  if (owned) {
    view.innerHTML = catCardHTML(cat);
    $('card-note').textContent = `持っている数：${owned}枚`;
    const isPartner = state.record.partner === cat.id;
    action.textContent = isPartner ? '⭐ いまの相棒' : '相棒にする（ホームに出る）';
    action.disabled = isPartner;
    action.onclick = () => { setPartner(state.record, cat.id); pushToCloud(); openCardDialog(cat); };
  } else {
    const cost = FRAGMENTS_TO_EXCHANGE[cat.rarity];
    const have = state.record.fragments[cat.rarity];
    view.innerHTML = `<div class="locked-card"><div class="locked-art">${buildCatSVG(cat, { noBg: true })}</div><p>No.${String(cat.id).padStart(2, '0')}　${cat.rarity}</p><p>？？？</p></div>`;
    $('card-note').textContent = `${cat.rarity}のかけら ${cost}個で交換できる（いま ${have}個）`;
    action.textContent = have >= cost ? `${cat.rarity}のかけら${cost}個で交換する` : `${cat.rarity}のかけらが足りない`;
    action.disabled = have < cost;
    action.onclick = () => {
      if (exchangeFragments(state.record, cat)) {
        pushToCloud();
        openCardDialog(cat);
      }
    };
  }
  $('card-dialog').hidden = false;
}

function closeCardDialog() {
  $('card-dialog').hidden = true;
  if ($('screen-zukan').classList.contains('is-active')) showZukan();
}

// ---------- 単語一覧 ----------

// 単語と熟語で同じ画面を使う。上の「単語・熟語」で切り替える
const RANK_LABEL = { A: 'A　最頻出', B: 'B　頻出', C: 'C　標準' };
const IDIOM_TYPES = ['動詞の熟語', 'be動詞の熟語', '前置詞の熟語', '接続詞のような熟語', '会話表現'];
let wordListFilter = 'all';
let wordListKind = 'words'; // 'words' | 'idioms'

// 一覧の種類ごとのちがい
function listConfig() {
  if (wordListKind === 'idioms') {
    return {
      items: state.idioms, recs: state.record.idioms, unit: '個', title: '熟語一覧',
      text: it => it.idiom, sub: it => it.meaning, speakText: it => idiomSpeakText(it),
      // 熟語は種類ごとにまとめる
      groups: IDIOM_TYPES.map(t => ({ label: t, match: it => it.type === t })),
    };
  }
  return {
    items: state.words, recs: state.record.words, unit: '語', title: '単語一覧',
    text: w => w.word, sub: w => `${w.meaning}（${w.pos}）`, speakText: w => w.word,
    groups: ['A', 'B', 'C'].map(r => ({ label: RANK_LABEL[r], match: w => w.rank === r })),
  };
}

function itemStatus(recs, id) {
  const r = recs[id];
  if (!r) return 'new';
  return r.mastered ? 'mastered' : 'learning';
}

function showWordList() {
  const cfg = listConfig();
  const counts = { mastered: 0, learning: 0 };
  for (const it of cfg.items) {
    const s = itemStatus(cfg.recs, it.id);
    if (s !== 'new') counts[s]++;
  }
  $('wl-title').textContent = cfg.title;
  $('wl-total').textContent = cfg.items.length;
  $('wl-unit').textContent = cfg.unit;
  $('wl-mastered').textContent = counts.mastered;
  $('wl-learning').textContent = counts.learning;
  $('wl-hint').textContent = wordListKind === 'idioms' ? '熟語をタップすると発音が聞けます' : '単語をタップすると発音が聞けます';
  document.querySelectorAll('.wl-kind').forEach(b => b.classList.toggle('is-active', b.dataset.kind === wordListKind));
  renderWordList();
  showScreen('wordlist');
}

function renderWordList() {
  const cfg = listConfig();
  const q = $('wl-search').value.trim().toLowerCase();
  const list = $('wl-list');
  list.innerHTML = '';
  const badgeText = { mastered: '★覚えた', learning: '学習中', new: 'まだ' };
  let shown = 0;
  for (const group of cfg.groups) {
    const items = cfg.items.filter(it => group.match(it)
      && (wordListFilter === 'all' || itemStatus(cfg.recs, it.id) === wordListFilter)
      && (!q || cfg.text(it).toLowerCase().includes(q) || it.meaning.includes(q)));
    if (!items.length) continue;
    const head = document.createElement('h3');
    head.className = 'wl-rank';
    head.textContent = `${group.label}（${items.length}${cfg.unit}）`;
    list.append(head);
    const frag = document.createDocumentFragment();
    for (const it of items) {
      const st = itemStatus(cfg.recs, it.id);
      const row = document.createElement('button');
      row.className = 'wl-row';
      row.dataset.speak = cfg.speakText(it);
      const word = document.createElement('span');
      word.className = 'wl-word';
      word.textContent = cfg.text(it);
      const badge = document.createElement('span');
      badge.className = 'wl-badge is-' + st;
      badge.textContent = badgeText[st];
      const meaning = document.createElement('span');
      meaning.className = 'wl-meaning';
      meaning.textContent = cfg.sub(it);
      row.append(word, badge, meaning);
      frag.append(row);
    }
    list.append(frag);
    shown += items.length;
  }
  if (!shown) {
    const p = document.createElement('p');
    p.className = 'wl-empty';
    p.textContent = '見つかりませんでした';
    list.append(p);
  }
}

// ---------- 文カード ----------

function showCards() {
  const open = unlockedChapterIds(state.chapters, state.sentences, state.record);
  const recs = state.record.sentences;
  const list = $('cards-list');
  list.innerHTML = '';
  let mastered = 0;

  for (const c of state.chapters) {
    const section = document.createElement('section');
    const head = document.createElement('h3');
    head.className = 'chapter-head';
    const isOpen = open.includes(c.id);
    const cleared = isOpen && isChapterCleared(c.id, state.sentences, state.record);
    head.textContent = `第${c.id}章 ${isOpen ? c.title : '？？？'}`;
    const st = document.createElement('span');
    st.className = 'chapter-state';
    st.textContent = cleared ? '✓ クリア' : isOpen ? '進行中' : '🔒';
    head.append(st);
    if (!isOpen) head.classList.add('chapter-locked');
    section.append(head);

    if (isOpen) {
      for (const s of state.sentences.filter(x => x.chapter === c.id)) {
        const r = recs[s.id];
        const card = document.createElement('div');
        if (r && r.mastered) mastered++;
        if (!r) {
          card.className = 's-card is-unseen';
          card.textContent = 'まだ出会っていない文';
        } else {
          card.className = 's-card' + (r.mastered ? ' is-mastered' : '');
          const en = document.createElement('p');
          en.className = 's-card-en';
          en.textContent = (r.mastered ? '★ ' : '') + s.en;
          const ja = document.createElement('p');
          ja.className = 's-card-ja';
          ja.textContent = s.ja;
          card.append(en, ja);
        }
        section.append(card);
      }
    }
    list.append(section);
  }
  $('cards-mastered').textContent = mastered;
  $('cards-total').textContent = state.sentences.length;
  showScreen('cards');
}

// ---------- 設定 ----------

function showSettings() {
  $('set-sound').checked = state.record.settings.sound;
  $('set-speak').checked = state.record.settings.autoSpeak;
  $('account-box').hidden = !state.user;
  if (state.user) $('account-name').textContent = state.user.name || 'あなた';
  showScreen('settings');
}

function openResetDialog() {
  $('reset-dialog').hidden = false;
  $('btn-reset-cancel').focus();
}

function closeResetDialog() {
  $('reset-dialog').hidden = true;
}

function confirmReset() {
  state.record = resetRecord(state.record);
  closeResetDialog();
  pushToCloud();
  showHome();
}

// ---------- アカウント ----------

// Firebase の設定があればログインが必要（設定が空ならログインなしで端末だけに記録）
function accountsRequired() {
  return !!FIREBASE_CONFIG;
}

function useAccount(user) {
  state.user = { uid: user.uid, name: user.name || '' };
  state.synced = false;
  setStorageUser(user.uid);
  setLastUser(state.user);
  state.record = loadRecord();
}

function showLogin(message = '') {
  $('login-error').textContent = message;
  $('login-error').hidden = !message;
  $('btn-login').disabled = false;
  $('btn-login').textContent = 'はじめる';
  showScreen('login');
}

async function submitLogin(e) {
  e.preventDefault();
  const loginId = $('login-id').value.trim().toLowerCase();
  const password = $('login-password').value;
  if (!cloudEnabled()) {
    showLogin('インターネットにつないでから、もう一度ためしてね。');
    return;
  }
  $('btn-login').disabled = true;
  $('btn-login').textContent = 'ログイン中…';
  try {
    await cloudLoginStudent(loginId, password);
    // この後の処理は onAuthStateChanged（handleAuthChange）で行う
  } catch (err) {
    showLogin(cloudErrorMessage(err));
  }
}

// ログイン状態が決まったとき・変わったときに Firebase から呼ばれる
async function handleAuthChange(fbUser) {
  if (!fbUser) {
    if (state.user) logoutLocal();
    else showLogin();
    return;
  }
  if (!state.user || state.user.uid !== fbUser.uid) {
    useAccount({ uid: fbUser.uid });
    $('login-password').value = '';
    showHome();
  }
  await syncFromCloud();
}

// Firebase の記録と端末の記録をまとめる。電波がなければ何もしない（次の送信の前にもう一度ためす）
async function syncFromCloud() {
  if (!state.user || !cloudEnabled()) return false;
  const uid = state.user.uid;
  try {
    const profile = await cloudFetchProfile(uid);
    if (!profile || !profile.active) {
      await cloudLogout();
      logoutLocal('このアカウントは使えなくなりました。先生に聞いてね。');
      return false;
    }
    state.user.name = profile.name;
    setLastUser(state.user);

    // 期間限定ガチャの開始・終了（読めなくても学習には関係ないので無視して続ける）
    try {
      state.activeSeries = await cloudFetchActiveSeries();
      saveActiveSeries(state.activeSeries);
    } catch (e) { /* ルール未設定・電波なしなど */ }

    const remote = await cloudFetchProgress(uid);
    if (state.user?.uid !== uid) return false; // 待っている間にログアウトした
    let merged;
    if (remote) {
      merged = mergeRecords(state.record, remote);
    } else {
      // まだ記録がないアカウント：ログイン機能を入れる前にこの端末で遊んだ記録があれば引き継ぐ
      const legacy = takeLegacyRecord();
      if (legacy) legacy.updatedAt = Date.now();
      merged = legacy ? mergeRecords(state.record, legacy) : state.record;
    }
    state.record = merged;
    saveRecord(state.record);
    state.synced = true;

    // 端末の方が新しければ送る（pushToCloud からも呼ばれるので、ここでは直接送る）
    if (!remote || merged.updatedAt > remote.updatedAt) {
      await cloudPushRecord(uid, state.record, Object.keys(state.record.usage));
      state.dirtyDates.clear();
      state.lastPushAt = Date.now();
    }
    if ($('screen-home').classList.contains('is-active')) showHome();
    return true;
  } catch (e) {
    return false;
  }
}

// 学習記録を Firebase に送る。送れなくても、端末には保存してあるので次の機会に送る
async function pushToCloud({ allDates = false } = {}) {
  if (!state.user || !cloudEnabled()) return;
  if (state.pushing) return state.pushing;
  state.pushing = (async () => {
    try {
      if (!state.synced && !(await syncFromCloud())) return;
      const dates = allDates ? Object.keys(state.record.usage) : [...state.dirtyDates, localDate()];
      if (!state.user) return;
      await cloudPushRecord(state.user.uid, state.record, [...new Set(dates)]);
      state.dirtyDates.clear();
      state.lastPushAt = Date.now();
    } catch (e) {
      // 電波がない・無料枠の上限など。次のセットのときにまた送る
    } finally {
      state.pushing = null;
    }
  })();
  return state.pushing;
}

function openLogoutDialog() {
  $('logout-dialog').hidden = false;
  $('btn-logout-cancel').focus();
}

function closeLogoutDialog() {
  $('logout-dialog').hidden = true;
}

async function confirmLogout() {
  $('btn-logout-ok').disabled = true;
  await pushToCloud();
  try { await cloudLogout(); } catch (e) { /* 電波がなくても端末ではログアウトする */ }
  $('btn-logout-ok').disabled = false;
  closeLogoutDialog();
  logoutLocal();
}

function logoutLocal(message = '') {
  state.user = null;
  state.synced = false;
  setLastUser(null);
  setStorageUser(null);
  state.record = emptyRecord();
  showLogin(message);
}

// ---------- 使用時間 ----------
// アプリが画面に出ていて、1分以内に操作があった時間だけを数える

function startUsageTracking() {
  let lastInteraction = Date.now();
  let lastTick = Date.now();
  let ticks = 0;
  const noteInteraction = () => { lastInteraction = Date.now(); };
  ['pointerdown', 'keydown', 'touchstart'].forEach(type =>
    document.addEventListener(type, noteInteraction, { passive: true, capture: true }));

  setInterval(() => {
    const now = Date.now();
    const elapsed = Math.min(now - lastTick, USAGE_TICK_MS * 2);
    lastTick = now;
    if (document.visibilityState !== 'visible') return;
    if (now - lastInteraction > IDLE_LIMIT_MS) return;
    if ($('screen-login').classList.contains('is-active')) return;
    addUsageSeconds(state.record, Math.round(elapsed / 1000));
    state.dirtyDates.add(localDate());
    if (++ticks % 6 === 0) saveRecord(state.record); // 30秒ごとに端末へ保存
  }, USAGE_TICK_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      lastTick = Date.now();
      lastInteraction = Date.now();
      return;
    }
    // アプリを閉じた・切り替えたとき
    pruneUsage(state.record);
    saveRecord(state.record);
    if (Date.now() - state.lastPushAt > PUSH_INTERVAL_MS) pushToCloud();
  });
}

// ---------- 起動 ----------

async function init() {
  $('login-form').addEventListener('submit', submitLogin);
  $('btn-logout').addEventListener('click', openLogoutDialog);
  $('btn-logout-cancel').addEventListener('click', closeLogoutDialog);
  $('btn-logout-ok').addEventListener('click', confirmLogout);
  $('logout-dialog').addEventListener('click', e => { if (e.target === e.currentTarget) closeLogoutDialog(); });

  $('btn-start').addEventListener('click', () => startSet('words'));
  $('btn-start-idiom').addEventListener('click', () => startSet('idioms'));
  document.querySelectorAll('.wl-kind').forEach(btn => btn.addEventListener('click', () => {
    wordListKind = btn.dataset.kind;
    $('wl-search').value = '';
    showWordList();
  }));
  $('btn-start-story').addEventListener('click', () => startSet('sentences'));
  $('btn-cards').addEventListener('click', showCards);
  $('btn-wordlist').addEventListener('click', showWordList);
  $('btn-wordlist-back').addEventListener('click', showHome);
  $('wl-search').addEventListener('input', renderWordList);
  document.querySelectorAll('.wl-filter').forEach(btn => btn.addEventListener('click', () => {
    wordListFilter = btn.dataset.filter;
    document.querySelectorAll('.wl-filter').forEach(b => b.classList.toggle('is-active', b === btn));
    renderWordList();
  }));
  $('wl-list').addEventListener('click', e => {
    const row = e.target.closest('.wl-row');
    if (row) speak(row.dataset.speak);
  });
  $('btn-cards-back').addEventListener('click', showHome);
  $('btn-next').addEventListener('click', nextQuestion);
  $('btn-again').addEventListener('click', () => (state.mode === 'challenge' ? startChallenge() : startSet()));
  $('btn-challenge').addEventListener('click', startChallenge);
  $('btn-coins').addEventListener('click', showGacha);
  $('btn-gacha').addEventListener('click', showGacha);
  $('btn-gacha-back').addEventListener('click', showHome);
  $('btn-draw').addEventListener('click', drawOnce);
  $('btn-draw-again').addEventListener('click', drawOnce);
  $('btn-gacha-close').addEventListener('click', () => { closeGachaOverlay(); renderGachaButton(); });
  $('btn-gacha-to-zukan').addEventListener('click', () => { closeGachaOverlay(); showZukan(); });
  $('btn-zukan').addEventListener('click', showZukan);
  $('partner-box').addEventListener('click', showZukan);
  $('btn-zukan-back').addEventListener('click', showHome);
  $('btn-card-close').addEventListener('click', closeCardDialog);
  $('card-dialog').addEventListener('click', e => { if (e.target === e.currentTarget) closeCardDialog(); });
  $('btn-home').addEventListener('click', showHome);
  $('btn-quit').addEventListener('click', showHome);
  $('btn-speak').addEventListener('click', () => speak(currentSpeakText()));
  $('spell-form').addEventListener('submit', answerSpelling);

  $('btn-settings').addEventListener('click', showSettings);
  $('btn-settings-back').addEventListener('click', showHome);
  $('set-sound').addEventListener('change', e => {
    updateSettings(state.record, { sound: e.target.checked });
    if (e.target.checked) { unlockAudio(); playCorrect(); }
  });
  $('set-speak').addEventListener('change', e => updateSettings(state.record, { autoSpeak: e.target.checked }));
  $('btn-reset').addEventListener('click', openResetDialog);
  $('btn-reset-cancel').addEventListener('click', closeResetDialog);
  $('btn-reset-ok').addEventListener('click', confirmReset);
  $('reset-dialog').addEventListener('click', e => { if (e.target === e.currentTarget) closeResetDialog(); });

  startUsageTracking();

  if (!accountsRequired()) {
    // ログインなしで使う（Firebase の設定が空のとき）
    setStorageUser(null);
    state.record = loadRecord();
    showHome();
  } else {
    // 前回ログインした生徒がいれば、Firebase の返事を待たずにすぐホームを出す（電波がなくても使える）
    const last = getLastUser();
    if (last) {
      useAccount(last);
      showHome();
    } else {
      showLogin();
    }
    if (cloudEnabled()) {
      cloudInit();
      cloudAuth().onAuthStateChanged(handleAuthChange);
    }
  }

  try {
    const [wordsRes, sentRes, idiomRes] = await Promise.all([fetch('data/words.json'), fetch('data/sentences.json'), fetch('data/idioms.json')]);
    if (!wordsRes.ok || !sentRes.ok || !idiomRes.ok) throw new Error('load failed');
    state.words = await wordsRes.json();
    const story = await sentRes.json();
    state.chapters = story.chapters;
    state.sentences = story.sentences;
    state.idioms = await idiomRes.json();
    $('btn-start').textContent = '単語スタート';
    $('btn-start').disabled = false;
    $('btn-start-idiom').disabled = false;
    $('btn-start-story').disabled = false;
    $('idiom-total').textContent = state.idioms.length;
    renderStoryCard();
    renderChallengeCard();
  } catch (e) {
    $('btn-start').textContent = 'スタート';
    $('home-error').textContent = '単語データを読み込めませんでした。ページを再読み込みしてください。';
    $('home-error').hidden = false;
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
