// 画面の切り替えとクイズの進行

const NEXT_DELAY_MS = 800;
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
  weak: false,       // ニガテだけのセットか
  words: [],         // いま選んでいる種類の単語（中学・高校・TOEIC・資格）
  wordSet: null,     // state.words がどの種類か（読みこみ前は null）
  wordCache: {},     // 一度読みこんだ種類の単語
  idioms: [],
  chapters: [],
  sentences: [],
  placed: [],        // 文章の並べ替えで、並べたタイルの番号
  openBefore: 0,     // セット開始時に開いていた章の数
  missionsBefore: [], // セット開始時に達成済みだったミッション
  challengePool: [], // 1分チャレンジでこれから出す単語
  challengeEnd: 0,
  challengeTimer: null,
  gachaTab: 'regular',    // ガチャ画面で選んでいるガチャ：'regular'（通常）か 'limited'（期間限定）
  gachaTimer: null,
  gachaConfig: loadGachaConfig(), // 先生が設定した復刻（{ rerunCat, rerunUntil }）
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

// ---------- 単語の種類 ----------

// state.words の種類の記録の置き場所（'words' / 'wordsHigh' など）
// 読みこみ中に設定が変わっても、出している単語と記録の場所がずれないよう state.wordSet を優先する
function wordKey() {
  return WORD_SETS[state.wordSet || wordSetOf(state.record)].key;
}

function wordRecs() {
  return state.record[wordKey()];
}

// 設定で選んでいる種類の単語を読みこむ（読みこみ済みなら何もしない）。読みこめなければ例外
async function loadWordSet() {
  const set = wordSetOf(state.record);
  if (state.wordSet === set) return;
  if (!state.wordCache[set]) {
    const res = await fetch(WORD_SETS[set].file);
    if (!res.ok) throw new Error('load failed');
    state.wordCache[set] = await res.json();
  }
  state.words = state.wordCache[set];
  state.wordSet = set;
}

// 種類が変わっていたら読みこみ直してホームを描き直す（同期で別の端末の設定が来たときなど）
async function ensureWordSet() {
  if (state.wordSet === wordSetOf(state.record)) return;
  $('btn-start').disabled = true;
  try {
    await loadWordSet();
    $('home-error').hidden = true;
  } catch (e) {
    $('home-error').textContent = '単語データを読み込めませんでした。インターネットにつないでから開き直してください。';
    $('home-error').hidden = false;
    return;
  }
  $('btn-start').disabled = false;
  if ($('screen-home').classList.contains('is-active')) showHome();
}

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

  // メーターは設定で選んでいる種類の単語（中学以外は「覚えた単語（高校）」のように種類も出す）
  const set = WORD_SETS[wordSetOf(state.record)];
  const goal = set.goal;
  const mastered = countMastered(state.record, set.key);
  $('meter-set').textContent = set.key === 'words' ? '' : `（${set.label}）`;
  $('mastered-count').textContent = mastered;
  $('goal-count').textContent = goal;
  $('remaining-count').textContent = Math.max(goal - mastered, 0);
  $('idiom-mastered').textContent = countMastered(state.record, 'idioms');
  $('idiom-total').textContent = state.idioms.length;
  renderStoryCard();
  renderChallengeCard();
  renderBattleCard();
  renderMissions();
  renderCoins();
  renderPartner();
  const weak = weakCount('words') + weakCount('idioms');
  $('weak-count').textContent = weak;
  $('btn-weak').hidden = weak === 0;
  showScreen('home');
  // 画面が出てからバーを伸ばす（アニメーションさせるため）
  requestAnimationFrame(() => {
    $('meter-fill').style.width = Math.min(mastered / goal, 1) * 100 + '%';
  });
  if (state.words.length) ensureWordSet(); // 単語を読みこんだあとで種類が変わっていたら読みこみ直す
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
  $('story-chapter').textContent = `第${p.chapter.id}章 ${p.done}/${p.total}文`;
}

function renderChallengeCard() {
  const met = Object.keys(wordRecs()).length;
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

// weak：ニガテ（前回まちがえた・「わからない」）だけで出す（単語・熟語のみ）
function startSet(mode = state.mode, { weak = false } = {}) {
  unlockAudio();
  state.mode = mode;
  state.weak = weak && weakCount(mode) > 0;
  if (state.weak) {
    state.questions = mode === 'idioms'
      ? buildWeakSet('idioms', state.idioms, state.record)
      : buildWeakSet(wordKey(), state.words, state.record);
  } else if (mode === 'sentences') {
    state.openBefore = unlockedChapterIds(state.chapters, state.sentences, state.record).length;
    state.questions = buildSentenceSet(state.chapters, state.sentences, state.record);
  } else if (mode === 'idioms') {
    state.questions = buildIdiomSet(state.idioms, state.record);
  } else {
    state.questions = buildSet(state.words, wordRecs());
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
  const recs = wordRecs();
  const met = state.words.filter(w => recs[w.id]);
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
    const recs = wordRecs();
    const met = state.words.filter(w => recs[w.id]);
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
  // 「わからない」は単語・熟語だけ（文章と1分チャレンジにはない）
  $('btn-dunno').hidden = !!q.sentence || state.mode === 'challenge';
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
    const hint = $('spell-hint');
    hint.hidden = false;
    hint.innerHTML = '';
    // 語ごとに区切って、1つの語の途中で折り返さないようにする（資格の用語は2〜3語のものがある）
    spellingHint(q.word.word).split(' ').forEach((part, i) => {
      if (i) hint.append(' ');
      const span = document.createElement('span');
      span.textContent = part;
      hint.append(span);
    });
    hint.classList.toggle('is-long', q.word.word.length > 10);
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

// 「わからない」：不正解と同じあつかい（コンボは切れる・次のセットでまた出る）で、すぐ答えを見せる
function answerDunno() {
  if (state.answered) return;
  const q = state.questions[state.index];
  const box = $('choices');
  box.classList.add('is-locked');
  if (q.idiom) {
    box.querySelector('[data-answer="1"]').classList.add('is-correct');
    if (q.level === 3) renderIdiomBlank(q.idiom, true);
  } else if (q.level === 3) {
    const input = $('spell-input');
    input.value = q.word.word;
    input.readOnly = true;
    input.classList.add('is-dunno');
    $('btn-spell').hidden = true;
    input.blur();
  } else {
    box.querySelector(`[data-id="${q.word.id}"]`).classList.add('is-correct');
  }
  finishAnswer(false, true);
}

// 正解・不正解の共通処理（dunno：「わからない」を押した）
function finishAnswer(isCorrect, dunno = false) {
  state.answered = true;
  $('btn-dunno').hidden = true;
  const q = state.questions[state.index];
  const settings = state.record.settings;

  if (state.mode === 'challenge') {
    finishChallengeAnswer(isCorrect);
    return;
  }

  $('progress-fill').style.width = ((state.index + 1) / state.questions.length) * 100 + '%';
  if (q.sentence) recordAnswer(state.record, q.sentence.id, isCorrect, q.practice, 'sentences');
  else if (q.idiom) recordAnswer(state.record, q.idiom.id, isCorrect, q.practice, 'idioms', dunno);
  else recordAnswer(state.record, q.word.id, isCorrect, q.practice, wordKey(), dunno);

  // 「わからない」は正直に押したので、ブーという音は鳴らさない
  if (settings.sound && !dunno) isCorrect ? playCorrect() : playWrong();
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
  $('btn-again').textContent = mode === 'challenge' ? 'もう一回'
    : state.weak && weakCount(mode) > 0 ? `ニガテをもう1セット（あと${weakCount(mode)}問）` : 'もう1セット';
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
  const missionCoins = newMissions * COIN_PER_MISSION;
  const label = $('r-stat3-label');
  if (mode === 'idioms' || mode === 'sentences') {
    // 熟語・ストーリー：経験値フード（正解1問で小1個、1セット終えると中1個）。ミッションのコインは別にもらえる
    const s = state.correctCount * FOOD_PER_CORRECT;
    const m = FOOD_PER_SET;
    addFood(state.record, s, m);
    if (missionCoins) addCoins(state.record, missionCoins);
    label.textContent = '🍖 フード';
    $('r-coins').textContent = `小+${s} 中+${m}`;
    if (missionCoins) {
      const g = $('r-growth');
      g.textContent = (g.textContent ? g.textContent + '　' : '') + `🪙 ミッション +${missionCoins}コイン`;
      g.hidden = false;
    }
  } else {
    // 単語・1分チャレンジ：コイン（正解1問ごと＋セットを終えたボーナス＋新しく達成したミッション）
    const earned = (mode === 'challenge' ? COIN_PER_CHALLENGE : state.correctCount * COIN_PER_CORRECT + COIN_PER_SET) + missionCoins;
    addCoins(state.record, earned);
    label.innerHTML = '<span class="coin coin-small" aria-hidden="true"></span>コイン';
    $('r-coins').textContent = `+${earned}`;
  }
  $('r-coins').classList.toggle('is-food', mode === 'idioms' || mode === 'sentences');
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

// 期間限定ガチャ：3日ごとに入れかわる。判定はインターネット上の時刻で行う（js/limited.js）
// 時刻を確かめられないとき（電波がないなど）は null
function limitedNow() {
  const ms = serverNow();
  if (ms === null) return null;
  return { ms, index: limitedPeriodIndex(ms), cats: currentLimitedCats(ms, state.gachaConfig) };
}

// 「のこり 2日 5時間」
function formatRemaining(ms) {
  const h = Math.max(0, Math.floor(ms / 3600e3));
  const d = Math.floor(h / 24);
  if (d > 0) return `のこり ${d}日 ${h % 24}時間`;
  if (h > 0) return `のこり ${h}時間`;
  return `のこり ${Math.max(1, Math.ceil(ms / 60e3))}分`;
}

async function showGacha(tab) {
  if (typeof tab === 'string') state.gachaTab = tab;
  renderGachaScreen();
  showScreen('gacha');
  // 開くたびにインターネット上の時刻を取り直してから、期間限定の表示を更新する
  await fetchServerTime();
  if ($('screen-gacha').classList.contains('is-active')) renderGachaScreen();
}

function renderGachaScreen() {
  const tabs = $('gacha-tabs');
  tabs.hidden = false;
  tabs.innerHTML = '';
  for (const [id, label] of [['regular', '通常ガチャ'], ['limited', '期間限定ガチャ']]) {
    const b = document.createElement('button');
    b.className = 'gacha-tab' + (id === 'limited' ? ' is-limited' : '') + (state.gachaTab === id ? ' is-active' : '');
    b.textContent = label;
    b.addEventListener('click', () => { state.gachaTab = id; renderGachaScreen(); });
    tabs.append(b);
  }

  const info = $('limited-info');
  if (state.gachaTab === 'regular') {
    $('gacha-series-name').textContent = `通常シリーズ（全${CATS.length}匹）`;
    info.hidden = true;
  } else {
    $('gacha-series-name').textContent = 'SR が出たら、期間限定ネコ確定！';
    info.hidden = false;
    const now = limitedNow();
    if (!now) {
      $('limited-art').innerHTML = '';
      $('limited-title').textContent = 'インターネットにつないでね';
      $('limited-time').textContent = '期間限定ガチャは、電波があるときだけ引けます';
    } else if (!now.cats.length) {
      $('limited-art').innerHTML = '';
      $('limited-title').textContent = 'いまは期間限定ネコがいません';
      $('limited-time').textContent = '';
    } else {
      const cat = now.cats[0];
      $('limited-art').innerHTML = buildCatSVG(cat);
      $('limited-title').textContent = now.cats.length > 1
        ? `${cat.name}　＋復刻：${now.cats.slice(1).map(c => c.name).join('・')}`
        : `第${now.index + 1}弾　${cat.name}`;
      $('limited-time').textContent = formatRemaining(limitedPeriodEndMs(now.index) - now.ms);
    }
  }
  renderGachaButton();
}

function renderGachaButton() {
  renderCoins();
  // 画面に出す確率は、実際に使っている数字から作る（書きかえ忘れを防ぐ）
  $('gacha-rate-text').textContent = GACHA_RATES.map(([r, p]) => `${r} ${p}%`).join('・');
  const coins = state.record.coins;
  const enough = coins >= GACHA_COST;
  const now = state.gachaTab === 'limited' ? limitedNow() : null;
  const limitedClosed = state.gachaTab === 'limited' && (!now || !now.cats.length);
  $('btn-draw').disabled = !enough || limitedClosed;
  $('gacha-need').textContent = limitedClosed ? ''
    : enough ? `あと${Math.floor(coins / GACHA_COST)}回引けるよ`
    : `あと${GACHA_COST - coins}コインで引ける（問題に正解するとたまるよ）`;
}

async function drawOnce() {
  let pool = CATS;
  if (state.gachaTab === 'limited') {
    // 引く直前に、もう一度インターネット上の時刻を確かめる（期間が終わっていないか）
    $('btn-draw').disabled = true;
    $('btn-draw-again').disabled = true;
    const ms = await fetchServerTime();
    const cats = ms === null ? [] : currentLimitedCats(ms, state.gachaConfig);
    if (!cats.length) {
      closeGachaOverlay();
      renderGachaScreen();
      return;
    }
    pool = limitedGachaPool(cats);
  }
  const result = drawGacha(state.record, pool);
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
  const capsuleColors = { N: ['#ff8fa3', '#7bc4ff', '#9be37a', '#ffb347'], R: ['#9fb3cf'], SR: [cat.limited ? '#c8102e' : '#ff6ad5'] };
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
      const head = cat.limited ? '✨ 期間限定 SR ✨' : cat.rarity === 'SR' ? '✨ SR ✨' : cat.rarity === 'R' ? 'R！' : '';
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
  // 期間限定は、期間が始まったネコと持っているネコだけ並べる（これから出るネコは見せない）
  const revealed = revealedLimitedCats(serverNow() ?? Date.now());
  const limitedShown = LIMITED_CATS.filter(c => revealed.includes(c) || state.record.collection[c.id] > 0);
  const sections = [{ name: '通常シリーズ', cats: CATS }];
  if (limitedShown.length) sections.push({ name: '期間限定（歴史人物ネコ）', cats: limitedShown });
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
      cell.className = `zukan-cell ${cat.rarity.toLowerCase()}` + (cat.limited ? ' limited' : '') + (n ? '' : ' is-locked');
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
  $('zk-owned').textContent = ownedCount(state.record, [...CATS, ...limitedShown]);
  $('zk-total').textContent = CATS.length + limitedShown.length;
  $('zk-fragments').textContent = RARITIES.map(r => `${r} ${state.record.fragments[r]}`).join('・');
  showScreen('zukan');
}

function openCardDialog(cat) {
  const owned = state.record.collection[cat.id] || 0;
  const view = $('card-view');
  const action = $('btn-card-action');
  action.hidden = false;
  if (!owned && cat.limited) {
    // 期間限定のネコは、かけらでは交換できない（ガチャでしか手に入らない）
    view.innerHTML = `<div class="locked-card"><div class="locked-art">${buildCatSVG(cat, { noBg: true })}</div><p>No.${cat.id}　限定SR</p><p>？？？</p></div>`;
    const now = limitedNow();
    $('card-note').textContent = now && now.cats.includes(cat) ? '期間限定ガチャで出るかも！' : '';
    action.hidden = true;
    $('card-dialog').hidden = false;
    return;
  }
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

// ---------- ネコ（もちもの・パーティ・育成） ----------

let catSort = 'level';   // 'level' | 'rarity' | 'id'
let pickSlot = -1;       // パーティの入れかえで選んでいる場所（-1 = 選んでいない）
let detailUid = null;    // 詳細を開いているネコ

const RARITY_ORDER = { SR: 0, R: 1, N: 2 };

function renderFoodPills() {
  const f = state.record.food;
  for (const p of ['cats', 'cd']) {
    $(`${p}-food-s`).textContent = f.s;
    $(`${p}-food-m`).textContent = f.m;
  }
}

let catsReturnTo = 'home'; // ネコ画面の「もどる」の行き先（対戦のステージ一覧から来たときは 'stages'）

function showCats(from) {
  if (from === 'home' || from === 'stages') catsReturnTo = from;
  ensureCollection(state.record);
  pickSlot = -1;
  renderCats();
  showScreen('cats');
}

function renderCats() {
  const record = state.record;
  renderFoodPills();
  // パーティ：左から5問目…1問目（右はしがリーダー）
  const row = $('party-row');
  row.innerHTML = '';
  const party = partyInstances(record);
  for (let slot = PARTY_SIZE - 1; slot >= 0; slot--) {
    const inst = party[slot];
    const b = document.createElement('button');
    b.className = 'party-slot' + (pickSlot === slot ? ' is-picking' : '');
    b.innerHTML = (inst ? catIconHTML(inst, { small: true, extra: slot === 0 ? '<span class="ci-crown">👑</span>' : '' }) : '<span class="party-empty">＋</span>')
      + `<span class="party-num">${slot + 1}問目</span>`;
    b.addEventListener('click', () => {
      pickSlot = pickSlot === slot ? -1 : slot;
      renderCats();
    });
    row.append(b);
  }
  $('party-hint').textContent = pickSlot >= 0 ? `${pickSlot + 1}問目に入れるネコをタップ` : '右はしがリーダー👑';
  $('party-hint').classList.toggle('is-picking', pickSlot >= 0);

  document.querySelectorAll('.cat-sort').forEach(b => b.classList.toggle('is-active', b.dataset.sort === catSort));
  const cats = record.cats.slice().sort((a, b) => {
    const ca = findCat(a.id), cb = findCat(b.id);
    if (catSort === 'rarity') return (RARITY_ORDER[ca.rarity] - RARITY_ORDER[cb.rarity]) || (b.exp - a.exp) || (a.id - b.id);
    if (catSort === 'id') return (a.id - b.id) || (b.exp - a.exp);
    return (b.exp - a.exp) || (b.koban - a.koban) || (RARITY_ORDER[ca.rarity] - RARITY_ORDER[cb.rarity]) || (a.id - b.id);
  });
  const box = $('cat-box');
  box.innerHTML = '';
  for (const inst of cats) {
    const b = document.createElement('button');
    const inParty = record.party.includes(inst.uid);
    b.className = 'cat-cell' + (inParty ? ' in-party' : '');
    b.setAttribute('aria-label', findCat(inst.id).name);
    b.innerHTML = catIconHTML(inst);
    b.addEventListener('click', () => {
      if (pickSlot >= 0) {
        setPartySlot(record, pickSlot, inst.uid);
        pickSlot = -1;
        renderCats();
      } else {
        showCatDetail(inst.uid);
      }
    });
    box.append(b);
  }
  $('cat-box-empty').hidden = cats.length > 0;
}

function showCatDetail(uid) {
  detailUid = uid;
  renderCatDetail();
  showScreen('catdetail');
}

function renderCatDetail(levelUp = false) {
  const record = state.record;
  const inst = findInstance(record, detailUid);
  if (!inst) { showCats(); return; }
  const cat = findCat(inst.id);
  renderFoodPills();
  const st = catStats(inst);
  const lv = levelFromExp(inst.exp);
  $('cd-icon').innerHTML = catIconHTML(inst);
  $('cd-name').textContent = cat.name;
  $('cd-level').textContent = lv.level;
  const lvEl = $('cd-level');
  if (levelUp) { lvEl.classList.remove('pop'); void lvEl.offsetWidth; lvEl.classList.add('pop'); }
  const max = lv.level >= MAX_CAT_LEVEL;
  $('cd-xp-fill').style.width = max ? '100%' : `${(lv.into / lv.need) * 100}%`;
  const left = lv.need - lv.into;
  $('cd-xp-note').textContent = max ? 'レベルMAX！' : `次のLvまで あと${left}（小${Math.ceil(left / FOOD_EXP.s)}個ぶん）`;
  $('cd-kobans').innerHTML = Array.from({ length: MAX_KOBAN }, (_, i) => `<i class="${i < inst.koban ? 'on' : ''}"></i>`).join('');
  for (const k of ['hp', 'atk', 'rcv']) {
    $(`cd-${k}`).textContent = st[k].toLocaleString();
    $(`cd-${k}-bar`).style.width = Math.min(st[k] / STAT_MAX[k], 1) * 100 + '%';
  }
  const skill = CAT_SKILLS[inst.id];
  $('cd-skill').hidden = !skill;
  if (skill) $('cd-skill').innerHTML = `<b>とくせい（リーダーのとき）</b><br>${escapeHtml(skillText(skill))}`;

  const f = record.food;
  $('feed-s-note').textContent = `あと${f.s}個（+${FOOD_EXP.s}）`;
  $('feed-m-note').textContent = `あと${f.m}個（+${FOOD_EXP.m}）`;
  $('btn-feed-s').disabled = max || f.s <= 0;
  $('btn-feed-m').disabled = max || f.m <= 0;
  $('btn-feed-next').disabled = max || (f.s <= 0 && f.m <= 0);
  $('cd-food-hint').textContent = f.s + f.m === 0 ? 'フードは熟語とストーリーを解くともらえるよ' : '';

  const mats = mergeMaterials(record, inst.uid);
  $('btn-merge').disabled = inst.koban >= MAX_KOBAN || mats.length === 0;
  $('merge-note').textContent = inst.koban >= MAX_KOBAN ? '小判MAX' : mats.length ? `同じネコが${mats.length}匹いる` : '同じネコがいない';
  const inParty = record.party.includes(inst.uid);
  $('btn-party-toggle').textContent = inParty ? 'パーティから外す' : 'パーティに入れる';
  const isPartner = record.partner === inst.id;
  $('btn-partner').textContent = isPartner ? '相棒です' : '相棒にする';
  $('btn-partner').disabled = isPartner;
}

function feedDetail(size) {
  const r = size === 'next' ? feedToNextLevel(state.record, detailUid) : feedCat(state.record, detailUid, size);
  if (r > 0 && state.record.settings.sound) playCorrect();
  renderCatDetail(r > 0);
}

function openMergeDialog() {
  const inst = findInstance(state.record, detailUid);
  const mat = mergeMaterials(state.record, detailUid)[0];
  if (!inst || !mat) return;
  const back = Math.floor(mat.exp / 2);
  const m = Math.floor(back / FOOD_EXP.m), s = Math.floor((back % FOOD_EXP.m) / FOOD_EXP.s);
  $('merge-preview').innerHTML = `${catIconHTML(mat)}<span class="merge-arrow">→</span>${catIconHTML(inst)}`;
  $('merge-text').textContent = `Lv${levelFromExp(mat.exp).level}の${findCat(mat.id).name}を素材にします。素材のネコはいなくなり、小判が1つ増えます。`
    + (s + m ? `素材に使っていたフード（小${s}・中${m}）が戻ります。` : '');
  $('merge-dialog').hidden = false;
}

function confirmMerge() {
  const mat = mergeMaterials(state.record, detailUid)[0];
  $('merge-dialog').hidden = true;
  if (!mat) return;
  if (mergeCats(state.record, detailUid, mat.uid) && state.record.settings.sound) playCorrect();
  renderCatDetail(true);
}

function togglePartyFromDetail() {
  const record = state.record;
  if (record.party.includes(detailUid)) {
    removeFromParty(record, detailUid);
  } else {
    const party = partyInstances(record);
    const empty = party.findIndex(p => !p);
    if (empty < 0) {
      $('cd-food-hint').textContent = 'パーティがいっぱいです。ネコ画面でパーティの場所をタップして入れかえてね';
      return;
    }
    setPartySlot(record, empty, detailUid);
  }
  renderCatDetail();
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
    items: state.words, recs: wordRecs(), unit: '語', title: `単語一覧（${WORD_SETS[state.wordSet || 'junior'].label}）`,
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
  document.querySelectorAll('#screen-wordlist .wl-kind').forEach(b => b.classList.toggle('is-active', b.dataset.kind === wordListKind));
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

// ---------- ニガテ ----------

let weakKind = 'words'; // 'words' | 'idioms'

function weakList(kind) {
  return kind === 'idioms' ? weakItems(state.idioms, state.record.idioms) : weakItems(state.words, wordRecs());
}

function weakCount(kind) {
  return weakList(kind).length;
}

// kind を省くと、ニガテがある方を開く
function showWeak(kind) {
  if (!kind) kind = weakCount('words') || !weakCount('idioms') ? 'words' : 'idioms';
  weakKind = kind;
  const isIdiom = kind === 'idioms';
  const items = weakList(kind);
  const recs = state.record[kind];
  $('wk-count-words').textContent = weakCount('words');
  $('wk-count-idioms').textContent = weakCount('idioms');
  document.querySelectorAll('.wk-kind').forEach(b => b.classList.toggle('is-active', b.dataset.kind === kind));
  const start = $('btn-weak-start');
  start.hidden = items.length === 0;
  start.textContent = `この${isIdiom ? '熟語' : '単語'}だけでスタート（${Math.min(items.length, QUESTIONS_PER_SET)}問）`;
  $('wk-empty').hidden = items.length > 0;

  const list = $('wk-list');
  list.innerHTML = '';
  for (const it of items) {
    const r = recs[it.id];
    const row = document.createElement('button');
    row.className = 'wl-row';
    row.dataset.speak = isIdiom ? idiomSpeakText(it) : it.word;
    const word = document.createElement('span');
    word.className = 'wl-word';
    word.textContent = isIdiom ? it.idiom : it.word;
    const badge = document.createElement('span');
    badge.className = 'wl-badge is-weak';
    const miss = r.wrong - (r.dunno || 0);
    badge.textContent = [miss ? `×${miss}` : '', r.dunno ? `？${r.dunno}` : ''].filter(Boolean).join(' ');
    const meaning = document.createElement('span');
    meaning.className = 'wl-meaning';
    meaning.textContent = isIdiom ? it.meaning : `${it.meaning}（${it.pos}）`;
    row.append(word, badge, meaning);
    list.append(row);
  }
  showScreen('weak');
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
  renderWordSetOptions();
  showScreen('settings');
}

// 単語の種類のボタン（中学・高校・TOEIC・資格）。記録は種類ごとに残るので、いつ切りかえてもよい
function renderWordSetOptions() {
  const box = $('word-set-options');
  box.innerHTML = '';
  const current = wordSetOf(state.record);
  for (const id of WORD_SET_IDS) {
    const set = WORD_SETS[id];
    const b = document.createElement('button');
    b.className = 'word-set-option' + (id === current ? ' is-active' : '');
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', id === current);
    b.innerHTML = `<strong></strong><small></small>`;
    b.querySelector('strong').textContent = set.label;
    b.querySelector('small').textContent = `${set.goal}語`;
    b.addEventListener('click', () => chooseWordSet(id));
    box.append(b);
  }
  $('word-set-note').textContent = `いま：${WORD_SETS[current].name}。切りかえても、それぞれの記録は消えません`;
}

async function chooseWordSet(id) {
  if (wordSetOf(state.record) === id) return;
  updateSettings(state.record, { wordSet: id });
  renderWordSetOptions();
  pushToCloud();
  try {
    await loadWordSet();
  } catch (e) {
    $('word-set-note').textContent = '単語データを読み込めませんでした。インターネットにつないでからもう一度選んでください。';
  }
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

    // 期間限定ガチャの復刻の設定（読めなくても学習には関係ないので無視して続ける）
    try {
      state.gachaConfig = await cloudFetchGachaConfig();
      saveGachaConfig(state.gachaConfig);
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
      await cloudPushRanking(state.user.uid, state.record); // 変わったときだけ送る
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
  $('btn-dunno').addEventListener('click', answerDunno);
  $('btn-weak').addEventListener('click', () => showWeak());
  $('btn-weak-back').addEventListener('click', showHome);
  $('btn-weak-start').addEventListener('click', () => startSet(weakKind, { weak: true }));
  document.querySelectorAll('.wk-kind').forEach(btn => btn.addEventListener('click', () => showWeak(btn.dataset.kind)));
  $('wk-list').addEventListener('click', e => {
    const row = e.target.closest('.wl-row');
    if (row) speak(row.dataset.speak);
  });
  document.querySelectorAll('#screen-wordlist .wl-kind').forEach(btn => btn.addEventListener('click', () => {
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
  $('btn-again').addEventListener('click', () => {
    if (state.mode === 'challenge') startChallenge();
    else startSet(state.mode, { weak: state.weak && weakCount(state.mode) > 0 });
  });
  $('btn-challenge').addEventListener('click', startChallenge);
  $('btn-coins').addEventListener('click', showGacha);
  $('btn-gacha').addEventListener('click', showGacha);
  $('btn-gacha-back').addEventListener('click', showHome);
  $('btn-draw').addEventListener('click', drawOnce);
  $('btn-draw-again').addEventListener('click', drawOnce);
  $('btn-gacha-close').addEventListener('click', () => { closeGachaOverlay(); renderGachaButton(); });
  $('btn-gacha-to-zukan').addEventListener('click', () => { closeGachaOverlay(); showZukan(); });
  $('btn-zukan').addEventListener('click', showZukan);
  $('btn-cats').addEventListener('click', () => showCats('home'));
  $('btn-cats-back').addEventListener('click', () => { pushToCloud(); catsReturnTo === 'stages' ? showStages() : showHome(); });
  initBattleUI();
  $('btn-catdetail-back').addEventListener('click', showCats);
  document.querySelectorAll('.cat-sort').forEach(b => b.addEventListener('click', () => { catSort = b.dataset.sort; renderCats(); }));
  $('btn-feed-s').addEventListener('click', () => feedDetail('s'));
  $('btn-feed-m').addEventListener('click', () => feedDetail('m'));
  $('btn-feed-next').addEventListener('click', () => feedDetail('next'));
  $('btn-merge').addEventListener('click', openMergeDialog);
  $('btn-merge-cancel').addEventListener('click', () => { $('merge-dialog').hidden = true; });
  $('btn-merge-ok').addEventListener('click', confirmMerge);
  $('merge-dialog').addEventListener('click', e => { if (e.target === e.currentTarget) $('merge-dialog').hidden = true; });
  $('btn-party-toggle').addEventListener('click', togglePartyFromDetail);
  $('btn-partner').addEventListener('click', () => {
    const inst = findInstance(state.record, detailUid);
    if (inst) { setPartner(state.record, inst.id); renderCatDetail(); }
  });
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
    const [, sentRes, idiomRes] = await Promise.all([loadWordSet(), fetch('data/sentences.json'), fetch('data/idioms.json')]);
    if (!sentRes.ok || !idiomRes.ok) throw new Error('load failed');
    const story = await sentRes.json();
    state.chapters = story.chapters;
    state.sentences = story.sentences;
    state.idioms = await idiomRes.json();
    $('btn-start').textContent = '単語スタート';
    $('btn-start').disabled = false;
    $('btn-start-idiom').disabled = false;
    $('btn-start-story').disabled = false;
    $('idiom-total').textContent = state.idioms.length;
    if ($('screen-home').classList.contains('is-active')) showHome(); // ニガテの数などを単語がそろった状態で出し直す
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
