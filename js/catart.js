// ネコの絵を組み立てる（SVG）
// すべてのネコは同じ「基本の形」（頭・耳・からだ・しっぽ・前足）を使い、
// 毛の色・柄・目・口・小物・背景を変えて描き分ける。座標は 240×240 の中で決めている。

const CAT_HEAD = { cx: 120, cy: 118, rx: 52, ry: 42 };
const CAT_BODY = { cx: 120, cy: 186, rx: 40, ry: 36 };
const TAIL_PATH = 'M152 206 C196 210 208 170 186 150';

// ---------- 背景 ----------

function catBackground(bg, id) {
  const [c1, c2] = bg.colors;
  let s = '';
  if (bg.type === 'gradient') {
    s += `<defs><linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>`;
    s += `<rect width="240" height="240" fill="url(#${id}-bg)"/>`;
  } else if (bg.type === 'radial') {
    s += `<defs><radialGradient id="${id}-bg" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient></defs>`;
    s += `<rect width="240" height="240" fill="url(#${id}-bg)"/>`;
  } else {
    s += `<rect width="240" height="240" fill="${c1}"/>`;
  }
  const p = bg.pattern;
  const pc = bg.patternColor || '#ffffff';
  if (p === 'dots') {
    s += `<g fill="${pc}" opacity="0.75">${[[24, 26, 7], [74, 44, 5], [210, 30, 8], [30, 120, 6], [214, 118, 5], [20, 206, 8], [222, 200, 6], [176, 18, 4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
  } else if (p === 'stripes') {
    s += `<g fill="${pc}" opacity="0.5">${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${i * 44 - 4}" y="0" width="18" height="240"/>`).join('')}</g>`;
  } else if (p === 'checks') {
    let cells = '';
    for (let x = 0; x < 6; x++) for (let y = 0; y < 6; y++) if ((x + y) % 2 === 0) cells += `<rect x="${x * 40}" y="${y * 40}" width="40" height="40"/>`;
    s += `<g fill="${pc}" opacity="0.45">${cells}</g>`;
  } else if (p === 'hearts') {
    s += `<g fill="${pc}" opacity="0.7">${[[30, 34], [204, 40], [26, 150], [214, 160], [60, 216], [190, 214]].map(([x, y]) => heartPath(x, y, 7)).join('')}</g>`;
  } else if (p === 'stars') {
    s += `<g fill="${pc}">${[[22, 100, 1.4], [200, 30, 1.8], [215, 95, 1.2], [30, 170, 1.6], [208, 160, 1.4], [80, 22, 1.2], [160, 18, 1.3], [12, 214, 1.2], [228, 220, 1.5], [50, 60, 1.3]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
  } else if (p === 'speed') {
    s += `<g stroke="${pc}" stroke-linecap="round" opacity="0.55"><path d="M8 60 L70 60" stroke-width="4"/><path d="M20 84 L58 84" stroke-width="3"/><path d="M4 150 L56 150" stroke-width="4"/><path d="M16 176 L48 176" stroke-width="3"/><path d="M190 40 L232 40" stroke-width="3"/><path d="M200 190 L236 190" stroke-width="4"/></g>`;
  } else if (p === 'rays') {
    let rays = '';
    for (let i = 0; i < 12; i++) rays += `<path d="M120 120 L${120 + 200 * Math.cos((i * 30) * Math.PI / 180)} ${120 + 200 * Math.sin((i * 30) * Math.PI / 180)} L${120 + 200 * Math.cos((i * 30 + 12) * Math.PI / 180)} ${120 + 200 * Math.sin((i * 30 + 12) * Math.PI / 180)} Z"/>`;
    s += `<g fill="${pc}" opacity="0.25">${rays}</g>`;
  } else if (p === 'grid') {
    let lines = '';
    for (let i = 20; i < 240; i += 30) lines += `<path d="M${i} 0 V240 M0 ${i} H240"/>`;
    s += `<g stroke="${pc}" stroke-width="1.5" opacity="0.35">${lines}</g>`;
  } else if (p === 'rain') {
    s += `<g stroke="${pc}" stroke-width="3" stroke-linecap="round" opacity="0.6">${[[30, 20], [70, 60], [200, 30], [180, 90], [24, 130], [214, 150], [50, 200], [200, 210]].map(([x, y]) => `<path d="M${x} ${y} l-5 12"/>`).join('')}</g>`;
  } else if (p === 'sparkles') {
    s += `<g fill="${pc}">${[[30, 40, 8], [206, 36, 7], [24, 160, 6], [214, 150, 8], [196, 214, 6]].map(([x, y, r]) => sparklePath(x, y, r)).join('')}</g>`;
  } else if (p === 'bubbles') {
    s += `<g fill="none" stroke="${pc}" stroke-width="2.5" opacity="0.7">${[[30, 40, 9], [60, 80, 5], [206, 50, 8], [190, 100, 4], [24, 170, 7], [214, 190, 9]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
  } else if (p === 'flowers') {
    s += [[30, 34, '#ffd1dc'], [206, 40, '#fff3b0'], [24, 150, '#d6f5d6'], [214, 168, '#ffd1dc'], [52, 214, '#fff3b0']].map(([x, y, c]) => flowerPath(x, y, 8, c)).join('');
  }
  return s;
}

function heartPath(x, y, r) {
  return `<path d="M${x} ${y + r} C${x - r * 1.6} ${y - r * 0.2} ${x - r * 0.6} ${y - r * 1.4} ${x} ${y - r * 0.4} C${x + r * 0.6} ${y - r * 1.4} ${x + r * 1.6} ${y - r * 0.2} ${x} ${y + r} Z"/>`;
}

function sparklePath(x, y, r) {
  return `<path d="M${x} ${y - r} L${x + r * 0.25} ${y - r * 0.25} L${x + r} ${y} L${x + r * 0.25} ${y + r * 0.25} L${x} ${y + r} L${x - r * 0.25} ${y + r * 0.25} L${x - r} ${y} L${x - r * 0.25} ${y - r * 0.25} Z"/>`;
}

function flowerPath(x, y, r, color) {
  let petals = '';
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 - 90) * Math.PI / 180;
    petals += `<circle cx="${(x + Math.cos(a) * r * 0.75).toFixed(1)}" cy="${(y + Math.sin(a) * r * 0.75).toFixed(1)}" r="${r * 0.55}" fill="${color}"/>`;
  }
  return petals + `<circle cx="${x}" cy="${y}" r="${r * 0.4}" fill="#ffcf4a"/>`;
}

// ---------- 顔のパーツ ----------

function catEyes(type, a) {
  const L = a.line;
  const iris = a.eyeColor || '#ffe14d';
  switch (type) {
    case 'sleep':
      return `<path d="M93 115 Q104 124 115 115 M125 115 Q136 124 147 115" fill="none" stroke="${L}" stroke-width="3.5" stroke-linecap="round"/>`;
    case 'calm':
      return `<path d="M93 116 Q104 122 115 116 M125 116 Q136 122 147 116" fill="none" stroke="${L}" stroke-width="3.5" stroke-linecap="round"/>`;
    case 'happy':
      return `<path d="M94 120 Q104 108 114 120 M126 120 Q136 108 146 120" fill="none" stroke="${L}" stroke-width="3.5" stroke-linecap="round"/>`;
    case 'round':
      return `<ellipse cx="104" cy="116" rx="6" ry="7.5" fill="${L}"/><ellipse cx="136" cy="116" rx="6" ry="7.5" fill="${L}"/>`
        + `<circle cx="106.2" cy="113" r="2.3" fill="#fff"/><circle cx="138.2" cy="113" r="2.3" fill="#fff"/>`;
    case 'sparkle':
      return `<ellipse cx="104" cy="116" rx="7.5" ry="9" fill="${L}"/><ellipse cx="136" cy="116" rx="7.5" ry="9" fill="${L}"/>`
        + `<circle cx="106.5" cy="112.5" r="3" fill="#fff"/><circle cx="138.5" cy="112.5" r="3" fill="#fff"/>`
        + `<circle cx="101.5" cy="120" r="1.5" fill="#fff"/><circle cx="133.5" cy="120" r="1.5" fill="#fff"/>`;
    case 'teary':
      return catEyes('sparkle', a)
        + `<path d="M98 126 q-3 7 0 9 q3 -2 0 -9 Z M142 126 q-3 7 0 9 q3 -2 0 -9 Z" fill="#8ed0ff" stroke="#4aa8e0" stroke-width="1"/>`;
    case 'dot':
      return `<circle cx="104" cy="117" r="3.6" fill="${L}"/><circle cx="136" cy="117" r="3.6" fill="${L}"/>`;
    case 'relaxed':
      // 半分とじた、のんびりした目（まぶたは水平に近く、外側を少し下げる）
      return `<circle cx="104" cy="119" r="3.8" fill="${L}"/><circle cx="136" cy="119" r="3.8" fill="${L}"/>`
        + `<path d="M95 116 Q104 113 113 115.5 M145 116 Q136 113 127 115.5" fill="none" stroke="${L}" stroke-width="3" stroke-linecap="round"/>`;
    case 'wink':
      return `<ellipse cx="104" cy="116" rx="6" ry="7.5" fill="${L}"/><circle cx="106.2" cy="113" r="2.3" fill="#fff"/>`
        + `<path d="M126 119 Q136 109 146 119" fill="none" stroke="${L}" stroke-width="3.5" stroke-linecap="round"/>`;
    case 'glare':
      return catEyes('round', a)
        + `<path d="M93 104 L112 109 M147 104 L128 109" stroke="${L}" stroke-width="4" stroke-linecap="round"/>`;
    case 'scared':
      return `<path d="M95 110 L111 116 L95 122 M145 110 L129 116 L145 122" fill="none" stroke="${L}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'sharp':
      return `<path d="M91 121 Q102 110 115 117 Q104 126 91 121 Z" fill="${iris}" stroke="${L}" stroke-width="2"/><ellipse cx="105" cy="119" rx="2.8" ry="4.5" fill="${L}"/>`
        + `<path d="M149 121 Q138 110 125 117 Q136 126 149 121 Z" fill="${iris}" stroke="${L}" stroke-width="2"/><ellipse cx="135" cy="119" rx="2.8" ry="4.5" fill="${L}"/>`;
    case 'screen':
      return `<rect x="92" y="108" width="24" height="16" rx="4" fill="#1b2a3a" stroke="${L}" stroke-width="2"/><rect x="124" y="108" width="24" height="16" rx="4" fill="#1b2a3a" stroke="${L}" stroke-width="2"/>`
        + `<path d="M97 118 h14 M129 118 h14" stroke="#4dfcff" stroke-width="3" stroke-linecap="round"/>`;
    case 'star':
      return `<g fill="${iris}" stroke="${L}" stroke-width="1.5">${sparklePath(104, 116, 9)}${sparklePath(136, 116, 9)}</g>`;
    default:
      return '';
  }
}

function catMouth(type, a) {
  const L = a.mouthLine || a.line;
  const nose = `<path d="M115.5 127 L124.5 127 L120 132 Z" fill="${a.nose || '#f28b9b'}" stroke="${a.line}" stroke-width="1.5" stroke-linejoin="round"/>`;
  const w = `<path d="M120 132 Q117 138 111 135 M120 132 Q123 138 129 135" fill="none" stroke="${L}" stroke-width="2.2" stroke-linecap="round"/>`;
  switch (type) {
    case 'fang':
      return nose + w + `<path d="M124 136.5 L126 141.5 L128 137 Z" fill="#fff"/>`;
    case 'open':
      return nose + `<path d="M111 134 Q120 150 129 134 Q120 138 111 134 Z" fill="#e8606e" stroke="${L}" stroke-width="2" stroke-linejoin="round"/>`;
    case 'shout':
      return nose + `<ellipse cx="120" cy="142" rx="9" ry="10" fill="#c43c4c" stroke="${L}" stroke-width="2"/><ellipse cx="120" cy="146" rx="5" ry="4" fill="#ff8fa3"/>`;
    case 'wavy':
      return nose + `<path d="M110 138 q3 -4 5 0 q2 4 5 0 q3 -4 5 0 q2 4 5 0" fill="none" stroke="${L}" stroke-width="2.2" stroke-linecap="round"/>`;
    case 'o':
      return nose + `<circle cx="120" cy="139" r="3.5" fill="none" stroke="${L}" stroke-width="2"/>`;
    case 'flat':
      return nose + `<path d="M113 137 L127 137" stroke="${L}" stroke-width="2.2" stroke-linecap="round"/>`;
    default:
      return nose + w;
  }
}

function catWhiskers(a) {
  const c = a.whisker || a.line;
  return `<g stroke="${c}" stroke-width="2" stroke-linecap="round"><path d="M86 127 L62 121"/><path d="M86 133 L61 135"/><path d="M154 127 L178 121"/><path d="M154 133 L179 135"/></g>`;
}

// ---------- 柄 ----------

function headPattern(a) {
  const p = a.pattern;
  const c = a.patternColor;
  switch (p) {
    case 'mike':
      return `<ellipse cx="82" cy="92" rx="30" ry="22" fill="${c || '#f5a35a'}"/><ellipse cx="160" cy="86" rx="24" ry="16" fill="${a.patternColor2 || '#3a3a4a'}"/>`;
    case 'tabby':
      return `<g fill="${c}"><path d="M110 77 h5 v18 h-5z M118 76 h5 v20 h-5z M126 77 h5 v18 h-5z" /><path d="M68 108 h14 v5 h-14z M68 118 h12 v5 h-12z M158 108 h14 v5 h-14z M160 118 h12 v5 h-12z"/></g>`;
    case 'tuxedo':
      return `<ellipse cx="120" cy="138" rx="28" ry="18" fill="${c || '#fffaf2'}"/>`;
    case 'patch':
      return `<ellipse cx="102" cy="112" rx="18" ry="16" fill="${c}"/>`;
    case 'cap':
      return `<ellipse cx="120" cy="82" rx="50" ry="18" fill="${c}"/>`;
    default:
      return '';
  }
}

function bodyPattern(a) {
  const p = a.pattern;
  const c = a.patternColor;
  switch (p) {
    case 'mike':
      return `<ellipse cx="92" cy="176" rx="22" ry="18" fill="${c || '#f5a35a'}"/><ellipse cx="150" cy="198" rx="18" ry="14" fill="${a.patternColor2 || '#3a3a4a'}"/>`;
    case 'tabby':
      return `<g fill="${c}"><path d="M84 168 q10 4 20 0 v5 q-10 4 -20 0z M84 184 q10 4 20 0 v5 q-10 4 -20 0z M136 168 q10 4 20 0 v5 q-10 4 -20 0z M136 184 q10 4 20 0 v5 q-10 4 -20 0z"/></g>`;
    case 'tuxedo':
      return `<ellipse cx="120" cy="190" rx="20" ry="26" fill="${c || '#fffaf2'}"/>`;
    default:
      return '';
  }
}

// ---------- 小物（layer ごとに描く場所が決まっている） ----------
// back：からだの後ろ / body：からだの上 / head：頭の上 / front：いちばん手前

const CAT_ITEMS = {
  // --- SR ---
  space: () => ({
    bg: `<circle cx="44" cy="50" r="15" fill="#f4a259"/><ellipse cx="44" cy="50" rx="27" ry="7" fill="none" stroke="#ffd58a" stroke-width="3" transform="rotate(-20 44 50)"/>`
      + `<path d="M150 44 L196 22" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.7"/><circle cx="198" cy="21" r="3" fill="#fff"/>`
      + `<g fill="#ffe680">${sparklePath(31, 91, 7)}${sparklePath(38, 147, 5)}</g>`,
  }),
  cape: () => ({
    back: `<path d="M76 150 Q120 140 164 150 L192 228 Q120 240 48 228 Z" fill="#c8323c" stroke="#ffcf4a" stroke-width="3" stroke-linejoin="round"/>`,
    body: `<ellipse cx="120" cy="154" rx="38" ry="11" fill="#fff" stroke="#3a3a4a" stroke-width="2.5"/><g fill="#3a3a4a"><circle cx="96" cy="155" r="1.8"/><circle cx="110" cy="158" r="1.8"/><circle cx="130" cy="158" r="1.8"/><circle cx="144" cy="155" r="1.8"/></g>`,
  }),
  crown: () => ({
    head: `<path d="M94 80 L98 54 L109 67 L120 46 L131 67 L142 54 L146 80 Z" fill="#ffd54a" stroke="#a86f00" stroke-width="2.5" stroke-linejoin="round"/>`
      + `<rect x="93" y="76" width="54" height="8" rx="3" fill="#f5b800" stroke="#a86f00" stroke-width="2.5"/>`
      + `<circle cx="98" cy="54" r="3.5" fill="#4fc3f7" stroke="#a86f00" stroke-width="1.5"/><circle cx="120" cy="46" r="4.5" fill="#ef4f6a" stroke="#a86f00" stroke-width="1.5"/><circle cx="142" cy="54" r="3.5" fill="#4fc3f7" stroke="#a86f00" stroke-width="1.5"/>`,
  }),
  zz: ({ color = '#cfd3ff' } = {}) => ({
    front: `<text x="170" y="96" fill="${color}" font-size="18" font-weight="bold" font-family="sans-serif">z</text><text x="182" y="82" fill="${color}" font-size="13" font-weight="bold" font-family="sans-serif">z</text>`,
  }),
  dragon: () => ({
    bg: `<g fill="#ffffff" opacity="0.85"><ellipse cx="40" cy="60" rx="26" ry="10"/><ellipse cx="58" cy="54" rx="16" ry="10"/><ellipse cx="200" cy="40" rx="24" ry="9"/><ellipse cx="186" cy="34" rx="14" ry="9"/></g>`,
    back: `<path d="M86 160 Q30 120 18 150 Q40 150 44 170 Q60 160 70 178 Z" fill="#5cc98a" stroke="#1f6b45" stroke-width="3" stroke-linejoin="round"/>`
      + `<path d="M154 160 Q210 120 222 150 Q200 150 196 170 Q180 160 170 178 Z" fill="#5cc98a" stroke="#1f6b45" stroke-width="3" stroke-linejoin="round"/>`
      + `<ellipse cx="120" cy="214" rx="70" ry="22" fill="#5cc98a" stroke="#1f6b45" stroke-width="3"/>`
      + `<g fill="#ffd54a" stroke="#1f6b45" stroke-width="2"><path d="M76 200 l6 -10 l6 10z"/><path d="M98 196 l6 -10 l6 10z"/><path d="M142 196 l6 -10 l6 10z"/></g>`,
    front: `<path d="M186 214 Q214 210 222 186 Q232 190 230 204 Q228 222 196 230 Z" fill="#5cc98a" stroke="#1f6b45" stroke-width="3" stroke-linejoin="round"/>`
      + `<circle cx="222" cy="196" r="2.5" fill="#1f6b45"/><path d="M220 186 l-2 -10 l8 6z" fill="#ffd54a" stroke="#1f6b45" stroke-width="1.5"/>`,
  }),
  goggles: () => ({
    head: `<path d="M74 92 Q120 78 166 92" fill="none" stroke="#6b4430" stroke-width="6"/><circle cx="104" cy="86" r="10" fill="#8fd3ff" stroke="#6b4430" stroke-width="3"/><circle cx="136" cy="86" r="10" fill="#8fd3ff" stroke="#6b4430" stroke-width="3"/><circle cx="101" cy="83" r="3" fill="#fff"/><circle cx="133" cy="83" r="3" fill="#fff"/>`,
  }),
  sweat: () => ({
    front: `<path d="M160 92 q-6 10 0 14 q6 -4 0 -14 Z" fill="#8ed0ff" stroke="#4aa8e0" stroke-width="1.5"/>`,
  }),
  rainbowTail: () => ({
    tail: ['#ff4d6d', '#ffb347', '#ffe66d', '#5ee27a', '#4dc9ff', '#7b6cff'].map((c, i) =>
      `<path d="${TAIL_PATH}" fill="none" stroke="${c}" stroke-width="11" stroke-linecap="round" stroke-dasharray="14 70" stroke-dashoffset="${-i * 14}"/>`).join(''),
  }),
  rainbowArc: () => ({
    bg: ['#ff4d6d', '#ffb347', '#ffe66d', '#5ee27a', '#4dc9ff', '#7b6cff'].map((c, i) =>
      `<path d="M10 150 A110 110 0 0 1 230 150" fill="none" stroke="${c}" stroke-width="7" opacity="0.55" transform="translate(0 ${i * 7})"/>`).join(''),
  }),
  tiara: () => ({
    head: `<path d="M100 80 L106 64 L113 74 L120 58 L127 74 L134 64 L140 80 Z" fill="#e9e4ff" stroke="#8a7cc7" stroke-width="2.2" stroke-linejoin="round"/><circle cx="120" cy="62" r="4" fill="#ff6ad5" stroke="#8a7cc7" stroke-width="1.5"/>`,
  }),
  maneki: () => ({
    bg: `<g fill="#ffb7c5" opacity="0.9">${[[30, 40], [210, 46], [26, 150], [214, 120], [44, 206]].map(([x, y]) => flowerPath(x, y, 9, '#ffc8d4')).join('')}</g>`,
    body: `<path d="M84 152 Q120 166 156 152" fill="none" stroke="#e8343f" stroke-width="7" stroke-linecap="round"/><circle cx="120" cy="164" r="7" fill="#ffd54a" stroke="#a86f00" stroke-width="2"/><path d="M114 166 h12" stroke="#a86f00" stroke-width="1.5"/>`
      + `<ellipse cx="120" cy="196" rx="20" ry="13" fill="#ffd54a" stroke="#a86f00" stroke-width="2.5"/><text x="120" y="201" text-anchor="middle" fill="#a86f00" font-size="12" font-weight="bold" font-family="sans-serif">合格</text>`,
    front: `<ellipse cx="170" cy="112" rx="12" ry="16" fill="#fffaf2" stroke="#3a3a4a" stroke-width="3" transform="rotate(-15 170 112)"/><path d="M150 150 Q160 132 166 124" fill="none" stroke="#3a3a4a" stroke-width="3"/>`
      + `<path d="M164 102 q6 -2 10 2" fill="none" stroke="#3a3a4a" stroke-width="2" stroke-linecap="round"/>`,
  }),

  // --- R ---
  headband: () => ({
    back: `<path d="M160 98 Q190 78 220 70 L216 82 Q190 90 164 106 Z" fill="#fff" stroke="#1b1b22" stroke-width="2.5" stroke-linejoin="round"/><path d="M162 104 Q192 100 222 104 L216 114 Q190 110 164 112 Z" fill="#fff" stroke="#1b1b22" stroke-width="2.5" stroke-linejoin="round"/>`,
    head: `<path d="M69 98 Q120 84 171 98 L170 110 Q120 96 70 110 Z" fill="#fff" stroke="#1b1b22" stroke-width="2.5" stroke-linejoin="round"/><circle cx="120" cy="96" r="5" fill="#e8343f"/>`,
  }),
  dust: () => ({
    front: `<g fill="#fff" opacity="0.8"><circle cx="70" cy="222" r="9"/><circle cx="56" cy="214" r="6"/><circle cx="44" cy="222" r="4"/></g>`,
  }),
  ninja: () => ({
    bg: `<circle cx="190" cy="50" r="22" fill="#fff3b0"/><circle cx="182" cy="44" r="22" fill="#2c2a5a"/>`,
    head: `<path d="M68 112 Q66 70 120 72 Q174 70 172 112 L172 108 Q120 96 68 108 Z" fill="#2d3561" stroke="#14172e" stroke-width="3"/><path d="M68 128 Q120 144 172 128 Q170 156 120 160 Q70 156 68 128 Z" fill="#2d3561" stroke="#14172e" stroke-width="3"/>`
      + `<path d="M172 104 Q196 96 206 112 M172 110 Q192 116 198 128" fill="none" stroke="#2d3561" stroke-width="6" stroke-linecap="round"/>`,
    front: `<g transform="translate(46 196) rotate(15)"><path d="M0 -14 L4 -4 L14 0 L4 4 L0 14 L-4 4 L-14 0 L-4 -4 Z" fill="#c9d1db" stroke="#3a4250" stroke-width="2"/><circle r="3" fill="#3a4250"/></g>`,
  }),
  robot: () => ({
    back: `<path d="M120 76 V54" stroke="#5c6878" stroke-width="4"/><circle cx="120" cy="50" r="6" fill="#ff5e5e" stroke="#5c6878" stroke-width="2.5"/>`,
    head: `<circle cx="80" cy="132" r="4" fill="#5c6878"/><circle cx="160" cy="132" r="4" fill="#5c6878"/>`,
    body: `<rect x="104" y="176" width="32" height="18" rx="4" fill="#1b2a3a" stroke="#5c6878" stroke-width="2.5"/><rect x="136" y="181" width="4" height="8" rx="1" fill="#5c6878"/><rect x="108" y="180" width="6" height="10" rx="1.5" fill="#ff5e5e"/>`,
  }),
  samurai: () => ({
    bg: `<path d="M196 30 a22 22 0 1 0 14 40 a18 18 0 1 1 -14 -40 Z" fill="#fff3b0"/>`,
    back: `<path d="M160 230 L210 110" stroke="#c99a5b" stroke-width="9" stroke-linecap="round"/><path d="M160 230 L210 110" stroke="#8b5a2b" stroke-width="2" stroke-dasharray="4 30"/>`,
    head: `<ellipse cx="120" cy="74" rx="9" ry="6" fill="#3a3a48" stroke="#1b1b22" stroke-width="2"/><path d="M120 70 Q130 60 138 66" fill="none" stroke="#1b1b22" stroke-width="5" stroke-linecap="round"/>`,
    body: `<path d="M86 162 L120 196 L154 162" fill="none" stroke="#2d3561" stroke-width="10" stroke-linejoin="round"/>`,
    front: `<path d="M26 214 q14 -10 26 -2 q-4 10 -22 10 Z" fill="#6cc04a" stroke="#2e6b1f" stroke-width="2"/><text x="34" y="196" fill="#fff" font-size="16" font-weight="bold" font-family="sans-serif">!</text>`,
  }),
  detective: () => ({
    bg: `<g fill="#ffffff" opacity="0.35" font-size="28" font-weight="bold" font-family="sans-serif"><text x="18" y="56">?</text><text x="200" y="70">?</text><text x="24" y="180">?</text></g>`,
    head: `<path d="M74 92 Q120 52 166 92 Z" fill="#a5794a" stroke="#5a3d22" stroke-width="3" stroke-linejoin="round"/><path d="M84 84 L156 84 M96 70 L144 70" stroke="#5a3d22" stroke-width="2" opacity="0.6"/>`
      + `<path d="M66 94 Q120 82 174 94" fill="none" stroke="#5a3d22" stroke-width="6" stroke-linecap="round"/>`,
    front: `<circle cx="168" cy="178" r="16" fill="#d9f2ff" fill-opacity="0.5" stroke="#5a3d22" stroke-width="5"/><path d="M156 192 L140 212" stroke="#5a3d22" stroke-width="7" stroke-linecap="round"/>`,
  }),
  rock: () => ({
    bg: `<g fill="#fff" opacity="0.25"><path d="M60 0 L90 0 L130 240 L60 240 Z"/><path d="M170 0 L200 0 L210 240 L150 240 Z"/></g><g fill="#ffe66d" font-size="22" font-family="sans-serif"><text x="24" y="60">♪</text><text x="200" y="90">♫</text></g>`,
    head: `<path d="M88 106 h28 v10 q-14 8 -28 0 Z M124 106 h28 v10 q-14 8 -28 0 Z M116 108 h8" fill="#1b1b22" stroke="#1b1b22" stroke-width="2"/>`,
    front: `<g transform="rotate(-25 120 196)"><ellipse cx="100" cy="200" rx="24" ry="18" fill="#e8343f" stroke="#1b1b22" stroke-width="3"/><circle cx="100" cy="200" r="6" fill="#1b1b22"/><rect x="120" y="195" width="62" height="10" rx="3" fill="#8b5a2b" stroke="#1b1b22" stroke-width="2.5"/><rect x="180" y="191" width="14" height="18" rx="3" fill="#1b1b22"/></g>`,
  }),
  chef: () => ({
    head: `<path d="M90 82 Q78 54 100 54 Q104 38 120 42 Q136 38 140 54 Q162 54 150 82 Z" fill="#fff" stroke="#3a3a4a" stroke-width="3" stroke-linejoin="round"/><rect x="90" y="76" width="60" height="10" rx="3" fill="#fff" stroke="#3a3a4a" stroke-width="3"/>`
      + `<ellipse cx="150" cy="138" rx="6" ry="4" fill="#fff" stroke="#e8d4c0" stroke-width="1"/>`,
    front: `<path d="M150 222 L196 222 L196 196 Z" fill="#ffe0b2" stroke="#3a3a4a" stroke-width="2.5" stroke-linejoin="round"/><path d="M196 196 L196 204 L156 220" fill="#ff8fa3"/><circle cx="188" cy="194" r="5" fill="#e8343f"/>`,
  }),
  ribbon: ({ color = '#ff6aa2' } = {}) => ({
    head: `<g transform="translate(150 76)"><path d="M0 0 L-18 -12 L-16 12 Z M0 0 L18 -12 L16 12 Z" fill="${color}" stroke="#3a3a4a" stroke-width="2.5" stroke-linejoin="round"/><circle r="5" fill="${color}" stroke="#3a3a4a" stroke-width="2.5"/></g>`,
  }),
  shades: () => ({
    head: `<g fill="#1b1b22" stroke="#3a3a4a" stroke-width="2"><path d="M90 108 h26 v8 q-13 9 -26 0 Z"/><path d="M124 108 h26 v8 q-13 9 -26 0 Z"/></g><path d="M116 110 h8" stroke="#3a3a4a" stroke-width="3"/><path d="M95 110 l6 0" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,
  }),
  phone: () => ({
    front: `<rect x="160" y="168" width="22" height="38" rx="4" fill="#ff8fc1" stroke="#3a3a4a" stroke-width="2.5" transform="rotate(12 171 187)"/><circle cx="174" cy="176" r="3" fill="#3a3a4a" transform="rotate(12 171 187)"/>`,
  }),
  wizard: () => ({
    head: `<path d="M78 86 Q120 74 162 86 L132 26 Q126 18 122 30 Z" fill="#6c5ce7" stroke="#2e2470" stroke-width="3" stroke-linejoin="round"/><path d="M70 88 Q120 72 170 88" fill="none" stroke="#2e2470" stroke-width="7" stroke-linecap="round"/><g fill="#ffe66d">${sparklePath(118, 58, 6)}</g>`,
    front: `<path d="M168 220 L196 168" stroke="#8b5a2b" stroke-width="5" stroke-linecap="round"/><g fill="#c9c9d6" opacity="0.9"><circle cx="200" cy="160" r="6"/><circle cx="210" cy="150" r="4"/><circle cx="206" cy="140" r="3"/></g>`,
  }),
  flowerCrown: () => ({
    head: `<path d="M74 92 Q120 70 166 92" fill="none" stroke="#5cb85c" stroke-width="4"/>${flowerPath(84, 86, 9, '#ff9ab5')}${flowerPath(104, 78, 9, '#fff3b0')}${flowerPath(126, 76, 9, '#ffb3c1')}${flowerPath(148, 82, 9, '#c8b6ff')}`,
    front: `<rect x="172" y="200" width="22" height="18" rx="3" fill="#d9874a" stroke="#3a3a4a" stroke-width="2"/><ellipse cx="183" cy="190" rx="7" ry="12" fill="#6cc04a" stroke="#2e6b1f" stroke-width="2"/><path d="M178 184 l-4 -2 M188 188 l4 -2 M180 194 l-4 1" stroke="#2e6b1f" stroke-width="1.5"/>`,
  }),
  idol: () => ({
    head: `<g fill="#ffe66d" stroke="#d4a200" stroke-width="1.5">${sparklePath(150, 82, 8)}</g>`,
    front: `<path d="M150 196 L170 214" stroke="#3a3a4a" stroke-width="6" stroke-linecap="round"/><circle cx="146" cy="190" r="10" fill="#c9c9d6" stroke="#3a3a4a" stroke-width="2.5"/><path d="M140 186 h12 M140 192 h12" stroke="#3a3a4a" stroke-width="1.5"/>`
      + `<g fill="#ff6aa2">${heartPath(70, 70, 6)}${heartPath(180, 60, 5)}</g>`,
  }),
  nightcap: () => ({
    bg: `<path d="M196 30 a22 22 0 1 0 14 40 a18 18 0 1 1 -14 -40 Z" fill="#fff3b0"/>`,
    back: `<rect x="44" y="196" width="152" height="34" rx="16" fill="#e9f0ff" stroke="#3a3a4a" stroke-width="3"/>`,
    head: `<path d="M80 86 Q120 66 160 86 Q160 60 190 66 Q200 70 194 78 Q170 72 168 92 Z" fill="#7b9cff" stroke="#3a3a4a" stroke-width="3" stroke-linejoin="round"/><circle cx="196" cy="76" r="7" fill="#fff" stroke="#3a3a4a" stroke-width="2.5"/>`
      + `<path d="M76 90 Q120 74 164 90" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`,
  }),

  // --- N（かわいい） ---
  bubble: () => ({
    front: `<circle cx="134" cy="136" r="10" fill="#e3f4ff" stroke="#8ec9ee" stroke-width="2" opacity="0.95"/><path d="M129 132 Q131 129 134 129" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><text x="168" y="80" fill="#6aa6d6" font-size="16" font-weight="bold" font-family="sans-serif">Zzz</text>`,
  }),
  riceBowl: () => ({
    front: `<path d="M94 204 Q120 236 146 204 Z" fill="#e8605a" stroke="#3a3a4a" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="120" cy="203" rx="26" ry="9" fill="#fff" stroke="#3a3a4a" stroke-width="2.5"/><path d="M150 186 L172 168 M156 190 L178 172" stroke="#8b5a2b" stroke-width="3" stroke-linecap="round"/>`,
  }),
  mochi: () => ({
    front: `<ellipse cx="190" cy="214" rx="20" ry="12" fill="#fff" stroke="#3a3a4a" stroke-width="2.5"/><ellipse cx="190" cy="204" rx="14" ry="9" fill="#fff" stroke="#3a3a4a" stroke-width="2.5"/><ellipse cx="190" cy="197" rx="8" ry="4" fill="#ff9f43" stroke="#3a3a4a" stroke-width="2"/>`,
  }),
  notebook: () => ({
    back: `<path d="M50 212 L120 200 L190 212 L190 232 L120 222 L50 232 Z" fill="#fff" stroke="#3a3a4a" stroke-width="2.5" stroke-linejoin="round"/><path d="M120 200 V222" stroke="#3a3a4a" stroke-width="2"/><path d="M60 216 l44 -7 M60 222 l44 -7 M136 209 l44 7 M136 215 l44 7" stroke="#9ec5ff" stroke-width="1.5"/>`,
    front: `<g fill="#ff6aa2">${heartPath(178, 74, 7)}</g>`,
  }),
  box: () => ({
    front: `<path d="M64 170 L176 170 L170 236 L70 236 Z" fill="#d9a066" stroke="#7a5230" stroke-width="3" stroke-linejoin="round"/><path d="M64 170 L52 154 L96 158 L104 170 M176 170 L188 154 L144 158 L136 170" fill="#e8b47a" stroke="#7a5230" stroke-width="3" stroke-linejoin="round"/><path d="M100 196 h40" stroke="#7a5230" stroke-width="2" opacity="0.6"/>`,
  }),
  karaage: () => ({
    front: `<path d="M160 214 L210 214 L204 230 L166 230 Z" fill="#fff" stroke="#3a3a4a" stroke-width="2.5"/><g fill="#c8782c" stroke="#7a4a1a" stroke-width="2"><circle cx="174" cy="208" r="8"/><circle cx="190" cy="206" r="9"/><circle cx="182" cy="198" r="7"/></g>`,
  }),
  question: () => ({
    front: `<text x="172" y="88" fill="#6c5ce7" font-size="30" font-weight="bold" font-family="sans-serif">?</text>`
      + `<g stroke="#3a3a4a" stroke-width="2.5"><path d="M90 214 q14 -10 28 0 v8 h-28 Z" fill="#fff"/><path d="M122 214 q14 -10 28 0 v8 h-28 Z" fill="#fff"/></g><path d="M92 220 h24" stroke="#e8343f" stroke-width="3"/><path d="M124 220 h24" stroke="#3a7bd5" stroke-width="3"/>`,
  }),
  foldedEar: () => ({}),
  milk: () => ({
    front: `<rect x="170" y="180" width="22" height="34" rx="6" fill="#fff" stroke="#3a3a4a" stroke-width="2.5"/><rect x="174" y="172" width="14" height="10" rx="3" fill="#7bc4ff" stroke="#3a3a4a" stroke-width="2.5"/><path d="M172 196 h18" stroke="#7bc4ff" stroke-width="5"/>`,
  }),
  fluff: ({ color = '#fffaf2' } = {}) => ({
    back: `<g fill="${color}" stroke="#3a3a4a" stroke-width="3">${[[70, 104, 12], [66, 128, 11], [172, 104, 12], [176, 128, 11], [80, 176, 12], [160, 176, 12], [86, 202, 11], [154, 202, 11]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`,
    front: `<path d="M150 214 L196 196" stroke="#a66b3a" stroke-width="6" stroke-linecap="round"/><rect x="184" y="186" width="26" height="14" rx="5" fill="#d98c4a" stroke="#3a3a4a" stroke-width="2" transform="rotate(-22 197 193)"/>`,
  }),
  tea: () => ({
    front: `<path d="M168 196 h28 v14 q0 12 -14 12 q-14 0 -14 -12 Z" fill="#9fd89a" stroke="#3a3a4a" stroke-width="2.5"/><path d="M174 186 q4 -6 0 -12 M184 186 q4 -6 0 -12" fill="none" stroke="#b8c2cc" stroke-width="2" stroke-linecap="round"/>`,
  }),
  puffCheeks: ({ color } = {}) => ({
    // 頭の後ろに大きなほっぺを置いて、顔の横からぷくっとはみ出させる
    preHead: `<ellipse cx="70" cy="136" rx="22" ry="17" fill="${color}" stroke="#3a3a4a" stroke-width="3"/><ellipse cx="170" cy="136" rx="22" ry="17" fill="${color}" stroke="#3a3a4a" stroke-width="3"/>`,
    face: `<ellipse cx="84" cy="134" rx="10" ry="6" fill="#ffb3c1" opacity="0.85"/><ellipse cx="156" cy="134" rx="10" ry="6" fill="#ffb3c1" opacity="0.85"/>`,
    front: `<g transform="translate(186 204)"><ellipse rx="10" ry="12" fill="#b07a45" stroke="#3a3a4a" stroke-width="2.5"/><path d="M-11 -6 Q0 -18 11 -6 Z" fill="#7a5230" stroke="#3a3a4a" stroke-width="2.5"/></g>`,
  }),
  tissue: () => ({
    front: `<rect x="166" y="196" width="34" height="22" rx="4" fill="#cfe9ff" stroke="#3a3a4a" stroke-width="2.5"/><path d="M176 196 q7 -16 14 0" fill="#fff" stroke="#3a3a4a" stroke-width="2"/>`,
  }),

  // --- N（かっこいい） ---
  gakuran: () => ({
    body: `<path d="M80 160 Q120 150 160 160 L162 214 Q120 222 78 214 Z" fill="#2b2f45" stroke="#14172e" stroke-width="3"/><path d="M110 156 L120 170 L130 156" fill="none" stroke="#c9d1db" stroke-width="3"/><g fill="#ffd54a"><circle cx="120" cy="180" r="3"/><circle cx="120" cy="194" r="3"/></g>`,
    head: `<path d="M69 98 Q120 84 171 98 L170 108 Q120 96 70 108 Z" fill="#fff" stroke="#3a3a4a" stroke-width="2.5"/>`,
    front: `<rect x="160" y="196" width="40" height="22" rx="10" fill="#e8b47a" stroke="#3a3a4a" stroke-width="2.5"/><path d="M164 204 q8 -6 16 0 q8 6 16 0" fill="none" stroke="#a0522d" stroke-width="3"/>`,
  }),
  scarf: () => ({
    bg: `<circle cx="196" cy="52" r="20" fill="#ffd27a" opacity="0.9"/><path d="M0 200 Q60 180 120 196 Q180 210 240 190 V240 H0 Z" fill="#ffffff" opacity="0.25"/>`,
    body: `<path d="M84 152 Q120 166 156 152 L156 162 Q120 176 84 162 Z" fill="#e8343f" stroke="#3a3a4a" stroke-width="2.5"/><path d="M150 160 Q190 160 214 140 L210 154 Q188 172 152 170 Z" fill="#e8343f" stroke="#3a3a4a" stroke-width="2.5"/>`,
    front: `<path d="M50 228 L92 150" stroke="#8b5a2b" stroke-width="5" stroke-linecap="round"/><path d="M80 140 q14 -8 24 6 q-4 16 -20 14 q-12 -6 -4 -20 Z" fill="#6c9bd2" stroke="#3a3a4a" stroke-width="2.5"/>`,
  }),
  baseball: () => ({
    head: `<path d="M74 96 Q74 62 120 62 Q166 62 166 96 Z" fill="#3a7bd5" stroke="#1d3f70" stroke-width="3"/><path d="M150 92 Q186 92 192 102 Q170 104 150 100 Z" fill="#3a7bd5" stroke="#1d3f70" stroke-width="3"/><text x="120" y="88" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold" font-family="sans-serif">C</text>`,
    body: `<path d="M84 166 Q120 156 156 166 L158 210 Q120 218 82 210 Z" fill="#fff" stroke="#1d3f70" stroke-width="2.5"/><text x="120" y="198" text-anchor="middle" fill="#3a7bd5" font-size="20" font-weight="bold" font-family="sans-serif">1</text>`,
    front: `<circle cx="186" cy="212" r="13" fill="#fff" stroke="#3a3a4a" stroke-width="2.5"/><path d="M178 202 q6 10 0 20 M194 202 q-6 10 0 20" fill="none" stroke="#e8343f" stroke-width="2"/>`,
  }),
  soccer: () => ({
    bg: `<path d="M0 200 H240 V240 H0 Z" fill="#ffffff" opacity="0.18"/><path d="M0 214 H240" stroke="#fff" stroke-width="3" opacity="0.6"/>`,
    body: `<path d="M84 166 Q120 156 156 166 L158 210 Q120 218 82 210 Z" fill="#e8343f" stroke="#7a1a20" stroke-width="2.5"/><path d="M102 162 V214 M138 162 V214" stroke="#fff" stroke-width="7"/><text x="120" y="198" text-anchor="middle" fill="#fff" font-size="18" font-weight="bold" font-family="sans-serif">10</text>`,
    front: `<circle cx="186" cy="212" r="14" fill="#fff" stroke="#3a3a4a" stroke-width="2.5"/><path d="M186 205 l6 4 -2 7 h-8 l-2 -7 Z" fill="#3a3a4a"/>`,
  }),
  pirate: () => ({
    bg: `<path d="M0 196 Q30 186 60 196 T120 196 T180 196 T240 196 V240 H0 Z" fill="#2f86c8" opacity="0.7"/>`,
    head: `<path d="M70 92 Q72 56 120 58 Q168 56 170 92 Q120 80 70 92 Z" fill="#2b2b38" stroke="#14141c" stroke-width="3"/><path d="M60 92 Q120 76 180 92" fill="none" stroke="#14141c" stroke-width="6" stroke-linecap="round"/><g fill="#fff"><circle cx="120" cy="72" r="6"/><rect x="112" y="80" width="16" height="3" rx="1.5"/></g>`
      + `<path d="M84 104 L156 128" stroke="#14141c" stroke-width="3"/><ellipse cx="136" cy="117" rx="11" ry="9" fill="#14141c"/>`,
    front: `<rect x="160" y="190" width="40" height="30" rx="3" fill="#f3e2b8" stroke="#8b5a2b" stroke-width="2.5"/><path d="M168 200 q8 6 16 -2 q6 -4 10 4" fill="none" stroke="#8b5a2b" stroke-width="2" stroke-dasharray="3 3"/><path d="M188 208 l5 5 M193 208 l-5 5" stroke="#e8343f" stroke-width="2.5"/>`,
  }),
  astronaut: () => ({
    bg: `<circle cx="196" cy="56" r="20" fill="#4dc9ff"/><path d="M184 48 q8 -4 12 4 q6 8 14 2" fill="none" stroke="#5ee27a" stroke-width="5" stroke-linecap="round"/>`,
    back: `<circle cx="120" cy="114" r="64" fill="#d9f2ff" fill-opacity="0.35" stroke="#c9d1db" stroke-width="5"/>`,
    body: `<path d="M80 164 Q120 150 160 164 L162 212 Q120 222 78 212 Z" fill="#f2f4f8" stroke="#5c6878" stroke-width="2.5"/><rect x="108" y="176" width="24" height="16" rx="3" fill="#3a7bd5" stroke="#5c6878" stroke-width="2"/>`,
    front: `<path d="M84 76 q10 -10 22 -12" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.8"/>`,
  }),
  gamer: () => ({
    head: `<path d="M68 112 Q68 60 120 60 Q172 60 172 112" fill="none" stroke="#2b2b38" stroke-width="7"/><rect x="58" y="100" width="18" height="30" rx="8" fill="#ff5e8a" stroke="#2b2b38" stroke-width="3"/><rect x="164" y="100" width="18" height="30" rx="8" fill="#ff5e8a" stroke="#2b2b38" stroke-width="3"/>`,
    front: `<path d="M88 196 Q120 188 152 196 Q160 216 146 216 Q136 216 130 208 H110 Q104 216 94 216 Q80 216 88 196 Z" fill="#4a4a5c" stroke="#1b1b22" stroke-width="2.5"/><path d="M98 200 v8 M94 204 h8" stroke="#fff" stroke-width="2.5"/><circle cx="140" cy="200" r="2.5" fill="#ff5e8a"/><circle cx="146" cy="206" r="2.5" fill="#4dc9ff"/>`,
  }),
  skater: () => ({
    back: `<path d="M56 226 Q120 240 184 226" fill="none" stroke="#e8343f" stroke-width="9" stroke-linecap="round"/><circle cx="76" cy="236" r="5" fill="#2b2b38"/><circle cx="164" cy="236" r="5" fill="#2b2b38"/>`,
    head: `<path d="M74 96 Q74 62 120 62 Q166 62 166 96 Z" fill="#5ee27a" stroke="#1f6b45" stroke-width="3"/><path d="M90 92 Q60 92 52 100 Q72 104 92 100 Z" fill="#5ee27a" stroke="#1f6b45" stroke-width="3"/>`,
  }),
  fishing: () => ({
    bg: `<path d="M0 196 Q60 186 120 196 T240 196 V240 H0 Z" fill="#7bc4ff" opacity="0.6"/>`,
    head: `<ellipse cx="120" cy="82" rx="62" ry="10" fill="#f2d16b" stroke="#a6862a" stroke-width="3"/><path d="M90 82 Q92 52 120 52 Q148 52 150 82 Z" fill="#f2d16b" stroke="#a6862a" stroke-width="3"/><path d="M90 76 Q120 70 150 76" fill="none" stroke="#e8343f" stroke-width="5"/>`,
    front: `<path d="M150 200 L216 120" stroke="#8b5a2b" stroke-width="4" stroke-linecap="round"/><path d="M216 120 V184" stroke="#3a3a4a" stroke-width="1.5"/><path d="M206 184 h12 v20 h8 v8 h-20 Z" fill="#6b4430" stroke="#3a3a4a" stroke-width="2"/>`,
  }),
  firefighter: () => ({
    head: `<path d="M70 98 Q70 56 120 56 Q170 56 170 98 Z" fill="#e8343f" stroke="#7a1a20" stroke-width="3"/><path d="M58 98 Q120 88 182 98 L178 106 Q120 98 62 106 Z" fill="#e8343f" stroke="#7a1a20" stroke-width="3"/><path d="M110 64 h20 v16 l-10 6 l-10 -6 Z" fill="#ffd54a" stroke="#a86f00" stroke-width="2"/>`,
    front: `<path d="M160 92 q-6 10 0 14 q6 -4 0 -14 Z" fill="#8ed0ff" stroke="#4aa8e0" stroke-width="1.5"/><path d="M168 196 h28 v14 q0 12 -14 12 q-14 0 -14 -12 Z" fill="#c9e8c6" stroke="#3a3a4a" stroke-width="2.5"/>`,
  }),
  boxer: () => ({
    bg: `<g stroke="#fff" stroke-width="4" opacity="0.6"><path d="M0 70 H240 M0 110 H240 M0 150 H240"/></g>`,
    front: `<ellipse cx="86" cy="206" rx="20" ry="17" fill="#e8343f" stroke="#7a1a20" stroke-width="3"/><ellipse cx="154" cy="206" rx="20" ry="17" fill="#e8343f" stroke="#7a1a20" stroke-width="3"/><path d="M76 200 q8 -6 16 0 M144 200 q8 -6 16 0" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>`,
  }),
  knight: () => ({
    bg: `<g fill="#ffffff" opacity="0.2"><rect x="0" y="40" width="40" height="20"/><rect x="60" y="20" width="40" height="20"/><rect x="200" y="50" width="40" height="20"/><rect x="170" y="10" width="40" height="20"/></g>`,
    head: `<path d="M120 76 Q130 50 150 46 Q140 60 136 78" fill="#e8343f" stroke="#7a1a20" stroke-width="2.5"/>`,
    body: `<path d="M82 164 Q120 150 158 164 L160 212 Q120 222 80 212 Z" fill="#c9d1db" stroke="#5c6878" stroke-width="3"/><path d="M120 158 V218" stroke="#5c6878" stroke-width="2.5"/>`,
    front: `<path d="M54 160 h40 v30 q0 22 -20 30 q-20 -8 -20 -30 Z" fill="#3a7bd5" stroke="#1d3f70" stroke-width="3"/><path d="M74 168 v40 M60 184 h28" stroke="#ffd54a" stroke-width="5"/>`,
  }),
};

// ---------- 組み立て ----------

// options.noBg：背景を描かない（図鑑でまだ持っていないネコを影だけで見せるとき）
function buildCatSVG(cat, options = {}) {
  const a = { line: '#3a3a4a', earInner: '#ffb3c1', ...cat.art };
  const id = 'cat' + cat.id;
  const items = (a.items || []).map(it => (typeof it === 'string' ? CAT_ITEMS[it]() : CAT_ITEMS[it.name](it)));
  const layer = name => items.map(it => it[name] || '').join('');
  const L = a.line;
  const fur = a.fur;
  const tailColor = a.tail || fur;
  const sw = 3;

  // 体型：ふつう・まるい（chubby）・子ネコ（small）
  const head = { ...CAT_HEAD, ...(a.shape === 'chubby' ? { rx: 58, ry: 44 } : {}) };
  const body = { ...CAT_BODY, ...(a.shape === 'chubby' ? { rx: 50, ry: 38 } : {}) };
  const catTransform = a.shape === 'small' ? 'translate(21.6 40) scale(0.82)' : '';

  const ellipse = (e, fill, extra = '') => `<ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}" fill="${fill}" ${extra}/>`;
  const leftEar = a.earL || fur;
  const rightEar = a.earR || fur;
  const ears = a.folded
    ? `<path d="M78 98 L84 56 L112 82 Z" fill="${leftEar}" stroke="${L}" stroke-width="${sw}" stroke-linejoin="round"/><path d="M86 88 L88 68 L102 82 Z" fill="${a.earInner}"/>`
      + `<path d="M162 98 L170 76 L150 70 L128 82 Z" fill="${rightEar}" stroke="${L}" stroke-width="${sw}" stroke-linejoin="round"/>`
    : `<path d="M78 98 L84 56 L112 82 Z" fill="${leftEar}" stroke="${L}" stroke-width="${sw}" stroke-linejoin="round"/><path d="M86 88 L88 68 L102 82 Z" fill="${a.earInner}"/>`
      + `<path d="M162 98 L156 56 L128 82 Z" fill="${rightEar}" stroke="${L}" stroke-width="${sw}" stroke-linejoin="round"/><path d="M154 88 L152 68 L138 82 Z" fill="${a.earInner}"/>`;

  const tailItem = layer('tail');
  const tail = tailItem
    ? `<path d="${TAIL_PATH}" fill="none" stroke="${L}" stroke-width="17" stroke-linecap="round"/>${tailItem}`
    : `<path d="${TAIL_PATH}" fill="none" stroke="${L}" stroke-width="17" stroke-linecap="round"/><path d="${TAIL_PATH}" fill="none" stroke="${tailColor}" stroke-width="11" stroke-linecap="round"/>`;

  const paws = [104, 136].map(x => `<ellipse cx="${x}" cy="218" rx="13" ry="8" fill="${a.paws || fur}" stroke="${L}" stroke-width="${sw}"/>`).join('');
  const cheeks = a.noCheeks ? '' : `<ellipse cx="91" cy="131" rx="8" ry="5" fill="#ffb3c1" opacity="0.75"/><ellipse cx="149" cy="131" rx="8" ry="5" fill="#ffb3c1" opacity="0.75"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="${cat.name}">`
    + `<defs><clipPath id="${id}-h">${ellipse(head, '#000')}</clipPath><clipPath id="${id}-b">${ellipse(body, '#000')}</clipPath></defs>`
    + (options.noBg ? '' : catBackground(a.bg, id) + layer('bg'))
    + `<g transform="${catTransform}">`
    + layer('back')
    + tail
    + ellipse(body, fur)
    + `<g clip-path="url(#${id}-b)">${bodyPattern(a)}</g>`
    + ellipse(body, 'none', `stroke="${L}" stroke-width="${sw}"`)
    + layer('body')
    + paws
    + ears
    + layer('preHead')
    + ellipse(head, fur)
    + `<g clip-path="url(#${id}-h)">${headPattern(a)}</g>`
    + ellipse(head, 'none', `stroke="${L}" stroke-width="${sw}"`)
    + layer('face')
    + catEyes(a.eyes || 'round', a)
    + cheeks
    + catMouth(a.mouth, a)
    + catWhiskers(a)
    + layer('head')
    + layer('front')
    + `</g></svg>`;
}
