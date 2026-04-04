# 형태소 분석 & 단어 뜻 조회 — 문제와 의사결정

## 배경

일본어 가사 학습 앱에서 유저가 가사의 단어를 클릭하면 한국어 뜻을 보여주고, 플래시카드에 바로 등록할 수 있어야 한다. 이를 위해 형태소 분석(분절 + baseForm + POS)과 LLM(한국어 뜻 조회 + baseForm 보정)을 조합한다.

**핵심 목표**: 유저가 수정 없이 바로 단어장에 등록할 수 있는 UX.

---

## 1. 가사 번역과 단어 뜻 조회 분리

### 문제
기존에 Gemini 하나로 가사 번역 + 단어 뜻을 동시에 처리했더니, latency가 30초 → 5분으로 증가.

### 결정
- **가사 번역**: Gemini pro 급 모델, 번역 + 발음만 (단어 뜻 제외)
- **단어 뜻 조회**: flash lite 급 저가 모델로 병렬 처리
- 형태소 분석 데이터를 LLM input에 포함하는 것이 비용상 유리 (output 토큰 단가가 input의 4~8배)

---

## 2. 형태소 분석기 비교

5개 분석기 + 4개 사전 조합을 실험했다.

### 분석기별 발견된 문제

| 분석기 | 사전 | 문제 |
|---|---|---|
| Kuromoji | IPADic | いい→いう (baseForm 오류), うるせえ→파편, アンタ baseForm 미반환 |
| Kuromoji | UniDic | 1글자 히라가나를 SYMBOL로 오분류 (OOV 처리 약함) |
| Sudachi | UniDic core | どうか→どう+か, だから→だ+から (과분절), ご機嫌 하나로 합침 |
| Kagome | IPADic | Kuromoji와 동일한 IPADic 문제 공유 |
| MeCab | NEologd | もうさ→も+うさ (엔트리 과다로 오분절) |

### 사전별 특성

| 사전 | 엔트리 | 강점 | 약점 |
|---|---|---|---|
| IPADic (2007) | ~40만 | 분절 단위 적절, 안정적 | 구어체/신조어 미등록, baseForm 오류 |
| UniDic core | ~75만 | 구어체 처리 우수 (うるせえ 등) | 短単位 과분절 (どうか, だから) |
| UniDic full | ~330만 | core + 고유명사 | 추가분이 잡다한 고유명사라 가사에 이점 없음 |
| NEologd | ~320만 | 신조어/고유명사 최강 | 엔트리 과다로 오분절 위험 |

### 핵심 발견
- **IPADic과 UniDic이 상호 보완적**: IPADic은 분절이 적절하지만 구어체에 약하고, UniDic은 구어체에 강하지만 과분절함
- **단일 분석기로는 해결 불가능**
- Sudachi full은 가사 분석에 이점 없음 (제거 대상)
- Kuromoji에 UniDic을 붙이면 Sudachi와 유사한 결과를 얻으면서 라이브러리를 통일할 수 있음

---

## 3. 앙상블 전략

### 최종 결정: Kuromoji(IPADic) + Kuromoji(UniDic) → Least-split

같은 Kuromoji 라이브러리에 IPADic/UniDic 두 사전을 붙여서 앙상블한다.

**장점**:
- 같은 JVM 라이브러리, Docker 불필요
- Sudachi/Kagome/MeCab 의존성 제거 가능
- 사전 차이에 의한 상호 보완 효과

**Least-split 방식**: 각 문자 위치에서 두 분석기 중 더 긴 토큰을 채택.

### Least-split의 한계 (감수)

| 케이스 | 문제 | 심각도 |
|---|---|---|
| なるほど (好きになるほど) | IPADic이 하나로 합침, least-split이 채택 | 치명적 (의미 완전 다름) |
| どうか | UniDic이 분리, 하지만 least-split이 IPADic 채택 | 해결됨 |

### 검토했지만 채택하지 않은 전략

| 전략 | 불채택 이유 |
|---|---|
| 다수결 (3개 분석기) | UniDic 2:1로 どうか, だから 분리 — 치명적 |
| No-fragment | 파편 구간 감지가 불완전 |
| LLM-pick | flash lite로는 분절 판단 불가, 느림 |
| LLM 직접 분절 | 비결정적, merge/split 판단 불안정 |

### 결론
어떤 자동화 전략도 なるほど(합침 오류)와 どうか(분리 오류)를 동시에 해결할 수 없다. **Least-split으로 대부분 커버하고, 나머지는 유저 편집에 맡긴다.**

---

## 4. LLM 단어 뜻 조회

### 역할 분담
- **형태소 분석기**: 분절 (LLM이 못함)
- **LLM**: baseForm 보정 + 한국어 뜻 (형태소 분석기가 못함)

### LLM 프롬프트 핵심 규칙
1. 입력 words 배열과 1:1 대응 (분절 건드리지 않음)
2. baseForm이 문맥상 틀리면 수정 가능 (いう→いい)
3. 합치기는 명백한 오류일 때만 (随+に→随に)
4. SYMBOL 엔트리는 보내지 않되, 히라가나/카타카나/한자가 포함된 SYMBOL은 포함

### LLM으로 해결 가능한 것
- baseForm 보정 (いう→いい, だ→なら)
- 한국어 뜻 조회 (품사에 맞는 형태)
- 명백한 분절 오류 합치기 (随+に)

### LLM으로 해결 불가능한 것
- 분절 판단 (합칠지 쪼갤지): 프롬프트로 아무리 지시해도 비결정적
- POS 보정: flash lite 수준에서는 신뢰 불가
- charStart/charEnd 계산: LLM이 문자 위치를 정확히 계산 못함

### 발견된 이슈와 해결
- SYMBOL 토큰이 LLM input에 섞이면 원문과 words 정렬을 놓침 → SYMBOL 필터링으로 해결
- LLM이 불필요하게 단어를 합침 → "1:1 대응" strict rule로 해결
- temperature 0이어도 완전 결정적이지 않음

---

## 5. charStart/charEnd 처리

### 문제
분석기마다 공백 처리가 달라서 같은 단어의 charStart가 다름.

### 해결
앙상블 전에 모든 분석기의 토큰 위치를 **원문에서 surface를 순차 검색**하여 재계산 (normalizePositions).

### LLM 반환값의 charStart/charEnd
LLM이 surface를 반환하면, 백엔드/프론트에서 `indexOf(surface, from=이전charEnd)` 로 계산.

---

## 6. SYMBOL 필터링

### 문제
kuromoji-unidic이 ミ, む 같은 히라가나/카타카나를 SYMBOL로 오분류 → LLM/화면에서 누락.

### 해결
POS 기반 필터링 대신 **surface의 실제 문자**를 확인:
- 히라가나/카타카나/한자 포함 → POS가 SYMBOL이어도 포함
- 순수 기호 (공백, 괄호, 느낌표) → 제외

---

## 7. 최종 아키텍처

```
가사 입력
  ├→ [Gemini pro] 가사 번역 + 발음 (병렬)
  └→ [Kuromoji IPADic + Kuromoji UniDic] 형태소 분석
       → Least-split 앙상블
       → position normalization (공백 처리 통일)
       → SYMBOL 필터링 (히라가나/카타카나/한자 보존)
       → [Gemini flash lite] baseForm 보정 + 한국어 뜻
       → 유저에게 표시
       → 유저 편집 후 단어장 등록
```

### 의존성
- Kuromoji IPADic + UniDic (JVM, 두 개의 Gradle 의존성)
- Gemini API (번역용 pro + 단어용 flash lite)
- Sudachi, Kagome, MeCab은 제거 가능 (실험 완료)

### 향후 최적화
- 단어 뜻 캐싱: (baseForm, POS) → koreanText, 곡이 쌓일수록 비용 0에 수렴
- 유저 편집 UX: 카드 등록 시 baseForm/뜻 수정 가능하게
