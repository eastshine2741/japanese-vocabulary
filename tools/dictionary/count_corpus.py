"""코퍼스 parquet(text 컬럼)을 Sudachi 로 쪼개 기본형 표기별 횟수를 TSV 로 쓴다.

usage: count_corpus.py <in.parquet> <out.tsv> [--max-chars N] [--workers N]
"""
import argparse
import collections
import multiprocessing as mp

import pyarrow.parquet as pq

# Sudachi 는 한 번에 ~49KB 까지만 받는다
CHUNK = 4000
SKIP_POS = {"補助記号", "空白", "記号"}

_tok = None
_mode = None


def init():
    global _tok, _mode
    from sudachipy import Dictionary, SplitMode
    _tok = Dictionary(dict="core").create()
    # 가장 긴 단위(C)라야 JMdict 의 복합어(日本人)와 단위가 맞는다
    _mode = SplitMode.C


def work(lines):
    c = collections.Counter()
    for line in lines:
        for i in range(0, len(line), CHUNK):
            for m in _tok.tokenize(line[i:i + CHUNK], _mode):
                if m.part_of_speech()[0] not in SKIP_POS:
                    c[m.dictionary_form()] += 1
    return c


def batches(path, max_chars):
    total, buf, size = 0, [], 0
    for rb in pq.ParquetFile(path).iter_batches(batch_size=200, columns=["text"]):
        for text in rb.column(0).to_pylist():
            for line in text.split("\n"):
                line = line.strip()
                if len(line) < 10:
                    continue
                buf.append(line)
                size += len(line)
                total += len(line)
                if size > 200_000:
                    yield buf
                    buf, size = [], 0
                if total >= max_chars:
                    if buf:
                        yield buf
                    return
    if buf:
        yield buf


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--max-chars", type=int, default=10**12)
    ap.add_argument("--workers", type=int, default=max(1, mp.cpu_count() - 2))
    args = ap.parse_args()

    total = collections.Counter()
    with mp.Pool(args.workers, initializer=init) as pool:
        for c in pool.imap_unordered(work, batches(args.src, args.max_chars)):
            total.update(c)
    with open(args.out, "w", encoding="utf-8") as f:
        for form, n in total.most_common():
            f.write(f"{form}\t{n}\n")
    print(f"{args.src}: {sum(total.values()):,} tokens, {len(total):,} types")


if __name__ == "__main__":
    main()
