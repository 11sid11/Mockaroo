# Mockaroo

A local-first, offline-capable **SSC CGL Tier-I mock test PWA**, generated from a curated Obsidian knowledge vault.

> Question bank · timed mocks · chill mode · per-chapter drill · subject-wise · mixed · score analytics with charts · every question links back to its source note for revision.

## What's in this repo

```
Mockaroo/
├── README.md                       ← this file
├── index.html                      ← landing page (redirects to PWA)
├── .gitignore
└── Question Bank/
    ├── Index.md                    ← question bank overview
    ├── biology/
    │   └── 01 - Cell — Questions.md ← exemplar chapter
    ├── chemistry/, ..., static-gk/ ← subject folders
    ├── tools/
    │   ├── build.py                ← build script (Markdown → JSON + HTML)
    │   └── build.spec.md           ← question-file format spec
    └── dist/                       ← built output (GitHub Pages serves this)
        ├── index.html              ← PWA app shell
        ├── data/questions.json     ← all questions
        ├── data/build.json         ← build metadata
        ├── app/                    ← CSS + JS
        └── chapters/<subject>/     ← 135 source chapter HTMLs
```

## How it works

1. **Source of truth** = `Question Bank/<subject>/* — Questions.md` files in your Obsidian vault (human-editable, version-controlled)
2. **Build script** (`Question Bank/tools/build.py`) parses `@q` blocks → emits `dist/data/questions.json` and converts source chapter `.md` → `.html`
3. **PWA** (in `dist/app/`) reads `questions.json` at runtime, runs the test, scores with SSC CGL rules (+2/-0.5/0)
4. **GitHub Pages** serves `dist/` directly — no server-side build needed

## Updating the question bank

| Action | Where | Command |
|---|---|---|
| Add / edit / delete a question | edit the `.md` file in your Obsidian vault | `python tools/build.py` |
| Rebuild the PWA bundle | — | `git add . && git commit && git push` |

Users get the update next time they open the PWA. **No reinstall needed.**

## SSC CGL scoring rules

- Correct: **+2**
- Wrong: **-0.50**
- Unattempted: **0**

(Toggle negative marking per-test in the PWA setup screen.)

## Local development

```bash
cd "Question Bank"
python tools/build.py --serve     # builds + serves on http://localhost:8000
```

## Format spec

See [`Question Bank/tools/build.spec.md`](Question%20Bank/tools/build.spec.md) for the `@q` block format and validation rules.

## Source vault

This project is built from a private Obsidian vault covering 9 subjects (biology, chemistry, physics, economics, polity, history, geography, static-gk, Environment) with ~135 chapters and ~1,500 planned SSC-grade MCQs. The vault itself is not in this repo — only the question-bank subtree and its built output.