#!/usr/bin/env python3
"""Restore gen_data.py and normalize line endings to LF."""
from pathlib import Path

# The original runner script (the file content user pasted at start of conversation)
content = '''#!/usr/bin/env python3
"""Generate all 20 geography question bank files."""
from pathlib import Path
OUT = Path(r"C:\\Mockaroo\\Question Bank\\geography")
OUT.mkdir(parents=True, exist_ok=True)

def Q(num, title, slug, qs, see_also_extra):
    counts = {"recall":0,"apply":0,"tricky":0}
    for q in qs:
        counts[q["diff"]] += 1
    body = ("""---\\n"""
        f"""title: "{title} \\u2014 Questions"\\n"""
        """subject: geography\\n"""
        f"""chapter: {int(num)}\\n"""
        f"""tags: [question-bank, ssc, geography, {slug.replace('_','-')}]\\n"""
        f"""topic_id: [geography.{slug}.questions]\\n"""
        """---\\n\\n"""
        f"""# {title} \\u2014 Questions\\n\\n"""
        f"""> Source: [[../../geography/{num} - {title}|{title}]] | Subject: [[../../_MOCs/MOC - geography]]\\n\\n"""
        f"""A {len(qs)}-question MCQ set on {title.lower()} \\u2014 calibrated to SSC CGL Tier-I standard.\\n\\n"""
        """Scoring: SSC CGL rules \\u2014 **+2 correct, -0.50 wrong, 0 unattempted**.\\n\\n---\\n\\n""")
    for q in qs:
        bullets = "\\n".join(f"- {k}) {v}" for k, v in q["options"])
        body += (
            f"@q{q['id']} difficulty={q['diff']} subject=geography chapter={int(num)}\\n"
            f"{q['stem'].strip()}\\n\\n"
            f"{bullets}\\n"
            f"@@\\n\\n"
            f"<details><summary>Answer & explanation</summary>\\n\\n"
            f"**Answer: {q['answer']}**\\n\\n"
            f"{q['explanation'].strip()}\\n\\n"
            f"**Trap:** {q['trap'].strip()}\\n\\n"
            f"**See also:** {q['see_also'].strip()}\\n"
            f"</details>\\n\\n---\\n\\n"
        )
    ids_by_diff = {d: [q['id'].split('.')[-1] for q in qs if q['diff']==d] for d in ('recall','apply','tricky')}
    body += (
        "## Difficulty mix\\n\\n"
        "| Tier | Count | Question IDs |\\n| --- | --- | --- |\\n"
        f"| Recall | {counts['recall']} | {', '.join(ids_by_diff['recall'])} |\\n"
        f"| Apply | {counts['apply']} | {', '.join(ids_by_diff['apply'])} |\\n"
        f"| Tricky / two-step | {counts['tricky']} | {', '.join(ids_by_diff['tricky'])} |\\n\\n"
        "## Cross-references\\n\\n"
        f"- Source: [[../../geography/{num} - {title}]]\\n"
        "- Subject MOC: [[../../_MOCs/MOC - geography]]\\n"
        "- Vault index: [[../../Index]]\\n\\n"
        "## See also\\n\\n"
        f"{see_also_extra}\\n"
    )
    path = OUT / f"{num} - {title} \\u2014 Questions.md"
    path.write_text(body, encoding="utf-8")
    print(f"Wrote {path.name}  ({len(qs)}q: {counts})")
'''

# Decode escape sequences and write with LF
decoded = content.encode('utf-8').decode('unicode_escape').encode('latin-1').decode('utf-8')
path = Path(r"C:\Mockaroo\gen_data.py")
path.write_text(decoded, encoding='utf-8', newline='\n')
print(f"Wrote {path} ({path.stat().st_size} bytes)")
