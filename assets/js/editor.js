/* Page editor: owner only, for preparing the content before the portfolio goes public.
 *
 * Turn it off before publishing: delete the
 *   <script src="assets/js/editor.js" defer></script>
 * line in index.html. Nothing else depends on this file.
 *
 * Where it runs
 *  - In the claude.ai artifact: only the artifact's owner sees the editor.
 *    "Save" publishes the edited page as a new version of the artifact.
 *  - As a local file (file://, localhost): "Save" downloads the updated index.html.
 *  - Anywhere else (a public host): it does nothing.
 *
 * How saving works
 *  Before main.js runs, the editor keeps an untouched copy of the page source.
 *  Edits are written into that copy and the saved file is rebuilt from it, so
 *  runtime state (XP, open dialogs, filters, editor UI) never ends up in the file.
 */
(function () {
'use strict';

var doc = document, root = doc.documentElement;
var inArtifact = !!(window.claude && typeof window.claude.use === 'function');
var isLocal = !inArtifact && (location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname));
if (!inArtifact && !isLocal) return;

// The document shape the Artifact tool publishes (charset, viewport and the small reset).
var SKELETON = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  '<style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}' +
  'html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}' +
  'img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>';
var RESUME_KEY = 'yb-editor-resume';

function $(s, c) { return (c || doc).querySelector(s); }
function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function oneLine(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

/* ---------- untouched copy of the page ---------- */
var inert = doc.implementation.createHTMLDocument('');
var src = inert.importNode(root, true);
var twin = new WeakMap();                       // live element -> its copy
function pair(a, b) {
  twin.set(a, b);
  for (var i = 0, ca = a.children, cb = b.children; i < ca.length && i < cb.length; i++) pair(ca[i], cb[i]);
}
pair(root, src);

var box = inert.createElement('div');
function serialize(node) { box.textContent = ''; box.appendChild(node.cloneNode(true)); return box.innerHTML; }
function clean(html) {
  box.innerHTML = html;
  $$('br', box).forEach(function (b) { b.remove(); });
  var w = inert.createTreeWalker(box, NodeFilter.SHOW_TEXT), t;
  while ((t = w.nextNode())) t.nodeValue = t.nodeValue.replace(/ /g, ' ');
  return box.innerHTML;
}
function fromHTML(d, html) { var t = d.createElement('template'); t.innerHTML = html; return t.content.firstElementChild; }

/* ---------- resume after a save (the artifact reloads itself) ---------- */
var resume = null;
try { resume = JSON.parse(sessionStorage.getItem(RESUME_KEY) || 'null'); sessionStorage.removeItem(RESUME_KEY); } catch (e) {}
if (resume && resume.dlg && !location.hash) { try { history.replaceState(null, '', '#' + resume.dlg); } catch (e) {} }

/* ---------- which text is editable ---------- */
// Skipped: game-system UI that main.js renders, charts drawn from data, form controls,
// the hidden Turkish copies, and the games list (edited through the game panel).
var SKIP = 'script,style,title,svg,video,select,option,input,textarea,.tr,.xpbtn,.lang,#questPanel,.quests,' +
  '.qc-foot,.state,.gfeatured,.gtiles,.axis,.ticks,.cells,.marks,.bar-row .val,.rrow .val,.calc-out b,#skillOut,' +
  '.dlg-bar .close,#toasts,.meter,.readbar,.flow .arrow,.yb-ed';
var HOOKS = '[data-lv],[data-lvname],[data-nextlv],[data-xpnow],[data-xpnext],[data-achn],[data-gn]';
var leaves = [];
function ownText(el) { for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && /\S/.test(n.nodeValue)) return true; return false; }
function scan(el) {
  if (el.matches(SKIP)) return;
  if (ownText(el) && !el.querySelector(HOOKS)) {
    el.setAttribute('data-yb-t', el.closest('a, button') ? 'ctl' : 'text');
    leaves.push(el);
    if (editing) setLeafEditable(el, true);
    return;
  }
  for (var c = el.firstElementChild; c; c = c.nextElementSibling) scan(c);
}

/* ---------- state ---------- */
var editing = false, saving = false, artifactNS = null, started = false;
var dirtyText = new Set(), dirtyHref = new Map(), structural = 0;
function changeCount() { return dirtyText.size + dirtyHref.size + structural; }
var plainOK = (function () { var d = doc.createElement('div'); try { d.contentEditable = 'plaintext-only'; } catch (e) { return false; } return d.contentEditable === 'plaintext-only'; })();

function setLeafEditable(el, on) {
  if (el.getAttribute('data-yb-t') !== 'text') return;
  if (on) { el.contentEditable = plainOK ? 'plaintext-only' : 'true'; } else el.removeAttribute('contenteditable');
}
function markText(el) { if (!dirtyText.has(el)) { dirtyText.add(el); el.classList.add('yb-dirty'); } renderBar(); }
function gamesChanged() { structural++; doc.dispatchEvent(new CustomEvent('yb:games')); renderBar(); }

/* ---------- build the saved document ---------- */
function commit() {
  dirtyText.forEach(function (el) { var t = twin.get(el); if (t) t.innerHTML = clean(el.innerHTML); });
  dirtyHref.forEach(function (href, a) {
    var t = twin.get(a); if (!t) return;
    t.setAttribute('href', href);
    if (/^https?:/i.test(href)) { t.setAttribute('target', '_blank'); t.setAttribute('rel', 'noopener'); }
    else { t.removeAttribute('target'); t.removeAttribute('rel'); }
  });
  var gn = $('[data-gn]', src);
  if (gn) gn.textContent = $$('.gfeatured .gcard, .gtiles .gt', src).length;
}
function buildDocument(mode) {
  commit();
  var body = $('body', src);
  if (mode === 'artifact') {
    var out = '', on = false, done = false;
    for (var n = body.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 8 && n.nodeValue === 'page:start') on = true;
      var foreign = n.nodeType === 1 && n.tagName === 'SCRIPT' && !/^assets\//.test(n.getAttribute('src') || '');
      if (on && !foreign) out += serialize(n);
      if (n.nodeType === 8 && n.nodeValue === 'page:end') { done = true; break; }
    }
    if (!on || !done) return null;
    return SKELETON + '\n' + out + '\n</body></html>';
  }
  return '<!doctype html>\n<html lang="en" data-lang="en">\n<head>' + $('head', src).innerHTML.replace(/\s*$/, '\n') +
    '</head>\n<body>' + body.innerHTML.replace(/\s*$/, '\n') + '</body>\n</html>\n';
}
function looksComplete(html) { return !!html && html.indexOf('<main') > 0 && html.indexOf('assets/js/main.js') > 0 && html.indexOf('</footer>') > 0; }

/* ---------- editor bar ---------- */
var bar, statusEl, statusNote = '', statusErr = false;
function buildBar() {
  bar = fromHTML(doc, '<div class="yb-ed yb-bar" role="region" aria-label="Page editor">' +
    '<button type="button" class="yb-btn" data-act="toggle"></button>' +
    '<span class="yb-status" aria-live="polite"></span>' +
    '<button type="button" class="yb-btn" data-act="discard" hidden>Discard</button>' +
    '<button type="button" class="yb-btn yb-primary" data-act="save" hidden></button></div>');
  statusEl = $('.yb-status', bar);
  bar.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'toggle') setEditing(!editing);
    else if (act === 'save') save();
    else if (act === 'discard') discard(b);
  });
  doc.body.appendChild(bar);
  // a modal dialog makes the rest of the page inert, so the bar moves into the open dialog
  var mo = new MutationObserver(function () {
    var d = $('dialog[open]');
    (d || doc.body).appendChild(bar);
    if (panel && !panel.hidden && d) closePanel();
    if (pop && !pop.hidden && pop.parentNode !== (d || doc.body)) closePop();
  });
  $$('dialog').forEach(function (d) { mo.observe(d, { attributes: true, attributeFilter: ['open'] }); });
}
function note(text, isErr) { statusNote = text || ''; statusErr = !!isErr; renderBar(); }
function renderBar() {
  if (!bar) return;
  var n = changeCount();
  var t = $('[data-act="toggle"]', bar), s = $('[data-act="save"]', bar), d = $('[data-act="discard"]', bar);
  t.textContent = editing ? 'Preview' : '✎ Edit page';
  t.classList.toggle('yb-gold', !editing);
  s.textContent = saving ? 'Saving…' : (inArtifact ? 'Save' : 'Download index.html');
  s.hidden = d.hidden = n === 0 && !saving;
  s.disabled = d.disabled = saving;
  var msg = statusNote || (n ? n + (n === 1 ? ' unsaved change' : ' unsaved changes') : (editing ? 'Click any text to edit it.' : ''));
  statusEl.textContent = msg;
  statusEl.hidden = !msg;
  statusEl.classList.toggle('err', statusErr);
}

function setEditing(on) {
  editing = on;
  root.classList.toggle('yb-editing', on);
  leaves.forEach(function (el) { setLeafEditable(el, on); });
  if (on) { addGameControls(); doc.dispatchEvent(new CustomEvent('yb:games', { detail: { filter: 'all' } })); }
  else { closePop(); closePanel(); if (doc.activeElement && doc.activeElement.blur) doc.activeElement.blur(); }
  statusNote = '';
  renderBar();
}

function openDialogState() {
  var d = $('dialog[open]');
  return d ? { dlg: d.id, dy: d.scrollTop } : {};
}
function stash(extra) {
  var st = openDialogState();
  st.y = window.scrollY; st.editing = editing;
  for (var k in extra) st[k] = extra[k];
  try { sessionStorage.setItem(RESUME_KEY, JSON.stringify(st)); } catch (e) {}
}

function save() {
  if (saving || !changeCount()) return;
  if (pop && !pop.hidden) applyPop();
  var html = buildDocument(inArtifact ? 'artifact' : 'local');
  if (!looksComplete(html)) { note('Could not build the page to save. Nothing was changed.', true); return; }
  if (!inArtifact) {
    var a = doc.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = 'index.html';
    doc.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    dirtyText.forEach(function (el) { el.classList.remove('yb-dirty'); });
    dirtyText.clear(); dirtyHref.clear(); structural = 0;
    note('Downloaded index.html. Put it in the project folder to keep the changes.');
    return;
  }
  saving = true; statusNote = ''; renderBar();
  stash({ saved: true });
  artifactNS.publish(html).then(function () {
    note('Saved. Reloading…');           // every open view reloads to the new version
  }, function (err) {
    saving = false;
    var code = err && err.code;
    if (code === 'conflict') { note('A newer version was saved elsewhere. The page is reloading to it.', true); return; }
    try { sessionStorage.removeItem(RESUME_KEY); } catch (e) {}
    var msg = {
      not_writer: 'This view can’t save changes.', not_granted: 'This view can’t save changes.',
      not_declared: 'Saving is turned off for this page.', consent_required: 'This view can’t save changes.',
      too_large: 'The page is too large to save.', rate_limited: 'Saving too often. Wait a minute, then save again.',
      invalid_content: 'The page could not be saved because it is incomplete.'
    }[code] || 'Couldn’t save (' + (code || 'unknown error') + '). Try again.';
    note(msg, true);
  });
}

var discardArmed = null;
function discard(btn) {
  if (!discardArmed) {
    btn.textContent = 'Click again to discard';
    discardArmed = setTimeout(function () { discardArmed = null; btn.textContent = 'Discard'; }, 3000);
    return;
  }
  clearTimeout(discardArmed); discardArmed = null;
  dirtyText.clear(); dirtyHref.clear(); structural = 0;
  stash({});
  location.reload();
}

window.addEventListener('beforeunload', function (e) {
  if (started && changeCount() && !saving) { e.preventDefault(); e.returnValue = ''; }
});

/* ---------- inline text ---------- */
var bypass = false;
doc.addEventListener('click', function (e) {
  if (!editing || bypass) return;
  var t = e.target;
  if (!(t instanceof Element) || t.closest('.yb-ed')) return;
  if (pop && !pop.hidden) closePop();
  var game = t.closest('.gfeatured .gcard, .gtiles .gt');
  if (game) { e.preventDefault(); e.stopPropagation(); openPanel({ el: game }); return; }
  var leaf = t.closest('[data-yb-t]');
  if (!leaf) return;
  if (leaf.getAttribute('data-yb-t') === 'ctl') { e.preventDefault(); e.stopPropagation(); openPop(leaf); return; }
  if (leaf.closest('label, summary')) e.preventDefault();
}, true);

function textLeaf(e) { return editing && e.target instanceof Element ? e.target.closest('[data-yb-t="text"]') : null; }
doc.addEventListener('keydown', function (e) {
  var leaf = textLeaf(e); if (!leaf) return;
  if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); leaf.blur(); }
}, true);
doc.addEventListener('input', function (e) { var leaf = textLeaf(e); if (leaf) markText(leaf); }, true);
doc.addEventListener('paste', function (e) {
  var leaf = textLeaf(e); if (!leaf) return;
  e.preventDefault();
  var text = ((e.clipboardData && e.clipboardData.getData('text/plain')) || '').replace(/\s+/g, ' ');
  doc.execCommand('insertText', false, text);
}, true);
doc.addEventListener('drop', function (e) { if (textLeaf(e)) e.preventDefault(); }, true);

/* ---------- buttons and links: small edit popover ---------- */
var pop, popLeaf = null;
function buildPop() {
  pop = fromHTML(doc, '<div class="yb-ed yb-pop" role="dialog" aria-label="Edit label" hidden>' +
    '<label class="yb-f" for="ybPopText">Text<input id="ybPopText" type="text" autocomplete="off"></label>' +
    '<label class="yb-f" for="ybPopUrl" data-k="url">Link<input id="ybPopUrl" type="url" autocomplete="off" placeholder="https://"></label>' +
    '<p class="yb-err" data-k="err"></p>' +
    '<div class="yb-row"><button type="button" class="yb-btn" data-act="follow"></button><span class="yb-sp"></span>' +
    '<button type="button" class="yb-btn" data-act="cancel">Cancel</button><button type="button" class="yb-btn yb-primary" data-act="apply">Apply</button></div></div>');
  pop.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'apply') applyPop();
    else if (act === 'cancel') closePop();
    else if (act === 'follow') { var ctl = popLeaf && popLeaf.closest('a, button'); closePop(); if (ctl) { bypass = true; try { ctl.click(); } finally { bypass = false; } } }
  });
  pop.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); applyPop(); }
    else if (e.key === 'Escape') { e.preventDefault(); closePop(); }
  });
}
function openPop(leaf) {
  if (!pop) buildPop();
  popLeaf = leaf;
  var a = leaf.closest('a'), href = a ? (a.getAttribute('href') || '') : '';
  var external = !!a && href.charAt(0) !== '#';
  $('#ybPopText', pop).value = oneLine(leaf.textContent);
  $('[data-k="url"]', pop).hidden = !external;
  $('#ybPopUrl', pop).value = external ? href : '';
  $('[data-k="err"]', pop).textContent = '';
  $('[data-act="follow"]', pop).textContent = a ? (external ? 'Open link ↗' : 'Go there ▸') : 'Press button ▸';
  (leaf.closest('dialog') || doc.body).appendChild(pop);
  pop.hidden = false;
  var r = leaf.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  var left = Math.min(Math.max(12, r.left), window.innerWidth - w - 12);
  var top = r.bottom + 8; if (top + h > window.innerHeight - 12) top = Math.max(12, r.top - h - 8);
  pop.style.left = left + 'px'; pop.style.top = top + 'px';
  var input = $('#ybPopText', pop); input.focus(); input.select();
}
function closePop() { if (pop) pop.hidden = true; popLeaf = null; }
function applyPop() {
  if (!popLeaf) return;
  var leaf = popLeaf, err = $('[data-k="err"]', pop);
  var text = oneLine($('#ybPopText', pop).value);
  if (!text) { err.textContent = 'Add some text.'; return; }
  var a = leaf.closest('a');
  if (a && !$('[data-k="url"]', pop).hidden) {
    var url = $('#ybPopUrl', pop).value.trim();
    if (!/^https?:\/\/\S+$/i.test(url) && !/^mailto:\S+$/i.test(url)) { err.textContent = 'Links start with https://'; return; }
    if (url !== a.getAttribute('href')) { a.setAttribute('href', url); dirtyHref.set(a, url); }
  }
  if (text !== oneLine(leaf.textContent)) {
    if (leaf.children.length) {
      for (var n = leaf.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && /\S/.test(n.nodeValue)) { n.nodeValue = text; break; }
    } else leaf.textContent = text;
    markText(leaf);
  }
  closePop(); renderBar();
}

/* ---------- games ---------- */
function categories() {
  return $$('.filters [data-gf]').filter(function (b) { return b.getAttribute('data-gf') !== 'all'; })
    .map(function (b) { return { id: b.getAttribute('data-gf'), label: oneLine(($('.en', b) || b).textContent) }; });
}
function readTile(el) {
  var name = '', small = $('small', el);
  for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3) name += n.nodeValue;
  var en = small && $('.en', small), tr = small && $('.tr', small);
  return {
    kind: 'tile', name: oneLine(name),
    desc: oneLine(en ? en.textContent : (small ? small.textContent : '')), descTr: tr ? tr.textContent : null,
    href: el.tagName === 'A' ? (el.getAttribute('href') || '') : '',
    tags: (el.getAttribute('data-tags') || '').split(/\s+/).filter(Boolean)
  };
}
function readCard(el) {
  var chip = $('.chip', el), pen = $(':scope > p.en', el), ptr = $(':scope > p.tr', el);
  return {
    kind: 'card', studio: oneLine(($('.s', el) || {}).textContent), name: oneLine(($('h3', el) || {}).textContent),
    chip: chip ? oneLine(($('.en', chip) || chip).textContent) : '', chipTr: chip && $('.tr', chip) ? $('.tr', chip).textContent : null,
    desc: pen ? oneLine(pen.textContent) : '', descTr: ptr ? ptr.textContent : null,
    links: $$('.glinks a', el).map(function (a) { return { label: oneLine(a.textContent.replace(/↗\s*$/, '')), href: a.getAttribute('href') || '' }; }),
    tags: (el.getAttribute('data-tags') || '').split(/\s+/).filter(Boolean)
  };
}
function linkAttrs(href) { return 'href="' + esc(href) + '"' + (/^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : ''); }
function tileHTML(m) {
  var tags = ' data-tags="' + esc(m.tags.join(' ')) + '"';
  var inner = esc(m.name) + (m.desc ? '<small><span class="en">' + esc(m.desc) + '</span>' + (m.descTr != null ? '<span class="tr">' + esc(m.descTr) + '</span>' : '') + '</small>' : '');
  if (!m.href) return '<span class="gt"' + tags + '>' + inner + '</span>';
  var clip = /^#clip-/.test(m.href) ? '<span class="vid">▶ <span class="en">clip</span><span class="tr">video</span></span>' : '';
  return '<a class="gt" ' + linkAttrs(m.href) + tags + '>' + inner + clip + '</a>';
}
function cardHTML(m) {
  return '<div class="gcard f" data-tags="' + esc(m.tags.join(' ')) + '">' +
    (m.studio ? '<span class="s">' + esc(m.studio) + '</span>' : '') + '<h3>' + esc(m.name) + '</h3>' +
    (m.chip ? '<span class="chip" style="justify-self:start"><span class="en">' + esc(m.chip) + '</span>' + (m.chipTr != null ? '<span class="tr">' + esc(m.chipTr) + '</span>' : '') + '</span>' : '') +
    (m.desc ? '<p class="en">' + esc(m.desc) + '</p>' + (m.descTr != null ? '<p class="tr">' + esc(m.descTr) + '</p>' : '') : '') +
    (m.links.length ? '<div class="glinks">' + m.links.map(function (l) { return '<a ' + linkAttrs(l.href) + '>' + esc(l.label) + ' ↗</a>'; }).join('') + '</div>' : '') +
    '</div>';
}
function insertLive(container, el, before) { container.insertBefore(el, before || null); }
function putGame(html, oldLive, container) {
  var live = fromHTML(doc, html), copy = fromHTML(inert, html);
  if (oldLive) { var oc = twin.get(oldLive); oldLive.replaceWith(live); if (oc) oc.replaceWith(copy); }
  else { insertLive(container, live, $(':scope > .yb-add', container)); twin.get(container).appendChild(copy); }
  pair(live, copy);
  return live;
}
function removeGame(el) { var c = twin.get(el); el.remove(); if (c) c.remove(); }

var STUDIO_HTML = '<div class="gstudio"><div><h4>New studio</h4><div class="y">Years · <span class="en">Your role</span></div></div><div class="gtiles"></div></div>';
function addStudio(btn) {
  var list = $('.gstudios'), live = fromHTML(doc, STUDIO_HTML), copy = fromHTML(inert, STUDIO_HTML);
  list.insertBefore(live, btn); twin.get(list).appendChild(copy); pair(live, copy);
  scan(live); studioControls(live);
  gamesChanged();
  var h = $('h4', live); h.focus();
  var r = doc.createRange(); r.selectNodeContents(h); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
}
function studioControls(studio) {
  var tiles = $('.gtiles', studio);
  if (tiles && !$(':scope > .yb-add', tiles)) tiles.appendChild(fromHTML(doc, '<button type="button" class="yb-ed yb-add" data-add="tile">+ Add game</button>'));
  var head = studio.firstElementChild;
  if (head && !$('.yb-studio-x', head)) head.appendChild(fromHTML(doc, '<button type="button" class="yb-ed yb-studio-x">Remove studio</button>'));
}
var controlsAdded = false;
function addGameControls() {
  if (controlsAdded) return; controlsAdded = true;
  $$('.gstudio').forEach(studioControls);
  var feat = $('.gfeatured');
  if (feat) feat.appendChild(fromHTML(doc, '<button type="button" class="yb-ed yb-add yb-add-card" data-add="card">+ Add featured game</button>'));
  var list = $('.gstudios');
  if (list) list.appendChild(fromHTML(doc, '<button type="button" class="yb-ed yb-add yb-add-studio" data-add="studio">+ Add studio</button>'));
}
doc.addEventListener('click', function (e) {
  if (!editing || !(e.target instanceof Element)) return;
  var add = e.target.closest('.yb-add');
  if (add) {
    var kind = add.getAttribute('data-add');
    if (kind === 'studio') addStudio(add);
    else openPanel({ kind: kind, container: add.parentNode });
    return;
  }
  var x = e.target.closest('.yb-studio-x');
  if (x) {
    if (!x.dataset.armed) {
      var n = $$('.gt', x.closest('.gstudio')).length;
      x.dataset.armed = '1'; x.textContent = n ? 'Click again to remove the studio and its ' + n + (n === 1 ? ' game' : ' games') : 'Click again to remove';
      setTimeout(function () { if (x.isConnected) { delete x.dataset.armed; x.textContent = 'Remove studio'; } }, 3500);
      return;
    }
    removeGame(x.closest('.gstudio')); gamesChanged();
  }
});

/* ---------- game panel ---------- */
var panel, panelCtx = null;
function buildPanel() {
  panel = fromHTML(doc, '<div class="yb-ed yb-panel" role="dialog" aria-labelledby="ybPanelT" hidden>' +
    '<div class="yb-ph"><b id="ybPanelT">Edit game</b><button type="button" class="yb-x" data-act="cancel" aria-label="Close">✕</button></div>' +
    '<label class="yb-f" for="ybStudio" data-k="card">Studio label<input id="ybStudio" type="text" autocomplete="off" placeholder="Rune Games"></label>' +
    '<label class="yb-f" for="ybName">Game name<input id="ybName" type="text" autocomplete="off"></label>' +
    '<label class="yb-f" for="ybChip" data-k="card">Type label<input id="ybChip" type="text" autocomplete="off" placeholder="Card strategy · prototype"></label>' +
    '<label class="yb-f" for="ybDesc">Description<textarea id="ybDesc" rows="2"></textarea></label>' +
    '<label class="yb-f" for="ybHref" data-k="tile">Link<input id="ybHref" type="url" autocomplete="off" placeholder="https://apps.apple.com/app/…"><span class="yb-hint">Store page or any https:// address. Leave empty for no link.</span></label>' +
    '<div class="yb-f" data-k="card"><span>Links</span><div class="yb-links" id="ybLinks"></div><button type="button" class="yb-btn yb-small" data-act="addlink">+ Add link</button></div>' +
    '<fieldset class="yb-f"><legend>Shown under these filters</legend><div class="yb-tags" id="ybTags"></div></fieldset>' +
    '<p class="yb-err" data-k="err"></p>' +
    '<div class="yb-row"><button type="button" class="yb-btn yb-danger" data-act="delete">Remove game</button><span class="yb-sp"></span>' +
    '<button type="button" class="yb-btn" data-act="cancel">Cancel</button><button type="button" class="yb-btn yb-primary" data-act="apply">Apply</button></div></div>');
  panel.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'apply') applyPanel();
    else if (act === 'cancel') closePanel();
    else if (act === 'delete') deleteFromPanel(b);
    else if (act === 'addlink') addLinkRow({ label: '', href: '' }, true);
    else if (act === 'droplink') b.closest('.yb-link').remove();
  });
  panel.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); closePanel(); }
    else if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); applyPanel(); }
  });
  doc.body.appendChild(panel);
}
var linkSeq = 0;
function addLinkRow(l, focus) {
  var i = ++linkSeq;
  var row = fromHTML(doc, '<div class="yb-link">' +
    '<input type="text" id="ybLinkL' + i + '" aria-label="Link label" placeholder="App Store" autocomplete="off">' +
    '<input type="url" id="ybLinkU' + i + '" aria-label="Link address" placeholder="https://" autocomplete="off">' +
    '<button type="button" class="yb-x" data-act="droplink" aria-label="Remove link">✕</button></div>');
  row.children[0].value = l.label; row.children[1].value = l.href;
  $('#ybLinks', panel).appendChild(row);
  if (focus) row.children[0].focus();
}
function openPanel(ctx) {
  if (!panel) buildPanel();
  closePop();
  var kind = ctx.el ? (ctx.el.classList.contains('gcard') ? 'card' : 'tile') : ctx.kind;
  var m = ctx.el ? (kind === 'card' ? readCard(ctx.el) : readTile(ctx.el))
    : { kind: kind, studio: '', name: '', chip: '', chipTr: null, desc: '', descTr: null, href: '', links: [], tags: [] };
  panelCtx = { kind: kind, el: ctx.el || null, container: ctx.container || null, model: m };
  $('#ybPanelT', panel).textContent = ctx.el ? 'Edit game' : (kind === 'card' ? 'Add featured game' : 'Add game');
  $$('[data-k="card"]', panel).forEach(function (r) { r.hidden = kind !== 'card'; });
  $$('[data-k="tile"]', panel).forEach(function (r) { r.hidden = kind !== 'tile'; });
  $('#ybStudio', panel).value = m.studio || '';
  $('#ybName', panel).value = m.name;
  $('#ybChip', panel).value = m.chip || '';
  $('#ybDesc', panel).value = m.desc;
  $('#ybDesc', panel).rows = kind === 'card' ? 5 : 2;
  $('#ybHref', panel).value = m.href || '';
  $('#ybLinks', panel).textContent = '';
  (m.links || []).forEach(function (l) { addLinkRow(l, false); });
  var tags = $('#ybTags', panel); tags.textContent = '';
  categories().forEach(function (c) {
    var lab = fromHTML(doc, '<label><input type="checkbox" id="ybTag-' + esc(c.id) + '" value="' + esc(c.id) + '"><span></span></label>');
    lab.querySelector('span').textContent = c.label;
    lab.querySelector('input').checked = m.tags.indexOf(c.id) >= 0;
    tags.appendChild(lab);
  });
  var del = $('[data-act="delete"]', panel); del.hidden = !ctx.el; delete del.dataset.armed; del.textContent = 'Remove game';
  $('[data-k="err"]', panel).textContent = '';
  $$('.yb-picked').forEach(function (g) { g.classList.remove('yb-picked'); });
  if (ctx.el) ctx.el.classList.add('yb-picked');
  panel.hidden = false;
  $('#ybName', panel).focus();
}
function closePanel() {
  if (panel) panel.hidden = true;
  $$('.yb-picked').forEach(function (g) { g.classList.remove('yb-picked'); });
  panelCtx = null;
}
function validUrl(u) { return /^https?:\/\/\S+$/i.test(u) || /^#[\w-]+$/.test(u); }
function applyPanel() {
  if (!panelCtx) return;
  var c = panelCtx, old = c.model, err = $('[data-k="err"]', panel);
  var m = {
    kind: c.kind, studio: oneLine($('#ybStudio', panel).value), name: oneLine($('#ybName', panel).value),
    chip: oneLine($('#ybChip', panel).value), chipTr: old.chipTr, desc: oneLine($('#ybDesc', panel).value), descTr: old.descTr,
    href: $('#ybHref', panel).value.trim(), links: [],
    tags: $$('#ybTags input:checked', panel).map(function (i) { return i.value; })
  };
  if (!m.name) { err.textContent = 'Add the game’s name.'; $('#ybName', panel).focus(); return; }
  if (c.kind === 'tile' && m.href && !validUrl(m.href)) { err.textContent = 'Links start with https://'; $('#ybHref', panel).focus(); return; }
  var bad = null;
  $$('.yb-link', panel).forEach(function (row) {
    var label = oneLine(row.children[0].value), href = row.children[1].value.trim();
    if (!label && !href) return;
    if (!label || !validUrl(href)) { bad = bad || row; return; }
    m.links.push({ label: label, href: href });
  });
  if (c.kind === 'card' && bad) { err.textContent = 'Each link needs a label and an address that starts with https://'; bad.children[label0(bad)].focus(); return; }
  if (!m.tags.length) { err.textContent = 'Pick at least one filter so the game shows up when people filter the list.'; return; }
  var html = c.kind === 'card' ? cardHTML(m) : tileHTML(m);
  if (c.el) {
    var before = c.kind === 'card' ? cardHTML(old) : tileHTML(old);
    if (html !== before) { putGame(html, c.el); gamesChanged(); }
  } else { putGame(html, null, c.container); gamesChanged(); }
  closePanel();
}
function label0(row) { return oneLine(row.children[0].value) ? 1 : 0; }
function deleteFromPanel(btn) {
  if (!panelCtx || !panelCtx.el) return;
  if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = 'Click again to remove'; return; }
  removeGame(panelCtx.el); closePanel(); gamesChanged();
}

/* ---------- start (owner only) ---------- */
function start() {
  started = true;
  var css = doc.createElement('link'); css.rel = 'stylesheet'; css.href = 'assets/css/editor.css';
  doc.head.appendChild(css);
  scan(doc.body);
  buildBar();
  if (resume) {
    if (resume.editing) setEditing(true);
    if (resume.saved) { note('Saved.'); setTimeout(function () { if (statusNote === 'Saved.') note(''); }, 3000); }
    requestAnimationFrame(function () {
      window.scrollTo(0, resume.y || 0);
      var d = resume.dlg && doc.getElementById(resume.dlg);
      if (d && d.open) d.scrollTop = resume.dy || 0;
    });
  }
  renderBar();
}

window.__ybEditor = { build: buildDocument };   // used by the repo's sync tools

if (inArtifact) {
  Promise.all([window.claude.use('user'), window.claude.use('artifact')]).then(function (r) {
    artifactNS = r[1];
    if (!r[0] || !artifactNS) return false;
    return r[0].isOwner();
  }).then(function (owner) { if (owner) start(); }, function () {});
} else {
  start();
}
})();
