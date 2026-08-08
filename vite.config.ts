/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],

  test: {
    // core는 순수 함수만 다루므로 DOM 없는 node 환경으로 충분하다.
    environment: "node",
  },

  build: {
    copyPublicDir: false,

    lib: {
      // View에 웹사이트의 index.html이 아니라 라이브러리 진입점을 빌드하라고 알려줌.
      entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      // ESM만 배포함.
      formats: ["es"],
      fileName: "index",
    },

    sourcemap: true,

    rolldownOptions: {
      // peer 의존성(React, Recharts)은 최종 번들에 넣지 않음.
      external: ["react", "react-dom", "react/jsx-runtime", "recharts"],
    },
  },
});
