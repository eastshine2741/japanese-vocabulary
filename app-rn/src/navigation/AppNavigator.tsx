import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/theme';

import LoginScreen from '../screens/LoginScreen';
import SearchScreen from '../screens/SearchScreen';
import PlayerScreen from '../screens/PlayerScreen';
import ReviewScreen from '../screens/ReviewScreen';
import DeckDetailScreen from '../screens/DeckDetailScreen';
import DeckWordListScreen from '../screens/DeckWordListScreen';

import HomeTab from '../screens/tabs/HomeTab';
import WordTab from '../screens/tabs/WordTab';
import MyPageTab from '../screens/tabs/MyPageTab';

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  Search: undefined;
  Player: { origin: string };
  Review: { songId?: number | null };
  DeckDetail: { songId: number | null };
  DeckWordList: { songId: number | null };
};

export type TabParamList = {
  Home: undefined;
  Words: undefined;
  MyPage: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarStyle: { height: 64, paddingBottom: 8, paddingTop: 4 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeTab}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Words"
        component={WordTab}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MyPage"
        component={MyPageTab}
        options={{
          tabBarLabel: 'My Page',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
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
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Player" component={PlayerScreen} />
      <Stack.Screen name="Review" component={ReviewScreen} />
      <Stack.Screen name="DeckDetail" component={DeckDetailScreen} />
      <Stack.Screen name="DeckWordList" component={DeckWordListScreen} />
    </Stack.Navigator>
  );
}
