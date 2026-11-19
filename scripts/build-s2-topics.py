#!/usr/bin/env python3
"""Build the S2 (Essentials of Linguistics, 2nd ed.) knowledge-point model.

Writes:
    src/content/textbook/s2-topics.json   committed
    src/content/textbook/glossary-s2.json committed
    analysis/s2/kp-source-map.json        local only (gitignored) — kp -> section/post

The prose in `summary` is written for this project; it paraphrases what each
section teaches and never reproduces the textbook's sentences. Section titles
stay in English because they are the book's own structural labels and the
mapping back to the source has to be checkable.

Usage:
    python scripts/build-s2-topics.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_TOPICS = ROOT / "src" / "content" / "textbook" / "s2-topics.json"
OUT_GLOSS = ROOT / "src" / "content" / "textbook" / "glossary-s2.json"
OUT_MAP = ROOT / "analysis" / "s2" / "kp-source-map.json"

# ---------------------------------------------------------------- knowledge points
# (title, type, summary, terms, examples, lessonHint, crossRef)
# types:    concept | rule | classification | history | method
# lessonHint: 基础 | 拼写 | 拉丁 | 希腊 | 词源 | 新词 | 科技 | advanced
KP: dict[str, list[tuple]] = {}

KP["S2-C5-S1"] = [
    ("形态学研究词的内部构造", "concept",
     "形态学考察词由哪些更小单位组装；英语多数词只含一两个成分，专业术语可含五个以上。",
     [("morphology", "形态学"), ("morphologically complex", "形态复杂")],
     ["cats", "non-renewability", "iglujjualiulauqtuq"], "基础", ["S1-C3-S1"]),
    ("词定义不能依赖空格", "concept",
     "以书写空格界定词只适用于有正字法的语言，语言学改用「能独立出现的最小单位」这一标准。",
     [("orthographic definition", "正字法定义"), ("word", "词")],
     ["cake", "slowly"], "基础", ["S1-C3-S1"]),
    ("语素是最小的形义配对", "concept",
     "语素是形式与意义（或语法功能）的最小系统配对；只含一个语素的词形态简单，否则形态复杂。",
     [("morpheme", "语素"), ("morphologically simple", "形态简单")],
     ["cat", "cat-s"], "基础", ["S1-C3-S1"]),
    ("形态复杂度是共时判断", "rule",
     "一个词是否形态复杂取决于当代使用者是否切分它，与其希腊语或拉丁语来源无关；不同人的判断可以不同。",
     [("etymology", "词源"), ("grammar", "语法")],
     ["morphology", "morph-", "-ology"], "词源", ["S1-C3-S21"]),
]

KP["S2-C5-S2"] = [
    ("词缀、词基与词根", "concept",
     "词缀必须依附他物；被依附的成分叫词基，词基可简单可复杂；不能再分的简单词基就是词根。",
     [("affix", "词缀"), ("base", "词基"), ("root", "词根")],
     ["librarian", "librarianship", "library"], "基础", ["S1-C3-S3"]),
    ("历史词根与共时词根可能不一致", "concept",
     "library、nation 源自拉丁 libr-、nat-，但当代母语者多把整词当作单纯词根处理。",
     [("root", "词根"), ("morphologically complex", "形态复杂")],
     ["library", "nation", "libr-", "nat-"], "词源", ["S1-C3-S21"]),
    ("词缀按位置分五类", "classification",
     "前缀在前、后缀在后、环缀环绕词基、中缀插入词基内部、同时词缀与词基同时发生（多见于手语与声调语）。",
     [("prefix", "前缀"), ("suffix", "后缀"), ("circumfix", "环缀"),
      ("infix", "中缀"), ("simultaneous affix", "同时词缀")],
     ["international", "cats", "ne-ta·nes-ena·n-aki"], "基础", ["S1-C3-S4"]),
    ("中缀必须插入语素内部", "rule",
     "仅在词的中间出现不算中缀；unluckiness 的 -y 仍是后缀，因为它接在词基 luck 之后。",
     [("infix", "中缀"), ("suffix", "后缀")],
     ["unluckiness", "Tagalog -um-"], "基础", ["S1-C3-S4"]),
    ("间行标注读法", "method",
     "规范例句分三行：原文、逐语素释义、整句翻译；1/PL/AN 等缩略语分别表示第一人称、复数、有生。",
     [("interlinear gloss", "间行标注"), ("gloss", "释义")],
     ["ne-ta·nes-aki"], "advanced", ["S1-C3-S4"]),
    ("自由语素与黏着语素", "concept",
     "能独立成词的是自由语素，只能与其他语素共现的是黏着语素；黏着成分按依附方向加连字符。",
     [("free morpheme", "自由语素"), ("bound morpheme", "黏着语素")],
     ["cat", "-whelmed", "overwhelmed"], "基础", ["S1-C3-S1"]),
]

KP["S2-C5-S3"] = [
    ("内部屈折", "concept",
     "通过词根内部元音或辅音改变表达语法信息；英语 mouse/mice、sing/sang 是旧规则系统的残余，今须记忆。",
     [("internal change", "内部屈折"), ("irregular", "不规则")],
     ["mouse ~ mice", "sing ~ sang", "write ~ wrote"], "基础", ["S1-C4-S10"]),
    ("增补", "concept",
     "整个语素形式被替换，完全不可预测且必然不规则，如 go/went、good/better/best；多见于高频词。",
     [("suppletion", "增补"), ("allomorphy", "语素变体")],
     ["go ~ went", "good ~ better ~ best"], "基础", ["S1-C4-S6"]),
    ("重叠", "concept",
     "重复词或词的一部分构成形态模式；英语 salad-salad 表示「典型的、名副其实的」这一构式义。",
     [("reduplication", "重叠")],
     ["salad-salad", "kw'élh"], "基础", ["S1-C3-S12"]),
    ("形态类型学四分", "classification",
     "孤立语少用词缀、多用语助词；综合语词内形态丰富；黏着语词缀可逐一分离，融合语一个词缀承载多项语法义。",
     [("isolating", "孤立语"), ("analytic", "分析型"), ("synthetic", "综合型"),
      ("agglutinative", "黏着型"), ("fusional", "融合型")],
     ["Mandarin", "Japanese", "Spanish estudiáramos"], "advanced", []),
]

KP["S2-C5-S4"] = [
    ("语素变体", "concept",
     "同一语素在不同环境出现不同形式即语素变体；英语不定冠词 a/an、复数 -s/-z/-ɪz 都是例子。",
     [("allomorphy", "语素变体"), ("allomorph", "变体形式")],
     ["a book", "an apple", "cats", "dogs", "horses"], "基础", ["S1-C4-S1"]),
    ("语音条件与词汇条件变体", "classification",
     "由相邻音决定的变体可预测（语音条件）；必须按词记忆的变体是词汇条件，如 children、mice、sheep。",
     [("phonologically conditioned allomorphy", "语音条件变体"),
      ("lexically conditioned allomorphy", "词汇条件变体")],
     ["-s/-z/-ɪz", "-(r)en", "mice", "sheep"], "基础", ["S1-C4-S2"]),
    ("零形式", "concept",
     "语素可以有语音上不实现的形式，写作 ∅；把 fish 的复数分析为 -∅ 可保持「复数必有标记」的一致性。",
     [("zero affix", "零词缀"), ("empty affix", "空词缀")],
     ["fish", "sheep", "deer"], "基础", ["S1-C4-S1"]),
]

KP["S2-C5-S5"] = [
    ("词类按分布界定", "rule",
     "传统「名词是人地物」的意义标准会失手（action、event 是名词）；语言学改看词出现的句法环境。",
     [("lexical category", "词类"), ("distribution", "分布"), ("part of speech", "词性")],
     ["action", "event", "proposal"], "基础", []),
    ("名词与动词的判别测试", "method",
     "名词可带限定词、被形容词修饰、作主宾语、可代词化；动词可带助动词、接 to、带宾语并有 -s/-ed/-ing 形式。",
     [("noun", "名词"), ("verb", "动词"), ("auxiliary", "助动词")],
     ["an event", "to kick", "she goes"], "基础", []),
    ("形容词与副词的判别测试", "method",
     "形容词夹在限定词与名词间、可被 very 修饰并有 -er/-est；副词修饰动词形容词副词，多带 -ly。",
     [("adjective", "形容词"), ("adverb", "副词")],
     ["a happy event", "happier", "slowly"], "基础", []),
    ("派生词缀可反推词类", "concept",
     "后缀决定所造词的类别并挑选用作词基的类别：-ment/-ness 造名词，-ify/-ize 造动词，此性质称选择。",
     [("selection", "选择限制"), ("derivational affix", "派生词缀")],
     ["-ment", "-ness", "-ify", "-ize"], "基础", ["S1-C9-S2"]),
]

KP["S2-C5-S6"] = [
    ("派生改变词类或意义", "concept",
     "派生形态改变词基的意义或类别，屈折只表达与词基类别相配的语法信息，复合则由多个词根组成。",
     [("derivational morphology", "派生形态"), ("inflectional morphology", "屈折形态")],
     ["-able", "-s"], "基础", ["S1-C9-S2"]),
    ("选择限制决定能否组合", "rule",
     "派生词缀对词基类别有要求：-able 只接动词并造形容词，un- 只接动词或形容词而不接名词。",
     [("selection", "选择限制"), ("base", "词基")],
     ["readable", "unkind", "undo"], "基础", []),
    ("英语前缀不改变词类", "rule",
     "前缀多表否定、重复、次序等意义而保持词基类别不变，如 non-、un-、re-。",
     [("prefix", "前缀"), ("negation", "否定")],
     ["non-issue", "unhappy", "redo"], "基础", ["S1-C3-S4"]),
    ("能产性差异与拉丁词缀", "concept",
     "能产词缀可自由接新词基（-ing 几乎可接所有动词），拉丁来源词缀常只与拉丁词根搭配，能产性低。",
     [("productivity", "能产性"), ("latinate", "拉丁来源")],
     ["googleable", "-ing", "-ish"], "拉丁", ["S1-C6-S2"]),
    ("词缀顺序由选择决定", "rule",
     "前后缀并存时顺序不任意：unkindness 须先加 un- 后加 -ness，否则 un- 的词基已非形容词。",
     [("order of affixation", "词缀顺序"), ("selection", "选择限制")],
     ["unkindness", "foolishly"], "拼写", ["S1-C3-S5"]),
]

KP["S2-C5-S7"] = [
    ("屈折不改变词类", "concept",
     "屈折形态只提供该词类所需的语法信息，不改变类别，如动词随时、名词随数变化。",
     [("inflectional morphology", "屈折形态")],
     ["walks", "books"], "基础", ["S1-C9-S1"]),
    ("英语屈折系统很小", "classification",
     "名词有数与（代词）格，动词有一致、时、体，形容词有比较级最高级（有人视为派生）；其余多由句法表达。",
     [("number", "数"), ("case", "格"), ("tense", "时"), ("aspect", "体")],
     ["-s", "-ed", "-ing", "-er"], "基础", ["S1-C9-S1"]),
    ("数的类型不止单复数", "classification",
     "不少语言另有双数、三数与小量数；因纽特语名词与动词一致都区分单、双、复三系。",
     [("dual", "双数"), ("trial", "三数"), ("paucal", "小量数")],
     ["titiraut", "titirautiik", "titirautit"], "advanced", []),
    ("人称与包含/排除", "concept",
     "第一人称复数可区分是否含听者，奥吉布瓦语 niinawind/giinawind 即此对立，术语称 clusivity。",
     [("person", "人称"), ("clusivity", "包含排除对立")],
     ["niinawind", "giinawind"], "advanced", []),
    ("格标记语法角色", "concept",
     "格标示名词在句中的角色：主格、宾格、属格、与格；英语只剩代词有格，芬兰语等可有十余种。",
     [("case", "格"), ("nominative", "主格"), ("accusative", "宾格"),
      ("genitive", "属格"), ("dative", "与格")],
     ["I ~ me ~ my", "le ~ leur"], "拉丁", ["S1-C9-S1"]),
    ("一致反映他词属性", "concept",
     "一致是屈折形式反映句中另一成分（通常是名词）的属性，最常见是动词与主语在数、人称上一致。",
     [("agreement", "一致")],
     ["she walks"], "advanced", []),
    ("时与体是两回事", "concept",
     "时定位事件时间，体表达观察事件的角度（完成/进行）；英语的 perfect 与他语的 perfective 并不等同。",
     [("tense", "时"), ("aspect", "体"), ("perfect", "完成"),
      ("perfective", "完成体"), ("progressive", "进行体")],
     ["have walked", "is walking", "了", "在"], "advanced", []),
    ("其他常见屈折范畴", "classification",
     "世界语言还用屈折表达近指/远指、使役、示证、情态、性/名词类别等；这些在英语多靠词汇手段。",
     [("obviation", "近指远指对立"), ("causative", "使役"),
      ("evidentiality", "示证"), ("modality", "情态"), ("noun class", "名词类别")],
     ["-di / -miş", "erisómesya", "le chat / la abeille"], "advanced", []),
]

KP["S2-C5-S8"] = [
    ("复合词由多个词根构成", "concept",
     "含一个以上词根的词必是复合词；复合是词根与词根的组合，区别于词根加词缀的派生与屈折。",
     [("compound", "复合词"), ("root", "词根")],
     ["doghouse", "website", "spaceship"], "基础", ["S1-C3-S14"]),
    ("重音位置可辨复合词与短语", "rule",
     "复合词重音落在前部，形容词加名词的短语重音落在后部；拼写是否连写或加连字符并不可靠。",
     [("compound", "复合词"), ("stress", "重音")],
     ["bláckboard / black bóard", "gréenhouse / green hóuse"], "拼写", ["S1-C3-S14"]),
    ("英语复合词中心在右", "rule",
     "中心成分决定整词的类别与所指：sunflower 是花、bluebird 是鸟，故英语属右向中心语言。",
     [("head", "中心成分"), ("right-headed", "中心右置")],
     ["sunflower", "bluebird"], "基础", ["S1-C3-S14"]),
    ("内向与外向复合词", "classification",
     "中心在词内为内向复合词；redhead、outcome、tell-all 中心不在词内或类别与右项不符，属外向复合词。",
     [("endocentric", "内向复合词"), ("exocentric", "外向复合词")],
     ["sunflower", "redhead", "outcome", "tell-all"], "advanced", ["S1-C3-S14"]),
    ("并列复合词", "concept",
     "两成分并列、可用 and 改写的是并列复合词；英语中不少成对押韵的叠词属此类。",
     [("dvandva", "并列复合词"), ("reduplicative", "叠韵词")],
     ["bittersweet", "zigzag", "flip flop"], "advanced", ["S1-C3-S14"]),
]

KP["S2-C5-S9"] = [
    ("结构歧义源于组合顺序", "concept",
     "同一词串可对应多种合法结构，untieable 分别由 un- 先加或 -able 先加得到两种意义。",
     [("structural ambiguity", "结构歧义"), ("paraphrase", "改写")],
     ["untieable", "tieable"], "advanced", ["S1-C3-S5"]),
    ("复合词更易产生结构歧义", "concept",
     "任意名词串都可能以不同层次成词，river boat race 可指河船的竞赛或河上的船赛。",
     [("structural ambiguity", "结构歧义"), ("compound", "复合词")],
     ["river boat race"], "advanced", ["S1-C3-S14"]),
    ("结构歧义不同于同音歧义", "rule",
     "bank 的两解来自两个同音词根，没有结构差异；结构歧义则靠层次不同来解释。",
     [("homophone", "同音词"), ("structural ambiguity", "结构歧义")],
     ["bank"], "基础", ["S1-C7-S2"]),
]

KP["S2-C5-S10"] = [
    ("树形图表示层次结构", "method",
     "树形图记录成分的层层组合：govern+-ment 先结合，再与 -al 结合；底行应能读出语素顺序。",
     [("tree diagram", "树形图"), ("constituency", "成分结构")],
     ["governmental"], "advanced", ["S1-C3-S5"]),
    ("画形态树的步骤", "method",
     "先定词根与词缀数目，再判词根类别，接着定加缀顺序，最后标出各中间词基与整词类别。",
     [("tree diagram", "树形图"), ("base", "词基")],
     ["foolishly", "unkindness"], "advanced", ["S1-C3-S5"]),
]

KP["S2-C5-S11"] = [
    ("切分陌生语言语素的方法", "method",
     "比较只在一个语义维度上不同的词：形式共享部分即语素候选，再用更多词检验其边界与变体条件。",
     [("morpheme", "语素"), ("allomorph", "变体形式")],
     ["matuit", "nuvujait", "matuuk"], "advanced", []),
]

KP["S2-C7-S1"] = [
    ("语义学研究语言意义", "concept",
     "语义学考察词义如何组合成句义；吉兆象征、行为目的、说话诚意等「意义」都不算语言意义。",
     [("semantics", "语义学"), ("linguistic meaning", "语言意义")],
     ["ode'imin", "strawberry"], "基础", ["S1-C11-S2"]),
    ("区分提及与使用", "concept",
     "斜体指语言表达式本身，正体指现实事物；「strawberry 有四个音节」只在提及词语时成立。",
     [("linguistic expression", "语言表达式"), ("use–mention distinction", "使用与提及之别")],
     ["strawberry"], "advanced", []),
    ("意义有 sense 与 denotation 两途", "concept",
     "sense 是储存在头脑中的词义内容，denotation 是表达式在现实（或认知表征）中所指，源自弗雷格。",
     [("sense", "涵义"), ("denotation", "指称"), ("reference", "所指")],
     ["ode'imin", "strawberry"], "advanced", ["S1-C11-S2"]),
]

KP["S2-C7-S2"] = [
    ("组合性原则", "concept",
     "复杂表达式的意义由其各部分意义及组合方式决定，故未见过的句子仍可理解，多语素词亦然。",
     [("compositionality", "组合性"), ("constituency", "成分结构")],
     ["unhelpfulness", "un-help-ful-ness"], "基础", []),
    ("句法相同不等于语义相同", "rule",
     "同为 DP 的 a scientist 可指称某人，也可表属性；属性解读不能被动化，说明意义独立起作用。",
     [("referential", "指称性"), ("predicative", "述谓性")],
     ["Vera greeted a scientist.", "Vera became a scientist."], "advanced", []),
    ("语义相同不等于句法相同", "rule",
     "before 可接从句而 during 不可，尽管两者都可指事件；句法限制不能只由语义推出。",
     [("syntax", "句法"), ("semantics", "语义")],
     ["before he met his student", "during the meeting"], "advanced", []),
]

KP["S2-C7-S3"] = [
    ("蕴涵及其矛盾测试", "method",
     "p 蕴涵 q 指 p 真则 q 必真；把 q 否定后与 p 并列会得到永假的矛盾（⊥），即证明蕴涵成立。",
     [("entailment", "蕴涵"), ("contradiction", "矛盾")],
     ["sighed / emitted a breath"], "advanced", []),
    ("会话隐涵可取消", "concept",
     "隐涵只是语境下的合理推测而非必然结论；否定后不产生矛盾即可证明其可取消。",
     [("implicature", "会话隐涵"), ("cancellable", "可取消")],
     ["sighed → is angry"], "advanced", []),
    ("预设是理所当然的蕴涵", "method",
     "预设不被否定或疑问取消，故可用「否定测试」「疑问测试」与一般蕴涵区分。",
     [("presupposition", "预设")],
     ["stopped charging extra"], "advanced", []),
]

KP["S2-C7-S4"] = [
    ("词库储存不可预测的信息", "concept",
     "可预测的由规则生成，不可预测的（音义联结、不规则形式）存入词库；词库是语法的一部分。",
     [("lexicon", "词库"), ("mental lexicon", "心理词库"), ("mental grammar", "心理语法")],
     ["goose", "went", "geese"], "基础", []),
    ("组合义与非组合义", "concept",
     "能由部件推出的意义是组合义，不必单列词条；不能推出的是非组合义，须整体储存。",
     [("compositional meaning", "组合意义"), ("non-compositional meaning", "非组合意义")],
     ["skater", "unluckily", "hotdog"], "基础", []),
    ("词项条目含音、句、义", "concept",
     "词库中的项目称 listeme，其条目记录读音、句法类别与意义；拼写与词源不属于必备的语言知识。",
     [("listeme", "词项"), ("lexical entry", "词条")],
     ["goose", "hotdog"], "advanced", []),
    ("习语整体入词库", "concept",
     "习语与部分非组合复合词的意义无法由部件推出，须整体储存；不同语言社群的习语各不相同。",
     [("idiom", "习语"), ("non-compositional", "非组合")],
     ["over the moon", "piece of cake", "hotdog"], "新词", []),
]

KP["S2-C7-S5"] = [
    ("词汇知识不同于世界知识", "concept",
     "关于椅子的一切经验属世界知识；词义只与其中一部分概念相联，两者边界难划清。",
     [("world knowledge", "世界知识"), ("concept", "概念"), ("sense", "涵义")],
     ["chair"], "advanced", []),
    ("必要充分条件说及其局限", "concept",
     "把词义化为一组区别性条件是经典做法，但杯碗实验显示范畴边界模糊，判断依赖语境与世界知识。",
     [("necessary and sufficient conditions", "必要充分条件")],
     ["doe", "cup / bowl"], "advanced", []),
    ("「意义即概念」的极繁主义", "concept",
     "另一派主张词义就是与之相联的整个概念，包含全部经验内容；概念语义学即此类主张。",
     [("Conceptual Semantics", "概念语义学"), ("maximalist", "极繁主义")],
     ["chair"], "advanced", []),
    ("原型效应", "concept",
     "概念内部按典型性组织，核心成员更易被想起与判定；这是条件清单说难以解释的现象。",
     [("prototype", "原型"), ("prototypicality", "典型性")],
     ["robin", "penguin", "cup"], "advanced", []),
]

KP["S2-C7-S6"] = [
    ("事件与状态", "classification",
     "动态发生的是事件，静态持续的是状态，两者合称 eventuality；可用「发生了什么」测试区分。",
     [("event", "事件"), ("state", "状态"), ("eventuality", "事件性实体")],
     ["Kat built a table.", "Leila knew the student."], "advanced", []),
    ("题元角色", "classification",
     "动词不仅规定论元数目，还规定论元承担的角色：施事、致事、受事、工具、处所、经验者、终点。",
     [("thematic role", "题元角色"), ("agent", "施事"), ("theme", "受事"),
      ("instrument", "工具"), ("experiencer", "经验者")],
     ["Ava cracked the nut with a hammer."], "advanced", []),
    ("动词词义可写作合取式", "rule",
     "把动词意义拆成「存在事件 e」加各论元角色的合取，可解释句子蕴涵出的多条结论。",
     [("event semantics", "事件语义学"), ("conjunction", "合取"), ("saturate", "饱和")],
     ["lift", "&"], "advanced", []),
    ("井号标记语义失当", "method",
     "句法合格但语境中说不通时用 #，与标示句法不合格的 * 相对；可据此检验词义假设。",
     [("infelicitous", "语境失当"), ("acceptability judgment", "可接受性判断")],
     ["#Mako recited a tango.", "#Tamara clapped."], "advanced", []),
]

KP["S2-C7-S7"] = [
    ("可数与不可数名词", "classification",
     "可数名词能加复数、接数词与 many；不可数名词不能复数化、接 much，如 dirt、rice。",
     [("count noun", "可数名词"), ("mass noun", "不可数名词")],
     ["three chairs", "much rice"], "基础", []),
    ("有界性解释可数性", "concept",
     "可数名词所指有可感知边界，物质名词所指同质无界；这条概念线索在多个词类中反复出现。",
     [("bounded", "有界"), ("unbounded", "无界")],
     ["cup / dirt"], "advanced", []),
    ("可数与不可数可以转用", "rule",
     "物质名词可表种类或容器而临时可数（two waters），可数名词也可作物质解（much pumpkin）。",
     [("coercion", "强制转换")],
     ["two waters", "much pumpkin"], "advanced", []),
    ("量词系统替代复数", "concept",
     "日语等语言无强制复数标记，靠量词按名词类别计数；量词选择反映语义分类。",
     [("classifier", "量词"), ("noun class", "名词类别")],
     ["3-mai", "2-hon", "1-dai"], "advanced", []),
]

KP["S2-C7-S8"] = [
    ("个体层与阶段层谓语", "classification",
     "恒久属性的形容词是个体层谓语，只在一段时间成立的阶段层谓语；后者可与 when 从句搭配。",
     [("individual-level predicate", "个体层谓语"), ("stage-level predicate", "阶段层谓语")],
     ["tall / Canadian", "bored / sick"], "advanced", []),
    ("系词选择反映谓语类型", "concept",
     "西班牙语 ser 多配个体层、estar 多配阶段层，说明该语义区分可被语法编码。",
     [("copula", "系词")],
     ["es leal", "está contenta"], "advanced", []),
    ("有界性跨范畴呼应", "concept",
     "阶段层谓语有起止界、个体层谓语无界，与名词的可数/物质之分共享同一概念维度。",
     [("bounded", "有界")],
     ["tall", "sick", "dirt"], "advanced", []),
]

KP["S2-C7-S9"] = [
    ("程度形容词带 degree 论元", "concept",
     "可受 very 修饰、可比较的形容词在词义中含程度论元与量表，如 tall「高到某程度 d」。",
     [("gradable adjective", "程度形容词"), ("degree", "程度"), ("scale", "量表")],
     ["very tall", "6ft tall", "taller"], "advanced", []),
    ("非程度形容词可被强制", "rule",
     "ceramic、alive 等本无程度，但在特定语境可临时赋予量表而获得程度解读。",
     [("non-gradable adjective", "非程度形容词"), ("coercion", "强制转换")],
     ["very ceramic", "very alive"], "advanced", []),
    ("显性比较与隐性比较", "classification",
     "英语用 -er 直接比较两个程度；Washo、Motu 只把一方置入形容词范畴而隐含比较结果。",
     [("explicit comparison", "显性比较"), ("implicit comparison", "隐性比较")],
     ["taller than", "delkáykayiʔ ... delkáykayiʔé:s"], "advanced", []),
    ("手语可让程度显形", "concept",
     "意大利手语中程度论元占据 loci，可用指代词回指，说明抽象语义成分也能有语音实现。",
     [("locus", "位置点"), ("deictic", "指示")],
     ["PIETRO TALLs-degd IXd"], "advanced", []),
]

KP["S2-C7-S10"] = [
    ("词典不是语言权威", "concept",
     "词典由人编写会出错，dord 与 mountweazel 说明词条存在不等于该词真被使用。",
     [("lexicographer", "词典编纂者"), ("mountweazel", "防抄假词条")],
     ["dord", "mountweazel"], "advanced", []),
    ("词典不收录全部派生词", "concept",
     "能产词缀可造出大量未收录的词；未收录常因篇幅取舍，而非判定其不是词。",
     [("productivity", "能产性"), ("derived form", "派生形式")],
     ["tubist", "beigeness"], "advanced", ["S1-C3-S12"]),
    ("意义由使用者创造", "concept",
     "museum 可转指馆方人员，词典未列但交际通行；词典只是用法的部分记录。",
     [("usage", "用法"), ("metonymy", "转喻")],
     ["The museum emailed me back."], "advanced", ["S1-C7-S11"]),
    ("最小对子可探测词义", "method",
     "只换一个成分造成可接受性差异，即可推断该词的语义条件，如日语 otta 对宾语形状敏感。",
     [("minimal pair", "最小对子")],
     ["eda-o otta", "#sara-o otta"], "advanced", []),
]

KP["S2-C7-S11"] = [
    ("涵义与指称之别", "concept",
     "两段描述可涵义不同而指称同一对象（同一邮局）；my house 涵义固定而指称随说话人变。",
     [("sense", "涵义"), ("denotation", "指称")],
     ["the building north of the bank", "my house"], "advanced", []),
    ("一元谓语指称集合", "concept",
     "形容词、名词与不及物动词的指称可看作个体集合；双括号 ⟦x⟧ 读作「x 的指称」。",
     [("one-place predicate", "一元谓语"), ("set", "集合")],
     ["⟦sour⟧", "⟦snore⟧"], "advanced", []),
    ("专名指称个体", "concept",
     "专名的指称是特定个体，用常元符号表示；常元取值固定，变元只是占位符。",
     [("proper name", "专名"), ("constant", "常元"), ("variable", "变元")],
     ["⟦Nathan Sanders⟧ = n"], "advanced", []),
    ("句子指称真值", "concept",
     "只有句子有真值，故句子指称真或假；知识不足时写作真值条件，即何种情形为真。",
     [("truth value", "真值"), ("truth condition", "真值条件")],
     ["⟦Nathan Sanders is bald⟧ = T"], "advanced", []),
]

KP["S2-C7-S12"] = [
    ("集合与成员关系", "concept",
     "集合由成员构成，用 ∈ 表示属于、∉ 表示不属于；集合常用于刻画谓语的指称。",
     [("set", "集合"), ("member", "成员")],
     ["⟦cat⟧", "b ∈ A"], "advanced", []),
    ("子集、真子集与基数", "concept",
     "A 的成员全在 B 中则 A 是 B 的子集；B 另有成员时是真子集；基数表示成员个数。",
     [("subset", "子集"), ("proper subset", "真子集"), ("cardinality", "基数")],
     ["S⊂C", "|A| = 3"], "advanced", []),
    ("量词与集合交", "concept",
     "限定词表达数量：two 要求交集基数至少为二，every 要求一个集合包含于另一集合。",
     [("quantificational determiner", "量化限定词"), ("intersection", "交集")],
     ["Two cats are grey.", "C∩G"], "advanced", []),
]

KP["S2-C7-S13"] = [
    ("负极性词及其允准语境", "concept",
     "any、ever、at all 等只在否定性语境出现，且否定成分须在结构上高于它们。",
     [("negative polarity item", "负极性词"), ("licensing context", "允准语境")],
     ["did not pet anything", "*Any cats, I did not pet."], "advanced", []),
    ("向下蕴涵判定三步骤", "method",
     "把含集合的短语放入语境，换成其真子集，看超集句是否蕴涵子集句；是则语境向下蕴涵。",
     [("downward-entailing", "向下蕴涵"), ("upward-entailing", "向上蕴涵")],
     ["did not pet cats / Siberian Forest Cats"], "advanced", []),
]

KP["S2-C7-S14"] = [
    ("意义区分的层次总览", "concept",
     "本章把意义分为蕴涵与隐涵、涵义与指称、词汇与句子、组合与非组合四组对立，须逐层分辨。",
     [("entailment", "蕴涵"), ("sense", "涵义"), ("compositionality", "组合性")],
     ["entailment / implicature", "sense / denotation"], "advanced", []),
]

KP["S2-C14-S1"] = [
    ("世界变化推动词汇更新", "concept",
     "新技术与新概念需要名称，常用概念更易获得专用词，故 app、blog、life hack 等词相继出现。",
     [("external change", "外部变化")],
     ["app", "blog", "life hack"], "科技", ["S1-C11-S1"]),
    ("共时与历时", "concept",
     "共时研究某一时点的语言模式，历时研究跨时段的变化；本章属历时语言学。",
     [("synchronic", "共时"), ("diachronic", "历时")],
     ["the house is building > is being built"], "基础", []),
    ("历史分期只用于有据可考形式", "history",
     "Old/Middle/Modern 加在语言名前表示有文献证据的时期；分期无跨语言统一年代，也无截然分界。",
     [("attested", "有据可考"), ("Old English", "古英语"), ("Middle English", "中古英语")],
     ["Old English 450–1150", "Middle English 1150–1500"], "词源", ["S1-C2-S6"]),
    ("变化记号的用法", "method",
     "大于号表示由旧到新，小于号表示回溯；同一变化可正写也可倒写，方向由阅读顺序决定。",
     [("notation of change", "变化记号")],
     ["nice 'silly' > 'delicate' > 'careful' > 'pleasant'"], "词源", []),
    ("词源谬误", "rule",
     "以词的历史义取代当代通行义来论证是词源谬误；词义由当下用法决定，-phobic 已不限于「恐惧」。",
     [("etymology", "词源"), ("etymological fallacy", "词源谬误")],
     ["transphobic", "hydrophobic"], "希腊", []),
    ("外部与内部动因", "classification",
     "外部动因来自文化接触、技术等语言之外的因素；内部动因源于语言结构本身，如相邻音同化。",
     [("language contact", "语言接触"), ("internal change", "内部变化")],
     ["assimilation"], "基础", []),
    ("复杂性与变化无必然关系", "concept",
     "语言复杂性不是单一指标，各层面可此消彼长；变化可能增繁也可能简化，甚至来回摆动。",
     [("complexity", "复杂性")],
     ["English verb morphology / Georgian"], "advanced", []),
]

KP["S2-C14-S2"] = [
    ("零星变化", "concept",
     "只影响个别词的变化是零星变化：application 缩为 app，complication 却不缩。",
     [("sporadic change", "零星变化")],
     ["app", "*comp"], "新词", ["S1-C3-S16"]),
    ("根造词", "concept",
     "不借自任何既有词的造词称根造词，或模仿声音，或无中生有（ex nihilo），整体较少见。",
     [("neologism", "新词"), ("root creation", "根造词"), ("onomatopoeia", "拟声")],
     ["zap", "googol", "grok"], "新词", ["S1-C3-S19"]),
    ("专名与商标进入词汇", "concept",
     "地名、人名、品牌名常成新词来源；品牌名泛化为同类产品通称的過程称通用化。",
     [("genericization", "通用化"), ("eponym", "专名来源词")],
     ["canary", "dumpster", "zipper"], "新词", []),
    ("缩略、混成与首字母缩略", "classification",
     "截短造词取词的一部分，混成拼接两词片段，首字母缩略按拼写取字母并可整读或逐字母读。",
     [("clipping", "截短"), ("blend", "混成"), ("acronym", "首字母缩略"),
      ("initialism", "字母缩略")],
     ["exam", "brunch", "scuba", "SO"], "拼写", ["S1-C3-S16", "S1-C3-S17", "S1-C3-S18"]),
    ("避讳也会造新词", "concept",
     "为回避禁忌词，可换用既有词（带来语义变化），也可另造新词，如 dang、gosh。",
     [("taboo avoidance", "避讳"), ("euphemism", "委婉语")],
     ["dang", "gosh"], "新词", []),
]

KP["S2-C14-S3"] = [
    ("换位", "concept",
     "两个音或两个发音部位互换位置即换位；英语 ask 史上有 axian 变体，手语也有换位变体。",
     [("metathesis", "换位")],
     ["ascian > axian", "wæpse > wasp", "bridd > bird"], "词源", []),
    ("拼写读音", "concept",
     "拼写被改动后读音随字母改变，称拼写读音；这类新读音未必低劣，也可能更受推崇。",
     [("spelling pronunciation", "拼写读音")],
     ["Arctic", "falcon", "perfect"], "拼写", ["S1-C11-S3"]),
    ("超外来词", "concept",
     "按对来源语的刻板印象改造借词读音，反而偏离原音，称超外来词。",
     [("hyperforeignism", "超外来词")],
     ["Beijing", "lingerie", "coup de grâce"], "拼写", []),
    ("异化、类推与近邻类推", "concept",
     "异化是避开相邻相似音；类推是向更常见模式靠拢；近邻类推是向常连用的词靠拢。",
     [("dissimilation", "异化"), ("analogy", "类推"), ("immediate model", "近邻类推")],
     ["governor", "nuclear", "February"], "advanced", ["S1-C3-S20"]),
    ("规则音变假说", "history",
     "新语法学派主张音变一律规则、例外另有来源；今知并非全然成立，但该假说是历史语言学的基石。",
     [("regularity principle", "规则性原理"), ("Neogrammarian", "新语法学派")],
     ["sound law"], "advanced", ["S1-C10-S1"]),
    ("词汇扩散", "concept",
     "规则音变可逐词蔓延，先及高频词，故同一时刻只见部分词已变，如费城 bad/dad 的元音差异。",
     [("lexical diffusion", "词汇扩散")],
     ["bad / dad"], "advanced", []),
    ("条件音变与无条件音变", "rule",
     "音变可只在特定环境发生（如元音之间、词末），也可无条件遍及所有位置；记法与共时规则同形，惟用大于号。",
     [("conditioned change", "条件音变"), ("unconditioned change", "无条件音变")],
     ["sword / sweet"], "advanced", []),
    ("音位合并、分裂与移位", "classification",
     "音变可减少音位（合并）、增加音位（分裂，如 /v/ 因借词对立而独立）或只改音值不改数目（移位）。",
     [("merger", "合并"), ("split", "分裂"), ("shift", "移位")],
     ["/y/ > /i/", "fine / vine", "cyssen > kiss"], "advanced", ["S1-C4-S1"]),
    ("元音大推移与链移", "history",
     "中古英语长元音成系列上移或复元化而不合并，形成链移；可用拉链或推链解释，也可能两者兼有。",
     [("Great Vowel Shift", "元音大推移"), ("chain shift", "链移"),
      ("pull chain", "拉链"), ("push chain", "推链")],
     ["divine / divinity", "sane / sanity"], "词源", ["S1-C11-S9"]),
]

KP["S2-C14-S4"] = [
    ("屈折词形表与同形合并", "concept",
     "同一词根的全部屈折形式构成词形表；不同格位发音相同即同形合并，如英语过去式与过去分词同形。",
     [("paradigm", "词形表"), ("syncretism", "同形合并")],
     ["move / moves / moved / moving", "show / showed / shown"], "advanced", ["S1-C9-S1"]),
    ("类推拉平", "concept",
     "以多数模式消除词根变体，使词形表更整齐，如 help/halp/holp 归并为 help/helped。",
     [("analogical levelling", "类推拉平")],
     ["help", "halp", "holp"], "advanced", ["S1-C3-S20"]),
    ("类推扩展", "concept",
     "较少见，指仿照他类模式增加词根变体，如 ring 由单一词根变为 ring/rang/rung 三式。",
     [("analogical extension", "类推扩展")],
     ["hring > ring", "begin / began / begun"], "advanced", ["S1-C3-S20"]),
    ("重新分析（改划边界）", "concept",
     "语素边界跨越音段移动而语素本身不变；a napron 被重析为 an apron，反向则得 newt。",
     [("reanalysis", "重新分析"), ("rebracketing", "改划边界")],
     ["apron", "newt", "napkin"], "拼写", []),
    ("民间词源与 eggcorn", "concept",
     "把词误解为具备它本无的理据结构即民间词源；个人层面的误听误写称 eggcorn，二者是同一过程。",
     [("folk etymology", "民间词源"), ("eggcorn", "形近误改词")],
     ["woodchuck", "hangnail", "cold slaw"], "词源", []),
    ("mondegreen", "concept",
     "听错歌词或诗句并连带改变意义，与 eggcorn 的区别在于意义也变了。",
     [("mondegreen", "听误成词")],
     ["Lady Mondegreen", "four calling birds"], "advanced", []),
    ("逆构词", "concept",
     "依错误的结构分析造出新语素，新语素还可继续造词，如 emote、-holic。",
     [("back formation", "逆构词")],
     ["emote", "edit", "-holic"], "词源", ["S1-C3-S12"]),
]

KP["S2-C14-S5"] = [
    ("分析与综合可以互转", "concept",
     "独立词经语音弱化并入前词即成综合式（have not > haven't）；词尾磨损后信息改由独立词承担则回向分析式。",
     [("analytic", "分析式"), ("synthetic", "综合式")],
     ["haven't", "to play < plegian"], "advanced", []),
    ("语法化", "concept",
     "词汇词演变为语法成分并伴随范畴与意义转移，如 willan「想要」变为将来时标记。",
     [("grammaticalization", "语法化")],
     ["will", "while", "very"], "advanced", []),
    ("基本语序的历史变化", "concept",
     "语言可在 SVO、SOV 等六种基本语序间转移，通常经过两种语序并存的变异阶段。",
     [("basic word order", "基本语序")],
     ["He hit hæfde > He had it"], "advanced", []),
    ("语序细节变化反映句法原则", "concept",
     "副词与动词相对位置的变化可由移位参数解释，历时材料因而能检验共时句法理论。",
     [("V-to-T movement", "动词到时的移位")],
     ["he loued neuer", "he never loved"], "advanced", []),
]

KP["S2-C14-S6"] = [
    ("语义漂移经多义阶段", "concept",
     "词义变化常先出现新旧义并用的多义阶段，旧义随后废弃；这一过程称语义漂移。",
     [("semantic shift", "语义漂移"), ("polysemy", "多义")],
     ["arrive"], "词源", ["S1-C7-S1"]),
    ("词义扩大", "concept",
     "所指范围由具体扩至更广类别，如 arrive 由「航海抵岸」扩至任何抵达。",
     [("widening", "词义扩大"), ("generalization", "泛化")],
     ["arrive", "holiday", "build"], "词源", ["S1-C7-S9"]),
    ("词义缩小", "concept",
     "所指范围收窄，如 deer 由「动物」缩为鹿科，meat 由「食物」缩为肉。",
     [("narrowing", "词义缩小"), ("specialization", "专门化")],
     ["deer", "meat", "starve"], "词源", ["S1-C7-S9"]),
    ("转喻与提喻", "classification",
     "基于相邻联想的转用是转喻；以部分代整体或以整体代部分是提喻，属转喻的特例。",
     [("metonymy", "转喻"), ("synecdoche", "提喻"),
      ("pars pro toto", "以部分代整体"), ("totum pro parte", "以整体代部分")],
     ["the Crown", "glasses", "Canada"], "advanced", ["S1-C7-S11"]),
    ("隐喻", "concept",
     "基于形似或功能相似的跨域转用是隐喻，与转喻的区别在于两概念并无日常共现关系。",
     [("metaphor", "隐喻")],
     ["grasp", "crane", "sierra"], "advanced", ["S1-C7-S10"]),
    ("升格与降格", "classification",
     "词义向褒义发展为升格，向贬义发展为降格；两种方向都可跨越中性、褒、贬三类。",
     [("elevation", "升格"), ("degeneration", "降格"), ("pejoration", "贬化")],
     ["eager", "silly", "knave"], "词源", ["S1-C7-S9"]),
    ("委婉语循环", "concept",
     "为回避不快概念而换用委婉语，委婉语本身沾染贬义后又被替换，形成循环。",
     [("euphemism", "委婉语"), ("euphemism cycle", "委婉语循环")],
     ["toilet", "restroom"], "advanced", []),
    ("夸张、曲言与语义漂白", "classification",
     "夸张使新义弱于原义，曲言使新义强于原义；语义内容磨蚀至只剩强调功能即语义漂白。",
     [("hyperbole", "夸张"), ("litotes", "曲言"), ("semantic bleaching", "语义漂白")],
     ["bane", "grudge", "very", "literally"], "advanced", []),
    ("语义变化通常不规则", "concept",
     "语义变化多逐词发生，难以像音变那样成系统；成组同变者需有共同的结构条件，如查莫罗语方位词整体旋转。",
     [("regular semantic change", "规则语义变化")],
     ["lågu 'seaward' > 'north'"], "advanced", []),
]

KP["S2-C14-S7"] = [
    ("比较法与重构", "concept",
     "比较亲属语言的同源成分并向上推溯出共同祖形，这一方法称比较法，其推溯过程即重构。",
     [("comparative method", "比较法"), ("reconstruction", "重构")],
     ["house / Haus"], "advanced", ["S1-C10-S1"]),
    ("同源词与祖形", "concept",
     "由同一祖形直接继承而来的词是同源词，该祖形即其 etymon；音义相近只是线索，不是判据。",
     [("cognate", "同源词"), ("etymon", "祖形")],
     ["house", "Haus"], "词源", ["S1-C10-S1"]),
    ("借词与游词的干扰", "concept",
     "借词未经历受借语言的完整演变，会被误当作同源词；在多语间辗转传播的词称游词。",
     [("borrowing", "借词"), ("Wanderwort", "游词")],
     ["giraffe / Giraffe", "tea", "sugar"], "advanced", ["S1-C11-S1"]),
    ("假同源词与假朋友", "classification",
     "音义相近而来源不同是假同源词，须排除；确为同源但意义已分歧的是假朋友，仍应纳入比较。",
     [("false cognate", "假同源词"), ("false friends", "假朋友")],
     ["murder / Marter", "gift / Gift"], "advanced", []),
]

KP["S2-C14-S8"] = [
    ("星号标记重构形式", "method",
     "重构形式前置星号表示其为假设而非实证；该记法原用于历时重构，后借用于共时不合格标记。",
     [("asterisk", "星号"), ("reconstructed form", "重构形式")],
     ["*pi"], "advanced", []),
    ("原始语言与原始形式", "concept",
     "以 proto- 命名重构的语言、词与音；原始语言是理论构拟，并非任何人真正使用过的语言。",
     [("proto-language", "原始语"), ("proto-word", "原始词"), ("proto-sound", "原始音")],
     ["Proto-Chinese", "*bi"], "advanced", []),
    ("对应集", "concept",
     "把同源词逐音对齐后得到的音类对应序列称对应集，是重构单个音位的基本单位。",
     [("correspondence set", "对应集")],
     ["p : pʰ : b"], "advanced", []),
    ("优先假设规则音变", "rule",
     "若某对应集由大量词支持，应假设曾发生规则音变，而非为每个词各设一次零星变化。",
     [("regular sound change", "规则音变")],
     ["p : pʰ : b"], "advanced", []),
    ("保守与创新", "concept",
     "在某项特征上未见变化的语言称保守，已变的称创新；同一语言可在此处保守、在彼处创新。",
     [("conservative", "保守"), ("innovative", "创新")],
     ["Suzhou", "Changsha"], "advanced", []),
]

# ---------------------------------------------------------------- glossary
# (term, zh, definition, chapter)
GLOSSARY = [
    ("morpheme", "语素", "最小的形义（或形—语法功能）配对单位。", "S2-C5"),
    ("morphology", "形态学", "研究词如何由更小单位构成的语言学分支。", "S2-C5"),
    ("morphologically complex", "形态复杂", "含一个以上语素的词。", "S2-C5"),
    ("morphologically simple", "形态简单", "只含一个语素的词。", "S2-C5"),
    ("affix", "词缀", "必须依附词基才能出现的语素。", "S2-C5"),
    ("base", "词基", "词缀所依附的成分，可简单可复杂。", "S2-C5"),
    ("root", "词根", "不可再分的最小词基。", "S2-C5"),
    ("prefix", "前缀", "位于词基之前的词缀。", "S2-C5"),
    ("suffix", "后缀", "位于词基之后的词缀。", "S2-C5"),
    ("circumfix", "环缀", "同时环绕词基前后两端的词缀。", "S2-C5"),
    ("infix", "中缀", "插入词基内部的词缀。", "S2-C5"),
    ("simultaneous affix", "同时词缀", "与词基同时发生而非前后相接的词缀，多见于手语。", "S2-C5"),
    ("free morpheme", "自由语素", "能独立成词出现的语素。", "S2-C5"),
    ("bound morpheme", "黏着语素", "只能与别的语素共现的语素。", "S2-C5"),
    ("interlinear gloss", "间行标注", "逐语素给出原文、释义与整句翻译的三行标注法。", "S2-C5"),
    ("internal change", "内部屈折", "以词根内部音变表达语法信息的形态手段。", "S2-C5"),
    ("suppletion", "增补", "以完全不同的形式替换整个语素的形态手段。", "S2-C5"),
    ("reduplication", "重叠", "重复词或词的一部分以表达特定意义的形态手段。", "S2-C5"),
    ("isolating", "孤立语", "几乎不用词缀、语法主要靠语助词表达的语言类型。", "S2-C5"),
    ("analytic", "分析型", "以独立词而非词缀表达语法关系的类型。", "S2-C5"),
    ("synthetic", "综合型", "词内形态丰富、自由词根少的语言类型。", "S2-C5"),
    ("agglutinative", "黏着型", "词缀可逐一分离且各带单一语法义的类型。", "S2-C5"),
    ("fusional", "融合型", "一个词缀同时承载多项语法义的类型。", "S2-C5"),
    ("allomorphy", "语素变体现象", "同一语素依环境呈现不同形式的现象。", "S2-C5"),
    ("allomorph", "语素变体", "同一语素的具体形式之一。", "S2-C5"),
    ("phonologically conditioned allomorphy", "语音条件变体", "由相邻音决定、可预测的语素变体。", "S2-C5"),
    ("lexically conditioned allomorphy", "词汇条件变体", "须按词逐一记忆的语素变体。", "S2-C5"),
    ("zero affix", "零词缀", "无语音实现却承载语法信息的词缀，记作 ∅。", "S2-C5"),
    ("lexical category", "词类", "名词、动词、形容词、副词等按分布划分的类别。", "S2-C5"),
    ("distribution", "分布", "一个成分能出现的句法环境。", "S2-C5"),
    ("derivational morphology", "派生形态", "改变词基类别或意义的构词形态。", "S2-C5"),
    ("inflectional morphology", "屈折形态", "表达与词基类别相配的语法信息而不改类别的形态。", "S2-C5"),
    ("selection", "选择限制", "词缀对词基类别或具体词根的要求。", "S2-C5"),
    ("productivity", "能产性", "词缀可自由用于新词基的能力。", "S2-C5"),
    ("order of affixation", "词缀顺序", "多个词缀叠加时的先后次序，受选择限制约束。", "S2-C5"),
    ("number", "数", "单数、双数、复数等语法范畴。", "S2-C5"),
    ("dual", "双数", "专指恰好两个的语法数。", "S2-C5"),
    ("trial", "三数", "专指恰好三个的语法数。", "S2-C5"),
    ("paucal", "小量数", "指少量（不止一个但不多）的语法数。", "S2-C5"),
    ("clusivity", "包含排除对立", "第一人称复数区分是否包含听话者的对立。", "S2-C5"),
    ("case", "格", "标示名词在句中语法角色的屈折范畴。", "S2-C5"),
    ("nominative", "主格", "标示句子主语（施事位置）的格。", "S2-C5"),
    ("accusative", "宾格", "标示直接宾语等位置的格。", "S2-C5"),
    ("genitive", "属格", "标示领有关系的格。", "S2-C5"),
    ("dative", "与格", "常标示间接宾语的格。", "S2-C5"),
    ("agreement", "一致", "屈折形式反映另一成分属性的现象。", "S2-C5"),
    ("tense", "时", "定位事件发生时间的语法范畴。", "S2-C5"),
    ("aspect", "体", "表达观察事件完成或进行状态的语法范畴。", "S2-C5"),
    ("perfective", "完成体", "把事件视为有界的整体。", "S2-C5"),
    ("progressive", "进行体", "把事件视为持续进行中。", "S2-C5"),
    ("evidentiality", "示证", "标示说话人证据来源或确信程度的语法范畴。", "S2-C5"),
    ("causative", "使役", "表达某事件由外部施力者促成的形态或结构。", "S2-C5"),
    ("compound", "复合词", "由两个或更多词根构成的词。", "S2-C5"),
    ("head", "中心成分", "决定复合词类别与所指的成分。", "S2-C5"),
    ("right-headed", "中心右置", "中心成分位于复合词右端的类型特征。", "S2-C5"),
    ("endocentric", "内向复合词", "中心成分在词内、并决定整体所指的复合词。", "S2-C5"),
    ("exocentric", "外向复合词", "中心不在词内或所指不等于任一成分的复合词。", "S2-C5"),
    ("dvandva", "并列复合词", "两成分并列、可用「和」改写的复合词。", "S2-C5"),
    ("structural ambiguity", "结构歧义", "同一形式可对应多种合法结构因而多义的现象。", "S2-C5"),
    ("tree diagram", "树形图", "表示成分层层组合关系的树状图。", "S2-C5"),
    ("constituency", "成分结构", "语言单位由更小单位分层组合的性质。", "S2-C5"),
    ("semantics", "语义学", "研究语言意义及其组合的学科。", "S2-C7"),
    ("sense", "涵义", "说话人储存在头脑中的词义内容。", "S2-C7"),
    ("denotation", "指称", "语言表达式在现实或认知表征中所指向的对象。", "S2-C7"),
    ("reference", "所指", "表达式所指向的特定个体。", "S2-C7"),
    ("compositionality", "组合性", "复杂表达式的意义由其成分意义与组合方式决定。", "S2-C7"),
    ("entailment", "蕴涵", "前者为真则后者必为真的意义关系。", "S2-C7"),
    ("contradiction", "矛盾", "在任何情况下都不为真的句子。", "S2-C7"),
    ("implicature", "会话隐涵", "语境下可得但可取消的推测意义。", "S2-C7"),
    ("presupposition", "预设", "句子视为理所当然、不被否定或疑问取消的蕴涵。", "S2-C7"),
    ("lexicon", "词库", "储存不可由规则预测的语言信息的心理库。", "S2-C7"),
    ("listeme", "词项", "词库中占有条目的单位，包括语素、习语与部分复合词。", "S2-C7"),
    ("lexical entry", "词条", "记录词项读音、句法类别与意义的条目。", "S2-C7"),
    ("idiom", "习语", "意义不能由字面成分推出的固定短语。", "S2-C7"),
    ("non-compositional meaning", "非组合意义", "无法由构成成分推出的意义。", "S2-C7"),
    ("world knowledge", "世界知识", "关于世界的经验知识，区别于纯语言知识。", "S2-C7"),
    ("prototype", "原型", "范畴中最典型、最具代表性的成员。", "S2-C7"),
    ("thematic role", "题元角色", "论元在事件中承担的角色，如施事、受事。", "S2-C7"),
    ("event", "事件", "动态发生的实体，可用「发生了什么」提问。", "S2-C7"),
    ("state", "状态", "静态持续、不涉及发生的实体。", "S2-C7"),
    ("eventuality", "事件性实体", "事件与状态的统称。", "S2-C7"),
    ("count noun", "可数名词", "可复数化、可接数词与 many 的名词。", "S2-C7"),
    ("mass noun", "不可数名词", "不可复数化、接 much 而指同质物质的名词。", "S2-C7"),
    ("bounded", "有界", "所指具有可感知边界的性质。", "S2-C7"),
    ("classifier", "量词", "计数时按名词类别选用的语素。", "S2-C7"),
    ("individual-level predicate", "个体层谓语", "描述个体恒久属性的谓语。", "S2-C7"),
    ("stage-level predicate", "阶段层谓语", "只在某段时间成立的谓语。", "S2-C7"),
    ("gradable adjective", "程度形容词", "可受 very 修饰、可比较的形容词。", "S2-C7"),
    ("degree", "程度", "形容词所表属性在量表上的取值。", "S2-C7"),
    ("scale", "量表", "度量某属性的抽象刻度。", "S2-C7"),
    ("truth value", "真值", "句子为真或为假的取值。", "S2-C7"),
    ("truth condition", "真值条件", "使句子为真的情形。", "S2-C7"),
    ("set", "集合", "由若干成员构成的整体。", "S2-C7"),
    ("subset", "子集", "所有成员都属另一集合的集合。", "S2-C7"),
    ("cardinality", "基数", "集合中成员的数目。", "S2-C7"),
    ("negative polarity item", "负极性词", "只能在否定性等特定语境出现的词项。", "S2-C7"),
    ("downward-entailing", "向下蕴涵", "由超集句可推出真子集句的语境性质。", "S2-C7"),
    ("diachronic", "历时", "跨时间点考察语言变化的研究视角。", "S2-C14"),
    ("synchronic", "共时", "考察某一时点语言系统的研究视角。", "S2-C14"),
    ("attested", "有据可考", "有书面或录音等直接证据的形式。", "S2-C14"),
    ("etymology", "词源", "词或表达式的历史来源与发展。", "S2-C14"),
    ("etymological fallacy", "词源谬误", "以历史义取代当代通行义作论证的错误。", "S2-C14"),
    ("neologism", "新词", "语言内部新创的词或表达。", "S2-C14"),
    ("root creation", "根造词", "不依既有词而全新造出的词。", "S2-C14"),
    ("genericization", "通用化", "品牌名泛化为同类产品通称的过程。", "S2-C14"),
    ("clipping", "截短", "截取较长词的一部分构成新词。", "S2-C14"),
    ("blend", "混成", "拼接两个以上词的片段构成新词。", "S2-C14"),
    ("acronym", "首字母缩略词", "由词组首字母构成并可整体读出的词。", "S2-C14"),
    ("initialism", "字母缩略词", "由首字母构成、逐字母读出的词。", "S2-C14"),
    ("metathesis", "换位", "两个音或发音部位互换位置的变化。", "S2-C14"),
    ("spelling pronunciation", "拼写读音", "读音因拼写改变而改变的现象。", "S2-C14"),
    ("hyperforeignism", "超外来词", "按刻板印象改造借词读音而偏离原音的现象。", "S2-C14"),
    ("dissimilation", "异化", "音变以避免与邻近音过于相似。", "S2-C14"),
    ("analogy", "类推", "依既有模式改造形式的变化机制。", "S2-C14"),
    ("regularity principle", "规则性原理", "新语法学派主张音变一律规则、例外另有来源。", "S2-C14"),
    ("lexical diffusion", "词汇扩散", "音变逐词蔓延、先及高频词的过程。", "S2-C14"),
    ("merger", "音位合并", "两个音位归并为一个、音位数目减少的变化。", "S2-C14"),
    ("split", "音位分裂", "一个音位分化为两个、音位数目增加的变化。", "S2-C14"),
    ("chain shift", "链移", "若干不合并的音变相互衔接成串的系列变化。", "S2-C14"),
    ("Great Vowel Shift", "元音大推移", "中古英语到近代英语长元音的系统上移与复元化。", "S2-C14"),
    ("paradigm", "词形表", "同一词根全部屈折形式的集合。", "S2-C14"),
    ("syncretism", "同形合并", "词形表中不同格位共用同一形式。", "S2-C14"),
    ("analogical levelling", "类推拉平", "以多数模式消除词根变体、减少语素变体。", "S2-C14"),
    ("analogical extension", "类推扩展", "仿照他类模式增加词根变体。", "S2-C14"),
    ("reanalysis", "重新分析", "语素边界发生移动而语素本身不变的变化。", "S2-C14"),
    ("folk etymology", "民间词源", "把词误解为具备它本无的理据结构。", "S2-C14"),
    ("eggcorn", "形近误改词", "个人层面因音近而误写误说的形式。", "S2-C14"),
    ("mondegreen", "听误成词", "听错歌词诗句并连带改变意义的现象。", "S2-C14"),
    ("back formation", "逆构词", "依错误结构分析造出新语素的构词方式。", "S2-C14"),
    ("grammaticalization", "语法化", "词汇词演变为语法成分并伴随范畴转移。", "S2-C14"),
    ("semantic shift", "语义漂移", "词义随时间发生的变化。", "S2-C14"),
    ("widening", "词义扩大", "所指范围由具体扩至更广类别。", "S2-C14"),
    ("narrowing", "词义缩小", "所指范围收窄至更具体的类别。", "S2-C14"),
    ("metonymy", "转喻", "基于相邻联想的跨义转用。", "S2-C14"),
    ("synecdoche", "提喻", "以部分代整体或以整体代部分的转喻。", "S2-C14"),
    ("metaphor", "隐喻", "基于形似或功能相似的跨域转用。", "S2-C14"),
    ("elevation", "升格", "词义向褒义方向的变化。", "S2-C14"),
    ("degeneration", "降格", "词义向贬义方向的变化。", "S2-C14"),
    ("euphemism", "委婉语", "为回避不快概念而使用的替换说法。", "S2-C14"),
    ("semantic bleaching", "语义漂白", "词义内容磨蚀至仅剩强调等功能。", "S2-C14"),
    ("comparative method", "比较法", "比较亲属语言同源成分并推溯共同祖形的方法。", "S2-C14"),
    ("reconstruction", "重构", "依比较法推拟未存世形式的过程与结果。", "S2-C14"),
    ("cognate", "同源词", "由同一祖形直接继承而来的词。", "S2-C14"),
    ("etymon", "祖形", "同源词所由继承的共同来源形式。", "S2-C14"),
    ("false cognate", "假同源词", "音义相近但来源不同的词。", "S2-C14"),
    ("proto-language", "原始语", "重构出的假想祖语，并非实际使用过的语言。", "S2-C14"),
    ("correspondence set", "对应集", "同源词逐音对齐后形成的音类对应序列。", "S2-C14"),
    ("conservative", "保守", "在某项特征上未发生变化的语言或方言。", "S2-C14"),
]

# Terms that are classroom-level rather than exam-level. Kept out of the
# committed glossary to hold it inside the 60-100 band for a word-formation
# course; they still appear inline in `terms` of the knowledge points.
GLOSSARY_DROP = {
    "morphologically complex", "morphologically simple", "simultaneous affix",
    "circumfix", "trial", "paucal", "clusivity", "genitive", "dative",
    "progressive", "analytic", "order of affixation", "tree diagram",
    "constituency", "head", "right-headed", "distribution", "interlinear gloss",
    "allomorph", "number", "zero affix", "isolating", "dual",
    "structural ambiguity", "reference", "contradiction", "degree",
    "non-compositional meaning", "attested", "eggcorn", "genericization",
    "euphemism", "semantic bleaching", "syncretism", "split",
    "correspondence set", "conservative", "root creation", "initialism",
    "analogical extension", "dissimilation", "hyperforeignism", "mondegreen",
    "lexical entry", "eventuality", "scale", "dvandva", "classifier",
}


SECTION_TITLES = {
    "S2-C5-S1": "5.1 What is morphology?",
    "S2-C5-S2": "5.2 Roots, bases, and affixes",
    "S2-C5-S3": "5.3 Morphology beyond affixes",
    "S2-C5-S4": "5.4 Allomorphy",
    "S2-C5-S5": "5.5 Lexical categories",
    "S2-C5-S6": "5.6 Derivational morphology",
    "S2-C5-S7": "5.7 Inflectional morphology",
    "S2-C5-S8": "5.8 Compounding",
    "S2-C5-S9": "5.9 Structural ambiguity in morphology",
    "S2-C5-S10": "5.10 How to draw morphological trees",
    "S2-C5-S11": "5.11 How to solve morphology problems",
    "S2-C5-S12": "5.12 Exercise your linguistics skills",
    "S2-C7-S1": "7.1 Linguistic meaning",
    "S2-C7-S2": "7.2 Compositionality: why not just syntax?",
    "S2-C7-S3": "7.3 Entailments vs. implicatures",
    "S2-C7-S4": "7.4 The mental lexicon",
    "S2-C7-S5": "7.5 The nature of lexical meaning",
    "S2-C7-S6": "7.6 Events and thematic roles",
    "S2-C7-S7": "7.7 Countability",
    "S2-C7-S8": "7.8 Individual- vs. stage-level predicates",
    "S2-C7-S9": "7.9 Degrees",
    "S2-C7-S10": "7.10 Why not the dictionary?",
    "S2-C7-S11": "7.11 Denotation",
    "S2-C7-S12": "7.12 Introduction to set theory",
    "S2-C7-S13": "7.13 Negative polarity items",
    "S2-C7-S14": "7.14 Summary",
    "S2-C7-S15": "7.15 Exercise your linguistics skills",
    "S2-C14-S1": "14.1 Why do languages change?",
    "S2-C14-S2": "14.2 Lexical change",
    "S2-C14-S3": "14.3 Phonological change",
    "S2-C14-S4": "14.4 Morphological change",
    "S2-C14-S5": "14.5 Syntactic change",
    "S2-C14-S6": "14.6 Semantic change",
    "S2-C14-S7": "14.8 Reconstructing the past",
    "S2-C14-S8": "14.9 Case study: reconstructing Proto-Chinese",
}

CHAPTERS = [
    ("S2-C5", "Morphology"),
    ("S2-C7", "Semantics"),
    ("S2-C14", "Historical Linguistics"),
]


def check(s1_sections: set[str]) -> list[str]:
    problems: list[str] = []
    for sid, items in KP.items():
        if sid not in SECTION_TITLES:
            problems.append(f"{sid}: 未登记的节")
        for i, (title, typ, summary, terms, examples, hint, xref) in enumerate(items, 1):
            kpid = "kp-" + sid.lower().replace("s2-", "").replace("-", "") + f"-{i}"
            if typ not in {"concept", "rule", "classification", "history", "method"}:
                problems.append(f"{kpid}: 未知 type {typ}")
            if hint not in {"基础", "拼写", "拉丁", "希腊", "词源", "新词", "科技", "advanced"}:
                problems.append(f"{kpid}: 未知 lessonHint {hint}")
            n = len(summary)
            if n < 20 or n > 60:
                problems.append(f"{kpid}: summary 长度 {n} 越界")
            if not terms:
                problems.append(f"{kpid}: 无术语")
            for en, zh in terms:
                if not en or not zh:
                    problems.append(f"{kpid}: 术语缺 en/zh")
            for r in xref:
                if r not in s1_sections:
                    problems.append(f"{kpid}: crossRef {r} 不在 S1")
    seen: dict[str, str] = {}
    for t, _zh, _d, ch in GLOSSARY:
        if t in GLOSSARY_DROP:
            continue
        if t in seen:
            problems.append(f"术语重复: {t} ({seen[t]} / {ch})")
        seen[t] = ch
    return problems


def main() -> int:
    s1_path = ROOT / "src" / "content" / "textbook" / "s1-chapters.json"
    s1_sections: set[str] = set()
    if s1_path.exists():
        s1 = json.loads(s1_path.read_text(encoding="utf-8"))
        for ch in s1["chapters"]:
            for sec in ch.get("sections", []):
                s1_sections.add(sec["id"])

    problems = check(s1_sections)
    if problems:
        print("自检失败：")
        for p in problems:
            print("  -", p)
        return 1

    chapters = []
    kp_map = []
    for cid, ctitle in CHAPTERS:
        sections = []
        for sid, stitle in SECTION_TITLES.items():
            if not sid.startswith(cid + "-"):
                continue
            kps = []
            for i, (title, typ, summary, terms, examples, hint, xref) in enumerate(KP.get(sid, []), 1):
                slug = sid.lower().replace("s2-", "").replace("-", "")
                kpid = f"kp-{slug}-{i}"
                kps.append({
                    "id": kpid,
                    "title": title,
                    "type": typ,
                    "summary": summary,
                    "terms": [{"en": en, "zh": zh} for en, zh in terms],
                    "examples": examples,
                    "lessonHint": hint,
                    "crossRef": xref,
                })
                kp_map.append({"kpId": kpid, "sectionId": sid, "sectionTitle": stitle,
                               "terms": [en for en, _ in terms]})
            sections.append({"id": sid, "title": stitle, "knowledgePoints": kps})
        chapters.append({"id": cid, "title": ctitle, "sections": sections})

    doc = {
        "sourceId": "S2",
        "title": "Essentials of Linguistics",
        "edition": "2nd",
        "license": "CC BY-NC-SA 4.0",
        "publisher": "eCampusOntario Pressbooks",
        "url": "https://ecampusontario.pressbooks.pub/essentialsoflinguistics2/",
        "note": "本文件只含中文概括与术语对应，不含教材原文；逐条锚点见 analysis/s2/anchors.json（本地保留，不入库）。",
        "chapters": chapters,
    }
    OUT_TOPICS.parent.mkdir(parents=True, exist_ok=True)
    OUT_TOPICS.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    gloss = [
        {"term": t, "zh": zh, "definition": d, "chapter": ch}
        for t, zh, d, ch in GLOSSARY if t not in GLOSSARY_DROP
    ]
    OUT_GLOSS.write_text(json.dumps(gloss, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    anchors_path = ROOT / "analysis" / "s2" / "anchors.json"
    anchors: dict[str, dict] = {}
    if anchors_path.exists():
        for a in json.loads(anchors_path.read_text(encoding="utf-8"))["sections"]:
            anchors[a["sectionId"]] = a
    for row in kp_map:
        a = anchors.get(row["sectionId"], {})
        row["postId"] = a.get("postId")
        row["url"] = a.get("url")
        row["sourceHeading"] = (a.get("headings") or [None])[0]

    OUT_MAP.parent.mkdir(parents=True, exist_ok=True)
    OUT_MAP.write_text(json.dumps({"source": "S2", "knowledgePoints": kp_map},
                                  ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    total = sum(len(s["knowledgePoints"]) for c in chapters for s in c["sections"])
    print(f"chapters={len(chapters)} sections={sum(len(c['sections']) for c in chapters)} "
          f"kps={total} glossary={len(gloss)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
