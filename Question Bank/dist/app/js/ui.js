// ui.js — DOM helpers and small primitives used by views.

export function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else if (v != null) e.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    if (typeof c === 'string' || typeof c === 'number') e.appendChild(document.createTextNode(String(c)));
    else e.appendChild(c);
  }
  return e;
}

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

// Resolve a wikilink path relative to the PWA shell context.
// From /index.html, '../../biology/01 - Cell' -> '../chapters/biology/01 - Cell.html'.
function toUrl(p) {
  if (!p) return '#';
  if (/^https?:/i.test(p)) return p;
  if (p.endsWith('.md')) p = p.slice(0, -3) + '.html';
  return '../chapters/' + p.replace(/^(\.\.\/)+/, '');
}

// Tokenize a single line of inline markdown (wikilinks, bold, italic, code).
function inlineToNode(text) {
  const frag = document.createDocumentFragment();
  const re = /(\[\[[^\]]+\]\])|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(`[^`]+`)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    const tok = m[0];
    if (tok.startsWith('[[')) {
      const wm = tok.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
      if (wm) {
        const path = wm[1];
        const alias = wm[2] || path.split('/').pop().replace(/\.md$/, '');
        frag.appendChild(el('a', { class: 'wikilink', href: toUrl(path) }, [alias]));
      }
    } else if (tok.startsWith('**')) {
      frag.appendChild(el('strong', {}, [tok.slice(2, -2)]));
    } else if (tok.startsWith('*')) {
      frag.appendChild(el('em', {}, [tok.slice(1, -1)]));
    } else if (tok.startsWith('`')) {
      frag.appendChild(el('code', {}, [tok.slice(1, -1)]));
    }
    last = m.index + tok.length;
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  return frag;
}

// Render a question stem with tables, paragraphs, and inline formatting.
export function renderStem(text) {
  const root = el('div');
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim().startsWith('|') && i + 1 < lines.length && /^\|[\s|:-]+\|$/.test(lines[i + 1].trim())) {
      const headerCells = l.trim().slice(1, -1).split('|').map((c) => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].trim().slice(1, -1).split('|').map((c) => c.trim()));
        i++;
      }
      const t = el('table');
      t.append(el('thead', {}, [el('tr', {}, headerCells.map((h) => el('th', {}, [inlineToNode(h)])))]));
      t.append(el('tbody', {}, rows.map((r) => el('tr', {}, r.map((c) => el('td', {}, [inlineToNode(c)]))))));
      root.appendChild(t);
      continue;
    }
    if (l.trim() === '') { i++; continue; }
    root.appendChild(el('p', {}, [inlineToNode(l)]));
    i++;
  }
  return root;
}

// --- toasts ---
let _toastHost = null;
export function toast(msg, ms = 2400) {
  if (!_toastHost) {
    _toastHost = el('div', { class: 'toast-host' });
    document.body.appendChild(_toastHost);
  }
  const t = el('div', { class: 'toast' }, [msg]);
  _toastHost.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// --- modal ---
export function modal(title, bodyNode, actions = []) {
  const bg = el('div', { class: 'modal-bg' });
  const m = el('div', { class: 'modal' }, [el('h2', {}, [title])]);
  m.appendChild(bodyNode);
  const row = el('div', { class: 'btn-row' });
  actions.forEach((a) => row.appendChild(a));
  m.appendChild(row);
  bg.appendChild(m);
  bg.addEventListener('click', (e) => { if (e.target === bg) bg.remove(); });
  document.body.appendChild(bg);
  return { close: () => bg.remove() };
}