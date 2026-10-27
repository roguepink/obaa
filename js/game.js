'use strict';
/* 最強おばあ: ゲームの動き
   縦にずっと進む「奥行きのある道」を、おばあの後ろ・少し上から見る(視点は1つだけ)。
   世界の座標: wx = 道の左右(-1〜1)、z = おばあからの奥行き(0 がおばあの足もと)、h = 地面からの高さ */
var CONFIG = {
  W: 360, DT: 1 / 60, D: 140, ZFAR: 1000, ROADW: 165, SPEED: 255,
  RUN_TIME: 24,      // ボスが出るまでの秒数
  GRAV: 1900, JUMP: 700, JUMP2: 620,
  ATK_REACH: 100, ATK_WIDE: 0.52, GAUGE_MAX: 100
};
var DIFFS = {
  easy: { n: 'かんたん', spd: 0.82, haz: 0.6, boss: 0.65, atk: 0.62, lives: 3, foe: 0.9, col: '#7fe07f' },
  normal: { n: 'ふつう', spd: 1, haz: 1, boss: 1, atk: 1, lives: 1, foe: 1, col: '#ffe066' },
  hard: { n: 'むずかしい', spd: 1.16, haz: 1.35, boss: 1.45, atk: 1.45, lives: 1, foe: 1.2, col: '#ff6a6a' }
};
var FONT = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Meiryo","Noto Sans JP",system-ui,sans-serif';
var EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Segoe UI Symbol",sans-serif';
var HIT_WORDS = ['バシッ!', 'ドカッ!', 'ペチーン!', 'ズバッ!', 'ポコッ!', 'ガツン!', 'ボコッ!', 'スパーン!'];
var BOSS_SHOUT = { throw: 'くらえ!', spread: 'それそれ!', row: 'とおさん!', roll: 'ゴロゴロ〜!', rain: 'ふりそそげ!', summon: '手下ども、来い!' };

var cv = document.getElementById('game'), ctx = cv.getContext('2d');
var H = 640, HY = 170, BY = 470, SC = 1, OX = 0;
var G = { state: 'title', paused: false, auto: false, diff: 'normal' };
function store(k, v) { try { if (v === undefined) return localStorage.getItem('obaa-' + k); localStorage.setItem('obaa-' + k, String(v)); } catch (e) {} return null; }
G.diff = store('diff') || 'normal'; if (!DIFFS[G.diff]) G.diff = 'normal';

function resize() {
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  SC = Math.min(cv.width / CONFIG.W, cv.height / 640);
  H = cv.height / SC; OX = (cv.width / SC - CONFIG.W) / 2;
  HY = Math.round(Math.max(140, H * 0.25)); BY = Math.round(H - 175);
  ctx.setTransform(SC, 0, 0, SC, OX * SC, 0);
}
addEventListener('resize', resize); resize();
// スマホが画面を作り直したとき(記憶が足りない・アプリを切りかえた等)に、拡大と絵文字を元にもどす
cv.addEventListener('contextlost', function (ev) { ev.preventDefault(); });
cv.addEventListener('contextrestored', function () { resize(); atlasReset(); });
document.addEventListener('visibilitychange', function () { if (!document.hidden) { resize(); atlasReset(); } });
addEventListener('pageshow', function () { resize(); atlasReset(); });

/* ===== 小さな道具 ===== */
function rnd(a, b) { return a + Math.random() * (b - a); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function proj(wx, z) {
  var s = CONFIG.D / (CONFIG.D + Math.max(z, -CONFIG.D * 0.7));
  return { x: 180 + wx * CONFIG.ROADW * s, y: HY + (BY - HY) * s, s: s };
}
/* 絵文字は 1枚の大きな画用紙(アトラス)に まとめて描いておき、そこから切り取って使う。
   小さな画用紙を何百枚も作ると、スマホの記憶が足りなくなって 画面が白紙にされる(顔が消える・止まる)ことがあるため。
   白紙にされたと分かったら(contextlost / 見えなくなって戻ったとき / 一定時間ごと)、まっさらにして描き直す。 */
var ATL = { cell: 112, n: 16, c: null, x: null, map: {}, next: 0, born: 0 };
function atlasReset() {
  if (!ATL.c) {
    ATL.c = document.createElement('canvas'); ATL.c.width = ATL.c.height = ATL.cell * ATL.n;
    ATL.c.addEventListener('contextrestored', atlasReset);
  }
  ATL.x = ATL.c.getContext('2d'); ATL.x.clearRect(0, 0, ATL.c.width, ATL.c.height);
  ATL.x.font = '92px ' + EMOJI_FONT; ATL.x.textAlign = 'center'; ATL.x.textBaseline = 'middle';
  ATL.map = {}; ATL.next = 0; ATL.born = performance.now();
}
function atlasCell(ch) {
  var i = ATL.map[ch];
  if (i == null) {
    if (ATL.next >= ATL.n * ATL.n) atlasReset();      // いっぱいになったら まっさらにして 使う分だけ描き直す
    i = ATL.next++; ATL.map[ch] = i;
    ATL.x.fillText(ch, (i % ATL.n) * ATL.cell + ATL.cell / 2, Math.floor(i / ATL.n) * ATL.cell + ATL.cell / 2 + 5);
  }
  return i;
}
atlasReset();
function emo(ch, x, y, size, rot, alpha) {
  if (!ch || size < 1) return;
  var i = atlasCell(ch), c = ATL.cell;
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (alpha != null) ctx.globalAlpha = Math.max(0, alpha);
  ctx.drawImage(ATL.c, (i % ATL.n) * c, Math.floor(i / ATL.n) * c, c, c, -size * 0.625, -size * 0.625, size * 1.25, size * 1.25); ctx.restore();
}
function txt(s, x, y, size, col, stroke, align, maxW) {
  ctx.font = '900 ' + size + 'px ' + FONT; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = stroke || '#1b1430';
  maxW = maxW || 340; ctx.strokeText(s, x, y, maxW); ctx.fillStyle = col || '#fff'; ctx.fillText(s, x, y, maxW);
}
function shadow(x, y, rx, ry, a) {
  ctx.fillStyle = 'rgba(0,0,0,' + (a || 0.28) + ')'; ctx.beginPath(); ctx.ellipse(x, y, Math.max(1, rx), Math.max(1, ry), 0, 0, 6.283); ctx.fill();
}
function rrect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function bubble(s, x, y, size) {
  ctx.font = '800 ' + size + 'px ' + FONT;
  var w = ctx.measureText(s).width + size * 0.9, h = size * 1.6;
  x = clamp(x, w / 2 + 2, 358 - w / 2);
  ctx.fillStyle = 'rgba(255,255,255,.93)'; rrect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 4, y + h / 2 - 1); ctx.lineTo(x + 4, y + h / 2 - 1); ctx.lineTo(x, y + h / 2 + 6); ctx.fill();
  ctx.fillStyle = '#222'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y + 1);
}

/* ===== 音(外のファイルは使わず その場で作る) ===== */
var AU = { c: null, m: null, muted: store('mute') === '1', nextT: 0, step: 0, nb: null };
function auInit() {
  if (AU.c) { if (AU.c.state === 'suspended') AU.c.resume(); return; }
  try {
    var C = window.AudioContext || window.webkitAudioContext; AU.c = new C();
    AU.m = AU.c.createGain(); AU.m.gain.value = AU.muted ? 0 : 0.55; AU.m.connect(AU.c.destination);
    var len = AU.c.sampleRate * 0.5, b = AU.c.createBuffer(1, len, AU.c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    AU.nb = b; AU.nextT = AU.c.currentTime + 0.1;
    setInterval(bgmTick, 60);
  } catch (e) { AU.c = null; }
}
function tone(f, t, dur, type, vol, f2) {
  var o = AU.c.createOscillator(), g = AU.c.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol || 0.1, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(AU.m); o.start(t); o.stop(t + dur + 0.03);
}
function noise(t, dur, vol, freq) {
  var s = AU.c.createBufferSource(), f = AU.c.createBiquadFilter(), g = AU.c.createGain();
  s.buffer = AU.nb; f.type = 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = 0.8;
  g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(f); f.connect(g); g.connect(AU.m); s.start(t); s.stop(t + dur + 0.03);
}
var sfxLast = {};
function sfx(n) {
  if (!AU.c || AU.muted) return;
  var t = AU.c.currentTime;
  if (sfxLast[n] && t - sfxLast[n] < 0.045) return;     // 同じ音を重ねすぎない
  sfxLast[n] = t;
  try {
    if (n === 'hit') { noise(t, 0.12, 0.45, 1800); tone(rnd(500, 700), t, 0.12, 'square', 0.11, 120); }
    else if (n === 'bonk') { noise(t, 0.08, 0.3, 900); tone(300, t, 0.08, 'triangle', 0.12, 150); }
    else if (n === 'swing') noise(t, 0.12, 0.12, 3000);
    else if (n === 'shot') tone(rnd(700, 900), t, 0.06, 'triangle', 0.05, 1400);
    else if (n === 'jump') tone(330, t, 0.18, 'square', 0.08, 880);
    else if (n === 'jump2') tone(500, t, 0.2, 'square', 0.08, 1300);
    else if (n === 'boss') { noise(t, 0.15, 0.4, 600); tone(160, t, 0.18, 'sawtooth', 0.12, 60); }
    else if (n === 'boom') { noise(t, 0.4, 0.6, 300); tone(110, t, 0.4, 'sawtooth', 0.15, 30); }
    else if (n === 'kira') { tone(1568, t, 0.12, 'sine', 0.06); tone(2093, t + 0.06, 0.18, 'sine', 0.05); }
    else if (n === 'pick') { [880, 1175, 1568].forEach(function (f, i) { tone(f, t + i * 0.05, 0.12, 'square', 0.06); }); }
    else if (n === 'sp') {
      [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, t + i * 0.06, 0.4, 'square', 0.07); });
      noise(t + 0.75, 0.9, 0.7, 400); tone(90, t + 0.75, 0.9, 'sawtooth', 0.25, 30);
    }
    else if (n === 'trip') { tone(600, t, 0.5, 'square', 0.12, 80); noise(t + 0.35, 0.3, 0.5, 300); }
    else if (n === 'oops') { tone(500, t, 0.15, 'square', 0.1, 300); tone(400, t + 0.15, 0.2, 'square', 0.1, 600); }
    else if (n === 'clear') { [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { tone(f, t + i * 0.1, 0.25, 'square', 0.08); }); }
    else if (n === 'warn') { for (var i = 0; i < 4; i++) tone(i % 2 ? 440 : 330, t + i * 0.18, 0.16, 'sawtooth', 0.08); }
  } catch (e) {}
}
function bgmTick() {
  if (!AU.c || AU.muted) return;
  var now = AU.c.currentTime;
  if (AU.nextT < now) AU.nextT = now + 0.05;
  if (G.state !== 'play' || G.paused || !G.ST) return;
  var boss = G.phase === 'boss';
  var stp = boss ? 0.105 : (G.ST.area.night ? 0.13 : 0.125);
  var key = [0, 2, 5, 7, 3, 9, 5, 0, 8, 11, 4, 6, 1, 10][G.ST.key % 14];
  var prog = boss ? [0, -4, -2, -5] : (G.ST.i % 2 ? [0, 5, -3, 7] : [0, -3, 5, 7]);
  var scale = boss || G.ST.area.night ? [0, 3, 5, 7, 10, 12] : [0, 2, 4, 7, 9, 12];
  var mels = [[0, 2, 4, 5, 4, 2, 3, 1, 0, 2, 4, 5, 5, 4, 3, 2], [0, 0, 2, 4, 2, 4, 5, 4, 3, 3, 2, 1, 2, 3, 4, 5], [5, 4, 3, 2, 3, 4, 5, 5, 4, 2, 0, 2, 4, 5, 4, 2]];
  var mel = mels[G.ST.i % 3];
  while (AU.nextT < now + 0.2) {
    var s = AU.step % 16, bar = Math.floor(AU.step / 16) % 4, root = 110 * Math.pow(2, (key + prog[bar]) / 12), t = AU.nextT;
    try {
      if (s % 2 === 0) tone(root * (s % 4 === 0 ? 1 : 2), t, stp * 1.6, 'triangle', 0.09);
      if (s % 4 === 0) tone(120, t, 0.12, 'sine', 0.22, 40);
      if (s % 8 === 4) noise(t, 0.08, 0.12, 2500);
      if (s % 2 === 1) noise(t, 0.03, 0.04, 7000);
      if ((s + bar) % 3 !== 2) tone(root * 4 * Math.pow(2, scale[(mel[s] + bar) % scale.length] / 12), t, stp * 0.9, 'square', 0.025);
    } catch (e) {}
    AU.nextT += stp; AU.step++;
  }
}
function setMute(m) {
  AU.muted = m; store('mute', m ? '1' : '0');
  if (AU.m) AU.m.gain.value = m ? 0 : 0.55;
  document.getElementById('bMute').textContent = m ? '🔇' : '🔊';
}

/* ===== はじまり・おわり ===== */
function hashOpt(k) { var m = location.hash.match(new RegExp('[#&]' + k + '(?:=(\\d+))?(?:&|$)')); return m ? (m[1] != null ? +m[1] : true) : null; }
function D() { return DIFFS[G.diff]; }
function reach() { return +store('reach-' + G.diff) || 1; }
function lv() { return G.si + G.loop * 100; }
function ramp() { return Math.min(lv(), 99) / 99; }
function has(g) { return G.ST.gims.indexOf(g) >= 0; }

function reset(si) {
  G.score = 0; G.t = 0; G.loop = 0; G.si = si;
  G.px = 0; G.pvx = 0; G.jh = 0; G.vy = 0; G.dbl = false; G.flipT = 0; G.atkT = 0; G.atkCd = 0; G.fireCd = 0; G.fire = false;
  G.combo = 0; G.comboT = 0; G.maxCombo = 0; G.gauge = 0; G.killed = 0; G.lives = D().lives; G.stumble = 0;
  G.objs = []; G.shots = []; G.fly = []; G.fx = []; G.wxp = []; G.skyo = []; G.boss = null; G.sp = null; G.lastSp = -1; G.inv = 0;
  G.hitstop = 0; G.shake = 0; G.flash = 0; G.banner = null; G.say = null; G.scoldT = 0; G.trip = null; G.wind = 0;
  if (hashOpt('full')) G.gauge = CONFIG.GAUGE_MAX;
  enterStage(si, true);
  if (hashOpt('boss')) G.phaseT = CONFIG.RUN_TIME - 0.3;
}
function enterStage(si, first) {
  G.si = si; G.ST = makeStage(si);
  G.phase = 'run'; G.phaseT = 0; G.stageT = 0;
  G.wpn = G.ST.weapon; var w = hashOpt('w'); if (w) G.wpn = clamp(w - 1, 0, 9);
  G.foeT = 1.2; G.hazT = first ? 3.5 : 2.0; G.decoD = 0; G.gimT = { rain: 3, roll: 5, row: 6, dango: 2 };
  G.city = makeCity();
  G.objs = G.objs.filter(function (o) { return o.k !== 'deco'; });
  for (var z = 60; z < CONFIG.ZFAR; z += 70) placeDeco(z + rnd(0, 30));
  var no = lv() + 1;
  if (!G.auto && no > reach() && no <= STAGE_COUNT) store('reach-' + G.diff, no);
  var hint = G.ST.gims.map(function (g) { return GIMMICKS[g]; }).filter(Boolean)[0];
  var W = WEAPONS[G.wpn];
  G.banner = { t: 0, dur: 3.2, big: 'STAGE ' + no + (G.loop ? '' : ' / 100'), small: G.ST.title,
    third: '投げる物: ' + W.e + ' ' + W.n + '(' + W.how + ')' + (hint ? '　⚠ ' + hint : ''), col: G.ST.boss.final ? '#ff5a5a' : '#ffe066' };
  updWeaponBtn();
}
function start(ev, si) {
  auInit();
  reset(si || 0); G.state = 'play'; G.paused = false;
  ['title', 'over', 'pause'].forEach(function (id) { document.getElementById(id).classList.add('hidden'); });
  document.getElementById('pad').classList.remove('hidden'); document.getElementById('tools').classList.remove('hidden');
  if (ev && ev.isTrusted) try {
    var el = document.documentElement, fs = el.requestFullscreen || el.webkitRequestFullscreen;
    var pr = fs && fs.call(el);
    if (pr && pr.catch) pr.catch(function () {});
  } catch (e) {}
}
function finish() {
  G.state = 'over';
  var no = lv() + 1, bk = 'best-' + G.diff, best = +store(bk) || 0;
  if (G.score > best && !G.auto) { best = G.score; store(bk, best); }
  document.getElementById('overWhy').textContent = (G.trip ? G.trip.n : '小石') + 'につまずいた…';
  document.getElementById('overStage').textContent = 'STAGE ' + no + '  ' + G.ST.title;
  document.getElementById('overScore').textContent = 'スコア ' + G.score + ' / こらしめた数 ' + G.killed + ' / 最大 ' + G.maxCombo + ' れんぞく';
  document.getElementById('overBest').textContent = DIFFS[G.diff].n + 'モードのベスト ' + best;
  document.getElementById('btnAgain').textContent = 'STAGE ' + no + ' からやり直す';
  document.getElementById('over').classList.remove('hidden');
  document.getElementById('pad').classList.add('hidden'); document.getElementById('tools').classList.add('hidden');
}
function setPause(p) {
  if (G.state !== 'play') return;
  G.paused = p; G.fire = false; document.getElementById('pause').classList.toggle('hidden', !p);
}
function updTitle() {
  var r = reach();
  document.querySelectorAll('#diffs button').forEach(function (b) { b.classList.toggle('sel', b.dataset.d === G.diff); });
  var c = document.getElementById('btnCont');
  c.textContent = '▶ つづきから(STAGE ' + r + ')'; c.classList.toggle('hidden', r <= 1);
  var best = +store('best-' + G.diff) || 0;
  document.getElementById('titleBest').textContent = DIFFS[G.diff].n + 'モード: ' + (r > 1 ? 'STAGE ' + r + ' まで到達' : 'まだ遊んでいない') + (best ? ' / ベスト ' + best : '');
}

/* ===== 入力: 左右になぞる・ジャンプ・杖(押しっぱなしで投げる)・必殺 ===== */
var drag = {};
function lx(ev) { var r = cv.getBoundingClientRect(); return (ev.clientX - r.left) / (r.width / (cv.width / SC)) - OX; }
cv.addEventListener('pointerdown', function (ev) { drag[ev.pointerId] = lx(ev); try { cv.setPointerCapture(ev.pointerId); } catch (e) {} });
cv.addEventListener('pointermove', function (ev) {
  if (drag[ev.pointerId] == null || G.state !== 'play' || G.paused) return;
  var x = lx(ev), d = (x - drag[ev.pointerId]) / CONFIG.ROADW * 1.35; drag[ev.pointerId] = x;
  if (has('ice')) G.pvx = clamp(G.pvx + d * 9, -2.4, 2.4); else G.px = clamp(G.px + d, -0.88, 0.88);
});
['pointerup', 'pointercancel'].forEach(function (n) { cv.addEventListener(n, function (ev) { delete drag[ev.pointerId]; }); });
function bindBtn(id, down, up) {
  var b = document.getElementById(id);
  b.addEventListener('pointerdown', function (ev) { ev.preventDefault(); b.classList.add('on'); down(); try { b.setPointerCapture(ev.pointerId); } catch (e) {} });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { b.addEventListener(n, function () { b.classList.remove('on'); if (up) up(); }); });
  b.addEventListener('click', function () { b.blur(); });
  b.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
}
bindBtn('bJump', function () { doJump(); });
bindBtn('bAtk', function () { G.fire = true; doAttack(); }, function () { G.fire = false; });
bindBtn('bSp', function () { doSpecial(); });
var keys = {};
addEventListener('keydown', function (ev) {
  if (keys[ev.key]) { if (ev.key === ' ') ev.preventDefault(); return; }
  keys[ev.key] = true;
  if (G.state !== 'play') return;
  if (ev.key === ' ' || ev.key === 'ArrowUp' || ev.key === 'w') { doJump(); ev.preventDefault(); }
  if (ev.key === 'z' || ev.key === 'x' || ev.key === 'j') { G.fire = true; doAttack(); }
  if (ev.key === 'c' || ev.key === 'k') doSpecial();
  if (ev.key === 'p' || ev.key === 'Escape') setPause(!G.paused);
});
addEventListener('keyup', function (ev) { keys[ev.key] = false; if (ev.key === 'z' || ev.key === 'x' || ev.key === 'j') G.fire = false; });
document.querySelectorAll('#diffs button').forEach(function (b) {
  b.addEventListener('click', function () { b.blur(); G.diff = b.dataset.d; store('diff', G.diff); updTitle(); });
});
document.getElementById('btnPlay').addEventListener('click', function (ev) { this.blur(); start(ev, 0); });
document.getElementById('btnCont').addEventListener('click', function (ev) { this.blur(); start(ev, reach() - 1); });
document.getElementById('btnAgain').addEventListener('click', function (ev) { this.blur(); start(ev, G.si); });
document.getElementById('btnTitle').addEventListener('click', function () { this.blur(); G.state = 'title'; updTitle(); document.getElementById('over').classList.add('hidden'); document.getElementById('title').classList.remove('hidden'); });
document.getElementById('btnResume').addEventListener('click', function () { this.blur(); setPause(false); auInit(); });
document.getElementById('bPause').addEventListener('click', function () { this.blur(); setPause(true); });
document.getElementById('bMute').addEventListener('click', function () { this.blur(); auInit(); setMute(!AU.muted); });
setMute(AU.muted); updTitle();
document.addEventListener('visibilitychange', function () { if (document.hidden) setPause(true); });

function doJump() {
  if (G.state !== 'play' || G.paused) return;
  if (G.jh <= 0.5) { G.vy = CONFIG.JUMP; G.jh = 1; G.dbl = false; sfx('jump'); }
  else if (!G.dbl) { G.vy = CONFIG.JUMP2; G.dbl = true; G.flipT = 0.45; sfx('jump2'); }   // 二段ジャンプ(くるっと回る)
}
function doAttack() {
  if (G.state !== 'play' || G.paused) return;
  fire();
  if (G.atkCd > 0) return;
  var air = G.jh > 20, reach = air ? 135 : CONFIG.ATK_REACH, wide = air ? CONFIG.ATK_WIDE * 1.45 : CONFIG.ATK_WIDE;
  G.atkT = 0.24; G.atkCd = 0.18; G.atkAir = air; sfx('swing');
  var hit = 0;
  G.objs.forEach(function (o) {
    if (o.k === 'foe' && !o.dead && o.z > -25 && o.z < reach && Math.abs(o.wx - G.px) < wide) { knock(o, 'cane'); hit++; }
  });
  var b = G.boss;
  if (b && !b.dying && b.in && b.z < 170 && Math.abs(b.wx - G.px) < 0.7) { hitBoss(5, 'cane'); hit++; }
  if (hit) { G.hitstop = Math.min(0.09, 0.035 + hit * 0.012); if (Math.random() < 0.45) scold(); }
}
/* 物を投げる(押しっぱなしで連続) */
function fire() {
  if (G.fireCd > 0) return;
  var w = WEAPONS[G.wpn]; G.fireCd = w.rate;
  var h = 55 + G.jh * 0.6;
  function S(vwx, o) {
    var s = { wx: G.px, z: 12, h: h, vwx: vwx || 0, vz: 1000, dmg: w.dmg, e: w.e, kind: w.kind, rot: 0, sz: 22, hit: [], life: 1.6 };
    for (var k in o) s[k] = o[k];
    G.shots.push(s);
  }
  switch (w.kind) {
    case 'straight': S(0); break;
    case 'pierce': S(0, { vz: 1250, pierce: true }); break;
    case 'tri': S(-0.55); S(0); S(0.55); break;
    case 'homing': S(rnd(-0.3, 0.3), { vz: 820, home: true }); break;
    case 'big': S(0, { vz: 760, sz: 40, pierce: true, big: true }); break;
    case 'rapid': S(rnd(-0.06, 0.06), { vz: 1150, sz: 18 }); break;
    case 'bomb': S(0, { vz: 720, sz: 36, bomb: true }); break;
    case 'boomerang': S(0, { vz: 1350, boom: true, pierce: true, life: 2.2 }); break;
    case 'five': for (var i = -2; i <= 2; i++) S(i * 0.4, { sz: 18 }); break;
    case 'twin': S(0, { wx: G.px - 0.07, pierce: true }); S(0, { wx: G.px + 0.07, pierce: true }); break;
  }
  sfx('shot');
}
function doSpecial() {
  if (G.state !== 'play' || G.paused || G.sp || G.gauge < CONFIG.GAUGE_MAX) return;
  G.gauge = 0;
  var id; do { id = Math.floor(Math.random() * SPECIALS.length); } while (id === G.lastSp);
  var spo = hashOpt('sp'); if (spo) id = clamp(spo - 1, 0, 9);
  G.lastSp = id;
  var pts = [];
  for (var i = 0; i < 16; i++) { var p = proj(rnd(-0.9, 0.9), rnd(20, 650)); pts.push({ x: p.x, y: p.y, d: rnd(0, 0.3) }); }
  G.sp = { id: id, t: 0, dur: 2.4, struck: false, pts: pts };
  sfx('sp'); G.shake = 6;
}
function updWeaponBtn() {
  var w = WEAPONS[G.wpn];
  document.getElementById('bAtk').innerHTML = '<span class="we">' + w.e + '</span>杖<small>' + w.n + '</small>';
}

/* ===== 出てくるもの ===== */
function makeCity() {
  var a = [], x = -20;
  while (x < 380) { var w = rnd(14, 34); a.push({ x: x, w: w, h: rnd(14, 60) }); x += w + rnd(0, 6); }
  return a;
}
function speed() {
  return CONFIG.SPEED * D().spd * (1 + 0.42 * ramp() + G.loop * 0.15) * (G.sp ? 0.35 : 1) * (G.phase === 'clear' ? 0.6 : 1);
}
function spawnFoe(wx, z, f) {
  f = f || pick(G.ST.foes);
  G.objs.push({ k: 'foe', wx: wx, z: z || CONFIG.ZFAR, f: f, ph: rnd(0, 6), say: Math.random() < 0.4, walk: f.m === 'fast' ? rnd(120, 180) : rnd(20, 70),
    sway: rnd(-0.15, 0.15), dropT: rnd(0.8, 2.2), h: f.m === 'fly' ? 55 : 0 });
}
function spawnHaz(wx, z, o) {
  var hz = { k: 'haz', wx: clamp(wx, -0.88, 0.88), z: z || CONFIG.ZFAR, h: pick(G.ST.theme.haz), rot: rnd(-0.5, 0.5), hop: 0, fall: 0, vwx: 0 };
  for (var k in o) hz[k] = o[k];
  if (hz.big) hz.h = pick([{ e: '🛢️', n: 'ころがるドラム缶' }, { e: '🛞', n: 'ころがるタイヤ' }, { e: '🪨', n: 'ころがる大岩' }]);
  G.objs.push(hz); return hz;
}
function placeDeco(z) {
  var A = G.ST.area;
  [-1, 1].forEach(function (side) {
    G.objs.push({ k: 'deco', wx: side * rnd(1.5, 2.0), z: z, e: pick(A.deco), sz: rnd(70, 95) });
    if (Math.random() < 0.5) G.objs.push({ k: 'deco', wx: side * rnd(1.24, 1.38), z: z + rnd(0, 35), e: pick(A.small), sz: rnd(20, 28) });
  });
}
function hazRow(z, extra) {                // すき間のある 障害物の列
  var gap = Math.floor(Math.random() * 6), wide = G.diff === 'easy';
  for (var k = 0; k < 6; k++) if (k !== gap && !(wide && k === gap + 1)) spawnHaz(-0.85 + k * 0.34, z, extra);
}
function startBoss() {
  var B = G.ST.boss, L = lv();
  G.phase = 'boss'; G.phaseT = 0;
  var max = Math.round((26 + L * 1.35) * D().boss * (B.final ? 2.2 : 1) * (1 + G.loop * 0.3));
  G.boss = { B: B, d: B.d, wx: 0, z: CONFIG.ZFAR + 100, h: 0, hp: max, max: max, t: 0, atkT: 2.4, flashT: 0, in: false, dying: false,
    dashT: 0, dashCd: rnd(5, 8), shout: null };
  G.banner = { t: 0, dur: 2.4, big: B.final ? '最後の敵!' : 'ボス あらわる!', small: B.name, third: '杖ボタンを押しっぱなしで、物を投げて当てろ!', col: '#ff5a5a' };
  sfx('warn');
}

/* ===== こらしめる ===== */
function addScore(n) { G.score += Math.round(n); }
function knock(o, by) {
  if (o.dead) return;
  o.dead = true;
  var p = proj(o.wx, o.z), y = p.y - o.h * p.s;
  G.combo++; G.comboT = 2.2; if (G.combo > G.maxCombo) G.maxCombo = G.combo; G.killed++;
  addScore((by === 'cane' ? 120 : by === 'body' ? 50 : 80) * (1 + Math.floor(G.combo / 5) * 0.5) * (1 + G.loop));
  if (!G.sp) G.gauge = Math.min(CONFIG.GAUGE_MAX, G.gauge + (by === 'cane' ? 7 : by === 'body' ? 3 : 4));
  var dir = (o.wx - G.px) || rnd(-0.3, 0.3);
  G.fly.push({ x: p.x, y: y - 30 * p.s, vx: dir * 900 + rnd(-120, 120), vy: -rnd(900, 1300), r: 0, vr: rnd(-18, 18), sz: 60 * p.s + 10, f: o.f });
  G.fx.push({ k: 'word', x: p.x, y: y - 60 * p.s, s: pick(HIT_WORDS), t: 0, dur: 0.6, col: by === 'cane' ? '#fff36b' : '#ffffff', sz: by === 'cane' ? 26 : 16 + 10 * p.s });
  for (var i = 0; i < (by === 'cane' ? 10 : 5); i++) G.fx.push({ k: 'spark', x: p.x, y: y - 30 * p.s, vx: rnd(-320, 320), vy: rnd(-380, 120), t: 0, dur: rnd(0.3, 0.55), col: pick(['#fff', '#ffe066', '#ff8a3d']), r: rnd(2, 5) });
  if (by === 'cane') G.fx.push({ k: 'ring', x: p.x, y: y - 30 * p.s, t: 0, dur: 0.3, r: 50 * p.s + 10 });
  G.shake = Math.max(G.shake, by === 'cane' ? 6 : 2);
  sfx(by === 'body' ? 'bonk' : 'hit');
  // ときどき おみやげを落とす
  var r = Math.random();
  if (r < 0.06) G.objs.push({ k: 'item', t: 'gift', wx: o.wx, z: Math.max(o.z, 120), e: '🎁' });
  else if (r < 0.08 && G.lives < D().lives) G.objs.push({ k: 'item', t: 'life', wx: o.wx, z: Math.max(o.z, 120), e: '🧿' });
}
function hitBoss(n, by) {
  var b = G.boss; if (!b || b.dying) return;
  b.hp -= n; b.flashT = 0.1;
  if (by !== 'shot') b.z = Math.min(b.z + 40, 460);
  var p = proj(b.wx, b.z);
  addScore((by === 'shot' ? 30 : 80) * n * (1 + G.loop)); if (!G.sp) G.gauge = Math.min(CONFIG.GAUGE_MAX, G.gauge + (by === 'shot' ? 1.4 : 5));
  G.combo++; G.comboT = 2.2; if (G.combo > G.maxCombo) G.maxCombo = G.combo;
  if (by !== 'shot' || Math.random() < 0.35) G.fx.push({ k: 'word', x: p.x + rnd(-40, 40), y: p.y - 120 * p.s + rnd(-20, 20), s: n > 8 ? 'ドッカーン!' : pick(HIT_WORDS), t: 0, dur: 0.5, col: '#ff9a9a', sz: by === 'shot' ? 18 : 26 });
  for (var i = 0; i < (by === 'shot' ? 4 : 14); i++) G.fx.push({ k: 'spark', x: p.x + rnd(-20, 20), y: p.y - 80 * p.s * b.B.scale, vx: rnd(-400, 400), vy: rnd(-450, 150), t: 0, dur: rnd(0.25, 0.5), col: pick(['#fff', '#ffe066', '#ff5a5a']), r: rnd(2, 5) });
  G.shake = Math.max(G.shake, by === 'shot' ? 2 : 9); sfx(by === 'shot' ? 'bonk' : 'boss');
  if (b.hp <= 0) bossDie();
}
function bossDie() {
  var b = G.boss, p = proj(b.wx, b.z), L = lv();
  b.dying = true; b.hp = 0;
  var bonus = Math.round(2000 * (L + 1) * (G.diff === 'hard' ? 1.5 : G.diff === 'easy' ? 0.7 : 1));
  addScore(bonus);
  G.fly.push({ x: p.x, y: p.y - 80 * p.s, vx: rnd(-200, 200), vy: -1400, r: 0, vr: 14, sz: 150 * p.s * b.B.scale + 30, f: b.d, boss: true });
  for (var i = 0; i < 40; i++) G.fx.push({ k: 'spark', x: p.x, y: p.y - 80 * p.s, vx: rnd(-700, 700), vy: rnd(-700, 400), t: 0, dur: rnd(0.5, 1.1), col: pick(['#fff', '#ffe066', '#ff5a5a', '#7fe0ff']), r: rnd(3, 8) });
  G.fx.push({ k: 'emo', e: '💥', x: p.x, y: p.y - 80 * p.s, t: 0, dur: 0.7, sz: 180 });
  for (var j = 0; j < 30; j++) G.fx.push({ k: 'conf', x: rnd(0, 360), y: rnd(-200, 0), vx: rnd(-40, 40), vy: rnd(120, 260), t: 0, dur: 2.6, col: pick(['#ff5a5a', '#ffe066', '#7fe0ff', '#7fe07f', '#ff7ad0']), rot: rnd(0, 6) });
  G.flash = 1; G.shake = 22; G.hitstop = 0.25;
  G.phase = 'clear'; G.phaseT = 0; G.boss = null;
  G.banner = { t: 0, dur: 2.6, big: '成敗!', small: b.B.name + ' を こらしめた!', third: 'ボーナス +' + bonus, col: '#ffe066' };
  G.objs.forEach(function (o) { if (o.k === 'haz') o.gone = true; });
  G.say = { s: pick(['これにて一件落着!', 'おととい来な!', 'まだまだ若いもんには負けないよ!', '反省しな!']), t: 0 };
  sfx('clear');
}
function nextStage() {
  var n = G.si + 1;
  if (n >= STAGE_COUNT) {
    G.loop++; n = 0;
    G.flash = 1;
    for (var j = 0; j < 60; j++) G.fx.push({ k: 'conf', x: rnd(0, 360), y: rnd(-400, 0), vx: rnd(-40, 40), vy: rnd(120, 260), t: 0, dur: 4, col: pick(['#ff5a5a', '#ffe066', '#7fe0ff', '#7fe07f']), rot: rnd(0, 6) });
    enterStage(n);
    G.banner = { t: 0, dur: 4.5, big: '100ステージ制覇!', small: '世界は平和になった…と思ったら', third: (G.loop + 1) + '周目へ!もっと速くなるよ', col: '#7fe0ff' };
    return;
  }
  enterStage(n);
  G.flash = 0.8;
}
function scold() {
  if (G.scoldT > 0) return;
  G.say = { s: pick(G.ST.theme.scold), t: 0 }; G.scoldT = 1.4;
}
function trip(o) {
  if (G.lives > 1) {                 // かんたん: まだ だいじょうぶ
    G.lives--; G.inv = 2.2; G.stumble = 0.6; o.gone = true;
    G.say = { s: 'おっとっと!あと' + G.lives + '回', t: 0 }; G.shake = 10; sfx('oops');
    return;
  }
  G.state = 'trip'; G.trip = { n: o.h.n, e: o.h.e, t: 0 }; G.fire = false;
  G.shake = 14; sfx('trip');
  document.getElementById('pad').classList.add('hidden'); document.getElementById('tools').classList.add('hidden');
}

/* ===== 1コマぶん 進める ===== */
function update(dt) {
  if (G.state === 'trip') {
    G.trip.t += dt; updFx(dt * 0.6);
    if (G.trip.t > 1.7) finish();
    return;
  }
  G.t += dt; G.stageT += dt;
  if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.dur) G.banner = null; }
  G.flash = Math.max(0, G.flash - dt * 2.5); G.shake = Math.max(0, G.shake - dt * 40);
  updSky(dt);
  if (G.hitstop > 0) { G.hitstop -= dt; updFx(dt * 0.3); return; }

  var spd = speed(), dd = D(), r = ramp();
  G.roadOff += spd * dt;

  // おばあ
  var kx = (keys.ArrowLeft || keys.a ? -1 : 0) + (keys.ArrowRight || keys.d ? 1 : 0);
  if (has('ice')) { G.pvx = clamp(G.pvx + kx * 4 * dt, -2.4, 2.4); G.px += G.pvx * dt; G.pvx *= (1 - 1.3 * dt); }
  else G.px += kx * 1.9 * dt;
  if (has('wind')) { G.wind = Math.sin(G.stageT * 0.45) * 0.38; G.px += G.wind * dt; } else G.wind = 0;
  if (Math.abs(G.px) > 0.88) { G.px = clamp(G.px, -0.88, 0.88); G.pvx *= -0.3; }
  if (G.jh > 0) { G.vy -= CONFIG.GRAV * dt; G.jh += G.vy * dt; if (G.jh <= 0) { G.jh = 0; G.vy = 0; G.dbl = false; } }
  G.atkT -= dt; G.atkCd -= dt; G.fireCd -= dt; G.inv -= dt; G.scoldT -= dt; G.flipT -= dt; G.stumble -= dt;
  G.comboT -= dt; if (G.comboT <= 0) G.combo = 0;
  if (G.say) { G.say.t += dt; if (G.say.t > 1.4) G.say = null; }
  if (G.fire && G.phase !== 'clear') fire();

  // ステージの流れ
  var L = lv();
  G.phaseT += dt;
  var runTime = G.si === 0 && !G.loop ? 20 : CONFIG.RUN_TIME;
  if (G.phase === 'run' && G.phaseT > runTime) startBoss();
  else if (G.phase === 'clear' && G.phaseT > 2.8) nextStage();

  if (!G.sp && G.phase !== 'clear') spawning(dt, L, r, dd);
  G.decoD += spd * dt;
  if (G.decoD > 70) { G.decoD = 0; placeDeco(CONFIG.ZFAR + rnd(0, 40)); }

  if (G.boss) updBoss(dt, r, dd);

  // 動かす・ぶつかり
  for (var k = 0; k < G.objs.length; k++) {
    var o = G.objs[k];
    if (o.k === 'foe') {
      o.z -= (spd + o.walk) * dt;
      if (o.f.m === 'zig') o.wx += Math.sin(G.t * 3 + o.ph) * 0.7 * dt; else o.wx += o.sway * dt;
      o.wx = clamp(o.wx, -0.9, 0.9);
      if (o.f.m === 'fly') o.h = 55 + Math.sin(G.t * 3 + o.ph) * 12;
      if (has('litter') && !o.dead && o.z > 220 && o.z < 850) { o.dropT -= dt; if (o.dropT <= 0) { o.dropT = rnd(1.6, 3.2) / dd.haz; spawnHaz(o.wx, o.z + 10); } }
    } else if (o.k === 'haz') {
      o.z -= (spd + (o.thrown ? 150 : 0) + (o.big ? 60 : 0)) * dt;
      if (o.thrown || o.big) o.hop += dt;
      if (o.fall > 0) o.fall = Math.max(0, o.fall - 520 * dt);
      if (o.vwx) { o.wx += o.vwx * dt; if (Math.abs(o.wx) > 0.86) { o.vwx *= -1; o.wx = clamp(o.wx, -0.86, 0.86); } }
    } else o.z -= spd * dt;
    if (o.dead || o.gone) continue;
    if (o.k === 'foe' && o.z < 16 && o.z > -12 && Math.abs(o.wx - G.px) < 0.24 && G.jh < 60) knock(o, 'body');
    if (o.k === 'item' && o.z < 24 && o.z > -14 && Math.abs(o.wx - G.px) < 0.3) pickup(o);
    if (o.k === 'haz' && o.fall <= 0 && o.z < (o.big ? 16 : 11) && o.z > -9 && Math.abs(o.wx - G.px) < (o.big ? 0.25 : 0.17) &&
        G.jh < (o.big ? 34 : 16) && !G.sp && G.inv <= 0 && !G.god) { trip(o); if (G.state === 'trip') return; }
  }
  G.objs = G.objs.filter(function (o) { return !o.dead && !o.gone && o.z > -90; });

  updShots(dt);

  if (G.sp) {
    var sp = G.sp; sp.t += dt;
    if (!sp.struck && sp.t >= 0.8) { sp.struck = true; strike(); }
    if (sp.t >= sp.dur) { G.sp = null; G.inv = 0.8; }
  }
  updFx(dt);
  if (G.auto) autoPlay();
}
function spawning(dt, L, r, dd) {
  var boss = G.phase === 'boss';
  G.foeT -= dt;
  if (G.foeT <= 0) {
    var rush = has('rush');
    if (Math.random() < (rush ? 0.5 : 0.22) + r * 0.15) {      // 横一列の集団(まとめてぶっとばすと気持ちいい)
      var n = 3 + Math.floor(Math.random() * (rush ? 4 : 3)), w = rnd(0.9, 1.6), c = rnd(-0.85 + w / 2, 0.85 - w / 2), f = pick(G.ST.foes);
      for (var i = 0; i < n; i++) spawnFoe(c - w / 2 + w * i / (n - 1), CONFIG.ZFAR + rnd(0, 30), f);
    } else spawnFoe(rnd(-0.8, 0.8));
    G.foeT = Math.max(0.35, (boss ? 1.7 : 0.95) - r * 0.4) * (rush ? 0.55 : 1) / dd.foe * rnd(0.7, 1.3);
  }
  G.hazT -= dt;
  if (G.hazT <= 0) {
    if (G.stageT > 3) {
      var hz = spawnHaz(rnd(-0.8, 0.8));
      if (has('slide') && Math.random() < 0.55) hz.vwx = pick([-1, 1]) * rnd(0.35, 0.6);
      if (L >= 6 && Math.random() < 0.12 + r * 0.25) spawnHaz(rnd(-0.8, 0.8), CONFIG.ZFAR + rnd(140, 220));
    }
    G.hazT = Math.max(0.65, 2.1 - r * 1.2) / dd.haz * rnd(0.8, 1.25) * (boss ? 1.8 : 1);
  }
  var gt = G.gimT;
  if (has('rain') && !boss) { gt.rain -= dt; if (gt.rain <= 0) { gt.rain = rnd(1.8, 3) / dd.haz; spawnHaz(G.px + rnd(-0.45, 0.45), rnd(200, 380), { fall: 380 }); } }
  if (has('roll') && !boss) { gt.roll -= dt; if (gt.roll <= 0) { gt.roll = rnd(5, 8) / dd.haz; spawnHaz(rnd(-0.6, 0.6), CONFIG.ZFAR, { big: true }); } }
  if (has('row') && !boss) { gt.row -= dt; if (gt.row <= 0) { gt.row = rnd(6, 9) / dd.haz; hazRow(CONFIG.ZFAR); } }
  if (has('dango')) { gt.dango -= dt; if (gt.dango <= 0) { gt.dango = rnd(2.5, 4); var x = rnd(-0.7, 0.7); for (var q = 0; q < 5; q++) G.objs.push({ k: 'item', t: 'dango', wx: x, z: CONFIG.ZFAR + q * 45, e: '🍡' }); } }
}
function pickup(o) {
  o.gone = true; sfx('pick');
  var p = proj(o.wx, o.z);
  if (o.t === 'dango') { addScore(200 * (1 + G.loop)); G.gauge = Math.min(CONFIG.GAUGE_MAX, G.gauge + 3); G.fx.push({ k: 'word', x: p.x, y: p.y - 40, s: '+200', t: 0, dur: 0.6, col: '#ffd0f0', sz: 18 }); }
  else if (o.t === 'life') { G.lives = Math.min(D().lives, G.lives + 1); G.say = { s: 'おまもり!あと' + G.lives + '回', t: 0 }; }
  else {
    var n; do { n = Math.floor(Math.random() * WEAPONS.length); } while (n === G.wpn);
    G.wpn = n; updWeaponBtn();
    var w = WEAPONS[n];
    G.fx.push({ k: 'word', x: 180, y: BY - 150, s: '武器チェンジ! ' + w.e + w.n + '(' + w.how + ')', t: 0, dur: 1.4, col: '#7fe0ff', sz: 18 });
  }
}
function updBoss(dt, r, dd) {
  var b = G.boss, B = b.B;
  b.t += dt; b.flashT -= dt;
  if (b.shout) { b.shout.t += dt; if (b.shout.t > 1) b.shout = null; }
  var baseZ = 340 + Math.sin(b.t * 0.6) * 55;
  if (B.move === 'sway') b.wx = Math.sin(b.t * 0.7) * 0.55 + Math.sin(b.t * 1.9) * 0.12;
  else if (B.move === 'zig') { var tri = (b.t * 0.45) % 2; b.wx = (tri < 1 ? tri * 2 - 1 : 3 - tri * 2) * 0.65; }
  else { b.wx = Math.sin(b.t * 0.9) * 0.5; b.h = Math.abs(Math.sin(b.t * 3)) * 45; }
  if (b.in && !G.sp) {
    b.dashCd -= dt;
    if (b.dashCd <= 0 && b.dashT <= 0) { b.dashT = 1.7; b.dashCd = rnd(6, 9); b.shout = { s: '突進じゃー!', t: 0 }; }
  }
  if (b.dashT > 0) { b.dashT -= dt; baseZ = 105; }
  if (!b.in) { b.z -= 650 * dt; if (b.z <= baseZ) b.in = true; }
  else b.z += (baseZ - b.z) * Math.min(1, dt * (b.dashT > 0 ? 3.5 : 2.2));
  if (!b.in || G.sp || b.dashT > 0) return;
  b.atkT -= dt;
  if (b.atkT > 0) return;
  var pat = pick(B.pats), z = b.z - 20, aim = b.wx + (G.px - b.wx) * rnd(0.5, 1);
  b.atkT = Math.max(0.85, 2.7 - r * 1.5) / dd.atk * rnd(0.8, 1.2) * (B.final ? 0.75 : 1);
  b.shout = { s: BOSS_SHOUT[pat], t: 0 };
  if (pat === 'throw') spawnHaz(aim, z, { thrown: true });
  else if (pat === 'spread') [-0.45, 0, 0.45].forEach(function (d) { spawnHaz(G.px + d, z, { thrown: true }); });
  else if (pat === 'row') hazRow(z, { thrown: true });
  else if (pat === 'roll') spawnHaz(G.px, z, { big: true, thrown: true });
  else if (pat === 'rain') { for (var i = 0; i < 3 + (r > 0.5 ? 1 : 0); i++) spawnHaz(G.px + rnd(-0.6, 0.6), rnd(170, 330), { fall: 400 + i * 60 }); }
  else if (pat === 'summon') { for (var j = 0; j < 4; j++) spawnFoe(-0.7 + j * 0.47, z - 10); }
}
function updShots(dt) {
  var b = G.boss;
  G.shots.forEach(function (s) {
    s.life -= dt; s.rot += 14 * dt;
    if (s.home) {                     // いちばん近い悪者・ボスを追いかける
      var tg = null, bz = 1e9;
      G.objs.forEach(function (o) { if (o.k === 'foe' && !o.dead && o.z > s.z && o.z - s.z < bz) { bz = o.z - s.z; tg = o; } });
      if (b && b.in && !b.dying && (!tg || b.z - s.z < bz)) tg = b;
      if (tg) s.vwx = clamp(s.vwx + clamp(tg.wx - s.wx, -1, 1) * 9 * dt, -1.6, 1.6);
    }
    if (s.boom) { s.vz -= 2100 * dt; s.wx += Math.sin(s.life * 6) * 0.3 * dt; if (s.vz < 0 && s.z < 10) s.dead = true; }
    s.z += s.vz * dt; s.wx += s.vwx * dt;
    if (s.z > CONFIG.ZFAR || Math.abs(s.wx) > 1.3 || s.life <= 0) s.dead = true;
    if (s.dead) return;
    var rad = s.big ? 0.3 : 0.18;
    for (var k = 0; k < G.objs.length && !s.dead; k++) {
      var o = G.objs[k];
      if (o.k !== 'foe' || o.dead || s.hit.indexOf(o) >= 0) continue;
      if (Math.abs(o.z - s.z) < 32 && Math.abs(o.wx - s.wx) < rad) {
        s.hit.push(o); knock(o, 'shot');
        if (s.bomb) explode(s); else if (!s.pierce) s.dead = true;
      }
    }
    if (!s.dead && b && b.in && !b.dying && s.hit.indexOf(b) < 0 && Math.abs(b.z - s.z) < 55 && Math.abs(b.wx - s.wx) < 0.36 * b.B.scale + (s.big ? 0.1 : 0)) {
      s.hit.push(b); hitBoss(s.dmg, 'shot');
      if (s.bomb) explode(s); else if (!s.pierce) s.dead = true;
    }
  });
  G.shots = G.shots.filter(function (s) { return !s.dead; });
}
function explode(s) {                // スイカ: まわりもまとめて
  s.dead = true;
  var p = proj(s.wx, s.z);
  G.fx.push({ k: 'emo', e: '💥', x: p.x, y: p.y - s.h * p.s, t: 0, dur: 0.5, sz: 120 * p.s + 40 });
  G.objs.forEach(function (o) { if (o.k === 'foe' && !o.dead && Math.abs(o.z - s.z) < 110 && Math.abs(o.wx - s.wx) < 0.5) knock(o, 'shot'); });
  if (G.boss && !G.boss.dying && Math.abs(G.boss.z - s.z) < 140 && Math.abs(G.boss.wx - s.wx) < 0.6) hitBoss(1.5, 'shot');
  G.shake = Math.max(G.shake, 7); sfx('boom');
}
function strike() {                  // 必殺技が当たった瞬間: 画面の悪者を全部ぶっとばす
  G.objs.forEach(function (o) {
    if (o.k === 'foe' && !o.dead) knock(o, 'cane');
    if (o.k === 'haz') {
      o.gone = true; var p = proj(o.wx, o.z);
      G.fx.push({ k: 'emo', e: '💨', x: p.x, y: p.y - 10, t: 0, dur: 0.5, sz: 40 * p.s + 10 });
    }
  });
  if (G.boss && !G.boss.dying) hitBoss(Math.ceil(G.boss.max * 0.3), 'sp');
  G.flash = 1; G.shake = 24; G.hitstop = 0.12;
  addScore(1000 * (1 + G.loop));
}
function updFx(dt) {
  G.fly.forEach(function (f) {
    f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 500 * dt; f.r += f.vr * dt; f.sz *= (1 - dt * 0.6);
    if (f.y < -30 && !f.done) {
      f.done = true;
      if (G.fx.filter(function (e) { return e.k === 'kira'; }).length < 3) { sfx('kira'); G.fx.push({ k: 'kira', x: clamp(f.x, 30, 330), y: 40 + rnd(0, 50), t: 0, dur: 0.8 }); }
    }
  });
  G.fly = G.fly.filter(function (f) { return !f.done && f.y < H + 100; });
  G.fx.forEach(function (e) {
    e.t += dt;
    if (e.k === 'conf') { e.x += e.vx * dt + Math.sin(e.t * 5 + e.rot) * 30 * dt; e.y += e.vy * dt; e.rot += 6 * dt; }
    else if (e.vx != null) { e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 700 * dt; }
  });
  G.fx = G.fx.filter(function (e) { return e.t < e.dur; });
  if (G.fx.length > 280) G.fx.splice(0, G.fx.length - 280);
}
function updSky(dt) {                // 空を飛ぶもの・天気
  var A = G.ST.area;
  if (G.skyo.length < 5 && Math.random() < dt * 0.6) {
    var e = pick(A.fly), dir = pick([-1, 1]), cloud = e === '☁️';
    G.skyo.push({ e: e, x: dir > 0 ? -40 : 400, y: rnd(20, HY - 30), vx: dir * (cloud ? rnd(8, 18) : rnd(30, 70)), sz: cloud ? rnd(40, 70) : rnd(22, 34), ph: rnd(0, 6) });
  }
  G.skyo.forEach(function (o) { o.x += o.vx * dt; });
  G.skyo = G.skyo.filter(function (o) { return o.x > -80 && o.x < 440; });
  var w = A.wx;
  if (w) {
    var want = { rain: 45, snow: 36, sakura: 22, leaf: 12, sand: 24, star: 3, bubble: 16, ember: 24 }[w] || 0;
    while (G.wxp.length < want) {
      var p = { x: rnd(-20, 380), y: rnd(-H, 0), r: rnd(0.6, 1.4), rot: rnd(0, 6), ph: rnd(0, 6) };
      if (w === 'bubble' || w === 'ember') p.y = rnd(H, H * 2);
      if (w === 'sand') { p.x = rnd(-400, 0); p.y = rnd(HY, H); }
      if (w === 'star') { p.x = rnd(0, 400); p.y = rnd(-200, HY * 0.6); }
      G.wxp.push(p);
    }
    G.wxp.forEach(function (p) {
      if (w === 'rain') { p.y += 700 * dt; p.x -= 120 * dt; }
      else if (w === 'snow') { p.y += 50 * p.r * dt; p.x += Math.sin(G.t + p.ph) * 20 * dt; }
      else if (w === 'sakura' || w === 'leaf') { p.y += 55 * p.r * dt; p.x += (Math.sin(G.t * 1.5 + p.ph) * 40 - 20) * dt; p.rot += 2 * dt; }
      else if (w === 'sand') { p.x += 320 * p.r * dt; p.y += 10 * dt; }
      else if (w === 'star') { p.x -= 300 * dt; p.y += 150 * dt; }
      else if (w === 'bubble') { p.y -= 60 * p.r * dt; p.x += Math.sin(G.t * 2 + p.ph) * 15 * dt; }
      else if (w === 'ember') { p.y -= 80 * p.r * dt; p.x += Math.sin(G.t * 3 + p.ph) * 25 * dt; }
    });
    G.wxp = G.wxp.filter(function (p) { return p.y < H + 20 && p.y > -H * 1.2 - 10 && p.x < 420 && p.x > -420; });
  } else G.wxp = [];
}
function autoPlay() {                // 自動で遊ぶ(画面の写真・確認用。#auto のとき)
  var near = null;
  G.objs.forEach(function (o) {
    if (o.k === 'haz' && o.fall <= 0 && o.z > 0 && o.z < (o.big ? 90 : 70) && Math.abs(o.wx - G.px) < 0.3) near = o;
  });
  if (near && G.jh <= 0.5) doJump();
  var tgt = null, best = 1e9;
  G.objs.forEach(function (o) { if (o.k === 'foe' && o.z > 40 && o.z < 400 && o.z < best) { best = o.z; tgt = o; } });
  if (G.boss) tgt = G.boss;
  if (tgt) G.px += clamp(tgt.wx - G.px, -1, 1) * 0.04;
  G.fire = true;
  if (G.objs.some(function (o) { return o.k === 'foe' && o.z > 0 && o.z < 90 && Math.abs(o.wx - G.px) < 0.5; })) doAttack();
  if (G.gauge >= CONFIG.GAUGE_MAX && Math.random() < 0.02) doSpecial();
}

/* ===== 描く ===== */
function draw() {
  // 毎回、拡大と描き方の設定をかけ直す(どこかで失敗しても、次の絵で元にもどるように)
  ctx.setTransform(SC, 0, 0, SC, OX * SC, 0); ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over';
  var lost = ATL.x && ATL.x.isContextLost && ATL.x.isContextLost();
  if (lost || performance.now() - ATL.born > 30000) atlasReset();   // 絵文字の画用紙も 30秒ごとに描き直す(白紙にされていても戻る)
  ctx.save();
  ctx.fillStyle = '#140c2a'; ctx.fillRect(-OX - 10, -10, CONFIG.W + OX * 2 + 20, H + 20);
  if (G.state === 'title' || !G.ST) {
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5fb6ff'); g.addColorStop(1, '#ffe7b8');
    ctx.fillStyle = g; ctx.fillRect(-OX, 0, CONFIG.W + OX * 2, H); ctx.restore(); return;
  }
  if (G.shake > 0) ctx.translate(rnd(-G.shake, G.shake) * 0.6, rnd(-G.shake, G.shake) * 0.6);
  var sp = G.sp;
  if (sp && sp.id === 8) {
    var a = clamp((sp.t - 0.35) / 1.1, 0, 1); a = a * a * (3 - 2 * a);
    ctx.translate(180, H / 2); ctx.rotate(a * Math.PI * 2); ctx.translate(-180, -H / 2);
  }
  drawWorld(G.ST.area);
  ctx.restore();
  ctx.save();
  if (has('dark') && !(sp && sp.t > 0.7)) drawDark();
  drawWeather(G.ST.area);
  if (sp) drawSpecial(sp);
  drawFx();
  drawHud();
  if (G.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + G.flash * 0.75 + ')'; ctx.fillRect(-OX, 0, CONFIG.W + OX * 2, H); }
  ctx.restore();
}
function drawWorld(A) {
  var L = -OX - 20, R = CONFIG.W + OX + 20;
  var g = ctx.createLinearGradient(0, 0, 0, HY); g.addColorStop(0, A.sky[0]); g.addColorStop(1, A.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(L, -40, R - L, HY + 41);
  if (A.night) { ctx.fillStyle = '#fff'; for (var i = 0; i < 40; i++) { ctx.globalAlpha = 0.35 + 0.6 * Math.abs(Math.sin(G.t * 2 + i)); ctx.fillRect((i * 97) % 380 - 10, (i * 53) % (HY - 20), 2, 2); } ctx.globalAlpha = 1; }
  emo(A.sun, 290, HY * 0.38, A.land === 'none' && A.night ? 70 : 52);
  G.skyo.forEach(function (o) { emo(o.e, o.x, o.y + Math.sin(G.t * 2 + o.ph) * 4, o.sz, 0, o.e === '☁️' ? 0.85 : 1); });
  // 遠くの景色
  if (A.land === 'city') {
    ctx.fillStyle = A.far; G.city.forEach(function (c) { ctx.fillRect(c.x, HY - c.h, c.w, c.h + 1); });
    if (A.night) { ctx.fillStyle = 'rgba(255,220,120,.7)'; G.city.forEach(function (c, i) { if (i % 2) { ctx.fillRect(c.x + 4, HY - c.h + 6, 3, 3); ctx.fillRect(c.x + 4, HY - c.h + 16, 3, 3); } }); }
  } else if (A.land === 'hills') {
    [[0.6, 50, 0.018], [1, 30, 0.03]].forEach(function (l, j) {
      ctx.fillStyle = A.far; ctx.globalAlpha = j ? 1 : 0.6; ctx.beginPath(); ctx.moveTo(L, HY + 1);
      for (var x = L; x <= R; x += 8) ctx.lineTo(x, HY - l[1] * (0.55 + 0.45 * Math.sin(x * l[2] + j * 2 + G.si)));
      ctx.lineTo(R, HY + 1); ctx.fill(); ctx.globalAlpha = 1;
    });
  } else if (A.land === 'sea') {
    ctx.fillStyle = A.far; ctx.fillRect(L, HY - 22, R - L, 23);
    ctx.fillStyle = 'rgba(255,255,255,.6)'; for (var s = 0; s < 14; s++) ctx.fillRect((s * 61 + G.t * 12) % 400 - 20, HY - 18 + (s % 3) * 6, 14, 1.5);
  }
  ctx.fillStyle = A.side[0]; ctx.fillRect(L, HY, R - L, H - HY);
  // 道
  var seg = 45, z0 = -100, f1 = proj(0, 9000), f2 = proj(0, CONFIG.ZFAR + 50);
  ctx.fillStyle = A.road[0]; ctx.beginPath(); ctx.moveTo(180 - CONFIG.ROADW * f1.s * 1.2, f1.y); ctx.lineTo(180 + CONFIG.ROADW * f1.s * 1.2, f1.y);
  ctx.lineTo(180 + CONFIG.ROADW * f2.s * 1.2, f2.y + 1); ctx.lineTo(180 - CONFIG.ROADW * f2.s * 1.2, f2.y + 1); ctx.fill();
  for (var z = CONFIG.ZFAR + 50; z > z0; z -= seg) {
    var z1 = Math.max(z - seg, z0), a = proj(0, z), b = proj(0, z1);
    var band = Math.floor((z + G.roadOff) / seg) % 2 === 0;
    var ya = a.y, yb = b.y, wa = CONFIG.ROADW * a.s, wb = CONFIG.ROADW * b.s;
    ctx.fillStyle = band ? A.side[0] : A.side[1]; ctx.fillRect(L, ya, R - L, yb - ya + 1);
    ctx.fillStyle = band ? A.road[0] : A.road[1];
    ctx.beginPath(); ctx.moveTo(180 - wa * 1.12, ya); ctx.lineTo(180 + wa * 1.12, ya); ctx.lineTo(180 + wb * 1.12, yb + 1); ctx.lineTo(180 - wb * 1.12, yb + 1); ctx.fill();
    ctx.fillStyle = band ? '#fff' : (A.edge || '#e0453a');
    ctx.beginPath(); ctx.moveTo(180 - wa * 1.12, ya); ctx.lineTo(180 - wa * 1.2, ya); ctx.lineTo(180 - wb * 1.2, yb + 1); ctx.lineTo(180 - wb * 1.12, yb + 1); ctx.fill();
    ctx.beginPath(); ctx.moveTo(180 + wa * 1.12, ya); ctx.lineTo(180 + wa * 1.2, ya); ctx.lineTo(180 + wb * 1.2, yb + 1); ctx.lineTo(180 + wb * 1.12, yb + 1); ctx.fill();
    if (band) {
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.beginPath(); ctx.moveTo(180 - wa * 0.025, ya); ctx.lineTo(180 + wa * 0.025, ya); ctx.lineTo(180 + wb * 0.025, yb); ctx.lineTo(180 - wb * 0.025, yb); ctx.fill();
    }
  }
  var hz = ctx.createLinearGradient(0, HY, 0, HY + 40); hz.addColorStop(0, A.sky[1]); hz.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.55; ctx.fillStyle = hz; ctx.fillRect(L, HY, R - L, 40); ctx.globalAlpha = 1;
  // 奥から順に描く
  var list = G.objs.slice();
  G.shots.forEach(function (s) { list.push({ k: 'shot', z: s.z, s: s }); });
  if (G.boss) list.push({ k: 'boss', z: G.boss.z });
  list.push({ k: 'me', z: 0 });
  list.sort(function (a, b) { return b.z - a.z; });
  list.forEach(function (o) {
    if (o.k === 'deco') drawDeco(o);
    else if (o.k === 'foe') drawFoe(o);
    else if (o.k === 'haz') drawHaz(o);
    else if (o.k === 'item') drawItem(o);
    else if (o.k === 'shot') drawShot(o.s);
    else if (o.k === 'boss') drawBoss(G.boss);
    else if (o.k === 'me') drawObaa();
  });
  G.fly.forEach(function (f) { drawPerson(f.x, f.y + f.sz * 0.5, f.sz, f.f, 0, f.r); });
  if (G.wind) {                       // 風の線
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
    for (var k = 0; k < 9; k++) { var wy = HY + 40 + k * 45, wx = ((G.t * 400 * Math.sign(G.wind) + k * 97) % 460) - 50; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx - 40 * Math.sign(G.wind), wy); ctx.stroke(); }
    emo('🍃', ((G.t * 300 * Math.sign(G.wind)) % 420 + 420) % 420 - 30, HY + 120 + Math.sin(G.t * 4) * 30, 22, G.t * 4);
  }
}
function drawDeco(o) {
  var p = proj(o.wx, o.z); if (p.y < HY - 2) return;
  var sz = o.sz * p.s; if (sz > 18) shadow(p.x, p.y, sz * 0.4, sz * 0.1, 0.18);
  emo(o.e, p.x, p.y - sz * 0.45, sz);
}
function drawPerson(x, y, sz, f, bob, rot, extra) {
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
  if (f.ufo) { emo('👽', 0, -sz * 0.95, sz * 0.55); emo('🛸', 0, -sz * 0.5, sz * 1.25); ctx.restore(); return; }
  var leg = Math.sin(G.t * 14 + (bob || 0)) * sz * 0.08;
  ctx.strokeStyle = f.mech ? '#5a6570' : '#222'; ctx.lineWidth = Math.max(1.5, sz * 0.09); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-sz * 0.1, -sz * 0.32); ctx.lineTo(-sz * 0.12 + leg, 0); ctx.moveTo(sz * 0.1, -sz * 0.32); ctx.lineTo(sz * 0.12 - leg, 0); ctx.stroke();
  ctx.fillStyle = f.c; rrect(-sz * 0.24, -sz * 0.72, sz * 0.48, sz * 0.46, sz * 0.12); ctx.fill();
  if (f.mech) { ctx.fillStyle = '#c0ccd8'; ctx.fillRect(-sz * 0.18, -sz * 0.62, sz * 0.36, sz * 0.06); ctx.fillRect(-sz * 0.18, -sz * 0.48, sz * 0.36, sz * 0.06); }
  emo(f.e, 0, -sz * 0.92, sz * 0.62);
  if (f.p) emo(f.p, sz * 0.3, -sz * 0.6, sz * 0.36, Math.sin(G.t * 5 + (bob || 0)) * 0.25);
  if (extra && extra.crown) emo('👑', 0, -sz * 1.3, sz * 0.36, Math.sin(G.t * 3) * 0.1);
  if (extra && f.mech) emo('⚙️', -sz * 0.3, -sz * 0.6, sz * 0.26, G.t * 3);
  ctx.restore();
}
function drawFoe(o) {
  var p = proj(o.wx, o.z); if (p.y < HY - 4) return;
  var sz = 66 * p.s, bob = Math.abs(Math.sin(G.t * 9 + o.ph)) * 3 * p.s, y = p.y - o.h * p.s;
  shadow(p.x, p.y, sz * 0.32, sz * 0.09, o.h ? 0.18 : 0.28);
  drawPerson(p.x, y - bob, sz, o.f, o.ph);
  if (o.say && o.z < 560 && o.z > 110) bubble(o.f.say, p.x, y - sz * 1.42, clamp(13 * p.s + 3, 8, 14));
}
function drawHaz(o) {
  var p = proj(o.wx, o.z); if (p.y < HY - 2) return;
  var sz = (o.big ? 62 : 30) * p.s + 3, hop = (o.thrown || o.big) ? Math.abs(Math.sin(o.hop * 9)) * (o.big ? 8 : 22) * p.s : 0;
  if (o.fall > 0) {                   // 落ちてくる: 地面の影で 場所を知らせる
    var k = clamp(1 - o.fall / 600, 0, 1);
    ctx.fillStyle = 'rgba(200,0,0,' + (0.25 + 0.3 * k) + ')'; ctx.beginPath(); ctx.ellipse(p.x, p.y, sz * 0.6 * (0.4 + k * 0.6), sz * 0.2 * (0.4 + k * 0.6), 0, 0, 6.283); ctx.fill();
    emo(o.h.e, p.x, p.y - sz * 0.38 - o.fall * p.s, sz, o.rot + o.fall * 0.02);
    return;
  }
  shadow(p.x, p.y, sz * 0.5, sz * 0.15, 0.35);
  if (o.z < 420) {
    ctx.strokeStyle = 'rgba(255,60,60,' + (0.5 + 0.5 * Math.sin(G.t * 14)) + ')'; ctx.lineWidth = o.big ? 3 : 2;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, sz * 0.75, sz * 0.25, 0, 0, 6.283); ctx.stroke();
  }
  emo(o.h.e, p.x, p.y - sz * 0.38 - hop, sz, o.rot + (o.big ? -o.hop * 10 : o.thrown ? o.hop * 8 : 0));
  if (o.vwx) { ctx.fillStyle = 'rgba(255,255,255,.7)'; txt(o.vwx > 0 ? '→' : '←', p.x, p.y - sz * 1.1, 12 * p.s + 6, '#fff'); }
}
function drawItem(o) {
  var p = proj(o.wx, o.z); if (p.y < HY - 2) return;
  var sz = 32 * p.s + 4, b = Math.abs(Math.sin(G.t * 5 + o.z * 0.01)) * 10 * p.s;
  shadow(p.x, p.y, sz * 0.4, sz * 0.12, 0.25);
  if (o.t !== 'dango') { ctx.fillStyle = 'rgba(255,255,200,' + (0.3 + 0.2 * Math.sin(G.t * 8)) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y - sz * 0.6 - b, sz * 0.7, 0, 6.283); ctx.fill(); }
  emo(o.e, p.x, p.y - sz * 0.6 - b, sz);
}
function drawShot(s) {
  var p = proj(s.wx, s.z), y = p.y - s.h * p.s, sz = s.sz * 1.35 * p.s + 8;
  shadow(p.x, p.y, sz * 0.35, sz * 0.1, 0.2);
  var q = proj(s.wx - s.vwx * 0.06, s.z - Math.abs(s.vz) * 0.06);   // 光の尾
  ctx.strokeStyle = 'rgba(255,250,200,.55)'; ctx.lineWidth = sz * 0.45; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(q.x, q.y - s.h * q.s); ctx.lineTo(p.x, y); ctx.stroke();
  emo(s.e, p.x, y, sz, s.rot);
}
function drawBoss(b) {
  var p = proj(b.wx, b.z), sz = 300 * p.s * b.B.scale, y = p.y - b.h * p.s;
  var r = sz * (0.75 + 0.06 * Math.sin(G.t * 8));
  var g = ctx.createRadialGradient(p.x, y - sz * 0.6, 0, p.x, y - sz * 0.6, r);
  var col = b.B.crown ? '255,200,0' : '255,40,80';
  g.addColorStop(0, 'rgba(' + col + ',.45)'); g.addColorStop(1, 'rgba(' + col + ',0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, y - sz * 0.6, r, 0, 6.283); ctx.fill();
  shadow(p.x, p.y, sz * 0.38, sz * 0.1, 0.4);
  if (b.flashT > 0) { ctx.save(); ctx.globalAlpha = 0.55; }
  drawPerson(p.x, y - (b.d.ufo ? sz * 0.25 + Math.sin(G.t * 3) * 8 : 0), sz, b.d, 0, Math.sin(G.t * 3) * 0.06, b.B);
  if (b.flashT > 0) ctx.restore();
  if (b.dashT > 0 && !G.sp) txt('いまだ!杖で叩け!', p.x, y - sz * 1.35, 16, '#fff36b');
  else if (b.shout) bubble(b.shout.s, p.x, y - sz * 1.3, 13);
  else if (b.in && Math.sin(G.t * 1.3) > 0.6) bubble(b.d.say, p.x, y - sz * 1.3, 12);
}
function drawObaa() {
  var p = proj(G.px, 0), x = p.x, y = BY - G.jh;
  shadow(x, BY + 2, 30 - Math.min(G.jh, 60) * 0.15, 8, 0.35);
  var gold = G.sp && G.sp.id === 9, spin = G.sp && G.sp.id === 1 ? G.sp.t * 25 : 0;
  ctx.save(); ctx.translate(x, y);
  if (G.state === 'trip') {
    var tt = Math.min(G.trip.t / 0.45, 1);
    ctx.translate(0, -Math.sin(tt * Math.PI) * 40 + tt * 6); ctx.rotate(-tt * 1.6);
  }
  if (G.stumble > 0) ctx.rotate(Math.sin(G.stumble * 30) * 0.3);
  if (G.flipT > 0) { ctx.translate(0, -40); ctx.rotate((1 - G.flipT / 0.45) * Math.PI * 2); ctx.translate(0, 40); }
  if (spin) ctx.scale(Math.cos(spin), 1);
  if (gold) { ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 30; }
  if (G.inv > 0 && Math.floor(G.t * 20) % 2) ctx.globalAlpha = 0.55;
  var walk = G.jh > 0 ? 0 : Math.sin(G.t * 16) * 5;
  ctx.strokeStyle = '#3a2a2a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-7, -18); ctx.lineTo(-8 + walk, 0); ctx.moveTo(7, -18); ctx.lineTo(8 - walk, 0); ctx.stroke();
  ctx.fillStyle = gold ? '#ffd700' : '#7a3fa0';
  ctx.beginPath(); ctx.moveTo(-22, -16); ctx.lineTo(22, -16); ctx.lineTo(16, -54); ctx.lineTo(-16, -54); ctx.closePath(); ctx.fill();
  ctx.fillStyle = gold ? '#fff2a0' : '#f2c14e'; ctx.fillRect(-18, -38, 36, 7);
  // 杖
  var sw = G.atkT > 0 ? (1 - G.atkT / 0.24) : -1, win = G.phase === 'clear';
  ctx.save(); ctx.translate(18, -40);
  var ang = win ? -2.9 + Math.sin(G.t * 10) * 0.2 : sw >= 0 ? (G.atkAir ? -2.4 + sw * 6.6 : -2.4 + sw * 3.0) : 0.25;
  ctx.rotate(ang);
  ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 48); ctx.stroke();
  ctx.strokeStyle = '#5a3a1b'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(-6, -6, 6, 0, Math.PI, true); ctx.stroke();
  ctx.restore();
  emo(win ? '😆' : '👵', 0, -74, 46);
  if (win) emo('✌️', -26, -64, 22, Math.sin(G.t * 8) * 0.3);
  ctx.restore();
  if (G.atkT > 0) {
    var k = G.atkT / 0.24, far = proj(G.px, G.atkAir ? 135 : CONFIG.ATK_REACH), wd = CONFIG.ROADW * CONFIG.ATK_WIDE * (G.atkAir ? 1.45 : 1) * 0.95;
    ctx.save(); ctx.globalAlpha = k;
    ctx.strokeStyle = G.atkAir ? '#bff4ff' : '#fff8c0'; ctx.lineWidth = 10 * k + 2; ctx.lineCap = 'round';
    ctx.beginPath();
    if (G.atkAir) ctx.ellipse(x, y - 50, wd, 34, 0, 0, Math.PI * 2 * (1.05 - k));
    else ctx.ellipse(x, y - 60, wd, Math.max(10, (BY - 60 - far.y) * 0.9 + 10), 0, Math.PI * (1.05 + (1 - k) * 0.2), Math.PI * (1.95 - (1 - k) * 0.2));
    ctx.stroke(); ctx.restore();
  }
  if (G.say) { var a = Math.min(1, (1.4 - G.say.t) * 4); ctx.save(); ctx.globalAlpha = Math.max(0, a); bubble(G.say.s, clamp(x, 80, 280), y - 118, 15); ctx.restore(); }
}
function drawDark() {
  var me = proj(G.px, 0), g = ctx.createRadialGradient(me.x, BY - 60, 60, me.x, BY - 120, 330);
  g.addColorStop(0, 'rgba(0,0,10,0)'); g.addColorStop(1, 'rgba(0,0,10,.86)');
  ctx.fillStyle = g; ctx.fillRect(-OX, 0, CONFIG.W + OX * 2, H);
  G.objs.forEach(function (o) {           // まっくらでも 障害物は 赤く光る
    if (o.k !== 'haz' || o.z > 700) return;
    var p = proj(o.wx, o.z); ctx.fillStyle = 'rgba(255,60,60,' + (0.35 + 0.3 * Math.sin(G.t * 12)) + ')';
    ctx.beginPath(); ctx.arc(p.x, p.y - 8 * p.s, 10 * p.s + 3, 0, 6.283); ctx.fill();
  });
}
function drawWeather(A) {
  var w = A.wx; if (!w) return;
  G.wxp.forEach(function (p) {
    if (w === 'rain') { ctx.strokeStyle = 'rgba(200,220,255,.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 5, p.y - 16); ctx.stroke(); }
    else if (w === 'snow') { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(p.x, p.y, 1.5 + p.r * 1.5, 0, 6.283); ctx.fill(); }
    else if (w === 'sakura') { ctx.fillStyle = 'rgba(255,183,213,.95)'; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.beginPath(); ctx.ellipse(0, 0, 4 * p.r, 2.4 * p.r, 0, 0, 6.283); ctx.fill(); ctx.restore(); }
    else if (w === 'leaf') emo(p.ph > 3 ? '🍁' : '🍂', p.x, p.y, 14 * p.r, p.rot);
    else if (w === 'sand') { ctx.strokeStyle = 'rgba(240,210,150,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 30, p.y); ctx.stroke(); }
    else if (w === 'star') { ctx.strokeStyle = 'rgba(255,255,220,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 30, p.y - 15); ctx.stroke(); }
    else if (w === 'bubble') { ctx.strokeStyle = 'rgba(220,250,255,.75)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, 3 + p.r * 4, 0, 6.283); ctx.stroke(); }
    else if (w === 'ember') { ctx.fillStyle = 'rgba(255,' + Math.floor(120 + p.r * 80) + ',40,.9)'; ctx.beginPath(); ctx.arc(p.x, p.y, 1.5 + p.r, 0, 6.283); ctx.fill(); }
  });
}
function drawFx() {
  G.fx.forEach(function (e) {
    var k = e.t / e.dur;
    if (e.k === 'spark') { ctx.fillStyle = e.col; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1 - k * 0.5), 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; }
    else if (e.k === 'ring') { ctx.strokeStyle = 'rgba(255,255,255,' + (1 - k) + ')'; ctx.lineWidth = 4 * (1 - k) + 1; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.3 + k), 0, 6.283); ctx.stroke(); }
    else if (e.k === 'word') { var s = k < 0.15 ? 0.6 + k * 4 : 1.2 - k * 0.3; ctx.globalAlpha = 1 - Math.max(0, k - 0.6) * 2.5; txt(e.s, clamp(e.x, 40, 320), e.y - k * 30, (e.sz || 26) * s, e.col, '#c0122f'); ctx.globalAlpha = 1; }
    else if (e.k === 'emo') emo(e.e, e.x, e.y, e.sz * (0.6 + k * 0.8), 0, 1 - k);
    else if (e.k === 'conf') { ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.rot); ctx.fillStyle = e.col; ctx.globalAlpha = Math.min(1, (1 - k) * 3); ctx.fillRect(-4, -2.5, 8, 5); ctx.restore(); }
    else if (e.k === 'kira') {
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(k * 3); ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#fffbd0'; var r = 18 * Math.sin(k * Math.PI) + 4;
      ctx.beginPath(); for (var i = 0; i < 8; i++) { var aa = i * Math.PI / 4, rr = i % 2 ? r * 0.3 : r; ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1 - k; txt('キラーン', e.x, e.y + 22, 12, '#fffbd0'); ctx.globalAlpha = 1;
    }
  });
}
function drawHud() {
  var top = 22, dd = D();
  txt(String(G.score), 12, top, 22, '#fff', '#1b1430', 'left');
  txt('STAGE ' + (lv() + 1), 12, top + 24, 13, '#ffe066', '#1b1430', 'left');
  txt(dd.n, 108, top + 24, 11, dd.col, '#1b1430', 'left');
  txt(G.ST.title, 12, top + 42, 11, '#fff', '#1b1430', 'left', 250);
  if (dd.lives > 1) for (var i = 0; i < dd.lives; i++) emo(i < G.lives ? '❤️' : '🖤', 172 + i * 18, top + 24, 14);
  if (G.boss && G.boss.in) {
    var b = G.boss, w = 230, x0 = 180 - w / 2, y0 = top + 62;
    txt(b.B.name, 180, y0 - 2, 13, '#ff8a8a');
    ctx.fillStyle = '#1b1430'; rrect(x0 - 2, y0 + 8, w + 4, 12, 6); ctx.fill();
    ctx.fillStyle = b.B.crown ? '#ffb300' : '#ff3d5a'; rrect(x0, y0 + 10, w * Math.max(0, b.hp / b.max), 8, 4); ctx.fill();
  }
  if (G.combo >= 3) {
    var pul = 1 + Math.max(0, G.comboT - 1.9) * 1.5;
    txt(G.combo + ' れんぞく!', 348, 128, 22 * pul, '#fff36b', '#c0122f', 'right');
  }
  if (G.si === 0 && !G.loop && G.stageT < 12) {
    var tip = G.stageT < 4 ? '指で左右になぞって動く' : G.stageT < 8 ? '杖ボタンを押しっぱなしで 物を投げる!' : '小石はジャンプ!2回押すと二段ジャンプ';
    txt(tip, 180, BY + 40, 14, '#fff', '#1b1430');
  }
  if (G.banner && !(G.sp && G.sp.t < 1.3)) {
    var bn = G.banner, k = bn.t / bn.dur, sl = k < 0.1 ? (0.1 - k) / 0.1 : (k > 0.88 ? -(k - 0.88) / 0.12 : 0);
    var y = H * 0.36;
    ctx.save(); ctx.translate(sl * 400, 0);
    ctx.fillStyle = 'rgba(20,10,40,.74)'; ctx.fillRect(-OX, y - 44, CONFIG.W + OX * 2, bn.third ? 108 : 88);
    txt(bn.big, 180, y - 14, bn.big.length > 9 ? 25 : 34, bn.col, '#1b1430');
    txt(bn.small, 180, y + 20, bn.small.length > 18 ? 13 : 15, '#fff', '#1b1430');
    if (bn.third) txt(bn.third, 180, y + 46, bn.third.length > 24 ? 10 : 12, '#bfefff', '#1b1430');
    ctx.restore();
  }
  var pct = Math.round(G.gauge / CONFIG.GAUGE_MAX * 100);
  if (pct !== G._pct) {
    G._pct = pct; document.getElementById('spFill').style.height = pct + '%';
    document.getElementById('bSp').classList.toggle('ready', pct >= 100);
  }
}
function drawSpecial(sp) {
  var t = sp.t, S = SPECIALS[sp.id], me = proj(G.px, 0), mx = me.x, my = BY - 50;
  ctx.save();
  if (t < 0.9) { ctx.fillStyle = 'rgba(0,0,0,' + Math.min(0.45, t) + ')'; ctx.fillRect(-OX, 0, CONFIG.W + OX * 2, H); }
  var st = clamp((t - 0.6) / 0.4, 0, 1), i, k, a;
  switch (sp.id) {
    case 0:
      sp.pts.forEach(function (p) {
        var q = clamp((t - 0.3 - p.d) / 0.5, 0, 1);
        if (q < 1) emo('☄️', p.x + (1 - q) * 220, p.y - (1 - q) * 600, 60, -0.6);
        else if (t - 0.8 - p.d < 0.8) emo('💥', p.x, p.y - 20, 70 + (t - 0.8 - p.d) * 90, 0, 1 - (t - 0.8 - p.d) / 0.8);
      });
      break;
    case 1:
      var tz = 60 + st * 260;
      ctx.globalAlpha = t > 1.9 ? Math.max(0, (2.4 - t) * 2) : 1;
      for (i = 0; i < 7; i++) { ctx.strokeStyle = 'rgba(200,240,255,.7)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(mx, my - i * tz * 0.13, tz * (0.25 + i * 0.1), tz * 0.05 + 4, 0, t * 12 + i, t * 12 + i + 4.5); ctx.stroke(); }
      emo('🌪️', mx, my - tz * 0.4, tz, Math.sin(t * 20) * 0.1);
      break;
    case 2:
      for (i = 0; i < 24; i++) { a = i / 24 * 6.283 + t * 9; var rr = t * 330; emo('🦷', mx + Math.cos(a) * rr, my + Math.sin(a) * rr * 0.75 - rr * 0.4, 34, a * 2); }
      break;
    case 3:
      var bw = 30 + st * 120 + Math.sin(t * 50) * 6;
      if (t > 0.35) {
        var g = ctx.createLinearGradient(mx - bw, 0, mx + bw, 0);
        g.addColorStop(0, 'rgba(255,230,0,0)'); g.addColorStop(0.3, 'rgba(255,240,80,.9)'); g.addColorStop(0.5, '#fff'); g.addColorStop(0.7, 'rgba(255,240,80,.9)'); g.addColorStop(1, 'rgba(255,230,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(mx - 20, my - 40); ctx.lineTo(mx + 20, my - 40); ctx.lineTo(180 + bw * 1.6, -20); ctx.lineTo(180 - bw * 1.6, -20); ctx.fill();
        ['そもそもねぇ!', '最近の若いのは!', '聞いてるのかい!', 'いいかい!'].forEach(function (w, j) { txt(w, 70 + (j % 2) * 220, my - 120 - j * 80 - t * 40, 18, '#fff36b', '#c0122f'); });
      }
      break;
    case 4:
      ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      for (i = 0; i < 70; i++) {
        if (t * 1400 - i * 23 < 0) continue;
        var x = (i * 47.3) % 380 - 10, fy = (t * 1400 - i * 23) % (H + 200) - 100;
        ctx.beginPath(); ctx.moveTo(x, fy - 50); ctx.lineTo(x, fy); ctx.stroke();
        ctx.beginPath(); ctx.arc(x - 6, fy - 50, 6, 0, Math.PI, true); ctx.stroke();
      }
      break;
    case 5:
      var rk = clamp((t - 0.2) / 0.6, 0, 1), ry = -200 + rk * rk * (HY + (BY - HY) * 0.45 + 200);
      emo('🪨', 180, ry, 280);
      if (t > 0.8) { k = (t - 0.8) / 1.2; ctx.strokeStyle = 'rgba(255,255,255,' + Math.max(0, 1 - k) + ')'; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(180, ry + 100, k * 400, k * 120, 0, 0, 6.283); ctx.stroke(); txt('ドッスーン!', 180, ry - 170, 34, '#fff', '#555'); }
      break;
    case 6:
      var kids = ['👦', '👧', '🧒', '👶', '🧑', '👱'];
      for (i = 0; i < 36; i++) { k = t * 1.1 - (i % 12) * 0.05; if (k < 0) continue; emo(kids[i % kids.length], 20 + (i * 61) % 330, H + 40 - k * (H + 80) - Math.floor(i / 12) * 40 - Math.abs(Math.sin(t * 20 + i)) * 8, 40); }
      txt('おばあちゃーん!!', 180, H * 0.6, 26, '#ff7ad0');
      break;
    case 7:
      sp.pts.forEach(function (p, j) {
        var q = clamp((t - 0.25 - p.d * 0.5) / 0.55, 0, 1); if (q <= 0) return;
        var cx = mx + (j - 8) * 30, cy = my - 260;
        var x = (1 - q) * (1 - q) * mx + 2 * (1 - q) * q * cx + q * q * p.x, y = (1 - q) * (1 - q) * my + 2 * (1 - q) * q * cy + q * q * p.y;
        if (q < 1) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(x, y + 10, 8, 0, 6.283); ctx.fill(); ctx.fillStyle = '#d7263d'; ctx.beginPath(); ctx.arc(x, y, 11, 0, 6.283); ctx.fill(); ctx.fillStyle = '#ffb3c0'; ctx.beginPath(); ctx.arc(x - 3, y - 3, 3, 0, 6.283); ctx.fill(); }
        else if (t < 1.8) emo('💥', p.x, p.y - 20, 70, 0, Math.max(0, 1 - (t - 1) / 0.8));
      });
      break;
    case 8:
      a = clamp((t - 0.1) / 0.5, 0, 1);
      ctx.save(); ctx.translate(mx, my - 40 - a * 80); ctx.rotate(-a * 2.5);
      ctx.fillStyle = '#8b4a1c'; ctx.beginPath(); ctx.ellipse(0, 0, 90, 22, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#6b3410'; ctx.fillRect(-60, 10, 10, 40); ctx.fillRect(50, 10, 10, 40);
      ctx.restore();
      if (t > 0.4) ['🍵', '🍙', '🍡', '🍘'].forEach(function (e, j) { emo(e, mx + (j - 1.5) * 60 * t, my - 200 * t + 160 * t * t, 34, t * 6); });
      break;
    case 9:
      ctx.save(); ctx.translate(mx, my);
      for (i = 0; i < 16; i++) { ctx.rotate(Math.PI / 8); ctx.fillStyle = 'rgba(255,215,0,' + (0.25 * st + 0.1) + ')'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-30, -900); ctx.lineTo(30, -900); ctx.fill(); }
      ctx.restore();
      emo('👵', mx, my - 40 - st * 60, 46 + st * 110);
      if (t > 0.8) txt('ゴゴゴゴゴ…', 180, H * 0.62, 28, '#ffd700', '#5a3a00');
      break;
  }
  ctx.restore();
  if (t < 1.25) {
    k = t / 1.25;
    var sl = k < 0.15 ? (0.15 - k) / 0.15 * 400 : (k > 0.85 ? -(k - 0.85) / 0.15 * 400 : 0), cy2 = H * 0.3;
    ctx.save(); ctx.translate(sl, 0);
    ctx.fillStyle = S.c; ctx.fillRect(-OX, cy2 - 48, CONFIG.W + OX * 2, 96);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; for (i = 0; i < 12; i++) ctx.fillRect(-OX + ((i * 60 + t * 900) % (CONFIG.W + OX * 2 + 60)) - 60, cy2 - 48, 18, 96);
    emo('👵', 52, cy2, 80, Math.sin(t * 30) * 0.08);
    txt('必殺!', 210, cy2 - 26, 16, '#fff', '#1b1430');
    txt(S.n, 212, cy2 + 4, S.n.length > 9 ? 19 : 23, '#fff', '#1b1430');
    txt(S.sub, 212, cy2 + 32, 13, '#fff36b', '#1b1430');
    ctx.restore();
  }
}

/* ===== まわす ===== */
var last = 0, acc = 0;
G.roadOff = 0;
function loop(now) {
  requestAnimationFrame(loop);
  try {
    var dt = Math.min((now - last) / 1000, 0.05); last = now;
    if ((G.state === 'play' || G.state === 'trip') && !G.paused) {
      acc += dt;
      var steps = 0;
      while (acc >= CONFIG.DT && steps < 4) { update(CONFIG.DT); acc -= CONFIG.DT; steps++; }
      if (steps >= 4) acc = 0;
    }
    draw();
  } catch (e) { console.error(e); try { if (ctx.reset) ctx.reset(); } catch (e2) {} }   // 描き方の設定が くずれたまま残らないように
}
requestAnimationFrame(function (t) { last = t; loop(t); });
// 確認用: #play / #auto(自動・無敵)/ #stage=37 / #boss / #full / #sp=3 / #w=5 / #d=1〜3(かんたん・ふつう・むずかしい)
if (/^#(play|auto)/.test(location.hash)) {
  var dq = hashOpt('d'); if (dq) G.diff = ['easy', 'normal', 'hard'][clamp(dq - 1, 0, 2)];
  if (/^#auto/.test(location.hash)) { G.auto = true; G.god = true; }
  start(null, clamp((hashOpt('stage') || 1) - 1, 0, 99));
}
window.__G = G;
