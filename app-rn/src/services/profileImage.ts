import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { userApi, UserProfile } from '../api/userApi';
import { putToPresignedUrl } from './presignedUpload';

const MAX_SIDE = 512;

/** Resolves null when the user backs out of the picker. */
export async function pickProfileImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0].uri;
}

export async function uploadProfileImage(uri: string): Promise<UserProfile> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: MAX_SIDE, height: MAX_SIDE });
  const image = await context.renderAsync();
  const resized = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });

  const { key, uploadUrl, headers } = await userApi.issueProfileImageUploadUrl('image/jpeg');
  await putToPresignedUrl(resized.uri, uploadUrl, headers);

  return userApi.confirmProfileImage(key);
}
