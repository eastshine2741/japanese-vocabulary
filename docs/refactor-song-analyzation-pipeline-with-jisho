# Goal
- 단어의 의미를 사전(jisho)에서 정확하게 구별하여 가져올 수 있도록 하네스를 리팩토링
- 목표 결과물은 사용자가 공부에 사용할 수 있는 단어와 문장으로, 다음을 포함해야 한다:
  - 단어
    - 사전형 일본어 단어
    - 사전형 일본어 발음
    - 문장에서 사용된 한국어 뜻
    - 문장에서 사용된 한국어 뜻의 품사
  - 문장
    - 일본어 원문
    - 한국어 번역문
    - 일본어 발음(히라가나)

# Architecture(Stages)
1. sense translation stage
- goal
  - 일본어 가사를 한국어 문장으로 맥락과 문화 등을 반영하여 자연스럽게 번영한다
- 분류
  - LLM
- 현재 구현에서 달라지는 점
  - 한국어 발음을 출력하지 않게 변경. segmentation stage에서 추출하는 usedReading의 나열으로 대체한다.
- 선행 stage
  - 없음
- input
  - 일본어 가사 문장들
- output
  - 한국어 문장 번역

2. segmentation stage
- goal
  - 일본어 가사의 맥락을 이해하고, 문장을 분절하여 segment를 추출한다.
  - 'segment'의 정의는 output을 참고.
- 분류
  - LLM
- 남은 결정
  - 문장을 청크로 묶어서 병렬 처리할지. 실제로 실험하여, 속도와 응답 품질 개선을 보고 결정할 것.
  - 이후 stage들의 기반이 되며 문장 맥락 이해가 필수적이므로, 비싸더라도 품질 좋은 모델을 써야할 것 같음. pro 레벨까지 필요할지 실험 필요
- 선행 stage
  - 없음
- input
  - 일본어 가사 문장들
- output
  - segment들
    - 문장에 드러난 일본어 단어 자체(usedWord? 네이밍 필요)
    - 사전형 일본어 단어(headword? 네이밍 필요)
    - 문장에서 읽히는 일본어 발음(히라가나) (usedReading? 네이밍 필요)
    - 사전형 일본어 발음(히라가나) (baseformReading? 네이밍 필요)
    - 문맥에서 사용된 영어 뜻(prototype sense? 네이밍 필요)
      - 이후 sense select 단계에서 사용하기 위한 용도로, 구체적이지 않게 문맥 구별이 가능할 정도로만 짧은 영어.

3. entry-select 단계
- goal
  - 사전(jisho)을 조회하여, 정규화된 사전 entry를 얻는다.
  - entry는 headword와 baseformReading의 조합으로 규정한다. jisho 검색결과에서 exact matching으로 programmatic하게 결정한다.
- 선행 stage
  - segmentation stage
- input
  - segment들
- output
  - segment-with-senses
    - segment 하위에 senses[]가 추가된 형태
    - jisho에서 검색되는 sense 필드이다.

4. sense-select 단계
- goal
  - 2개 이상의 sense를 가지는 segment의 경우, 문맥에서 사용된 sense 하나만을 고른다.
  - fyi: 이 과정에서 pos가 확정된다. pos는 sense의 하위이기 때문
  - segmentation stage에서 만들었던 prototype sense를 여기에서 사용한다. LLM은 senses[] 중 prototype sense와 비슷한 것을 단 하나 고른다.
  - 애초에 sense가 하나뿐인 segment는 LLM 호출하지 않는다.
- 분류
  - LLM
- 선행 stage
  - entry-select stage
- input
  - segment-with-senses
- output
  - segment-with-one-sense
    - senses[] 중에서 딱 하나만 고른 형태

5. sense-translation 단계
- goal
  - jisho에서 얻은 sense는 영어이므로, 한국어로 번역한다.
- 분류
  - LLM
- 선행 stage
  - sense-select stage
- input
  - segment-with-one-sense
- output
 - segment-with-one-translated-sense