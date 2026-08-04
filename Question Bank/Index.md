---
title: "Question Bank — Index"
subject: question-bank
tags: [index, question-bank, ssc, mocs]
topic_id: [question_bank]
---

# Question Bank — Index

> A SSC-caliber MCQ bank sourced from the vault. One questions file per chapter, plus per-subject overviews. Designed to be the **exam-mode dashboard** for the PWA built on top of this vault.

← Back to [[Index]]

## What this is

- **Source of truth:** the vault chapters themselves. Every question is grounded in a chapter note, and every chapter note now has a `## See also` link back to its questions file.
- **Difficulty mix:** SSC CGL Tier-I / CHSL / CPO / MTS standard — mix of static-fact recall, concept-application, and trap-aware distractors.
- **No fluff:** questions are written from the chapter content, not from generic internet dumps. Distractors are chosen to be the *common wrong answer* for that concept.

## Format

Every question file uses the same shape:

```
---
title: "..."
subject: ...
chapter: N
tags: [question-bank, ssc, <subject>]
topic_id: [<subject>.<slug>.questions]
---

# Q. Chapter Title — Questions

> Source: [[../<subject>/NN - Chapter Title]] | Subject: [[../MOC - <subject>]]

1. Stem with 4 options (A–D).
   - **Answer:** X
   - **Why:** explanation with wikilinks to source chapter
   - **Trap:** why the obvious-wrong option trips students

## Difficulty mix
| Tier | Count | Type |
| --- | --- | --- |
| Recall | 4–5 | static facts |
| Apply | 4–5 | concept-on-data |
| Tricky | 2–3 | trap / two-step |

## Cross-references
- [[../<subject>/NN - Chapter Title]] — source chapter
- [[../MOC - <subject>]] — subject MOC
```

Answers and explanations are wrapped in collapsible `<details>` blocks so the same markdown renders cleanly in Obsidian, on GitHub Pages, and in the planned PWA.

## Subjects at a glance

| Subject | Chapters | File | Subject overview |
| --- | --- | --- | --- |
| **biology** | 22 | [[biology/01 - Cell — Questions.md]] (first) | [[biology.md]] |
| **chemistry** | 7 | coming | [[chemistry.md]] |
| **physics** | 8 | coming | [[physics.md]] |
| **economics** | 9 | coming | [[economics.md]] |
| **history** | 23 | coming | [[history.md]] |
| **geography** | 20 | coming | [[geography.md]] |
| **polity** | 15 | coming | [[polity.md]] |
| **static-gk** | 26 | coming | [[static-gk.md]] |
| **Environment** | 5 | coming | [[Environment.md]] |

## How to use this bank

1. **Topic-wise practice:** open a chapter question file, attempt all questions, then collapse the `<details>` blocks to reveal answers and explanations.
2. **Subject-wise revision:** open a subject overview file (e.g. `biology.md`) — it indexes all questions for that subject, sortable by difficulty.
3. **Mock-paper mode:** the planned PWA will scrape all `*— Questions.md` files, parse frontmatter + question blocks, and serve as a timed quiz with reveal-on-tap. This index is the entry point.

## Cross-references

- [[Index]] — vault root
- [[README]] — vault build notes