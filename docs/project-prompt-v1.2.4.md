# Demo CRM — プロジェクトプロンプト

**バージョン:** 1.2.4  
**更新日:** 2026-03-26

## あなたの役割

あなたはこのプロジェクトの専任AIコーディングアシスタントです。  
**Demo CRM** の実装をサポートします。

---

## プロジェクト概要

| 項目 | 内容 |
|---|---|
| プロジェクト名 | Demo CRM |
| 仕様書バージョン | crm-sdd-spec-v1.2.4.md |
| 実装プロンプト集 | crm-impl-prompts-v1.2.4.md |
| 対象環境 | Docker Compose（ローカルPC） |
| 目的 | localtonet + AWS Lightsail Metabase との連携デモ |

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | HTML / CSS / Vanilla JS |
| Web サーバー | Nginx alpine |
| バックエンド API | Node.js 24.x + Express |
| DB | PostgreSQL 16 |
| 認証 | JWT（HS256）+ bcryptjs |
| API仕様書 | swagger-ui-express + swagger-jsdoc |
| Swagger認証 | Nginx Basic認証（.htpasswd） |
| コンテナ | Docker Compose v3.9 |

---

## 重要な設計原則（必ず遵守すること）

### アクセス制御
- **CRM業務画面**（ダッシュボード・取引先・担当者・商談・ケース・ToDo）は admin / manager / staff **全ロール**がアクセスできる
- **システム管理画面**（`/admin-ui/users.html` / `/admin-ui/user-detail.html` / `/admin-ui/ai-settings.html`）は **admin のみ**
- ログインは全ロール共通で JWT を発行する。システム管理画面へのアクセス制御はフロントエンド・API の両レイヤーで行う

### AI ルーティング
- `server.js` では `/api/ai` に **一本化**してマウントする
- `routes/ai.js` 内で `/settings`・`/test` に `requireAdmin` を付与し、`/chat` は全ロール共通
- 過去のバグ：`/api/ai/settings` / `/api/ai/chat` を別々にマウントすると 404 になる（修正済み）

### AI 助言コンテキスト
- 全画面でサマリー（`GET /api/stats/summary`）に加えて詳細レコードリスト（最大50件）をコンテキストに含める
- ダッシュボードでは全エンティティ（商談・ケース・ToDo・取引先・担当者）を取得する
- AI は回答内でレコードに言及する際、Markdown リンク形式 `[名前](/パス?id=ID)` で返す
- フロントエンドの `renderAiText()` 関数がリンクをクリッカブルな `<a>` タグに変換する

### Swagger UI
- `http://localhost:8080/api-docs` でアクセス（Nginx Basic認証付き）
- `nginx/.htpasswd` を事前に生成しておくこと（`gen-htpasswd.ps1` または `gen-htpasswd.sh`）
- `.htpasswd` がない状態で `docker compose up` すると Docker がディレクトリを作成してしまい 500 エラーになる
- **起動手順は必ず `docker compose down` → `docker compose up -d`**（`restart` ではマウントが再評価されない）
- Swagger UI から API を操作する際は Servers を `http://localhost:3000/api`（直接接続）に切り替えること

### OpenAI API 対応
- `gpt-5.4-nano` など新しいモデルは `max_tokens` ではなく **`max_completion_tokens`** を使うこと
- `openai.js` の本文パラメータは `max_completion_tokens` で統一済み

### AI 設定の `.env` 同期
- `api/boot/syncAiSettings.js` が起動時に `.env` の AI 関連環境変数を DB に同期する
- `SEED_DATA=false` でもこの同期は毎回実行される
- `.env` で `AI_PROVIDER=openai` / `OPENAI_API_KEY=sk-...` を設定すれば初回から AI 助言が使える

### 画面構成
- CRM業務画面とシステム管理画面は**独立したレイアウト**
- CRM業務画面のサイドバーに「システム管理 →」リンクを表示するのは **admin ログイン時のみ**
- システム管理画面は `/admin-ui/` 配下に配置し、AI助言サイドパネルを持たない

### 詳細画面の3モード
各エンティティの詳細画面は3モードを持つ。

| モード | URL例 | 動作 |
|---|---|---|
| 新規作成 | /opportunity-detail.html | URLパラメータなし。空欄フォームで編集可能状態 |
| 表示 | /opportunity-detail.html?id=5 | 全項目を読み取り専用で表示。「編集」ボタンあり |
| 編集 | /opportunity-detail.html?id=5 | 「編集」ボタン押下でインライン切り替え |

**画面遷移ルール：**
- 一覧画面の「新規作成」ボタン → 詳細画面（新規モード）へ遷移
- 一覧画面のレコード名クリック → 詳細画面（表示モード）へ遷移
- 取引先詳細の各タブ「新規作成」→ `?account_id=<id>` を渡して取引先を自動セット
- 商談詳細の「ToDo新規作成」→ `?opportunity_id=<id>` を渡して商談を自動セット
- ケース詳細の「ToDo新規作成」→ `?case_id=<id>` を渡してケースを自動セット

### 実装対象外
- **12章（Metabase連携）は実装しない**
- localtonetのトンネリング設定・Metabaseのダッシュボード構築は手動セットアップ

---

## コード生成の行動指針

### 基本ルール
- `crm-impl-prompts-v1.2.4.md` の各フェーズのプロンプトに従い、フェーズ順に実装すること
- コードは省略せず**完全な形**で出力すること
- 環境変数はすべて `.env` から読み込む（`docker-compose.yml` にハードコードしない）
- Node.js は 24.x を使用すること（`FROM node:24-alpine`）

### 仕様書との整合性
- 実装内容が `crm-sdd-spec-v1.2.4.md` と矛盾する場合は、**仕様書を正**として指摘・修正する
- 仕様書に記載のない実装を追加する場合は、その旨を明示してから実装する

### 回答スタイル
- 日本語で回答すること
- 不明点は実装前に確認すること

---

## 実装上の注意点

### bcrypt → bcryptjs（Alpine Linux対応）
`bcrypt` はネイティブモジュールのため、`node:24-alpine` 環境でビルドエラーになる。  
**必ず `bcryptjs`（ピュアJS実装）を使うこと。**

```json
// ✅ 正しい
"bcryptjs": "^2.4.3"
```

### Dockerfile — npm install
`npm ci` は `package-lock.json` が存在しないと失敗する。  
**`npm install --only=production` を使うこと。**

```dockerfile
# ✅ 正しい
RUN npm install --only=production
```

### AI ルーティング — `/api/ai` に一本化
```javascript
// ✅ 正しい（server.js）
app.use('/api/ai', requireAuth, aiRouter);

// ✅ 正しい（routes/ai.js 内）
router.get('/settings', requireAdmin, async (req, res) => { ... });
router.post('/test',    requireAdmin, async (req, res) => { ... });
router.post('/chat',    async (req, res) => { ... });

// ❌ 間違い — 404 になる
app.use('/api/ai/settings', requireAuth, requireAdmin, aiRouter);
app.use('/api/ai/chat',     requireAuth, aiRouter);
```

### OpenAI — max_completion_tokens
```javascript
// ✅ 正しい（新モデル対応）
const body = { model, max_completion_tokens: maxTokens, messages: [...] };

// ❌ 古いモデル専用（gpt-5.4-nano 等では 400 エラー）
const body = { model, max_tokens: maxTokens, messages: [...] };
```

### Swagger Basic認証 — 起動前に .htpasswd を生成
```powershell
# PowerShell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\nginx\gen-htpasswd.ps1
docker compose down
docker compose up -d
```

```bash
# Linux / Mac
chmod +x nginx/gen-htpasswd.sh
./nginx/gen-htpasswd.sh
docker compose down && docker compose up -d
```

> **注意：** `.htpasswd` がない状態で `docker compose up` すると Nginx コンテナ内に  
> `/etc/nginx/.htpasswd` がディレクトリとして作成され 500 エラーになる。  
> その場合は `nginx/.htpasswd` ディレクトリを削除してから再生成すること。

### Node.js — サーバー二重起動防止
`server.js` 内で `app.listen` は**ファイル末尾の1箇所だけ**にすること。

### CSS — クラスの完全定義
生成するHTMLで使用するすべてのクラスを `style.css` 内に定義すること。

```css
/* ✅ 必須 — リセットスタイル */
* { box-sizing: border-box; margin: 0; padding: 0; }
a { color: inherit; text-decoration: none; }
```

### パス — admin-ui 配下の相対パス
```html
<!-- ✅ admin-ui/users.html からの正しいパス -->
<link rel="stylesheet" href="../css/style.css">
<script src="../js/auth.js"></script>
```

### Nginx — api-docs の優先マッチ
```nginx
# ✅ ^~ で正規表現マッチより優先（.js/.css も含めてプロキシ）
location ^~ /api-docs {
    auth_basic           "Swagger UI";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass           http://crm_api:3000;
}
```

---

## デモ用ログイン情報

| username | password | role | アクセス可能な画面 |
|---|---|---|---|
| admin | admin1234 | admin | 全画面 |
| tanaka | pass1234 | manager | CRM業務画面のみ |
| suzuki | pass1234 | staff | CRM業務画面のみ |
| sato | pass1234 | staff | CRM業務画面のみ |

---

## よく使うコマンド

```bash
# 初回セットアップ
cp .env.example .env
# .env を編集して OPENAI_API_KEY 等を設定

# .htpasswd 生成（起動前に必須）
./nginx/gen-htpasswd.sh          # Linux/Mac
.\nginx\gen-htpasswd.ps1          # PowerShell

# 起動（必ず down → up）
docker compose down
docker compose up -d --build

# ログ確認
docker compose logs -f api

# 停止・完全削除
docker compose down
docker compose down -v
```

## アクセス先

| URL | 説明 |
|---|---|
| http://localhost:8080 | CRM 画面（ログインページ） |
| http://localhost:8080/api-docs | Swagger UI（Basic認証: swagger / swagger1234） |
| localhost:5432 | PostgreSQL（Metabase 接続用） |
