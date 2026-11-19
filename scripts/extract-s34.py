#!/usr/bin/env python3
"""Extract S3 (WordWorks SWI handouts) method notes and S4 (Swinton 1879) elements.

S3: the five PDF handouts are read for page-level method statements. The
practices below are paraphrases written for this project; every item carries
the source file and page it is derived from. No handout prose is copied.

S4: the Project Gutenberg plain text of *New Word-Analysis* (1879) is parsed
for Latin/Greek prefixes, suffixes and roots, plus Anglo-Saxon affixes.
Part IV's Anglo-Saxon root glossary (OE etyma with derivative lists) and
Part V are out of scope: they list etyma, not productive modern elements.
The Gutenberg file has no page numbers, so each element carries the section
and entry number instead of a page.

Outputs (paths relative to the repository root):
  src/content/textbook/s3-method.json
  src/content/textbook/s4-elements.json
  analysis/s3/extraction-report.json
  analysis/s4/summary.json
  analysis/s4/overlap.json
  analysis/s4/obsolete-claims.md

Run:  python scripts/extract-s34.py
"""

from __future__ import annotations

import json
import os
import re
import unicodedata
from collections import Counter
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MATERIALS = Path(os.environ.get("WORDROOTS_MATERIALS", REPO.parent / "materials-v2"))
S3_DIR = MATERIALS / "WordRoots教材资料包" / "03_WordWorks_SWI_Resources"
S4_TXT = MATERIALS / "WordRoots教材资料包" / "04_New_Word_Analysis" / "New-Word-Analysis-Gutenberg-19346.txt"

TEXTBOOK = REPO / "src" / "content" / "textbook"
ANALYSIS = REPO / "analysis"

TODAY = date.today().isoformat()

# ---------------------------------------------------------------------------
# S3 — method extracted from the handouts
# ---------------------------------------------------------------------------

S3_PRACTICES = [
    {
        "id": "swi-inquiry-cycle", "name": "结构化探究五步（Structured Word Inquiry cycle）",
        "questions": ["这个词里有什么值得追问的拼写现象？", "哪些词能把这个现象暴露出来？", "可以提出什么假设？", "怎样用证据检验假设？", "这个模式还能在哪些词上练习？"],
        "steps": [
            "用一个真实的拼写疑问抓住学生（讲义示例：为什么 <sign> 里有一个 <g>？）",
            "有目的地呈现一组词，让目标模式变得显著",
            "让学生根据这组证据提出假设",
            "引导学生检验假设，并说出精确的模式",
            "用合适工具（word sum、流程图）练习这个模式，并留下一个新问题",
        ],
        "source": "Handout-IDA-Fall-2012.pdf p.6；同一页块见 Handout-Gina-Baltimore.pdf p.4、Workshop-Booklet-IBIDA-Nov-2012.pdf p.4",
        "appUsedIn": "lesson",
    },
    {
        "id": "swi-four-questions", "name": "四问探究（意义—结构—同族—读音）",
        "questions": [
            "这个词（以及它的词基）是什么意思？",
            "它由哪些词素构成？",
            "这些词素还出现在哪些词里（同族词）？",
            "拼写与读音是什么关系，为什么读音变了拼写却不变？",
        ],
        "steps": [
            "先问意义：说出词基的核心义，并把它与现代词义对照（p.7 要求用词源参考核对词基的外延义）",
            "再问结构：写出 word sum，标出词基、前缀、后缀（p.6-7）",
            "再问同族：把同族词放进矩阵，检验它们是否共享词基的拼写与意义（p.7）",
            "最后问读音：比较同族词中词基的读音变化，说明拼写为何保持不变（p.3、p.5）",
            "四问中任何一问缺少证据，就回到假设而不是直接给结论",
        ],
        "note": "讲义没有把四问写成编号列表；本条的四个维度分别来自上述页码，编号形式是本项目为软件流程做的整合。",
        "source": "Handout-IDA-Fall-2012.pdf p.2, p.6-7；Handout-Gina-Baltimore.pdf p.3, p.5",
        "appUsedIn": "lesson",
    },
    {
        "id": "swi-word-sum", "name": "构词算式（word sum）",
        "questions": ["哪些部分是不可再分的词素？", "加上后缀时拼写发生了什么变化？"],
        "steps": [
            "把词基写在算式里（讲义用尖括号标记词基，如 <sign>）",
            "用 + 连接前缀、词基、后缀，左侧是词素层，右侧是实际拼写",
            "用重写箭头 → 表示合成，箭头上/旁标出后缀引起的变化（去 e、双写、y→i）",
            "整词必须是真实存在、能造句的词；不确定就查词典",
            "出声拼读整个算式：词素边界处停顿，digraph/trigraph 作为一个单位读出",
        ],
        "source": "Handout-IDA-Fall-2012.pdf p.7, p.9；Workshop-Booklet-IBIDA-Nov-2012.pdf p.10, p.12；Spelling-out-and-writing-out-word-structure-2018.pdf p.1, p.4",
        "appUsedIn": "wordSum",
    },
    {
        "id": "swi-word-sum-directions", "name": "合成与分析双向练习",
        "questions": ["给出一组词素，能否合成真词？", "给出一个词，能否拆到词基？"],
        "steps": [
            "合成（synthetic）：从词素出发写出整词，如 care + ful + ly → carefully",
            "分析（analytic）：从整词出发拆出词素，先判断它是单纯词基还是复杂词",
            "两种方向都要出声拼读并显示变化，不能只写答案",
        ],
        "source": "Handout-Gina-Baltimore.pdf p.9；Workshop-Booklet-IBIDA-Nov-2012.pdf p.12",
        "appUsedIn": "wordSum",
    },
    {
        "id": "swi-matrix", "name": "词族矩阵（word matrix）",
        "questions": ["这个词基能组成哪些真实单词？", "哪些词素位置能共同出现？"],
        "steps": [
            "先确定词基的拼写（不是发音），把它放在矩阵的基列",
            "用同族词收集候选成员，每个候选都要通过 word sum 检验",
            "前缀放左侧列，后缀放右侧/上方列，同一词素可以在不同列重复出现",
            "只保留能构成真实单词的组合；矩阵通常只显示部分可能词",
            "用最少的词素覆盖尽量多的词族成员（讲义的“优雅解”原则）",
        ],
        "source": "Handout-IDA-Fall-2012.pdf p.7；Workshop-Booklet-IBIDA-Nov-2012.pdf p.6, p.14-15",
        "appUsedIn": "matrix",
    },
    {
        "id": "swi-matrix-reading", "name": "矩阵阅读规则",
        "questions": ["从左到右读出的组合是不是一个完整单词？", "有没有跳过某一列？", "连接处发生了什么变化？"],
        "steps": [
            "从左到右读矩阵",
            "只构成单个、完整的单词",
            "不确定是否为真词时查词典；只构造能放进句子的词",
            "可以不取每一列的元素，但不能“跳列”（leapfrog）",
            "注意连接处（watch the joins）：加后缀时可能发生拼写变化",
        ],
        "source": "Handout-IDA-Fall-2012.pdf p.8；Workshop-Booklet-IBIDA-Nov-2012.pdf p.7, p.13",
        "appUsedIn": "matrix",
    },
    {
        "id": "swi-suffix-joins", "name": "后缀连接的三类变化",
        "questions": ["加这个后缀时词基末尾发生了什么？", "哪些后缀是元音后缀？"],
        "steps": [
            "先观察一个词基的完整矩阵（讲义用 <move>），列出所有 word sum",
            "比较有变化与无变化的连接，提出“哪些后缀会引起变化”的假设",
            "归纳三类变化：去掉不发音的 e、双写末尾单辅音、y 变 i",
            "用流程图把判断顺序固定下来，再用新词族检验假设",
        ],
        "source": "Workshop-Booklet-IBIDA-Nov-2012.pdf p.8-9；Bowers-Kirby-2010-morphological-instruction-study.pdf p.10（三类后缀变化的课程内容）",
        "appUsedIn": "wordSum",
    },
    {
        "id": "swi-spelling-out", "name": "出声拼读与书写拼读（spelling-out / writing-out-loud）",
        "questions": ["词素边界在哪里？", "哪些字母是一个 grapheme？", "哪里是真正的双写，哪里只是相邻同字母？"],
        "steps": [
            "在词素边界处停顿；单纯词基内部不停顿",
            "把 digraph/trigraph 和拼写标记作为一个单位读出，不拆成单个字母",
            "算式中有 + 号隔开的同字母只能逐个读，不能读作 double；没有 + 号隔开的连续同字母才读 double",
            "书写与出声同时进行（writing-out-loud），用多通道降低认知负荷",
            "把出声拼读当作评估工具：停顿和犹豫暴露学生的假设",
        ],
        "source": "Spelling-out-and-writing-out-word-structure-2018.pdf p.4-5；Bowers-Kirby-2010-morphological-instruction-study.pdf p.12",
        "appUsedIn": "wordSum",
    },
    {
        "id": "swi-spelling-meaning-evidence", "name": "用同族词证明“拼写标记意义”",
        "questions": ["为什么这个词的拼写看起来“不按读音”？", "同族词能否解释这个字母？"],
        "steps": [
            "选一个表面不规则的字母（如 <sign> 的 <g>）",
            "列出同族词（signal、signature、design），比较词基读音",
            "指出读音改变而词基拼写不变，说明拼写标记的是意义联系",
            "把结论写进 word sum 与矩阵，而不是补一条发音规则",
        ],
        "source": "Handout-IDA-Fall-2012.pdf p.2, p.5, p.7",
        "appUsedIn": "lesson",
    },
    {
        "id": "swi-etymology-check", "name": "词源核证与“意义回声”",
        "questions": ["词基的历史核心义是什么？", "现代词义里还能不能听到这个核心义的回声？"],
        "steps": [
            "用词源参考（讲义示例：etymonline、OED）核对词基的指称义",
            "比较核心义与当代词义：能对应则支持词族假设，不能对应则记录语义漂移甚至否证",
            "把词源证据与拼写结构证据分开记录，避免用词源替代结构分析",
        ],
        "source": "Handout-IDA-Fall-2012.pdf p.7, p.10；Workshop-Booklet-IBIDA-Nov-2012.pdf p.14-15（<image>/<imagine> 的意义检验）",
        "appUsedIn": "lesson",
    },
    {
        "id": "swi-family-search", "name": "词族检索：拼写序列 ≠ 词素",
        "questions": ["搜索到的词是否真的共享这个词基？", "它是否与词基有意义联系？"],
        "steps": [
            "先判断目标词是单纯词基还是复杂词；对复杂词先提出词基假设",
            "用词族检索工具按字母序列搜索（讲义示例：查 <imag> 而不是 <image>，才能找到 <imagine>）",
            "用“意义检验 + 拼写结构检验”双重筛选候选词",
            "把通过检验的词写成 word sum，再放进矩阵",
        ],
        "source": "Workshop-Booklet-IBIDA-Nov-2012.pdf p.14-15",
        "appUsedIn": "lesson",
    },
    {
        "id": "swi-hypothesis-chart", "name": "词缀假设墙（Affix Hypothesis Chart）",
        "questions": ["这个语段真的是后缀吗？", "有没有多个词能证明它？"],
        "steps": [
            "学生把怀疑是词缀的语段写在便利贴上，必须附一个 word sum",
            "贴在“假设区”，未经验证前不进入正式词素表",
            "教师定期用 word sum 和词典检验，证实后才进入已证词素表",
            "无法解决的假设放进“Wonder Wall”，留给后续探究",
        ],
        "source": "Workshop-Booklet-IBIDA-Nov-2012.pdf p.16-17",
        "appUsedIn": "lesson",
    },
    {
        "id": "swi-morphological-foil", "name": "识别假词素（morphological foil）",
        "questions": ["这段字母是词素，还是只是碰巧相同？", "去掉它以后，剩下的部分能独立表义吗？"],
        "steps": [
            "看到 <ing>、<er> 等熟悉语段时，先假设它可能是后缀",
            "检验剩余部分是否是可分析的词基（<spring> 的 <sp>、<wonderfully> 的 <wond> 都通不过）",
            "用 word sum 与词典否证错误切分，并说明理由",
        ],
        "source": "Spelling-out-and-writing-out-word-structure-2018.pdf p.3；Workshop-Booklet-IBIDA-Nov-2012.pdf p.18",
        "appUsedIn": "wordSum",
    },
    {
        "id": "swi-classroom-transfer", "name": "迁移到学科词汇",
        "questions": ["这个学科术语的词基是什么？", "它和哪些日常词同族？"],
        "steps": [
            "在阅读句子中顺手做结构分析（讲义示例：从 spring 里区分出真正的 <-ing>）",
            "把词结构知识用于科学、人文等学科术语，先拆词基再结合上下文",
            "把“拼写教学”转化为“词义分析教学”，让学生独立处理未教过的词",
        ],
        "source": "Workshop-Booklet-IBIDA-Nov-2012.pdf p.18",
        "appUsedIn": "lesson",
    },
]

S3_MATRIX_RULES = [
    {"rule": "从左到右读矩阵", "source": "Handout-IDA-Fall-2012.pdf p.8"},
    {"rule": "只构成单个、完整的单词（single, complete words）", "source": "Handout-IDA-Fall-2012.pdf p.8"},
    {"rule": "不确定是否为真词时查词典", "source": "Handout-IDA-Fall-2012.pdf p.8"},
    {"rule": "可以跳过整列，但不能“跳列”取元素（no leapfrogging）", "source": "Handout-IDA-Fall-2012.pdf p.8"},
    {"rule": "注意连接处：加后缀可能引起拼写变化", "source": "Handout-IDA-Fall-2012.pdf p.8"},
    {"rule": "只构造能放进句子的词（进阶班级规则）", "source": "Workshop-Booklet-IBIDA-Nov-2012.pdf p.7"},
    {"rule": "矩阵记录的是词素的底层词汇拼写（lexical spelling），不记录读音", "source": "Handout-IDA-Fall-2012.pdf p.7"},
    {"rule": "前缀在词基左侧列，后缀在右侧/上方列；同一词素可在不同列重复", "source": "Workshop-Booklet-IBIDA-Nov-2012.pdf p.14-15"},
    {"rule": "用最少的词素覆盖最多的词族成员（最优雅解）", "source": "Handout-IDA-Fall-2012.pdf p.6；Workshop-Booklet-IBIDA-Nov-2012.pdf p.15"},
    {"rule": "一个词能否进入矩阵，要用 word sum 检验", "source": "Handout-IDA-Fall-2012.pdf p.7"},
    {"rule": "矩阵通常只显示部分可能词，学生可以继续找更多", "source": "Handout-IDA-Fall-2012.pdf p.8"},
]

S3_WORD_SUM_RULES = [
    {"rule": "词素之间用 + 连接，左侧是词素层，右侧是实际拼写", "source": "Handout-IDA-Fall-2012.pdf p.7"},
    {"rule": "用重写箭头 → 表示“重写为”，箭头上标出后缀变化", "source": "Handout-IDA-Fall-2012.pdf p.7"},
    {"rule": "词基用尖括号标记，如 <sign>、<please>", "source": "Handout-IDA-Fall-2012.pdf p.7"},
    {"rule": "去掉不发音的 e：在算式里划掉该 e 再写下结果", "source": "Workshop-Booklet-IBIDA-Nov-2012.pdf p.8-9"},
    {"rule": "双写末尾辅音：在词基后加括号或双写标记（如 hop(p) + ing）", "source": "Spelling-out-and-writing-out-word-structure-2018.pdf p.4"},
    {"rule": "y 变 i：在算式里显示 y→i 的替换", "source": "Bowers-Kirby-2010-morphological-instruction-study.pdf p.10"},
    {"rule": "整词必须真实存在且能造句；不确定就查词典", "source": "Handout-IDA-Fall-2012.pdf p.8"},
    {"rule": "出声拼读：词素边界停顿，grapheme 成组读出", "source": "Spelling-out-and-writing-out-word-structure-2018.pdf p.4"},
    {"rule": "有 + 号隔开的相同字母不能读作 double；没有隔开的连续同字母才读 double", "source": "Spelling-out-and-writing-out-word-structure-2018.pdf p.4"},
    {"rule": "合成算式与分析算式都要练，分析时先判断是否为单纯词基", "source": "Handout-Gina-Baltimore.pdf p.9"},
    {"rule": "word sum 是科学分析工具，不是可随意改写的教学花样", "source": "Spelling-out-and-writing-out-word-structure-2018.pdf p.1-2"},
    {"rule": "在矩阵中卡住时，回到 word sum 重新检查结构", "source": "Workshop-Booklet-IBIDA-Nov-2012.pdf p.15"},
]

S3_PRINCIPLES = [
    {"principle": "英语拼写是一个为表义而组织的高度有序系统，可以用科学探究的方式研究", "source": "Handout-IDA-Fall-2012.pdf p.6"},
    {"principle": "同一词族的词基拼写保持稳定，读音可以变化；拼写标记意义联系", "source": "Handout-IDA-Fall-2012.pdf p.2, p.7"},
    {"principle": "不能用读音规则解释拼写；读音与拼写的关系要在形态框架内解释", "source": "Handout-IDA-Fall-2012.pdf p.4-5"},
    {"principle": "科学探究追求最优雅的解：能解释最多案例的最深结构", "source": "Handout-IDA-Fall-2012.pdf p.6"},
    {"principle": "区分“教师主导的探究”（teacher-led inquiry）与“由探究驱动的教学”（inquiry-led teaching）", "source": "Handout-IDA-Fall-2012.pdf p.6"},
    {"principle": "教学目标不是记住词根表，而是培养能独立提出并检验词结构假设的学习者", "source": "Handout-IDA-Fall-2012.pdf p.1, p.6"},
    {"principle": "发音、构词、词源三类证据要分开记录；拼写相似或历史同源都不等于现代构词关系", "source": "Handout-IDA-Fall-2012.pdf p.7；Workshop-Booklet-IBIDA-Nov-2012.pdf p.14-15"},
]

S3_RESEARCH_BASIS = [
    {"claim": "20 次课的结构化词结构教学显著提高了词素分析与词汇成绩，并迁移到“教过的词基 + 未教过的派生词”，但没有迁移到词基未教过的词", "source": "Bowers-Kirby-2010-morphological-instruction-study.pdf p.1（摘要）、p.13-17"},
    {"claim": "教学使用矩阵、word sum、出声拼读与流程图；课堂流程为“提出问题—呈现词集—提出假设—检验—练习”", "source": "Bowers-Kirby-2010-morphological-instruction-study.pdf p.11-12"},
    {"claim": "课程明确教授三类后缀变化（去 e、双写、y→i）与 free/bound base、twin bases 概念", "source": "Bowers-Kirby-2010-morphological-instruction-study.pdf p.10"},
]


def build_s3() -> dict:
    return {
        "$comment": "SWI method notes derived from the WordWorks handout set. Paraphrased for this project; no handout prose is reproduced. Page numbers refer to the PDF page (footer numbering in the handouts).",
        "sourceId": "S3",
        "title": "WordWorks SWI resources",
        "files": [
            "Bowers-Kirby-2010-morphological-instruction-study.pdf",
            "Handout-Gina-Baltimore.pdf",
            "Handout-IDA-Fall-2012.pdf",
            "Spelling-out-and-writing-out-word-structure-2018.pdf",
            "Workshop-Booklet-IBIDA-Nov-2012.pdf",
        ],
        "rights": "作者版权，仅本地分析，不再分发",
        "generatedAt": TODAY,
        "practices": S3_PRACTICES,
        "matrixRules": S3_MATRIX_RULES,
        "wordSumRules": S3_WORD_SUM_RULES,
        "principles": S3_PRINCIPLES,
        "researchBasis": S3_RESEARCH_BASIS,
    }


# ---------------------------------------------------------------------------
# S4 — parsing Swinton (1879)
# ---------------------------------------------------------------------------

def clean_gloss(text: str) -> str:
    text = text.replace("_", "")
    text = re.sub(r"^\s*=\s*", "", text)
    text = re.sub(r"\b(adj|n|v|adv)\.\s*", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip(" .,;=")


FUNCTION_SPANS = {"or", "and", "in comp", "in compos", "in composition", "french", "lat", "gr", "pl", "low latin"}


def clean_span(span: str) -> str:
    """Turn one italic span into a gloss: drop Latin principal parts and fillers."""
    text = span.strip(" .,;:")
    text = re.sub(r"\b[\w’']*['’][\w’']*\s*,?\s*", " ", text)
    text = re.sub(r"^(?:or|and|in comp\.?|in compos\.?)\s+", "", text, flags=re.I)
    text = re.sub(r"\s+", " ", text).strip(" .,;:")
    if text.lower().strip(".") in FUNCTION_SPANS or len(text) < 2:
        return ""
    return text


PRUNE_SEGMENTS = {"low lat", "low latin", "fr", "french", "pres. part", "past part", "radical", "pl", "in comp", "lat", "gr"}


def prune_gloss(gloss: str) -> str:
    parts = []
    for seg in gloss.split(";"):
        seg = clean_span(seg)
        if not seg or seg.lower().strip(".") in PRUNE_SEGMENTS:
            continue
        parts.append(seg)
    return "; ".join(dict.fromkeys(parts))


def gloss_from_italic(text: str) -> str:
    spans = [clean_span(s) for s in re.findall(r"_([^_]+)_", text)]
    spans = [s for s in spans if s]
    return prune_gloss("; ".join(dict.fromkeys(spans)))


def parse_affix_table(lines: list[str], start: int, end: int, kind: str) -> list[dict]:
    """Parse a two-column-ish affix table. Rows are grouped by blank lines."""
    groups: list[list[tuple[int, str]]] = []
    cur: list[tuple[int, str]] = []
    for i in range(start, end):
        line = lines[i]
        if not line.strip() or line.startswith(("NOTE", "Note", "SUFFIX", "Prefix", "_")):
            if cur:
                groups.append(cur)
                cur = []
            continue
        if line.startswith(" ") or "  " not in line:
            continue
        cur.append((i + 1, line))
    if cur:
        groups.append(cur)

    out = []
    for group in groups:
        rows: list[tuple[str, str | None, list[str]]] = []
        for page_line, line in group:
            parts = [p for p in re.split(r"\s{2,}", line.strip()) if p]
            token = parts[0]
            if kind == "prefix" and not token.endswith("-"):
                continue
            if kind == "suffix" and not token.startswith("-"):
                continue
            rest = parts[1:]
            ex_idx = None
            for j, part in enumerate(rest):
                if "-" in part and not part.startswith(("_", "=")) and not part.endswith("."):
                    ex_idx = j
                    break
            gloss_parts = rest[:ex_idx] if ex_idx is not None else rest
            example = rest[ex_idx] if ex_idx is not None else None
            rows.append((token, example, gloss_parts))
        if not rows:
            continue
        forms = []
        for token, _, _ in rows:
            form = token.strip("-").lower()
            if form and form not in forms:
                forms.append(form)
        canon = forms[0]
        if len(canon) == 1:
            canon = max(forms, key=len)
        gloss = clean_gloss(" ".join(p for _, _, gs in rows for p in gs))
        out.append({"token": rows[0][0], "forms": forms, "gloss": gloss, "line": group[0][0]})
    return out


GLOSS_FIXES = {
    ("prefix", "a"): ("ab", ["a", "ab", "abs"], "from, away"),
    ("prefix", "ad"): ("ad", ["ad", "a", "ac", "af", "ag", "al", "an", "ap", "ar", "as"], "to, toward"),
    ("prefix", "am"): ("am", ["am", "amb"], "around"),
    ("prefix", "bi"): ("bi", ["bi", "bis"], "two, twice"),
    ("prefix", "con"): ("con", ["con", "co", "col", "com", "cor"], "with, together"),
    ("prefix", "de"): ("de", ["de"], "down, off"),
    ("prefix", "dis"): ("dis", ["dis", "di", "dif"], "asunder, apart; opposite of"),
    ("prefix", "ex"): ("ex", ["ex", "e", "ec", "ef"], "out, from"),
    ("prefix", "extra"): ("extra", ["extra"], "beyond"),
    ("prefix", "in"): ("in", ["in", "il", "im", "ir", "en", "em"], "in, into, on"),
    ("prefix", "non"): ("non", ["non"], "not"),
    ("prefix", "ob"): ("ob", ["ob", "o", "oc", "of", "op"], "against, in the way; out"),
    ("prefix", "per"): ("per", ["per", "pel"], "through, thoroughly"),
    ("prefix", "post"): ("post", ["post"], "after, behind"),
    ("prefix", "pre"): ("pre", ["pre"], "before"),
    ("prefix", "re"): ("re", ["re", "red"], "back, anew"),
    ("prefix", "se"): ("se", ["se"], "aside, apart"),
    ("prefix", "sub"): ("sub", ["sub", "suc", "suf", "sug", "sum", "sup", "sus"], "under, after"),
    ("prefix", "subter"): ("subter", ["subter"], "under, beneath"),
    ("prefix", "super"): ("super", ["super"], "above, over"),
    ("prefix", "trans"): ("trans", ["trans", "tra"], "through, over, beyond"),
    ("prefix", "ultra"): ("ultra", ["ultra"], "beyond, extremely"),
    ("prefix", "ana"): ("ana", ["ana"], "up, back, again"),
    ("prefix", "dia"): ("dia", ["dia"], "through, across"),
    ("prefix", "epi"): ("epi", ["epi", "ep"], "upon; for"),
    ("prefix", "hypo"): ("hypo", ["hypo"], "under"),
    ("prefix", "para"): ("para", ["para", "par"], "beside, alongside"),
    ("prefix", "peri"): ("peri", ["peri"], "around"),
    ("prefix", "pro"): ("pro", ["pro"], "before, forth, forward"),
    ("prefix", "pros"): ("pros", ["pros"], "to, toward"),
    ("prefix", "syn"): ("syn", ["syn", "sy", "syl", "sym"], "with, together"),
    ("suffix", "able"): ("able", ["able", "ible", "ble"], "that may be, fit to be"),
    ("suffix", "aceous"): ("aceous", ["aceous", "acious"], "of, having the quality of"),
    ("suffix", "acy"): ("acy", ["acy"], "condition of being; office of"),
    ("suffix", "age"): ("age", ["age"], "act, condition, collection of"),
    ("suffix", "al"): ("al", ["al"], "relating to; the act of; that which"),
    ("suffix", "an"): ("an", ["an", "ane"], "relating to, befitting; one who"),
    ("suffix", "ance"): ("ance", ["ance", "ancy"], "state or quality of being"),
    ("suffix", "ant"): ("ant", ["ant"], "being; one who"),
    ("suffix", "ar"): ("ar", ["ar"], "relating to, like"),
    ("suffix", "ary"): ("ary", ["ary"], "relating to; one who; place where"),
    ("suffix", "ate"): ("ate", ["ate"], "one who is; having the quality of; to perform or cause"),
    ("suffix", "cle"): ("cle", ["cle", "cule"], "minute"),
    ("suffix", "ee"): ("ee", ["ee"], "one to whom"),
    ("suffix", "eer"): ("eer", ["eer", "ier"], "one who"),
    ("suffix", "ene"): ("ene", ["ene"], "having relation to"),
    ("suffix", "ence"): ("ence", ["ence", "ency"], "state of being; quality of"),
    ("suffix", "ent"): ("ent", ["ent"], "one who or which; being, -ing"),
    ("suffix", "escence"): ("escence", ["escence"], "state of becoming"),
    ("suffix", "escent"): ("escent", ["escent"], "becoming"),
    ("suffix", "ferous"): ("ferous", ["ferous"], "producing"),
    ("suffix", "fic"): ("fic", ["fic"], "making, causing"),
    ("suffix", "fice"): ("fice", ["fice"], "something done or made"),
    ("suffix", "fy"): ("fy", ["fy"], "to make"),
    ("suffix", "ic"): ("ic", ["ic"], "one who; like, made of, relating to"),
    ("suffix", "ical"): ("ical", ["ical"], "like, made of, relating to"),
    ("suffix", "ice"): ("ice", ["ice"], "that which"),
    ("suffix", "ics"): ("ics", ["ics", "ic"], "the science of"),
    ("suffix", "id"): ("id", ["id"], "being, -ing"),
    ("suffix", "ile"): ("ile", ["ile"], "relating to; apt for"),
    ("suffix", "ine"): ("ine", ["ine"], "relating to, like"),
    ("suffix", "ion"): ("ion", ["ion"], "the act of; state of being; -ing"),
    ("suffix", "ise"): ("ise", ["ise", "ize"], "to render, perform the act of"),
    ("suffix", "ism"): ("ism", ["ism"], "state or act of; idiom"),
    ("suffix", "ist"): ("ist", ["ist"], "one who practices or is devoted to"),
    ("suffix", "ite"): ("ite", ["ite", "yte"], "one who is; being"),
    ("suffix", "ity"): ("ity", ["ity", "ty"], "state or quality of being"),
    ("suffix", "ive"): ("ive", ["ive"], "one who is; having the power or quality"),
    ("suffix", "ix"): ("ix", ["ix"], "feminine"),
    ("suffix", "ment"): ("ment", ["ment"], "state of being; act of; that which"),
    ("suffix", "mony"): ("mony", ["mony"], "state or quality of; that which"),
    ("suffix", "or"): ("or", ["or"], "one who; that which; quality of"),
    ("suffix", "ory"): ("ory", ["ory"], "fitted or relating to; place where; that which"),
    ("suffix", "ose"): ("ose", ["ose", "ous"], "abounding in"),
    ("suffix", "tude"): ("tude", ["tude"], "condition or quality of"),
    ("suffix", "ty"): ("ty", ["ty"], "state or quality of being (variant of -ity)"),
    ("suffix", "ulent"): ("ulent", ["ulent"], "abounding in"),
    ("suffix", "ure"): ("ure", ["ure"], "act or state of; that which"),
}

GREEK_FIXES = {
    ("prefix", "hyper"): ("hyper", ["hyper"], "over, beyond"),
    ("prefix", "a"): ("a", ["a", "an"], "without, not"),
    ("prefix", "anti"): ("anti", ["anti", "ant"], "against, opposite"),
    ("prefix", "apo"): ("apo", ["apo", "ap"], "away, from"),
    ("prefix", "cata"): ("cata", ["cata", "cat"], "down, against"),
    ("prefix", "dia"): ("dia", ["dia"], "through, across"),
    ("prefix", "dis"): ("dis", ["dis", "di"], "two, double"),
    ("prefix", "ec"): ("ec", ["ec", "ex"], "out of"),
    ("prefix", "en"): ("en", ["en", "em"], "in, on"),
    ("prefix", "eu"): ("eu", ["eu", "ev"], "well, good"),
    ("prefix", "meta"): ("meta", ["meta", "met"], "beyond; transference"),
    ("prefix", "syn"): ("syn", ["syn", "sy", "syl", "sym"], "with, together"),
    ("prefix", "peri"): ("peri", ["peri"], "around"),
    ("prefix", "pro"): ("pro", ["pro"], "before"),
    ("prefix", "pros"): ("pros", ["pros"], "to, toward"),
}

AS_AFFIXES = [
    ("prefix", "a", ["a"], "in, on, at (reduced from OE on)"),
    ("prefix", "be", ["be"], "makes transitive; intensive; or denotes proximity"),
    ("prefix", "for", ["for"], "privation or opposition"),
    ("prefix", "fore", ["fore"], "before"),
    ("prefix", "mis", ["mis"], "error, wrongness"),
    ("prefix", "n", ["n"], "negative (as in never, neither, none)"),
    ("prefix", "off", ["off"], "from, away"),
    ("prefix", "out", ["out"], "beyond, surpassing"),
    ("prefix", "over", ["over"], "above, too much"),
    ("prefix", "to", ["to"], "to (as in to-day, to-morrow)"),
    ("prefix", "un", ["un"], "not, the reverse"),
    ("prefix", "under", ["under"], "beneath"),
    ("prefix", "with", ["with"], "against"),
    ("suffix", "ar", ["ar", "ard", "er", "yer", "ster"], "agent, doer"),
    ("suffix", "dom", ["dom", "ship", "ric", "wic"], "state, condition, quality"),
    ("suffix", "el", ["el", "kin", "let", "ling", "ock"], "diminutive"),
    ("suffix", "en", ["en"], "adjective ending; makes verbs from adjectives"),
    ("suffix", "fold", ["fold"], "numeral multiplier"),
    ("suffix", "ful", ["ful"], "full of"),
    ("suffix", "hood", ["hood", "ness"], "state, condition"),
    ("suffix", "ish", ["ish"], "having the quality of; somewhat"),
    ("suffix", "less", ["less"], "without"),
    ("suffix", "like", ["like", "ly"], "like; in the manner of"),
    ("suffix", "some", ["some"], "characterized by"),
    ("suffix", "teen", ["teen"], "ten (in numerals)"),
    ("suffix", "ty", ["ty"], "ten (in numerals)"),
    ("suffix", "ward", ["ward"], "direction toward"),
    ("suffix", "wise", ["wise"], "manner, way"),
    ("suffix", "y", ["y"], "adjective ending"),
]

# 1879 claims that current etymology no longer accepts. Keyed by (type, form).
OBSOLETE = {
    ("suffix", "ish", "L"): {
        "note": "1879 年把 -ish 释为“to make”（publish），现代词源学已修正：-ish 主要是日耳曼语形容词后缀（“having the quality of”）；publish 来自古法语 publier，并非由 -ish 构词。",
    },
    ("prefix", "dis", "G"): {
        "note": "1879 年把希腊语数词前缀 di-（“two, double”）写作 DIS-，现代词源学已修正：希腊语 di- 与拉丁语否定/分离前缀 dis- 来源不同，不应合并为一条。",
    },
    ("prefix", "n", "OE"): {
        "note": "1879 年把 n- 列为否定前缀，现代词源学已修正：never/neither/none 是 ne + 其他成分的词汇化结果，英语没有能产的 n- 否定前缀。",
    },
    ("suffix", "ic", "L"): {
        "note": "1879 年称 -ic/-ical 只见于希腊来源的拉丁词，现代词源学已修正：-ic 来自拉丁 -icus（本身常对应希腊 -ikos），但已广泛附着于非希腊来源的词干，不能作为来源判据。",
    },
    ("suffix", "ics", "L"): {
        "note": "1879 年称 -ics 只见于希腊来源，现代说法：-ics 经由拉丁 -ica < 希腊 -ika，但现代构词已不限于希腊词干。",
    },
    ("suffix", "fold", "OE"): {
        "note": "1879 年说 -fold 与 -ple 同类并“来自拉丁 plico”，现代词源学已修正：-fold 是日耳曼语固有后缀（OE -feald），与拉丁 -plex 同源但并非借自 plico。",
    },
    ("suffix", "hood", "OE"): {
        "note": "1879 年称 -hood/-ness 来源不确定，现代词源学已修正：-hood < OE -hād（“state, condition”），-ness < OE -nes/-nyss，均有明确日耳曼语来源。",
    },
}


def extend_header(lines: list[str], i: int, rest: str) -> str:
    """Join wrapped header/gloss lines (they continue until a blank line)."""
    j = i + 1
    while j < len(lines) and lines[j].strip() and j - i <= 3:
        nxt = lines[j].strip()
        if re.match(r"^[A-ZÆŒ][A-ZÆŒ'’\-]{0,14}:\s", nxt) or re.match(r"^\d+\.?\s+[A-Z]", nxt):
            break
        rest += " " + nxt
        j += 1
    return rest


def parse_latin_roots_div2(lines: list[str]) -> list[dict]:
    groups: list[dict] = []
    cur = None
    for i in range(2639, 5355):
        line = lines[i]
        m = re.match(r"^(\d+)\.?\s+([A-ZÆŒ][A-ZÆŒ'’\-]{1,24}(?:\s+(?:or|_or_)\s+[A-ZÆŒ][A-ZÆŒ'’\-]{1,24})?)(?::|,|;|\s\()\s*(.*)$", line)
        if m and not re.search(r"ANALYSIS|_v\.|_n\.|_adj\.| = ", line):
            cur = {"num": int(m.group(1)), "head": m.group(2), "rest": extend_header(lines, i, m.group(3)), "radicals": [], "line": i + 1}
            groups.append(cur)
            continue
        mm = re.match(r"^([A-ZÆŒ][A-ZÆŒ'’\-]{0,12}):\s", line)
        if mm and cur is not None:
            cur["radicals"].append(mm.group(1))
    return groups


def parse_latin_roots_div1(lines: list[str]) -> list[dict]:
    def is_root_rest(rest: str) -> bool:
        return bool(
            rest.startswith("_")
            or re.match(r"^[a-z]{1,}'", rest)
            or re.match(r"^[a-z]{2,},\s*_", rest)
            or re.match(r"^[A-Z][A-Z'’\-]+,", rest)
        )

    out = []
    for i in range(1325, 2639):
        m = re.match(r"^(\d+)\.\s+([A-Z][A-Z'’\-]{1,24})(?::|,|\s\()\s*(.*)$", lines[i])
        if not m or " = " in lines[i] or "ANALYSIS" in lines[i]:
            continue
        if not is_root_rest(m.group(3)):
            continue
        radicals = []
        for j in range(i, min(i + 8, len(lines))):
            mm = re.match(r"^\s*Radicals?:\s*(.+?)\.?$", lines[j])
            if mm:
                radicals = [r.strip(" .") for r in re.split(r",| and ", mm.group(1)) if r.strip(" .")]
                break
        out.append({"num": int(m.group(1)), "head": m.group(2), "rest": extend_header(lines, i, m.group(3)), "radicals": radicals, "line": i + 1})
    return out


GREEK_STEM_OVERRIDES = {
    "agon": "agon", "gramma": "gram", "angellein": "angel", "hudor": "hydr",
    "phos": "phot", "aner": "andr", "pous": "pod", "gyne": "gyn", "odon": "odont",
    "taktos": "takt", "titheni": "tithen", "hairein": "hairet", "zeugnymi": "zeug",
    "aroma": "arom", "soma": "som", "dogma": "dogm", "magma": "magm", "stigma": "stigm",
    "plasma": "plasm", "drama": "dram", "naus": "naut", "pais": "paid", "isos": "iso",
    "drus": "dry", "laos": "lao", "emein": "emet", "ode": "od", "basis": "bas",
    "chroma": "chrom", "trauma": "traumat", "schema": "schem", "stoma": "stom",
    "onoma": "onym", "gymnos": "gymn", "dunathai": "dyn",
}

GREEK_STRIP = ("eia", "ein", "ios", "os", "on", "ma", "is", "us", "es", "e", "a", "o", "y")


def greek_stem(lemma: str) -> str:
    s = lemma.replace("'", "").replace("’", "").lower()
    if s in GREEK_STEM_OVERRIDES:
        return GREEK_STEM_OVERRIDES[s]
    for suffix in GREEK_STRIP:
        if len(s) - len(suffix) >= 2 and s.endswith(suffix):
            return s[: -len(suffix)]
    return s


def parse_greek_roots_div1(lines: list[str]) -> list[dict]:
    out = []
    for i in range(5491, 6438):
        line = lines[i]
        m = re.match(r"^(\d+)\.\s+([A-Z][A-Z'’\-]{1,20})(?:\s*\(([^)]*)\))?\s*[,;:]?\s*(.*)$", line)
        if not m or re.search(r"ANALYSIS|_v\.|_n\.|_adj\.|What |Give |Compose ", line):
            continue
        if not re.match(r"^(_|[A-Za-z])", m.group(4)):
            continue
        rest = extend_header(lines, i, m.group(4))
        gloss = gloss_from_italic(rest) or clean_gloss(rest.split(";")[0])
        out.append({"num": int(m.group(1)), "head": m.group(2), "greek": m.group(3) or "", "gloss": gloss, "line": i + 1})
    return out


def parse_greek_roots_div2(lines: list[str]) -> list[dict]:
    out = []
    for i in range(6438, 6669):
        line = lines[i]
        if not line or line.startswith((" ", "_")):
            continue
        m = re.match(r"^([A-ZÆŒ][A-Z'’\-]+),\s*(.*)$", line)
        if not m or "  " in m.group(1):
            continue
        rest = m.group(2).split("--")[0]
        gloss = gloss_from_italic(rest) or clean_gloss(rest.split(";")[0])
        out.append({"head": m.group(1), "gloss": gloss, "line": i + 1, "rest": rest})
    return out


ROOT_FORM_FIXES = {
    "me": ["medi"],
    "pat": ["pat", "patr"],
    "empt": ["empt", "em"],
    "ut": ["ut", "us"],
}

ROOT_GLOSS_FIXES = {
    "cub": "to lie down",
    "empt": "to buy or take",
    "bi": "two, twice",
    "cult": "to till, to cultivate",
    "ten": "to hold",
    "tract": "to draw",
}


def element_id(kind: str, form: str) -> str:
    slug = unicodedata.normalize("NFKD", form).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", slug.lower()).strip("-")
    return f"s4-{kind}-{slug}"


def build_s4_elements() -> tuple[list[dict], dict]:
    raw = S4_TXT.read_text(encoding="utf-8-sig").split("\n")

    elements: list[dict] = []
    seen: dict[tuple[str, str], dict] = {}

    def add(el: dict) -> None:
        key = (el["type"], el["forms"][0], el["source"])
        if key in seen:
            # same form + same origin: keep the gloss with more information
            old = seen[key]
            for f in el["forms"]:
                if f not in old["forms"]:
                    old["forms"].append(f)
            if len(el["gloss"]) > len(old["gloss"]) and not el.get("obsolete"):
                old["gloss"] = el["gloss"]
            return
        used = {e["id"] for e in elements}
        base = el["id"]
        n = 2
        while el["id"] in used:
            el["id"] = f"{base}-{n}"
            n += 1
        seen[key] = el
        elements.append(el)

    # --- affix tables ---
    tables = [
        ("prefix", 537, 700, "Part II, I. Latin prefixes", "L"),
        ("suffix", 704, 944, "Part II, II. Latin suffixes", "L"),
        ("prefix", 5359, 5441, "Part III, I. Greek prefixes", "G"),
    ]
    for kind, start, end, chapter, origin in tables:
        for row in parse_affix_table(raw, start, end, kind):
            fix = (GLOSS_FIXES if origin == "L" else GREEK_FIXES).get((kind, row["forms"][0]))
            forms, gloss = (fix[1], fix[2]) if fix else (row["forms"], row["gloss"])
            el = {
                "id": element_id(kind, forms[0]),
                "element": (forms[0] + "-") if kind == "prefix" else ("-" + forms[0]),
                "forms": forms,
                "type": kind,
                "gloss": gloss,
                "chapter": chapter,
                "source": origin,
                "sourceOrigin": origin,
                "page": None,
                "locator": f"Gutenberg #19346, near line {row['line']}",
            }
            add(el)

    # --- Anglo-Saxon affixes (prose sections, curated from the text) ---
    for kind, canon, forms, gloss in AS_AFFIXES:
        el = {
            "id": element_id(kind, canon),
            "element": (canon + "-") if kind == "prefix" else ("-" + canon),
            "forms": forms,
            "type": kind,
            "gloss": gloss,
            "chapter": "Part IV, I-II. Anglo-Saxon prefixes and suffixes",
            "source": "OE",
            "sourceOrigin": "OE",
            "page": None,
            "locator": "Gutenberg #19346, Part IV sections I-II",
        }
        add(el)

    # --- Latin roots (Division II: radicals are explicit) ---
    div2 = parse_latin_roots_div2(raw)
    for group in div2:
        gloss = gloss_from_italic(group["rest"]) or clean_gloss(group["rest"].split(";")[0])
        radicals = group["radicals"] or [re.sub(r"['’].*$", "", group["head"]).lower()]
        forms = [re.sub(r"['’]", "", r).strip("-").lower() for r in radicals if r]
        el = {
            "id": element_id("root", forms[0]),
            "element": "~".join(forms),
            "forms": forms,
            "type": "root",
            "gloss": gloss,
            "chapter": "Part II, Latin roots and English derivatives",
            "source": "L",
            "sourceOrigin": "L",
            "page": None,
            "locator": f"Gutenberg #19346, Latin root entry {group['num']} (line {group['line']})",
            "bookEntry": group["num"],
        }
        el["forms"] = ROOT_FORM_FIXES.get(el["forms"][0], el["forms"])
        el["element"] = "~".join(el["forms"])
        el["gloss"] = ROOT_GLOSS_FIXES.get(el["forms"][0], el["gloss"])
        add(el)

    # --- Latin roots (Division I adds method-study roots + gloss detail) ---
    div1 = parse_latin_roots_div1(raw)
    for group in div1:
        gloss = gloss_from_italic(group["rest"]) or clean_gloss(group["rest"].split(";")[0])
        forms = [re.sub(r"['’]", "", r).strip("-").lower() for r in group["radicals"] if r]
        if not forms:
            head = re.sub(r"['’]", "", group["head"]).lower()
            head = re.sub(r"(ere|are|ire|us|um|is|es|a)$", "", head)
            forms = [head]
        el = {
            "id": element_id("root", forms[0]),
            "element": "~".join(forms),
            "forms": forms,
            "type": "root",
            "gloss": gloss,
            "chapter": "Part II, Division I (method of study)",
            "source": "L",
            "sourceOrigin": "L",
            "page": None,
            "locator": f"Gutenberg #19346, Latin root entry {group['num']} (line {group['line']})",
            "bookEntry": group["num"],
        }
        add(el)

    # --- Greek roots ---
    for group in parse_greek_roots_div1(raw):
        form = greek_stem(group["head"])
        el = {
            "id": element_id("root", form),
            "element": "~".join([form]),
            "forms": [form],
            "type": "root",
            "gloss": group["gloss"],
            "chapter": "Part III, Division I (principal Greek roots)",
            "source": "G",
            "sourceOrigin": "G",
            "page": None,
            "locator": f"Gutenberg #19346, Greek root entry {group['num']} (line {group['line']})",
            "lemma": group["head"].replace("'", "").replace("’", "").lower(),
        }
        add(el)

    for group in parse_greek_roots_div2(raw):
        form = greek_stem(group["head"])
        el = {
            "id": element_id("root", form),
            "element": "~".join([form]),
            "forms": [form],
            "type": "root",
            "gloss": group["gloss"],
            "chapter": "Part III, Division II (additional Greek roots)",
            "source": "G",
            "sourceOrigin": "G",
            "page": None,
            "locator": f"Gutenberg #19346, line {group['line']}",
            "lemma": group["head"].replace("'", "").replace("’", "").lower(),
        }
        add(el)

    # --- obsolete flags ---
    flagged = 0
    for el in elements:
        for form in el["forms"]:
            ob = OBSOLETE.get((el["type"], form, el["source"]))
            if ob:
                el["obsolete"] = True
                el["note"] = ob["note"]
                flagged += 1
                break

    elements.sort(key=lambda e: (e["type"], e["forms"][0]))
    stats = {
        "total": len(elements),
        "byType": dict(Counter(e["type"] for e in elements)),
        "byOrigin": dict(Counter(e["source"] for e in elements)),
        "latinRootGroups": len(div2) + len(div1),
        "greekRoots": len(parse_greek_roots_div1(raw)) + len(parse_greek_roots_div2(raw)),
        "obsolete": flagged,
    }
    return elements, stats


# ---------------------------------------------------------------------------
# Overlap with S1
# ---------------------------------------------------------------------------

S1_POS_GLOSS = {"A", "N", "V", "ADJ", "ADV"}


STOP = {"a", "an", "the", "to", "of", "or", "and", "in", "into", "on", "with", "that", "which", "be", "being", "one", "who", "is", "as", "by", "for", "from", "at"}


def gloss_tokens(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z]+", text.lower()) if w not in STOP and len(w) > 1}


CONFLICT_NOTES = {
    "a": "S1 的 a- 是否定前缀（希腊 a-），S4 的 OE a- 是 on 的弱化形式（“in, on, at”），同形异源。S4 拉丁 a- 已并入 ab- 条。",
    "in": "S1 的 in- 只列否定义；S4 拉丁 in- 同时列“in, into”（include）与“not”（insane）两组，必须按义项分开，不能合并成一条。",
    "dis": "S1 的 dis- 是拉丁“apart”（分离/否定），S4 希腊 dis- 实际是数词 di-（“two”），同形异源。",
    "anti": "S1 把 anti- 与 ante- 合为“before”；S4 的希腊 anti- 是“against, opposite”。二者历史来源与意义都不同。",
    "acr": "S1 的 acr 是“height, tip”（希腊 akros），S4 的 acr 是“sharp”（拉丁 acer），同形异源，不能合并为一个词根。",
    "ag": "S1 的 ag 是“act, do, drive”（拉丁 agere），S4 希腊条目 ag 是“to lead”（希腊 agein），同形异源。",
    "ed": "S1 的 ed 是“eat”（拉丁 edere），S4 的 ed 是“house”（拉丁 aedes），同形异源。",
    "ger": "S1 的 ger 是“old person”（希腊 geron），S4 的 ger~gest 是“to bear, carry”（拉丁 gerere），同形异源。",
    "her": "S1 的 her 是“to stick, hold back”（拉丁 haerere），S4 的 her 是“hero”（希腊 heros），同形异源。",
    "hom": "S1 的 hom 是“human”（拉丁 homo），S4 的 hom 是“like, same”（希腊 homos），同形异源。",
    "hor": "S1 的 hor 是“hour”（拉丁 hora），S4 的 hor 是“boundary”（希腊 horos），同形异源。",
    "metr": "S1 的 metr 是“mother, uterus”（希腊 metra），S4 的 metr 是“measure”（希腊 metron），同形异源。",
    "mon": "S1 的 mon 是“think, mind”（拉丁 monere），S4 的 mon 是“sole, alone”（希腊 monos），同形异源。",
    "par": "S1 的 par 是“all”（拉丁 par? 见 S1 条），S4 的 par 是“equal”（拉丁 par），需按 S1 原始条目复核；两者至少不能直接合并。",
    "pol": "S1 的 pol 是“community”（希腊 polis），S4 的 pol 是“to sell”（希腊 polein），同形异源。",
    "strat": "S1 的 strat 是“stretch, level, layer”（拉丁 stratum），S4 的 strat 是“army”（希腊 stratos），同形异源。",
    "tel": "S1 的 tel 是“end, complete”（希腊 telos），S4 的 tel 是“far off”（希腊 tele），同形异源。",
    "vad": "S1 的 vas 是“vessel, duct”（拉丁 vas），S4 的 vad~vas 是“to go”（拉丁 vadere），同形异源。",
    "empt": "S1 的 empt 是“blood”（希腊 haima 的变体? 见 S1 条），S4 的 empt~em 是“to buy, take”（拉丁 emere），同形异源。",
}

def build_overlap(elements: list[dict]) -> dict:
    s1 = json.loads((TEXTBOOK / "s1-elements.json").read_text(encoding="utf-8"))["elements"]
    index: dict[tuple[str, str], list[dict]] = {}
    for el in s1:
        for form in el["forms"]:
            index.setdefault((el["type"], form.lower()), []).append(el)

    matched, s4_only, conflicts = [], [], []
    seen_conflicts = set()

    for el in elements:
        s4_tokens = gloss_tokens(el["gloss"])
        best = None
        best_score = 0
        for form in el["forms"]:
            for cand in index.get((el["type"], form.lower()), []):
                score = len(s4_tokens & gloss_tokens(cand["gloss"]))
                if score > best_score:
                    best, best_score = cand, score
        if best is None:
            # fall back to a bare form match (suffix glosses in S1 are POS codes)
            for form in el["forms"]:
                cands = index.get((el["type"], form.lower()))
                if cands:
                    best = cands[0]
                    best_score = 0
                    break
        if best is None:
            s4_only.append({"id": el["id"], "element": el["element"], "type": el["type"], "gloss": el["gloss"]})
            continue

        quality = "gloss" if best_score else "form-only"
        matched.append({
            "id": el["id"],
            "element": el["element"],
            "type": el["type"],
            "s1Element": best["element"],
            "s1Gloss": best["gloss"],
            "s4Gloss": el["gloss"],
            "matchQuality": quality,
        })

        key = el["forms"][0]
        if quality == "form-only" and key in CONFLICT_NOTES and (el["type"], key) not in seen_conflicts:
            seen_conflicts.add((el["type"], key))
            conflicts.append({
                "element": el["element"],
                "type": el["type"],
                "s1Gloss": best["gloss"],
                "s4Gloss": el["gloss"],
                "note": CONFLICT_NOTES[key],
            })

    return {
        "$comment": "S4 (Swinton 1879) elements checked against S1. Matching is by form, then by gloss-token overlap; `matchQuality: form-only` means the form matches but the glosses share no content word and the pair needs human review. Suffix glosses in S1 are part-of-speech codes (A/N/V), so suffix pairs are always form-only.",
        "generatedAt": TODAY,
        "s4Count": len(elements),
        "s1Count": len(s1),
        "matchedCount": len(matched),
        "s4OnlyCount": len(s4_only),
        "conflictCount": len(conflicts),
        "matched": matched,
        "s4Only": s4_only,
        "conflicts": conflicts,
    }


def write_obsolete_md(elements: list[dict]) -> None:
    lines = [
        "# S4 历史词源结论复核（Swinton, *New Word-Analysis*, 1879）",
        "",
        "原则：不因书老而整体否定，也不整体照抄。下列条目是 1879 年说法与现代词源学明显不一致的部分，",
        "已在 `src/content/textbook/s4-elements.json` 中加 `obsolete: true` 与 `note`；其余条目仍需按现代词典逐条复核后才能进课堂。",
        "",
        "| 类型 | 成分 | 1879 说法 | 现代修正 |",
        "| --- | --- | --- | --- |",
    ]
    for el in elements:
        if not el.get("obsolete"):
            continue
        orig = S4_ORIGINAL_GLOSS.get((el["type"], el["forms"][0], el["source"]), el["gloss"])
        lines.append(f"| {el['type']} | `{el['element']}` | {orig} | {el['note']} |")
    lines += [
        "",
        "## 复核方法",
        "",
        "- 只标记能够明确判断为过时或混淆的条目；存疑但无法确证的条目不标，留待人工复核。",
        "- 复核依据是现代历史语言学与词典词源的通行结论（词源分层、借词路径、能产性），不是“新书一定对”。",
        "- 1879 年书中仍有价值的部分：古典词根清单、拉丁/希腊语素的形式对应、以及大量可用于课堂的派生词例。",
        "",
        f"共标记 {sum(1 for e in elements if e.get('obsolete'))} 条。生成日期：{TODAY}。",
    ]
    (ANALYSIS / "s4").mkdir(parents=True, exist_ok=True)
    (ANALYSIS / "s4" / "obsolete-claims.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


S4_ORIGINAL_GLOSS = {
    ("suffix", "ish", "L"): "= to make (publ-ish)",
    ("prefix", "dis", "G"): "DIS- = two, double (the Greek numeral prefix)",
    ("prefix", "n", "OE"): "has a negative signification (never, neither, none)",
    ("suffix", "ic", "L"): "found only in Latin words of Greek origin",
    ("suffix", "ics", "L"): "found only in Latin words of Greek origin",
    ("suffix", "fold", "OE"): "numeral termination, like -ple, from the Latin plico",
    ("suffix", "hood", "OE"): "of uncertain derivation (with -ness)",
}


def main() -> None:
    s3 = build_s3()
    TEXTBOOK.mkdir(parents=True, exist_ok=True)
    (TEXTBOOK / "s3-method.json").write_text(json.dumps(s3, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    elements, stats = build_s4_elements()
    s4 = {
        "$comment": "Elements extracted from the Project Gutenberg plain text of Swinton (1879). No page numbers exist in the source; `locator` gives the section/entry. `obsolete` marks claims modern etymology has corrected.",
        "sourceId": "S4",
        "title": "New Word-Analysis (School Etymology of English Derivative Words)",
        "author": "William Swinton",
        "year": 1879,
        "rights": "Public domain (Project Gutenberg #19346); derived facts only, no source text reproduced.",
        "generatedAt": TODAY,
        "count": len(elements),
        "scope": "Latin and Greek prefixes, suffixes and roots; Anglo-Saxon prefixes and suffixes. Part IV's Anglo-Saxon root glossary (OE etyma) and Part V are excluded.",
        "elements": elements,
    }
    (TEXTBOOK / "s4-elements.json").write_text(json.dumps(s4, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    (ANALYSIS / "s3").mkdir(parents=True, exist_ok=True)
    (ANALYSIS / "s3" / "extraction-report.json").write_text(
        json.dumps({
            "generatedAt": TODAY,
            "practiceCount": len(S3_PRACTICES),
            "matrixRuleCount": len(S3_MATRIX_RULES),
            "wordSumRuleCount": len(S3_WORD_SUM_RULES),
            "principleCount": len(S3_PRINCIPLES),
            "practices": [{"id": p["id"], "name": p["name"], "source": p["source"], "appUsedIn": p["appUsedIn"]} for p in S3_PRACTICES],
        }, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
    )

    overlap = build_overlap(elements)
    (ANALYSIS / "s4").mkdir(parents=True, exist_ok=True)
    (ANALYSIS / "s4" / "overlap.json").write_text(json.dumps(overlap, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (ANALYSIS / "s4" / "summary.json").write_text(json.dumps(stats, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    write_obsolete_md(elements)

    print(json.dumps({"s3": {"practices": len(S3_PRACTICES)}, "s4": stats, "overlap": {
        "matched": overlap["matchedCount"], "s4Only": overlap["s4OnlyCount"], "conflicts": overlap["conflictCount"]}}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
