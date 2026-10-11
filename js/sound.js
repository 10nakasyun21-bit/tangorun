// 効果音（Web Audio API で音を作るので、音声ファイルはいらない）

let audioCtx = null;

// スマホは「ユーザーが画面を触ったとき」にしか音を鳴らす準備ができないので、
// スタートボタンなどを押したときに呼ぶ
function unlockAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function tone(freq, start, duration, type = 'sine', volume = 0.2) {
  const t = audioCtx.currentTime + start;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function playCorrect() {
  if (!audioCtx) return;
  tone(880, 0, 0.12);       // ラ
  tone(1318.5, 0.09, 0.22); // ミ（上）
}

function playWrong() {
  if (!audioCtx) return;
  tone(220, 0, 0.18, 'triangle', 0.25);
  tone(174.6, 0.15, 0.28, 'triangle', 0.25);
}
