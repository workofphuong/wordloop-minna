import { renderHome } from './ui/home.js';
import { renderAdd } from './ui/add.js';
import { renderRound } from './ui/round.js';
import { renderNewList, renderReview, renderEdit } from './ui/newlist.js';
import { renderList } from './ui/list.js';
import { renderExamples } from './ui/examples.js';
import { renderPractice } from './ui/practice.js';
import { renderSettings } from './ui/settings.js';
import { initPwa } from './pwa.js';
import { getState, storageError } from './store.js';

function route() {
  const [, path = '', arg] = (location.hash || '#/').split('/');
  switch (path) {
    case 'add': return renderAdd();
    case 'round': return renderRound();
    case 'examples': return renderExamples(arg);
    case 'edit': return renderEdit(arg);
    case 'review': return renderReview(arg);
    case 'new': return renderNewList();
    case 'list': return renderList(arg);
    case 'practice': return renderPractice(arg);
    case 'settings': return renderSettings();
    default: return renderHome();
  }
}

getState();
initPwa();
window.addEventListener('hashchange', route);
route();
if (storageError) console.warn('Storage problem:', storageError);
