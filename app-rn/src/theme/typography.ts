import type { StyleProp, TextStyle } from 'react-native';
import { Text, TextInput } from 'react-native';

type AppFontWeight = '400' | '500' | '600' | '700' | '800';
type AppFontRole = 'body' | 'heading';
type ComponentWithDefaultProps = {
  defaultProps?: {
    style?: StyleProp<TextStyle>;
    [key: string]: unknown;
  };
};

const bodyFonts: Record<AppFontWeight, string> = {
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
};

const headingFonts: Record<AppFontWeight, string> = {
  '400': 'FunnelSans_400Regular',
  '500': 'FunnelSans_500Medium',
  '600': 'FunnelSans_600SemiBold',
  '700': 'FunnelSans_700Bold',
  '800': 'FunnelSans_800ExtraBold',
};

export const FontFamily = {
  body: bodyFonts,
  heading: headingFonts,
} as const;

export function fontStyle(role: AppFontRole, weight: AppFontWeight = '400'): Pick<TextStyle, 'fontFamily' | 'fontWeight'> {
  return {
    fontFamily: role === 'heading' ? headingFonts[weight] : bodyFonts[weight],
    fontWeight: weight,
  };
}

export const Typography = {
  body: fontStyle('body'),
  bodyMedium: fontStyle('body', '500'),
  bodySemiBold: fontStyle('body', '600'),
  bodyBold: fontStyle('body', '700'),
  bodyExtraBold: fontStyle('body', '800'),
  heading: fontStyle('heading'),
  headingMedium: fontStyle('heading', '500'),
  headingSemiBold: fontStyle('heading', '600'),
  headingBold: fontStyle('heading', '700'),
  headingExtraBold: fontStyle('heading', '800'),
} as const;

let globalTypographyApplied = false;

export function applyGlobalTypography() {
  if (globalTypographyApplied) return;
  globalTypographyApplied = true;

  const textComponent = Text as typeof Text & ComponentWithDefaultProps;
  const textInputComponent = TextInput as typeof TextInput & ComponentWithDefaultProps;
  const textDefaultProps = textComponent.defaultProps ?? {};
  textComponent.defaultProps = {
    ...textDefaultProps,
    style: [Typography.body, textDefaultProps.style],
  };

  const textInputDefaultProps = textInputComponent.defaultProps ?? {};
  textInputComponent.defaultProps = {
    ...textInputDefaultProps,
    style: [Typography.body, textInputDefaultProps.style],
  };
}
