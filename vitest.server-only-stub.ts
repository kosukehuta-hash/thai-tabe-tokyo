// "server-only" はNext.jsのビルド機構（webpack/Turbopack）が特別に解決する
// マーカーパッケージで、実体のnpmパッケージはnode_modulesに存在しない。
// Vitest（Vite）経由ではこの特別解決が行われないため、
// vitest.config.tsのresolve.aliasでこのファイルに差し替える。
// 何もしない（importするだけでよい）ため中身は空でよい。
export {};
