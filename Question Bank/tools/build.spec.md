# Question Bank File Format — Spec

> Version 1 · Single source of truth for `build.py` and any future editor tooling.

## Why this exists

The question bank lives as **human-editable Markdown** in the Obsidian vault, so you can read, edit, and review questions the same way you read source chapters. A build script (`build.py`) parses these files and emits machine-readable `questions.json` for the PWA. **Never hand-edit `questions.json`** — always edit the source `.md` files and rebuild.

## File location & naming

Every chapter's question file lives at:

```
Question Bank/<subject>/NN - <Chapter Title> — Questions.md
```

Examples:

```
Question Bank/biology/01 - Cell — Questions.md
Question Bank/polity/05 - Fundamental Rights — Questions.md
Question Bank/static-gk/16 - Countries - Capitals Currencies and Languages — Questions.md
```

The em-dash (`—`) and the literal suffix ` — Questions` are **required** so `build.py` can distinguish question files from regular chapters.

## Required YAML frontmatter

```yaml
---
title: "Cell — Questions"
subject: biology
chapter: 1
tags: [question-bank, ssc, biology]
topic_id: [biology.cell.questions]
---
```

Fields:
- `title` — free text, used as page title
- `subject` — one of: `biology`, `chemistry`, `physics`, `economics`, `polity`, `history`, `geography`, `static-gk`, `Environment`
- `chapter` — integer matching the source chapter number
- `topic_id` — array, unique across the vault, slug-form

## Question block syntax

Every question is wrapped between `@q<id>` and `@@` markers on their own lines.

```
@q<id> difficulty=<tier> subject=<subject> chapter=<n>
<question stem, multiple paragraphs OK>
- A) <option 1>
- B) <option 2>
- C) <option 3>
- D) <option 4>
@@
```

### Field reference

| Field | Required | Values | Notes |
|---|---|---|---|
| `id` | **yes** | `subject.slug.qN` e.g. `bio.cell.q1` | Stable, never reused. Bookmarks (if added later) reference this. |
| `difficulty` | **yes** | `recall` \| `apply` \| `tricky` | Powers the difficulty-breakdown chart. |
| `subject` | recommended | matches frontmatter | Inferred if omitted. |
| `chapter` | recommended | integer | Inferred from frontmatter if omitted. |

### Answer / explanation block

Immediately after the `@@` marker, place a collapsible explanation:

```markdown
<details><summary>Answer & explanation</summary>

**Answer: B**

<explanation paragraphs, can use wikilinks like [[../../biology/01 - Cell#section]]>

**Trap:** <why the obvious-wrong answer is tempting>

**See also:** <wikilinks>
</details>
```

The build script extracts the line starting with `**Answer:` as the correct option letter, and everything inside the `<details>` body (excluding the answer line and the `See also`) as the explanation.

## Difficulty tier definitions

| Tier | Definition | Example |
|---|---|---|
| `recall` | Direct static fact, single step | "Cristae are folds of the inner mitochondrial membrane" |
| `apply` | Concept applied to a scenario, one-step reasoning | "Given RBC behaviour in 3 solutions, identify tonicity" |
| `tricky` | Two-step reasoning, trap distractors, or assertion-reason format | "Statement-assertion logic for lysosome suicide-bag" |

Aim for **roughly 4 recall / 5 apply / 3 tricky** per chapter file (12 questions total). Adjust for narrow chapters (8 questions) or wide chapters (15 questions).

## Update workflow

| Action | How |
|---|---|
| **Add question** | Copy an `@q ... @@` block, change `id` to next number, change content |
| **Edit question** | Edit text inside the `@q ... @@` block, keep `id` stable |
| **Delete question** | Delete the entire `@q ... @@` block and its answer |
| **Add new chapter file** | Create new file with correct name + frontmatter, add `@q` blocks |
| **Rebuild** | `python tools/build.py` |
| **Deploy** | `git add . && git commit && git push` (auto-deploys to GitHub Pages) |

## Deleted-question behaviour

Question IDs are stable. If `bio.cell.q7` exists today and you delete it tomorrow:
- Build script skips it; it does not appear in `questions.json`
- Any future feature referencing IDs (e.g. "saved tests") will get a "question removed" fallback
- The PWA does **not** crash on missing IDs

## Validation rules (enforced by `build.py`)

1. Every `@q<id>` must be matched by exactly one `@@` on its own line
2. `id` must be unique across all question files (script errors on duplicates)
3. Each question must have exactly 4 options labelled A–D
4. `difficulty` must be one of the 3 allowed values
5. Each question must have an `<details>` block with `**Answer: <A|B|C|D>**` line
6. The answer letter (A–D) must match the correct option

Errors are reported with file path and line number. Fix and re-run.