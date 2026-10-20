// Service worker registration and the one-time, dismissible install hint.
import { h } from './ui/dom.js';
import { getState, save } from './store.js';

let deferred = null;

export function initPwa() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
  });
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export function installCard() {
  const s = getState().settings;
  if (s.installHintSeen || standalone()) return null;
  const dismiss = (el) => { s.installHintSeen = true; save(); el.remove(); };
  if (deferred) {
    const el = h('section', { class: 'card subtle install' },
      h('p', null, 'Install this app to use it offline from your home screen.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn small primary', onclick: async () => { deferred.prompt(); await deferred.userChoice; deferred = null; dismiss(el); } }, 'Install'),
        h('button', { class: 'btn small ghost', onclick: () => dismiss(el) }, 'Not now')));
    return el;
  }
  if (isIos()) {
    const el = h('section', { class: 'card subtle install' },
      h('p', null, 'To install: tap Share, then Add to Home Screen.'),
      h('button', { class: 'btn small ghost', onclick: () => dismiss(el) }, 'Got it'));
    return el;
  }
  return null;
}
