"""빈도 집계용 코퍼스를 받아 text 컬럼 하나짜리 parquet 로 저장한다.

- wikipedia: wikimedia/wikipedia 20231101.ja 의 한 샤드 (CC BY-SA)
- web: HuggingFaceFW/fineweb-2 jpn_Jpan 첫 파일의 앞부분 (ODC-BY). 파일이 4.8GB 라 row group 단위로 범위 요청한다.

usage: fetch_corpus.py <out_dir> [--web-chars N]
"""
import argparse
import os
import shutil

import pyarrow as pa
import pyarrow.parquet as pq
from huggingface_hub import HfFileSystem, hf_hub_download

WIKI_REPO = "wikimedia/wikipedia"
WIKI_FILE = "20231101.ja/train-00014-of-00015.parquet"
WEB_FILE = "datasets/HuggingFaceFW/fineweb-2/data/jpn_Jpan/train/000_00000.parquet"


def fetch_wikipedia(out_dir):
    path = hf_hub_download(WIKI_REPO, WIKI_FILE, repo_type="dataset")
    shutil.copyfile(path, os.path.join(out_dir, "wikipedia.parquet"))


def fetch_web(out_dir, max_chars):
    tables, total = [], 0
    with HfFileSystem().open(WEB_FILE, "rb") as f:
        pf = pq.ParquetFile(f)
        for i in range(pf.num_row_groups):
            t = pf.read_row_group(i, columns=["text"])
            tables.append(t)
            total += sum(len(x) for x in t.column(0).to_pylist())
            if total >= max_chars:
                break
    pq.write_table(pa.concat_tables(tables), os.path.join(out_dir, "web.parquet"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out_dir")
    # 위키 샤드(약 4,700만 단어)와 비슷한 규모가 되는 글자 수
    ap.add_argument("--web-chars", type=int, default=110_000_000)
    args = ap.parse_args()
    os.makedirs(args.out_dir, exist_ok=True)
    fetch_wikipedia(args.out_dir)
    fetch_web(args.out_dir, args.web_chars)


if __name__ == "__main__":
    main()
