// Opt-in backup: one JSON file with lists, batches and settings.
import { getState, save, replaceState } from './store.js';
import { looksLikeState } from './model.js';
import { daysBetween, todayStr } from './schedule.js';
import { download } from './ui/dom.js';

export function downloadBackup() {
  const s = getState();
  s.settings.lastBackup = todayStr();
  save();
  download(`wordloop-backup-${todayStr()}.json`, JSON.stringify(s, null, 2));
}

export async function restoreFromFile(file) {
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not a backup from this app (could not read it).');
  }
  if (!looksLikeState(data)) throw new Error('That file is not a backup from this app.');
  replaceState(data);
}

export function backupAgeText() {
  const { lastBackup } = getState().settings;
  if (!lastBackup) return 'No backup yet';
  const n = daysBetween(lastBackup, todayStr());
  return n <= 0 ? 'Last backed up today' : `Last backed up ${n} day${n === 1 ? '' : 's'} ago`;
}

export function backupNeeded() {
  const s = getState().settings;
  if (s.backupOptIn !== true) return false;
  return !s.lastBackup || daysBetween(s.lastBackup, todayStr()) >= 7;
}
