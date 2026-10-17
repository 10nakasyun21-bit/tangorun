// 対戦の相手（動物）の絵。ネコと同じタッチ（太めの線・まるいからだ）の SVG を組み立てる
// buildAnimalSVG(key) → <svg>…</svg>。背景は透明（対戦の画面の背景の上にのせる）

const AL = '#3a3a4a'; // 線の色

// 目：dot（まる）・angry（つり目＋まゆ）・sleepy（半目）。enemy らしく少しだけいじわるな顔にする
function aEyes(x1, x2, y, { kind = 'angry', r = 6, color = AL, brow = AL } = {}) {
  const eye = x => `<ellipse cx="${x}" cy="${y}" rx="${r * 0.85}" ry="${r}" fill="${color}"/><circle cx="${x + r * 0.3}" cy="${y - r * 0.35}" r="${r * 0.33}" fill="#fff"/>`;
  if (kind === 'sleepy') return `<path d="M${x1 - r} ${y} Q${x1} ${y + r} ${x1 + r} ${y} M${x2 - r} ${y} Q${x2} ${y + r} ${x2 + r} ${y}" fill="none" stroke="${AL}" stroke-width="3.5" stroke-linecap="round"/>`;
  let s = eye(x1) + eye(x2);
  if (kind === 'angry') {
    const d = r * 1.9;
    s += `<path d="M${x1 - r * 1.4} ${y - d} L${x1 + r * 1.1} ${y - d + r * 0.9} M${x2 + r * 1.4} ${y - d} L${x2 - r * 1.1} ${y - d + r * 0.9}" stroke="${brow}" stroke-width="4" stroke-linecap="round"/>`;
  }
  return s;
}

function aCheeks(x1, x2, y, color = '#ff9fae') {
  return `<ellipse cx="${x1}" cy="${y}" rx="9" ry="5.5" fill="${color}" opacity="0.6"/><ellipse cx="${x2}" cy="${y}" rx="9" ry="5.5" fill="${color}" opacity="0.6"/>`;
}

function aStroke(w = 4) {
  return `stroke="${AL}" stroke-width="${w}" stroke-linejoin="round"`;
}

// まるい哺乳類の基本形（からだ＋頭）。耳や口は各動物で足す
function aMammal({ fur, belly, head = [120, 120, 62, 56], body = [120, 196, 56, 36], ears = '', face = '', back = '', front = '' }) {
  const [hx, hy, hrx, hry] = head;
  const [bx, by, brx, bry] = body;
  return back
    + `<ellipse cx="${bx}" cy="${by}" rx="${brx}" ry="${bry}" fill="${fur}" ${aStroke()}/>`
    + (belly ? `<ellipse cx="${bx}" cy="${by + 6}" rx="${brx * 0.55}" ry="${bry * 0.7}" fill="${belly}"/>` : '')
    + `<ellipse cx="${bx - brx * 0.55}" cy="${by + bry * 0.8}" rx="14" ry="9" fill="${fur}" ${aStroke(3.5)}/><ellipse cx="${bx + brx * 0.55}" cy="${by + bry * 0.8}" rx="14" ry="9" fill="${fur}" ${aStroke(3.5)}/>`
    + ears
    + `<ellipse cx="${hx}" cy="${hy}" rx="${hrx}" ry="${hry}" fill="${fur}" ${aStroke()}/>`
    + face + front;
}

const ANIMAL_ART = {
  mouse: () => aMammal({
    fur: '#b8bcc8', belly: '#e6e8ef', head: [120, 128, 56, 50], body: [120, 198, 46, 32],
    back: `<path d="M160 205 Q206 214 204 180 Q202 160 186 168" fill="none" stroke="#f2a6b4" stroke-width="5" stroke-linecap="round"/>`,
    ears: `<circle cx="72" cy="90" r="30" fill="#b8bcc8" ${aStroke()}/><circle cx="168" cy="90" r="30" fill="#b8bcc8" ${aStroke()}/><circle cx="72" cy="92" r="17" fill="#f7b8c4"/><circle cx="168" cy="92" r="17" fill="#f7b8c4"/>`,
    face: aEyes(100, 140, 124, { r: 6 }) + `<ellipse cx="120" cy="146" rx="8" ry="6" fill="#f28b9b" ${aStroke(2.5)}/>`
      + `<g stroke="${AL}" stroke-width="2" stroke-linecap="round"><path d="M100 150 L72 146 M100 156 L72 160 M140 150 L168 146 M140 156 L168 160"/></g>`
      + `<path d="M114 158 Q120 164 126 158" fill="none" stroke="${AL}" stroke-width="2.5" stroke-linecap="round"/>`,
  }),

  sparrow: () => `<ellipse cx="120" cy="150" rx="70" ry="66" fill="#b07a4a" ${aStroke()}/>`
    + `<path d="M74 110 Q120 60 166 110 Q150 96 120 96 Q90 96 74 110 Z" fill="#7a4a2a"/>`
    + `<ellipse cx="120" cy="170" rx="44" ry="40" fill="#f3e2c8"/>`
    + `<ellipse cx="62" cy="160" rx="18" ry="34" fill="#8a5a34" ${aStroke(3.5)} transform="rotate(18 62 160)"/><ellipse cx="178" cy="160" rx="18" ry="34" fill="#8a5a34" ${aStroke(3.5)} transform="rotate(-18 178 160)"/>`
    + `<circle cx="84" cy="138" r="9" fill="#3a3a4a" opacity="0.85"/><circle cx="156" cy="138" r="9" fill="#3a3a4a" opacity="0.85"/>`
    + aEyes(102, 138, 122, { r: 6 })
    + `<path d="M110 136 L130 136 L120 150 Z" fill="#f2b33d" ${aStroke(2.5)}/>`
    + `<path d="M104 214 l-6 14 M104 214 l2 14 M136 214 l-2 14 M136 214 l6 14" stroke="#e08a2a" stroke-width="4" stroke-linecap="round"/>`,

  crow: () => `<path d="M60 170 Q20 150 30 110 Q60 130 70 150 Z" fill="#2b2f3f" ${aStroke(3.5)}/><path d="M180 170 Q220 150 210 110 Q180 130 170 150 Z" fill="#2b2f3f" ${aStroke(3.5)}/>`
    + `<ellipse cx="120" cy="150" rx="72" ry="70" fill="#2b2f3f" ${aStroke()}/>`
    + `<path d="M78 112 Q120 80 162 112" fill="none" stroke="#5b6b9a" stroke-width="5" stroke-linecap="round" opacity="0.7"/>`
    + `<ellipse cx="120" cy="178" rx="40" ry="34" fill="#3a4058"/>`
    + aEyes(100, 140, 124, { r: 7, color: '#ffd54a', brow: '#11131c' })
    + `<path d="M104 140 L136 140 L120 168 Z" fill="#4a4a52" ${aStroke(3)}/><path d="M106 146 L134 146" stroke="#2b2b32" stroke-width="2"/>`
    + `<path d="M100 216 l-8 14 M100 216 l2 14 M140 216 l-2 14 M140 216 l8 14" stroke="#4a4a52" stroke-width="5" stroke-linecap="round"/>`,

  rabbit: () => aMammal({
    fur: '#f6f2ee', belly: '#ffffff', head: [120, 136, 56, 50], body: [120, 200, 46, 30],
    ears: `<ellipse cx="96" cy="66" rx="17" ry="46" fill="#f6f2ee" ${aStroke()} transform="rotate(-10 96 66)"/><ellipse cx="144" cy="66" rx="17" ry="46" fill="#f6f2ee" ${aStroke()} transform="rotate(10 144 66)"/>`
      + `<ellipse cx="96" cy="70" rx="8" ry="32" fill="#f7b8c4" transform="rotate(-10 96 70)"/><ellipse cx="144" cy="70" rx="8" ry="32" fill="#f7b8c4" transform="rotate(10 144 70)"/>`,
    face: aEyes(100, 140, 132, { r: 6, color: '#c0394b' }) + aCheeks(90, 150, 150)
      + `<path d="M114 148 L126 148 L120 154 Z" fill="#f28b9b"/><path d="M120 154 L120 160 M112 160 Q120 166 128 160" fill="none" stroke="${AL}" stroke-width="2.5" stroke-linecap="round"/>`
      + `<rect x="114" y="161" width="12" height="9" rx="2" fill="#fff" ${aStroke(2)}/>`,
  }),

  frog: () => `<ellipse cx="120" cy="196" rx="70" ry="34" fill="#6cc25a" ${aStroke()}/>`
    + `<ellipse cx="62" cy="214" rx="22" ry="12" fill="#6cc25a" ${aStroke(3.5)}/><ellipse cx="178" cy="214" rx="22" ry="12" fill="#6cc25a" ${aStroke(3.5)}/>`
    + `<ellipse cx="120" cy="146" rx="80" ry="52" fill="#7dd36a" ${aStroke()}/>`
    + `<circle cx="80" cy="100" r="26" fill="#7dd36a" ${aStroke()}/><circle cx="160" cy="100" r="26" fill="#7dd36a" ${aStroke()}/>`
    + `<circle cx="80" cy="100" r="15" fill="#fff"/><circle cx="160" cy="100" r="15" fill="#fff"/>`
    + `<ellipse cx="82" cy="102" rx="7" ry="9" fill="${AL}"/><ellipse cx="158" cy="102" rx="7" ry="9" fill="${AL}"/>`
    + `<path d="M62 84 L94 92 M178 84 L146 92" stroke="${AL}" stroke-width="4" stroke-linecap="round"/>`
    + `<path d="M76 152 Q120 182 164 152" fill="none" stroke="${AL}" stroke-width="4" stroke-linecap="round"/>`
    + aCheeks(70, 170, 150, '#ff8fa3') + `<ellipse cx="120" cy="200" rx="40" ry="20" fill="#d9f2b8"/>`,

  tanuki: () => aMammal({
    fur: '#9a6a44', belly: '#f0dcbc', head: [120, 120, 64, 56], body: [120, 196, 62, 38],
    back: `<path d="M172 200 Q222 198 214 160 Q200 150 192 172" fill="#7a5034" ${aStroke(3.5)}/>`,
    ears: `<ellipse cx="74" cy="78" rx="18" ry="16" fill="#5a3a24" ${aStroke()}/><ellipse cx="166" cy="78" rx="18" ry="16" fill="#5a3a24" ${aStroke()}/>`,
    face: `<path d="M74 118 Q92 98 112 122 Q96 140 74 130 Z M166 118 Q148 98 128 122 Q144 140 166 130 Z" fill="#4a2e1c"/>`
      + aEyes(96, 144, 120, { r: 6, color: '#fff3d6' }) + `<ellipse cx="120" cy="146" rx="22" ry="16" fill="#f0dcbc"/>`
      + `<ellipse cx="120" cy="140" rx="7" ry="5" fill="${AL}"/><path d="M110 152 Q120 158 130 152" fill="none" stroke="${AL}" stroke-width="2.5" stroke-linecap="round"/>`
      + `<path d="M104 70 Q120 38 140 66 Q124 60 120 72 Z" fill="#5fbf5a" ${aStroke(2.5)}/>`,
  }),

  fox: () => aMammal({
    fur: '#f08a3a', belly: '#fff5e8', head: [120, 128, 60, 50], body: [120, 198, 48, 32],
    back: `<path d="M160 206 Q222 214 214 156 Q198 176 180 180" fill="#f08a3a" ${aStroke(3.5)}/><path d="M206 172 Q214 160 214 156 Q204 168 196 172 Z" fill="#fff"/>`,
    ears: `<path d="M70 104 L76 48 L112 86 Z" fill="#f08a3a" ${aStroke()}/><path d="M170 104 L164 48 L128 86 Z" fill="#f08a3a" ${aStroke()}/>`
      + `<path d="M80 96 L82 62 L102 86 Z M160 96 L158 62 L138 86 Z" fill="#3a2a2a"/>`,
    face: `<path d="M70 132 Q120 196 170 132 Q148 146 120 146 Q92 146 70 132 Z" fill="#fff5e8"/>`
      + aEyes(98, 142, 122, { r: 5.5 }) + `<ellipse cx="120" cy="146" rx="7" ry="5" fill="${AL}"/>`
      + `<path d="M112 156 Q120 162 128 156" fill="none" stroke="${AL}" stroke-width="2.5" stroke-linecap="round"/>`,
  }),

  raccoon: () => aMammal({
    fur: '#9a9aa6', belly: '#dcdce4', head: [120, 126, 60, 52], body: [120, 198, 50, 32],
    back: `<path d="M162 204 Q214 210 210 160" fill="none" stroke="#9a9aa6" stroke-width="24" stroke-linecap="round"/><path d="M162 204 Q214 210 210 160" fill="none" stroke="#3a3a4a" stroke-width="24" stroke-linecap="round" stroke-dasharray="9 11" opacity="0.85"/>`,
    ears: `<ellipse cx="78" cy="82" rx="18" ry="18" fill="#9a9aa6" ${aStroke()}/><ellipse cx="162" cy="82" rx="18" ry="18" fill="#9a9aa6" ${aStroke()}/>`,
    face: `<path d="M68 118 Q120 100 172 118 Q170 136 150 134 Q134 122 120 132 Q106 122 90 134 Q70 136 68 118 Z" fill="#3a3a4a"/>`
      + aEyes(98, 142, 122, { r: 5.5, color: '#fff' }) + `<ellipse cx="120" cy="150" rx="20" ry="14" fill="#f2f2f6"/>`
      + `<ellipse cx="120" cy="144" rx="7" ry="5" fill="${AL}"/><path d="M112 156 Q120 161 128 156" fill="none" stroke="${AL}" stroke-width="2.5" stroke-linecap="round"/>`,
  }),

  boar: () => aMammal({
    fur: '#6e4a32', belly: '#a07a5a', head: [120, 124, 66, 56], body: [120, 196, 64, 38],
    ears: `<path d="M64 96 L60 60 L96 80 Z" fill="#6e4a32" ${aStroke()}/><path d="M176 96 L180 60 L144 80 Z" fill="#6e4a32" ${aStroke()}/>`
      + `<path d="M96 70 l6 -16 l6 14 l6 -18 l6 18 l6 -14 l6 16" fill="#4a2e1c" ${aStroke(2.5)}/>`,
    face: aEyes(96, 144, 112, { r: 6, color: '#ffde59', brow: '#2a1a10' })
      + `<ellipse cx="120" cy="150" rx="30" ry="22" fill="#d8a08a" ${aStroke()}/><ellipse cx="110" cy="150" rx="5" ry="7" fill="${AL}"/><ellipse cx="130" cy="150" rx="5" ry="7" fill="${AL}"/>`
      + `<path d="M88 160 Q78 146 82 130 Q90 146 98 156 Z M152 160 Q162 146 158 130 Q150 146 142 156 Z" fill="#fffaf0" ${aStroke(2.5)}/>`,
  }),

  monkey: () => aMammal({
    fur: '#8a5a3a', belly: '#e8c8a4', head: [120, 124, 58, 54], body: [120, 198, 48, 32],
    back: `<path d="M160 210 Q214 214 206 172 Q200 154 186 162" fill="none" stroke="#8a5a3a" stroke-width="9" stroke-linecap="round"/>`,
    ears: `<circle cx="62" cy="126" r="18" fill="#e8c8a4" ${aStroke()}/><circle cx="178" cy="126" r="18" fill="#e8c8a4" ${aStroke()}/>`,
    face: `<path d="M120 92 Q150 84 156 112 Q172 150 120 168 Q68 150 84 112 Q90 84 120 92 Z" fill="#f2d4b0" ${aStroke(3)}/>`
      + aEyes(104, 136, 118, { r: 5.5 }) + `<circle cx="114" cy="138" r="2.5" fill="${AL}"/><circle cx="126" cy="138" r="2.5" fill="${AL}"/>`
      + `<path d="M106 150 Q120 160 134 150" fill="none" stroke="${AL}" stroke-width="3" stroke-linecap="round"/>` + aCheeks(94, 146, 140),
  }),

  snake: () => `<ellipse cx="120" cy="208" rx="74" ry="22" fill="#5cb85c" ${aStroke()}/>`
    + `<ellipse cx="120" cy="184" rx="58" ry="20" fill="#68c468" ${aStroke()}/>`
    + `<path d="M150 180 Q172 150 150 128" fill="none" stroke="${AL}" stroke-width="30" stroke-linecap="round"/><path d="M150 180 Q172 150 150 128" fill="none" stroke="#5cb85c" stroke-width="22" stroke-linecap="round"/>`
    + `<g fill="#3f8f3f" opacity="0.6"><circle cx="90" cy="206" r="5"/><circle cx="120" cy="212" r="5"/><circle cx="150" cy="206" r="5"/><circle cx="100" cy="184" r="4"/><circle cx="140" cy="184" r="4"/></g>`
    + `<ellipse cx="128" cy="108" rx="46" ry="36" fill="#6fcf6f" ${aStroke()}/>`
    + aEyes(110, 146, 102, { r: 6, color: '#ffd54a', brow: AL })
    + `<path d="M118 132 Q128 138 138 132" fill="none" stroke="${AL}" stroke-width="2.5" stroke-linecap="round"/>`
    + `<path d="M128 140 L128 156 L122 164 M128 156 L134 164" fill="none" stroke="#e5484d" stroke-width="3" stroke-linecap="round"/>`,

  wolf: (fur = '#8f96a8', light = '#e4e7ef') => aMammal({
    fur, belly: light, head: [120, 128, 62, 52], body: [120, 198, 52, 32],
    back: `<path d="M164 208 Q224 206 212 160 Q200 182 180 184" fill="${fur}" ${aStroke(3.5)}/>`,
    ears: `<path d="M68 106 L72 46 L110 86 Z" fill="${fur}" ${aStroke()}/><path d="M172 106 L168 46 L130 86 Z" fill="${fur}" ${aStroke()}/>`
      + `<path d="M78 98 L80 64 L100 86 Z M162 98 L160 64 L140 86 Z" fill="#f7b8c4"/>`,
    face: `<path d="M84 140 Q120 112 156 140 Q150 172 120 174 Q90 172 84 140 Z" fill="${light}" ${aStroke(3)}/>`
      + aEyes(98, 142, 120, { r: 6, color: '#ffd54a' }) + `<ellipse cx="120" cy="144" rx="9" ry="6" fill="${AL}"/>`
      + `<path d="M108 158 Q120 166 132 158" fill="none" stroke="${AL}" stroke-width="2.5" stroke-linecap="round"/><path d="M110 159 l3 7 l3 -6" fill="#fff" ${aStroke(1.5)}/>`,
  }),

  otter: () => aMammal({
    fur: '#8a6040', belly: '#e9d2b4', head: [120, 128, 56, 48], body: [120, 198, 50, 32],
    ears: `<circle cx="74" cy="100" r="12" fill="#8a6040" ${aStroke()}/><circle cx="166" cy="100" r="12" fill="#8a6040" ${aStroke()}/>`,
    face: `<ellipse cx="120" cy="148" rx="32" ry="20" fill="#f2e2cc"/>` + aEyes(100, 140, 122, { r: 6, kind: 'dot' })
      + `<ellipse cx="120" cy="142" rx="9" ry="6" fill="${AL}"/><path d="M112 154 Q120 160 128 154" fill="none" stroke="${AL}" stroke-width="2.5" stroke-linecap="round"/>`
      + `<g stroke="${AL}" stroke-width="2" stroke-linecap="round"><path d="M100 146 L80 142 M140 146 L160 142"/></g>`,
    front: `<path d="M98 200 Q120 176 142 200 Q120 212 98 200 Z" fill="#ffd0e0" ${aStroke(3)}/><path d="M108 196 L112 186 M120 198 L120 184 M132 196 L128 186" stroke="#e090b0" stroke-width="2"/>`,
  }),

  turtle: () => `<ellipse cx="62" cy="200" rx="18" ry="14" fill="#9ed36a" ${aStroke(3.5)}/><ellipse cx="178" cy="200" rx="18" ry="14" fill="#9ed36a" ${aStroke(3.5)}/>`
    + `<circle cx="120" cy="96" r="38" fill="#9ed36a" ${aStroke()}/>`
    + aEyes(106, 134, 92, { r: 5.5 }) + `<path d="M110 112 Q120 118 130 112" fill="none" stroke="${AL}" stroke-width="2.5" stroke-linecap="round"/>`
    + `<path d="M40 196 Q40 112 120 112 Q200 112 200 196 Z" fill="#5a9a4a" ${aStroke()}/>`
    + `<g fill="#78b860" stroke="#3f6f34" stroke-width="3"><path d="M120 128 L144 142 L144 168 L120 182 L96 168 L96 142 Z"/><path d="M66 172 L82 150 L92 168 L84 190 L62 190 Z"/><path d="M174 172 L158 150 L148 168 L156 190 L178 190 Z"/></g>`
    + `<path d="M36 196 L204 196" stroke="${AL}" stroke-width="4" stroke-linecap="round"/><rect x="44" y="196" width="152" height="12" rx="6" fill="#e8d9a8" ${aStroke(3)}/>`,

  crocodile: () => `<ellipse cx="120" cy="206" rx="82" ry="24" fill="#4f9a50" ${aStroke()}/>`
    + `<path d="M28 150 Q24 120 70 112 L190 118 Q220 122 218 146 Q216 168 186 166 L66 168 Q30 168 28 150 Z" fill="#5fae5c" ${aStroke()}/>`
    + `<path d="M40 150 L200 150" stroke="${AL}" stroke-width="3.5" stroke-linecap="round"/>`
    + `<path d="M48 150 l7 9 l7 -9 l7 9 l7 -9 l7 9 l7 -9 l7 9 l7 -9 l7 9 l7 -9 l7 9 l7 -9 l7 9 l7 -9 l7 9 l7 -9 l7 9 l7 -9 l7 9 l7 -9" fill="#fff" ${aStroke(1.5)}/>`
    + `<circle cx="84" cy="104" r="20" fill="#5fae5c" ${aStroke()}/><circle cx="132" cy="104" r="20" fill="#5fae5c" ${aStroke()}/>`
    + aEyes(84, 132, 104, { r: 7, color: '#ffd54a' })
    + `<circle cx="206" cy="128" r="3" fill="${AL}"/><circle cx="196" cy="126" r="3" fill="${AL}"/>`
    + `<g fill="#3f7f40"><circle cx="70" cy="200" r="6"/><circle cx="100" cy="208" r="6"/><circle cx="140" cy="208" r="6"/><circle cx="170" cy="200" r="6"/></g>`,

  penguin: () => `<path d="M64 170 Q38 160 42 128 Q60 140 72 150 Z M176 170 Q202 160 198 128 Q180 140 168 150 Z" fill="#2f3446" ${aStroke(3.5)}/>`
    + `<ellipse cx="120" cy="146" rx="62" ry="80" fill="#2f3446" ${aStroke()}/>`
    + `<path d="M120 92 Q160 86 162 120 Q172 180 120 214 Q68 180 78 120 Q80 86 120 92 Z" fill="#fff"/>`
    + aEyes(102, 138, 114, { r: 6 }) + aCheeks(92, 148, 132)
    + `<path d="M108 126 L132 126 L120 140 Z" fill="#f2a33d" ${aStroke(2.5)}/>`
    + `<ellipse cx="98" cy="224" rx="18" ry="8" fill="#f2a33d" ${aStroke(3)}/><ellipse cx="142" cy="224" rx="18" ry="8" fill="#f2a33d" ${aStroke(3)}/>`,

  seal: () => `<path d="M40 214 Q24 150 80 112 Q120 86 160 112 Q216 150 200 214 Z" fill="#9aaec4" ${aStroke()}/>`
    + `<path d="M188 214 Q220 214 226 192 Q206 196 196 200 Z" fill="#9aaec4" ${aStroke(3.5)}/>`
    + `<ellipse cx="72" cy="196" rx="22" ry="11" fill="#86a0ba" ${aStroke(3.5)} transform="rotate(-25 72 196)"/><ellipse cx="168" cy="196" rx="22" ry="11" fill="#86a0ba" ${aStroke(3.5)} transform="rotate(25 168 196)"/>`
    + `<g fill="#7c92ac" opacity="0.6"><circle cx="90" cy="170" r="5"/><circle cx="150" cy="176" r="6"/><circle cx="130" cy="200" r="4"/></g>`
    + aEyes(100, 140, 130, { r: 8, kind: 'dot' })
    + `<ellipse cx="120" cy="154" rx="20" ry="12" fill="#c8d6e4"/><ellipse cx="120" cy="148" rx="7" ry="5" fill="${AL}"/>`
    + `<g fill="${AL}"><circle cx="110" cy="156" r="1.8"/><circle cx="104" cy="152" r="1.8"/><circle cx="130" cy="156" r="1.8"/><circle cx="136" cy="152" r="1.8"/></g>`
    + `<g stroke="${AL}" stroke-width="2" stroke-linecap="round"><path d="M102 158 L78 162 M138 158 L162 162"/></g>`,

  shark: () => `<path d="M30 176 Q10 150 16 130 Q30 150 46 156 Z M30 176 Q14 200 22 218 Q34 196 48 188 Z" fill="#6c8db0" ${aStroke(3.5)}/>`
    + `<path d="M40 170 Q60 112 140 108 Q206 108 226 156 Q206 200 130 202 Q60 202 40 170 Z" fill="#7b9cc0" ${aStroke()}/>`
    + `<path d="M118 110 L132 62 L158 112 Z" fill="#7b9cc0" ${aStroke()}/>`
    + `<path d="M64 176 Q130 214 214 166 Q206 196 130 200 Q70 200 64 176 Z" fill="#eef3f8"/>`
    + `<path d="M150 170 Q186 178 214 162 Q196 190 156 186 Z" fill="#c0394b" ${aStroke(3)}/>`
    + `<path d="M154 172 l6 8 l5 -7 l6 8 l5 -7 l6 8 l5 -7 l6 7 l5 -8 l6 6" fill="#fff" ${aStroke(1.5)}/>`
    + `<ellipse cx="176" cy="140" rx="7" ry="8" fill="${AL}"/><circle cx="178" cy="137" r="2.5" fill="#fff"/><path d="M162 126 L188 134" stroke="${AL}" stroke-width="4" stroke-linecap="round"/>`
    + `<path d="M120 150 q8 10 0 20 M108 150 q8 10 0 20 M96 152 q7 8 0 16" fill="none" stroke="#56769a" stroke-width="2.5"/>`,

  scorpion: () => `<path d="M150 170 Q206 168 206 116 Q206 70 160 70 Q140 72 146 92" fill="none" stroke="${AL}" stroke-width="22" stroke-linecap="round"/>`
    + `<path d="M150 170 Q206 168 206 116 Q206 70 160 70 Q140 72 146 92" fill="none" stroke="#c0562e" stroke-width="15" stroke-linecap="round" stroke-dasharray="16 3"/>`
    + `<path d="M146 92 L134 110 L156 100 Z" fill="#3a3a4a"/>`
    + `<g stroke="${AL}" stroke-width="4" stroke-linecap="round"><path d="M86 186 l-30 18 M90 196 l-26 24 M154 186 l22 22 M148 196 l16 28"/></g>`
    + `<ellipse cx="116" cy="182" rx="50" ry="32" fill="#d0663a" ${aStroke()}/>`
    + `<path d="M90 170 Q116 160 142 170 M86 184 Q116 174 146 184" fill="none" stroke="#9a3e1e" stroke-width="3"/>`
    + `<path d="M74 160 Q46 130 50 110" fill="none" stroke="${AL}" stroke-width="12" stroke-linecap="round"/><path d="M74 160 Q46 130 50 110" fill="none" stroke="#d0663a" stroke-width="6" stroke-linecap="round"/>`
    + `<path d="M30 102 Q36 80 54 86 Q70 94 58 108 Q48 118 34 114 Q46 106 46 100 Z" fill="#d0663a" ${aStroke(3.5)}/>`
    + aEyes(102, 128, 170, { r: 5 }),

  camel: () => `<path d="M60 172 Q70 110 108 150 Q130 96 164 150 Q190 150 186 176 Z" fill="#d4a46a" ${aStroke()}/>`
    + `<ellipse cx="120" cy="196" rx="66" ry="34" fill="#d4a46a" ${aStroke()}/>`
    + `<g fill="#c08e52" ${aStroke(3.5)}><rect x="72" y="208" width="16" height="22" rx="6"/><rect x="152" y="208" width="16" height="22" rx="6"/></g>`
    + `<ellipse cx="120" cy="104" rx="44" ry="50" fill="#e0b47a" ${aStroke()}/>`
    + `<ellipse cx="80" cy="76" rx="9" ry="13" fill="#e0b47a" ${aStroke(3.5)}/><ellipse cx="160" cy="76" rx="9" ry="13" fill="#e0b47a" ${aStroke(3.5)}/>`
    + aEyes(102, 138, 96, { r: 6, kind: 'sleepy' }) + `<path d="M94 86 l14 4 M146 86 l-14 4" stroke="${AL}" stroke-width="3" stroke-linecap="round"/>`
    + `<ellipse cx="120" cy="132" rx="26" ry="18" fill="#f0cc96" ${aStroke(3)}/><path d="M110 130 l4 4 M130 130 l-4 4 M112 142 Q120 146 128 142" fill="none" stroke="${AL}" stroke-width="2.5" stroke-linecap="round"/>`,

  cobra: () => `<ellipse cx="120" cy="210" rx="72" ry="20" fill="#8a7a3a" ${aStroke()}/>`
    + `<path d="M120 200 Q148 176 120 150" fill="none" stroke="${AL}" stroke-width="30" stroke-linecap="round"/><path d="M120 200 Q148 176 120 150" fill="none" stroke="#a8964c" stroke-width="22" stroke-linecap="round"/>`
    + `<path d="M120 50 Q190 66 182 130 Q170 160 120 164 Q70 160 58 130 Q50 66 120 50 Z" fill="#a8964c" ${aStroke()}/>`
    + `<path d="M120 70 Q164 82 160 128 Q148 148 120 150 Q92 148 80 128 Q76 82 120 70 Z" fill="#f0d98a"/>`
    + `<g fill="none" stroke="#5a4a1a" stroke-width="3"><circle cx="86" cy="104" r="8"/><circle cx="154" cy="104" r="8"/></g>`
    + `<ellipse cx="120" cy="104" rx="30" ry="26" fill="#b8a456" ${aStroke(3)}/>`
    + aEyes(108, 132, 100, { r: 5, color: '#e5484d' })
    + `<path d="M120 122 L120 136 L114 144 M120 136 L126 144" fill="none" stroke="#e5484d" stroke-width="3" stroke-linecap="round"/>`,

  gorilla: () => `<path d="M30 220 Q24 140 70 120 L170 120 Q216 140 210 220 Z" fill="#3e3e48" ${aStroke()}/>`
    + `<ellipse cx="44" cy="214" rx="20" ry="14" fill="#55555f" ${aStroke(3.5)}/><ellipse cx="196" cy="214" rx="20" ry="14" fill="#55555f" ${aStroke(3.5)}/>`
    + `<ellipse cx="120" cy="190" rx="44" ry="30" fill="#5a5a66"/>`
    + `<ellipse cx="120" cy="104" rx="52" ry="50" fill="#3e3e48" ${aStroke()}/>`
    + `<path d="M84 104 Q120 86 156 104 Q166 150 120 152 Q74 150 84 104 Z" fill="#7a7a86" ${aStroke(3)}/>`
    + `<path d="M84 98 Q120 84 156 98" fill="none" stroke="${AL}" stroke-width="7" stroke-linecap="round"/>`
    + aEyes(104, 136, 106, { r: 5, kind: 'dot' })
    + `<ellipse cx="114" cy="124" rx="4" ry="3" fill="${AL}"/><ellipse cx="126" cy="124" rx="4" ry="3" fill="${AL}"/>`
    + `<path d="M104 138 Q120 132 136 138" fill="none" stroke="${AL}" stroke-width="3" stroke-linecap="round"/>`,

  leopard: () => aMammal({
    fur: '#f2c45a', belly: '#fff3d6', head: [120, 126, 60, 52], body: [120, 198, 52, 32],
    back: `<path d="M164 208 Q218 214 214 170 Q212 154 198 158" fill="none" stroke="#f2c45a" stroke-width="12" stroke-linecap="round"/>`,
    ears: `<circle cx="74" cy="86" r="18" fill="#f2c45a" ${aStroke()}/><circle cx="166" cy="86" r="18" fill="#f2c45a" ${aStroke()}/>`,
    face: `<g fill="#6a4a2a" opacity="0.85"><circle cx="86" cy="104" r="5"/><circle cx="154" cy="104" r="5"/><circle cx="120" cy="88" r="5"/><circle cx="74" cy="134" r="4"/><circle cx="166" cy="134" r="4"/><circle cx="100" cy="86" r="4"/><circle cx="140" cy="86" r="4"/></g>`
      + aEyes(100, 140, 120, { r: 6, color: '#3d8f4a' }) + `<ellipse cx="120" cy="148" rx="24" ry="16" fill="#fff3d6"/>`
      + `<path d="M114 140 L126 140 L120 147 Z" fill="#c0505e"/><path d="M120 147 L120 152 M112 154 Q120 160 128 154" fill="none" stroke="${AL}" stroke-width="2.5" stroke-linecap="round"/>`,
  }),

  tiger: () => aMammal({
    fur: '#f28a2a', belly: '#fff3e0', head: [120, 124, 66, 58], body: [120, 198, 58, 34],
    back: `<path d="M170 206 Q222 210 216 166" fill="none" stroke="#f28a2a" stroke-width="14" stroke-linecap="round"/><path d="M170 206 Q222 210 216 166" fill="none" stroke="${AL}" stroke-width="14" stroke-linecap="round" stroke-dasharray="6 12"/>`,
    ears: `<circle cx="70" cy="80" r="20" fill="#f28a2a" ${aStroke()}/><circle cx="170" cy="80" r="20" fill="#f28a2a" ${aStroke()}/><circle cx="70" cy="82" r="9" fill="#fff3e0"/><circle cx="170" cy="82" r="9" fill="#fff3e0"/>`,
    face: `<g fill="${AL}"><path d="M120 68 L112 84 L120 96 L128 84 Z"/><path d="M58 112 L84 116 L60 124 Z M182 112 L156 116 L180 124 Z M60 140 L82 138 L64 148 Z M180 140 L158 138 L176 148 Z"/></g>`
      + `<path d="M74 136 Q120 190 166 136 Q146 150 120 150 Q94 150 74 136 Z" fill="#fff3e0"/>`
      + aEyes(98, 142, 118, { r: 6.5, color: '#3d8f4a' })
      + `<path d="M112 140 L128 140 L120 149 Z" fill="#c0505e" ${aStroke(2)}/><path d="M120 149 L120 155 M110 158 Q120 164 130 158" fill="none" stroke="${AL}" stroke-width="2.5" stroke-linecap="round"/>`
      + `<path d="M110 158 l3 8 l3 -7 M124 159 l3 7 l3 -8" fill="#fff" ${aStroke(1.5)}/>`,
  }),

  snowwolf: () => ANIMAL_ART.wolf('#d8e4f2', '#ffffff'),

  moose: () => `<path d="M76 92 Q34 92 22 52 Q38 62 44 52 Q50 66 58 56 Q62 72 70 62 Q74 78 86 80 Z" fill="#d9b98a" ${aStroke(3.5)}/>`
    + `<path d="M164 92 Q206 92 218 52 Q202 62 196 52 Q190 66 182 56 Q178 72 170 62 Q166 78 154 80 Z" fill="#d9b98a" ${aStroke(3.5)}/>`
    + aMammal({
      fur: '#7a5236', belly: '#a8805c', head: [120, 120, 48, 52], body: [120, 198, 60, 34],
      ears: `<ellipse cx="72" cy="104" rx="20" ry="9" fill="#7a5236" ${aStroke(3.5)} transform="rotate(-20 72 104)"/><ellipse cx="168" cy="104" rx="20" ry="9" fill="#7a5236" ${aStroke(3.5)} transform="rotate(20 168 104)"/>`,
      face: aEyes(102, 138, 108, { r: 5.5 }) + `<ellipse cx="120" cy="150" rx="30" ry="22" fill="#9a6e4c" ${aStroke(3)}/>`
        + `<ellipse cx="110" cy="148" rx="4" ry="6" fill="${AL}"/><ellipse cx="130" cy="148" rx="4" ry="6" fill="${AL}"/>`,
    }),

  polarbear: () => aMammal({
    fur: '#f4f6fa', belly: '#ffffff', head: [120, 120, 68, 60], body: [120, 198, 66, 36],
    ears: `<circle cx="66" cy="76" r="18" fill="#f4f6fa" ${aStroke()}/><circle cx="174" cy="76" r="18" fill="#f4f6fa" ${aStroke()}/><circle cx="66" cy="78" r="8" fill="#c8d4e4"/><circle cx="174" cy="78" r="8" fill="#c8d4e4"/>`,
    face: aEyes(96, 144, 114, { r: 6 }) + `<ellipse cx="120" cy="146" rx="28" ry="20" fill="#e8eef6" ${aStroke(3)}/>`
      + `<ellipse cx="120" cy="138" rx="10" ry="7" fill="${AL}"/><path d="M120 145 L120 152 M108 156 Q120 164 132 156" fill="none" stroke="${AL}" stroke-width="2.5" stroke-linecap="round"/>`
      + `<path d="M76 196 l6 -8 M86 200 l4 -9 M154 196 l-6 -8 M164 200 l-4 -9" stroke="#c8d4e4" stroke-width="3" stroke-linecap="round"/>`,
  }),

  elephant: () => `<path d="M66 82 Q10 80 14 140 Q22 176 70 160 Z" fill="#a8b0c4" ${aStroke()}/><path d="M174 82 Q230 80 226 140 Q218 176 170 160 Z" fill="#a8b0c4" ${aStroke()}/>`
    + `<path d="M58 96 Q30 100 32 136 Q40 152 64 148 Z M182 96 Q210 100 208 136 Q200 152 176 148 Z" fill="#f2b8c4"/>`
    + `<ellipse cx="120" cy="200" rx="62" ry="32" fill="#a8b0c4" ${aStroke()}/>`
    + `<g fill="#a8b0c4" ${aStroke(3.5)}><rect x="76" y="206" width="22" height="24" rx="8"/><rect x="142" y="206" width="22" height="24" rx="8"/></g>`
    + `<ellipse cx="120" cy="116" rx="56" ry="54" fill="#b8c0d2" ${aStroke()}/>`
    + `<path d="M108 138 Q104 190 128 206 Q140 210 138 198 Q124 188 132 140 Z" fill="#b8c0d2" ${aStroke()}/>`
    + `<path d="M94 150 Q86 168 72 170 M146 150 Q154 168 168 170" fill="none" stroke="#fffaf0" stroke-width="8" stroke-linecap="round"/><path d="M94 150 Q86 168 72 170 M146 150 Q154 168 168 170" fill="none" stroke="${AL}" stroke-width="2" stroke-linecap="round" opacity="0.6"/>`
    + aEyes(98, 142, 112, { r: 6 }),

  rhino: () => aMammal({
    fur: '#9aa0ac', belly: '#b8bdc8', head: [120, 132, 64, 50], body: [120, 200, 64, 32],
    ears: `<path d="M72 98 L66 70 L92 88 Z" fill="#9aa0ac" ${aStroke()}/><path d="M168 98 L174 70 L148 88 Z" fill="#9aa0ac" ${aStroke()}/>`,
    face: aEyes(96, 144, 120, { r: 5.5 })
      + `<ellipse cx="120" cy="160" rx="38" ry="22" fill="#acb2be" ${aStroke(3)}/>`
      + `<path d="M108 146 Q118 80 132 72 Q130 110 136 146 Z" fill="#fffaf0" ${aStroke(3)}/>`
      + `<ellipse cx="108" cy="164" rx="4" ry="5" fill="${AL}"/><ellipse cx="132" cy="164" rx="4" ry="5" fill="${AL}"/>`,
  }),

  lion: () => `<g fill="#b8642a" ${aStroke()}>${Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    const x = 120 + Math.cos(a) * 66, y = 118 + Math.sin(a) * 62;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="26"/>`;
  }).join('')}</g>`
    + `<circle cx="120" cy="118" r="70" fill="#b8642a"/>`
    + aMammal({
      fur: '#f2c060', belly: '#fff0cc', head: [120, 124, 56, 52], body: [120, 204, 56, 28],
      ears: `<circle cx="78" cy="82" r="14" fill="#f2c060" ${aStroke()}/><circle cx="162" cy="82" r="14" fill="#f2c060" ${aStroke()}/>`,
      face: aEyes(100, 140, 118, { r: 6.5, color: '#8a4a10' }) + `<ellipse cx="120" cy="148" rx="24" ry="16" fill="#fff0cc"/>`
        + `<path d="M111 138 L129 138 L120 148 Z" fill="#8a4a2a" ${aStroke(2)}/><path d="M120 148 L120 154 M110 157 Q120 164 130 157" fill="none" stroke="${AL}" stroke-width="2.5" stroke-linecap="round"/>`,
      front: `<path d="M88 74 L94 44 L106 62 L120 36 L134 62 L146 44 L152 74 Z" fill="#ffd54a" stroke="#a86f00" stroke-width="3" stroke-linejoin="round"/>`
        + `<rect x="86" y="70" width="68" height="10" rx="4" fill="#f5b800" stroke="#a86f00" stroke-width="3"/>`
        + `<circle cx="120" cy="40" r="5" fill="#e5484d" stroke="#a86f00" stroke-width="2"/><circle cx="94" cy="46" r="4" fill="#4fc3f7" stroke="#a86f00" stroke-width="1.5"/><circle cx="146" cy="46" r="4" fill="#4fc3f7" stroke="#a86f00" stroke-width="1.5"/>`,
    }),
};

function buildAnimalSVG(key) {
  const art = ANIMAL_ART[key];
  return `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${art ? art() : ''}</svg>`;
}
