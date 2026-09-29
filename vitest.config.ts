import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // "server-only" はNext.jsのビルド機構が特別に解決するマーカーパッケージで、
      // 実体のnpmパッケージが存在しないためVitest単体では解決できない。
      // サーバー専用コードをVitestから直接importできるよう、何もしない
      // スタブへ差し替える（アプリの挙動・出力には影響しない）。
      "server-only": path.resolve(__dirname, "./vitest.server-only-stub.ts"),
      // tsconfig.jsonの"@/*"パスエイリアスはTypeScriptの型解決にのみ有効で、
      // Vite/Vitestの実行時解決には反映されないため、同じ対応関係をここにも定義する。
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
