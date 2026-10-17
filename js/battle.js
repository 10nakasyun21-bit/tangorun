// 対戦（ボットのステージ）
// ・全10ステージ。1から順に、クリアすると次が開く。1ステージ＝5戦（5戦目はボス）
// ・1ターンに単語の問題がパーティの数だけ（最大5問）。n問目に正解すると、右からn番目のネコが攻撃し、体力も少し回復する
// ・5問全部正解でこうげき1.5倍。リーダー（1問目のネコ）のとくせいだけが効く
// ・チームの体力は5匹のHPの合計。5戦のあいだ持ち越す。途中で負けたら1戦目からやり直し
// ・相手は「あと○ターン」で攻撃。制限時間はなし
// ・単語ごとの記録（復習・レベル）は変えない。ごほうびはプレーヤー経験値だけ

const BATTLE_MIN_WORDS = 10;   // 出会った単語がこの数になると遊べる
const ALL_CORRECT_BONUS = 1.5;
const NEXT_WORDS_FOR_MID = 50; // ステージ4〜7は「出会った単語＋次に出る50語」

// ステージの見た目と相手。ref はそのステージの「勝てる目安」のチーム（相手の強さはここから計算する）
//   ref: [タイプ, レア度, Lv, 小判] × 人数
const STAGES = [
  { place: '町はずれ', bg: ['#e6f3ff', '#cfe6c4'], a: ['mouse', 'ネズミ'], b: ['sparrow', 'スズメ'], boss: ['crow', 'カラス'],
    hint: 'Lv1でOK', ref: [['bal', 'N', 1, 0], ['hp', 'N', 1, 0], ['atk', 'N', 1, 0]] },
  { place: 'はらっぱ', bg: ['#e0f4ff', '#b9e39c'], a: ['rabbit', 'ウサギ'], b: ['frog', 'カエル'], boss: ['tanuki', 'タヌキ'],
    hint: 'Lv10', ref: [['bal', 'N', 10, 0], ['hp', 'N', 10, 0], ['atk', 'N', 10, 0], ['rcv', 'N', 10, 0]] },
  { place: '森', bg: ['#d6efd0', '#7fbf72'], a: ['fox', 'キツネ'], b: ['raccoon', 'アライグマ'], boss: ['boar', 'イノシシ'],
    hint: 'Lv20', ref: [['bal', 'N', 20, 0], ['hp', 'N', 20, 0], ['atk', 'N', 20, 0], ['rcv', 'N', 20, 0], ['atk', 'N', 20, 0]] },
  { place: '山', bg: ['#e2e8f0', '#a7b59a'], a: ['monkey', 'サル'], b: ['snake', 'ヘビ'], boss: ['wolf', 'オオカミ'],
    hint: 'Lv30', ref: [['bal', 'N', 30, 0], ['hp', 'N', 30, 0], ['atk', 'N', 30, 0], ['rcv', 'N', 30, 0], ['atk', 'N', 30, 0]] },
  { place: '川', bg: ['#dff2ff', '#8fc8e8'], a: ['otter', 'カワウソ'], b: ['turtle', 'カメ'], boss: ['crocodile', 'ワニ'],
    hint: 'Lv40・R入り', ref: [['bal', 'R', 40, 0], ['hp', 'N', 40, 0], ['atk', 'N', 40, 0], ['rcv', 'N', 40, 0], ['atk', 'N', 40, 0]] },
  { place: '海', bg: ['#c8ecff', '#5aa8e0'], a: ['penguin', 'ペンギン'], b: ['seal', 'アザラシ'], boss: ['shark', 'サメ'],
    hint: 'Lv50', ref: [['bal', 'R', 50, 0], ['hp', 'N', 50, 0], ['atk', 'R', 50, 0], ['rcv', 'N', 50, 0], ['atk', 'N', 50, 0]] },
  { place: 'さばく', bg: ['#fff1cf', '#f0c27a'], a: ['scorpion', 'サソリ'], b: ['camel', 'ラクダ'], boss: ['cobra', 'コブラ'],
    hint: 'Lv60', ref: [['bal', 'R', 60, 0], ['hp', 'N', 60, 1], ['atk', 'R', 60, 0], ['rcv', 'N', 60, 1], ['atk', 'N', 60, 1]] },
  { place: 'ジャングル', bg: ['#cfeccf', '#3f9a5a'], a: ['gorilla', 'ゴリラ'], b: ['leopard', 'ヒョウ'], boss: ['tiger', 'トラ'],
    hint: 'Lv80・小判2', tough: true, ref: [['bal', 'R', 80, 1], ['hp', 'N', 80, 2], ['atk', 'R', 80, 1], ['rcv', 'N', 80, 2], ['atk', 'N', 80, 2]] },
  { place: '雪山', bg: ['#f2f8ff', '#b9d4f0'], a: ['snowwolf', 'ギンロウ'], b: ['moose', 'ヘラジカ'], boss: ['polarbear', 'シロクマ'],
    hint: 'Lv99・小判3', tough: true, ref: [['bal', 'R', 99, 3], ['hp', 'N', 99, 3], ['atk', 'R', 99, 3], ['rcv', 'N', 99, 3], ['atk', 'N', 99, 3]] },
  { place: 'サバンナの王座', bg: ['#ffe9b0', '#e0a04a'], a: ['elephant', 'ゾウ'], b: ['rhino', 'サイ'], boss: ['lion', 'ライオン王'],
    hint: '神ネコ中心', tough: true, ref: [['bal', 'SR', 99, 2], ['hp', 'R', 99, 5], ['atk', 'SR', 99, 2], ['rcv', 'R', 99, 5], ['atk', 'R', 99, 5]] },
];

// 目安のチームの強さ（1ターンのダメージ＝4問正解のとき、体力の合計）
function refTeamPower(stage) {
  let atk = 0, hp = 0;
  for (const [type, rarity, lv, kb] of stage.ref) {
    const t = TYPE_STATS[type];
    const mul = RARITY_POWER[rarity] * (1 + KOBAN_BONUS * kb);
    const at = ([a, b]) => (a + (b - a) * (lv - 1) / (MAX_CAT_LEVEL - 1)) * mul;
    atk += at(t.atk);
    hp += at(t.hp);
  }
  const avgAtk = atk / stage.ref.length;
  return { dmg: avgAtk * Math.min(4, stage.ref.length * 0.8), hp };
}

// 相手のデータ。ザコ A はよく攻撃（2ターンごと）、ザコ B は強めにたまに（3ターンごと）、ボスは強い
function stageWaves(index) {
  const st = STAGES[index];
  const { dmg, hp } = refTeamPower(st);
  // ステージ8〜10（tough）は、目安のチームでもしっかり正解しないと勝てない強さ
  const k = st.tough
    ? { a: [0.55, 0.18], b: [0.65, 0.27], boss: [7, 0.55] }
    : { a: [0.4, 0.12], b: [0.5, 0.18], boss: [3.6, 0.3] };
  const mk = ([kind, name], [hpMul, atkMul], cd, isBoss = false) => ({
    kind, name, boss: isBoss,
    max: Math.round(dmg * hpMul / 10) * 10,
    atk: Math.round(hp * atkMul / 10) * 10,
    cdMax: cd,
  });
  const A = () => mk(st.a, k.a, 2);
  const B = () => mk(st.b, k.b, 3);
  const boss = { hp: k.boss[0], atk: k.boss[1] };
  return [[A()], [A(), B()], [B(), B()], [A(), B(), A()], [mk(st.boss, [boss.hp, boss.atk], 2, true)]];
}

// プレーヤー経験値。レベルは上がるほど次に上がりにくい（強さには関係しない、ただの数字）
function playerExpToNext(level) {
  return 100 + 25 * (level - 1);
}

function playerLevel(exp) {
  let level = 1, rest = exp;
  while (rest >= playerExpToNext(level)) { rest -= playerExpToNext(level); level++; }
  return { level, into: rest, need: playerExpToNext(level) };
}

function battleExp(stageIndex, won, first, wavesCleared) {
  const n = stageIndex + 1;
  if (won) return 60 * n * (first ? 3 : 1);
  return 10 * n * wavesCleared; // 負けても、倒した戦の数だけ少しもらえる
}

// ---------- 出題する単語 ----------

// ステージ1〜3：出会った単語／4〜7：出会った単語＋次に出る50語／8〜10：その種類のすべての単語
function battleWordPool(stageIndex, words, recs) {
  const met = words.filter(w => recs[w.id]);
  if (stageIndex <= 2) return met;
  if (stageIndex <= 6) {
    const next = words.filter(w => !recs[w.id]).sort(byRankThenId).slice(0, NEXT_WORDS_FOR_MID);
    return met.concat(next);
  }
  return words.slice();
}

// ---------- 戦いの計算 ----------

function leaderSkill(party) {
  return party[0] ? CAT_SKILLS[party[0].inst.id] || null : null;
}

// チームの体力の最大
function teamMaxHp(party) {
  const sk = leaderSkill(party);
  const sum = party.reduce((n, p) => n + (p ? p.stats.hp : 0), 0);
  return Math.round(sum * (sk && sk.kind === 'teamHp' ? sk.v : 1));
}

// 1ターンの攻撃：results[slot] が true のネコが攻撃する。{ hits: [{slot, dmg}], heal }
function computeAttacks(party, results) {
  const sk = leaderSkill(party);
  const asked = party.filter(Boolean).length;
  const correct = results.filter(Boolean).length;
  let mul = 1;
  if (asked >= 5 && correct === asked) mul *= ALL_CORRECT_BONUS;
  if (sk) {
    if (sk.kind === 'atk') mul *= sk.v;
    if (sk.kind === 'atk3' && correct >= 3) mul *= sk.v;
    if (sk.kind === 'allAtk' && asked >= 5 && correct === asked) mul *= sk.v;
  }
  const hits = [];
  let heal = 0;
  party.forEach((p, slot) => {
    if (!p || !results[slot]) return;
    let m = mul;
    if (sk && sk.kind === 'edgeAtk' && (slot === 0 || slot === 4)) m *= sk.v;
    hits.push({ slot, dmg: Math.round(p.stats.atk * m) });
    heal += p.stats.rcv;
  });
  if (sk && sk.kind === 'rcv') heal *= sk.v;
  return { hits, heal: Math.round(heal) };
}

function damageTaken(party, atk) {
  const sk = leaderSkill(party);
  return Math.round(atk * (sk && sk.kind === 'guard' ? 1 - sk.v : 1));
}

// ---------- 記録 ----------

function addPlayerExp(record, amount) {
  ensureGrowth(record);
  const before = playerLevel(record.player.exp).level;
  record.player.exp += amount;
  touchRecord(record);
  saveRecord(record);
  return { before, after: playerLevel(record.player.exp).level };
}

// ステージを初めてクリアしたら bestStage を進める（次のステージが開く・ランキングの名前の枠が変わる）
function recordStageClear(record, stageIndex) {
  ensureGrowth(record);
  const first = record.player.bestStage < stageIndex + 1;
  if (first) record.player.bestStage = stageIndex + 1;
  touchRecord(record);
  saveRecord(record);
  return first;
}
