"""Structural validator for *Questions.md files.

Checks that, for each file:
  - every `@q` has exactly one `@@` on its own line (count match)
  - every `<details>` has exactly one matching `</details>`
  - every question has exactly one `**Answer: X**` line

Usage:
  python tools/validate.py            # validates all subjects
  python tools/validate.py biology    # validates only biology
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SUBJECTS = [
    'biology', 'chemistry', 'physics', 'economics', 'polity',
    'history', 'geography', 'static-gk', 'Environment',
]


def validate_file(path: Path) -> list[str]:
    text = path.read_text(encoding='utf-8')
    q_count = len(re.findall(r'@q', text))
    end_count = len(re.findall(r'(?m)^@@$', text))
    det_open = len(re.findall(r'<details>', text))
    det_close = len(re.findall(r'</details>', text))
    ans_count = len(re.findall(r'\*\*Answer:\s*[A-D]\*\*', text))

    errors = []
    if q_count != end_count:
        errors.append(f'@q={q_count} but @@={end_count}')
    if det_open != det_close:
        errors.append(f'<details>={det_open} but </details>={det_close}')
    if q_count != ans_count:
        errors.append(f'@q={q_count} but Answer lines={ans_count}')
    return errors


def main():
    subjects = sys.argv[1:] or SUBJECTS
    bad = 0
    for subj in subjects:
        d = ROOT / subj
        if not d.exists():
            print(f'  skip: {subj} (dir not found)')
            continue
        files = sorted(d.rglob('*Questions*.md'))
        if not files:
            print(f'  skip: {subj} (no question files)')
            continue
        print(f'== {subj} ==')
        for f in files:
            errs = validate_file(f)
            if errs:
                bad += 1
                print(f'  BAD  {f.relative_to(ROOT)}  -> ' + ' | '.join(errs))
            else:
                # also count questions for the summary line
                text = f.read_text(encoding='utf-8')
                q = len(re.findall(r'@q', text))
                print(f'  OK   {f.name}  q={q}')
    print()
    if bad:
        print(f'FAILED: {bad} file(s) have structural errors.')
        sys.exit(1)
    print('All files structurally valid.')


if __name__ == '__main__':
    main()
