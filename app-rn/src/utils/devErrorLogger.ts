import { NativeModules } from 'react-native';
import { parse as parseStack } from 'stacktrace-parser';

/**
 * 개발 빌드 전용 에러 로거.
 *
 * RN 기본 로그는 `ERROR [TypeError: ...]` 한 줄만 남기고 스택을 버린다. 여기서는
 * 번들 좌표를 Metro 의 /symbolicate 에 태워 원본 파일:줄 로 되돌린 뒤 터미널에 찍는다.
 * 그래서 `npx expo run:android` 로그만 보고도 어디서 터졌는지 알 수 있다.
 */

const MAX_FRAMES = 30;

interface Frame {
  file?: string | null;
  methodName?: string | null;
  lineNumber?: number | null;
  column?: number | null;
}

interface CodeFrame {
  content: string;
  location?: { row: number; column: number } | null;
  fileName: string;
}

interface SymbolicatedStackTrace {
  stack?: Frame[];
  codeFrame?: CodeFrame | null;
}

// RN 내부 getDevServer 와 같은 방식. 번들을 받아온 URL 의 origin 이 곧 Metro 주소다.
function getMetroUrl(): string | null {
  const scriptURL: unknown = NativeModules.SourceCode?.scriptURL;
  const match = typeof scriptURL === 'string' ? scriptURL.match(/^https?:\/\/.*?\//) : null;
  return match ? match[0] : null;
}

// Metro 의 /symbolicate 는 0-based column 을 받는다. stacktrace-parser 는 1-based.
function parseErrorStack(stack?: string): Frame[] {
  if (!stack) return [];
  return parseStack(stack).map((f) => ({
    ...f,
    column: f.column != null ? f.column - 1 : null,
  }));
}

async function symbolicateStackTrace(stack: Frame[]): Promise<SymbolicatedStackTrace> {
  const metroUrl = getMetroUrl();
  if (!metroUrl) throw new Error('Bundle was not loaded from Metro.');
  const response = await fetch(`${metroUrl}symbolicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stack }),
  });
  return (await response.json()) as SymbolicatedStackTrace;
}

function shortenPath(file?: string | null): string {
  if (!file) return '<unknown>';
  return file
    .replace(/^https?:\/\/[^/]+\//, '')
    .replace(/^.*\/node_modules\//, 'node_modules/')
    .replace(/^.*\/app-rn\//, '');
}

function formatFrames(frames: readonly Frame[]): string {
  return frames
    .slice(0, MAX_FRAMES)
    .map(
      (f) =>
        `    at ${f.methodName || '<anonymous>'} (${shortenPath(f.file)}:${f.lineNumber ?? '?'}:${
          (f.column ?? 0) + 1
        })`,
    )
    .join('\n');
}

// 같은 에러가 global handler 와 console.error 양쪽으로 들어오는 일이 흔하다. 한 번만 찍는다.
const alreadyReported = new WeakSet<object>();

async function report(label: string, error: unknown): Promise<void> {
  if (typeof error === 'object' && error !== null) {
    if (alreadyReported.has(error)) return;
    alreadyReported.add(error);
  }
  const err = error as { message?: string; stack?: string } | undefined;
  const lines: string[] = [
    '',
    `===== [${label}] ${err?.message ?? String(error)} =====`,
  ];

  try {
    const { stack, codeFrame } = await symbolicateStackTrace(parseErrorStack(err?.stack));
    if (codeFrame) {
      lines.push(
        `${shortenPath(codeFrame.fileName)}:${codeFrame.location?.row ?? '?'}:${
          (codeFrame.location?.column ?? 0) + 1
        }`,
        codeFrame.content,
      );
    }
    lines.push(formatFrames(stack ?? []));
  } catch {
    // Metro 에서 받은 번들이 아니거나 symbolicate 가 실패한 경우. 원본 스택이라도 남긴다.
    lines.push(err?.stack ?? '(no stack)');
  }

  lines.push('='.repeat(60), '');
  console.log(lines.join('\n'));
}

export function installDevErrorLogger(): void {
  if (!__DEV__) return;

  const errorUtils = (globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler?: () => ((e: unknown, isFatal?: boolean) => void) | undefined;
      setGlobalHandler?: (h: (e: unknown, isFatal?: boolean) => void) => void;
    };
  }).ErrorUtils;

  if (errorUtils?.setGlobalHandler) {
    const previous = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error, isFatal) => {
      void report(isFatal ? 'FATAL' : 'UNCAUGHT', error);
      previous?.(error, isFatal);
    });
  }

  // 렌더 중 throw / 라이브러리 내부 에러는 console.error 로 들어오는 경우가 많다.
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const err = args.find((a) => a instanceof Error);
    if (err) void report('CONSOLE.ERROR', err);
    originalConsoleError(...(args as Parameters<typeof console.error>));
  };
}
