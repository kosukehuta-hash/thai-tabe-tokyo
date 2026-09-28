export function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `環境変数 ${name} が設定されていません。.env.local を確認してください。`,
    );
  }
  return value;
}
