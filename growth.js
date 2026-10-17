// ネコの育成（レベル・経験値フード・小判・合成・パーティ）
// ・ダブったネコも1匹ずつ別のネコとして持つ（record.cats）。図鑑（record.collection）は「今までに手に入れた数」
// ・経験値フードは熟語とストーリーでもらえる（お金では買えない）
// ・レベルは上がるほど次に上がりにくい。熟語・ストーリーを合計100セットくらいで1匹がLv99
// ・ステータスは HP・こうげき・かいふく。タイプ（画面には出さない）とネコごとの個性で数値がちがう

const MAX_CAT_LEVEL = 99;
const MAX_KOBAN = 5;
const KOBAN_BONUS = 0.04;   // 小判1つでステータス +4%
const PARTY_SIZE = 5;
const FOOD_EXP = { s: 100, m: 200 }; // フード小・中で増える経験値
const FOOD_PER_CORRECT = 1; // 熟語・ストーリーで1問正解 → フード小1個
const FOOD_PER_SET = 1;     // 1セット終える → フード中1個
const RARITY_POWER = { N: 1, R: 1.2, SR: 1.4 };

// タイプごとの Lv1 と Lv99 のステータス（N・小判なし）
const TYPE_STATS = {
  hp:  { hp: [400, 4000], atk: [60, 600],   rcv: [20, 200] }, // たいりょく型
  atk: { hp: [220, 2200], atk: [110, 1100], rcv: [15, 150] }, // こうげき型
  rcv: { hp: [260, 2600], atk: [60, 600],   rcv: [60, 600] }, // かいふく型
  bal: { hp: [300, 3000], atk: [80, 800],   rcv: [35, 350] }, // バランス型
};

// ネコごとのタイプ（キャラに合わせて決めた）
const CAT_TYPES = {
  // N
  18: 'hp', 19: 'hp', 25: 'hp', 29: 'hp', 31: 'hp', 40: 'hp',
  27: 'atk', 30: 'atk', 32: 'atk', 36: 'atk', 38: 'atk', 39: 'atk',
  17: 'rcv', 20: 'rcv', 21: 'rcv', 22: 'rcv', 24: 'rcv', 28: 'rcv',
  23: 'bal', 26: 'bal', 33: 'bal', 34: 'bal', 35: 'bal', 37: 'bal',
  // R
  7: 'hp', 10: 'hp', 12: 'hp',
  5: 'atk', 6: 'atk', 8: 'atk',
  11: 'rcv', 14: 'rcv', 16: 'rcv',
  9: 'bal', 13: 'bal', 15: 'bal',
  // SR
  1: 'bal', 2: 'atk', 3: 'rcv', 4: 'hp',
  // 期間限定（歴史人物ネコ）
  101: 'atk', 102: 'bal', 103: 'rcv', 104: 'atk', 105: 'rcv',
  106: 'bal', 107: 'rcv', 108: 'hp', 109: 'atk', 110: 'hp',
};

// とくせい（R・SR だけ。パーティのリーダー＝1問目のネコのとくせいだけが効く）
// kind: allAtk（5問全部正解のターンこうげき×v）／atk3（3問以上正解のターンこうげき×v）／atk（こうげき×v）
//       edgeAtk（1問目と5問目のネコのこうげき×v）／teamHp（チームの体力×v）／rcv（かいふく×v）／guard（受けるダメージ -v）
// 強すぎると育てなくても勝ててしまうので、R は 1.2〜1.4 倍、SR は 1.3〜1.8 倍くらいにしてある
const CAT_SKILLS = {
  5: { kind: 'edgeAtk', v: 1.5 }, 6: { kind: 'atk3', v: 1.25 }, 7: { kind: 'guard', v: 0.15 },
  8: { kind: 'atk', v: 1.15 }, 9: { kind: 'rcv', v: 1.4 }, 10: { kind: 'teamHp', v: 1.2 },
  11: { kind: 'rcv', v: 1.4 }, 12: { kind: 'teamHp', v: 1.2 }, 13: { kind: 'atk', v: 1.15 },
  14: { kind: 'rcv', v: 1.3 }, 15: { kind: 'atk3', v: 1.25 }, 16: { kind: 'guard', v: 0.15 },
  1: { kind: 'allAtk', v: 1.5 }, 2: { kind: 'atk', v: 1.3 }, 3: { kind: 'rcv', v: 1.8 }, 4: { kind: 'teamHp', v: 1.4 },
  101: { kind: 'allAtk', v: 1.5 }, 102: { kind: 'atk3', v: 1.4 }, 103: { kind: 'rcv', v: 1.8 },
  104: { kind: 'edgeAtk', v: 1.8 }, 105: { kind: 'rcv', v: 1.7 }, 106: { kind: 'teamHp', v: 1.35 },
  107: { kind: 'guard', v: 0.25 }, 108: { kind: 'teamHp', v: 1.45 }, 109: { kind: 'atk', v: 1.3 }, 110: { kind: 'guard', v: 0.22 },
};

function skillText(skill) {
  if (!skill) return '';
  const v = skill.v;
  switch (skill.kind) {
    case 'allAtk': return `5問全部正解したターン、こうげき ${v}倍`;
    case 'atk3': return `3問以上正解したターン、こうげき ${v}倍`;
    case 'atk': return `チームのこうげき ${v}倍`;
    case 'edgeAtk': return `1問目と5問目のネコのこうげき ${v}倍`;
    case 'teamHp': return `チームの体力 ${v}倍`;
    case 'rcv': return `チームのかいふく ${v}倍`;
    case 'guard': return `受けるダメージ ${Math.round(v * 100)}%カット`;
    default: return '';
  }
}

// ネコごとの個性：同じタイプでも HP・こうげき・かいふくが 0.90〜1.10 倍の範囲で少しずつちがう
function catPersonality(id) {
  const f = k => 0.9 + (((id * 37 + k * 101 + id * id * 7) % 21) / 100);
  return { hp: f(1), atk: f(2), rcv: f(3) };
}

// ---------- レベル ----------

// Lv → Lv+1 に必要な経験値（上がるほど多くなる）
function expToNext(level) {
  return Math.round(200 + 0.252 * level * level);
}

// 経験値の合計からレベルを出す
function levelFromExp(exp) {
  let level = 1;
  let rest = exp;
  while (level < MAX_CAT_LEVEL && rest >= expToNext(level)) {
    rest -= expToNext(level);
    level++;
  }
  return { level, into: rest, need: level < MAX_CAT_LEVEL ? expToNext(level) : 0 };
}

// そのレベルになったばかりのときの経験値の合計（ランキングのアイコンなど、レベルだけわかっているとき用）
function expAtLevel(level) {
  let n = 0;
  for (let l = 1; l < Math.min(level, MAX_CAT_LEVEL); l++) n += expToNext(l);
  return n;
}

// Lv99 になるのに必要な経験値の合計
const MAX_CAT_EXP = (() => { let n = 0; for (let l = 1; l < MAX_CAT_LEVEL; l++) n += expToNext(l); return n; })();

// ---------- ステータス ----------

function catStats(inst) {
  const cat = findCat(inst.id);
  const type = TYPE_STATS[CAT_TYPES[inst.id] || 'bal'];
  const { level } = levelFromExp(inst.exp);
  const p = catPersonality(inst.id);
  const mul = RARITY_POWER[cat.rarity] * (1 + KOBAN_BONUS * inst.koban);
  const at = ([a, b], k) => Math.round((a + (b - a) * (level - 1) / (MAX_CAT_LEVEL - 1)) * p[k] * mul);
  return { level, hp: at(type.hp, 'hp'), atk: at(type.atk, 'atk'), rcv: at(type.rcv, 'rcv') };
}

// バーの長さ用：そのステータスの「SR・Lv99・小判5」でいちばん高いタイプを 100% とする
const STAT_MAX = { hp: 4000 * 1.1 * 1.4 * 1.2, atk: 1100 * 1.1 * 1.4 * 1.2, rcv: 600 * 1.1 * 1.4 * 1.2 };

function isKami(inst) {
  return inst.koban >= MAX_KOBAN && levelFromExp(inst.exp).level >= MAX_CAT_LEVEL;
}

// ---------- 記録 ----------

// 育成の記録がなければ作る。前の版で手に入れていたネコ（ダブりの枚数も）を1匹ずつ受け取る
function ensureGrowth(record) {
  if (!record.food) record.food = { s: 0, m: 0 };
  if (!Array.isArray(record.party)) record.party = [];
  if (!record.player) record.player = { exp: 0, bestStage: 0 };
  if (!Array.isArray(record.cats)) {
    record.cats = [];
    record.nextCatUid = 1;
    for (const [id, n] of Object.entries(record.collection || {})) {
      for (let i = 0; i < n; i++) record.cats.push(newCatInstance(record, Number(id)));
    }
  }
  if (!record.nextCatUid) record.nextCatUid = record.cats.reduce((m, c) => Math.max(m, c.uid), 0) + 1;
}

function newCatInstance(record, id) {
  return { uid: record.nextCatUid++, id, exp: 0, koban: 0 };
}

// ガチャ・交換で手に入れたとき
function addCatInstance(record, id) {
  ensureGrowth(record);
  const inst = newCatInstance(record, id);
  record.cats.push(inst);
  return inst;
}

function findInstance(record, uid) {
  return record.cats.find(c => c.uid === uid);
}

function addFood(record, s, m) {
  ensureGrowth(record);
  record.food.s += s;
  record.food.m += m;
  record.stats.foodEarned = (record.stats.foodEarned || 0) + s * FOOD_EXP.s + m * FOOD_EXP.m;
  touchRecord(record);
  saveRecord(record);
}

// フードを1個あげる。レベルが上がったら新しいレベルを返す（上がらなければ 0、あげられなければ -1）
function feedCat(record, uid, size) {
  ensureGrowth(record);
  const inst = findInstance(record, uid);
  if (!inst || record.food[size] <= 0 || inst.exp >= MAX_CAT_EXP) return -1;
  const before = levelFromExp(inst.exp).level;
  record.food[size]--;
  inst.exp = Math.min(inst.exp + FOOD_EXP[size], MAX_CAT_EXP);
  touchRecord(record);
  saveRecord(record);
  const after = levelFromExp(inst.exp).level;
  return after > before ? after : 0;
}

// 次のレベルまで、小さいフードから順にあげる。上がったレベル（上がらなければ 0）
function feedToNextLevel(record, uid) {
  const inst = findInstance(record, uid);
  if (!inst) return 0;
  const start = levelFromExp(inst.exp).level;
  while (levelFromExp(inst.exp).level === start && inst.exp < MAX_CAT_EXP) {
    const size = record.food.s > 0 ? 's' : record.food.m > 0 ? 'm' : null;
    if (!size || feedCat(record, uid, size) < 0) break;
  }
  const now = levelFromExp(inst.exp).level;
  return now > start ? now : 0;
}

// 合成の素材にできるネコ：同じネコで、パーティに入っていないもの（レベルの低い順）
function mergeMaterials(record, uid) {
  const base = findInstance(record, uid);
  if (!base) return [];
  return record.cats
    .filter(c => c.id === base.id && c.uid !== uid && !record.party.includes(c.uid))
    .sort((a, b) => (a.exp - b.exp) || (a.koban - b.koban));
}

// 合成：素材のネコは消え、小判 +1。素材に使っていたフードの半分が戻る。戻ったフード { s, m } を返す
function mergeCats(record, baseUid, materialUid) {
  const base = findInstance(record, baseUid);
  const mat = findInstance(record, materialUid);
  if (!base || !mat || base.id !== mat.id || base.uid === mat.uid || base.koban >= MAX_KOBAN) return null;
  base.koban++;
  record.cats = record.cats.filter(c => c.uid !== materialUid);
  record.party = record.party.filter(u => u !== materialUid);
  const back = Math.floor(mat.exp / 2);
  const refund = { m: Math.floor(back / FOOD_EXP.m), s: Math.floor((back % FOOD_EXP.m) / FOOD_EXP.s) };
  record.food.m += refund.m;
  record.food.s += refund.s;
  touchRecord(record);
  saveRecord(record);
  return refund;
}

// パーティの slot 番目（0 = 1問目 = いちばん左 = リーダー）にネコを入れる。すでに別の場所にいたら入れかえる
function setPartySlot(record, slot, uid) {
  ensureGrowth(record);
  const party = record.party.slice();
  while (party.length < PARTY_SIZE) party.push(null);
  const from = party.indexOf(uid);
  if (from >= 0) party[from] = party[slot];
  party[slot] = uid;
  record.party = party;
  touchRecord(record);
  saveRecord(record);
}

function removeFromParty(record, uid) {
  record.party = record.party.map(u => (u === uid ? null : u));
  touchRecord(record);
  saveRecord(record);
}

// パーティのネコ（空いている場所は null）
function partyInstances(record) {
  ensureGrowth(record);
  const out = [];
  for (let i = 0; i < PARTY_SIZE; i++) out.push(record.party[i] ? findInstance(record, record.party[i]) || null : null);
  return out;
}

// ---------- アイコン ----------

// 正方形のアイコン：下の真ん中に Lv、左上に小判の数（Lv99・小判5 は「神」）
function catIconHTML(inst, { small = false, extra = '' } = {}) {
  const cat = findCat(inst.id);
  const r = cat.limited ? 'lim' : cat.rarity.toLowerCase();
  const { level } = levelFromExp(inst.exp);
  const badge = isKami(inst) ? '<span class="ci-kami">神</span>'
    : inst.koban ? `<span class="ci-koban"><i></i>${inst.koban}</span>` : '';
  return `<span class="cat-icon ${r}${small ? ' is-small' : ''}">${buildCatSVG(cat)}${badge}<span class="ci-lv">Lv${level}</span>${extra}</span>`;
}
