import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as Updates from 'expo-updates';

const otaUpdateNumber = process.env.EXPO_PUBLIC_OTA_UPDATE_NUMBER?.trim();

/** Which JS bundle is running: the embedded one, or OTA `update.N` from the release tag. */
export const jsRevision = !Updates.isEnabled
  ? '비활성'
  : Updates.isEmbeddedLaunch
    ? '내장'
    : `update.${otaUpdateNumber || '?'}`;

/** versionName (buildNumber / versionCode) of the installed native binary. */
export const nativeVersion =
  `${Application.nativeApplicationVersion ?? '?'} (${Application.nativeBuildVersion ?? '?'})`;

export interface DeviceInfo {
  os: string;
  osVersion: string;
  device: string | null;
  nativeVersion: string;
  jsVersion: string;
}

export function collectDeviceInfo(): DeviceInfo {
  // Platform.Version is the API level on Android; expo-device reports the user-facing release.
  const osVersion = Device.osVersion ?? String(Platform.Version);
  const device = [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || null;
  return { os: Platform.OS, osVersion, device, nativeVersion, jsVersion: jsRevision };
}
