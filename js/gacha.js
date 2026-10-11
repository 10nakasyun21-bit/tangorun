// コイン・ガチャ・図鑑
// コインは勉強でしかもらえない（お金では買えない）。

const GACHA_COST = 30;
const GACHA_RATES = [['SR', 2], ['R', 25], ['N', 73]]; // 出る確率（%）
// かけらはレア度ごとに分かれている。ダブり1枚で、そのレア度のかけらが1個。
// 交換できるのは同じレア度のネコだけ（SR のかけらは SR がダブったときしか手に入らない）
const FRAGMENTS_TO_EXCHANGE = { N: 10, R: 10, SR: 6 };
const RARITIES = ['N', 'R', 'SR'];

const COIN_PER_CORRECT = 1;
const COIN_PER_SET = 5;
const COIN_PER_MISSION = 10;
const COIN_PER_CHALLENGE = 5;

// 期間限定シリーズ（管理者ページで開始・終了を切り替える）
// 例：{ id: 'summer', name: '夏祭りシリーズ', cats: [ { id: 101, ... } ] }
// ネコの id は通常シリーズ（1〜40）と重ならないように 101 以降を使う
const LIMITED_SERIES = [];

function allCats() {
  return [...CATS, ...LIMITED_SERIES.flatMap(s => s.cats.map(c => ({ ...c, series: s.id })))];
}

function findCat(id) {
  return allCats().find(c => c.id === Number(id));
}

function limitedSeries(id) {
  return LIMITED_SERIES.find(s => s.id === id) || null;
}

// ---------- 記録 ----------

function ensureCollection(record) {
  if (typeof record.coins !== 'number') record.coins = 0;
  if (!record.collection) record.collection = {}; // ネコの id → 持っている枚数
  record.fragments = normalizeFragments(record.fragments);
  if (record.partner === undefined) record.partner = null;
}

function addCoins(record, amount) {
  ensureCollection(record);
  record.coins += amount;
  record.stats.coinsEarned = (record.stats.coinsEarned || 0) + amount;
  touchRecord(record);
  saveRecord(record);
}

function ownedCount(record, cats = CATS) {
  ensureCollection(record);
  return cats.filter(c => record.collection[c.id] > 0).length;
}

// ---------- ガチャ ----------

function rollRarity() {
  let r = Math.random() * 100;
  for (const [rarity, rate] of GACHA_RATES) {
    if (r < rate) return rarity;
    r -= rate;
  }
  return 'N';
}

// 1回引く。コインが足りなければ null
// pool：引けるネコの一覧（通常シリーズ or 期間限定シリーズ）
function drawGacha(record, pool) {
  ensureCollection(record);
  if (record.coins < GACHA_COST) return null;
  let rarity = rollRarity();
  // そのレア度のネコがいないシリーズなら、いるレア度に下げる
  while (!pool.some(c => c.rarity === rarity)) rarity = rarity === 'SR' ? 'R' : 'N';
  const candidates = pool.filter(c => c.rarity === rarity);
  const cat = candidates[Math.floor(Math.random() * candidates.length)];

  record.coins -= GACHA_COST;
  const isNew = !(record.collection[cat.id] > 0);
  record.collection[cat.id] = (record.collection[cat.id] || 0) + 1;
  let fragments = 0;
  if (!isNew) {
    fragments = 1;
    record.fragments[cat.rarity] += fragments;
  }
  record.stats.gachaCount = (record.stats.gachaCount || 0) + 1;
  touchRecord(record);
  saveRecord(record);
  return { cat, isNew, fragments };
}

// 同じレア度のかけらで、まだ持っていないネコと交換する
function exchangeFragments(record, cat) {
  ensureCollection(record);
  const cost = FRAGMENTS_TO_EXCHANGE[cat.rarity];
  if (record.collection[cat.id] > 0 || record.fragments[cat.rarity] < cost) return false;
  record.fragments[cat.rarity] -= cost;
  record.collection[cat.id] = 1;
  touchRecord(record);
  saveRecord(record);
  return true;
}

function setPartner(record, catId) {
  ensureCollection(record);
  record.partner = catId;
  touchRecord(record);
  saveRecord(record);
}

// ---------- カードの見た目 ----------

const SPARKLE_SVG = '<svg viewBox="0 0 24 24"><path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z" fill="currentColor"/></svg>';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// N / R / SR のカード1枚（HTML 文字列）
function catCardHTML(cat) {
  const r = cat.rarity.toLowerCase();
  const sr = cat.rarity === 'SR';
  const sparkleColors = ['#fff8c4', '#d6f3ff', '#ffd6f0', '#fff8c4', '#ffffff', '#fff8c4'];
  return `<div class="card ${r}">`
    + (sr ? '<div class="aura"></div><div class="frame"></div>' : '')
    + `<div class="card-inner">`
    + `<div class="card-head"><span class="rarity">${cat.rarity}</span><span class="type ${cat.type}">${cat.type === 'cute' ? 'かわいい系' : 'かっこいい系'}</span><span class="no">No.${String(cat.id).padStart(2, '0')}</span></div>`
    + `<div class="art-box">${buildCatSVG(cat)}${sr ? '<div class="holo"></div>' : ''}</div>`
    + `<p class="name">${escapeHtml(cat.name)}</p>`
    + `<ul class="profile"><li><b>好物</b><span>${escapeHtml(cat.food)}</span></li><li><b>特技</b><span>${escapeHtml(cat.skill)}</span></li></ul>`
    + `<p class="quote">「${escapeHtml(cat.quote)}」</p>`
    + `</div>`
    + (sr ? sparkleColors.map((c, i) => `<span class="sparkle s${i + 1}" style="color:${c}">${SPARKLE_SVG}</span>`).join('') : '')
    + `</div>`;
}
