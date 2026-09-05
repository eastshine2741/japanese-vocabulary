import React from 'react';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import BottomTabBar from '../components/BottomTabBar';

import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import SearchScreen from '../screens/SearchScreen';
import SongSearchResultsScreen from '../screens/SongSearchResultsScreen';
import SongDetailScreen from '../screens/SongDetailScreen';
import ReviewScreen from '../screens/ReviewScreen';
import DeckListScreen from '../screens/DeckListScreen';
import DeckDetailScreen from '../screens/DeckDetailScreen';
import DeckWordListScreen from '../screens/DeckWordListScreen';
import EditWordScreen from '../screens/EditWordScreen';
import SettingsScreen from '../screens/SettingsScreen';
import OssLicenseScreen from '../screens/OssLicenseScreen';
import SongProgressListScreen from '../screens/SongProgressListScreen';
import SongReviewScreen from '../screens/SongReviewScreen';

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
  Settings: undefined;
  OssLicense: undefined;
  SongDetail: SongPlaybackEntryParams;
  Review: { deckId?: number | null; startFlashcardId?: number } | undefined;
  /** 곡 진입 복습. 큐 순서는 서버 due 응답을 그대로 따른다. */
  SongReview: { source: StudySource };
  DeckList: undefined;
  SongProgressList: undefined;
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

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
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
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="OssLicense" component={OssLicenseScreen} />
      <Stack.Screen name="SongDetail" component={SongDetailScreen} />
      <Stack.Screen name="Review" component={ReviewScreen} />
      <Stack.Screen name="SongReview" component={SongReviewScreen} />
      <Stack.Screen name="DeckList" component={DeckListScreen} />
      <Stack.Screen name="SongProgressList" component={SongProgressListScreen} />
      <Stack.Screen name="DeckDetail" component={DeckDetailScreen} />
      <Stack.Screen name="DeckWordList" component={DeckWordListScreen} />
      <Stack.Screen name="EditWord" component={EditWordScreen} />
    </Stack.Navigator>
  );
}
