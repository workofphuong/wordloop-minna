// Tiny DOM helpers. Text always goes in as text nodes, never as HTML.

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  const add = (kid) => {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) kid.forEach(add);
    else el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  };
  kids.forEach(add);
  return el;
}

export function mount(node) {
  const app = document.getElementById('app');
  app.replaceChildren(node);
  window.scrollTo(0, 0);
  const focus = node.querySelector('[autofocus], [data-autofocus]');
  if (focus) focus.focus();
  else {
    const hd = node.querySelector('h1');
    if (hd) {
      hd.setAttribute('tabindex', '-1');
      hd.focus({ preventScroll: true });
    }
  }
}

export const go = (hash) => {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
};

export function toast(msg) {
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 3200);
}

export const pick = (arr, avoid) => {
  const pool = arr.length > 1 ? arr.filter((x) => x !== avoid) : arr;
  return pool[Math.floor(Math.random() * pool.length)];
};

export const header = (title, back = '#/') =>
  h('header', { class: 'top' }, back ? h('a', { class: 'back', href: back, 'aria-label': 'Back' }, '← Back') : null, h('h1', null, title));

export const bar = (frac, label) =>
  h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(frac * 100), 'aria-label': label || 'Progress' },
    h('div', { class: 'bar-fill', style: `width:${Math.round(frac * 100)}%` }));

export function download(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Lets Tab type a tab character in a textarea (for term<TAB>meaning). Esc, then Tab, still leaves the box.
export function tabInserts(ta) {
  let trap = true;
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') trap = false;
    else if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && trap) {
      e.preventDefault();
      ta.setRangeText('\t', ta.selectionStart, ta.selectionEnd, 'end');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (e.key !== 'Tab') trap = true;
  });
  return ta;
}

// In-page "are you sure?" box. The browser's confirm() is blocked in some embedded browsers, so it is not used.
export function askFirst(host, message, okLabel, onOk) {
  host.querySelector(':scope > .confirm')?.remove();
  const box = h('div', { class: 'confirm', role: 'alertdialog', 'aria-label': message },
    h('p', null, message),
    h('div', { class: 'row' },
      h('button', { class: 'btn small danger', onclick: onOk }, okLabel),
      h('button', { class: 'btn small ghost', onclick: () => box.remove() }, 'Cancel')));
  host.append(box);
  box.querySelector('button').focus();
}
