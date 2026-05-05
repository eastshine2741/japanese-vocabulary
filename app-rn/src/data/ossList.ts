export interface OssEntry {
  name: string;
  license: string;
  url: string;
  note?: string;
}

export const EXTERNAL_SERVICES: OssEntry[] = [
  {
    name: 'Kuromoji',
    license: 'Apache-2.0',
    url: 'https://github.com/atilika/kuromoji',
    note: '일본어 형태소 분석 라이브러리. NOTICE: Copyright © 2010-2018 Atilika Inc. and contributors.',
  },
  {
    name: 'IPADic',
    license: '자체 라이선스',
    url: 'https://wiki.debian.org/IpadicLicense',
    note: 'Kuromoji가 사용하는 일본어 사전. 사용·복제·배포 허용 (illegal use 금지).',
  },
  {
    name: 'UniDic',
    license: 'BSD-3-Clause',
    url: 'https://clrd.ninjal.ac.jp/unidic/en/',
    note: 'NINJAL이 배포하는 일본어 형태소 사전. Triple license 중 BSD 선택.',
  },
  {
    name: 'LRCLIB',
    license: '가사 데이터 출처',
    url: 'https://lrclib.net',
    note: '동기 가사(LRC) 데이터 제공 서비스.',
  },
  {
    name: 'VocaDB',
    license: '가사 데이터 출처',
    url: 'https://vocadb.net',
    note: 'VOCALOID/일본어 곡 메타데이터 및 가사 데이터.',
  },
  {
    name: 'Apple iTunes Search API',
    license: 'Apple 약관',
    url: 'https://performance-partners.apple.com/search-api',
    note: '곡명·아티스트·앨범아트 검색.',
  },
  {
    name: 'Google Gemini API',
    license: 'Google ToS',
    url: 'https://ai.google.dev/gemini-api/terms',
    note: '한국어 번역·해설 생성.',
  },
  {
    name: 'YouTube IFrame Player API',
    license: 'YouTube ToS',
    url: 'https://developers.google.com/youtube/iframe_api_reference',
    note: 'MV 영상 재생.',
  },
];

export const FRONTEND_OSS: OssEntry[] = [
  { name: 'react-native', license: 'MIT', url: 'https://github.com/facebook/react-native' },
  { name: 'expo', license: 'MIT', url: 'https://github.com/expo/expo' },
  { name: 'react-native-reanimated', license: 'MIT', url: 'https://github.com/software-mansion/react-native-reanimated' },
  { name: 'react-native-gesture-handler', license: 'MIT', url: 'https://github.com/software-mansion/react-native-gesture-handler' },
  { name: '@gorhom/bottom-sheet', license: 'MIT', url: 'https://github.com/gorhom/react-native-bottom-sheet' },
  { name: 'zustand', license: 'MIT', url: 'https://github.com/pmndrs/zustand' },
  { name: 'axios', license: 'MIT', url: 'https://github.com/axios/axios' },
  { name: 'react-native-youtube-iframe', license: 'MIT', url: 'https://github.com/LonelyCpp/react-native-youtube-iframe' },
  { name: '@react-navigation/native', license: 'MIT', url: 'https://github.com/react-navigation/react-navigation' },
  { name: '@expo/vector-icons', license: 'MIT', url: 'https://github.com/expo/vector-icons' },
  { name: 'react-native-webview', license: 'MIT', url: 'https://github.com/react-native-webview/react-native-webview' },
  { name: 'react-native-safe-area-context', license: 'MIT', url: 'https://github.com/th3rdwave/react-native-safe-area-context' },
  { name: '@react-native-community/slider', license: 'MIT', url: 'https://github.com/callstack/react-native-slider' },
  { name: 'expo-secure-store', license: 'MIT', url: 'https://github.com/expo/expo' },
  { name: 'expo-linear-gradient', license: 'MIT', url: 'https://github.com/expo/expo' },
];
