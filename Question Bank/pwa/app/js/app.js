// app.js — entry, router, view rendering.

import { loadQuestions, getSubjects, getScoring, pickQuestions } from './data.js';
import { getSettings, saveSettings, getHistory, clearHistory, getInProgress } from './storage.js';
import { TestRunner, restoreInProgress } from './test.js';
import { Timer } from './timer.js';
import {
  renderScoreTrend, renderAccuracyBySubject, renderSubjectRadar,
  renderDifficultyBreakdown, weakTopics, subjectColor,
} from './stats.js';
import { el, $, $$, clear, renderStem, toast, modal } from './ui.js';

// Set global scoring for the scorer module.
window.__mockaroo_scoring = { correct: 2, wrong: -0.5, unattempted: 0 };

// ---------- App state ----------
const state = {
  data: null,         // questions.json
  subjects: [],       // subjects index
  runner: null,       // active TestRunner
  timer: null,        // active Timer (set by view)
};

// ---------- Boot ----------
boot();

async function boot() {
  try {
    state.data = await loadQuestions();
    state.subjects = getSubjects();
    window.__mockaroo_scoring = state.data.scoring || window.__mockaroo_scoring;
  } catch (e) {
    document.getElementById('view').innerHTML =
      '<div class="card"><h1>Could not load question bank</h1><p class="muted">' +
      (e.message || e) + '</p></div>';
    return;
  }
  installServiceWorker();
  bindInstallButton();
  bindHashRouter();
}

// ---------- Service worker ----------
function installServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW registration failed:', e));
  }
}

// ---------- Install button ----------
let _deferredPrompt = null;
function bindInstallButton() {
  const btn = $('#install-btn');
  if (!btn) return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    btn.classList.remove('hide');
  });
  btn.addEventListener('click', async () => {
    if (_deferredPrompt) {
      _deferredPrompt.prompt();
      const choice = await _deferredPrompt.userChoice;
      toast('Install: ' + (choice.outcome || 'dismissed'));
      _deferredPrompt = null;
      btn.classList.add('hide');
    } else {
      // iOS fallback: show instructions
      modal('Install on iOS',
        el('p', {}, [
          'Open this page in Safari, tap the Share button, then "Add to Home Screen".',
        ]),
        [el('button', { class: 'btn', onclick: (e) => e.target.closest('.modal-bg').remove() }, ['Got it'])]
      );
    }
  });
  window.addEventListener('appinstalled', () => {
    btn.classList.add('hide');
    toast('App installed');
  });
}

// ---------- Router (hash-based) ----------
const ROUTES = ['#/home', '#/subjects', '#/setup', '#/test', '#/results', '#/history', '#/stats', '#/settings'];

function bindHashRouter() {
  window.addEventListener('hashchange', render);
  if (!location.hash || !ROUTES.includes(location.hash.split('/').slice(0, 2).join('/'))) {
    location.hash = '#/home';
  } else {
    render();
  }
}

async function render() {
  const view = $('#view');
  clear(view);
  const hash = location.hash || '#/home';
  const [_, route, ...rest] = hash.split('/');
  switch (route) {
    case 'subjects': return renderSubjects(view);
    case 'setup':    return renderSetup(view, rest);
    case 'test':     return renderTest(view);
    case 'results':  return renderResults(view, rest);
    case 'history':  return renderHistory(view);
    case 'stats':    return renderStats(view);
    case 'settings': return renderSettingsView(view);
    case 'home':
    default:         return renderHome(view);
  }
}

function go(hash) { location.hash = hash; }

// ---------- Home + Subjects ----------

function renderHome(view) {
  const history = getHistory();
  const total = state.data ? state.data.count : 0;
  const subjects = state.subjects.length;
  const last = history[0];

  const hero = el('div', { class: 'card' }, [
    el('h1', {}, ['Mockaroo']),
    el('p', { class: 'lede' }, [
      'A local-first, offline-capable SSC CGL Tier-I mock test PWA. Built from your Obsidian vault.',
    ]),
    el('div', { class: 'kpis' }, [
      el('div', { class: 'kpi' }, [el('div', { class: 'v' }, [String(total)]), el('div', { class: 'l' }, ['Questions'])]) ,
      el('div', { class: 'kpi' }, [el('div', { class: 'v' }, [String(subjects)]), el('div', { class: 'l' }, ['Subjects'])]) ,
      el('div', { class: 'kpi' }, [el('div', { class: 'v' }, [String(history.length)]), el('div', { class: 'l' }, ['Tests taken'])]) ,
      el('div', { class: 'kpi' }, [
        el('div', { class: 'v' }, [last ? last.result.score + '/' + last.result.max : '—']),
        el('div', { class: 'l' }, ['Last score']),
      ]),
    ]),
  ]);

  const inProgress = getInProgress();
  const actions = el('div', { class: 'card' }, [
    el('h2', {}, ['Start a test']),
    el('div', { class: 'btn-row' }, [
      el('button', { class: 'btn btn-primary', onclick: () => go('#/setup') }, ['New test →']),
      el('button', { class: 'btn', onclick: () => go('#/subjects') }, ['Browse subjects']),
      el('button', { class: 'btn', onclick: () => go('#/history') }, ['History (' + history.length + ')']),
      el('button', { class: 'btn', onclick: () => go('#/stats') }, ['Stats & charts']),
    ]),
    inProgress
      ? el('div', { class: 'mt-4 muted' }, [
          'You have an unfinished test from ',
          new Date(inProgress.startedAt).toLocaleString(),
          ' — open it from the setup screen.',
        ])
      : null,
  ]);

  const weak = weakTopics(history, 3);
  const weakCard = weak.length
    ? el('div', { class: 'card' }, [
        el('h2', {}, ['Weak topics — revise these']),
        el('ul', { class: 'plain' }, weak.map((w) =>
          el('li', {}, [
            el('span', { style: { width: '12px', height: '12px', borderRadius: '3px', background: subjectColor(w.subject), display: 'inline-block' } }),
            el('span', { class: 'grow' }, [w.subject + ' — ' + Math.round(w.accuracy * 100) + '% accuracy']),
            el('span', { class: 'muted' }, [w.attempted + ' attempted']),
          ])
        )),
      ])
    : null;

  view.append(hero, actions, weakCard);
}

function renderSubjects(view) {
  view.appendChild(el('h1', {}, ['Subjects']));
  view.appendChild(el('p', { class: 'lede' }, ['Pick a subject to drill chapter-by-chapter, or start a mixed test.']));
  const grid = el('div', { class: 'grid cols-3' });
  state.subjects.forEach((s) => {
    const card = el('div', { class: 'card' }, [
      el('h3', { style: { color: subjectColor(s.subject), marginTop: 0 } }, [s.subject]),
      el('div', { class: 'muted mb-2' }, [s.total + ' questions across ' + s.chapters.length + ' chapters']),
      el('div', { class: 'btn-row' }, [
        el('button', {
          class: 'btn btn-primary',
          onclick: () => { sessionStorage.setItem('mockaroo.subject', s.subject); go('#/setup'); },
        }, ['Start']),
      ]),
      el('div', { class: 'mt-2' }, [
        el('span', { class: 'chip' }, [s.recall + ' recall']),
        el('span', { class: 'chip' }, [s.apply + ' apply']),
        el('span', { class: 'chip' }, [s.tricky + ' tricky']),
      ]),
    ]);
    grid.appendChild(card);
  });
  view.appendChild(grid);
}

// ---------- Setup ----------

function renderSetup(view, rest) {
  const subjectParam = sessionStorage.getItem('mockaroo.subject') || (rest[0] || '');
  const settings = getSettings();

  view.appendChild(el('h1', {}, ['Test setup']));

  const wrap = el('div', { class: 'card' });
  wrap.appendChild(el('h2', {}, ['1. Scope']));

  const subjectSel = el('select', { id: 'setup-subject' });
  subjectSel.appendChild(el('option', { value: '' }, ['All subjects (mixed)']));
  state.subjects.forEach((s) => {
    const opt = el('option', { value: s.subject }, [s.subject + ' (' + s.total + ' qs)']);
    if (s.subject === subjectParam) opt.selected = true;
    subjectSel.appendChild(opt);
  });
  wrap.appendChild(el('label', { class: 'field' }, [el('span', { class: 'lbl' }, ['Subject']), subjectSel]));

  const countInp = el('input', { type: 'number', id: 'setup-count', min: '1', max: '500', value: '10' });
  wrap.appendChild(el('label', { class: 'field' }, [el('span', { class: 'lbl' }, ['Number of questions']), countInp]));

  wrap.appendChild(el('h2', {}, ['2. Mode']));
  const modeSel = el('select', { id: 'setup-mode' });
  [['chill', 'Chill mode (recommended for practice — see answers as you go, no timer)'],
   ['timed', 'Timed mock (real CGL exam feel — countdown, answers only at the end)'],
   ['revision', 'Revision mode (answer + explanation shown upfront — pure reading)']].forEach(([v, l]) => modeSel.appendChild(el('option', { value: v }, [l])));
  wrap.appendChild(el('label', { class: 'field' }, [el('span', { class: 'lbl' }, ['Mode']), modeSel]));

  const durInp = el('input', { type: 'number', id: 'setup-duration', min: '1', max: '180', value: String(settings.defaultDuration || 30) });
  wrap.appendChild(el('label', { class: 'field' }, [el('span', { class: 'lbl' }, ['Duration (minutes, timed mode only)']), durInp]));

  wrap.appendChild(el('h2', {}, ['3. Scoring']));
  const negRow = el('label', { class: 'field', style: { display: 'flex', alignItems: 'center' } }, [
    el('input', { type: 'checkbox', id: 'setup-negative', checked: settings.defaultNegative ? '' : null }),
    el('span', {}, ['Apply negative marking (-0.50 per wrong, SSC CGL default)']),
  ]);
  wrap.appendChild(negRow);

  wrap.appendChild(el('h2', {}, ['4. Label (optional)']));
  const labelInp = el('input', { type: 'text', id: 'setup-label', placeholder: 'e.g. "Friday evening mock"' });
  wrap.appendChild(el('label', { class: 'field' }, [el('span', { class: 'lbl' }, ['Test name']), labelInp]));

  const startBtn = el('button', { class: 'btn btn-primary mt-4' }, ['Start test →']);
  startBtn.addEventListener('click', startConfiguredTest);
  wrap.appendChild(startBtn);

  const inProgress = getInProgress();
  if (inProgress) {
    const remaining = inProgress.remaining != null ? Math.round(inProgress.remaining / 60) + ' min' : '—';
    const ip = el('div', { class: 'card mt-4', style: { borderColor: 'var(--accent)' } }, [
      el('h2', {}, ['Unfinished test']),
      el('p', { class: 'muted' }, ['Mode: ' + inProgress.cfg.mode + ' · ' + inProgress.questions.length + ' qs · ~' + remaining + ' left']),
      el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn btn-primary', onclick: () => resumeTest() }, ['Resume']),
        el('button', { class: 'btn btn-danger', onclick: () => { if (confirm('Discard unfinished test?')) { clearInProgress(); location.reload(); } } }, ['Discard']),
      ]),
    ]);
    view.appendChild(ip);
  }

  view.appendChild(wrap);
}

function clearInProgress() {
  try { localStorage.removeItem('mockaroo.v1.inprogress'); } catch {}
}

function startConfiguredTest() {
  const subject = $('#setup-subject').value || null;
  const count = parseInt($('#setup-count').value, 10) || 10;
  const mode = $('#setup-mode').value;
  const duration = parseInt($('#setup-duration').value, 10) || 30;
  const negative = $('#setup-negative').checked;
  const label = $('#setup-label').value || (subject ? subject + ' mock' : 'Mixed mock');

  const questions = pickQuestions({ subject, count });
  if (!questions.length) {
    toast('No questions available for this scope.');
    return;
  }
  state.runner = new TestRunner({
    questions, mode, duration, negativeMarking: negative,
    label, subject,
  });
  state.runner.start();
  sessionStorage.removeItem('mockaroo.subject');
  go('#/test');
}

function resumeTest() {
  const ip = getInProgress();
  if (!ip) return;
  const allQs = state.data.questions;
  const t = restoreInProgress(ip, allQs);
  if (!t) { toast('Could not resume — saved data is stale.'); clearInProgress(); return; }
  state.runner = t;
  state.runner.start();
  go('#/test');
}

// ---------- Test runner view ----------

function renderTest(view) {
  if (!state.runner) { go('#/home'); return; }
  const r = state.runner;

  const wrap = el('div', { class: 'runner' });

  const main = el('div', {});
  const timerEl = el('div', { class: 'sticky-timer hide', id: 'timer-sticky' }, [
    el('span', { class: 'muted' }, ['Time left']),
    el('span', { class: 'timer-num', id: 'timer-num' }, ['00:00']),
    el('span', { class: 'grow' }),
    el('button', { class: 'btn btn-primary', onclick: () => confirmSubmit() }, ['Submit']),
  ]);
  main.appendChild(timerEl);

  const qcard = el('div', { class: 'qcard', id: 'qcard' });
  main.appendChild(qcard);

  const nav = el('div', { class: 'qnav' }, [
    el('button', { class: 'btn', onclick: () => { r.prev(); paint(); } }, ['← Prev']),
    el('button', { class: 'btn', onclick: () => { r.next(); paint(); } }, ['Next →']),
    el('button', { class: 'btn', onclick: () => { r.flag(r.idx); paint(); } }, ['Flag']),
    el('button', { class: 'btn btn-primary', onclick: () => confirmSubmit(), style: { marginLeft: 'auto' } }, ['Submit test']),
  ]);
  main.appendChild(nav);

  const palette = el('div', { class: 'palette' }, [
    el('h3', {}, ['Questions']),
    el('div', { class: 'palette-grid', id: 'palette-grid' }),
    el('div', { class: 'legend' }, [
      el('div', {}, [el('span', { style: { background: 'var(--correct)' } }), 'Answered']),
      el('div', {}, [el('span', { style: { background: 'var(--accent)' } }), 'Flagged']),
      el('div', {}, [el('span', { style: { background: 'var(--panel-2)', border: '1px solid var(--border)' } }), 'Not visited']),
    ]),
  ]);

  wrap.append(main, palette);
  view.appendChild(wrap);

  // Tick handler (added once per render; harmless if duplicated)
  document.addEventListener('timer:tick', (e) => {
    const t = $('#timer-num');
    if (!t) return;
    const sec = e.detail.remaining;
    t.textContent = Timer.format(sec);
    t.classList.toggle('warn', sec <= 300 && sec > 60);
    t.classList.toggle('danger', sec <= 60);
  });

  // paint() and submit helpers come next

  function paint() {
    const q = r.questions[r.idx];
    const mode = r.cfg.mode;
    clear(qcard);

    qcard.appendChild(el('div', { class: 'qmeta' }, [
      el('span', { class: 'chip', style: { color: subjectColor(q.subject), borderColor: subjectColor(q.subject) } }, [q.subject]),
      el('span', { class: 'chip' }, ['Ch ' + q.chapter + ' · ' + q.chapterTitle]),
      el('span', { class: 'chip' }, [q.difficulty]),
      el('span', { class: 'grow' }),
      el('span', { class: 'chip', style: { background: 'var(--accent)', color: 'var(--bg)', borderColor: 'var(--accent)' } }, [r.cfg.mode.toUpperCase()]),
      el('span', { class: 'muted' }, ['Q ' + (r.idx + 1) + ' / ' + r.total]),
    ]));

    const stemWrap = el('div', { class: 'qstem' });
    stemWrap.appendChild(renderStem(q.question));
    qcard.appendChild(stemWrap);

    const opts = el('ul', { class: 'qopts' });
    q.options.forEach((o, i) => {
      const key = 'ABCD'[i];
      const li = el('li', {
        onclick: () => { r.answer(r.idx, key); paint(); },
      }, [
        el('span', { class: 'key' }, [key + ')']),
        el('span', {}, [o.text]),
      ]);
      const userAnsweredHere = r.answers[r.idx] != null;
      const showCorrectness = mode === 'revision' || (mode !== 'timed' && userAnsweredHere);
      if (showCorrectness) {
        if (key === q.answer) li.classList.add('correct');
        else if (key === r.answers[r.idx]) li.classList.add('wrong');
      } else if (userAnsweredHere && r.answers[r.idx] === key) {
        li.classList.add('selected');
      }
      opts.appendChild(li);
    });
    qcard.appendChild(opts);

    const userAnsweredHere = r.answers[r.idx] != null;
    const showFeedback = mode === 'revision' || (mode !== 'timed' && userAnsweredHere);
    if (showFeedback) {
      const fb = el('div', { class: 'qfeedback' });
      fb.appendChild(el('div', {}, [
        el('span', { class: 'label' }, ['Answer:']),
        el('span', { class: 'ans' }, [' ' + q.answer + ' — ' + (q.options.find((o) => o.key === q.answer) || {}).text]),
      ]));
      if (q.explanation) {
        fb.appendChild(el('strong', { class: 'mt-2' }, ['Why:']));
        const expl = el('div', { class: 'mt-2' });
        expl.appendChild(renderStem(q.explanation));
        fb.appendChild(expl);
      }
      if (q.sourceNote) {
        const link = el('a', { class: 'srclink', href: q.sourceNote, target: '_blank', rel: 'noopener' }, [
          '→ Open source note: ' + (q.sourceNoteTitle || q.sourceNote),
        ]);
        fb.appendChild(link);
      }
      qcard.appendChild(fb);
    } else if (mode === 'timed') {
      qcard.appendChild(el('div', { class: 'qfeedback muted' }, [
        'Submit the test or finish all questions to see answers and explanations.',
      ]));
    }

    // Palette
    const grid = $('#palette-grid');
    clear(grid);
    for (let i = 0; i < r.total; i++) {
      const b = el('button', { onclick: () => { r.go(i); paint(); } }, [String(i + 1)]);
      if (r.answers[i]) b.classList.add('answered');
      if (r.flags.has(i)) b.classList.add('flagged');
      if (i === r.idx) b.classList.add('current');
      grid.appendChild(b);
    }
  }

  function confirmSubmit() {
    const unanswered = r.answers.filter((a) => a == null).length;
    const body = el('div', {}, [
      el('p', {}, ['You have ' + unanswered + ' unanswered question(s). Submit anyway?']),
    ]);
    const yes = el('button', { class: 'btn btn-primary' }, ['Submit']);
    yes.addEventListener('click', () => { document.querySelector('.modal-bg')?.remove(); finishAndShowResults(); });
    const cancel = el('button', { class: 'btn' }, ['Keep going']);
    cancel.addEventListener('click', (e) => e.target.closest('.modal-bg').remove());
    modal('Submit test?', body, [cancel, yes]);
  }

  function finishAndShowResults() {
    const rec = state.runner.finish();
    if (!rec) return;
    sessionStorage.setItem('mockaroo.lastResult', rec.id);
    go('#/results/' + rec.id);
  }

  paint();

  if (r.cfg.mode === 'timed') {
    $('#timer-sticky').classList.remove('hide');
  } else if (r.cfg.mode === 'chill') {
    $('#timer-sticky').classList.remove('hide');
    $('#timer-num').textContent = '∞';
  }
}

// ---------- Results ----------

function renderResults(view, rest) {
  const id = rest[0];
  const rec = getHistory().find((h) => h.id === id);
  if (!rec) {
    view.appendChild(el('div', { class: 'card' }, [
      el('h1', {}, ['Result not found']),
      el('p', { class: 'muted' }, ['It may have been cleared.']),
      el('a', { class: 'btn', href: '#/history' }, ['Back to history']),
    ]));
    return;
  }
  const r = rec.result;

  const hero = el('div', { class: 'card' }, [
    el('div', { class: 'score-hero' }, [
      el('div', { class: 'num' }, [String(r.score)]),
      el('div', { class: 'max' }, ['out of ' + r.max]),
      el('div', { class: 'meta' }, [rec.label + ' · ' + rec.mode + ' mode · ' + new Date(rec.finishedAt).toLocaleString()]),
    ]),
    el('div', { class: 'kpis' }, [
      el('div', { class: 'kpi' }, [el('div', { class: 'v', style: { color: 'var(--correct)' } }, [String(r.correct)]), el('div', { class: 'l' }, ['Correct'])]),
      el('div', { class: 'kpi' }, [el('div', { class: 'v', style: { color: 'var(--wrong)' } }, [String(r.wrong)]), el('div', { class: 'l' }, ['Wrong'])]),
      el('div', { class: 'kpi' }, [el('div', { class: 'v' }, [String(r.unattempted)]), el('div', { class: 'l' }, ['Skipped'])]),
      el('div', { class: 'kpi' }, [el('div', { class: 'v' }, [Math.round(r.accuracy * 100) + '%']), el('div', { class: 'l' }, ['Accuracy'])]),
    ]),
  ]);
  view.appendChild(hero);

  const subjs = Object.entries(r.bySubject);
  if (subjs.length) {
    const sb = el('div', { class: 'card' }, [
      el('h2', {}, ['Subject breakdown']),
      el('table', { class: 't' }, [
        el('thead', {}, [el('tr', {}, [
          el('th', {}, ['Subject']), el('th', {}, ['Total']),
          el('th', {}, ['Correct']), el('th', {}, ['Wrong']),
          el('th', {}, ['Skipped']), el('th', {}, ['Accuracy']),
        ])]),
        el('tbody', {}, subjs.map(([s, d]) => {
          const acc = (d.c + d.w) ? d.c / (d.c + d.w) : 0;
          return el('tr', {}, [
            el('td', {}, [s]), el('td', {}, [String(d.total)]),
            el('td', {}, [String(d.c)]), el('td', {}, [String(d.w)]),
            el('td', {}, [String(d.u)]), el('td', {}, [Math.round(acc * 100) + '%']),
          ]);
        })),
      ]),
    ]);
    view.appendChild(sb);
  }

  const review = el('div', { class: 'card' }, [el('h2', {}, ['Per-question review'])]);
  rec.result.perQuestion.forEach((pq, i) => {
    const q = state.data.questions.find((q) => q.id === pq.qid);
    if (!q) return;
    const isCorrect = pq.result === 'correct';
    const isWrong = pq.result === 'wrong';
    const card = el('div', { class: 'qcard' }, [
      el('div', { class: 'qmeta' }, [
        el('span', { class: 'chip' }, ['Q' + (i + 1)]),
        el('span', { class: 'chip', style: { color: isCorrect ? 'var(--correct)' : isWrong ? 'var(--wrong)' : 'var(--muted)' } }, [pq.result.toUpperCase()]),
        el('span', { class: 'grow' }),
        el('span', { class: 'muted' }, [q.subject + ' · ' + q.chapterTitle]),
      ]),
      el('div', { class: 'qstem' }, [renderStem(q.question)]),
      el('div', { class: 'muted' }, ['Your answer: ' + (pq.picked || '—') + ' · Correct: ' + pq.correct]),
    ]);
    if (q.sourceNote) {
      card.appendChild(el('a', { class: 'srclink', href: q.sourceNote, target: '_blank', rel: 'noopener' }, ['→ Open source note: ' + (q.sourceNoteTitle || q.sourceNote)]));
    }
    review.appendChild(card);
  });

  view.appendChild(el('div', { class: 'btn-row mb-4' }, [
    el('a', { class: 'btn', href: '#/home' }, ['Home']),
    el('a', { class: 'btn', href: '#/history' }, ['All history']),
    el('a', { class: 'btn', href: '#/setup' }, ['New test']),
  ]));
  view.appendChild(review);
}

// ---------- History ----------

function renderHistory(view) {
  const history = getHistory();
  view.appendChild(el('h1', {}, ['Test history']));
  if (!history.length) {
    view.appendChild(el('div', { class: 'card muted' }, ['No tests taken yet. Start one from the setup screen.']));
    return;
  }
  const card = el('div', { class: 'card' });
  const tbl = el('table', { class: 't' });
  tbl.appendChild(el('thead', {}, [el('tr', {}, [
    el('th', {}, ['When']), el('th', {}, ['Label']), el('th', {}, ['Mode']),
    el('th', {}, ['Qs']), el('th', {}, ['Score']), el('th', {}, ['Acc %']), el('th', {}, ['']),
  ])]));
  const tbody = el('tbody', {});
  history.forEach((h) => {
    const acc = (h.result.correct + h.result.wrong) ? Math.round(h.result.correct / (h.result.correct + h.result.wrong) * 100) : 0;
    tbody.appendChild(el('tr', {}, [
      el('td', {}, [new Date(h.finishedAt).toLocaleString()]),
      el('td', {}, [h.label]),
      el('td', {}, [h.mode]),
      el('td', {}, [String(h.questions)]),
      el('td', {}, [h.result.score + ' / ' + h.result.max]),
      el('td', {}, [acc + '%']),
      el('td', {}, [el('a', { class: 'btn', href: '#/results/' + h.id }, ['View'])]),
    ]));
  });
  tbl.appendChild(tbody);
  card.appendChild(tbl);
  card.appendChild(el('div', { class: 'btn-row mt-4' }, [
    el('button', { class: 'btn btn-danger', onclick: () => {
      if (confirm('Clear all test history? This cannot be undone.')) { clearHistory(); go('#/home'); }
    } }, ['Clear history']),
  ]));
  view.appendChild(card);
}

// ---------- Stats ----------

function renderStats(view) {
  const history = getHistory();
  view.appendChild(el('h1', {}, ['Stats & charts']));
  if (!history.length) {
    view.appendChild(el('div', { class: 'card muted' }, ['No data yet — take a few tests first.']));
    return;
  }

  const charts = el('div', { class: 'grid cols-2' }, [
    el('div', { class: 'card' }, [el('h2', {}, ['Score trend']), el('div', { class: 'chart-wrap', style: { height: '240px' } }, [el('canvas', { id: 'chart-trend' })])]),
    el('div', { class: 'card' }, [el('h2', {}, ['Accuracy by subject']), el('div', { class: 'chart-wrap', style: { height: '240px' } }, [el('canvas', { id: 'chart-acc' })])]),
    el('div', { class: 'card' }, [el('h2', {}, ['Subject radar (best accuracy)']), el('div', { class: 'chart-wrap', style: { height: '280px' } }, [el('canvas', { id: 'chart-radar' })])]),
    el('div', { class: 'card' }, [el('h2', {}, ['Difficulty breakdown']), el('div', { class: 'chart-wrap', style: { height: '240px' } }, [el('canvas', { id: 'chart-diff' })])]),
  ]);
  view.appendChild(charts);

  const weak = weakTopics(history, 5);
  if (weak.length) {
    view.appendChild(el('div', { class: 'card' }, [
      el('h2', {}, ['Weak topics — revise these']),
      el('table', { class: 't' }, [
        el('thead', {}, [el('tr', {}, [el('th', {}, ['Subject']), el('th', {}, ['Total qs']), el('th', {}, ['Attempted']), el('th', {}, ['Accuracy'])])]),
        el('tbody', {}, weak.map((w) => el('tr', {}, [
          el('td', {}, [w.subject]),
          el('td', {}, [String(w.total)]),
          el('td', {}, [String(w.attempted)]),
          el('td', {}, [Math.round(w.accuracy * 100) + '%']),
        ]))),
      ]),
    ]));
  }

  setTimeout(() => {
    const trend = $('#chart-trend'); if (trend) renderScoreTrend(trend, history);
    const acc = $('#chart-acc'); if (acc) renderAccuracyBySubject(acc, history);
    const radar = $('#chart-radar'); if (radar) renderSubjectRadar(radar, history);
    const diff = $('#chart-diff'); if (diff) renderDifficultyBreakdown(diff, history);
  }, 0);
}

// ---------- Settings ----------

function renderSettingsView(view) {
  const s = getSettings();
  view.appendChild(el('h1', {}, ['Settings']));

  const themeSel = el('select', { id: 'set-theme' });
  [['auto', 'Auto (follow system)'], ['dark', 'Dark'], ['light', 'Light']].forEach(([v, l]) => {
    const o = el('option', { value: v }, [l]);
    if (s.theme === v) o.selected = true;
    themeSel.appendChild(o);
  });

  const durInp = el('input', { type: 'number', id: 'set-duration', min: '1', max: '180', value: String(s.defaultDuration || 30) });
  const negCb = el('input', { type: 'checkbox', id: 'set-negative', checked: s.defaultNegative ? '' : null });

  const card = el('div', { class: 'card' }, [
    el('label', { class: 'field' }, [el('span', { class: 'lbl' }, ['Theme']), themeSel]),
    el('label', { class: 'field' }, [el('span', { class: 'lbl' }, ['Default duration (minutes)']), durInp]),
    el('label', { class: 'field', style: { display: 'flex', alignItems: 'center' } }, [
      negCb, el('span', {}, ['Apply negative marking by default (SSC CGL rule)']),
    ]),
    el('div', { class: 'btn-row mt-4' }, [
      el('button', { class: 'btn btn-primary', onclick: () => {
        saveSettings({
          theme: themeSel.value,
          defaultDuration: parseInt(durInp.value, 10) || 30,
          defaultNegative: negCb.checked,
        });
        toast('Settings saved');
      } }, ['Save']),
    ]),
  ]);
  view.appendChild(card);

  view.appendChild(el('div', { class: 'card mt-4' }, [
    el('h2', {}, ['Data']),
    el('p', { class: 'muted' }, ['All your test history is stored locally in this browser. Nothing is uploaded anywhere.']),
    el('div', { class: 'btn-row' }, [
      el('button', { class: 'btn btn-danger', onclick: () => {
        if (confirm('Erase ALL local data (history, in-progress tests, settings)?')) {
          localStorage.clear(); location.reload();
        }
      } }, ['Erase all local data']),
    ]),
  ]));
}