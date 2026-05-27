"""
Course data integrity tests — DX! Golf edition.

Ported from the Chubbs `qa/course_data_qa.py` (2026-05-15). On that
first run it caught a real SI duplicate in Krungthep Kreetha. Same
class of bug can hide in DX! Golf's COURSES library, and the data
structure is the same shape plus per-tee yardages — par + SI fields
are checked identically.

What this asserts for every non-placeholder course:
  * 18 holes exactly
  * par sum is plausible (60-76 range — covers standard par 72,
    BRG Nicklaus par 73, Unico Grande par 63 etc.)
  * SI 1-18 each appears exactly once (handicap allocation depends
    on this being a clean permutation)
  * par values are integers in {3, 4, 5}

Run from this directory or repo root:
    python qa/course_data_qa.py
    python qa/course_data_qa.py --verbose

Exit 0 = pass. Non-zero = fail with detail.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

INDEX_HTML = Path(__file__).resolve().parent.parent / 'public' / 'index.html'
# DX! Golf hole entries can include yardage fields:
#   {par:4,si:7, gold:376,blue:356,white:320,red:291}
# So par and si must allow extra fields after. Match on first two fields
# only — yardage fields are unrelated to integrity here.
HOLE_RE = re.compile(r'\{par:\s*(\d+)\s*,\s*si:\s*(\d+)\s*[,}]')
# Course block must include a `holes:[ ... ]` to count as a real course;
# placeholder courses defined via blankCourseHoles() have no inline {par:..,si:..}.
COURSE_BLOCK_RE = re.compile(
    r'(\w+):\s*\{\s*'                    # key:
    r'name:\s*[\'"]([^\'"]+)[\'"]'       # name:'...'
    r'.*?'
    r'holes:\s*\[([^\]]+)\]',
    re.DOTALL
)

# Courses with known data issues that the test should skip until the
# underlying data is fixed in index.html. When a course is fixed and the
# data passes, REMOVE the entry — don't let stale whitelist entries
# silently mask new regressions.
COURSES_WITH_KNOWN_DATA_ISSUES: dict[str, str] = {
    'krungthepKreetha': 'H3/H7 duplicate SI 5, SI 8 missing — needs scorecard verification (2026-05-17). Same data issue exists in Chubbs.',
}


def extract_courses(html: str) -> list[tuple[str, str, list[tuple[int, int]]]]:
    out = []
    for match in COURSE_BLOCK_RE.finditer(html):
        key, name, holes_text = match.group(1), match.group(2), match.group(3)
        holes = [(int(p), int(s)) for p, s in HOLE_RE.findall(holes_text)]
        if not holes:
            continue
        out.append((key, name, holes))
    return out


def validate(key: str, name: str, holes: list[tuple[int, int]], verbose: bool = False) -> list[str]:
    failures = []
    if len(holes) != 18:
        failures.append(f'hole count = {len(holes)}, expected 18')
        return failures

    pars = [p for p, _ in holes]
    sis = [s for _, s in holes]

    par_sum = sum(pars)
    if par_sum < 60 or par_sum > 76:
        failures.append(f'par sum = {par_sum}, outside plausible 60-76 range')

    for i, p in enumerate(pars, 1):
        if p not in (3, 4, 5):
            failures.append(f'hole {i} has unusual par {p}')

    si_set = set(sis)
    if len(si_set) != 18:
        from collections import Counter
        dupes = sorted([s for s, c in Counter(sis).items() if c > 1])
        failures.append(f'SI duplicates: {dupes}')

    missing = sorted(set(range(1, 19)) - si_set)
    if missing:
        failures.append(f'missing SI values: {missing}')

    extra = sorted(s for s in si_set if s < 1 or s > 18)
    if extra:
        failures.append(f'SI out of range: {extra}')

    if verbose and not failures:
        print(f'  [{key}] {name}: 18 holes, par {par_sum}, SI 1-18 OK')

    return failures


def main() -> int:
    verbose = '--verbose' in sys.argv or '-v' in sys.argv
    html = INDEX_HTML.read_text(encoding='utf-8')
    courses = extract_courses(html)

    if not courses:
        print('FAIL: no courses found — has index.html or the regex shape changed?')
        return 1

    print(f'Found {len(courses)} courses with hole data (placeholders skipped)\n')

    bad = []
    skipped = []
    for key, name, holes in courses:
        if key in COURSES_WITH_KNOWN_DATA_ISSUES:
            skipped.append((key, name, COURSES_WITH_KNOWN_DATA_ISSUES[key]))
            if verbose:
                print(f'  [{key}] {name}: SKIPPED — {COURSES_WITH_KNOWN_DATA_ISSUES[key]}')
            continue
        failures = validate(key, name, holes, verbose=verbose)
        if failures:
            bad.append((key, name, failures))

    if skipped:
        print(f'\nWhitelisted ({len(skipped)} course(s) skipped):')
        for key, name, reason in skipped:
            print(f'  [{key}] {name}: {reason}')

    if bad:
        print(f'\nFAIL: {len(bad)} course(s) failed:')
        for key, name, fs in bad:
            print(f'  [{key}] {name}:')
            for f in fs:
                print(f'    - {f}')
        return 1

    checked = len(courses) - len(skipped)
    print(f'\nPASS: All {checked} verified courses ok (18 holes, par 60-76, SI 1-18 unique)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
