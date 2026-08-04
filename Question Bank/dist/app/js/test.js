// test.js — drives a single test session (question nav, palette, scoring).

import { Timer } from './timer.js';
import { scoreTest, getRules } from './scoring.js';
import { recordTest, saveInProgress, getInProgress, clearInProgress } from './storage.js';

export class TestRunner {
  /**
   * @param {object} cfg
   * @param {Array} cfg.questions   — questions in order
   * @param {string} cfg.mode       — 'timed' | 'chill' | 'revision'
   * @param {number} cfg.duration   — minutes (timed mode only)
   * @param {boolean} cfg.negativeMarking — false = no penalty for wrong
   * @param {string} cfg.label      — human label for this test
   */
  constructor(cfg) {
    this.cfg = cfg;
    this.questions = cfg.questions;
    this.total = cfg.questions.length;
    this.idx = 0;
    this.answers = new Array(this.total).fill(null);
    this.flags = new Set();
    this.startedAt = Date.now();
    this.finished = false;
    this.timer = null;

    if (cfg.mode === 'timed') {
      this.timer = new Timer({
        seconds: cfg.duration * 60,
        onTick: (r) => this._onTick(r),
        onExpire: () => this._onExpire(),
      });
    }
  }

  start() {
    if (this.timer) this.timer.start();
  }

  answer(i, key) {
    if (this.finished) return;
    this.answers[i] = key;
    saveInProgress(this.serialize());
  }

  flag(i) {
    if (this.flags.has(i)) this.flags.delete(i);
    else this.flags.add(i);
  }

  go(i) {
    this.idx = Math.max(0, Math.min(this.total - 1, i));
  }
  next() { if (this.idx < this.total - 1) this.idx++; }
  prev() { if (this.idx > 0) this.idx--; }

  remaining() { return this.timer ? this.timer.remaining : null; }

  _onTick(r) {
    document.dispatchEvent(new CustomEvent('timer:tick', { detail: { remaining: r } }));
  }

  _onExpire() {
    if (this.finished) return;
    this.finish(true);
  }

  /**
   * Finish the test.
   * @param {boolean} auto — true if auto-submitted by timer
   */
  finish(auto = false) {
    if (this.finished) return null;
    this.finished = true;
    if (this.timer) this.timer.stop();
    const rules = { ...getRules() };
    if (!this.cfg.negativeMarking) rules.wrong = 0;
    const result = scoreTest(this.questions, this.answers, rules);
    const record = {
      id: 't_' + Date.now(),
      label: this.cfg.label || 'Mock test',
      mode: this.cfg.mode,
      subject: this.cfg.subject || null,
      chapters: this.cfg.chapters || null,
      negativeMarking: !!this.cfg.negativeMarking,
      duration: this.cfg.duration || null,
      questions: this.total,
      startedAt: this.startedAt,
      finishedAt: Date.now(),
      autoSubmitted: auto,
      result,
    };
    recordTest(record);
    clearInProgress();
    return record;
  }

  serialize() {
    return {
      cfg: this.cfg,
      questions: this.questions.map((q) => q.id),
      answers: this.answers,
      flags: [...this.flags],
      idx: this.idx,
      startedAt: this.startedAt,
      remaining: this.remaining(),
    };
  }
}

/**
 * Restore a TestRunner from a saved-in-progress blob.
 */
export function restoreInProgress(data, questionBank) {
  if (!data) return null;
  const questions = data.questions.map((id) => questionBank.find((q) => q.id === id)).filter(Boolean);
  if (!questions.length) return null;
  const t = new TestRunner({ ...data.cfg, questions });
  t.answers = data.answers.slice(0, t.total);
  while (t.answers.length < t.total) t.answers.push(null);
  t.idx = data.idx || 0;
  t.flags = new Set(data.flags || []);
  t.startedAt = data.startedAt || Date.now();
  if (t.timer && data.remaining != null) t.timer.remaining = data.remaining;
  return t;
}