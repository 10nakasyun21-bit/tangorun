// 対戦の画面（ステージ一覧・対戦・結果）。計算は js/battle.js
// app.js より前に読みこむ。画面のボタンは app.js の init から initBattleUI() でつなぐ

let bt = null; // 対戦中の状態（やめたら alive = false にして、待っている演出を止める）

const BT_NEXT_CORRECT_MS = 450;
const BT_NEXT_WRONG_MS = 1000;
const BT_HIT_MS = 380;

const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------- ホームのカード ----------

function battleReady() {
  return state.words.length > 0 && Object.keys(wordRecs()).length >= BATTLE_MIN_WORDS;
}

function renderBattleCard() {
  ensureGrowth(state.record);
  const ready = battleReady();
  $('btn-battle').disabled = !ready;
  const next = Math.min(state.record.player.bestStage + 1, STAGES.length);
  $('battle-sub').textContent = ready
    ? (state.record.player.bestStage >= STAGES.length ? 'ぜんぶクリア！' : `ステージ${next}へ`)
    : `単語を${BATTLE_MIN_WORDS}語解くと遊べる`;
}

// ---------- ステージ一覧 ----------

function stageBg(st) {
  return `linear-gradient(${st.bg[0]}, ${st.bg[1]})`;
}

function showStages() {
  ensureCollection(state.record);
  const record = state.record;
  const pl = playerLevel(record.player.exp);
  $('pl-level').textContent = pl.level;
  $('pl-xp-fill').style.width = `${(pl.into / pl.need) * 100}%`;
  $('pl-xp-note').textContent = `次のLvまで あと${pl.need - pl.into}`;

  const party = partyInstances(record);
  const row = $('stage-party-row');
  row.innerHTML = '';
  for (let slot = 0; slot < PARTY_SIZE; slot++) {
    const inst = party[slot];
    const span = document.createElement('span');
    span.className = 'stage-party-slot';
    span.innerHTML = inst ? catIconHTML(inst, { small: true, extra: slot === 0 ? '<span class="ci-crown">👑</span>' : '' }) : '<span class="party-empty">＋</span>';
    row.append(span);
  }
  const hasParty = party.some(Boolean);
  const note = $('stages-note');
  note.hidden = hasParty;
  if (!hasParty) {
    note.textContent = record.cats.length
      ? '「パーティを変える」から、対戦に出すネコを選んでね'
      : 'まずはガチャでネコを仲間にしよう！（コインは単語を解くとたまるよ）';
  }

  const list = $('stage-list');
  list.innerHTML = '';
  STAGES.forEach((st, i) => {
    const cleared = record.player.bestStage > i;
    const open = record.player.bestStage >= i;
    const b = document.createElement('button');
    b.className = 'stage-card' + (cleared ? ' is-cleared' : '') + (open ? '' : ' is-locked') + (st.tough ? ' is-tough' : '');
    b.disabled = !open || !hasParty;
    b.innerHTML = `<span class="stage-boss" style="background:${stageBg(st)}">${open ? buildAnimalSVG(st.boss[0]) : '<span class="stage-lock">🔒</span>'}</span>`
      + `<span class="stage-text"><b>ステージ${i + 1}　${escapeHtml(st.place)}</b><small>${open ? `ボス ${escapeHtml(st.boss[1])}・目安 ${escapeHtml(st.hint)}` : 'ひとつ前のステージをクリアすると開く'}</small></span>`
      + `<span class="stage-status">${cleared ? '✓<br>クリア' : open ? '挑戦' : ''}</span>`;
    b.addEventListener('click', () => startBattle(i));
    list.append(b);
  });
  showScreen('stages');
}

// ---------- 対戦 ----------

function startBattle(index) {
  unlockAudio();
  const record = state.record;
  const party = partyInstances(record).map(inst => (inst ? { inst, stats: catStats(inst) } : null));
  if (!party.some(Boolean)) return;
  const maxHp = teamMaxHp(party);
  bt = {
    alive: true, index, waves: stageWaves(index), wave: 0, wavesCleared: 0,
    party, slots: party.map((p, i) => (p ? i : -1)).filter(i => i >= 0),
    maxHp, hp: maxHp, enemies: [], turn: 1, pos: 0, results: [], target: null,
    pool: battleWordPool(index, state.words, wordRecs()), recent: [], answered: false,
  };
  loadWave();
  showScreen('battle');
  renderBattle();
  nextBattleQuestion();
}

function loadWave() {
  bt.enemies = bt.waves[bt.wave].map(e => ({ ...e, hp: e.max, cd: e.cdMax }));
  bt.target = null;
}

function renderBattle() {
  const st = STAGES[bt.index];
  $('bt-stage').textContent = `ステージ${bt.index + 1}　${st.place}`;
  $('bt-wave').textContent = bt.wave === 4 ? 'ボス戦！' : `${bt.wave + 1} / 5戦`;
  $('bt-turn').textContent = `ターン${bt.turn}`;
  $('bt-arena').style.background = stageBg(st);
  renderEnemies();
  renderTeam();
  renderTeamHp();
}

function renderEnemies() {
  const arena = $('bt-arena');
  arena.innerHTML = '';
  bt.enemies.forEach((e, i) => {
    const b = document.createElement('button');
    b.className = 'foe' + (e.boss ? ' is-boss' : '') + (e.hp <= 0 ? ' is-down' : '') + (bt.target === i ? ' is-target' : '');
    b.dataset.i = i;
    b.setAttribute('aria-label', `${e.name} 体力${e.hp}`);
    b.innerHTML = `<span class="foe-cd${e.cd <= 1 ? ' is-now' : ''}">あと${e.cd}</span>`
      + `<span class="foe-art">${buildAnimalSVG(e.kind)}</span>`
      + `<span class="foe-name">${escapeHtml(e.name)}</span>`
      + `<span class="foe-hp"><span style="width:${Math.max(0, e.hp / e.max) * 100}%"></span></span>`
      + (bt.target === i ? '<span class="foe-target">🎯</span>' : '');
    b.addEventListener('click', () => {
      if (e.hp <= 0) return;
      bt.target = bt.target === i ? null : i; // もう一度タップでねらいを外す
      renderEnemies();
    });
    arena.append(b);
  });
}

function renderTeam() {
  const team = $('bt-team');
  team.innerHTML = '';
  for (let slot = 0; slot < PARTY_SIZE; slot++) {
    const p = bt.party[slot];
    const div = document.createElement('div');
    div.className = 'bt-slot';
    div.dataset.slot = slot;
    const current = bt.slots[bt.pos] === slot && !bt.resolving;
    const r = bt.results[slot];
    const dot = !p ? '' : r === true ? '<span class="bt-dot is-ok">○</span>' : r === false ? '<span class="bt-dot is-ng">×</span>'
      : `<span class="bt-dot${current ? ' is-now' : ''}">${slot + 1}</span>`;
    div.innerHTML = (p ? catIconHTML(p.inst, { small: true, extra: slot === 0 ? '<span class="ci-crown">👑</span>' : '' }) : '<span class="party-empty is-mini"></span>') + dot;
    if (current) div.classList.add('is-turn');
    team.append(div);
  }
}

function renderTeamHp() {
  const ratio = Math.max(0, bt.hp / bt.maxHp);
  const fill = $('bt-hp-fill');
  fill.style.width = `${ratio * 100}%`;
  fill.classList.toggle('is-low', ratio <= 0.3);
  $('bt-hp-text').textContent = `${Math.max(0, bt.hp).toLocaleString()} / ${bt.maxHp.toLocaleString()}`;
}

// 出す単語：直前に出た単語は避ける
function pickBattleWord() {
  const recent = new Set(bt.recent);
  const candidates = bt.pool.filter(w => !recent.has(w.id));
  const list = candidates.length ? candidates : bt.pool;
  const word = list[Math.floor(Math.random() * list.length)];
  bt.recent.push(word.id);
  if (bt.recent.length > Math.min(20, Math.floor(bt.pool.length / 2))) bt.recent.shift();
  return word;
}

function nextBattleQuestion() {
  if (!bt || !bt.alive) return;
  bt.answered = false;
  const slot = bt.slots[bt.pos];
  const word = pickBattleWord();
  bt.word = word;
  $('bt-task').textContent = `${slot + 1}問目　正解すると左から${slot + 1}番目のネコが攻撃`;
  $('bt-word').textContent = word.word;
  $('bt-word').classList.toggle('is-long', word.word.length > 12);
  $('bt-message').textContent = '';
  const box = $('bt-choices');
  box.innerHTML = '';
  box.classList.remove('is-locked');
  makeChoices(word, state.words).forEach(choice => {
    const b = document.createElement('button');
    b.className = 'choice bt-choice';
    b.textContent = choice.meaning;
    b.dataset.id = choice.id;
    b.addEventListener('click', () => answerBattle(b, choice));
    box.append(b);
  });
  renderTeam();
}

function answerBattle(btn, choice) {
  if (!bt || !bt.alive || bt.answered) return;
  bt.answered = true;
  const ok = choice.id === bt.word.id;
  const box = $('bt-choices');
  box.classList.add('is-locked');
  if (ok) btn.classList.add('is-correct', 'is-picked');
  else {
    btn.classList.add('is-wrong');
    box.querySelector(`[data-id="${bt.word.id}"]`).classList.add('is-correct');
  }
  const settings = state.record.settings;
  if (settings.sound) ok ? playCorrect() : playWrong();
  if (settings.autoSpeak) speak(bt.word.word);
  recordChallengeAnswer(state.record, ok); // 今日の問題数・正解数には数える（単語ごとの記録は変えない）
  bt.results[bt.slots[bt.pos]] = ok;
  renderTeam();
  setTimeout(() => {
    if (!bt || !bt.alive) return;
    bt.pos++;
    if (bt.pos < bt.slots.length) nextBattleQuestion();
    else resolveTurn();
  }, ok ? BT_NEXT_CORRECT_MS : BT_NEXT_WRONG_MS);
}

function aliveEnemies() {
  return bt.enemies.filter(e => e.hp > 0);
}

// ねらう相手：タップでねらった相手が生きていればその相手、いなければ体力がいちばん少ない相手
function pickTarget() {
  if (bt.target !== null && bt.enemies[bt.target] && bt.enemies[bt.target].hp > 0) return bt.target;
  let best = -1;
  bt.enemies.forEach((e, i) => { if (e.hp > 0 && (best < 0 || e.hp < bt.enemies[best].hp)) best = i; });
  return best;
}

function popNumber(parent, text, cls) {
  const s = document.createElement('span');
  s.className = 'bt-pop ' + cls;
  s.textContent = text;
  parent.append(s);
  setTimeout(() => s.remove(), 900);
}

async function resolveTurn() {
  const token = bt;
  token.resolving = true;
  $('bt-choices').classList.add('is-locked');
  renderTeam();
  const { hits, heal } = computeAttacks(bt.party, bt.results);
  const correct = bt.results.filter(Boolean).length;
  if (correct === bt.slots.length && bt.slots.length >= 5) $('bt-message').textContent = '🔥 全問正解！ こうげき1.5倍！';
  else if (!hits.length) $('bt-message').textContent = '攻撃できなかった…';
  else $('bt-message').textContent = '';

  // 攻撃
  for (const h of hits) {
    if (!token.alive) return;
    const ti = pickTarget();
    if (ti < 0) break;
    const e = bt.enemies[ti];
    e.hp = Math.max(0, e.hp - h.dmg);
    const catEl = document.querySelector(`.bt-slot[data-slot="${h.slot}"]`);
    if (catEl) { catEl.classList.remove('is-attack'); void catEl.offsetWidth; catEl.classList.add('is-attack'); }
    renderEnemies();
    const foeEl = document.querySelector(`.foe[data-i="${ti}"]`);
    if (foeEl) { foeEl.classList.add('is-hit'); popNumber(foeEl, `-${h.dmg.toLocaleString()}`, 'is-dmg'); }
    await wait(BT_HIT_MS);
  }
  if (!token.alive) return;
  // 回復
  if (heal > 0 && bt.hp < bt.maxHp) {
    bt.hp = Math.min(bt.maxHp, bt.hp + heal);
    renderTeamHp();
    popNumber(document.querySelector('.bt-hp'), `+${heal.toLocaleString()}`, 'is-heal');
    await wait(350);
  }
  if (!token.alive) return;

  // ぜんぶ倒した
  if (!aliveEnemies().length) {
    bt.wavesCleared++;
    if (bt.wave === bt.waves.length - 1) { await wait(400); finishBattle(true); return; }
    $('bt-message').textContent = bt.wave === bt.waves.length - 2 ? '⚠️ ボスがあらわれた！' : 'つぎの相手！';
    await wait(900);
    if (!token.alive) return;
    bt.wave++;
    loadWave();
    endTurn();
    return;
  }

  // 相手の番：カウントが0になった相手が攻撃する
  for (const [i, e] of bt.enemies.entries()) {
    if (!token.alive) return;
    if (e.hp <= 0) continue;
    e.cd--;
    if (e.cd > 0) continue;
    e.cd = e.cdMax;
    const dmg = damageTaken(bt.party, e.atk);
    bt.hp = Math.max(0, bt.hp - dmg);
    renderEnemies();
    const foeEl = document.querySelector(`.foe[data-i="${i}"]`);
    if (foeEl) foeEl.classList.add('is-attacking');
    const screen = $('screen-battle');
    screen.classList.remove('is-damaged'); void screen.offsetWidth; screen.classList.add('is-damaged');
    renderTeamHp();
    popNumber(document.querySelector('.bt-hp'), `-${dmg.toLocaleString()}`, 'is-hurt');
    if (state.record.settings.sound) playWrong();
    await wait(550);
    if (bt.hp <= 0) { finishBattle(false); return; }
  }
  if (!token.alive) return;
  endTurn();
}

function endTurn() {
  bt.turn++;
  bt.pos = 0;
  bt.results = [];
  bt.resolving = false;
  renderBattle();
  nextBattleQuestion();
}

function finishBattle(won) {
  const record = state.record;
  const index = bt.index;
  bt.alive = false;
  const first = won ? recordStageClear(record, index) : false;
  const exp = battleExp(index, won, first, bt.wavesCleared);
  const lv = addPlayerExp(record, exp);
  const st = STAGES[index];
  const lines = [];
  if (won) {
    lines.push(`🎉 +${exp} プレーヤー経験値${first ? '（はじめてクリアで3倍！）' : ''}`);
    if (first && index + 1 < STAGES.length) lines.push(`🔓 ステージ${index + 2}「${STAGES[index + 1].place}」が開いた！`);
    if (first && index + 1 === STAGES.length) lines.push('👑 全ステージ制覇！ すごい！');
    if (first) lines.push('🏅 ランキングの名前の枠がランクアップ！');
  } else {
    lines.push(bt.wavesCleared ? `${bt.wavesCleared}戦目まで勝った！` : 'おしい！');
    lines.push(`+${exp} プレーヤー経験値`);
    lines.push('💡 熟語・ストーリーでフードを集めてネコを育てよう。かいふくの高いネコを入れるのもおすすめ');
  }
  if (lv.after > lv.before) lines.unshift(`⬆️ プレーヤー Lv${lv.before} → Lv${lv.after}！`);
  $('btr-art').innerHTML = `<span style="background:${stageBg(st)}">${buildAnimalSVG(st.boss[0])}</span>`;
  $('btr-art').classList.toggle('is-lost', !won);
  $('btr-title').textContent = won ? `ステージ${index + 1} クリア！` : 'まけちゃった…';
  $('btr-lines').innerHTML = lines.map(t => `<li>${escapeHtml(t)}</li>`).join('');
  const next = $('btn-btr-next');
  if (won && index + 1 < STAGES.length) {
    next.textContent = '次のステージ';
    next.onclick = () => { $('bt-result').hidden = true; startBattle(index + 1); };
  } else {
    next.textContent = 'もう一回';
    next.onclick = () => { $('bt-result').hidden = true; startBattle(index); };
  }
  if (won && state.record.settings.sound) playCorrect();
  $('bt-result').hidden = false;
  pushToCloud();
}

function quitBattle() {
  if (bt) bt.alive = false;
  $('bt-quit-dialog').hidden = true;
  saveRecord(state.record);
  showStages();
}

// ---------- ランキング ----------
// プレーヤーレベルの順。名前の枠はクリアしたいちばん先のステージで10段階

const FRAME_NAMES = ['', '木', '銅', '銀', '金', 'エメラルド', 'サファイア', 'ルビー', 'アメジスト', 'ダイヤ', '虹'];
const RANKING_CACHE_MS = 60 * 1000; // 1分以内に開き直したときは読み直さない（無料枠の読み取りを節約）
let rankingCache = null;

// 先生がニックネームを付けていない生徒の名前（本名は出さない）
function defaultNickname(uid) {
  let h = 0;
  for (const ch of String(uid)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `ネコ使い${1000 + (h % 9000)}号`;
}

function rankRowHTML(r, rank, isMe) {
  const medal = ['🥇', '🥈', '🥉'][rank - 1] || rank;
  const frame = Math.max(0, Math.min(10, r.bestStage || 0));
  const icons = (r.party || []).map(p => catIconHTML({ id: p.id, exp: expAtLevel(p.lv), koban: p.kb || 0 }, { small: true })).join('');
  const name = r.nickname || defaultNickname(r.uid);
  return `<li class="rk-row${isMe ? ' is-me' : ''}">`
    + `<span class="rk-rank${rank <= 3 ? ' is-top' : ''}">${medal}</span>`
    + `<div class="rk-main">`
    + `<div class="rk-top"><span class="rk-name f${frame}" title="${frame ? `${FRAME_NAMES[frame]}の枠` : ''}">${escapeHtml(name)}${isMe ? '<small>（あなた）</small>' : ''}</span><span class="rk-lv">Lv${r.level}</span></div>`
    + `<div class="rk-party">${icons || '<span class="rk-noparty">パーティなし</span>'}<span class="rk-zukan">図鑑 ${r.zukan || 0}</span></div>`
    + `</div></li>`;
}

function renderRanking(list, meUid) {
  list.sort((a, b) => (b.level - a.level) || ((b.exp || 0) - (a.exp || 0)) || ((b.bestStage || 0) - (a.bestStage || 0)));
  $('rk-list').innerHTML = list.map((r, i) => rankRowHTML(r, i + 1, r.uid === meUid)).join('');
  const me = $('rk-list').querySelector('.is-me');
  if (me) requestAnimationFrame(() => me.scrollIntoView({ block: 'center' }));
}

async function showRanking() {
  showScreen('ranking');
  const status = $('rk-status');
  const meUid = state.user ? state.user.uid : 'me';
  const me = { uid: meUid, ...buildRankingDoc(state.record), nickname: '' };
  if (!state.user || !cloudEnabled()) {
    status.textContent = 'ほかの人のランキングは、ログインしているときに見られます';
    status.hidden = false;
    renderRanking([me], meUid);
    return;
  }
  status.textContent = 'よみこみ中…';
  status.hidden = false;
  $('rk-list').innerHTML = '';
  try {
    pushToCloud(); // 自分の最新の記録も送っておく
    if (!rankingCache || Date.now() - rankingCache.at > RANKING_CACHE_MS) {
      rankingCache = { at: Date.now(), list: await cloudFetchRanking() };
    }
  } catch (e) {
    status.textContent = 'ランキングを読めませんでした。インターネットにつないでね';
    renderRanking([me], meUid);
    return;
  }
  status.hidden = true;
  const fetched = rankingCache.list.find(r => r.uid === meUid);
  // 自分は端末の最新の記録で出す（名前は先生が付けたもの）
  const list = rankingCache.list.filter(r => r.uid !== meUid);
  list.push({ ...me, nickname: fetched ? fetched.nickname : '' });
  renderRanking(list, meUid);
}

function initBattleUI() {
  $('btn-ranking').addEventListener('click', showRanking);
  $('btn-ranking-back').addEventListener('click', showStages);
  $('btn-battle').addEventListener('click', showStages);
  $('btn-stages-back').addEventListener('click', showHome);
  $('btn-edit-party').addEventListener('click', () => showCats('stages'));
  $('btn-bt-quit').addEventListener('click', () => { $('bt-quit-dialog').hidden = false; });
  $('btn-btq-cancel').addEventListener('click', () => { $('bt-quit-dialog').hidden = true; });
  $('btn-btq-ok').addEventListener('click', quitBattle);
  $('btn-btr-list').addEventListener('click', () => { $('bt-result').hidden = true; showStages(); });
}
