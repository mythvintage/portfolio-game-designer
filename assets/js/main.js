(function () {
'use strict';
var root = document.documentElement;
function $(s, c) { return (c || document).querySelector(s); }
function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
var reduce = false;
try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
function isTR() { return root.getAttribute('data-lang') === 'tr'; }
function L(en, tr) { return isTR() ? tr : en; }
function fmt(n) { return Math.round(n).toLocaleString(isTR() ? 'tr-TR' : 'en-US'); }
function i18n(scope, key) {
  var el = scope && scope.querySelector('.hidden-i18n [data-k="' + key + '"]');
  if (!el) return key;
  var t = el.querySelector(isTR() ? '.tr' : '.en');
  return t ? t.textContent : el.textContent;
}

/* ---------------- state ---------------- */
var KEY = 'yb-quest-v1';
function fresh() { return { xp: 0, done: {}, ach: {}, prog: {} }; }
var S = fresh();
try {
  var raw = localStorage.getItem(KEY);
  if (raw) { var o = JSON.parse(raw); if (o && typeof o.xp === 'number') { S = o; S.done = S.done || {}; S.ach = S.ach || {}; S.prog = S.prog || {}; } }
} catch (e) {}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function cnt(pre) { var n = 0; for (var k in S.done) if (k.indexOf(pre) === 0) n++; return n; }

var LV = [0, 50, 130, 230, 340, 440];
var LVN = [['New player', 'Yeni oyuncu'], ['Explorer', 'Kâşif'], ['Playtester', 'Test oyuncusu'], ['Analyst', 'Analist'], ['Systems thinker', 'Sistem düşünürü'], ['Co-op partner', 'Takım arkadaşı']];
function level(x) { var l = 0; for (var i = 0; i < LV.length; i++) if (x >= LV[i]) l = i; return l; }

var QUESTS = [
  { en: 'Open your first level', tr: 'İlk seviyeni aç', href: '#levels', pre: 'lvlopen:', n: 1 },
  { en: 'Clear a level by reading to the end', tr: 'Bir seviyeyi sonuna kadar okuyup bitir', href: '#levels', pre: 'lvlclear:', n: 1 },
  { en: 'Watch a gameplay clip', tr: 'Bir oynanış videosu izle', href: '#clips', pre: 'clip:', n: 1 },
  { en: 'Filter the game library', tr: 'Oyun kütüphanesini filtrele', href: '#games', pre: 'filter', n: 1 },
  { en: 'Say hello: copy my email or open LinkedIn', tr: 'Merhaba de: e-postamı kopyala ya da LinkedIn\'i aç', href: '#contact', pre: 'contact:', n: 1 }
];
var ACH = [
  { id: 'first', en: 'First run', tr: 'İlk tur', den: 'Open a level', dtr: 'Bir seviye aç', t: function () { return cnt('lvlopen:') >= 1; } },
  { id: 'clear', en: 'Full clear', tr: 'Tam tur', den: 'Clear all three levels', dtr: 'Üç seviyeyi de bitir', t: function () { return cnt('lvlclear:') >= 3; } },
  { id: 'expl', en: 'Explorer', tr: 'Kâşif', den: 'Visit every section', dtr: 'Her bölümü ziyaret et', t: function () { return ['levels', 'games', 'clips', 'path', 'contact'].every(function (s) { return S.done['sec:' + s]; }); } },
  { id: 'bil', en: 'Bilingual', tr: 'İki dilli', den: 'Switch the language', dtr: 'Dili değiştir', t: function () { return !!S.done.lang; } },
  { id: 'scout', en: 'Talent scout', tr: 'Yetenek avcısı', den: 'Copy my email or open LinkedIn', dtr: 'E-postamı kopyala ya da LinkedIn\'i aç', t: function () { return cnt('contact:') >= 1; } }
];

/* ---------------- feedback ---------------- */
var toastBox = $('#toasts');
function toast(icon, title, sub) {
  if (!toastBox) return;
  var t = document.createElement('div'); t.className = 'toast';
  t.innerHTML = '<div class="ic"></div><b></b><span></span>';
  t.querySelector('.ic').textContent = icon; t.querySelector('b').textContent = title; t.querySelector('span').textContent = sub;
  toastBox.appendChild(t);
  while (toastBox.children.length > 3) toastBox.removeChild(toastBox.firstChild);
  setTimeout(function () { t.classList.add('out'); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320); }, 3200);
}
function floatXP(el, xp) {
  var anchor = (el && el.getBoundingClientRect && el.offsetParent !== null) ? el : $('#xpBtn');
  if (!anchor) return;
  var r = anchor.getBoundingClientRect();
  var f = document.createElement('div'); f.className = 'fxp'; f.textContent = '+' + xp + ' XP';
  f.style.left = Math.max(8, Math.min(window.innerWidth - 80, r.left + r.width / 2 - 28)) + 'px';
  f.style.top = Math.max(60, r.top - 6) + 'px';
  document.body.appendChild(f);
  setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, reduce ? 900 : 1150);
  var b = $('#xpBtn'); if (b && !reduce) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
}
function award(key, xp, el) {
  if (S.done[key]) return false;
  var before = level(S.xp);
  S.done[key] = 1; S.xp += xp; save();
  floatXP(el, xp);
  var after = level(S.xp);
  renderHUD();
  if (after > before) toast('LV' + (after + 1), L('Level up!', 'Seviye atladın!'), L('Level ', 'Seviye ') + (after + 1) + ' · ' + L(LVN[after][0], LVN[after][1]));
  checkAch(); renderQuests();
  return true;
}
function checkAch() {
  ACH.forEach(function (a) {
    if (!S.ach[a.id] && a.t()) { S.ach[a.id] = 1; save(); toast('★', L('Achievement unlocked', 'Başarım açıldı'), L(a.en, a.tr) + ' · ' + L(a.den, a.dtr)); }
  });
  renderAch();
}

/* ---------------- render ---------------- */
function renderHUD() {
  var l = level(S.xp), max = l === LV.length - 1;
  var lo = LV[l], hi = max ? LV[l] : LV[l + 1];
  var pct = max ? 100 : Math.round((S.xp - lo) / (hi - lo) * 100);
  $$('[data-lv]').forEach(function (e) { e.textContent = l + 1; });
  $$('[data-lvname]').forEach(function (e) { e.textContent = L(LVN[l][0], LVN[l][1]); });
  $$('[data-xpnow]').forEach(function (e) { e.textContent = S.xp; });
  $$('[data-xpnext]').forEach(function (e) { e.textContent = max ? '' : '/' + hi; });
  $$('[data-xpfill]').forEach(function (e) { e.style.width = pct + '%'; });
  $$('.xpring').forEach(function (e) { e.style.setProperty('--p', pct); });
  var got = ACH.filter(function (a) { return S.ach[a.id]; }).length;
  $$('[data-achn]').forEach(function (e) { e.textContent = got + '/' + ACH.length; });
  var nx = $('[data-nextlv]');
  if (nx) nx.textContent = max ? L('Max level reached. Thanks for playing.', 'En yüksek seviyedesin. Oynadığın için teşekkürler.')
    : L((hi - S.xp) + ' XP to level ' + (l + 2), 'Seviye ' + (l + 2) + ' için ' + (hi - S.xp) + ' XP');
}
function renderQuests() {
  $$('.quests').forEach(function (ol) {
    ol.innerHTML = '';
    QUESTS.forEach(function (q) {
      var have = Math.min(cnt(q.pre), q.n), done = have >= q.n;
      var li = document.createElement('li'); if (done) li.className = 'done';
      li.innerHTML = '<span class="box" aria-hidden="true">' + (done ? '✓' : '') + '</span><a class="qt"></a><span class="qx"></span>';
      var a = li.querySelector('a'); a.href = q.href; a.textContent = L(q.en, q.tr);
      li.querySelector('.qx').textContent = done ? L('done', 'tamam') : (q.n > 1 ? have + '/' + q.n : '');
      ol.appendChild(li);
    });
  });
}
function renderAch() {
  var g = $('#achGrid'); if (!g) return;
  g.innerHTML = '';
  ACH.forEach(function (a) {
    var d = document.createElement('div'); d.className = 'ach' + (S.ach[a.id] ? ' got' : '');
    d.innerHTML = '<b></b><span></span>';
    d.querySelector('b').textContent = L(a.en, a.tr); d.querySelector('span').textContent = L(a.den, a.dtr);
    g.appendChild(d);
  });
}
function renderLevels() {
  $$('.lvl').forEach(function (c) {
    var s = c.getAttribute('data-level');
    var st = S.done['lvlclear:' + s] ? 'clear' : (S.done['lvlopen:' + s] ? 'open' : 'new');
    c.setAttribute('data-state', st);
    var lab = c.querySelector('.state');
    if (lab) lab.textContent = st === 'clear' ? L('Cleared', 'Bitti') : st === 'open' ? L('In progress', 'Devam ediyor') : L('New', 'Yeni');
    var m = c.querySelector('.meter i'); if (m) m.style.width = (st === 'clear' ? 100 : (S.prog[s] || 0)) + '%';
  });
}
function renderDocs() {
  var n = 0;
  $$('.doc').forEach(function (d) { var r = !!S.done['doc:' + d.getAttribute('data-doc')]; d.classList.toggle('read', r); if (r) n++; });
  $$('[data-docn]').forEach(function (e) { e.textContent = n; });
}
function renderOptions() { $$('option[data-en]').forEach(function (o) { o.textContent = L(o.getAttribute('data-en'), o.getAttribute('data-tr')); }); }
function renderAll() { renderOptions(); renderHUD(); renderQuests(); renderAch(); renderLevels(); renderDocs(); tools.forEach(function (f) { try { f(true); } catch (e) {} }); }

/* ---------------- language ---------------- */
function setLang(l, user) {
  root.setAttribute('data-lang', l); root.setAttribute('lang', l);
  $$('[data-set-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-set-lang') === l)); });
  try { localStorage.setItem('yb-lang', l); } catch (e) {}
  if (user) award('lang', 15, $('[data-set-lang="' + l + '"]'));
  renderAll();
}

/* ---------------- quest panel ---------------- */
var panel = $('#questPanel'), xpBtn = $('#xpBtn');
function setPanel(open) { if (!panel) return; panel.hidden = !open; xpBtn.setAttribute('aria-expanded', String(open)); }
if (xpBtn) xpBtn.addEventListener('click', function (e) { e.stopPropagation(); setPanel(panel.hidden); });
document.addEventListener('click', function (e) { if (panel && !panel.hidden && !panel.contains(e.target) && e.target !== xpBtn) setPanel(false); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel && !panel.hidden) setPanel(false); });
$$('[data-close-panel]').forEach(function (b) { b.addEventListener('click', function () { setPanel(false); }); });
var resetBtn = $('#resetBtn'), armed = 0;
if (resetBtn) resetBtn.addEventListener('click', function () {
  if (!armed) { armed = 1; resetBtn.querySelector('.en').textContent = 'Click again to reset'; resetBtn.querySelector('.tr').textContent = 'Sıfırlamak için tekrar tıkla';
    setTimeout(function () { armed = 0; resetBtn.querySelector('.en').textContent = 'Reset progress'; resetBtn.querySelector('.tr').textContent = 'İlerlemeyi sıfırla'; }, 3000); return; }
  armed = 0; S = fresh(); save(); renderAll();
  resetBtn.querySelector('.en').textContent = 'Reset progress'; resetBtn.querySelector('.tr').textContent = 'İlerlemeyi sıfırla';
});

/* ---------------- sections ---------------- */
var navLinks = $$('.nav a');
if ('IntersectionObserver' in window) {
  var io = new IntersectionObserver(function (ents) {
    ents.forEach(function (en) {
      if (!en.isIntersecting) return;
      var id = en.target.id;
      award('sec:' + id, 10, null);
      navLinks.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + id); });
    });
  }, { rootMargin: '-40% 0px -40% 0px', threshold: 0 });
  ['levels', 'games', 'clips', 'path', 'contact'].forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
}

/* ---------------- dialogs ---------------- */
function clearHash() { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
function openDlg(id) {
  var d = document.getElementById(id);
  if (!d || d.tagName !== 'DIALOG') return;
  $$('dialog[open]').forEach(function (o) { if (o !== d) o.close(); });
  if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute('open', ''); } }
  d.scrollTop = 0;
  if (id.indexOf('level-') === 0) {
    var slug = id.slice(6);
    award('lvlopen:' + slug, 30, $('.lvl[data-level="' + slug + '"] .play'));
    renderLevels();
  } else if (id.indexOf('doc-') === 0) {
    var did = id.slice(4);
    award('doc:' + did, 15, $('.doc[data-doc="' + did + '"]'));
    renderDocs();
  }
}
$$('dialog.dlg').forEach(function (d) {
  var bar = d.querySelector('.readbar i');
  var slug = d.id.indexOf('level-') === 0 ? d.id.slice(6) : null;
  d.addEventListener('scroll', function () {
    var p = d.scrollTop / Math.max(1, d.scrollHeight - d.clientHeight);
    if (bar) bar.style.width = Math.round(p * 100) + '%';
    if (slug) { var v = Math.round(p * 100); if (v > (S.prog[slug] || 0)) S.prog[slug] = v; }
  }, { passive: true });
  d.addEventListener('close', function () {
    save(); renderLevels();
    if (location.hash === '#' + d.id) clearHash();
  });
  d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  $$('[data-close]', d).forEach(function (b) { b.addEventListener('click', function () { d.close(); }); });
  var zone = d.querySelector('.clearzone');
  if (zone && slug && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (en.isIntersecting) { S.prog[slug] = 100; if (award('lvlclear:' + slug, 60, zone)) toast('✓', L('Level cleared', 'Seviye bitti'), zone.getAttribute('data-name')); renderLevels(); }
      });
    }, { root: d, threshold: 0.5 }).observe(zone);
  }
});
function route() {
  var h = decodeURIComponent(location.hash.slice(1));
  if (h === 'tr' || h === 'en') { setLang(h, false); return; }
  var d = h && document.getElementById(h);
  if (d && d.tagName === 'DIALOG') openDlg(h);
}
window.addEventListener('hashchange', route);
$$('.doc').forEach(function (b) { b.addEventListener('click', function () { var id = 'doc-' + b.getAttribute('data-doc'); if (location.hash === '#' + id) openDlg(id); else location.hash = id; }); });

/* ---------------- vault filter ---------------- */
function vaultFilter(cat) {
  $$('[data-vf]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-vf') === cat)); });
  var n = 0;
  $$('.doc').forEach(function (d) { var ok = cat === 'all' || d.getAttribute('data-cat') === cat; d.hidden = !ok; if (ok) n++; });
  return n;
}
$$('[data-vf]').forEach(function (b) { b.addEventListener('click', function () { vaultFilter(b.getAttribute('data-vf')); }); });

/* ---------------- games filter ---------------- */
function gameFilter(tag) {
  $$('[data-gf]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-gf') === tag)); });
  var n = 0;
  $$('[data-tags]').forEach(function (g) { var ok = tag === 'all' || (' ' + g.getAttribute('data-tags') + ' ').indexOf(' ' + tag + ' ') >= 0; g.hidden = !ok; if (ok && g.classList.contains('gt')) n++; if (ok && g.classList.contains('gcard')) n++; });
  $$('.gstudio').forEach(function (s) { s.classList.toggle('empty', !s.querySelector('.gt:not([hidden])')); });
  $$('[data-gn]').forEach(function (e) { e.textContent = n; });
  return n;
}
$$('[data-gf]').forEach(function (b) { b.addEventListener('click', function () { gameFilter(b.getAttribute('data-gf')); if (b.getAttribute('data-gf') !== 'all') award('filter', 15, b); }); });

/* ---------------- skills ---------------- */
$$('[data-skill]').forEach(function (b) {
  b.addEventListener('click', function () {
    $$('[data-skill]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    var nd = vaultFilter(b.getAttribute('data-vf') || 'all');
    var ng = gameFilter(b.getAttribute('data-gf') || 'all');
    var out = $('#skillOut');
    if (out) out.textContent = L('Filtered the game library to ' + ng + (ng === 1 ? ' game.' : ' games.'), 'Oyun kütüphanesi ' + ng + ' oyuna filtrelendi.');
    award('skill', 10, b);
  });
});

/* ---------------- clips ---------------- */
$$('video[data-clip]').forEach(function (v) { v.addEventListener('play', function () { award('clip:' + v.getAttribute('data-clip'), 20, v); }); });

/* ---------------- contact ---------------- */
$$('[data-copy-mail]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var mail = 'yagmurbaran@windowslive.com';
    var ok = function () {
      award('contact:mail', 30, btn);
      var en = btn.querySelector('.en'), tr = btn.querySelector('.tr'); if (!en) return;
      var o1 = en.textContent, o2 = tr.textContent; en.textContent = 'Copied ✓'; tr.textContent = 'Kopyalandı ✓';
      setTimeout(function () { en.textContent = o1; tr.textContent = o2; }, 1600);
    };
    var sel = function () { var m = btn.parentNode.querySelector('.mail'); if (m) { var r = document.createRange(); r.selectNodeContents(m); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } award('contact:mail', 30, btn); };
    try { navigator.clipboard.writeText(mail).then(ok, sel); } catch (e) { sel(); }
  });
});
$$('[data-li]').forEach(function (a) { a.addEventListener('click', function () { award('contact:linkedin', 20, a); }); });

/* ---------------- tools ---------------- */
var tools = [];
function used(id, el) { award('tool:' + id, 20, el); }
function pressed(group, btn) { $$('.seg', group).forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); }); }
function pop(el) { if (!el || reduce) return; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); setTimeout(function () { el.classList.remove('pop'); }, 260); }

// economy: squad vs cap
(function () {
  var t = $('[data-tool="eco-squad"]'); if (!t) return;
  var cap = 152.5, cur = $('.seg[aria-pressed="true"]', t);
  function draw() {
    var v = parseFloat(cur.getAttribute('data-v')), fill = $('#ecoFill'), out = $('#ecoVerdict');
    fill.style.width = (v / 200 * 100) + '%';
    fill.classList.toggle('over', v > cap); fill.style.setProperty('--capw', (cap / v * 100) + '%');
    var d = Math.abs(v - cap).toFixed(0);
    out.innerHTML = v > cap ? '<span class="over">' + L('Costs ' + d + ' more than the weekly cap.', 'Haftalık limiti ' + d + ' aşıyor.') + '</span> ' + L('Nobody can field this squad every week, and that scarcity is what keeps squad choices competitive.', 'Bu kadroyu kimse her hafta kuramıyor; kadro seçimlerini rekabetçi tutan da bu kıtlık.')
      : '<span class="under">' + L('Fits under the weekly cap with ' + d + ' to spare.', 'Haftalık limitin ' + d + ' altında kalıyor.') + '</span>';
  }
  $$('.seg', t).forEach(function (b) { b.addEventListener('click', function () { cur = b; pressed(t, b); draw(); used('eco-squad', b); }); });
  tools.push(draw); draw();
})();

// pricing sort
(function () {
  var t = $('[data-tool="pricing"]'); if (!t) return;
  var tb = $('#priceT tbody');
  function sortBy(k) {
    var rows = $$('tr', tb);
    rows.sort(function (a, b) {
      var va = k === 'val' ? a.getAttribute('data-pts') / a.getAttribute('data-px') : parseFloat(a.getAttribute('data-' + k));
      var vb = k === 'val' ? b.getAttribute('data-pts') / b.getAttribute('data-px') : parseFloat(b.getAttribute('data-' + k));
      return vb - va;
    });
    rows.forEach(function (r) { tb.appendChild(r); r.classList.remove('flash'); void r.offsetWidth; r.classList.add('flash'); });
  }
  $$('.seg', t).forEach(function (b) { b.addEventListener('click', function () { pressed(t, b); sortBy(b.getAttribute('data-sort')); used('pricing', b); }); });
  sortBy('px');
})();

// gear clicker curves
(function () {
  var t = $('[data-tool="gear"]'); if (!t) return;
  var data = JSON.parse($('#gearData').textContent), r = $('#gearR');
  function draw() {
    var l = parseInt(r.value, 10); $('#gearLv').textContent = l;
    Object.keys(data).forEach(function (k) {
      var v = data[k][l - 1], p = l > 1 ? data[k][l - 2] : null;
      $('[data-gk="' + k + '"]', t).textContent = fmt(v);
      $('[data-gx="' + k + '"]', t).textContent = p ? '×' + (v / p).toFixed(2) + ' ' + L('vs prev.', 'öncekine göre') : '';
    });
    var x = 46 + (l - 1) / 29 * 462, m = $('#gearMark'); m.setAttribute('x1', x); m.setAttribute('x2', x);
  }
  r.addEventListener('input', function () { draw(); used('gear', r); });
  tools.push(draw); draw();
})();

// coffee factory merges
(function () {
  var t = $('[data-tool="coffee"]'); if (!t) return;
  var lv = 1, base = [2, 5, 25], cost = [5, 750, 50000];
  function draw(silent) {
    $('#cfLv').textContent = lv;
    base.forEach(function (b, i) {
      var inc = b * Math.pow(5, lv - 1), el = $('[data-cf="' + i + '"]', t);
      el.textContent = fmt(inc); if (silent !== true) pop(el);
      $('[data-cfp="' + i + '"]', t).textContent = L('per seed · repays in ', 'tohum başına · geri ödeme ') + Math.ceil(cost[i] / inc) + L(' seeds', ' tohum');
    });
    $('#cfUp').disabled = lv >= 5; $('#cfDown').disabled = lv <= 1;
  }
  $('#cfUp').addEventListener('click', function () { if (lv < 5) { lv++; draw(); used('coffee', this); } });
  $('#cfDown').addEventListener('click', function () { if (lv > 1) { lv--; draw(); } });
  tools.push(function () { draw(true); }); draw(true);
})();

// missions structures
(function () {
  var t = $('[data-tool="missions"]'); if (!t) return;
  var kind = 'single', step = 0, N = { single: 1, redir: 1, locked: 3, prog: 4 };
  function draw() {
    var n = N[kind], pips = $('#msPips'), pot = $('#msPot');
    pips.innerHTML = '';
    for (var i = 0; i < n; i++) {
      var p = document.createElement('i');
      if (i < step) { p.className = 'f'; p.textContent = '✓'; }
      else if (kind === 'locked' && i > step) { p.className = 'hid'; p.textContent = '?'; }
      else p.textContent = i + 1;
      pips.appendChild(p);
    }
    if (kind === 'redir') { var g = document.createElement('i'); g.className = 'go'; g.textContent = i18n(t, 'go'); pips.appendChild(g); }
    var stars = kind === 'prog' ? step : step;
    var done = step >= n;
    var claimed = kind === 'prog' ? done : step > 0;
    pot.textContent = '★ ' + stars;
    pot.parentNode.classList.toggle('claimed', claimed);
    var rule = i18n(t, kind);
    if (kind === 'locked' && step > 0 && !done) rule += ' — ' + i18n(t, 'locked-next');
    if (claimed) rule += ' · ' + i18n(t, 'claimed') + ' ★' + stars;
    $('#msRule').textContent = rule;
    $('#msDo').disabled = done;
  }
  $$('.seg', t).forEach(function (b) { b.addEventListener('click', function () { kind = b.getAttribute('data-ms'); step = 0; pressed(t, b); draw(); }); });
  $('#msDo').addEventListener('click', function () { step++; draw(); pop($('#msPot')); used('missions', this); });
  $('#msReset').addEventListener('click', function () { step = 0; draw(); });
  tools.push(draw); draw();
})();

// cup progression
(function () {
  var t = $('[data-tool="cup"]'); if (!t) return;
  var box = $('#cupBars'), model = 'mvp';
  function draw() {
    var v = JSON.parse(box.getAttribute('data-' + model));
    box.innerHTML = '';
    v.forEach(function (c, i) {
      var ratio = c / v[0], w = Math.max(2, Math.log(ratio) / Math.log(200) * 100);
      var row = document.createElement('div'); row.className = 'cb ' + model;
      row.innerHTML = '<span></span><div class="trk"><i style="width:0"></i></div><b></b>';
      row.firstChild.textContent = i18n(t, 'tier') + ' ' + (i + 1);
      row.lastChild.textContent = '×' + (ratio < 10 ? ratio.toFixed(2) : Math.round(ratio));
      box.appendChild(row);
      var bar = row.querySelector('i');
      requestAnimationFrame(function () { bar.style.width = (ratio <= 1 ? 2 : w) + '%'; });
    });
    $('#cupVerdict').textContent = i18n(t, model);
  }
  $$('.seg', t).forEach(function (b) { b.addEventListener('click', function () { model = b.getAttribute('data-cup'); pressed(t, b); draw(); used('cup', b); }); });
  tools.push(draw); draw();
})();

// reward simulation stepper
(function () {
  var t = $('[data-tool="sim"]'); if (!t) return;
  var rows = $$('.sim-row', t), k = 0;
  function draw() { rows.forEach(function (r, i) { r.hidden = i >= k; }); $('#simCount').textContent = k + ' / ' + rows.length; $('#simNext').disabled = k >= rows.length; }
  $('#simNext').addEventListener('click', function () { if (k < rows.length) { k++; draw(); var r = rows[k - 1]; r.classList.add('flash'); used('sim', this); } });
  $('#simReset').addEventListener('click', function () { k = 0; draw(); });
  tools.push(draw); draw();
})();

// points calculator
(function () {
  var t = $('[data-tool="points"]'); if (!t) return;
  var P = {"goal": [5, 6, 8, 10], "assist": [3, 3, 4, 8], "min60": [4, 4, 4, 4], "minlt60": [2, 2, 2, 2], "yellow": [-1, -1, -1, -1], "red": [-4, -4, -4, -4], "win": [1, 1, 1, 1], "loss": [-1, -1, -1, -1], "hattrick": [2, 2, 2, 2], "def_cs": [0, 0, 3, 0], "def_2conc": [0, 0, -1, 0], "gk_cs": [0, 0, 0, 5], "gk_conc": [0, 0, 0, -1], "gk_3saves": [0, 0, 0, 1]}, pos = 0;
  function num(id) { var v = parseInt($('#' + id).value, 10); return isNaN(v) || v < 0 ? 0 : v; }
  function draw(silent) {
    var g = num('ptGoals'), a = num('ptAst'), c = num('ptConc'), s = num('ptSaves');
    var m60 = $('#ptMin').value === '60', res = $('#ptRes').value;
    var items = [];
    function add(k, v) { if (v) items.push([k, v]); }
    add('goal', g * P.goal[pos]); add('assist', a * P.assist[pos]);
    add('min', m60 ? P.min60[pos] : P.minlt60[pos]);
    add('res', res === 'w' ? P.win[pos] : res === 'l' ? P.loss[pos] : 0);
    if (g >= 3) add('hat', P.hattrick[pos]);
    if (pos === 2) { if (c === 0 && m60) add('cs', P.def_cs[pos]); if (c >= 2) add('conc', P.def_2conc[pos]); }
    if (pos === 3) { if (c === 0) add('cs', P.gk_cs[pos]); add('conc', c * P.gk_conc[pos]); add('saves', Math.floor(s / 3) * P.gk_3saves[pos]); }
    add('card', ($('#ptY').checked ? P.yellow[pos] : 0) + ($('#ptR').checked ? P.red[pos] : 0));
    var tot = items.reduce(function (x, i) { return x + i[1]; }, 0);
    var cap = $('#ptC').checked;
    if (cap) items.push(['cap', tot]);
    var out = $('#ptOut'); out.textContent = cap ? tot * 2 : tot; if (silent !== true) pop(out);
    var ul = $('#ptBreak'); ul.innerHTML = '';
    items.forEach(function (i) { var li = document.createElement('li'); li.innerHTML = '<span></span><b></b>'; li.firstChild.textContent = i18n(t, i[0]); li.lastChild.textContent = (i[1] > 0 ? '+' : '') + i[1]; ul.appendChild(li); });
    $('.gk-only', t).hidden = pos !== 3;
  }
  $$('#ptPos .seg').forEach(function (b) { b.addEventListener('click', function () { pos = parseInt(b.getAttribute('data-pos'), 10); pressed($('#ptPos'), b); draw(); used('points', b); }); });
  $$('input, select', t).forEach(function (e) { e.addEventListener('input', function () { draw(); used('points', e); }); e.addEventListener('change', function () { draw(); }); });
  tools.push(function () { draw(true); }); draw(true);
})();

// quiz scoring
(function () {
  var t = $('[data-tool="quiz"]'); if (!t) return;
  var m = 1, r = $('#qzR');
  function draw(silent) {
    var s = parseFloat(r.value), raw = 100 * m, sc = Math.round(raw + raw * 2.5 / s);
    $('#qzT').textContent = s.toFixed(1); var o = $('#qzOut'); o.textContent = sc; if (silent !== true) pop(o);
  }
  $$('#qzDiff .seg').forEach(function (b) { b.addEventListener('click', function () { m = parseFloat(b.getAttribute('data-m')); pressed($('#qzDiff'), b); draw(); used('quiz', b); }); });
  r.addEventListener('input', function () { draw(); used('quiz', r); });
  tools.push(function () { draw(true); }); draw(true);
})();

// core loop
(function () {
  var t = $('[data-tool="loop"]'); if (!t) return;
  var li = $$('#loopRing li'), i = 0, lap = 1;
  function draw() { li.forEach(function (x, j) { x.classList.toggle('on', j === i); }); $('#loopLap').textContent = L('Lap ', 'Tur ') + lap; }
  $('#loopNext').addEventListener('click', function () { i = (i + 1) % li.length; if (i === 0) lap++; draw(); used('loop', this); });
  tools.push(draw); draw();
})();

// gdd template accordion
$$('[data-tool="gddt"] details').forEach(function (d) { d.addEventListener('toggle', function () { if (d.open) used('gddt', d); }); });

// risk matrix
(function () {
  var t = $('[data-tool="risk"]'); if (!t) return;
  $$('.rdot', t).forEach(function (b) {
    b.addEventListener('click', function () {
      var n = b.getAttribute('data-r');
      $$('.rdot', t).forEach(function (x) { x.classList.toggle('on', x === b); });
      $$('.rdet', t).forEach(function (d) { d.hidden = d.getAttribute('data-r') !== n; });
      $('.rhint', t).hidden = true;
      used('risk', b);
    });
  });
})();

// aetheria reward calculator (inside level 3)
(function () {
  if (!document.getElementById('aKills')) return;
  var ids = ['aKills', 'aDeaths', 'aAssists', 'aMaxD', 'aWin'];
  function num(id) { var v = parseInt(document.getElementById(id).value, 10); return isNaN(v) || v < 0 ? 0 : v; }
  function calc() {
    var k = num('aKills'), d = num('aDeaths'), a = num('aAssists'), mx = Math.max(num('aMaxD'), d);
    var win = document.getElementById('aWin').checked;
    document.getElementById('aDP').textContent = k + (mx - d) + a + (win ? 10 : 0);
    document.getElementById('aSh').textContent = (5 + k * 2 + (mx - d) * 2 + a) * (win ? 2 : 1);
  }
  ids.forEach(function (id) { var el = document.getElementById(id); el.addEventListener('input', function () { calc(); used('aetheria', el); }); el.addEventListener('change', calc); });
  calc();
})();

/* ---------------- init ---------------- */
var lang = 'en';
try { var sv = localStorage.getItem('yb-lang'); if (sv === 'tr' || sv === 'en') lang = sv; } catch (e) {}
var h0 = location.hash.slice(1); if (h0 === 'tr' || h0 === 'en') lang = h0;
$$('[data-set-lang]').forEach(function (b) { b.addEventListener('click', function () { var l = b.getAttribute('data-set-lang'); if (l !== root.getAttribute('data-lang')) setLang(l, true); }); });
setLang(lang, false);
checkAch();
route();
})();
