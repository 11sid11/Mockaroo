// scoring.js — SSC CGL Tier-I rules by default, configurable.

const DEFAULT_RULES = { correct: 2, wrong: -0.5, unattempted: 0 };

export function getRules() {
  // pull latest scoring config from loaded data; fallback to CGL defaults.
  try {
    // Avoid circular import — read directly via global if needed.
    return window.__mockaroo_scoring || DEFAULT_RULES;
  } catch {
    return DEFAULT_RULES;
  }
}

// answers: array indexed by question position, each entry null|"A"|"B"|"C"|"D"
export function scoreTest(questions, answers, rules = null) {
  const r = rules || getRules();
  let correct = 0, wrong = 0, unattempted = 0;
  let score = 0;
  const perQuestion = [];
  const bySubject = {};
  const byDifficulty = { recall: { c: 0, w: 0, u: 0 }, apply: { c: 0, w: 0, u: 0 }, tricky: { c: 0, w: 0, u: 0 } };

  questions.forEach((q, i) => {
    const ans = answers[i] || null;
    let result = 'unattempted';
    let earned = 0;
    if (ans == null) {
      unattempted++;
      earned = r.unattempted;
    } else if (ans === q.answer) {
      correct++;
      result = 'correct';
      earned = r.correct;
    } else {
      wrong++;
      result = 'wrong';
      earned = r.wrong;
    }
    score += earned;

    if (!bySubject[q.subject]) bySubject[q.subject] = { c: 0, w: 0, u: 0, total: 0 };
    bySubject[q.subject].total++;
    bySubject[q.subject][result === 'correct' ? 'c' : result === 'wrong' ? 'w' : 'u']++;
    byDifficulty[q.difficulty][result === 'correct' ? 'c' : result === 'wrong' ? 'w' : 'u']++;

    perQuestion.push({ qid: q.id, picked: ans, correct: q.answer, result, earned });
  });

  const max = questions.length * r.correct;
  const accuracy = (correct + wrong) > 0 ? correct / (correct + wrong) : 0;
  const attempted = correct + wrong;

  return {
    score, max, correct, wrong, unattempted, attempted,
    accuracy, rules: r, perQuestion, bySubject, byDifficulty,
  };
}