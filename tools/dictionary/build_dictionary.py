"""JMdict + tanos JLPT + 코퍼스 빈도로 worker 가 읽는 SQLite 사전을 만든다.

usage: build_dictionary.py <JMdict_e.gz> <tanos_dir> <out.sqlite> <counts.tsv>...

counts.tsv 는 count_corpus.py 출력이다. 코퍼스마다 10억 단어당 비율로 바꿔 평균내므로 큰 코퍼스 하나가 빈도를 독차지하지 않는다.
"""
import collections
import csv
import datetime
import gzip
import io
import json
import math
import os
import re
import sqlite3
import sys
import xml.etree.ElementTree as ET

# jisho 가 내려주던 POS 라벨. JishoPartOfSpeechMapper 와 LexicalResolver 가 이 문자열("suru verb", "godan verb")로 판정하므로
# JMdict 원문 설명("noun or participle which takes the aux. verb suru")을 그대로 쓰면 판정이 깨진다.
JISHO_POS = {
    "adj-f": "Noun or verb acting prenominally",
    "adj-i": "I-adjective (keiyoushi)",
    "adj-ix": "I-Adjective (keiyoushi) - yoi/ii class",
    "adj-na": "Na-adjective (keiyodoshi)",
    "adj-nari": "Archaic/formal form of na-adjective",
    "adj-no": "Noun which may take the genitive case particle 'no'",
    "adj-pn": "Pre-noun adjectival (rentaishi)",
    "adj-t": "'taru' adjective",
    "adv": "Adverb (fukushi)",
    "adv-to": "Adverb taking the 'to' particle",
    "aux": "Auxiliary",
    "aux-adj": "Auxiliary adjective",
    "aux-v": "Auxiliary verb",
    "conj": "Conjunction",
    "cop": "Copula",
    "ctr": "Counter",
    "exp": "Expressions (phrases, clauses, etc.)",
    # jisho 는 감탄사 라벨을 비워 보내 앞 sense 의 POS 가 이어 붙었다(ほら 가 대명사로 분류됨)
    "int": "Interjection",
    "n": "Noun",
    "n-pref": "Noun, used as a prefix",
    "n-suf": "Noun, used as a suffix",
    "num": "Numeric",
    "pn": "Pronoun",
    "pref": "Prefix",
    "prt": "Particle",
    "suf": "Suffix",
    "v1": "Ichidan verb",
    "v1-s": "Ichidan verb - kureru special class",
    "v2a-s": "Nidan verb with 'u' ending (archaic)",
    "v2k-k": "Nidan verb (upper class) with 'ku' ending (archaic)",
    "v2k-s": "Nidan verb (lower class) with 'ku' ending (archaic)",
    "v2n-s": "Nidan verb (lower class) with 'nu' ending (archaic)",
    "v4k": "Yodan verb with 'ku' ending (archaic)",
    "v5b": "Godan verb with 'bu' ending",
    "v5g": "Godan verb with 'gu' ending",
    "v5k": "Godan verb with 'ku' ending",
    "v5k-s": "Godan verb - Iku/Yuku special class",
    "v5m": "Godan verb with 'mu' ending",
    "v5n": "Godan verb with 'nu' ending",
    "v5r": "Godan verb with 'ru' ending",
    "v5r-i": "Godan verb with 'ru' ending (irregular verb)",
    "v5s": "Godan verb with 'su' ending",
    "v5t": "Godan verb with 'tsu' ending",
    "v5u": "Godan verb with 'u' ending",
    "vi": "Intransitive verb",
    "vk": "Kuru verb - special class",
    "vn": "Irregular nu verb",
    "vs": "Suru verb",
    "vs-i": "Suru verb - included",
    "vs-s": "Suru verb - special class",
    "vt": "Transitive verb",
}

XML_ENTITIES = {"amp", "lt", "gt", "quot", "apos"}


def kata(s):
    return "".join(chr(ord(c) + 0x60) if "ぁ" <= c <= "ゖ" else c for c in s)


def load_jmdict(path):
    """POS 를 엔티티 코드로 받기 위해 DTD 를 떼고 &code; 를 code 로 바꿔 파싱한다."""
    raw = gzip.open(path).read().decode("utf-8")
    created = re.search(r"JMdict created: (\S+)", raw)
    descriptions = dict(re.findall(r'<!ENTITY (\S+) "([^"]*)">', raw))
    raw = re.sub(r"<!DOCTYPE.*?\]>", "", raw, flags=re.S)
    raw = re.sub(r"&([\w-]+);", lambda m: m.group(0) if m.group(1) in XML_ENTITIES else m.group(1), raw)

    def label(code):
        if code in JISHO_POS:
            return JISHO_POS[code]
        d = descriptions.get(code, code)
        return d[:1].upper() + d[1:]

    entries = []
    for _, el in ET.iterparse(io.BytesIO(raw.encode("utf-8"))):
        if el.tag != "entry":
            continue
        seq = int(el.findtext("ent_seq"))
        # 검색 전용 표기(sK/sk)는 jisho 도 응답에 넣지 않는다. 넣으면 다른 엔트리와 표기가 겹쳐 후보가 늘어난다
        kebs = [k.findtext("keb") for k in el.findall("k_ele") if "sK" not in [x.text for x in k.findall("ke_inf")]]

        # jisho 응답의 japanese[] 순서: 한자 표기마다 그 표기에 붙는 읽기, 그다음 한자 없이 쓰는 읽기
        readings = []
        for r in el.findall("r_ele"):
            if "sk" in [x.text for x in r.findall("re_inf")]:
                continue
            restr = {x.text for x in r.findall("re_restr")}
            # 묶인 한자가 모두 검색 전용이면 남는 한자 표기가 없으니 한자 없이 쓰는 읽기로 둔다
            nokanji = r.find("re_nokanji") is not None or not kebs or (restr and not restr & set(kebs))
            readings.append((r.findtext("reb"), restr, nokanji))
        rebs = [reb for reb, _, _ in readings]
        forms = [(k, reb) for k in kebs for reb, restr, nokanji in readings if not nokanji and (not restr or k in restr)]
        forms += [(None, reb) for reb, _, nokanji in readings if nokanji]

        senses, carry = [], []
        for s in el.findall("sense"):
            glosses = [g.text for g in s.findall("gloss") if g.text]
            pos = [label(p.text) for p in s.findall("pos")] or carry
            carry = pos
            if glosses:
                senses.append({"pos": pos, "english": " / ".join(glosses), "englishDefinitions": glosses})

        # 빈도는 엔트리의 표기들을 합산한다(いる/居る 를 한 단어로). 가나 표기는 가나로 쓰는 엔트리에만 더한다:
        # 그러지 않으면 煎る·射る·要る 가 모두 いる 의 빈도를 받아 흔한 단어가 된다
        usually_kana = not kebs or any("uk" in [m.text for m in s.findall("misc")] for s in el.findall("sense"))
        written = set(kebs)
        if usually_kana:
            written |= set(rebs) | {kata(reb) for reb in rebs}
        entries.append((seq, forms, senses, written))
        el.clear()
    return entries, (created.group(1) if created else "unknown")


def load_jlpt(tanos_dir):
    levels = collections.defaultdict(set)
    for n in range(1, 6):
        with open(f"{tanos_dir}/n{n}.csv", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row["jmdict_seq"]:
                    levels[int(row["jmdict_seq"])].add(f"jlpt-n{n}")
    return levels


def load_counts(paths):
    """기본형 표기 -> 10억 단어당 빈도.

    Sudachi 의 읽기는 쓰지 않는다. 한자 표기를 문맥과 상관없이 한 읽기로 찍어서(私 를 거의 늘 ワタクシ) 읽기별로 나누면
    私[わたし] 같은 흔한 엔트리가 0 이 된다.
    """
    freq = collections.Counter()
    for path in paths:
        rows = [line.rstrip("\n").split("\t") for line in open(path, encoding="utf-8")]
        total = sum(int(n) for _, n in rows)
        for form, n in rows:
            freq[form] += int(n) / total * 1e9 / len(paths)
    return freq


def main():
    jmdict, tanos_dir, out, *count_paths = sys.argv[1:]
    entries, created = load_jmdict(jmdict)
    jlpt = load_jlpt(tanos_dir)
    freq = load_counts(count_paths)

    db = sqlite3.connect(out)
    db.executescript("""
        DROP TABLE IF EXISTS entries; DROP TABLE IF EXISTS forms; DROP TABLE IF EXISTS meta;
        CREATE TABLE entries (seq INTEGER PRIMARY KEY, senses TEXT NOT NULL, jlpt TEXT NOT NULL, zipf REAL);
        CREATE TABLE forms (seq INTEGER NOT NULL, ord INTEGER NOT NULL, headword TEXT, reading TEXT NOT NULL, PRIMARY KEY (seq, ord));
        CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    """)
    kept = 0
    for seq, forms, senses, written in entries:
        if not senses:
            continue
        kept += 1
        count = sum(freq[f] for f in written)
        db.execute(
            "INSERT INTO entries VALUES (?, ?, ?, ?)",
            (seq, json.dumps(senses, ensure_ascii=False), json.dumps(sorted(jlpt.get(seq, ()))),
             math.log10(count) if count > 0 else None),
        )
        db.executemany(
            "INSERT INTO forms VALUES (?, ?, ?, ?)",
            [(seq, i, k, kata(reb)) for i, (k, reb) in enumerate(forms)],
        )
    db.executescript("""
        CREATE INDEX forms_headword ON forms (headword);
        CREATE INDEX forms_reading ON forms (reading);
    """)
    db.executemany("INSERT INTO meta VALUES (?, ?)", [
        ("jmdict_created", created),
        ("built_at", datetime.date.today().isoformat()),
        ("corpora", ",".join(os.path.basename(p) for p in count_paths)),
    ])
    db.commit()
    db.execute("VACUUM")
    db.close()
    print(f"{out}: {kept:,} entries (JMdict {created})")


if __name__ == "__main__":
    main()
