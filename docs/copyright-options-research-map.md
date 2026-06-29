# 저작권 리스크 선택지와 확인할 내용

> 작성일: 2026-06-29  
> 목적: 법률상담 이후, 남은 선택지와 각 선택지를 고르기 전에 확인해야 할 내용을 연결해서 정리한다.  
> 전제: 이 문서는 법률 의견이 아니라, 상담 내용과 현재 앱 구조를 바탕으로 한 의사결정 정리용 문서다.

## 1. 현재 판단의 출발점

상담 결과를 기준으로 보면, 현재 앱의 핵심 쟁점은 UX가 아니라 `가사를 사용한다는 사실` 자체다.

- YouTube MV에 맞춰 현재 가사 라인을 보여주는 구조는 앱의 핵심 경험이다.
- 노래를 끝까지 재생하면 사용자는 결국 가사 전문을 순차적으로 보게 된다.
- 서버에는 가사 전문과 번역/분석 결과가 저장된다.
- API는 전체 study units를 내려준다.
- 한국어 번역과 예문 저장은 별도 위험을 추가한다.

따라서 `한 화면에 한 줄만 보여준다`, `스크롤을 스와이프로 바꾼다`, `앞뒤 한 줄만 보여준다` 같은 UX 제한은 리스크 완화 요소일 수는 있어도, 근본 해결책은 아니다.

## 2. 선택지 요약

| 선택지 | 핵심 의미 | 앱 핵심 경험 유지 | 법적 안정성 | 비용/난이도 | 현재 단계 적합도 |
| --- | --- | --- | --- | --- | --- |
| A. 정식 라이선스 확보 | 가사 이용허락을 받고 운영 | 높음 | 가장 높음 | 높음 | 검증 필요 |
| B. 무허가 소규모 운영 | 무료/무광고/저홍보로 리스크 감수 | 높음 | 낮음 | 낮음 | 단기만 가능 |
| C. 부분 회피형 구조 | OCR/로컬 처리 등으로 저장·전송 최소화 | 중간~낮음 | 중간 | 높음 | 제품 변경 큼 |
| D. 가사 없는 피벗 | 가사를 핵심에서 제거 | 낮음 | 높음 | 중간 | 핵심 가치 훼손 |

현재 하고 있는 `개발 보류 후 권리/사업성 검증`은 위 선택지들과 배타적인 선택지가 아니다. A~D 중 무엇을 고를지 결정하기 위한 공통 선행 단계다.

## 3. 공통 선행 단계: 권리/사업성 검증

지금 단계의 목표는 새 기능을 더 만드는 것이 아니라, A~D 중 어떤 선택지가 실제로 가능한지 판단하는 것이다.

확인해야 하는 것:

- Musixmatch/LyricFind/KOMCA/JASRAC/NexTone 중 현실적으로 접근 가능한 경로가 무엇인지
- 각 경로의 최소 비용, 사용량 기반 비용, 계약 기간, 정산 방식
- 어떤 기능을 포기하면 계약 비용이나 권리 범위가 크게 줄어드는지
- 유료 구독 가격, 무료 사용량 제한, provider API 호출량이 단위경제에 맞는지
- YouTube 임베드 기반 앱이 광고/구독/상업 운영을 할 수 있는지
- Gemini 유료 API를 쓰면 prompt 학습 이슈가 어느 정도 줄어드는지

이 단계의 종료 조건:

- A를 선택할 수 있는 라이선스 경로와 비용 구조가 확인된다.
- 또는 A가 당장 불가능하므로 B/C/D 중 하나를 의식적으로 선택한다.
- 또는 권리/비용 구조가 불명확해서 본격 홍보를 보류한다고 결정한다.

## 4. 사용자 결정/제약조건

이 섹션은 조사 과정에서 사용자가 직접 답한 의사결정 기준을 기록한다. 이후 추가 질문에 대한 답도 여기에 누적한다.

### 2026-06-29 현재 답변

- 본격 홍보 전 법적 확실성 기준: `중간`
  - 완전한 면책이나 라이선스 확정 전까지 무조건 중단하는 것은 아니다.
  - 어떤 부작용과 어느 정도의 위험이 있는지 인지한 상태에서, 적절한 대응을 한 뒤 홍보하고 싶다.
- 월 고정비 한도: `5만원`
  - 수익 0 또는 거의 0인 현재 단계에서 저작권 provider/API/AI 때문에 감당 가능한 심리적 상한이다.
- 본격 홍보 전 임시로 끌 수 있는 기능:
  - `provider coverage 밖 곡 차단`은 가능하다.
  - `YouTube MV 재생`은 노래를 재생할 다른 수단이 있다면 끌 수 있다.
- 한국어 가사 번역 표시:
  - `부분적으로 가능`
  - 자연스러운 가사 번역 대신 직역/문장 해설로 바꾸는 것은 가능하다.
  - 다만 주 타겟 유저가 일본어를 구사하지 못하는 한국인이므로, 불편하지 않은 UX는 추가 고민이 필요하다.
- 단어장/플래시카드 예문:
  - `부분적으로 가능`
  - 플래시카드에 lyric line 전문을 그대로 저장/표시하는 것은 줄일 수 있다.
  - 다만 최소한 재생화면으로 이동해서 해당 가사 라인을 다시 재생할 수 있는 연결은 유지해야 한다.
- 1차 수익화 방향:
  - 유저 수가 늘어나는 것을 확인한 뒤 `광고`를 붙이는 방향을 생각하고 있다.
  - 따라서 본격 수익화 전에는 YouTube 콘텐츠가 있는 화면에서 광고를 붙여도 되는지, 앱의 독립 학습 가치가 충분한지 확인해야 한다.
- 리스크 허용선:
  - 앱 삭제는 감수하기 어렵다.
  - 곡 단위 삭제는 감수할 수 있다.
  - 손해배상 가능성도 피하고 싶다.
  - 따라서 무허가 소규모 운영을 하더라도 앱 전체 정지나 금전 책임으로 번지지 않도록 곡 단위 차단, 신고 대응, 고위험 기능 제한이 필요하다.
- 제품 정체성의 최저선:
  - 정식 음악 앱/OCR 연동처럼 UX가 불편해져도, 가사 기반 학습 경험이 유지되면 가능하다.
  - 따라서 앱이 직접 모든 가사/MV를 제공하지 않는 `부분 회피형 구조`도 실제 후보가 될 수 있다.
- 대상 곡 범위:
  - 본격 홍보 초기에는 provider/권리 확인된 곡만 지원하도록 줄일 수 있다.
  - 다만 장기적으로는 가능하면 모든 곡을 지원하고 싶다.
  - 따라서 초기 제품 정책은 `권리 확인 곡 중심`, 장기 전략은 `coverage 확장`으로 나누어 검토한다.
- 서버 저장 구조:
  - `조건부로 바꿀 수 있음`
  - AI를 온디바이스에서 돌리는 등의 방식으로 개발자가 매번 AI 비용을 부담하지 않는 구조라면, 서버에 가사/분석 결과를 저장하지 않아도 된다.
  - 현재 서버에 가사와 분석 결과를 저장하는 주된 이유는, 매번 AI로 분석하는 비용을 한 번만 내기 위한 비용 최적화다.
  - 따라서 서버 저장은 제품 핵심 요구라기보다 비용 구조에서 나온 구현 선택이다.
- AI 처리 방식:
  - 현재 Gemini API는 이미 유료로 사용 중이다.
  - 사용 중인 Gemini API key는 tier 1 비용이 나가고 있다.
  - 따라서 Gemini 무료 quota/AI Studio의 입력·출력 학습 사용 리스크는 현재 구조의 핵심 문제는 아니다.
  - 다만 저작권 있는 가사를 Gemini에 입력할 권리 문제, abuse logging, 서버 저장/전송 문제는 여전히 남는다.
  - 온디바이스/로컬 모델도 검토 가능하다.
- 홍보 전 최소 조치 기준:
  - `고위험 기능 일부를 끄고 시작 가능`
  - 예: 번역 축소, 예문 전문 저장 축소, provider 밖 곡 차단 등.
  - 즉 provider/KOMCA/YouTube의 답변을 반드시 받은 뒤에만 홍보할 필요는 없다고 본다.
- 실제 문의 우선순위:
  - 가장 먼저 `KOMCA/JASRAC`에 문의한다.
  - 목적은 한국에서 운영하는 일본어 학습 앱이 일본곡 가사를 time-synced lyrics로 표시하고, 문장 해설/단어장 연결을 제공할 때 어떤 이용허락이 필요한지 확인하는 것이다.
- 질문 진행 방식:
  - 사용자의 결정이 필요한 질문은 한 번에 여러 개 묻지 말고 하나씩 묻는다.

## 5. 선택지별로 알아봐야 하는 것

### A. 정식 라이선스 확보

이 선택지는 현재 앱의 핵심 경험을 유지하면서 장기적으로 운영하려는 경우의 정공법이다.

확인해야 하는 것:

- KOMCA/JASRAC/NexTone 등을 통해 일본곡 가사 사용을 한국 앱에서 일괄 허락받을 수 있는지
- 허락 범위에 `가사 원문 표시`, `time-synced lyrics`, `서버 저장`, `API 전송`, `모바일 앱 표시`가 포함되는지
- 한국어 번역 제공이 해당 관리단체 허락 범위에 포함되는지
- 번역권/개작권은 음악출판사 또는 원권리자에게 개별 허락을 받아야 하는지
- 사용자가 아무 곡이나 선택할 수 있는 구조에서, 관리단체가 관리하지 않는 곡은 어떻게 처리해야 하는지
- Musixmatch/LyricFind 같은 provider 계약이 위 권리 처리를 실제로 대체하거나 포함하는지
- provider 계약이 `AI 분석`, `번역`, `플래시카드 예문 저장`, `캐싱`, `상업 앱`, `YouTube MV와 결합`을 허용하는지
- provider의 보컬로이드/우타이테/애니송/J-pop coverage가 실제로 충분한지
- 최소 월 비용과 MAU/DAU 증가 시 비용 증가 구조가 앱의 유료화 모델과 맞는지

이 선택지를 고를 수 있는 조건:

- 가사 원문과 synced lyrics를 합법적으로 제공할 경로가 확인된다.
- 번역/문장 해설/예문 저장 중 어떤 기능이 계약 범위에 포함되는지 명확하다.
- 예상 매출에서 provider/API/AI 비용을 감당할 수 있다.
- 계약 범위 밖 곡을 숨기거나 제한하는 제품 정책을 만들 수 있다.

### B. 무허가 소규모 운영

이 선택지는 법적으로 안전하다는 뜻이 아니라, 권리자에게 발견되거나 문제 제기될 가능성이 낮은 상태에서 제한적으로 운영하는 선택이다.

확인해야 하는 것:

- 무료·무광고·저홍보 상태에서도 앱스토어 배포 자체가 어느 정도 위험을 만드는지
- 권리자 신고 시 즉시 삭제하는 프로세스가 손해배상 리스크를 어느 정도 줄이는지
- 서버에 저장된 가사/번역을 곡 단위로 즉시 비공개 또는 삭제할 수 있는지
- 홍보, 유료화, 광고, 공유 기능, 추천 알고리즘이 리스크를 얼마나 높이는지
- 비슷한 앱들이 실제로 라이선스를 받았는지, 아니면 묵인 상태인지 확인 가능한지
- YouTube 임베드와 자체 광고/유료화가 YouTube 약관상 허용되는지

이 선택지를 고를 수 있는 조건:

- 본격 홍보를 하지 않는다.
- 유료화와 광고를 붙이지 않는다.
- 권리자 요청 시 곡 단위 삭제가 즉시 가능하다.
- 언제든 라이선스 확보 또는 기능 중단으로 전환할 준비가 있다.

주의할 점:

- 상담 내용상, 수익이 작아도 침해가 아니게 되는 것은 아니다.
- 수익 규모는 주로 손해배상액 산정에 영향을 줄 뿐, 침해 성립 여부를 없애지는 않는다.
- 인스타그램 릴스 등으로 앱의 핵심 경험을 적극 홍보하면 이 선택지는 훨씬 불안정해진다.

### C. 부분 회피형 구조

이 선택지는 앱이 가사 DB를 직접 보유하거나 전송하지 않도록 구조를 바꾸는 방식이다. 예를 들어 사용자가 YouTube Music 같은 정식 앱에서 가사뷰를 켠 상태에서, 내 앱이 화면 OCR로 현재 보이는 한두 줄만 로컬 분석하는 구조가 있다.

확인해야 하는 것:

- 사용자가 정식 음악 앱에서 본 가사를 기기 내 OCR로 분석하는 행위가 현재 서버 저장/전송 방식보다 법적으로 얼마나 나은지
- OCR 결과를 서버로 보내지 않고 즉시 폐기하면 복제/전송 리스크가 얼마나 줄어드는지
- 앱 위에 그리기, 접근성 권한, 화면 캡처 권한이 Android/Google Play 정책상 허용되는지
- YouTube Music, Apple Music, Spotify 등 정식 앱 화면 위에 오버레이를 띄우는 것이 각 서비스 약관에 저촉되지 않는지
- OCR 인식 정확도와 UX가 실제 학습 경험을 감당할 수 있는지
- 로컬 LLM 또는 온디바이스 분석으로 번역/문법 해설 품질을 낼 수 있는지

이 선택지를 고를 수 있는 조건:

- 서버가 가사 원문/번역을 저장하지 않는다.
- 전체 가사 복원 기능이 없다.
- 분석 결과도 단어 뜻, 문법 태그 등 최소 정보로 제한한다.
- 플랫폼 권한 정책을 통과할 수 있다.
- 제품 경험 저하를 감수할 수 있다.

주의할 점:

- 이 방식도 완전한 면책은 아니다.
- 다만 현재의 `서버 가사 DB + 전곡 번역 + 앱 전송` 구조보다는 공격면을 줄일 가능성이 있다.

### D. 가사 없는 피벗

이 선택지는 가사 저작권 문제를 피하기 위해 가사를 앱의 핵심에서 제거하는 방식이다.

확인해야 하는 것:

- 사용자가 좋아하는 노래 없이도 유지되는 학습 가치가 있는지
- 가사 대신 사용할 수 있는 저작권 안전 콘텐츠가 있는지
- 예문, 문장, 발음, 플래시카드가 모두 가사 없이도 동작 가능한지
- 기존 사용자가 이 변경을 받아들일지

이 선택지를 고를 수 있는 조건:

- 가사 기반 학습이라는 핵심 가치를 포기할 수 있다.
- 다른 콘텐츠 기반으로 제품의 차별성을 만들 수 있다.
- 법적 안정성을 제품 정체성보다 우선한다.

현재 평가:

- 법적 안정성은 높지만, 현재 앱의 핵심 가치와 충돌한다.
- 지금 당장 적극 선택할 안이라기보다, 라이선스/회피 구조가 모두 실패했을 때의 최후 옵션에 가깝다.

## 6. 확인할 내용과 선택지의 관계

| 알아봐야 하는 내용 | 관련 선택지 | 왜 중요한가 |
| --- | --- | --- |
| KOMCA/JASRAC/NexTone의 가사 이용허락 가능 여부 | A | 정식 라이선스 경로의 핵심이다. |
| 번역권/개작권의 처리 방법 | A, B | 한국어 번역과 문장 해설이 앱 핵심 기능이기 때문이다. |
| Musixmatch/LyricFind 계약 범위 | A | provider가 실제로 리스크를 넘겨받아 주는지 확인해야 한다. |
| provider의 synced lyrics/caching/AI 허용 여부 | A | 현재 구현이 전곡 저장·분석·전송 구조이기 때문이다. |
| provider coverage | A | 사용자가 원하는 곡을 못 찾으면 제품 가치가 떨어진다. |
| YouTube 임베드 상업 이용 가능 여부 | A, B | MV 재생이 핵심 경험이고, 광고/구독과 충돌할 수 있다. |
| YouTube 영상 옆 가사/번역 표시 가능 여부 | A, B | YouTube 콘텐츠와 별도 가사 제공을 결합하는 구조이기 때문이다. |
| Gemini 무료/유료 API의 데이터 사용 정책 | A, B | 저작권 있는 가사를 prompt에 넣는 문제가 있기 때문이다. |
| 로컬 OCR/온디바이스 분석의 법적 효과 | C | 서버 저장/전송을 없애는 회피 구조의 실효성을 판단해야 한다. |
| Android/Google Play 오버레이·OCR 권한 정책 | C | 회피형 구조가 앱스토어에서 막힐 수 있다. |
| 권리자 신고/삭제 프로세스의 완성도 | B | 무허가 소규모 운영 시 최소한의 방어 장치다. |
| 손해배상 규모와 수익화의 관계 | B | 무료 운영과 유료화 사이의 리스크 차이를 판단해야 한다. |
| 법인/사업자 등록 필요성 | A | 계약, 세금, 영업활동, 책임 범위와 연결된다. |
| 가사 없는 대체 가치 | D | 피벗 가능성을 판단하는 유일한 기준이다. |

## 7. 우선순위

### 1순위: 라이선스 경로 확인

가장 먼저 확인할 질문:

> 한국에서 운영하는 일본어 학습 모바일 앱이 일본곡 가사를 time-synced lyrics로 표시하고, 한국어 번역/문법 해설/단어장 예문을 제공하려면 어떤 권리 허락이 필요한가?

문의 대상:

- KOMCA
- JASRAC
- NexTone
- Musixmatch
- LyricFind

### 2순위: YouTube 약관 확인

확인할 질문:

> YouTube IFrame Player로 MV를 재생하는 학습 앱에서, 영상 주변에 별도 가사/번역/단어 학습 UI를 제공하고 앱을 유료화하거나 광고를 붙여도 되는가?

### 3순위: AI 처리 방식 확인

확인할 질문:

> 저작권 있는 가사를 Gemini 같은 외부 AI API에 입력해 번역·분석하는 것이 약관상/저작권상 허용되는가? 유료 API 사용 시 prompt 학습 문제는 해소되는가?

### 4순위: 제품 정책 결정

확인 결과에 따라 정해야 할 것:

- 정식 provider 계약 전까지 본격 홍보를 중단할지
- 무료/무광고/저홍보 상태로만 제한 운영할지
- 번역 표시를 끄거나 문법 해설 중심으로 줄일지
- 전체 가사 저장/전송 구조를 유지할지
- provider coverage 밖 곡을 비공개 처리할지

## 8. 현재 권장 판단

현재 단계에서 가장 합리적인 흐름은 다음이다.

1. 새 기능 개발을 잠시 멈춘다.
2. 라이선스 provider와 관리단체에 문의한다.
3. YouTube 상업 이용 가능성을 확인한다.
4. Gemini 무료 사용을 중단하고 유료 API 또는 로컬 분석 가능성을 검토한다.
5. 비용 구조를 계산한 뒤, A~D 중 하나를 의식적으로 선택한다.

지금 바로 해야 할 개발이 있다면, 새 기능이 아니라 아래 같은 리스크 제어 기능이 우선이다.

- 곡 단위 비공개/삭제
- 가사 provider별 차단
- 번역 표시 on/off
- bulk word add 제한
- 권리자 신고 처리 로그
- 사용량 제한
- provider 계약 범위 밖 곡 숨김

## 9. Subagent 조사 결과

> 조사일: 2026-06-29  
> 조사 방식: 별도 researcher subagent 4개가 공식 문서 중심으로 조사했다.  
> 주의: 아래 내용은 법률 의견이 아니라, 공개 문서 기반의 의사결정 참고 자료다.

### 9.1 KOMCA/JASRAC/NexTone

확인된 사실:

- KOMCA는 일본곡에 대해 한국 내 로컬 라이선스 창구가 될 수 있다.
- JASRAC는 일본 음악의 해외 이용 허락은 해당 국가의 local CMO에서 받는다고 안내한다.
- JASRAC 상호관리 단체 목록에는 한국의 CMO로 KOMCA가 표시된다.
- 한국저작권위원회 FAQ도 KOMCA가 일본 등 외국 단체와 상호관리조약을 맺고 외국 곡 이용허락을 해준다고 설명한다.
- KOMCA 사용료 징수규정에는 온라인/전송 계열 요율이 공개되어 있다.
  - 주문형 다운로드: 77원/회 또는 매출액 11%
  - 주문형 스트리밍: 광고수익 기반 0.74원/회 또는 매출액 10.5%
  - 영상물 전송서비스: 4.0% 또는 가입자당 280원
  - 부수적 영상물: 2.0% 또는 가입자당 140원
  - 온라인 게임 및 애니메이션: 5% 또는 곡당 연 100,000원 또는 1.4원/이용회수
- KOMCA 규정에는 다운로드에 소비자가 관리하는 가상공간 저장이 포함되고, 이용 로그를 1년 이상 보관해야 한다는 내용이 있다.
- JASRAC tariff도 공중송신과 그에 수반되는 복제, interactive transmission 요율, 로그 보관 구조를 둔다.
- JASRAC tariff에는 가사/음악의 전자적 게시·전시 항목도 있다.
- NexTone가 권리자로부터 위탁받아 이용허락/징수/분배를 하는 회사라는 점은 확인되지만, 한국에서 KOMCA로 일괄 처리 가능한지에 대한 공식 근거는 확인하지 못했다.

공식 링크:

- JASRAC International: https://www.jasrac.or.jp/en/about/international/
- JASRAC FAQ: https://secure.okbiz.jp/faq-jasrac/faq/show/389?site_domain=en
- JASRAC CMO list: https://www.jasrac.or.jp/en/about/international/pdf/cmo.pdf
- KOMCA 사용료 징수규정: https://www.komca.or.kr/doc_rule/%EC%9D%8C%EC%95%85%EC%A0%80%EC%9E%91%EB%AC%BC_%EC%82%AC%EC%9A%A9%EB%A3%8C_%EC%A7%95%EC%88%98%EA%B7%9C%EC%A0%95.pdf
- JASRAC Tariffs: https://www.jasrac.or.jp/en/about/facts-figures/pdf/tariffs.pdf
- NexTone Business Information: https://www.nex-tone.co.jp/en/business_information/

불확실한 점:

- 원문 가사 표시와 time-synced lyrics가 KOMCA/JASRAC의 어느 카테고리에 정확히 해당하는지는 문서만으로 확정되지 않았다.
- 서버 저장/캐싱이 단순 기술적 임시복제인지, 사용자가 이용 가능한 저장/다운로드인지에 따라 필요 허락이 달라질 수 있다.
- 한국어 번역/개작은 CMO 경로만으로 처리 가능하다고 확인되지 않았다.
- JASRAC는 번역/개사/편곡 같은 adaptation permission을 자신들이 줄 수 없다는 취지의 설명을 둔다.
- 가사 텍스트 전용 표시, time-sync metadata, 플래시카드 예문 저장의 정확한 요율은 문의가 필요하다.

문의해야 할 질문:

- 이 서비스가 `가사 텍스트만`, `오디오+가사`, `lyric video`, `영상물 전송` 중 어디에 해당하는가?
- 한국 내 서비스에서 JASRAC/NexTone 개별 허락이 필요한가, 아니면 KOMCA 원스톱으로 가능한가?
- 한국어 번역을 직역/의역/문장해설로 제공하는 것이 허락 범위에 포함되는가?
- 플래시카드 예문으로 lyric line 1문장을 개인 학습용으로 저장해도 되는가?
- 서버 캐시는 일시적 기술 캐시로 볼 수 있는가, 아니면 별도 저장/전송 허락이 필요한가?

선택지에 미치는 영향:

- A: 원문 가사 표시만이라면 KOMCA/JASRAC 경로 가능성이 있다. 단, 정확한 카테고리 확인이 필요하다.
- B: 원문 + time-synced 표시 + 앱 전송은 전송 허락이 필요하다고 보는 쪽이 안전하다.
- C: 번역/개작 포함 시 CMO만으로 부족할 가능성이 커서 권리자 직접 허락까지 검토해야 한다.
- D: 가사를 제거하면 이 경로의 필요성이 크게 줄어든다.

### 9.2 Musixmatch/LyricFind

확인된 사실:

- Musixmatch 공개 API 자료는 `track.search`, `track.lyrics.get` 등으로 라이선스된 가사를 제공하는 구조를 보인다.
- Musixmatch `Lyrics`/`Subtitle` 객체에는 `restricted`, `lyrics_copyright`, `pixel_tracking_url`, `html_tracking_url`, `script_tracking_url`, `explicit` 같은 제한·저작권·추적 관련 필드가 포함된다.
- LyricFind는 `Lyric Display` 제품에서 static, line-by-line, word-by-word 표시를 명시한다.
- LyricFind는 `Translations`, `Videos`, `LyricIQ` 같은 별도 제품도 공개한다.
- LyricFind publishing 페이지는 licensed lyric display and monetization, 가사 사용별 로열티 지급 구조를 설명한다.
- LyricFind 공개 문서/연락처는 판매 문의 중심이며, 공개 가격표나 앱 통합용 공개 라이선스 계약서는 확인하지 못했다.

공식 링크:

- Musixmatch SDK swagger: https://github.com/musixmatch/musixmatch-sdk/blob/master/swagger/swagger.json
- Musixmatch Pro App Store: https://apps.apple.com/us/app/musixmatch-pro/id1588257741
- Musixmatch Pro Google Play: https://play.google.com/store/apps/details?hl=en_US&id=com.musixmatch.pro
- LyricFind Lyric Display: https://www.lyricfind.com/products/lyric-display
- LyricFind Publishing: https://www.lyricfind.com/publishing
- LyricFind Translations: https://www.lyricfind.com/products/translations
- LyricFind Videos: https://www.lyricfind.com/products/videos
- LyricFind Contact: https://www.lyricfind.com/contact
- LyricFind FAQ: https://www.lyricfind.com/faq

불확실한 점:

- 서버 캐싱, 오프라인 저장, 재전송, 플래시카드 예문 재사용, 번역/해설/분석의 권리 범위는 공개 문서만으로 확인되지 않았다.
- Musixmatch의 `restricted`, `locked`, `can_edit`, `action_requested` 등 제한 필드의 정확한 의미는 추가 확인이 필요하다.
- LyricFind는 공개 가격표가 없어 견적형 영업일 가능성이 높다.
- 두 서비스 모두 `저작권 걱정 없음`이 아니라 `계약 범위 내 리스크 감소`로 보는 것이 안전하다.

문의해야 할 질문:

- 서버에 전체 가사와 타임코드를 저장해도 되는가?
- 보관 기간과 캐시 범위는 어디까지 허용되는가?
- YouTube MV + 가사 동시 표시 소비자 앱이 허용되는가?
- 유료화/광고 모델이 허용되는가?
- 번역, 문장 해설, 단어 분석, 예문 저장이 계약 범위에 포함되는가?
- 플래시카드 예문으로 lyric line 1문장을 별도 저장해도 되는가?
- tracking pixel/script가 필수라면 어떤 화면에서 어떻게 구현해야 하는가?
- AI/ML 활용이 허용되는가?
- 일본/한국 포함 글로벌 배포와 territory 제한은 어떻게 되는가?

선택지에 미치는 영향:

- A: 실시간 표시만이면 가능성이 가장 높다. 다만 attribution, tracking, territory, content restriction 조건을 지켜야 한다.
- B: 서버 저장/재전송이 있으면 caching과 redistribution 권리가 핵심이다.
- C: 번역/해설/단어분석/예문 저장은 단순 display보다 넓은 권리가 필요하다.
- D: 유료화/광고가 있으면 commercial use가 명시적으로 허용되어야 한다.

### 9.3 YouTube

확인된 사실:

- YouTube Terms of Service는 사용자가 콘텐츠를 개인적·비상업적 용도로 보고/듣는 것과 embeddable YouTube player로 보여주는 것을 허용한다.
- 다만 YouTube 콘텐츠만 있거나 YouTube 콘텐츠가 판매의 주된 근거인 페이지/앱에서 광고·스폰서십·프로모션을 판매하는 것은 제한된다.
- YouTube API Services Terms는 모바일 앱을 포함한 API Client에 적용되고, 위반 시 기능 제한, 키 회수, 종료가 가능하다.
- YouTube API Services는 YouTube audiovisual content를 API Services 경로 밖에서 복제·배포·가용화할 권리를 주지 않는다.
- Developer Policies는 광고가 붙은 API Client 자체는 허용 가능한 상업적 사용 사례라고 보지만, 플레이어/YouTube 콘텐츠 위 또는 내부의 광고·스폰서십·프로모션 판매는 사전 서면 승인 없이는 금지한다.
- YouTube API Data가 있는 화면에서 광고를 팔려면 YouTube 외의 독립 가치가 충분해야 한다.
- 플레이어 수정, 광고 차단, 오디오/비디오 분리, 백그라운드 플레이, YouTube attribution 가리기는 금지된다.
- Required Minimum Functionality는 임베디드 플레이어가 최소 200x200px이어야 하고, 플레이어 위에 오버레이/프레임을 얹어 가리면 안 된다고 설명한다.

공식 링크:

- YouTube Terms of Service: https://www.youtube.com/t/terms
- YouTube API Services Terms: https://developers.google.com/youtube/terms/api-services-terms-of-service
- YouTube Developer Policies: https://developers.google.com/youtube/terms/developer-policies
- YouTube Required Minimum Functionality: https://developers.google.com/youtube/terms/required-minimum-functionality
- YouTube Developer Policies Guide: https://developers.google.com/youtube/terms/developer-policies-guide
- YouTube Branding Guidelines: https://developers.google.com/youtube/terms/branding-guidelines

불확실한 점:

- 현재 앱의 가사/번역/단어학습 화면이 `충분한 독립 가치`를 충족하는지는 문서에 숫자 기준이 없다.
- 구독 모델은 무엇을 유료화하는지에 따라 달라진다. YouTube MV 접근권을 파는 구조면 고위험이고, 학습 기능만 유료화하면 상대적으로 낫다.
- 가사/번역을 플레이어 위에 덮는지, 아래/옆에 분리하는지에 따라 위험도가 달라진다.
- 애매하면 YouTube API Compliance Audit 경로가 필요할 수 있다.

문의/확인해야 할 질문:

- 유료화가 MV 재생 자체를 판매하는 것인가, 학습 부가 기능을 판매하는 것인가?
- 가사/번역 UI가 플레이어를 가리지 않고 별도 영역에 배치되는가?
- 광고가 들어갈 화면에 YouTube 콘텐츠만 있는가, 충분한 독립 학습 콘텐츠가 있는가?
- YouTube 기본 플레이어 기능, attribution, related links, ads를 건드리지 않는가?
- 모바일 WebView에서 Referer/app identity를 정확히 전달할 수 있는가?

선택지에 미치는 영향:

- A: IFrame만 사용하고 저장/추출이 없으며 무과금이면 상대적으로 안전하다. 단, 플레이어 크기, attribution, Referer, 오버레이 금지를 지켜야 한다.
- B: IFrame + 자체 가사/번역/단어학습 UI는 가능성이 있지만, YouTube 플레이어를 가리거나 YouTube UX를 대체하면 위험하다.
- C: 광고 추가는 위험도를 올린다. YouTube 콘텐츠 중심 화면이면 특히 주의해야 한다.
- D: 구독 추가는 민감하다. YouTube MV 접근권을 파는 구조로 보이면 고위험이다.

### 9.4 Gemini/AI

확인된 사실:

- Gemini API Additional Terms 기준, unpaid services는 입력과 생성 응답이 Google 제품/서비스 및 ML 기술의 제공·개선·개발에 사용될 수 있고 인간 검토가 있을 수 있다.
- paid services는 prompts/outputs를 제품 개선에 사용하지 않는다고 명시한다.
- Gemini API를 active billing account가 연결된 Cloud Project로 호출하면 paid services로 취급된다.
- Google APIs Terms는 API에 content를 제출하기 전에 필요한 권리, 엔드유저 권리를 포함한 권리를 확보해야 한다고 요구한다.
- Google은 제출 콘텐츠의 IP 소유권을 가져가지는 않지만, 서비스 제공·보안·개선 목적의 라이선스를 받는다.
- Generative AI Prohibited Use Policy는 타인의 저작권/지식재산권을 침해하는 콘텐츠의 생성·배포를 금지한다.
- paid service라도 위반 탐지, 보안, 법적 의무를 위해 prompts/outputs가 일정 기간 저장될 수 있다. 다만 제품 개선 학습에는 쓰지 않는다.

공식 링크:

- Gemini API Terms: https://ai.google.dev/gemini-api/terms
- Google APIs Terms: https://developers.google.com/terms
- Generative AI Prohibited Use Policy: https://policies.google.com/terms/generative-ai/use-policy
- Gemini API usage policies / abuse monitoring: https://ai.google.dev/gemini-api/docs/usage-policies
- Gemini API zero data retention: https://ai.google.dev/gemini-api/docs/zdr
- Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing
- Gemini API billing: https://ai.google.dev/gemini-api/docs/billing

불확실한 점:

- 약관상 저작권 있는 가사를 입력하는 행위 자체가 일괄 금지라고 쓰여 있지는 않다.
- 대신 입력할 권리, 라이선스, 법적 허용 근거가 필요하다.
- 저작권법상 일본어 가사 원문 입력, 저장, 번역/문법 분석 결과 제공, 원문 재노출이 적법한지는 별도 법률 판단이 필요하다.
- OpenAI/Claude 등 다른 provider 비교는 추가 조사 대상이다.

문의/확인해야 할 질문:

- 가사 원문에 대해 라이선스, 허락, 또는 법적 허용 근거가 있는가?
- 사용자가 붙여넣는 가사를 저장하거나 재노출하는가, 아니면 단회 처리만 하는가?
- 호출 방식이 unpaid quota/AI Studio인가, billing-enabled paid API인가?
- 서비스 대상 지역에 EEA/UK/스위스가 포함되는가?

선택지에 미치는 영향:

- A: 무료 quota/AI Studio 중심이면 입력·출력이 개선/학습에 쓰일 수 있어 저작권 민감 콘텐츠에는 불리하다.
- B: 유료 API이면 제품 개선 학습 사용은 피할 수 있지만, 권리 확보 의무와 abuse logging은 남는다.
- C: 저작권 있는 가사 원문을 그대로 넣는 설계는 권리/허락/법적 근거 없이는 약관 리스크가 크다.
- D: 권리 확보된 텍스트만 쓰거나 원문 노출을 최소화하는 설계가 약관상 가장 무난하다.
