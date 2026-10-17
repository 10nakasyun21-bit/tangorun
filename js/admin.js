// 管理者ページ

const CHART_DAYS = 30;

const admin = {
  students: [],     // cloudListStudents の結果
  words: null,      // id → 単語（よく間違える単語の表示用）
  current: null,    // 詳細を開いている生徒
  dialogMode: null, // 'create' | 'reissue'
  confirmAction: null,
};

const $ = id => document.getElementById(id);

function showView(name) {
  for (const v of ['login', 'list', 'detail']) $('view-' + v).hidden = v !== name;
  $('btn-admin-logout').hidden = name === 'login';
  window.scrollTo(0, 0);
}

function showMessage(text) {
  $('admin-message').textContent = text;
  $('admin-message').hidden = !text;
}

// 秒 → 「1時間5分」「12分」
function formatDuration(seconds) {
  const min = Math.round((seconds || 0) / 60);
  if (min < 60) return `${min}分`;
  return `${Math.floor(min / 60)}時間${min % 60 ? (min % 60) + '分' : ''}`;
}

function formatRate(correct, total) {
  return total ? Math.round((correct / total) * 100) + '%' : '-';
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const today = localDate();
  if (dateStr === today) return '今日';
  if (dateStr === addDays(today, -1)) return '昨日';
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d}`;
}

function el(tag, props = {}, children = []) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  for (const c of [].concat(children)) e.append(c);
  return e;
}

// ---------- ログイン ----------

async function submitAdminLogin(e) {
  e.preventDefault();
  $('admin-login-error').hidden = true;
  $('btn-admin-login').disabled = true;
  try {
    await cloudLoginAdmin($('admin-email').value, $('admin-password').value);
    // 続きは onAuthStateChanged
  } catch (err) {
    $('admin-login-error').textContent = cloudErrorMessage(err);
    $('admin-login-error').hidden = false;
  } finally {
    $('btn-admin-login').disabled = false;
  }
}

async function handleAdminAuth(user) {
  if (!user) {
    showView('login');
    return;
  }
  $('admin-password').value = '';
  const ok = await loadStudents();
  if (!ok) {
    await cloudLogout();
    $('admin-login-error').textContent = 'このアカウントは管理者として登録されていません。';
    $('admin-login-error').hidden = false;
    showView('login');
  }
}

// ---------- 生徒一覧 ----------

async function loadStudents() {
  showMessage('');
  try {
    admin.students = await cloudListStudents();
  } catch (e) {
    if ((e.code || '').includes('permission-denied')) return false;
    showMessage(cloudErrorMessage(e));
    return true;
  }
  renderList();
  loadSeries();
  if (admin.current) {
    admin.current = admin.students.find(s => s.uid === admin.current.uid) || null;
  }
  if (!$('view-detail').hidden && admin.current) renderDetailHeader();
  else showView('list');
  return true;
}

function recentSeconds(summary, days) {
  if (!summary || !summary.recentUsage) return 0;
  const today = localDate();
  let total = 0;
  for (let i = 0; i < days; i++) {
    const u = summary.recentUsage[addDays(today, -i)];
    if (u) total += u.seconds || 0;
  }
  return total;
}

function summaryStreak(s) {
  if (!s) return 0;
  const today = localDate();
  return (s.lastStreakDate === today || s.lastStreakDate === addDays(today, -1)) ? s.streakDays : 0;
}

function renderList() {
  const active = admin.students.filter(s => s.active).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  const stopped = admin.students.filter(s => !s.active);

  const todaySecs = active.map(s => recentSeconds(s.summary, 1));
  $('kpi-students').textContent = active.length;
  $('kpi-active').textContent = todaySecs.filter(t => t > 0).length;
  $('kpi-time').textContent = formatDuration(todaySecs.reduce((a, b) => a + b, 0));

  const rows = $('student-rows');
  rows.innerHTML = '';
  for (const s of active) {
    const sum = s.summary;
    const tr = el('tr', { tabIndex: 0 }, [
      el('td', {}, [el('span', { className: 'student-name', textContent: s.name }), el('span', { className: 'student-login', textContent: s.loginId })]),
      el('td', { className: sum ? '' : 'muted', textContent: sum ? formatDate(sum.lastPlayedDate) : 'まだ使っていない' }),
      el('td', { className: 'num', textContent: summaryStreak(sum) + '日' }),
      el('td', { className: 'num', textContent: (sum ? sum.mastered : 0) + '語' }),
      el('td', { className: 'num', textContent: sum && sum.sentencesStudied ? `第${sum.storyChapter}章` : '-' }),
      el('td', { className: 'num', textContent: formatDuration(recentSeconds(sum, 1)) }),
      el('td', { className: 'num', textContent: formatDuration(recentSeconds(sum, 7)) }),
      el('td', { className: 'num', textContent: sum ? formatRate(sum.totalCorrect, sum.totalCorrect + sum.totalWrong) : '-' }),
    ]);
    tr.addEventListener('click', () => openDetail(s));
    tr.addEventListener('keydown', e => { if (e.key === 'Enter') openDetail(s); });
    rows.append(tr);
  }
  $('empty-list').hidden = active.length > 0;

  $('stopped-box').hidden = stopped.length === 0;
  $('stopped-count').textContent = stopped.length;
  const ul = $('stopped-list');
  ul.innerHTML = '';
  for (const s of stopped) {
    const label = s.replacedBy ? '（新しいIDに引き継ぎ済み）' : '';
    const btn = el('button', { className: 'btn btn-ghost btn-small', textContent: '再開' });
    btn.addEventListener('click', () => setActive(s, true));
    ul.append(el('li', {}, [`${s.name}（${s.loginId}）${label}`, s.replacedBy ? '' : btn]));
  }
}

// ---------- 期間限定ガチャ ----------

// 期間限定ネコは3日ごとに自動で入れかわる（js/limited.js）。ここでは予定の確認と、過去のネコの復刻だけを行う
const RERUN_DAYS = 3;

function periodLabel(i) {
  const d = limitedPeriodDates(i);
  return `${d.start.slice(5).replace('-', '/')}〜${d.end.slice(5).replace('-', '/')}`;
}

async function loadSeries() {
  const box = $('series-options');
  const status = $('series-status');
  box.innerHTML = '';
  const ms = (await fetchServerTime()) ?? Date.now();
  const i = limitedPeriodIndex(ms);
  const lines = [];
  if (i < 0) lines.push(`${LIMITED_START_DATE} から始まります。`);
  else if (i < LIMITED_CATS.length) lines.push(`いま：第${i + 1}弾「${LIMITED_CATS[i].name}」（${periodLabel(i)}）`);
  else lines.push('準備した期間限定ネコはすべて終わりました。次のネコを Claude に依頼してください。');
  if (i + 1 >= 0 && i + 1 < LIMITED_CATS.length) lines.push(`次：第${i + 2}弾「${LIMITED_CATS[i + 1].name}」（${periodLabel(i + 1)}）`);
  const left = LIMITED_CATS.length - Math.max(i + 1, 0);
  if (i >= 0 && left <= 3) lines.push(`※ 準備した期間限定ネコは、あと${left}弾で終わります。早めに次のネコを Claude に依頼してください。`);

  let cfg = { rerunCat: null, rerunUntil: null };
  try {
    cfg = await cloudFetchGachaConfig();
  } catch (e) {
    lines.push('復刻の設定を読めませんでした。Firestore のルールに config の項目があるか確認してください。');
    status.textContent = lines.join('\n');
    return;
  }
  const today = jstDate(ms);
  const rerun = cfg.rerunCat && cfg.rerunUntil >= today ? LIMITED_CATS.find(c => c.id === cfg.rerunCat) : null;
  lines.push(rerun ? `復刻中：「${rerun.name}」（${cfg.rerunUntil.slice(5).replace('-', '/')} まで）` : '復刻：なし');
  status.textContent = lines.join('\n');

  // 復刻できるのは、期間が終わったネコだけ
  const past = LIMITED_CATS.slice(0, Math.max(i, 0));
  if (!past.length) return;
  const select = el('select', { className: 'field-input series-select' });
  for (const c of past) select.append(el('option', { value: c.id, textContent: `第${LIMITED_CATS.indexOf(c) + 1}弾 ${c.name}` }));
  const start = el('button', { className: 'btn btn-primary btn-small', textContent: `${RERUN_DAYS}日間 復刻する` });
  start.addEventListener('click', async () => {
    start.disabled = true;
    try {
      await cloudSetGachaConfig({ rerunCat: Number(select.value), rerunUntil: addDays(today, RERUN_DAYS - 1) });
      await loadSeries();
    } catch (e) { showMessage(cloudErrorMessage(e)); }
  });
  box.append(select, start);
  if (rerun) {
    const stop = el('button', { className: 'btn btn-ghost btn-small', textContent: '復刻をやめる' });
    stop.addEventListener('click', async () => {
      stop.disabled = true;
      try {
        await cloudSetGachaConfig({ rerunCat: null, rerunUntil: null });
        await loadSeries();
      } catch (e) { showMessage(cloudErrorMessage(e)); }
    });
    box.append(stop);
  }
}

// ---------- 生徒の詳細 ----------

async function openDetail(student) {
  admin.current = student;
  renderDetailHeader();
  $('usage-chart').innerHTML = '';
  $('usage-rows').innerHTML = '';
  $('weak-words').innerHTML = '';
  $('weak-empty').hidden = true;
  showView('detail');
  loadRankingMeta(student);

  try {
    const from = addDays(localDate(), -(CHART_DAYS - 1));
    const [days, progress] = await Promise.all([
      cloudFetchUsageDays(student.uid, from),
      cloudFetchProgress(student.uid),
      loadWords(),
    ]);
    if (admin.current !== student) return;
    renderUsage(days);
    renderWeakWords(progress);
  } catch (e) {
    showMessage(cloudErrorMessage(e));
  }
}

// ---------- ランキングの名前・表示 ----------
// 生徒アプリの defaultNickname（js/battleui.js）と同じ決め方
function rankDefaultName(uid) {
  let h = 0;
  for (const ch of String(uid)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `ネコ使い${1000 + (h % 9000)}号`;
}

async function loadRankingMeta(student) {
  $('rk-default-name').textContent = rankDefaultName(student.uid);
  $('rk-nickname').value = '';
  $('rk-hidden').checked = false;
  $('rk-admin-status').textContent = '読みこみ中…';
  try {
    const meta = await cloudFetchRankingMeta(student.uid);
    if (admin.current !== student) return;
    $('rk-nickname').value = meta.nickname || '';
    $('rk-hidden').checked = !!meta.hidden;
    $('rk-admin-status').textContent = meta.hidden ? 'いまはランキングに出ていません。' : '';
  } catch (e) {
    $('rk-admin-status').textContent = 'ランキングの設定を読めませんでした。Firestore のルールを新しいものに更新してください。';
  }
}

async function saveRankingMeta(changes, message) {
  const student = admin.current;
  if (!student) return;
  try {
    await cloudSetRankingMeta(student.uid, changes);
    $('rk-admin-status').textContent = message;
  } catch (e) {
    $('rk-admin-status').textContent = cloudErrorMessage(e);
  }
}

function renderDetailHeader() {
  const s = admin.current;
  const sum = s.summary;
  $('d-name').textContent = s.name;
  $('d-login').textContent = 'ログインID：' + s.loginId;
  $('d-mastered').textContent = sum ? sum.mastered : 0;
  $('d-studied').textContent = sum ? sum.studiedWords : 0;
  $('d-streak').textContent = summaryStreak(sum);
  $('d-chapter').textContent = (sum && sum.storyChapter) || 1;
  $('d-sentences').textContent = (sum && sum.sentencesMastered) || 0;
  $('d-challenge').textContent = (sum && sum.challengeBest) || 0;
  $('d-cats').textContent = (sum && sum.catsOwned) || 0;
  $('d-idioms').textContent = (sum && sum.idiomsMastered) || 0;
  $('d-high').textContent = (sum && sum.masteredHigh) || 0;
  $('d-toeic').textContent = (sum && sum.masteredToeic) || 0;
  $('d-biz').textContent = (sum && sum.masteredBiz) || 0;
  $('d-wordset').textContent = WORD_SETS[(sum && sum.wordSet) || 'junior'].name;
  $('d-rate').textContent = sum ? formatRate(sum.totalCorrect, sum.totalCorrect + sum.totalWrong) : '-';
  $('btn-toggle-active').textContent = s.active ? '利用停止にする' : '利用を再開する';
}

function renderUsage(days) {
  const today = localDate();
  const dates = [];
  for (let i = CHART_DAYS - 1; i >= 0; i--) dates.push(addDays(today, -i));
  const minutes = dates.map(d => Math.round(((days[d] && days[d].seconds) || 0) / 60));
  // 目盛りを切りのいい数にする（10分・30分・60分…）
  const peak = Math.max(...minutes, 1);
  const top = [10, 20, 30, 60, 90, 120, 180, 240, 360].find(v => v >= peak) || Math.ceil(peak / 60) * 60;

  const chart = $('usage-chart');
  chart.innerHTML = '';
  dates.forEach((d, i) => {
    const bar = el('div', { className: 'usage-bar' }, [el('span')]);
    bar.firstChild.style.height = minutes[i] ? Math.max((minutes[i] / top) * 100, 2) + '%' : '0';
    const u = days[d];
    const tip = `${formatDate(d)}（${d.slice(5).replace('-', '/')}）　${minutes[i]}分` + (u ? `・${u.sets}セット` : '');
    bar.addEventListener('pointerenter', e => showTooltip(tip, e));
    bar.addEventListener('pointermove', e => moveTooltip(e));
    bar.addEventListener('pointerleave', hideTooltip);
    chart.append(bar);
  });
  $('usage-max').textContent = `いちばん上の線：${top}分`;
  const axis = $('usage-axis');
  axis.innerHTML = '';
  axis.append(el('span', { textContent: formatDate(dates[0]) }), el('span', { textContent: formatDate(dates[14]) }), el('span', { textContent: '今日' }));

  const rows = $('usage-rows');
  rows.innerHTML = '';
  for (const d of [...dates].reverse()) {
    const u = days[d];
    if (!u) continue;
    rows.append(el('tr', {}, [
      el('td', { textContent: d }),
      el('td', { className: 'num', textContent: formatDuration(u.seconds) }),
      el('td', { className: 'num', textContent: u.sets }),
      el('td', { className: 'num', textContent: u.answered }),
      el('td', { className: 'num', textContent: formatRate(u.correct, u.answered) }),
    ]));
  }
  if (!rows.children.length) rows.append(el('tr', {}, [el('td', { colSpan: 5, className: 'muted', textContent: '最近30日は使っていません' })]));
}

function showTooltip(text, e) {
  const t = $('chart-tooltip');
  t.textContent = text;
  t.hidden = false;
  moveTooltip(e);
}

function moveTooltip(e) {
  const t = $('chart-tooltip');
  const x = Math.min(e.clientX + 12, window.innerWidth - t.offsetWidth - 8);
  t.style.left = x + 'px';
  t.style.top = (e.clientY - t.offsetHeight - 12) + 'px';
}

function hideTooltip() {
  $('chart-tooltip').hidden = true;
}

async function loadWords() {
  if (admin.words) return;
  const res = await fetch('data/words.json');
  const list = await res.json();
  admin.words = {};
  for (const w of list) admin.words[w.id] = w;
}

function renderWeakWords(progress) {
  const ol = $('weak-words');
  ol.innerHTML = '';
  const entries = progress ? Object.entries(progress.words) : [];
  const weak = entries
    .filter(([, w]) => w.wrong > 0)
    .sort((a, b) => (b[1].wrong - a[1].wrong) || (a[1].correct - b[1].correct))
    .slice(0, 10);
  for (const [id, w] of weak) {
    const word = admin.words && admin.words[id];
    if (!word) continue;
    ol.append(el('li', {}, [
      el('span', { className: 'weak-word', textContent: word.word }),
      el('span', { className: 'weak-meaning', textContent: word.meaning }),
      el('span', { className: 'weak-count', textContent: `×${w.wrong}` }),
    ]));
  }
  $('weak-empty').hidden = ol.children.length > 0;
}

// ---------- 生徒の追加・引き継ぎ ----------

function generatePassword() {
  // 読みまちがえやすい文字（0/o, 1/l/i）は使わない
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const buf = new Uint32Array(8);
  crypto.getRandomValues(buf);
  return Array.from(buf, n => chars[n % chars.length]).join('');
}

function openStudentDialog(mode) {
  admin.dialogMode = mode;
  const s = admin.current;
  $('student-dialog-title').textContent = mode === 'create' ? '生徒を追加' : '新しいIDに引き継ぐ';
  $('student-dialog-note').hidden = mode === 'create';
  $('student-dialog-note').textContent = mode === 'reissue'
    ? `${s.name} さんの学習記録を、新しいログインIDにそのまま移します。今のID（${s.loginId}）は使えなくなります。`
    : '';
  $('s-name').value = mode === 'reissue' ? s.name : '';
  $('s-login').value = mode === 'reissue' ? suggestLoginId(s.loginId) : '';
  $('s-password').value = generatePassword();
  $('student-error').hidden = true;
  $('btn-student-ok').textContent = mode === 'create' ? '作成' : '引き継ぐ';
  $('student-dialog').hidden = false;
  $(mode === 'create' ? 's-name' : 's-login').focus();
}

// 引き継ぎ用のIDの候補：taro → taro2、taro2 → taro3
function suggestLoginId(loginId) {
  const m = loginId.match(/^(.*?)(\d+)$/);
  const base = m ? m[1] : loginId;
  const n = m ? Number(m[2]) + 1 : 2;
  return (base + n).slice(0, 20);
}

function closeStudentDialog() {
  $('student-dialog').hidden = true;
}

async function submitStudent(e) {
  e.preventDefault();
  const name = $('s-name').value.trim();
  const loginId = $('s-login').value.trim().toLowerCase();
  const password = $('s-password').value;
  const err = $('student-error');
  err.hidden = true;

  let problem = '';
  if (!name) problem = '名前を入れてください。';
  else if (!isValidLoginId(loginId)) problem = 'ログインIDは半角の英小文字・数字で3〜20文字にしてください（記号は . _ - だけ）。';
  else if (password.length < 6) problem = 'パスワードは6文字以上にしてください。';
  else if (admin.students.some(s => s.loginId === loginId)) problem = 'そのログインIDはもう使われています。';
  if (problem) {
    err.textContent = problem;
    err.hidden = false;
    return;
  }

  $('btn-student-ok').disabled = true;
  try {
    if (admin.dialogMode === 'create') {
      await cloudCreateStudent(name, loginId, password);
    } else {
      const newUid = await cloudReissueStudent(admin.current.uid, name, loginId, password);
      admin.current = { uid: newUid };
    }
    closeStudentDialog();
    $('created-text').textContent = `名前：${name}\nログインID：${loginId}\nパスワード：${password}\nアプリ：${appUrl()}`;
    $('created-dialog').hidden = false;
    await loadStudents();
    if (admin.dialogMode === 'reissue' && admin.current) openDetail(admin.current);
  } catch (e2) {
    err.textContent = cloudErrorMessage(e2);
    err.hidden = false;
  } finally {
    $('btn-student-ok').disabled = false;
  }
}

function appUrl() {
  return new URL('./', location.href).href;
}

async function copyCreated() {
  try {
    await navigator.clipboard.writeText($('created-text').textContent);
    $('btn-copy-created').textContent = 'コピーしました';
  } catch (e) {
    $('btn-copy-created').textContent = 'コピーできませんでした';
  }
  setTimeout(() => { $('btn-copy-created').textContent = 'コピー'; }, 2000);
}

// ---------- 利用停止・再開 ----------

function askToggleActive() {
  const s = admin.current;
  if (!s.active) {
    setActive(s, true);
    return;
  }
  $('confirm-title').textContent = `${s.name} さんを利用停止にしますか？`;
  $('confirm-text').textContent = 'この生徒はアプリを使えなくなります。学習記録は残り、あとで再開できます。';
  admin.confirmAction = () => setActive(s, false);
  $('confirm-dialog').hidden = false;
}

async function setActive(student, active) {
  try {
    await cloudSetActive(student.uid, active);
    await loadStudents();
    if (!active) showView('list');
  } catch (e) {
    showMessage(cloudErrorMessage(e));
  }
}

// ---------- 起動 ----------

function init() {
  if (!FIREBASE_CONFIG) {
    showMessage('Firebase の設定がまだです。js/firebase-config.js に設定を貼りつけてください。');
    return;
  }
  if (typeof firebase === 'undefined') {
    showMessage('Firebase を読み込めませんでした。インターネットにつないで、ページを再読み込みしてください。');
    return;
  }
  cloudInit('admin');

  $('admin-login-form').addEventListener('submit', submitAdminLogin);
  $('btn-admin-logout').addEventListener('click', async () => { admin.current = null; await cloudLogout(); });
  $('btn-refresh').addEventListener('click', loadStudents);
  $('btn-add').addEventListener('click', () => openStudentDialog('create'));
  $('btn-back').addEventListener('click', () => { admin.current = null; showView('list'); });
  $('btn-reissue').addEventListener('click', () => openStudentDialog('reissue'));
  $('btn-toggle-active').addEventListener('click', askToggleActive);
  $('btn-rk-save').addEventListener('click', () => {
    const name = $('rk-nickname').value.trim().slice(0, 12);
    saveRankingMeta({ nickname: name }, name ? `「${name}」で保存しました。` : 'ニックネームを消しました（自動の名前で出ます）。');
  });
  $('rk-hidden').addEventListener('change', e => {
    saveRankingMeta({ hidden: e.target.checked }, e.target.checked ? 'ランキングに出さないようにしました。' : 'ランキングに出すようにしました。');
  });
  $('btn-gen-password').addEventListener('click', () => { $('s-password').value = generatePassword(); });
  $('student-form').addEventListener('submit', submitStudent);
  $('btn-student-cancel').addEventListener('click', closeStudentDialog);
  $('btn-created-ok').addEventListener('click', () => { $('created-dialog').hidden = true; });
  $('btn-copy-created').addEventListener('click', copyCreated);
  $('btn-confirm-cancel').addEventListener('click', () => { $('confirm-dialog').hidden = true; });
  $('btn-confirm-ok').addEventListener('click', () => { $('confirm-dialog').hidden = true; admin.confirmAction && admin.confirmAction(); });

  cloudAuth().onAuthStateChanged(handleAdminAuth);
}

init();
