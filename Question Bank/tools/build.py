#!/usr/bin/env python3
"""
build.py â€” Question Bank build script.

Reads:
  - Question Bank/<subject>/* - <Chapter> â€” Questions.md   (parseable @q blocks)
  - <vault_root>/<subject>/*.md                            (source chapters, for wikilink resolution)

Writes:
  - dist/data/questions.json
  - dist/data/build.json           (version metadata)
  - dist/chapters/<subject>/*.html (source chapter HTMLs, for PWA wikilinks)
  - dist/app/                      (PWA shell copied from pwa/)

Usage:
  python tools/build.py                # full build
  python tools/build.py --validate     # validate question files only (no emit)
  python tools/build.py --serve        # build + start local server on :8000

See build.spec.md for the question-file format.
"""

from __future__ import annotations
import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Paths & constants
# ---------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent.parent   # vault root
QBANK = ROOT / "Question Bank"
PWA_SRC = QBANK / "pwa"
DIST = QBANK / "dist"

SUBJECT_DIRS = [
    "biology", "chemistry", "physics", "economics",
    "polity", "history", "geography", "static-gk", "Environment",
]

ALLOWED_DIFFICULTY = {"recall", "apply", "tricky"}
ALLOWED_SUBJECTS = set(SUBJECT_DIRS)

# Scoring rules (SSC CGL Tier-I default)
SCORING = {
    "correct": 2.0,
    "wrong": -0.5,
    "unattempted": 0.0,
}

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
QUESTION_OPEN_RE = re.compile(r"^@q([\w.]+)\s+(.*?)\n(.*?)^@@\s*$", re.DOTALL | re.MULTILINE)
DETAILS_RE = re.compile(r"<details>\s*<summary>.*?</summary>\s*(.*?)\s*</details>", re.DOTALL)
ANSWER_RE = re.compile(r"\*\*Answer:\s*([A-D])\*\*", re.IGNORECASE)
OPTION_RE = re.compile(r"^- ([A-D])\)\s*(.+?)\s*$", re.MULTILINE)
KVP_RE = re.compile(r"(\w+)=([^\s]+)")
WIKILINK_RE = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")
HTML_ESCAPE_MAP = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}


def html_escape(s: str) -> str:
    return "".join(HTML_ESCAPE_MAP.get(c, c) for c in s)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class Question:
    id: str
    subject: str
    chapter: int
    chapter_title: str
    difficulty: str           # recall | apply | tricky
    question: str             # stem
    options: list             # ["A) ...", "B) ...", ...]
    answer: str               # "A" | "B" | "C" | "D"
    explanation: str
    wikilink: Optional[str]
    source_note: Optional[str]
    source_note_title: Optional[str]

    def to_json(self):
        return {
            "id": self.id,
            "subject": self.subject,
            "chapter": self.chapter,
            "chapterTitle": self.chapter_title,
            "difficulty": self.difficulty,
            "question": self.question,
            "options": [{"key": k, "text": t} for k, t in zip("ABCD", self.options)],
            "answer": self.answer,
            "explanation": self.explanation,
            "wikilink": self.wikilink,
            "sourceNote": self.source_note,
            "sourceNoteTitle": self.source_note_title,
        }


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def parse_frontmatter(text: str) -> dict:
    m = FRONTMATTER_RE.match(text)
    if not m:
        raise ValueError("missing YAML frontmatter (--- at top of file)")
    fm = {}
    for line in m.group(1).splitlines():
        if ":" in line and not line.strip().startswith("-"):
            k, v = line.split(":", 1)
            fm[k.strip()] = v.strip().strip('"').strip("'")
    return fm


def extract_answer_and_explanation(details_body: str) -> tuple[str, str, Optional[str]]:
    """Return (answer_letter, explanation_text, first_wikilink)."""
    m_ans = ANSWER_RE.search(details_body)
    if not m_ans:
        raise ValueError("no '**Answer: X**' line found inside <details>")
    answer = m_ans.group(1).upper()

    body = ANSWER_RE.sub("", details_body, count=1)
    body = re.split(r"\*\*See also:\*\*", body, maxsplit=1)[0]
    explanation = body.strip()

    m_link = WIKILINK_RE.search(details_body)
    wikilink = m_link.group(0) if m_link else None

    return answer, explanation, wikilink


def resolve_source_note(wikilink: str, current_file: Path) -> Optional[str]:
    if not wikilink:
        return None
    m = WIKILINK_RE.match(wikilink)
    if not m:
        return None
    target = m.group(1).split("#")[0].strip()
    if not target.endswith('.md'):
        target = target + '.md'
    current = current_file.resolve()
    target_path = (current.parent / target).resolve()
    if not target_path.exists():
        return None
    try:
        rel = target_path.relative_to(ROOT)
    except ValueError:
        return None
    rel_str = str(rel).replace("\\", "/")
    if rel_str.endswith(".md"):
        rel_str = rel_str[:-3] + ".html"
    return f"chapters/{rel_str}"


def get_chapter_title(chapter_md_path: Path) -> str:
    try:
        text = chapter_md_path.read_text(encoding="utf-8")
        m = re.search(r"^# .+?$", text, re.MULTILINE)
        if m:
            return re.sub(r"^#\s*\d+\.?\s*", "", m.group(0)).strip()
    except Exception:
        pass
    return chapter_md_path.stem


def parse_chapter_file(md_path: Path) -> list[Question]:
    text = md_path.read_text(encoding="utf-8")
    fm = parse_frontmatter(text)
    chapter_title_match = re.search(r"^# .+?$", text, re.MULTILINE)
    chapter_title = chapter_title_match.group(0).lstrip("# ").strip() if chapter_title_match else fm.get("title", md_path.stem)

    questions: list[Question] = []
    for m in QUESTION_OPEN_RE.finditer(text):
        qid = m.group(1)
        attrs = m.group(2)
        body = m.group(3)
        kv = dict(KVP_RE.findall(attrs))
        difficulty = kv.get("difficulty", "").lower()
        subject = kv.get("subject") or fm.get("subject", "")
        try:
            chapter_num = int(kv.get("chapter") or fm.get("chapter", "0"))
        except ValueError:
            chapter_num = 0

        if difficulty not in ALLOWED_DIFFICULTY:
            raise ValueError(f"{md_path.name}: invalid difficulty '{difficulty}' for {qid}")
        if subject not in ALLOWED_SUBJECTS:
            raise ValueError(f"{md_path.name}: invalid subject '{subject}' for {qid}")

        m_opt = OPTION_RE.search(body)
        if not m_opt:
            raise ValueError(f"{md_path.name}: {qid} has no options")
        stem = body[:m_opt.start()].rstrip()
        options_raw = OPTION_RE.findall(body[m_opt.start():])
        if len(options_raw) != 4:
            raise ValueError(f"{md_path.name}: {qid} expected 4 options, got {len(options_raw)}")
        if [k for k, _ in options_raw] != ["A", "B", "C", "D"]:
            raise ValueError(f"{md_path.name}: {qid} options must be in order A,B,C,D")
        option_values = [t for _, t in options_raw]

        after_close = text[m.end():]
        next_q = QUESTION_OPEN_RE.search(after_close)
        following = after_close[:next_q.start()] if next_q else after_close
        m_details = DETAILS_RE.search(following)
        if not m_details:
            raise ValueError(f"{md_path.name}: {qid} missing <details> block after @@")
        answer, explanation, wikilink = extract_answer_and_explanation(m_details.group(1))

        source_note = resolve_source_note(wikilink, md_path) if wikilink else None

        chapter_title_resolved = chapter_title
        if source_note:
            md_rel = source_note.replace("chapters/", "").replace(".html", ".md")
            chapter_md = ROOT / md_rel
            chapter_title_resolved = get_chapter_title(chapter_md)

        questions.append(Question(
            id=qid,
            subject=subject,
            chapter=chapter_num,
            chapter_title=chapter_title_resolved,
            difficulty=difficulty,
            question=stem,
            options=option_values,
            answer=answer,
            explanation=explanation,
            wikilink=wikilink,
            source_note=source_note,
            source_note_title=chapter_title_resolved if source_note else None,
        ))
    return questions


# ---------------------------------------------------------------------------
# Markdown -> HTML (minimal converter for source chapters)
# ---------------------------------------------------------------------------

def format_inline(text: str) -> str:
    """Format bold/italic/code/wikilinks within a single line."""
    s = html_escape(text)
    # wikilinks with alias
    s = re.sub(
        r"\[\[([^\]|]+)\|([^\]]+)\]\]",
        lambda m: '<a class="wikilink" href="' + m.group(1).split("#")[0].replace(".md", ".html") + (("#" + m.group(1).split("#")[1]) if "#" in m.group(1) else "") + '">' + m.group(2) + '</a>',
        s,
    )
    # wikilinks without alias
    s = re.sub(
        r"\[\[([^\]|]+)\]\]",
        lambda m: '<a class="wikilink" href="' + m.group(1).split("#")[0].replace(".md", ".html") + (("#" + m.group(1).split("#")[1]) if "#" in m.group(1) else "") + '">' + m.group(1).split("/")[-1].replace(".md", "") + '</a>',
        s,
    )
    # bold / italic / code
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", s)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    return s


def md_to_html(md_text: str, title: str) -> str:
    body = FRONTMATTER_RE.sub("", md_text, count=1)
    lines = body.splitlines()
    out: list[str] = []
    i = 0
    in_ul = False
    in_ol = False
    in_table = False
    in_code = False

    def close_ul():
        nonlocal in_ul
        if in_ul:
            out.append("</ul>")
            in_ul = False

    def close_ol():
        nonlocal in_ol
        if in_ol:
            out.append("</ol>")
            in_ol = False

    def close_table():
        nonlocal in_table
        if in_table:
            out.append("</tbody></table>")
            in_table = False

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if stripped.startswith("```"):
            if not in_code:
                close_ul(); close_ol(); close_table()
                lang = stripped[3:].strip()
                out.append(f'<pre><code class="lang-{html_escape(lang)}">')
                in_code = True
            else:
                out.append("</code></pre>")
                in_code = False
            i += 1
            continue
        if in_code:
            out.append(html_escape(line))
            i += 1
            continue

        if stripped.startswith("# "):
            close_ul(); close_ol(); close_table()
            out.append(f"<h1>{format_inline(stripped[2:])}</h1>")
            i += 1; continue
        if stripped.startswith("## "):
            close_ul(); close_ol(); close_table()
            txt = stripped[3:]
            anchor = re.sub(r"[^a-z0-9]+", "-", txt.lower()).strip("-")
            out.append(f'<h2 id="{anchor}">{format_inline(txt)}</h2>')
            i += 1; continue
        if stripped.startswith("### "):
            close_ul(); close_ol(); close_table()
            txt = stripped[4:]
            anchor = re.sub(r"[^a-z0-9]+", "-", txt.lower()).strip("-")
            out.append(f'<h3 id="{anchor}">{format_inline(txt)}</h3>')
            i += 1; continue

        if stripped.startswith("|") and i + 1 < len(lines) and re.match(r"^\|[\s|:-]+\|", lines[i+1]):
            close_ul(); close_ol(); close_table()
            headers = [c.strip() for c in stripped.strip("|").split("|")]
            out.append("<table><thead><tr>" + "".join(f"<th>{format_inline(h)}</th>" for h in headers) + "</tr></thead><tbody>")
            in_table = True
            i += 2
            continue
        if in_table and stripped.startswith("|"):
            cells = [c.strip() for c in stripped.strip("|").split("|")]
            out.append("<tr>" + "".join(f"<td>{format_inline(c)}</td>" for c in cells) + "</tr>")
            i += 1
            continue
        if in_table and not stripped.startswith("|"):
            close_table()

        if re.match(r"^- ", stripped):
            close_ol(); close_table()
            if not in_ul:
                out.append("<ul>")
                in_ul = True
            out.append(f"<li>{format_inline(stripped[2:])}</li>")
            i += 1; continue
        if re.match(r"^\d+\. ", stripped):
            close_ul(); close_table()
            if not in_ol:
                out.append("<ol>")
                in_ol = True
            out.append(f"<li>{format_inline(re.sub(r'^\\d+\\.\\s*', '', stripped))}</li>")
            i += 1; continue
        if in_ul and not stripped:
            close_ul()
            i += 1; continue
        if in_ol and not stripped:
            close_ol()
            i += 1; continue
        if in_ul and not re.match(r"^- ", stripped):
            close_ul()
        if in_ol and not re.match(r"^\d+\. ", stripped):
            close_ol()

        if stripped.startswith(">"):
            close_ul(); close_ol()
            out.append(f"<blockquote>{format_inline(stripped[1:].strip())}</blockquote>")
            i += 1; continue

        if stripped.startswith("<details>"):
            close_ul(); close_ol()
            m = re.search(r"<summary>(.*?)</summary>", stripped)
            summary = format_inline(m.group(1)) if m else "Details"
            out.append(f"<details><summary>{summary}</summary>")
            i += 1; continue
        if stripped.startswith("</details>"):
            out.append("</details>")
            i += 1; continue

        if not stripped:
            i += 1; continue

        out.append(f"<p>{format_inline(stripped)}</p>")
        i += 1

    close_ul(); close_ol(); close_table()
    body_html = "\n".join(out)

    return (
        '<!doctype html>\n<html lang="en"><head>\n'
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        f'<title>{html_escape(title)}</title>\n'
        '<link rel="stylesheet" href="../app/css/chapter.css">\n'
        '</head><body>\n'
        '<nav class="chap-nav"><a href="../../index.html">\u2190 Question Bank home</a></nav>\n'
        '<article>\n' + body_html + '\n</article>\n</body></html>'
    )


# ---------------------------------------------------------------------------
# Build pipeline
# ---------------------------------------------------------------------------

def collect_question_files() -> list[Path]:
    files = []
    for sub in SUBJECT_DIRS:
        d = QBANK / sub
        if not d.exists():
            continue
        for p in sorted(d.iterdir()):
            if p.is_file() and " \u2014 Questions" in p.name and p.suffix == ".md":
                files.append(p)
    return files


def build():
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)
    (DIST / "data").mkdir()
    (DIST / "chapters").mkdir()

    all_q: list[dict] = []
    seen_ids: set[str] = set()
    errors: list[str] = []

    for qf in collect_question_files():
        try:
            qs = parse_chapter_file(qf)
        except Exception as e:
            errors.append(f"{qf.relative_to(ROOT)}: {e}")
            continue
        for q in qs:
            if q.id in seen_ids:
                errors.append(f"duplicate question id: {q.id}")
                continue
            seen_ids.add(q.id)
            all_q.append(q.to_json())

    if errors:
        print("BUILD FAILED:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)

    by_subject: dict[str, dict] = {}
    for q in all_q:
        s = q["subject"]
        if s not in by_subject:
            by_subject[s] = {"subject": s, "chapters": {}, "total": 0, "recall": 0, "apply": 0, "tricky": 0}
        ch_key = f"{q['chapter']:02d}"
        if ch_key not in by_subject[s]["chapters"]:
            by_subject[s]["chapters"][ch_key] = {"chapter": q["chapter"], "title": q["chapterTitle"], "questions": 0}
        by_subject[s]["chapters"][ch_key]["questions"] += 1
        by_subject[s]["total"] += 1
        by_subject[s][q["difficulty"]] += 1

    subjects_index = []
    for s in SUBJECT_DIRS:
        if s in by_subject:
            d = by_subject[s]
            d["chapters"] = [d["chapters"][k] for k in sorted(d["chapters"].keys())]
            subjects_index.append(d)

    raw = json.dumps(all_q, sort_keys=True).encode()
    qhash = hashlib.sha256(raw).hexdigest()[:12]

    (DIST / "data" / "questions.json").write_text(
        json.dumps({
            "version": int(time.time()),
            "questions": all_q,
            "subjects": subjects_index,
            "scoring": SCORING,
            "hash": qhash,
            "count": len(all_q),
        }, indent=2),
        encoding="utf-8",
    )
    (DIST / "data" / "build.json").write_text(json.dumps({
        "version": int(time.time()),
        "hash": qhash,
        "questionCount": len(all_q),
        "subjectCount": len(subjects_index),
        "scoring": SCORING,
        "generatedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
    }, indent=2), encoding="utf-8")

    if PWA_SRC.exists():
        shutil.copytree(PWA_SRC, DIST / "app")

    chapters_built = 0
    for sub in SUBJECT_DIRS:
        sub_dir = ROOT / sub
        if not sub_dir.exists():
            continue
        out_sub = DIST / "chapters" / sub
        out_sub.mkdir(parents=True, exist_ok=True)
        for p in sorted(sub_dir.iterdir()):
            if p.suffix != ".md":
                continue
            try:
                t_match = re.search(r"^# .+?$", p.read_text(encoding="utf-8"), re.MULTILINE)
                title = p.stem
                if t_match:
                    title = re.sub(r"^#\s*\d+\.?\s*", "", t_match.group(0)).strip()
                html = md_to_html(p.read_text(encoding="utf-8"), title)
                (out_sub / (p.stem + ".html")).write_text(html, encoding="utf-8")
                chapters_built += 1
            except Exception as e:
                print(f"  WARN: chapter {p}: {e}")

    print(f"[OK] Built {len(all_q)} questions across {len(subjects_index)} subjects")
    print(f"[OK] Converted {chapters_built} source chapters to HTML")
    print(f"[OK] Output: {DIST.relative_to(ROOT)}")
    print(f"[OK] Hash: {qhash}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--validate", action="store_true", help="validate only, no emit")
    ap.add_argument("--serve", action="store_true", help="build + serve on :8000")
    args = ap.parse_args()

    if args.validate:
        errors, seen = [], set()
        for qf in collect_question_files():
            try:
                qs = parse_chapter_file(qf)
                for q in qs:
                    if q.id in seen:
                        errors.append(f"duplicate id: {q.id}")
                    seen.add(q.id)
            except Exception as e:
                errors.append(f"{qf}: {e}")
        if errors:
            print("VALIDATION FAILED:")
            for e in errors:
                print(f"  - {e}")
            sys.exit(1)
        print(f"[OK] Validated {len(seen)} questions")
        return

    build()

    if args.serve:
        import http.server, socketserver
        os.chdir(DIST)
        with socketserver.TCPServer(("", 8000), http.server.SimpleHTTPRequestHandler) as httpd:
            print("Serving http://localhost:8000 (Ctrl+C to stop)")
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                pass


if __name__ == "__main__":
    main()



