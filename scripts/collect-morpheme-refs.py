#!/usr/bin/env python3
"""Collect every morpheme reference used by course content.

Scanned (read-only):
  * exercise concepts[] (skip "c-..." concept ids), parts[], base/prefix/suffix
  * card morphemes[], matrix base/prefixes[].text/suffixes[].text,
    words[].parts[], sums[].parts[]
  * backtick-quoted single words inside body / title / prompt / explain /
    strategy / tagline

Deliberately skipped: terms[], choices[], accept[], answer, passage, excerpt —
those hold metalanguage, answer keys and prose, not morphological forms.

Usage:
  python scripts/collect-morpheme-refs.py            # frequency report
  python scripts/collect-morpheme-refs.py --json     # + scripts/morpheme-refs.json
  python scripts/collect-morpheme-refs.py --missing  # only forms absent from lexicon
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEEKS = ROOT / "src" / "content" / "weeks"
LEXICON = ROOT / "src" / "content" / "lexicon" / "morphemes.json"

BACKTICK = re.compile(r"`([^`\n]{1,40})`")
PROSE_KEYS = {"body", "title", "prompt", "explain", "strategy", "tagline", "hint", "sentence", "glossZh", "zh"}


def normalize(raw: str) -> str | None:
    s = raw.strip().strip(".,;:!?()[]\"'")
    s = s.strip("-").strip()
    if not s or s.startswith("c-") or " " in s:
        return None
    if not re.fullmatch(r"[A-Za-z][A-Za-z'-]*", s):
        return None
    s = s.replace("'", "").lower()
    return s if len(s) >= 2 else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--missing", action="store_true")
    args = ap.parse_args()

    hits: dict[str, Counter] = defaultdict(Counter)

    def add(raw, kind):
        f = normalize(raw)
        if f:
            hits[f][kind] += 1

    for path in sorted(WEEKS.glob("week*/day*.json")):
        lesson = json.loads(path.read_text(encoding="utf-8"))

        for ex in lesson.get("practice", []) + lesson.get("apply", []):
            for r in ex.get("concepts") or []:
                add(r, "concepts")
            for r in ex.get("parts") or []:
                add(r, "wordSum")
            for k in ("base", "prefix", "suffix"):
                if ex.get(k):
                    add(ex[k], "matrix")
            for k in ("body", "prompt", "explain", "strategy", "hint", "sentence"):
                for raw in BACKTICK.findall(str(ex.get(k) or "")):
                    add(raw, "backtick")

        for card in lesson.get("cards", []):
            for r in card.get("morphemes") or []:
                add(r, "card.morphemes")
            for k in ("base", "body", "title"):
                if card.get(k):
                    for raw in BACKTICK.findall(str(card[k])):
                        add(raw, "backtick")
            for cell in card.get("prefixes", []) + card.get("suffixes", []):
                add(cell.get("text", ""), "matrix")
            if card.get("base"):
                add(card["base"], "matrix")
            for w in card.get("words", []) or []:
                for p in w.get("parts") or []:
                    add(p, "matrix")
            for s in card.get("sums", []) or []:
                for p in s.get("parts") or []:
                    add(p, "wordSum")

        for k in ("tagline",):
            for raw in BACKTICK.findall(str(lesson.get(k) or "")):
                add(raw, "backtick")

    known = set()
    if LEXICON.exists():
        for m in json.loads(LEXICON.read_text(encoding="utf-8")):
            known.add(m["form"].replace("-", "").lower())
            for a in m.get("allomorphs") or []:
                known.add(a.replace("-", "").lower())
    missing = sorted(f for f in hits if f not in known)

    print(f"distinct forms: {len(hits)}")
    print(f"total references: {sum(sum(c.values()) for c in hits.values())}")
    if LEXICON.exists():
        print(f"not in lexicon: {len(missing)}")
    print()
    rows = [f for f in hits if not args.missing or f in missing]
    for form in sorted(rows, key=lambda f: (-sum(hits[f].values()), f)):
        c = hits[form]
        print(f"{form:<14} {sum(c.values()):>4}  " + ", ".join(f"{k}:{v}" for k, v in c.items()))

    if args.json:
        out = ROOT / "scripts" / "morpheme-refs.json"
        out.write_text(
            json.dumps({f: dict(c) for f, c in sorted(hits.items())}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"\nwrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
