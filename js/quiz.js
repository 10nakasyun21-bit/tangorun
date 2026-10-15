// 出題する単語と選択肢を作る

const QUESTIONS_PER_SET = 10;
const MAX_NEW_PER_SET = 5;
const RANK_ORDER = { A: 0, B: 1, C: 2 };

// 配列をシャッフルした新しい配列を返す（元の配列は変えない）
function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 「考え、アイデア」→ ["考え", "アイデア"]
// かっこ書きと「〜」は除く：「（背が）高い」と「高い」を同じ意味として扱うため
function meaningParts(meaning) {
  return meaning
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[〜～]/g, '') // 単語のデータは「〜」、熟語のデータは「～」を使っている
    .split(/[、,・]/)
    .map(s => s.trim())
    .filter(Boolean);
}

function meaningsOverlap(a, b) {
  const pa = meaningParts(a);
  return meaningParts(b).some(p => pa.includes(p));
}

// 単語と熟語で、グループ（品詞・熟語の種類）と英語の項目名がちがう
const WORD_KEYS = { group: 'pos', text: 'word' };
const IDIOM_KEYS = { group: 'type', text: 'idiom' };

// ダミーにしてよいか：正解と意味がかぶるものはダミーにしない（正解が2つになるため）
function canBeDummy(target, w, picked, keys) {
  return w.id !== target.id
    && w[keys.text] !== target[keys.text]
    && !meaningsOverlap(w.meaning, target.meaning)
    && !picked.some(p => p[keys.text] === w[keys.text] || p.meaning === w.meaning);
}

// 正解1つ＋ダミー3つを、シャッフルして返す。ダミーは同じグループ（品詞・熟語の種類）から選ぶ
function makeChoices(target, items, keys = WORD_KEYS) {
  const dummies = [];
  const same = shuffle(items.filter(w => w[keys.group] === target[keys.group]));
  const others = shuffle(items.filter(w => w[keys.group] !== target[keys.group]));
  // 同じグループで3つそろわないときだけ、ほかのグループから補う
  for (const w of [...same, ...others]) {
    if (dummies.length >= 3) break;
    if (canBeDummy(target, w, dummies, keys)) dummies.push(w);
  }
  return shuffle([target, ...dummies]);
}

function byRankThenId(a, b) {
  return (RANK_ORDER[a.rank] - RANK_ORDER[b.rank]) || (a.id - b.id);
}

// 1セット分に出すものを選ぶ（単語と文章で共通）
// 1. 復習日が来たもの（不正解だったものを先に）
// 2. 新しいもの（newOrder の順に、最大 maxNew 個）
// 3. それでも足りなければ、復習日がまだのものを早めに出す（練習扱い）
// 4. まだ足りなければ（はじめて遊ぶときなど）、新しいものをさらに足す
function pickForSet(items, recMap, perSet, maxNew, newOrder) {
  const today = localDate();
  const rec = id => recMap[id];
  const picked = [];
  const take = (list, max, practice = false) => {
    for (const it of list) {
      if (picked.length >= perSet || max <= 0) break;
      if (picked.some(p => p.item.id === it.id)) continue;
      picked.push({ item: it, practice });
      max--;
    }
  };

  const due = items
    .filter(it => rec(it.id) && rec(it.id).due <= today)
    .sort((a, b) => {
      const ra = rec(a.id), rb = rec(b.id);
      const wa = ra.lastResult === 'wrong' ? 0 : 1;
      const wb = rb.lastResult === 'wrong' ? 0 : 1;
      return (wa - wb) || ra.due.localeCompare(rb.due) || (a.id - b.id);
    });
  const fresh = items.filter(it => !rec(it.id)).sort(newOrder);
  // 早めに出すものは「いちばん前に答えたもの」から順に選ぶ（同じものばかり出ないように回す）。
  // 同じ時刻のものはシャッフルした順のまま（sort は並びを崩さない）
  const answeredAt = it => rec(it.id).lastAnsweredAt || '';
  const notYetDue = shuffle(items.filter(it => rec(it.id) && rec(it.id).due > today))
    .sort((a, b) => answeredAt(a).localeCompare(answeredAt(b)));

  take(due, perSet);
  take(fresh, maxNew);
  take(notYetDue, perSet, true);
  take(fresh, perSet);
  return picked;
}

// 単語の1セット（10問）
function buildSet(words, record) {
  const picked = pickForSet(words, record.words, QUESTIONS_PER_SET, MAX_NEW_PER_SET, byRankThenId);
  return shuffle(picked).map(({ item: word, practice }) => {
    const r = record.words[word.id];
    const level = r ? r.level : 1;
    return {
      word,
      level,
      practice,
      isNew: !r,
      choices: level < 3 ? makeChoices(word, words) : null,
    };
  });
}

// ---------- ニガテ（前回まちがえた・「わからない」を押したもの） ----------

// ニガテの一覧：最後の答えが不正解のもの。新しくまちがえた順。正解すると一覧から消える
function weakItems(items, recMap) {
  return items
    .filter(it => recMap[it.id] && recMap[it.id].lastResult === 'wrong')
    .sort((a, b) => (recMap[b.id].lastAnsweredAt || '').localeCompare(recMap[a.id].lastAnsweredAt || ''));
}

// ニガテだけのセット（最大10問）。まちがえたものは今日が復習日なので、正解すれば間隔もふつうに進む
function buildWeakSet(kind, items, record) {
  const recs = record[kind];
  const picked = shuffle(weakItems(items, recs).slice(0, QUESTIONS_PER_SET));
  return picked.map(item => {
    const level = recs[item.id].level;
    if (kind === 'idioms') {
      return {
        idiom: item, level, practice: false, isNew: false,
        choices: level < 3 ? makeChoices(item, items, IDIOM_KEYS) : null,
        blankChoices: level === 3 ? shuffle([item.blank, ...item.blank_choices]) : null,
      };
    }
    return { word: item, level, practice: false, isNew: false, choices: level < 3 ? makeChoices(item, items) : null };
  });
}

// ---------- 熟語 ----------

// 熟語の1セット（10問）。単語と同じ選び方（復習 → 新しい熟語は最大5個・rank A から → 練習）
// レベル1・2は4択（意味 / 熟語）、レベル3は例文の穴うめ4択
function buildIdiomSet(idioms, record) {
  const picked = pickForSet(idioms, record.idioms, QUESTIONS_PER_SET, MAX_NEW_PER_SET, byRankThenId);
  return shuffle(picked).map(({ item: idiom, practice }) => {
    const r = record.idioms[idiom.id];
    const level = r ? r.level : 1;
    return {
      idiom,
      level,
      practice,
      isNew: !r,
      choices: level < 3 ? makeChoices(idiom, idioms, IDIOM_KEYS) : null,
      blankChoices: level === 3 ? shuffle([idiom.blank, ...idiom.blank_choices]) : null,
    };
  });
}

// 穴うめの文：隠す語（1語・1回だけ）を「( )」にする
function idiomBlankParts(idiom) {
  const re = new RegExp(`(?<![A-Za-z'])${idiom.blank}(?![A-Za-z'])`);
  const m = re.exec(idiom.example);
  return { before: idiom.example.slice(0, m.index), after: idiom.example.slice(m.index + idiom.blank.length) };
}

// 読み上げる英語：A・B や「～」「…」を含む熟語は「エー」「ビー」と読まれないよう、例文を読む
function idiomSpeakText(idiom) {
  return /(^|\s)[AB](\s|$)|[～〜…]/.test(idiom.idiom) ? idiom.example : idiom.idiom;
}

// ---------- 文章 ----------

const SENTENCES_PER_SET = 5;

// 章をクリア＝その章の10文すべてに1回以上正解した
function isChapterCleared(chapterId, sentences, record) {
  const list = sentences.filter(s => s.chapter === chapterId);
  return list.length > 0 && list.every(s => record.sentences[s.id] && record.sentences[s.id].correct > 0);
}

// 遊べる章：第1章と、前の章をクリアした章
function unlockedChapterIds(chapters, sentences, record) {
  const ids = [];
  for (const c of chapters) {
    if (ids.length === 0 || isChapterCleared(ids[ids.length - 1], sentences, record)) ids.push(c.id);
    else break;
  }
  return ids;
}

// タイルを並べる問題用：正しい順のままにならないようにシャッフルする
function shuffleTiles(texts) {
  const tiles = texts.map((text, i) => ({ text, i }));
  if (tiles.length < 2) return tiles;
  let s;
  do { s = shuffle(tiles); } while (s.every((t, k) => t.i === k));
  return s;
}

// 文章の1セット（5問）
// 1・2問目：これまでに1回以上解いた文からランダム（前回まちがえた文を先に。直前のセットの文はなるべく避ける）
// 3〜5問目：まだ解いていない文を物語の順に
// 新しい文が足りないとき（章の最後など）は、残りも解いたことのある文から出す
const REVIEW_SLOTS = 2;

function buildSentenceSet(chapters, sentences, record) {
  const recs = record.sentences;
  const today = localDate();
  const open = unlockedChapterIds(chapters, sentences, record);
  const answered = sentences.filter(s => recs[s.id]);
  const fresh = sentences.filter(s => open.includes(s.chapter) && !recs[s.id]).sort((a, b) => a.id - b.id);

  // 直前のセットで出た文（最後に答えた5文）
  const recent = new Set(
    [...answered].sort((a, b) => (recs[b.id].lastAnsweredAt || '').localeCompare(recs[a.id].lastAnsweredAt || ''))
      .slice(0, SENTENCES_PER_SET).map(s => s.id)
  );
  // シャッフルしてから「まちがえた文が先・直前に出た文は後」に並べる（sort は同じ順位どうしの並びを崩さない）
  const rank = s => (recs[s.id].lastResult === 'wrong' ? 0 : 2) + (recent.has(s.id) ? 1 : 0);
  const reviewPool = shuffle(answered).sort((a, b) => rank(a) - rank(b));

  const review = reviewPool.slice(0, REVIEW_SLOTS);
  const news = fresh.slice(0, SENTENCES_PER_SET - review.length);
  const picked = [...review, ...news];
  for (const s of reviewPool.slice(REVIEW_SLOTS)) {
    if (picked.length >= SENTENCES_PER_SET) break;
    picked.push(s);
  }

  return picked.map(sentence => {
    const r = recs[sentence.id];
    const level = r ? r.level : 1;
    let tiles = null;
    if (level === 1) tiles = shuffleTiles(sentence.chunks);
    if (level === 2) tiles = shuffleTiles(sentence.en.split(' '));
    // 復習日より前に出した文は練習あつかい（正解しても復習の間隔は進めない）
    return { sentence, level, practice: !!r && r.due > today, isNew: !r, tiles };
  });
}

// 穴うめの答え合わせ用：大文字小文字・余分な空白・最後の記号・’ のちがいは気にしない
function normalizeAnswer(s) {
  return s.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/[.,!?。、]+$/, '').replace(/\s+/g, ' ');
}

// レベル3のヒント： "important" → "i＿＿＿＿＿＿＿＿"
function spellingHint(word) {
  return word[0] + word.slice(1).replace(/[^ ]/g, '＿');
}

function normalizeSpelling(s) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}
