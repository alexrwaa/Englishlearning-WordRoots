#!/usr/bin/env python3
"""Extract structure and reading text from the S2 Pressbooks WXR export.

S2 = *Essentials of Linguistics*, 2nd ed. (eCampusOntario Pressbooks),
licensed CC BY-NC-SA 4.0. Only the WXR (WordPress eXtended RSS) export is read;
the PDF/EPUB are never copied into the repository.

The script is a *local analysis tool*. Its output goes to analysis/s2/, which is
gitignored, and exists so that every knowledge point in s2-topics.json can be
traced back to a specific exported post (post_id) and heading.

Usage:
    python scripts/extract-s2.py --wxr <path-to.wxr.xml> --out analysis/s2 [--all]

--all   also dump the full chapter outline (every part/chapter, all statuses)
        instead of only the three focus parts.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {
    "wp": "http://wordpress.org/export/1.2/",
    "content": "http://purl.org/rss/1.0/modules/content/",
    "dc": "http://purl.org/dc/elements/1.1/",
}

# Parts (wp:post_type = part) that the grammar/morphology course draws on.
FOCUS = {
    "125": ("S2-C5", "Morphology"),
    "219": ("S2-C7", "Semantics"),
    "413": ("S2-C14", "Historical Linguistics"),
}

def text_of(item: ET.Element, tag: str) -> str:
    return item.findtext(tag, default="", namespaces=NS) or ""


ENTITY = {
    "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">",
    "&rsquo;": "'", "&lsquo;": "'", "&ldquo;": '"', "&rdquo;": '"',
    "&mdash;": "--", "&ndash;": "-", "&#8217;": "'", "&#8220;": '"',
    "&#8221;": '"', "&#8211;": "-", "&#8212;": "--", "&#8230;": "...",
    "&hellip;": "...", "&quot;": '"', "&#8216;": "'",
}


def html_to_lines(html: str) -> list[dict]:
    """Flatten a Pressbooks chapter body into heading/text/cell records.

    Pressbooks bodies mix wrapped and *unwrapped* prose (bare text between
    <h3> blocks), so tag-by-tag extraction loses content. Instead we turn block
    boundaries into newlines, record headings with a sentinel, then strip tags.
    Table cells become "cell" records because morphology tables carry most of
    the worked examples.
    """
    out: list[dict] = []
    html = re.sub(r"\[(embed|footnote|video|audio)[^\]]*\].*?\[/\1\]", " ", html, flags=re.I | re.S)
    html = re.sub(r"\[[^\]]{0,60}\]", " ", html)
    html = re.sub(r"<h([1-6])[^>]*>(.*?)</h\1>",
                  lambda m: f"\n\x00H{m.group(1)}\x00{m.group(2)}\n", html, flags=re.I | re.S)
    html = re.sub(r"<br\s*/?>", "\n", html, flags=re.I)
    html = re.sub(r"<hr\s*/?>", "\n", html, flags=re.I)
    html = re.sub(r"</t[dh]>", " \x01 ", html, flags=re.I)
    html = re.sub(r"</tr>", "\n", html, flags=re.I)
    html = re.sub(r"</(p|li|div|figcaption|blockquote|table|section|tbody)>", "\n", html, flags=re.I)
    html = re.sub(r"<[^>]+>", "", html)
    for k, v in ENTITY.items():
        html = html.replace(k, v)
    html = re.sub(r"&#(\d+);", lambda m: chr(int(m.group(1))), html)
    for raw_line in html.split("\n"):
        line = re.sub(r"\s+", " ", raw_line).strip(" \t")
        if not line:
            continue
        kind, tag = "text", "p"
        m = re.match(r"^\x00H([1-6])\x00(.*)$", line)
        if m:
            kind, tag, line = "heading", f"h{m.group(1)}", m.group(2).strip()
        elif "\x01" in line:
            kind, tag = "cell", "td"
            line = " | ".join(p.strip() for p in line.split("\x01") if p.strip())
        line = line.replace("\x00", "").strip()
        if line:
            out.append({"kind": kind, "tag": tag, "text": line})
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--wxr", required=True)
    ap.add_argument("--out", default="analysis/s2")
    ap.add_argument("--all", action="store_true")
    args = ap.parse_args()

    wxr = Path(args.wxr)
    if not wxr.exists():
        print(f"missing WXR: {wxr}", file=sys.stderr)
        return 2
    out_dir = Path(args.out)
    (out_dir / "sections").mkdir(parents=True, exist_ok=True)

    root = ET.parse(wxr).getroot()
    posts: dict[str, dict] = {}
    for item in root.findall("./channel/item"):
        ptype = text_of(item, "wp:post_type")
        if ptype not in ("part", "chapter", "front-matter", "back-matter", "glossary"):
            continue
        pid = text_of(item, "wp:post_id")
        posts[pid] = {
            "postId": pid,
            "type": ptype,
            "status": text_of(item, "wp:status"),
            "title": text_of(item, "title"),
            "slug": text_of(item, "wp:post_name"),
            "link": text_of(item, "link"),
            "order": int(text_of(item, "wp:menu_order") or 0),
            "parent": text_of(item, "wp:post_parent"),
            "body": text_of(item, "content:encoded"),
            "modified": text_of(item, "wp:post_modified"),
        }

    # ---------- full outline (every published part/chapter) ----------
    outline = []
    parts = sorted([p for p in posts.values() if p["type"] == "part" and p["status"] == "publish"],
                   key=lambda p: p["order"])
    for part in parts:
        kids = sorted([p for p in posts.values()
                       if p["type"] == "chapter" and p["parent"] == part["postId"] and p["status"] == "publish"],
                      key=lambda p: p["order"])
        outline.append({
            "partId": part["postId"],
            "partOrder": part["order"],
            "partTitle": part["title"],
            "chapters": [{"postId": k["postId"], "order": k["order"], "title": k["title"], "slug": k["slug"]}
                         for k in kids],
        })
    other = [{"postId": p["postId"], "type": p["type"], "title": p["title"], "status": p["status"]}
             for p in posts.values() if p["type"] in ("front-matter", "back-matter", "glossary")]
    (out_dir / "outline.json").write_text(
        json.dumps({"source": "S2", "parts": outline, "other": other}, ensure_ascii=False, indent=2),
        encoding="utf-8")

    # ---------- focus sections ----------
    anchors = []
    index = []
    for part_id, (cid, ctitle) in FOCUS.items():
        part = posts[part_id]
        kids = sorted([p for p in posts.values()
                       if p["type"] == "chapter" and p["parent"] == part_id and p["status"] == "publish"],
                      key=lambda p: p["order"])
        for n, ch in enumerate(kids, start=1):
            sid = f"{cid}-S{n}"
            lines = html_to_lines(ch["body"])
            para = [l for l in lines if l["kind"] != "heading"]
            plain = "\n".join(l["text"] for l in para)
            rec = {
                "sectionId": sid,
                "chapterId": cid,
                "chapterTitle": ctitle,
                "partTitle": part["title"],
                "postId": ch["postId"],
                "postTitle": ch["title"],
                "slug": ch["slug"],
                "url": ch["link"],
                "order": ch["order"],
                "modified": ch["modified"],
                "charCount": len(plain),
                "headings": [l["text"] for l in lines if l["kind"] == "heading"],
            }
            anchors.append(rec)
            index.append(rec)
            (out_dir / "sections" / f"{sid}.json").write_text(
                json.dumps({**rec, "lines": lines}, ensure_ascii=False, indent=1), encoding="utf-8")
            txt = [f"# {sid} {ch['title']}", f"<!-- post_id={ch['postId']} url={ch['link']} -->", ""]
            for l in lines:
                if l["kind"] == "heading":
                    txt.append(f"\n## {l['text']}")
                elif l["kind"] == "cell":
                    txt.append(f"| {l['text']}")
                else:
                    txt.append(l["text"])
            (out_dir / "sections" / f"{sid}.txt").write_text("\n".join(txt), encoding="utf-8")

    (out_dir / "anchors.json").write_text(
        json.dumps({"source": "S2", "wxr": wxr.name, "sections": anchors}, ensure_ascii=False, indent=2),
        encoding="utf-8")
    (out_dir / "index.json").write_text(
        json.dumps({"source": "S2", "sectionCount": len(index),
                    "sections": [{k: v for k, v in r.items() if k != "headings"} | {"headings": r["headings"]}
                                 for r in index]}, ensure_ascii=False, indent=2),
        encoding="utf-8")

    # ---------- front/back matter index (licence and author evidence) ----------
    (out_dir / "front-back-matter.json").write_text(
        json.dumps([{k: p[k] for k in ("postId", "type", "status", "title")} for p in posts.values()
                    if p["type"] in ("front-matter", "back-matter", "glossary")], ensure_ascii=False, indent=2),
        encoding="utf-8")

    total = sum(r["charCount"] for r in index)
    print(f"parts(published)={len(parts)} focusSections={len(index)} chars={total}")
    for part_id, (cid, ctitle) in FOCUS.items():
        n = len([r for r in index if r["chapterId"] == cid])
        print(f"  {cid} {ctitle}: {n} sections")
    print(f"wrote {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
