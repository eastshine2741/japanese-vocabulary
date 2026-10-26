# 내장 사전 (JMdict SQLite)

곡 분석의 사전 조회(`DictionaryService` → `JmdictDictionary`)는 worker 파드가 기동할 때 받은 JMdict SQLite 파일을 읽는다. 단어 난이도로 쓸 빈도(`entries.zipf`)도 같은 파일에 들어 있다. 파일은 `tools/dictionary/` 스크립트로 만든다.

## 왜 운영 MySQL 이 아니라 파일인가

- 사전은 엔트리 약 22만, 표기 약 33만 행이고 InnoDB 로 100~150MB 다. 운영 MySQL 은 메모리 상한 1Gi 에 `innodb_buffer_pool_size` 기본값(128MB)으로 돈다. 분석이 사전을 읽을 때마다 유저 단어·플래시카드 페이지가 버퍼 풀에서 밀려난다.
- 앱은 읽기만 하고 교체는 통째로 한다. 파일 하나를 바꿔 끼우는 쪽이 적재·롤백이 단순하다.
- init container 가 파일을 받지 못하면 새 파드가 뜨지 않고 이전 파드가 계속 처리한다.

## 바꾸면 깨지는 것

- **POS 문자열은 고정 라벨이다** (`build_dictionary.py` 의 `POS_LABELS`). `DictionaryPartOfSpeechMapper` 와 `LexicalResolver` 가 `"suru verb"`, `"godan verb"` 같은 문자열로 판정한다. JMdict 원문 설명(`noun or participle which takes the aux. verb suru`)을 그대로 넣으면 する 동사 해석이 조용히 깨진다.
- **검색 전용 표기(`sK`/`sk`)는 넣지 않는다.** 넣으면 다른 엔트리와 표기가 겹쳐 후보 엔트리가 늘고 `AMBIGUOUS_HEADWORD` 가 잦아진다.
- **`zipf` NULL 은 "코퍼스에 한 번도 안 나온 엔트리"라는 뜻으로 조회에도 쓴다.** 조사로 끝나는 가나 headword(조사가 붙은 것일 공산이 크다)가 읽기로만 닿은 한자 엔트리 중 NULL 인 것(うちに → 打ち荷)은 `LexicalResolver` 가 버린다. 빌드에서 NULL 의 의미를 바꾸면(예: 값이 없으면 0 으로 채움) 이 필터가 깨진다.
- **읽기는 가타카나로 저장한다.** 조회 쪽 `JapaneseText.toKatakana` 와 같은 변환(히라가나 U+3041–3096 에 0x60)이라야 읽기 일치가 맞는다.

## 알려진 한계

- さん·だ·よう 같은 짧은 가나는 읽기가 같은 엔트리가 모두 후보로 와서 `AMBIGUOUS_HEADWORD` 가 된다.
- 인명·지명(JMnedict)은 없다. 楊貴妃 같은 한자 고유명사는 `DICTIONARY_MISS` 가 되어 분절 재시도를 한 번 부르고 뜻 없이 남는다. 가타카나 표면은 원래 이 검사에서 빠진다.
- JLPT 는 tanos 원본 CSV 를 JMdict seq 로 붙인다.

## 난이도 (`zipf`)

- 엔트리마다 Zipf(= log10(10억 단어당 빈도)) 하나다. 위키백과 일본어 한 샤드와 FineWeb-2 일본어 웹 텍스트 앞부분(각각 약 4,700만 단어)을 Sudachi 긴 단위(C)로 세고, 코퍼스마다 비율로 바꿔 평균낸다.
- 엔트리의 표기별 횟수를 합산하므로 いる/居る 가 한 단어로 잡힌다. 가나 표기 횟수는 가나 전용이거나 `uk`(보통 가나로 씀) 엔트리에만 더한다. 그러지 않으면 煎る·射る 가 いる 의 빈도를 받아 흔한 단어가 된다. 같은 가나로 쓰는 居る·要る 는 여전히 같은 값이다.
- Sudachi 의 읽기는 쓰지 않는다. 한자 표기를 문맥과 상관없이 한 읽기로 찍어서(私 를 거의 늘 ワタクシ) 읽기로 나누면 私[わたし] 가 0 이 된다. 그래서 같은 한자 표기를 공유하는 엔트리(私 わたし/わたくし)는 같은 값을 받는다.
- 남의 빈도표(wordfreq)를 쓰지 않는 이유: 활용형을 따로 세어 동사가 같은 JLPT 등급 명사보다 체계적으로 낮게 나오고, 문자열 단위라 읽기를 구분하지 못한다.
- 알려진 치우침: 형용사가 같은 등급 명사보다 Zipf 0.3 정도 낮다(위키 문체). 青空文庫를 섞으면 형용사는 맞지만 옛말(云う 5.6)이 초급처럼 올라가서 뺐다.
- dev 곡 토큰의 96%(등장 횟수 기준)에 값이 붙는다. 가나 토큰은 읽기로, 한자 토큰은 `(baseForm, baseFormReading)` 로 찾은 결과다. 빠지는 것은 誰か·僕ら 처럼 Sudachi 가 더 잘게 쪼개는 엔트리, 의성어·가사 조어, 표기와 읽기가 다른 엔트리에서 온 토큰(`なれる(ナル)`)이다.

## 라이선스

- 출처는 앱 오픈소스 라이선스 화면(`app-rn/src/data/ossList.ts` 의 `EXTERNAL_SERVICES`)에 싣는다. 데이터 출처를 바꾸면 여기도 고친다.
- JMdict(CC BY-SA 4.0): EDRDG 가 정한 고지 문장을 그대로 실어야 하고, 최신판을 유지하라고 요구한다. 정기적으로 다시 빌드한다.
- FineWeb-2(ODC-BY), 위키백과(CC BY-SA), tanos JLPT(CC BY)도 같은 화면에 표기한다.
- JEV(日本語教育語彙表)와 BCCWJ 빈도표는 연구·교육용 한정이라 쓰지 않는다.

## 갱신

```bash
cd tools/dictionary
python -m venv .venv && .venv/bin/pip install -r requirements.txt
mkdir -p work && cd work
curl -LO http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz
mkdir -p tanos && for n in 1 2 3 4 5; do curl -L -o tanos/n$n.csv https://raw.githubusercontent.com/stephenmk/yomitan-jlpt-vocab/main/original_data/n$n.csv; done
../.venv/bin/python ../fetch_corpus.py corpus                       # 코퍼스는 바뀌지 않으니 처음 한 번
../.venv/bin/python ../count_corpus.py corpus/wikipedia.parquet wikipedia.tsv
../.venv/bin/python ../count_corpus.py corpus/web.parquet web.tsv
../.venv/bin/python ../build_dictionary.py JMdict_e.gz tanos jmdict-$(date +%Y%m%d).sqlite wikipedia.tsv web.tsv
```

만든 파일은 날짜가 든 이름 그대로 공개 URL 에 올리고 `.env`/`.env.prod` 의 `DICTIONARY_URL` 을 바꿔 배포한다. 이전 파일을 지우지 않으면 URL 을 되돌리는 것으로 롤백된다.
