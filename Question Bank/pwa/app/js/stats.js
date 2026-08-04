// stats.js — charts and aggregates from test history.
// Uses Chart.js (vendored locally).

let _chartLib = null;

async function getChart() {
  if (_chartLib) return _chartLib;
  if (window.Chart) { _chartLib = window.Chart; return _chartLib; }
  await import('./vendor/chart.umd.min.js');
  _chartLib = window.Chart;
  return _chartLib;
}

const SUBJECT_COLORS = {
  biology: '#4cc9f0', chemistry: '#f72585', physics: '#80ffdb',
  economics: '#ffd166', polity: '#c77dff', history: '#ff9e7d',
  geography: '#06d6a0', 'static-gk': '#ef476f', Environment: '#9bf6ff',
};

export function subjectColor(name) {
  return SUBJECT_COLORS[name] || '#8b949e';
}

function themeColors() {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  return {
    text: dark ? '#e6edf3' : '#1f2328',
    muted: dark ? '#8b949e' : '#57606a',
    grid: dark ? '#30363d' : '#d0d7de',
    panel: dark ? '#1c2230' : '#f1f3f6',
  };
}

export async function renderScoreTrend(canvas, history) {
  if (!history.length) return;
  const Chart = await getChart();
  const c = themeColors();
  const recent = history.slice(0, 20).reverse();
  const labels = recent.map((h) => new Date(h.finishedAt).toLocaleDateString());
  const scores = recent.map((h) => h.result.score);
  const maxes = recent.map((h) => h.result.max);
  new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Score',
          data: scores,
          borderColor: '#4cc9f0',
          backgroundColor: 'rgba(76, 201, 240, 0.15)',
          tension: 0.3, fill: true,
        },
        {
          label: 'Max possible',
          data: maxes,
          borderColor: c.muted,
          borderDash: [4, 4],
          pointRadius: 0, tension: 0,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: c.text } } },
      scales: {
        x: { ticks: { color: c.muted }, grid: { color: c.grid } },
        y: { ticks: { color: c.muted }, grid: { color: c.grid } },
      },
    },
  });
}

export async function renderAccuracyBySubject(canvas, history) {
  if (!history.length) return;
  const Chart = await getChart();
  const c = themeColors();
  const agg = {};
  for (const h of history) {
    for (const [subj, s] of Object.entries(h.result.bySubject)) {
      if (!agg[subj]) agg[subj] = { c: 0, w: 0, u: 0, total: 0 };
      agg[subj].c += s.c; agg[subj].w += s.w; agg[subj].u += s.u; agg[subj].total += s.total;
    }
  }
  const subjects = Object.keys(agg).sort();
  const accuracy = subjects.map((s) => {
    const attempted = agg[s].c + agg[s].w;
    return attempted ? agg[s].c / attempted : 0;
  });
  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: subjects,
      datasets: [{
        label: 'Accuracy %',
        data: accuracy.map((v) => Math.round(v * 100)),
        backgroundColor: subjects.map(subjectColor),
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ctx.parsed.x + '%' } },
      },
      scales: {
        x: { min: 0, max: 100, ticks: { color: c.muted, callback: (v) => v + '%' }, grid: { color: c.grid } },
        y: { ticks: { color: c.muted }, grid: { color: c.grid } },
      },
    },
  });
}

export async function renderSubjectRadar(canvas, history) {
  if (!history.length) return;
  const Chart = await getChart();
  const c = themeColors();
  const agg = {};
  for (const h of history) {
    for (const [subj, s] of Object.entries(h.result.bySubject)) {
      const attempted = s.c + s.w;
      const acc = attempted ? s.c / attempted : 0;
      if (!agg[subj] || acc > agg[subj]) agg[subj] = acc;
    }
  }
  const labels = Object.keys(agg);
  const data = Object.values(agg).map((v) => Math.round(v * 100));
  new Chart(canvas, {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label: 'Best accuracy %',
        data,
        backgroundColor: 'rgba(76, 201, 240, 0.2)',
        borderColor: '#4cc9f0',
        pointBackgroundColor: labels.map(subjectColor),
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: c.text } } },
      scales: {
        r: {
          min: 0, max: 100,
          ticks: { color: c.muted, backdropColor: 'transparent' },
          grid: { color: c.grid }, angleLines: { color: c.grid },
          pointLabels: { color: c.text, font: { size: 11 } },
        },
      },
    },
  });
}

export async function renderDifficultyBreakdown(canvas, history) {
  if (!history.length) return;
  const Chart = await getChart();
  const c = themeColors();
  const tiers = ['recall', 'apply', 'tricky'];
  const agg = { recall: { c: 0, w: 0, u: 0 }, apply: { c: 0, w: 0, u: 0 }, tricky: { c: 0, w: 0, u: 0 } };
  for (const h of history) {
    for (const t of tiers) {
      if (h.result.byDifficulty[t]) {
        agg[t].c += h.result.byDifficulty[t].c;
        agg[t].w += h.result.byDifficulty[t].w;
        agg[t].u += h.result.byDifficulty[t].u;
      }
    }
  }
  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Recall', 'Apply', 'Tricky'],
      datasets: [
        { label: 'Correct', data: tiers.map((t) => agg[t].c), backgroundColor: '#2ea043' },
        { label: 'Wrong', data: tiers.map((t) => agg[t].w), backgroundColor: '#f85149' },
        { label: 'Skipped', data: tiers.map((t) => agg[t].u), backgroundColor: '#6e7681' },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: c.text } } },
      scales: {
        x: { stacked: true, ticks: { color: c.muted }, grid: { color: c.grid } },
        y: { stacked: true, ticks: { color: c.muted }, grid: { color: c.grid } },
      },
    },
  });
}

export function weakTopics(history, n = 5) {
  if (!history.length) return [];
  const agg = {};
  for (const h of history) {
    for (const [subj, s] of Object.entries(h.result.bySubject)) {
      if (!agg[subj]) agg[subj] = { c: 0, w: 0, total: 0 };
      agg[subj].c += s.c; agg[subj].w += s.w; agg[subj].total += s.total;
    }
  }
  const list = Object.entries(agg).map(([subj, s]) => {
    const attempted = s.c + s.w;
    return { subject: subj, attempted, accuracy: attempted ? s.c / attempted : 0, total: s.total };
  });
  list.sort((a, b) => a.accuracy - b.accuracy);
  return list.slice(0, n);
}