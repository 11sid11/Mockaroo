// storage.js — local-first persistence (localStorage).

const NS = 'mockaroo.v1.';

export function get(key, fallback = null) {
  try {
    const raw = localStorage.getItem(NS + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function set(key, value) {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
  } catch (e) {
    // QuotaExceededError etc — surface to UI as a toast.
    console.warn('storage.set failed:', e);
  }
}

export function del(key) {
  try { localStorage.removeItem(NS + key); } catch {}
}

// Test history: append-only list of completed tests.
export function recordTest(result) {
  const list = get('history', []);
  list.unshift(result);
  // cap at 200 to bound storage
  set('history', list.slice(0, 200));
}

export function getHistory() {
  return get('history', []);
}

export function clearHistory() {
  set('history', []);
}

// In-progress test (so refresh doesn't lose the current run).
export function saveInProgress(state) {
  set('inprogress', state);
}

export function getInProgress() {
  return get('inprogress', null);
}

export function clearInProgress() {
  del('inprogress');
}

// Settings: theme, default scoring toggles, etc.
export function getSettings() {
  return get('settings', { theme: 'auto', defaultNegative: true, defaultDuration: 30 });
}

export function saveSettings(s) {
  set('settings', s);
}