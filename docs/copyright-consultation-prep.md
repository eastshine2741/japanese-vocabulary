# 저작권 상담 준비 자료

> 작성일: 2026-06-26  
> 목적: 한국저작권위원회/법률상담 전, 현재 앱의 가사·번역·외부 API 이용과 관련해 공부할 공식 자료와 상담 질문을 정리한다.

## 1. 핵심 쟁점

이 앱은 YouTube MV를 재생하면서 일본어 가사 라인을 따라가고, 라인 안의 단어를 눌러 뜻을 저장하고 복습하는 일본어 학습 앱이다.

상담에서 확인해야 할 핵심은 다음이다.

- LRCLIB/VocaDB에서 가져온 일본어 가사를 서버에 저장하고 앱에서 라인 단위로 표시하는 것이 허락 필요한 이용인지
- 한국어 번역을 AI로 생성해 현재 라인의 보조 설명으로 제공하는 것이 2차적저작물작성권 침해 위험이 있는지
- 전체 가사 보기 없이 현재 라인 중심 UX로 제한하면 인용/공정이용 또는 리스크 완화 여지가 있는지
- 단어장 예문으로 가사 한 줄과 번역 한 줄을 저장/표시하는 것이 가능한지
- 광고 없는 무료 앱, 광고 앱, 유료화 앱 사이에 위험도가 어떻게 달라지는지
- 일본곡 가사 원문 이용허락은 KOMCA/JASRAC 경로로 가능한지, 한국어 번역권은 별도 허락이 필요한지

## 2. 먼저 읽을 법률/공식 해설

### 저작권법 원문

- 국가법령정보센터 — 저작권법  
  https://www.law.go.kr/lsEfInfoP.do?lsiSeq=148848

읽을 조문:

- 제16조: 복제권
- 제18조: 공중송신권
- 제22조: 2차적저작물작성권
- 제28조: 공표된 저작물의 인용
- 제35조의5: 저작물의 공정한 이용

### 저작재산권 일반 구조

- 문화체육관광부 — 저작권 일반상식: 저작자의 권리  
  https://www.mcst.go.kr/kor/s_policy/copyright/knowledge/know06.jsp

확인할 점:

- 저작재산권은 배타적 권리라는 설명
- 복제권, 공연권, 공중송신권, 배포권, 2차적저작물작성권 등이 포함된다는 설명
- 허락 없는 이용은 원칙적으로 제한되고, 인용 등 제한 규정은 예외라는 구조

### 번역과 2차적저작물

- 한국저작권위원회 FAQ — 해외뉴스 번역과 저작권 침해  
  https://www.copyright.or.kr/customer-center/faq/list.do?counselfaqno=47585

핵심 포인트:

- 외국 저작물을 번역한 것은 2차적저작물로 보호될 수 있음
- 비영리 목적이라도 원저작권자의 허락이 필요할 수 있음
- 번역물을 인터넷 등에 올리는 경우 복제권·공중송신권도 문제될 수 있음

- 한국저작권위원회 해외저작권상담 FAQ  
  https://www.copyright.or.kr/customer-center/faq/list.do?categorycode1=02&pageIndex=2

핵심 포인트:

- 동영상 등을 번역한 자막은 2차적저작물에 해당할 수 있음
- 원저작권자 허락 없이 번역물을 사용하면 복제권 및 2차적저작물작성권 등 침해 책임이 따를 수 있다는 설명

## 3. 음악/가사 권리 자료

### 한국 음악 이용계약 구조

- 저작권 비즈니스 지원센터 — 음악 이용계약 약관  
  https://www.findcopyright.or.kr/user/useCntrct/music/cntrctStplat/info.do

확인할 점:

- 협회가 사용허락한 범위 내에서만 음악저작물을 사용해야 한다는 구조
- 저작자명 표시, 저작인격권 침해 금지 등 약관상 의무

### JASRAC 자료

- JASRAC — What is music copyright?  
  https://www.jasrac.or.jp/en/about/copyright/

확인할 점:

- 저작물 이용에는 원칙적으로 사전 허락이 필요하다는 설명

- JASRAC — International  
  https://www.jasrac.or.jp/en/about/international/

확인할 점:

- JASRAC이 해외 저작권 관리단체와 상호관리 네트워크를 가진다는 설명

- JASRAC FAQ — How do I obtain permission to use Japanese music in a foreign country?  
  https://secure.okbiz.jp/faq-jasrac/faq/show/389?site_domain=en

확인할 점:

- JASRAC 레퍼토리는 해당 국가의 local CMO를 통해 허락받을 수 있다는 답변
- 한국에서는 KOMCA 등 국내 관리단체 경로가 가능한지 상담에서 확인 필요

### 일본 저작권 일반 Q&A

- CRIC — Copyright in Japan Q&A  
  https://www.cric.or.jp/english/qa/begin.html

확인할 점:

- 번역물 같은 2차적저작물을 이용하려면 원저작자와 번역자 양쪽 권리가 문제될 수 있다는 설명

## 4. 현재 앱에서 사용하는 외부 API/약관

### LRCLIB

- LRCLIB API Documentation  
  https://lrclib.net/docs

현재 앱 관련:

- `backend/integrations/lyric-search`에서 LRCLIB API로 plain/synced lyrics를 조회한다.
- API는 가사 record를 반환하지만, 상업 앱에서 가사 저작권을 클리어해 준다는 근거는 확인되지 않았다.

상담 질문:

- LRCLIB에서 가져온 가사를 앱 서버에 저장하고 라인 단위로 표시해도 되는가?
- 출처 표기만으로 충분한가?
- synced lyrics와 plain lyrics의 위험도 차이가 있는가?

### VocaDB

- VocaDB Public API  
  https://wiki.vocadb.net/docs/public-api

- VocaDB License  
  https://wiki.vocadb.net/docs/license

중요 포인트:

- VocaDB는 public REST API를 제공한다.
- 하지만 VocaDB License 문서에서 `Lyrics`는 라이선스 적용 대상에서 제외되는 콘텐츠로 명시되어 있다.
- 따라서 VocaDB API로 가사를 가져올 수 있다는 점과, 그 가사를 앱에서 재배포할 권리가 있다는 점은 별개로 봐야 한다.

상담 질문:

- VocaDB 라이선스가 lyrics를 제외한다면, 가사 이용허락은 별도로 받아야 하는가?
- VocaDB의 곡 메타데이터와 가사 데이터의 법적 취급을 분리해야 하는가?

### Apple iTunes Search API

- Apple Services Performance Partners — iTunes Search API  
  https://performance-partners.apple.com/search-api

중요 포인트:

- API의 promotional content에는 song previews, music videos, album art 등이 포함된다.
- 해당 promotional content는 store content 홍보 목적에만 사용할 수 있고, entertainment purpose로 사용할 수 없다는 취지의 문구가 있다.

현재 앱 관련:

- 곡 검색 메타데이터와 앨범아트에 사용한다.
- 앨범아트를 학습 앱 UI의 deck cover 등으로 쓰는 것이 Apple 약관상 어느 범위까지 허용되는지 확인 필요.

상담 질문:

- iTunes 앨범아트를 학습 앱의 곡/덱 표지로 표시해도 되는가?
- Apple Music/iTunes로 이동하는 badge/link가 필요한가?
- 캐싱해도 되는 범위와 기간이 있는가?

### Apple Music RSS

- Apple Marketing Tools RSS Generator  
  https://rss.marketingtools.apple.com/

현재 앱 관련:

- 추천곡/차트 후보 수집에 Apple Music RSS를 사용한다.

상담 질문:

- Apple Music RSS의 곡명/아티스트/앨범아트/링크를 추천곡 후보로 저장·표시해도 되는가?
- attribution 또는 Apple Music 링크 표시가 필요한가?

### Apple Media Services Terms

- Apple Media Services Terms  
  https://www.apple.com/legal/internet-services/itunes/

확인할 점:

- Apple 서비스와 콘텐츠 이용 일반 약관
- iTunes Search API/RSS에서 받은 콘텐츠의 이용 범위와 함께 검토 필요

### YouTube IFrame Player / YouTube Data API

- YouTube IFrame API Reference  
  https://developers.google.com/youtube/iframe_api_reference

중요 포인트:

- embedded player viewport는 최소 200px by 200px이어야 한다.
- controls가 표시되는 경우 controls를 제대로 표시할 수 있어야 한다.

- YouTube API Services — Required Minimum Functionality  
  https://developers.google.com/youtube/terms/required-minimum-functionality

중요 포인트:

- YouTube API client가 지켜야 하는 최소 기능 요구사항이다.
- YouTube 사용자, 콘텐츠 소유자, 광고주의 이익 보호를 목적으로 한다.

- YouTube API Services — Developer Policies  
  https://developers.google.com/youtube/terms/developer-policies

중요 포인트:

- YouTube API/임베드 플레이어 사용 정책
- MV 검색, 임베드, player UX 점검에 필요

- Google APIs Terms of Service  
  https://developers.google.com/terms

중요 포인트:

- API를 통해 접근 가능한 콘텐츠가 지식재산권 대상이면, 권리자 허락이나 법적 허용이 없이는 사용할 수 없다는 취지의 문구가 있다.

현재 앱 관련:

- YouTube Data API로 MV 후보를 찾고, 앱에서는 IFrame Player로 MV를 재생한다.
- 앱이 YouTube 영상을 직접 저장하거나 추출하지는 않고 embed player를 사용한다.

상담 질문:

- YouTube MV 임베드 자체는 YouTube 약관 준수 영역으로 보면 되는가?
- MV 위/주변에 가사와 번역을 표시하는 UX가 YouTube player overlay 금지나 권리자 이익 침해로 문제될 수 있는가?
- 앱 광고를 붙일 경우 YouTube 영상 광고와 자체 광고가 충돌하지 않는가?

### Gemini API

- Gemini API Additional Terms of Service  
  https://ai.google.dev/gemini-api/terms

현재 앱 관련:

- 일본어 가사를 한국어로 번역하고, 단어 segmentation/sense selection/meaning translation에 사용한다.

상담 질문:

- 저작권 있는 가사를 Gemini API에 입력해 번역/분석하는 행위 자체가 복제 또는 이용에 해당하는가?
- 생성된 한국어 번역을 앱 사용자에게 제공하는 것이 2차적저작물작성권/공중송신권 문제를 일으키는가?
- 내부 분석용으로만 쓰는 경우와 사용자에게 표시하는 경우의 차이는 무엇인가?

### Jisho.org

- Jisho.org  
  https://jisho.org

현재 앱 관련:

- `jisho.org/api/v1/search/words`를 사용해 단어 뜻 후보를 조회한다.
- 명확한 공식 API 약관/상업 이용 문서는 찾기 어렵다.

상담 질문:

- 사전 API/사전 데이터 사용에도 별도 라이선스 확인이 필요한가?
- Jisho 응답의 영어 gloss를 한국어 뜻으로 번역해 저장·제공하는 것이 문제가 될 수 있는가?

## 5. 상담 때 가져갈 현재 앱 설명

짧게 설명할 버전:

> 서울대학교 재학생 개인이 만든 일본어 학습 앱입니다. 사용자가 곡을 검색하면 YouTube MV를 재생하고, 현재 재생 위치에 맞춰 일본어 가사 라인과 한국어 번역을 보여줍니다. 사용자는 라인 안의 단어를 눌러 뜻을 저장하고, 나중에 플래시카드로 복습합니다. 현재 사업자등록은 없고 실사용자는 거의 없으며, 본격 홍보 전에 저작권 리스크와 필요한 권리 처리 범위를 확인하고 싶습니다.

기술 구조:

- 곡 검색: iTunes Search API
- 추천곡 후보: Apple Music RSS
- 가사 소스: LRCLIB, VocaDB
- MV 검색: YouTube Data API
- MV 재생: YouTube IFrame Player
- 번역/단어 분석: Gemini API, Jisho.org
- 앱 고지: 가사 출처, 권리자 신고 메일, 곡 단위 비공개 처리 예정

## 6. 상담 질문 체크리스트

### 가사 원문

- 일본어 가사를 서버에 저장하는 것 자체가 복제권 침해 위험이 있는가?
- 앱 화면에서 전체 가사 보기는 없고 현재 라인 중심으로만 보여줘도 공중송신권 문제가 남는가?
- 한 화면에 표시되는 라인 수를 1~3줄로 제한하면 인용/공정이용 판단에 도움이 되는가?
- synced lyrics와 plain full lyrics는 법적으로 다르게 볼 여지가 있는가?

### 한국어 번역

- AI가 생성한 한국어 가사 번역은 2차적저작물에 해당하는가?
- 번역을 전곡으로 제공하지 않고 현재 학습 라인의 보조 설명으로만 제공하면 위험이 줄어드는가?
- 한국어 번역권은 KOMCA 같은 관리단체 계약으로 해결되는가, 아니면 원저작권자/음악출판사 허락이 별도로 필요한가?

### 단어장/예문

- 사용자가 저장한 단어의 예문으로 가사 한 줄을 저장·표시해도 되는가?
- 예문에 한국어 번역 한 줄도 같이 표시해도 되는가?
- 한 곡에서 저장 예문이 누적되어 곡의 상당 부분을 재구성할 수 있으면 문제가 되는가?

### 외부 API와 출처 표기

- LRCLIB/VocaDB 출처 표기는 법적 허락을 대체하지 않는다고 봐야 하는가?
- VocaDB License에서 lyrics가 제외되는 점은 어떻게 해석해야 하는가?
- Apple iTunes 앨범아트를 곡/덱 표지로 쓰는 것이 Apple 약관상 허용되는가?
- YouTube MV embed와 앱 자체 가사/번역 표시를 결합하는 것이 YouTube 약관 또는 저작권상 문제가 되는가?

### 수익화/홍보

- 현재 무료·무광고·실유저 거의 없음 상태와, 인스타그램 릴스 홍보 후 상태의 법적 위험 차이는 무엇인가?
- 광고를 붙이면 손해배상/침해 판단에서 불리해지는가?
- 본격 홍보 전 반드시 수정해야 할 UX는 무엇인가?
- 권리자 신고 채널과 즉시 삭제 프로세스가 리스크 완화에 어느 정도 도움이 되는가?

## 7. 우선 읽기 순서

시간이 부족하면 아래 순서만 읽는다.

1. 저작권법 제16조, 제18조, 제22조, 제28조, 제35조의5  
   https://www.law.go.kr/lsEfInfoP.do?lsiSeq=148848
2. 한국저작권위원회 FAQ — 번역과 2차적저작물  
   https://www.copyright.or.kr/customer-center/faq/list.do?counselfaqno=47585
3. VocaDB License — lyrics 제외 문구  
   https://wiki.vocadb.net/docs/license
4. LRCLIB API Documentation  
   https://lrclib.net/docs
5. YouTube Required Minimum Functionality  
   https://developers.google.com/youtube/terms/required-minimum-functionality
6. Apple iTunes Search API  
   https://performance-partners.apple.com/search-api
7. Gemini API Additional Terms  
   https://ai.google.dev/gemini-api/terms

## 8. 관련 내부 문서

- `docs/music-licensing.md` — 현재 앱의 가사 라이선스 리스크와 기존 의사결정 정리
- `docs/architecture/song-analysis.md` — 가사 수집, 번역, 단어 의미 분석 파이프라인
- `docs/music-search-api.md` — 음악 검색 API와 Apple/iTunes 관련 검토



 > 정식 음악 앱에서 사용자가 직접 가사뷰를 켠 상태에서, 제 앱이 화면 OCR로 현재 보이는 한두 줄만 로컬 분석하고 즉
  > 시 폐기하며 단어 뜻만 오버레이하는 경우, 기존의 가사 DB 저장/전송 방식보다 저작권 리스크가 낮아지는지 궁금합니
  > 다. 서버 전송, 저장, 전체 가사 복원은 하지 않는 조건입니다.



# 상담 준비

현 상황
- 일본어 가사로 일본어를 공부하는 단어장 앱을 1인 개발
- 사용자 10명 이하이고, 그나마도 전부 지인인 상황
- 본격적인 홍보를 하기 전에, 현재 기능이 저작권법에 걸리지 않는지, 걸린다면 어떻게 수정해야할지 궁금하다.

(앱 시연)

///

앱의 핵심 가치
1. 좋아하는 노래의 가사를 이해하며 일본어 단어가 기억되는 경험
2. 좋아하는 노래의 가사를 이해하며 일본어 문장구조가 이해되는 경험

핵심 가치를 위한 장치
1. 가사 라인
  - (2) 문장 학습을 위해 필수
2. 가사 전문
  - (1), (2) 문장과 단어를 이해하는 멘탈모델을 위해 필요
3. 플래시카드 복습
  - (1) 장기기억을 위해 필요

///

문제 정리
1. '가사' 기반 일본어 학습이 목적이므로 '가사'를 사용할수밖에 없고, 그것도 전문을 사용한다.
  - 재생중인 가사를 보여주는 것도 필수, 노래의 모든 가사를 시간에 따라 보여주는것도 필수이므로, 결국 모든 가사를 유저가 보게 된다.
2. 가사를 안 쓸 순 없으므로, 저작권법에 저촉되지 않는 범위 내에서 사용해야 함
3. 특히 제35조의5(저작물의 공정한 이용)이 희망임. 그에 포함되게끔 UX를 만들어야 함


질문
1. 현재 UX가 공정이용으로 볼 여지가 있는가?
- 걱정되는 UX
  - youtube mv에 싱크하여 가사 라인 원문 보기
  - mv가 재생되거나 유저가 스크롤함에 따라 전체 가사를 볼 수 있음
  - 가사 라인마다 gemini 사용한 한글번역 제공(2차적저작물?)
  - 가사 라인마다 gemini 사용한 단어 추출(2차적저작물?)
  - 추출한 단어로 플래시카드 만드며, 예문이 포함됨
    - 플래시카드 자체는 단어에 불과한데, 이것도 2차적저작물인가?
    - 예문 보관해도 되는가?
- 나름 도움되지않을까하는 UX
  - 앱의 메인 테마가 '교육'
  - 가사 출처 링크 제공
  - 권리자 삭제 요청 메일 링크 제공
2. 현재 구현이 공정이용으로 볼 여지가 있는가?
- DB에 가사 전문과 그것의 번역/분석 결과를 저장
- API 호출 시 전체 가사가 내려감
2. 공정이용으로 보기 어렵다면, 위 중 어떤 기능이 가장 위험한가?
3. 본격 홍보 전 최소 수정안은 무엇인가?
4. 나의 개선안은 타당한가?
5. 추후 개발할 기능에서 주의해야 하는가? e.g. 광고로 수익화, 곡 공유


개선안
1. lyric dial을 스크롤 대신 swipe로 바꾸고, 앞뒤 정확히 1개씩만 보여주기
  - 전체 가사 제공 목적이 아님을 강조 위함(근데 숨긴다고 숨겨지는게 아닌거같음)
2. 현재 재생중인 가사만 번역 제공
  - 2차저작물 문제를 최소화하기 위함(근데 숨긴다고 숨겨지는게 아닌거같음)
3. Musixmatch, Lyricfind 등 업체와 계약
  - 장점) provider의 계약에 명시된 내용을 통해 가사 사용을 어느정도 보장받을 수 있지만,
  - 단점) 서버 저장이나 번역 등 계약에 명시되지 않는 내용은 여전히 모호하여 확인 필요하고, 비용 발생, 보컬로이드 곡 coverage도 낮을 것 같음
  - Musixmatch는 월 $49 요금제를 제공
  - 그러나 Musixmatch는 $49 요금제에 sync lyric이 없음. 상업적 이용/수익화, web page로 대중 공개, AI/ML에 prompt 등을 위해서는 서면 동의도 필요함
  - Lyricfind는 그냥 약관이 안보임 문의해야하는거같음




  > 이 앱은 YouTube MV를 재생하면서 현재 재생 중인 가사 line을 보여주고, 사용자가 단어를 눌러 뜻과 문장
  > 의미를 학습하는 앱입니다. 전체 가사 목록, 복사, 다운로드는 없지만 노래를 끝까지 들으면 모든 가사
  > line이 순차적으로 표시됩니다. 이 구조가 저작권법상 허락이 필요한 가사 전문 이용으로 보는 것이 일반적
  > 인지, 아니면 교육 목적의 공정이용/인용 여지가 있는지 궁금합니다.

  > 사용자가 저장한 단어에 대해 해당 단어가 포함된 lyric line 1문장을 플래시카드 예문으로 저장합니다. 이
  > 정도 문맥 저장도 별도 허락이 필요한지 궁금합니다.

  > Musixmatch/LyricFind 같은 licensed lyrics provider와 계약하면, 저작권 침해 리스크가 실질적으로 해소
  > 되는지, 아니면 여전히 제가 권리자 허락을 따로 받아야 하는 영역이 남는지 궁금합니다.

  > 정식 provider 계약 전 단계의 1인 개발 앱이 본격 홍보를 시작하는 것이 실무적으로 위험한지, 권리자 요
  > 청 시 삭제 대응을 전제로 소규모 운영 가능한 수준인지 궁금합니다.


# 상담 질답
- 저작권뿐만 아니라, 임베딩이 문제될 수 있다.
  - 유튜브 이용약관) 개인적, 비영리적 용도 외이 목적으로 콘텐츠를 보거나 듣기 위해 서비스를 사용하면 안 된다 -> 광고를 붙이면 개인적이나 비영리적이라고 보기 어려워진다
  - 부정경쟁방지법) 저작권법 위반은 아니지만 부정경쟁 행위가 될 수 있다. '타인의 상당한 투자나 노력으로 만들어진 성과 등을 공정한 상거래 관행이나 어쩌고'. 최근에 생긴 조항. 부정경재방지법이 보통 저작권과 함께 세트로 온다.
  - 유튜브 api 결제 이용약관에 영리적으로 이용해도 괜찮다는 내용이있는지 확인필요함. 이용범위 확인이 필요함
- AI 번역은 ai라서 2차적저작물이 아니지만, 다른 문제가 있다.
  - 가사 자체가 복제, 전송권 침해에 해당될수있을거같음.
  - 가사를 AI prompt에 넣으면 학습에 사용될수있음. 무단학습. 
    - 문제되는건 2가지: 모델에 이미 학습된 데이터, 그리고 prompt에 입력함으로써 발생하는 추가 학습
    - 전자는 사실 내가 뭐 할수있는게 없어보이고
    - 후자는 gemini 등 안 쓰고 오픈소스 모델을 내가 구축해서 씀으로써 문제 안되게 할 수 있을듯
  - AI 번역 결과가 원작자의 의도와 달라져서, 동일성유지권침해가 될 수 있음
- 서버에 저장되는 가사 자체의 문제.
  - UX로 한번에 가사 한줄만 번역결과 보여준다던가, 스와이프로 바꾼다던가 해도 달라질건없다. 어차피 '가사를 사용한다' 이므로
- 이 앱이 공정이용 조항에 해당하는가?
  - ai를 이용한 게 공정이용인지는 우리나라에 판례가 없고, 해외에서만 나고 있는데 나라마다 결과가 다른 상태라 모호함.
  - 한국저작권위원회에서 올해 만든 자료에서도 명확하지는 않음
  - 양, 목적, 경쟁 침해 등 여러가지 요소를 공정이용에서 다룬다. 예를들어 이 앱에서라면, 영리적으로 수익 창출할 경우 공정이용으로 간주될 가능성이 낮아진다. 
- 가사 자체 문제의 근본적 해결: 라이센스 계약이 필요함
  - jasrac, komca(한국음악저작권협회)
    - 근데 또 jasrac, komca에서 관리안되는 곡이 있을수있다.
  - musixmatch 등은 권리관계를 확인해봐야할듯함


- 영리적으로 한다면 업종 선택하고 그에 맞게 영업활동한다. 세금처리 등 문제도 있는듯
- AI 대신 사람쓰면 되나?
  - 2차적저작물 문제가 생긴다... 권리자의 허락을 받아야한다.
  - 2차적저작물 권리는 음자협에서 관리안해서 개별 허락이 필요할수도... 음자협에서 관리하는건 배포권 복제권 정도다. 있는것 그대로 사용하는것만 관리한다. 변형은 그 변형의 정도를 저작권자가 허락해야하믈 음자협 관할이 아니다.
- 가사를 아예 버리면
  - 당연히 가사문제느 사라지긴하는데, 예문으로 가사 쓴다면 여전히 문제됨
- 권리자침해신고 등
  - 공정이용 참작은 될수있는데
  - 매출 뱉어라 등은 될 수 있긴함
- 수익의 규모
  - 수익에 따라서 손해배상금은 달라지지만
  - 침해는 맞긴함. 소액이더라도 손해배상금 발생할수있고 법원 판단에 달려있음
- 비슷한 앱
  - 문제 자체는 같음
  - 보통은 권리자가 모르거나 알고도 냅둔다. 근데 규모가 커지면 문제제기 될 수 있따
  - 걔네가 어떻게 계약했는지는 내가 모른다. 고지하는 형태가 아니므로.
- 공유 기능 자체는 문제가 없는데
  - 근본적인 문제, 즉 가사와 ai를 해결해야함




https://www.copyright.or.kr/information-materials/trend/precedents/list.do?brdclasscode=&searchTarget=SUBJECT&searchText=%EA%B0%80%EC%82%AC