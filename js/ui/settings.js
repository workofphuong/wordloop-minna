import { h, mount, go, header, toast, askFirst } from './dom.js';
import { getState, save } from '../store.js';
import { backupAgeText, downloadBackup, restoreFromFile } from '../backup.js';

export function renderSettings() {
  const state = getState();
  const s = state.settings;
  const root = h('div', { class: 'screen' }, header('Backup and restore'));

  root.append(h('label', { class: 'check' },
    h('input', { type: 'checkbox', checked: s.backupOptIn === true, onchange: (e) => { s.backupOptIn = e.target.checked; save(); renderSettings(); } }),
    'Use backup files'));
  if (s.backupOptIn) {
    const file = h('input', { type: 'file', accept: '.json,application/json', 'aria-label': 'Backup file to restore' });
    root.append(
      h('p', { class: 'muted' }, backupAgeText() + '.'),
      h('div', { class: 'row wrap' }, h('button', { class: 'btn', onclick: () => { downloadBackup(); renderSettings(); } }, 'Download backup')),
      h('label', { class: 'field' }, 'Restore from a backup file', file),
      h('button', { class: 'btn', onclick: (ev) => {
        if (!file.files[0]) return toast('Choose a backup file first.');
        askFirst(ev.currentTarget.parentElement, 'Restoring replaces everything in this browser with the backup.', 'Yes, restore', async () => {
          try {
            await restoreFromFile(file.files[0]);
            toast('Restored.');
            go('#/');
          } catch (e) {
            toast(e.message);
          }
        });
      } }, 'Restore'));
  }
  mount(root);
}
