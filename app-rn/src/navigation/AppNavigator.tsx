import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import BottomTabBar from '../components/BottomTabBar';

import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import SearchScreen from '../screens/SearchScreen';
import SongSearchResultsScreen from '../screens/SongSearchResultsScreen';
import PlayerScreen from '../screens/PlayerScreen';
import ReviewScreen from '../screens/ReviewScreen';
import DeckListScreen from '../screens/DeckListScreen';
import DeckDetailScreen from '../screens/DeckDetailScreen';
import DeckWordListScreen from '../screens/DeckWordListScreen';
import EditWordScreen from '../screens/EditWordScreen';
import SettingsScreen from '../screens/SettingsScreen';
import OssLicenseScreen from '../screens/OssLicenseScreen';

import HomeTab from '../screens/tabs/HomeTab';
import MyPageTab from '../screens/tabs/MyPageTab';

import { WordMeaning } from '../types/word';
import { Token } from '../types/song';

export type RootStackParamList = {
  Login: undefined;
  Signup: { idToken: string; email: string | null; googleName: string | null };
  ProfileEdit: undefined;
  Main: undefined;
  SongSearch: { query: string };
  Settings: undefined;
  OssLicense: undefined;
  Player: { origin: string; initialSeekMs?: number; initialLyricIndex?: number };
  Review: { deckId?: number | null; startFlashcardId?: number } | undefined;
  DeckList: undefined;
  DeckDetail: { deckId: number | null };
  DeckWordList: { deckId: number | null };
  EditWord: {
    mode: 'edit' | 'createAndEdit';
    wordId?: number;
    japanese?: string;
    reading?: string;
    meanings?: WordMeaning[];
    token?: Token;
    songId?: number;
    lyricLine?: string;
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
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="OssLicense" component={OssLicenseScreen} />
      <Stack.Screen name="Player" component={PlayerScreen} options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Review" component={ReviewScreen} />
      <Stack.Screen name="DeckList" component={DeckListScreen} />
      <Stack.Screen name="DeckDetail" component={DeckDetailScreen} />
      <Stack.Screen name="DeckWordList" component={DeckWordListScreen} />
      <Stack.Screen name="EditWord" component={EditWordScreen} />
    </Stack.Navigator>
  );
}
