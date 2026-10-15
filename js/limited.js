// 期間限定ガチャ（3日ごとに自動で入れかわる）
// ・期間ごとに、期間限定の SR ネコが1匹だけ出る。期間が終わったら、基本的には手に入らない
// ・N と R は通常ガチャと同じネコ。出る確率も通常ガチャと同じ（SR が出たら、その期間のネコ確定）
// ・期間は日本時間の0時で切りかわる。スマホの時計ではなく、インターネット上の時刻で判定する
// ・先生は管理者ページから、過去のネコを一時的に復刻できる（config/gacha の rerunCat・rerunUntil）

const LIMITED_START_DATE = '2026-10-16'; // 1回目の期間が始まる日（日本時間）
const LIMITED_PERIOD_DAYS = 3;

// テーマ：日本史の歴史人物ネコ。並び順が出る順番。足りなくなる前に次の10匹を足す
const LIMITED_CATS = [
  { id: 101, rarity: 'SR', limited: true, type: 'cool', name: '天下布武の織田ノブニャガ', food: '金平糖（南蛮わたり）', skill: '天下統一（ただし昼寝の場所取り）', quote: '是非もにゃし',
    art: { fur: '#3a3a48', line: '#1b1b22', whisker: '#d6d6e4', mouthLine: '#e8e8f0', earInner: '#ff8fa3', eyes: 'sharp', eyeColor: '#ffd54a', mouth: 'fang', noCheeks: true,
      bg: { type: 'gradient', colors: ['#ffe9a8', '#e0a52a'] }, items: ['castle', { name: 'cape', color: '#2b2b38', trim: '#c8323c', collar: false }, { name: 'kabuto', color: '#2b2b38', crest: 'mon' }] } },
  { id: 102, rarity: 'SR', limited: true, type: 'cool', name: '夜明けの坂本リョウニャ', food: 'しゃも鍋', skill: '日本の洗たく（自分の服は洗わない）', quote: '夜明けは近いにゃ',
    art: { fur: '#c8915e', eyes: 'sharp', eyeColor: '#7ec8ff', noCheeks: true, bg: { type: 'gradient', colors: ['#ffcf8a', '#5aa8e0'] }, items: ['seaSunrise', { name: 'kimono', color: '#3d4a6b', collar: '#e8e0d0' }, 'topknot', 'boots', 'letter'] } },
  { id: 103, rarity: 'SR', limited: true, type: 'cute', name: '邪馬台国の女王ヒミャコ', food: '鏡にうつる自分', skill: 'うらない（明日の給食を当てる）', quote: '明日はカレーと出たにゃ',
    art: { fur: '#fff3e0', eyes: 'calm', bg: { type: 'radial', colors: ['#fff6c9', '#f0b44a'] }, items: ['sunrays', { name: 'kimono', color: '#f4f1ea', collar: '#c8323c' }, 'magatama', 'sunCrown', 'mirror'] } },
  { id: 104, rarity: 'SR', limited: true, type: 'cool', name: '独眼竜の伊達マサムネコ', food: 'ずんだもち', skill: 'おしゃれ（元祖・伊達者）', quote: '眼帯はファッションにゃ',
    art: { fur: '#e0c9a6', eyes: 'sharp', eyeColor: '#9be37a', noCheeks: true, bg: { type: 'gradient', colors: ['#2c2f6b', '#10132e'], pattern: 'stars' }, items: ['bigMoon', { name: 'kimono', color: '#2b2b38', collar: '#ffd54a' }, 'eyepatch', { name: 'kabuto', color: '#2b2b38', crest: 'moon' }] } },
  { id: 105, rarity: 'SR', limited: true, type: 'cute', name: '物語の名人・紫式ニャ部', food: '墨のにおい', skill: '長い物語を書く（しめ切りはギリギリ）', quote: '続きはまた明日にゃ',
    art: { fur: '#fffaf2', eyes: 'calm', bg: { type: 'gradient', colors: ['#efe3ff', '#c9b3f0'] }, items: ['wisteria', 'longHair', 'junihitoe', 'brush'] } },
  { id: 106, rarity: 'SR', limited: true, type: 'cool', name: '大出世の豊臣ヒデニャシ', food: 'あたためておいた草履', skill: '出世（3日で城を建てる）', quote: 'ここまで長かったにゃ',
    art: { fur: '#f2b97a', eyes: 'happy', mouth: 'open', bg: { type: 'gradient', colors: ['#fff1b8', '#e8b13a'] }, items: ['byobu', { name: 'kimono', color: '#c8323c', collar: '#ffd54a' }, 'gourd', { name: 'kabuto', color: '#d4a017', crest: 'rays' }] } },
  { id: 107, rarity: 'SR', limited: true, type: 'cool', name: '十人の話を聞く聖徳ニャイシ', food: '十人分のおやつ', skill: '十人の話を同時に聞く（返事は一人ずつ）', quote: '和をもって尊しとなすにゃ',
    art: { fur: '#f5deb3', eyes: 'calm', bg: { type: 'gradient', colors: ['#e8f4e0', '#9cc59a'] }, items: ['pagoda', { name: 'kimono', color: '#6c4a9e', collar: '#f4f1ea' }, 'kanmuri', 'shaku'] } },
  { id: 108, rarity: 'SR', limited: true, type: 'cute', name: 'おいどんの西郷タカモニャ', food: 'さつまいも', skill: '犬の散歩（ネコなのに）', quote: 'おいどんはネコでごわす',
    art: { fur: '#5a4a3e', line: '#1b1b22', whisker: '#e8e0d0', mouthLine: '#e8e0d0', earInner: '#ff8fa3', shape: 'chubby', eyes: 'glare', bg: { type: 'gradient', colors: ['#ffe4ec', '#ffc2d4'], pattern: 'flowers' }, items: ['sakura', { name: 'kimono', color: '#2f3b5c', collar: '#e8e0d0', rx: 50, ry: 38 }, 'dog'] } },
  { id: 109, rarity: 'SR', limited: true, type: 'cool', name: '八艘とびの源ヨシツニャ', food: 'きびだんご', skill: '八艘とび（ジャンプで船を8つ）', quote: '身軽さなら負けないにゃ',
    art: { fur: '#ffffff', eyes: 'sharp', eyeColor: '#ffd54a', noCheeks: true, bg: { type: 'gradient', colors: ['#bfe6ff', '#2f86c8'] }, items: ['boats', { name: 'kimono', color: '#e8e0d0', collar: '#c8323c' }, 'eboshi', 'fan'] } },
  { id: 110, rarity: 'SR', limited: true, type: 'cool', name: '鳴くまで待つ徳川イエニャス', food: '天ぷら', skill: 'がまん（鳴くまで待つ）', quote: '急がば回れにゃ',
    art: { fur: '#a7adb8', pattern: 'tabby', patternColor: '#6b7280', tail: '#a7adb8', eyes: 'relaxed', bg: { type: 'gradient', colors: ['#d6ecff', '#8fb8e0'] }, items: ['fuji', { name: 'kimono', color: '#2b5f3a', collar: '#ffd54a' }, { name: 'kabuto', color: '#2b2b38', crest: 'aoi' }] } },
];

// ---------- 期間の計算 ----------

// 日本時間の日付 "YYYY-MM-DD"（ms はインターネット上の時刻）
function jstDate(ms) {
  return new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
}

// その時刻の期間番号（0 から）。始まる前なら -1
function limitedPeriodIndex(ms) {
  const d = daysBetween(LIMITED_START_DATE, jstDate(ms));
  return d < 0 ? -1 : Math.floor(d / LIMITED_PERIOD_DAYS);
}

// 期間 i の始まり・終わり（日本時間の日付。end は最後の日）
function limitedPeriodDates(i) {
  const start = addDays(LIMITED_START_DATE, i * LIMITED_PERIOD_DAYS);
  return { start, end: addDays(start, LIMITED_PERIOD_DAYS - 1) };
}

// 期間が終わる時刻（ms）：最後の日の次の日の日本時間0時
function limitedPeriodEndMs(i) {
  const next = addDays(limitedPeriodDates(i).end, 1);
  return Date.parse(next + 'T00:00:00+09:00');
}

// いま出ている期間限定ネコ（先生の復刻を含む）。何もなければ空
function currentLimitedCats(ms, config = {}) {
  const i = limitedPeriodIndex(ms);
  const cats = [];
  if (i >= 0 && i < LIMITED_CATS.length) cats.push(LIMITED_CATS[i]);
  if (config.rerunCat && config.rerunUntil && jstDate(ms) <= config.rerunUntil) {
    const re = LIMITED_CATS.find(c => c.id === config.rerunCat);
    // 復刻できるのは、もう期間が終わったネコだけ
    if (re && LIMITED_CATS.indexOf(re) < i && !cats.includes(re)) cats.push(re);
  }
  return cats;
}

// 図鑑に出すネコ：期間が始まったものだけ（これから出るネコは見せない）
function revealedLimitedCats(ms) {
  const i = ms ? limitedPeriodIndex(ms) : -1;
  return LIMITED_CATS.slice(0, Math.max(i + 1, 0));
}

// ---------- インターネット上の時刻 ----------
// スマホの時計を変えて過去のネコを引くズルを防ぐため、サーバーが返す時刻（Date ヘッダー）を使う

let serverClock = null; // { serverMs, perfAt }

async function fetchServerTime() {
  try {
    const res = await fetch(`./?t=${Date.now()}`, { method: 'HEAD', cache: 'no-store' });
    const date = res.headers.get('Date');
    if (!date) return null;
    serverClock = { serverMs: Date.parse(date), perfAt: performance.now() };
    return serverClock.serverMs;
  } catch (e) {
    return null; // 電波がない
  }
}

// 最後に確かめたサーバー時刻から、経過時間を足して今の時刻を出す（スマホの時計には頼らない）
function serverNow() {
  if (!serverClock) return null;
  return serverClock.serverMs + (performance.now() - serverClock.perfAt);
}
