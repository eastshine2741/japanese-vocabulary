import React from 'react';
import { Easing } from 'react-native';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import BottomTabBar from '../components/BottomTabBar';
import type { StudyEntryTrigger } from '../services/analytics';

import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import SearchScreen from '../screens/SearchScreen';
import SearchInputScreen from '../screens/SearchInputScreen';
import KaraokeNewSongsScreen from '../screens/KaraokeNewSongsScreen';
import SongSearchResultsScreen from '../screens/SongSearchResultsScreen';
import SongDetailScreen from '../screens/SongDetailScreen';
import ArtistDetailScreen from '../screens/ArtistDetailScreen';
import DeckListScreen from '../screens/DeckListScreen';
import DeckDetailScreen from '../screens/DeckDetailScreen';
import DeckWordListScreen from '../screens/DeckWordListScreen';
import EditWordScreen from '../screens/EditWordScreen';
import SettingsScreen from '../screens/SettingsScreen';
import OssLicenseScreen from '../screens/OssLicenseScreen';
import VocScreen from '../screens/VocScreen';
import SongProgressListScreen from '../screens/SongProgressListScreen';
import SongReviewScreen from '../screens/SongReviewScreen';
import StreakScreen from '../screens/StreakScreen';
import StudyScheduleScreen from '../screens/StudyScheduleScreen';

import HomeTab from '../screens/tabs/HomeTab';
import MyPageTab from '../screens/tabs/MyPageTab';

import { AuthProvider } from '../api/authApi';
import { WordSense } from '../types/word';
import { Token } from '../types/song';
import type { StudySource } from '../components/studyStack';

type SongPlaybackEntryParams = {
  songId?: number;
  origin: string;
  initialSeekMs?: number;
  initialLyricIndex?: number;
};

export type RootStackParamList = {
  Login: undefined;
  Signup: {
    idToken: string;
    email: string | null;
    displayName: string | null;
    provider: AuthProvider;
  };
  ProfileEdit: undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  SongSearch: { query: string };
  /** 탭 밖(SongDetail 등)에서 검색탭 UI로 진입할 때 쓰는 스택 화면. 바텀탭 없이 뜬다. */
  SearchStack: undefined;
  /** 검색어 입력과 최근 검색어. 디스커버리의 검색창을 누르면 열린다. */
  SearchInput: undefined;
  /** 노래방(TJ·금영) 일본 신곡 — 날짜별·월별. 신곡 푸시도 여기로 온다. */
  KaraokeNewSongs: undefined;
  Settings: undefined;
  OssLicense: undefined;
  Voc: undefined;
  SongDetail: SongPlaybackEntryParams;
  /** 곡 상세 히어로의 아티스트명에서 들어오는 상세. 곡이 Apple Music 아티스트에 이어져 있을 때만 열린다. */
  ArtistDetail: { artistId: number };
  /** 곡·덱 진입 복습. 큐 순서는 서버 due 응답을 그대로 따른다. trigger 는 복습을 연 버튼(screen_view 파라미터). */
  SongReview: { source: StudySource; origin?: 'SongDetail'; trigger?: StudyEntryTrigger };
  DeckList: undefined;
  SongProgressList: undefined;
  /** 홈 헤더의 연속 학습 칩에서 들어오는 상세. */
  Streak: undefined;
  /** 홈 헤더의 '오늘 복습할 단어' 블록에서 들어오는 FSRS 스케줄 상세. */
  StudySchedule: undefined;
  DeckDetail: { deckId: number | null };
  DeckWordList: { deckId: number | null };
  EditWord: {
    mode: 'edit' | 'createAndEdit';
    wordId?: number;
    japanese?: string;
    reading?: string;
    senses?: WordSense[];
    token?: Token;
    songId?: number;
    lyricLine?: string;
    lyricLineIndex?: number;
    koreanLyricLine?: string;
  };
};

export type TabParamList = {
  Home: undefined;
  Search: undefined;
  MyPage: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// 내장 `forShift` 는 50px 을 밀어서 겹치는 동안 옆 경계가 드러난다.
// 이동은 방향만 느껴질 만큼 줄이고 겹침은 페이드로 가린다.
const TAB_SHIFT_PX = 12;

const forSubtleShift: NonNullable<BottomTabNavigationOptions['sceneStyleInterpolator']> = ({ current }) => {
  return {
    sceneStyle: {
      opacity: current.progress.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [0, 1, 0],
      }),
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-TAB_SHIFT_PX, 0, TAB_SHIFT_PX],
          }),
        },
      ],
    },
  };
};

const TAB_SCREEN_OPTIONS: BottomTabNavigationOptions = {
  headerShown: false,
  transitionSpec: {
    animation: 'timing',
    config: { duration: 200, easing: Easing.out(Easing.cubic) },
  },
  sceneStyleInterpolator: forSubtleShift,
};

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={TAB_SCREEN_OPTIONS}
    >
      <Tab.Screen name="Home" component={HomeTab} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="MyPage" component={MyPageTab} />
    </Tab.Navigator>
  );
}

interface Props {
  initialRoute: keyof RootStackParamList;
}

export default function AppNavigator({ initialRoute }: Props) {
  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="SongSearch" component={SongSearchResultsScreen} />
      <Stack.Screen name="SearchStack" component={SearchScreen} />
      <Stack.Screen name="SearchInput" component={SearchInputScreen} />
      <Stack.Screen name="KaraokeNewSongs" component={KaraokeNewSongsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="OssLicense" component={OssLicenseScreen} />
      <Stack.Screen name="Voc" component={VocScreen} />
      <Stack.Screen name="SongDetail" component={SongDetailScreen} />
      <Stack.Screen name="ArtistDetail" component={ArtistDetailScreen} />
      <Stack.Screen name="SongReview" component={SongReviewScreen} />
      <Stack.Screen name="DeckList" component={DeckListScreen} />
      <Stack.Screen name="SongProgressList" component={SongProgressListScreen} />
      <Stack.Screen name="Streak" component={StreakScreen} />
      <Stack.Screen name="StudySchedule" component={StudyScheduleScreen} />
      <Stack.Screen name="DeckDetail" component={DeckDetailScreen} />
      <Stack.Screen name="DeckWordList" component={DeckWordListScreen} />
      <Stack.Screen name="EditWord" component={EditWordScreen} />
    </Stack.Navigator>
  );
}
