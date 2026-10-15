// Firebase とのやりとり（生徒アプリと管理者ページで共通）
//
// Firestore のデータ
//   users/{uid}             生徒の名前・ログインID・利用中か（管理者だけが書く）
//   progress/{uid}          学習記録（単語ごとの記録・ストリーク・設定）
//   summary/{uid}           管理者ページの一覧用の要約（覚えた語数・最近35日の使用時間など）
//   usage/{uid}/days/{日付}  日ごとの使用時間・セット数（長期の記録用）

const SUMMARY_USAGE_DAYS = 35;

let cloudApp = null;

function cloudEnabled() {
  return !!FIREBASE_CONFIG && typeof firebase !== 'undefined';
}

// 管理者ページは別の名前で初期化する。同じブラウザで生徒アプリを開いても、ログインが混ざらない
function cloudInit(appName = '[DEFAULT]') {
  if (!cloudEnabled() || cloudApp) return cloudApp;
  cloudApp = firebase.initializeApp(FIREBASE_CONFIG, appName);
  return cloudApp;
}

function cloudAuth() { return cloudApp.auth(); }
function cloudDb() { return cloudApp.firestore(); }

function loginIdToEmail(loginId) {
  return `${loginId.trim().toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
}

function isValidLoginId(loginId) {
  return /^[a-z0-9][a-z0-9._-]{2,19}$/.test(loginId);
}

// Firebase のエラーを、画面に出す日本語にする
function cloudErrorMessage(e) {
  const code = (e && e.code) || '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found') || code.includes('invalid-email')) {
    return 'ログインIDかパスワードがちがいます。';
  }
  if (code.includes('too-many-requests')) return '何度も失敗したので、少し待ってからためしてください。';
  if (code.includes('network-request-failed') || code.includes('unavailable')) return 'インターネットにつながっていません。';
  if (code.includes('email-already-in-use')) return 'そのログインIDはもう使われています。';
  if (code.includes('weak-password')) return 'パスワードは6文字以上にしてください。';
  if (code.includes('permission-denied')) return 'このアカウントでは操作できません。';
  if (code.includes('resource-exhausted')) return '今日の無料の利用上限に達しました。明日になると元に戻ります。';
  return 'エラーが起きました（' + (code || e.message || e) + '）';
}

// ---------- 生徒アプリ ----------

async function cloudLoginStudent(loginId, password) {
  const cred = await cloudAuth().signInWithEmailAndPassword(loginIdToEmail(loginId), password);
  return cred.user;
}

function cloudLogout() {
  return cloudAuth().signOut();
}

async function cloudFetchProfile(uid) {
  const snap = await cloudDb().collection('users').doc(uid).get();
  return snap.exists ? snap.data() : null;
}

async function cloudFetchProgress(uid) {
  const snap = await cloudDb().collection('progress').doc(uid).get();
  return snap.exists ? parseRecord(snap.data()) : null;
}

function buildSummary(record) {
  const today = localDate();
  const recentUsage = {};
  for (let i = 0; i < SUMMARY_USAGE_DAYS; i++) {
    const d = addDays(today, -i);
    if (record.usage[d]) recentUsage[d] = record.usage[d];
  }
  const words = Object.values(record.words);
  const sentences = Object.values(record.sentences || {});
  const idioms = Object.values(record.idioms || {});
  return {
    idiomsMastered: idioms.filter(s => s.mastered).length,
    idiomsStudied: idioms.length,
    sentencesMastered: sentences.filter(s => s.mastered).length,
    sentencesStudied: sentences.length,
    storyChapter: record.stats.storyChapter || 1,
    challengeBest: record.stats.challengeBest || 0,
    catsOwned: Object.values(record.collection || {}).filter(n => n > 0).length,
    coins: record.coins || 0,
    mastered: words.filter(w => w.mastered).length,
    studiedWords: words.length,
    totalCorrect: words.reduce((n, w) => n + w.correct, 0),
    totalWrong: words.reduce((n, w) => n + w.wrong, 0),
    streakDays: record.stats.streakDays,
    lastStreakDate: record.stats.lastStreakDate,
    lastPlayedDate: record.stats.lastPlayedDate,
    setsCompleted: record.stats.setsCompleted,
    recentUsage,
    updatedAt: Date.now(),
  };
}

// 学習記録・要約・日ごとの使用時間を、1回のまとめ書き込みで送る
// usageDates：使用時間を送る日付（ふつうは今日だけ）
async function cloudPushRecord(uid, record, usageDates = [localDate()]) {
  const db = cloudDb();
  const batch = db.batch();
  const { usage, ...progress } = record;
  batch.set(db.collection('progress').doc(uid), JSON.parse(JSON.stringify(progress)));
  batch.set(db.collection('summary').doc(uid), buildSummary(record));
  for (const date of usageDates) {
    if (record.usage[date]) {
      batch.set(db.collection('usage').doc(uid).collection('days').doc(date), { date, ...record.usage[date] });
    }
  }
  await batch.commit();
}

// 期間限定ガチャの設定（config/gacha。管理者だけが書ける）
// 期間限定ネコは3日ごとに自動で入れかわる。ここに入るのは先生の「復刻」だけ：{ rerunCat, rerunUntil }
async function cloudFetchGachaConfig() {
  const snap = await cloudDb().collection('config').doc('gacha').get();
  const d = snap.exists ? snap.data() : {};
  return { rerunCat: d.rerunCat || null, rerunUntil: d.rerunUntil || null };
}

async function cloudSetGachaConfig(cfg) {
  await cloudDb().collection('config').doc('gacha').set({ rerunCat: cfg.rerunCat || null, rerunUntil: cfg.rerunUntil || null, updatedAt: Date.now() });
}

// ---------- 管理者ページ ----------

async function cloudLoginAdmin(email, password) {
  const cred = await cloudAuth().signInWithEmailAndPassword(email.trim(), password);
  return cred.user;
}

async function cloudListStudents() {
  const db = cloudDb();
  const [users, summaries] = await Promise.all([
    db.collection('users').get(),
    db.collection('summary').get(),
  ]);
  const sums = {};
  summaries.forEach(doc => { sums[doc.id] = doc.data(); });
  const list = [];
  users.forEach(doc => list.push({ uid: doc.id, ...doc.data(), summary: sums[doc.id] || null }));
  return list;
}

async function cloudFetchUsageDays(uid, fromDate) {
  const snap = await cloudDb().collection('usage').doc(uid).collection('days')
    .where('date', '>=', fromDate)
    .get();
  const days = {};
  snap.forEach(doc => { days[doc.id] = doc.data(); });
  return days;
}

// 管理者のログインを保ったまま、生徒のアカウントを作る（作成専用の2つ目の Firebase アプリを使う）
async function cloudCreateStudentAuth(loginId, password) {
  const creator = firebase.apps.find(a => a.name === 'creator') || firebase.initializeApp(FIREBASE_CONFIG, 'creator');
  const cred = await creator.auth().createUserWithEmailAndPassword(loginIdToEmail(loginId), password);
  const uid = cred.user.uid;
  await creator.auth().signOut();
  return uid;
}

async function cloudCreateStudent(name, loginId, password) {
  const uid = await cloudCreateStudentAuth(loginId, password);
  await cloudDb().collection('users').doc(uid).set({
    name, loginId, active: true, createdAt: Date.now(),
  });
  return uid;
}

async function cloudSetActive(uid, active) {
  await cloudDb().collection('users').doc(uid).update({ active });
}

// パスワードを忘れた生徒用：新しいログインIDを作って、学習記録をそっくり移す
async function cloudReissueStudent(oldUid, name, newLoginId, password) {
  const db = cloudDb();
  const newUid = await cloudCreateStudentAuth(newLoginId, password);
  const [progress, summary, days] = await Promise.all([
    db.collection('progress').doc(oldUid).get(),
    db.collection('summary').doc(oldUid).get(),
    db.collection('usage').doc(oldUid).collection('days').get(),
  ]);
  const batch = db.batch();
  if (progress.exists) batch.set(db.collection('progress').doc(newUid), progress.data());
  if (summary.exists) batch.set(db.collection('summary').doc(newUid), summary.data());
  // まとめ書き込みは500件までなので、使用時間は新しい日から490日分だけ移す
  days.docs.sort((a, b) => b.id.localeCompare(a.id)).slice(0, 490)
    .forEach(doc => batch.set(db.collection('usage').doc(newUid).collection('days').doc(doc.id), doc.data()));
  batch.set(db.collection('users').doc(newUid), {
    name, loginId: newLoginId, active: true, createdAt: Date.now(), previousUid: oldUid,
  });
  batch.update(db.collection('users').doc(oldUid), { active: false, replacedBy: newUid });
  await batch.commit();
  return newUid;
}
