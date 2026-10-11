// 今日のミッション
// 1つ目はいつも「1セットやる」。残り2つは下の中から日付で選ぶ（同じ日ならどの端末でも同じ）。
// 達成したかどうかは、その日の記録（usage）から毎回計算するので、別に保存はしない。

const MISSION_ALWAYS = { id: 'any', label: '1セットやる', done: u => u.sets >= 1 };

// group が同じミッションは、同じ日に2つ出さない（「3連続」と「5連続」が並ぶなど）
const MISSION_POOL = [
  { id: 'words', group: 'mode', label: '単語を1セットやる', done: u => u.wordSets >= 1 },
  { id: 'story', group: 'mode', label: '文章を1セットやる', done: u => u.sentenceSets >= 1 },
  { id: 'challenge', group: 'mode', label: '1分チャレンジをやる', done: u => u.challenges >= 1 },
  { id: 'combo3', group: 'combo', label: '3連続正解する', done: u => u.bestCombo >= 3 },
  { id: 'combo5', group: 'combo', label: '5連続正解する', done: u => u.bestCombo >= 5 },
  { id: 'correct20', group: 'amount', label: '今日20問正解する', done: u => u.correct >= 20 },
  { id: 'sets2', group: 'amount', label: '2セットやる', done: u => u.sets >= 2 },
];

// 日付から決まる乱数（同じ日付なら同じ並びになる）
function seededRandom(seedText) {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function todayMissions(date = localDate()) {
  const rand = seededRandom('missions:' + date);
  const pool = MISSION_POOL.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = [];
  for (const m of pool) {
    if (picked.length >= 2) break;
    if (!picked.some(p => p.group === m.group)) picked.push(m);
  }
  return [MISSION_ALWAYS, ...picked];
}

// [{ id, label, done }]
function missionStatus(record, date = localDate()) {
  const u = { ...emptyUsage(), ...record.usage[date] };
  return todayMissions(date).map(m => ({ id: m.id, label: m.label, done: m.done(u) }));
}
