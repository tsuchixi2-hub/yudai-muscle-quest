# YUDAI Muscle Quest

優大の筋トレ習慣化アプリのHTMLモックです。

## Pages

- `index.html`: 本番用。サンプルデータなしで、本人が入力した記録だけを表示
- `sample.html`: サンプルデータ入りの確認ページ
- `levels.html`: ポイント・レベル表
- `photos.html`: 週ごとの筋肉写真記録、写真選択、スマホ撮影記録
- `theory.html`: 超回復と筋肥大理論

## Cloudflare Pages

Static HTML + Pages Functions.

- Build command: none
- Build output directory: `/`
- Production branch: `main`

## Data storage

- Workout logs: Cloudflare D1 (`workout_logs`)
- Photo records: Cloudflare D1 (`photo_records`)
- API routes:
  - `/api/workouts`
  - `/api/photos`

R2 is not enabled on the Cloudflare account yet, so compressed photo data is currently stored in D1 as a data URL. When R2 is enabled, move photo binaries to R2 and keep only metadata and object keys in D1.
