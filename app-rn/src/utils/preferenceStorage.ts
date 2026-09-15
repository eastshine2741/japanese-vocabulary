import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// 로컬 전용 UI 취향(도킹 위치 등). 서버 설정(settingsStore)과 달리 기기에만 남는다.
// 앱에 별도 key-value 저장소가 없어 tokenStorage 와 같은 백엔드를 쓴다.
const ANALYSIS_PILL_DOCK_KEY = 'analysis_pill_dock';

export type AnalysisPillDock = 'top' | 'bottom';

const isDock = (value: string | null): value is AnalysisPillDock => value === 'top' || value === 'bottom';

export const preferenceStorage = Platform.OS === 'web'
  ? {
      async getAnalysisPillDock(): Promise<AnalysisPillDock | null> {
        const value = localStorage.getItem(ANALYSIS_PILL_DOCK_KEY);
        return isDock(value) ? value : null;
      },
      async saveAnalysisPillDock(dock: AnalysisPillDock): Promise<void> {
        localStorage.setItem(ANALYSIS_PILL_DOCK_KEY, dock);
      },
    }
  : {
      async getAnalysisPillDock(): Promise<AnalysisPillDock | null> {
        const value = await SecureStore.getItemAsync(ANALYSIS_PILL_DOCK_KEY);
        return isDock(value) ? value : null;
      },
      async saveAnalysisPillDock(dock: AnalysisPillDock): Promise<void> {
        await SecureStore.setItemAsync(ANALYSIS_PILL_DOCK_KEY, dock);
      },
    };
