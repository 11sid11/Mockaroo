// data.js — load and index the questions JSON.
let _data = null;

export async function loadQuestions() {
  if (_data) return _data;
  const res = await fetch('./data/questions.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('Could not load questions.json (HTTP ' + res.status + ')');
  _data = await res.json();
  return _data;
}

export function getQuestions() {
  if (!_data) throw new Error('questions not loaded yet — call loadQuestions() first');
  return _data.questions;
}

export function getSubjects() {
  return _data ? _data.subjects : [];
}

export function getScoring() {
  return _data ? _data.scoring : { correct: 2, wrong: -0.5, unattempted: 0 };
}

export function findQuestion(id) {
  return getQuestions().find((q) => q.id === id);
}

// Pick N random questions, optionally filtered by subject / chapters.
export function pickQuestions({ subject = null, chapters = null, count = 10 } = {}) {
  let pool = getQuestions();
  if (subject) pool = pool.filter((q) => q.subject === subject);
  if (chapters && chapters.length) pool = pool.filter((q) => chapters.includes(q.chapter));
  // Fisher-Yates shuffle
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}