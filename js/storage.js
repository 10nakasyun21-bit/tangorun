// 学習記録の保存（端末の localStorage。ログインしているときは生徒ごとに分けて保存する）

const LEGACY_STORAGE_KEY = 'tangorun'; // ログイン機能を入れる前の保存場所
const LAST_USER_KEY = 'tangorun:lastUser';
const STORAGE_VERSION = 2;

// 正解した回数ごとの、次の出題までの日数（1回目→1日後、2回目→3日後…）
const REVIEW_INTERVALS = [1, 3, 7, 14];
// 7日間隔の復習で正解したら「覚えた」（3回続けて正解すると、次の間隔が7日になる）
const MASTERED_STAGE = 3;
const MAX_LEVEL = 3;
const LEVEL_UP_STREAK = 2; // 同じレベルで2回連続正解したら次のレベルへ
const USAGE_KEEP_DAYS = 40; // 端末に残す使用時間の日数

let storageKey = LEGACY_STORAGE_KEY;

function pad2(n) {
  return String(n).padStart(2, '0');
}

// 端末の時刻での日付 "YYYY-MM-DD"（toISOString は UTC になるので使わない）
function localDate(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function localDateTime(d = new Date()) {
  return `${localDate(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + days));
}

// ---------- 保存場所の切り替え ----------

function setStorageUser(uid) {
  storageKey = uid ? `tangorun:user:${uid}` : LEGACY_STORAGE_KEY;
}

// 最後にログインした生徒 { uid, name }。電波がないときも、この生徒として続けられるようにする
function getLastUser() {
  try {
    const u = JSON.parse(localStorage.getItem(LAST_USER_KEY));
    return u && u.uid ? u : null;
  } catch (e) {
    return null;
  }
}

function setLastUser(user) {
  try {
    if (user) localStorage.setItem(LAST_USER_KEY, JSON.stringify({ uid: user.uid, name: user.name || '' }));
    else localStorage.removeItem(LAST_USER_KEY);
  } catch (e) { /* 保存できなくても続ける */ }
}

// 管理者が開始した期間限定ガチャ（電波がなくても前回の状態で遊べるよう端末にも控える）
const ACTIVE_SERIES_KEY = 'tangorun:activeSeries';

function loadActiveSeries() {
  try { return localStorage.getItem(ACTIVE_SERIES_KEY) || null; } catch (e) { return null; }
}

function saveActiveSeries(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_SERIES_KEY, id);
    else localStorage.removeItem(ACTIVE_SERIES_KEY);
  } catch (e) { /* 保存できなくても続ける */ }
}

// ログイン前に端末で遊んでいた記録（最初にログインした生徒に引き継ぐ）
function takeLegacyRecord() {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    localStorage.removeItem(LEGACY_STORAGE_KEY); // 同じ端末の別の生徒に引き継がれないように消す
    return parseRecord(raw);
  } catch (e) {
    return null;
  }
}

// ---------- 記録の形 ----------

function defaultSettings() {
  return { sound: true, autoSpeak: true };
}

function emptyRecord(settings = defaultSettings()) {
  return {
    version: STORAGE_VERSION,
    updatedAt: 0, // 学習内容を最後に変えた時刻（端末どうしで、どちらが新しいかを比べる）
    words: {},
    sentences: {}, // 文章の記録（単語と同じ形）
    idioms: {},    // 熟語の記録（単語と同じ形。単語の記録とは別の場所に置く）
    stats: { setsCompleted: 0, lastPlayedDate: null, streakDays: 0, lastStreakDate: null, storyChapter: 1, challengeBest: 0 },
    settings,
    usage: {}, // 日付ごとの { seconds, sets, answered, correct }
    coins: 0,
    collection: {}, // ネコの id → 持っている枚数
    fragments: { N: 0, R: 0, SR: 0 }, // ダブったカードからもらえるかけら（レア度ごと）
    partner: null,  // ホームに表示する相棒ネコの id
  };
}

function newWordRecord() {
  return {
    correct: 0,
    wrong: 0,
    lastResult: null,
    lastAnsweredAt: null,
    level: 1,       // 出題形式のレベル（1〜3）
    levelStreak: 0, // 今のレベルでの連続正解数
    stage: 0,       // 間隔反復で何回続けて正解したか（0〜4）
    due: null,      // 次に出題する日。これ以前（当日含む）なら復習対象
    mastered: false,
  };
}

// 古い形式（version 1）の単語記録に、足りない項目を補う
function normalizeWord(w) {
  const merged = { ...newWordRecord(), ...w };
  if (!merged.due) merged.due = localDate(); // version 1 で解いた単語は、すぐ復習に回す
  return merged;
}

// 保存されていたデータ（文字列またはオブジェクト）を、今の形に整える
function parseRecord(data) {
  if (typeof data === 'string') data = JSON.parse(data);
  const record = emptyRecord({ ...defaultSettings(), ...data.settings });
  record.updatedAt = data.updatedAt || 0;
  record.stats = { ...record.stats, ...data.stats };
  record.usage = { ...data.usage };
  record.coins = data.coins || 0;
  record.collection = { ...data.collection };
  record.fragments = normalizeFragments(data.fragments);
  record.partner = data.partner || null;
  for (const [id, w] of Object.entries(data.words || {})) {
    record.words[id] = normalizeWord(w);
  }
  for (const [id, s] of Object.entries(data.sentences || {})) {
    record.sentences[id] = normalizeWord(s);
  }
  for (const [id, s] of Object.entries(data.idioms || {})) {
    record.idioms[id] = normalizeWord(s);
  }
  return record;
}

// かけらは { N, R, SR } の形。前の版（数字1つ）の記録は N のかけらとして引き継ぐ
function normalizeFragments(f) {
  if (typeof f === 'number') return { N: f, R: 0, SR: 0 };
  return { N: 0, R: 0, SR: 0, ...f };
}

// 読み込み。保存できない環境や壊れたデータのときは空の記録を返す
function loadRecord() {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? parseRecord(raw) : emptyRecord();
  } catch (e) {
    return emptyRecord();
  }
}

function saveRecord(record) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(record));
  } catch (e) {
    // シークレットモードなどで保存できなくても、クイズはそのまま続ける
  }
}

// 学習内容が変わったときに呼ぶ（使用時間の加算では呼ばない）
function touchRecord(record) {
  record.updatedAt = Date.now();
}

// ---------- 学習の記録 ----------

// 日ごとの記録の名前の頭（wordLevelUps・sentenceMastered・idiomSets など）
const USAGE_PREFIX = { words: 'word', sentences: 'sentence', idioms: 'idiom' };

// 1問答えたときの記録
// isPractice：復習日より前に「数合わせ」で出した問題。正解しても復習の間隔は進めない
// kind：'words'（単語）・'sentences'（文章）・'idioms'（熟語）。どれも同じ間隔反復とレベルの決まりを使う
function recordAnswer(record, wordId, isCorrect, isPractice = false, kind = 'words') {
  const today = localDate();
  const items = record[kind];
  const w = items[wordId] || newWordRecord();
  const levelBefore = w.level;
  const masteredBefore = w.mastered;

  if (isCorrect) {
    w.correct++;
    if (!isPractice) {
      if (w.stage >= MASTERED_STAGE) w.mastered = true;
      w.stage = Math.min(w.stage + 1, REVIEW_INTERVALS.length);
      w.due = addDays(today, REVIEW_INTERVALS[w.stage - 1]);
    }
    w.levelStreak++;
    if (w.levelStreak >= LEVEL_UP_STREAK && w.level < MAX_LEVEL) {
      w.level++;
      w.levelStreak = 0;
    }
  } else {
    w.wrong++;
    w.stage = 0;     // 間隔を最初に戻す
    w.due = today;   // 次のセットで再出題
    w.levelStreak = 0;
  }

  w.lastResult = isCorrect ? 'correct' : 'wrong';
  w.lastAnsweredAt = localDateTime();
  items[wordId] = w;
  record.stats.lastPlayedDate = today;

  const u = usageOf(record, today);
  u.answered++;
  if (isCorrect) u.correct++;
  const prefix = USAGE_PREFIX[kind];
  if (w.level > levelBefore) u[prefix + 'LevelUps']++;
  if (w.mastered && !masteredBefore) u[prefix + 'Mastered']++;

  touchRecord(record);
  saveRecord(record);
  return w;
}

// 1分チャレンジで1問答えたとき：単語ごとの記録（復習の間隔やレベル）は変えず、今日の問題数だけ数える
function recordChallengeAnswer(record, isCorrect) {
  const u = usageOf(record, localDate());
  u.answered++;
  if (isCorrect) u.correct++;
}

// 1セット（または1分チャレンジ）を終えたときの記録（ストリークもここで更新）
// mode：'words' | 'sentences' | 'challenge'。score は1分チャレンジの正解数
function recordSetCompleted(record, { mode = 'words', maxCombo = 0, score = 0 } = {}) {
  const today = localDate();
  const s = record.stats;
  s.setsCompleted++;
  s.lastPlayedDate = today;
  if (s.lastStreakDate !== today) {
    s.streakDays = s.lastStreakDate === addDays(today, -1) ? s.streakDays + 1 : 1;
    s.lastStreakDate = today;
  }
  const u = usageOf(record, today);
  u.sets++;
  u.bestCombo = Math.max(u.bestCombo, maxCombo);
  if (mode === 'words') u.wordSets++;
  if (mode === 'sentences') u.sentenceSets++;
  if (mode === 'idioms') u.idiomSets++;
  if (mode === 'challenge') {
    u.challenges++;
    u.challengeBest = Math.max(u.challengeBest, score);
    s.challengeBest = Math.max(s.challengeBest || 0, score);
  }
  touchRecord(record);
  saveRecord(record);
}

// ---------- 使用時間 ----------

// 1日分の記録。使用時間・問題数のほか、今日のミッションと結果画面の「できた」表示に使う数
function emptyUsage() {
  return {
    seconds: 0, sets: 0, answered: 0, correct: 0,
    wordSets: 0, sentenceSets: 0, challenges: 0, bestCombo: 0, challengeBest: 0,
    wordLevelUps: 0, wordMastered: 0, sentenceLevelUps: 0, sentenceMastered: 0,
    idiomSets: 0, idiomLevelUps: 0, idiomMastered: 0,
  };
}

function usageOf(record, date) {
  record.usage[date] = { ...emptyUsage(), ...record.usage[date] };
  return record.usage[date];
}

function addUsageSeconds(record, seconds) {
  usageOf(record, localDate()).seconds += seconds;
}

// 古い日の使用時間は端末から消す（Firebase には残っている）
function pruneUsage(record) {
  const oldest = addDays(localDate(), -USAGE_KEEP_DAYS);
  for (const date of Object.keys(record.usage)) {
    if (date < oldest) delete record.usage[date];
  }
}

// 2つの端末の記録をまとめる：学習内容は新しい方、使用時間は日ごとに多い方
function mergeRecords(local, remote) {
  const base = (remote.updatedAt || 0) > (local.updatedAt || 0) ? remote : local;
  const merged = parseRecord(JSON.parse(JSON.stringify(base)));
  for (const src of [local, remote]) {
    for (const [date, u] of Object.entries(src.usage || {})) {
      const m = usageOf(merged, date);
      for (const k of Object.keys(emptyUsage())) m[k] = Math.max(m[k], u[k] || 0);
    }
    // 自己ベストは、どちらの端末の記録でも高いほうを残す
    merged.stats.challengeBest = Math.max(merged.stats.challengeBest || 0, (src.stats && src.stats.challengeBest) || 0);
    // 集めたネコは、どちらの端末で手に入れたものも消さない
    for (const [id, n] of Object.entries(src.collection || {})) {
      merged.collection[id] = Math.max(merged.collection[id] || 0, n);
    }
  }
  return merged;
}

// ---------- 表示用 ----------

// 今日か昨日にセットを終えていればストリーク継続中
function currentStreak(record) {
  const today = localDate();
  const last = record.stats.lastStreakDate;
  if (last === today || last === addDays(today, -1)) return record.stats.streakDays;
  return 0;
}

function countMastered(record, kind = 'words') {
  return Object.values(record[kind]).filter(w => w.mastered).length;
}

function updateSettings(record, changes) {
  Object.assign(record.settings, changes);
  touchRecord(record);
  saveRecord(record);
}

// 学習データを消す（設定・使用時間・集めたネコとコインは残す）
function resetRecord(record) {
  const fresh = emptyRecord(record.settings);
  fresh.usage = record.usage;
  fresh.coins = record.coins;
  fresh.collection = record.collection;
  fresh.fragments = record.fragments;
  fresh.partner = record.partner;
  touchRecord(fresh);
  saveRecord(fresh);
  return fresh;
}
