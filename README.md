# YUDAI Muscle Quest

優大の筋トレ習慣化アプリのHTMLモックです。

## Pages

- `index.html`: 本番用。サンプルデータなしで、本人が入力した記録だけを表示
- `sample.html`: サンプルデータ入りの確認ページ
- `levels.html`: ポイント・レベル表
- `photos.html`: 週ごとの筋肉写真記録、写真選択、スマホ撮影記録
- `ranking.html`: 登録者全体ランキング
- `theory.html`: 超回復と筋肥大理論

## Cloudflare Pages

Static HTML + Pages Functions.

- Build command: none
- Build output directory: `/`
- Production branch: `main`

## Data storage

- Workout logs: Cloudflare D1 (`workout_logs`)
- Users and sessions: Cloudflare D1 (`users`, `sessions`)
- Photo metadata: Cloudflare D1 (`photo_records`)
- Photo objects: Cloudflare R2 (`yudai-muscle-quest-photos`)
- API routes:
  - `/api/auth/demo-login`
  - `/api/auth/me`
  - `/api/auth/logout`
  - `/api/workouts`
  - `/api/photos`
  - `/api/photo`
  - `/api/users`
  - `/api/users/:id/summary`
  - `/api/rankings`

LINE login is planned for the next phase. The current multi-user implementation uses demo login and the same session model that LINE login can reuse later.

R2 must be enabled on the Cloudflare account before production photo uploads can store image objects.
