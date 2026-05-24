// EXPO_PUBLIC_BUILD_ENV is inlined as a string literal at build time by babel-preset-expo,
// so the comparison below is constant-folded and dead branches are stripped from the prod bundle.
// Safe default: undefined value is treated as dev (so missing env in local dev shows dev features).
export const isDevBuild = process.env.EXPO_PUBLIC_BUILD_ENV !== 'prod';
