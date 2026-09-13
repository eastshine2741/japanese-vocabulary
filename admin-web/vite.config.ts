import path from "node:path"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vitest/config"
import { transformWithOxc, type Plugin } from "vite"

const basePath = process.env.VITE_ADMIN_BASE_PATH?.replace(/\/$/, "")

// PromoReel 이 app-rn/src/utils/readingConverter.ts 를 가져온다. app-rn/tsconfig.json 은 expo 패키지를
// extends 해서 app-rn 에 node_modules 가 없으면(워크트리, Docker) oxc 의 tsconfig 탐색이 깨진다.
// 이 파일만 tsconfig 없이 변환하고 vite:oxc 에서는 뺀다.
const appRnSharedFile = /\/app-rn\/src\/utils\/[^/]+\.ts$/

const appRnSharedTs: Plugin = {
  name: "app-rn-shared-ts",
  enforce: "pre",
  async transform(code, id) {
    if (!appRnSharedFile.test(id)) return
    const result = await transformWithOxc(code, id, { lang: "ts", tsconfig: false })
    // rolldown 이 .ts 모듈을 다시 TS 로 다루며 tsconfig 를 찾지 않도록 JS 로 표시한다.
    return { code: result.code, map: result.map, moduleType: "js" }
  },
}

export default defineConfig({
  base: basePath ? `${basePath}/` : "/",
  plugins: [appRnSharedTs, react(), tailwindcss()],
  oxc: {
    exclude: [/\.js$/, appRnSharedFile],
    // plugin-react 의 refresh 필터가 exclude 보다 먼저 잡히므로 여기서도 뺀다.
    jsxRefreshExclude: [/\/node_modules\//, appRnSharedFile],
  },
  resolve: {
    // reels/src 가 reels/node_modules 의 remotion·react 를 따로 잡으면 Player 와 인스턴스가 갈려 프레임이 안 흐른다.
    // tsconfig.app.json 의 paths 도 같은 이유로 admin-web 쪽을 가리킨다.
    dedupe: ["react", "react-dom", "remotion"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // 릴스 미리보기는 reels/ 의 Remotion 컴포지션을 그대로 가져와 Player 로 튼다.
      "@reels": path.resolve(__dirname, "../reels/src"),
    },
  },
  server: {
    port: 5174,
    fs: {
      // PromoReel 이 ../reels/src 와 ../app-rn/src/utils 를 읽는다.
      allow: [path.resolve(__dirname, "..")],
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
})
