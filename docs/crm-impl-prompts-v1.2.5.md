# SpecDrive CRM 実装プロンプト集

**バージョン:** 1.2.5  
**対象仕様書:** crm-sdd-spec-v1.2.5.md  
**作成日:** 2026-03-24  
**更新日:** 2026-03-30  
**使い方:** 各プロンプトを上から順番に AI コーディングアシスタントに貼り付けて実行する。前のフェーズが完了してから次に進むこと。

> **実装対象外:** 12章（Metabase連携）は手動セットアップのため本プロンプト集には含まない。

### v1.2.5 での変更フェーズ

| フェーズ | ファイル | 変更内容 |
|---|---|---|
| Phase 6-B | `js/ai-panel.js` | records取得処理追加・サジェスト更新 |

**Phase 6-B 以外のフェーズは v1.2.4 と同一。** 新規実装の場合は全フェーズを実行すること。v1.2.4 からの差分適用の場合は Phase 6-B のみ実行すること。

---

## 目次

- [Phase 1 — DB層（db/init.sql）](#phase-1--db層)
- [Phase 2 — API基盤（server.js / pool.js / middleware）](#phase-2--api基盤)
- [Phase 2-B — Swagger UI（swagger.js）](#phase-2-b--swagger-ui)
- [Phase 3-A — 認証ルート（routes/auth.js）](#phase-3-a--認証ルート)
- [Phase 3-B — accounts / contacts ルート](#phase-3-b--accounts--contacts-ルート)
- [Phase 3-C — opportunities ルート](#phase-3-c--opportunities-ルート)
- [Phase 3-D — cases ルート](#phase-3-d--cases-ルート)
- [Phase 3-E — todos ルート](#phase-3-e--todos-ルート)
- [Phase 3-F — users / stats ルート](#phase-3-f--users--stats-ルート)
- [Phase 4 — AI連携（services + routes/ai.js）](#phase-4--ai連携)
- [Phase 5 — シードデータ（seed/seed.js）](#phase-5--シードデータ)
- [Phase 6-A — Docker構成](#phase-6-a--docker構成)
- [Phase 6-B — フロントエンド共通 ✅ v1.2.5変更](#phase-6-b--フロントエンド共通)
- [Phase 6-C〜Q — 各画面](#phase-6-c--loginhtml)
- [動作確認チェックリスト](#動作確認チェックリスト)

---

## Phase 1 — DB層

### 作成ファイル
- `db/init.sql`

### プロンプト

```
以下の仕様に従い `db/init.sql` を作成してください。

## 技術要件
- PostgreSQL 16 用 DDL
- CREATE TABLE IF NOT EXISTS で冪等性を確保すること
- 外部キー制約・インデックスをすべて含めること
- ファイル末尾に ai_settings の初期レコード INSERT を含めること

## 作成するテーブル（全7テーブル）

### users
- id SERIAL PK
- name VARCHAR(100) NOT NULL
- username VARCHAR(100) NOT NULL UNIQUE
- password_hash VARCHAR(255) NOT NULL
- role VARCHAR(20) NOT NULL DEFAULT 'staff'
- is_active BOOLEAN NOT NULL DEFAULT true
- created_at / updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

### accounts
- id SERIAL PK
- name VARCHAR(255) NOT NULL
- industry VARCHAR(100)
- website VARCHAR(255)
- phone VARCHAR(50)
- address TEXT
- annual_revenue NUMERIC(15,2)
- employee_count INTEGER
- status VARCHAR(20) NOT NULL DEFAULT 'active'
- notes TEXT
- created_at / updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

### contacts
- id SERIAL PK
- account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL
- first_name VARCHAR(100) NOT NULL
- last_name VARCHAR(100) NOT NULL
- email VARCHAR(255)
- phone VARCHAR(50)
- mobile VARCHAR(50)
- title VARCHAR(100)
- department VARCHAR(100)
- is_primary BOOLEAN NOT NULL DEFAULT false
- notes TEXT
- created_at / updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

### opportunities
- id SERIAL PK
- account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL
- owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL
- contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL
- name VARCHAR(255) NOT NULL
- stage VARCHAR(50) NOT NULL DEFAULT 'prospecting'
- amount NUMERIC(15,2)
- probability INTEGER CHECK (probability BETWEEN 0 AND 100)
- close_date DATE
- lead_source VARCHAR(100)
- campaign VARCHAR(255)
- next_step TEXT
- description TEXT
- created_at / updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

### cases
- id SERIAL PK
- account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL
- contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL
- assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL
- subject VARCHAR(255) NOT NULL
- description TEXT
- status VARCHAR(20) NOT NULL DEFAULT 'open'
- priority VARCHAR(20) NOT NULL DEFAULT 'medium'
- category VARCHAR(100)
- origin VARCHAR(50)
- resolution TEXT
- resolved_at TIMESTAMPTZ
- due_date DATE
- created_at / updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

### todos
- id SERIAL PK
- title VARCHAR(255) NOT NULL
- description TEXT
- assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL
- opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL
- case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL
- status VARCHAR(20) NOT NULL DEFAULT 'open'
- priority VARCHAR(20) NOT NULL DEFAULT 'medium'
- due_date DATE
- due_time TIME
- completed_at TIMESTAMPTZ
- created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
- created_at / updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

todos テーブルに以下のインデックスを作成すること：
- idx_todos_assignee ON todos(assignee_id)
- idx_todos_opportunity ON todos(opportunity_id)
- idx_todos_case ON todos(case_id)
- idx_todos_due_date ON todos(due_date)

### ai_settings（シングルトン）
- id INTEGER PRIMARY KEY DEFAULT 1
- provider VARCHAR(20) NOT NULL DEFAULT 'none'
- openai_endpoint VARCHAR(500) DEFAULT 'https://api.openai.com/v1'
- openai_api_key TEXT
- openai_model VARCHAR(100) DEFAULT 'gpt-4o'
- openai_max_tokens INTEGER DEFAULT 2048
- openai_system_prompt TEXT
- dify_endpoint VARCHAR(500)
- dify_api_key TEXT
- updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
- CONSTRAINT singleton CHECK (id = 1)

ファイル末尾に以下を追加すること：
INSERT INTO ai_settings (id, provider) VALUES (1, 'none') ON CONFLICT DO NOTHING;
```

---

## Phase 2 — API基盤

### 作成ファイル
- `api/package.json`
- `api/server.js`
- `api/db/pool.js`
- `api/middleware/auth.js`
- `api/middleware/role.js`

### プロンプト

```
以下の仕様に従い Node.js + Express の API 基盤ファイルを作成してください。

## 技術要件
- Node.js 24.x / Express
- 依存パッケージ: express, pg, jsonwebtoken, bcryptjs, node-fetch, dotenv
  ※ `bcrypt`（ネイティブモジュール）ではなく `bcryptjs`（ピュアJS）を使うこと。

## package.json

```json
{
  "name": "specdrive-crm-api",
  "version": "0.1.0",
  "description": "SpecDrive CRM Backend API",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "swagger-jsdoc": "^6.2.8",
    "swagger-ui-express": "^5.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "node-fetch": "^2.7.0",
    "pg": "^8.11.5"
  }
}
```

## api/db/pool.js

```javascript
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
module.exports = pool;
```

## api/middleware/auth.js

```javascript
const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '認証が必要です' } });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: '無効なトークンです' } });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: { code: 'ACCESS_DENIED', message: '管理者権限が必要です' } });
  }
};

module.exports = { requireAuth, requireAdmin };
```

## api/middleware/role.js
将来のロール別権限細分化用のスタブ（通過のみの空ミドルウェア）

## api/server.js
- Express アプリを初期化
- JSON ボディパーサー・CORS（全オリジン）を設定
- ルーティング:
  - POST   /api/auth/login  → routes/auth.js（認証不要）
  - GET    /api/auth/me     → routes/auth.js（requireAuth）
  - /api/users             → routes/users.js（requireAuth + requireAdmin）
  - /api/accounts          → routes/accounts.js（requireAuth）
  - /api/contacts          → routes/contacts.js（requireAuth）
  - /api/opportunities     → routes/opportunities.js（requireAuth）
  - /api/cases             → routes/cases.js（requireAuth）
  - /api/todos             → routes/todos.js（requireAuth）
  - /api/stats             → routes/stats.js（requireAuth）
  - /api/ai                → routes/ai.js（requireAuth ※ per-route で requireAdmin を追加）
- PORT=3000 で listen
- app.listen はファイル末尾の1箇所だけにすること
```

---

## Phase 2-B — Swagger UI

### 作成ファイル
- `api/swagger.js`

### プロンプト

```
以下の仕様に従い `api/swagger.js` を作成し、`api/server.js` に Swagger UI を組み込んでください。

## api/swagger.js

```javascript
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SpecDrive CRM API',
      version: '0.1.0',
      description: 'SpecDrive CRM REST API ドキュメント',
    },
    servers: [
      { url: '/api', description: 'API サーバー' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./routes/*.js'],
};

module.exports = swaggerJsdoc(options);
```

## server.js への組み込み

```javascript
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

## 動作確認
`http://localhost:3000/api-docs` にアクセスして Swagger UI が表示されること。
```

---

## Phase 3-A — 認証ルート

### 作成ファイル
- `api/routes/auth.js`

### プロンプト

```
以下の仕様に従い `api/routes/auth.js` を作成してください。

## POST /api/auth/login
1. username / password を検証
2. ユーザーが存在しない or パスワード不一致 → 401 INVALID_CREDENTIALS
3. is_active = false → 403 ACCOUNT_DISABLED
4. 認証成功 → role に関わらず JWT を発行（200）

JWT ペイロード: { id, username, role }
JWT 有効期限: JWT_EXPIRES_IN 環境変数（デフォルト 8h）

## GET /api/auth/me
requireAuth で保護。req.user.id で users テーブルを検索して返す。password_hash は返さないこと。
```

---

## Phase 3-B — accounts / contacts ルート

### 作成ファイル
- `api/routes/accounts.js`
- `api/routes/contacts.js`

### プロンプト

```
以下の仕様に従い `api/routes/accounts.js` と `api/routes/contacts.js` を作成してください。

## accounts.js

### GET /api/accounts
クエリパラメータ: q（企業名部分一致）, industry, status, page（default:1）, limit（default:20, max:100）
レスポンス: accounts 一覧 + contacts 数・opportunities 数を COUNT で付与
meta に total / page / limit を含める

### GET /api/accounts/:id
詳細 + 関連する contacts / opportunities / cases / todos を配列で返す

### POST /api/accounts
必須: name
任意: industry, website, phone, address, annual_revenue, employee_count, status, notes

### PUT /api/accounts/:id
部分更新可。updated_at を NOW() に更新すること

### DELETE /api/accounts/:id
物理削除

## contacts.js

### GET /api/contacts
クエリパラメータ: account_id, q（氏名部分一致）, page, limit
accounts.name を JOIN して返す

### GET /api/contacts/:id
詳細 + account 情報を含める

### POST /api/contacts
必須: first_name, last_name
任意: account_id, email, phone, mobile, title, department, is_primary, notes

### PUT /api/contacts/:id
部分更新可。updated_at を NOW() に更新すること

### DELETE /api/contacts/:id
物理削除
```

---

## Phase 3-C — opportunities ルート

### 作成ファイル
- `api/routes/opportunities.js`

### プロンプト

```
以下の仕様に従い `api/routes/opportunities.js` を作成してください。

## GET /api/opportunities
クエリパラメータ: stage, owner_id, account_id, close_date_from, close_date_to, page（default:1）, limit（default:20）
owner（users.name）・account（accounts.name）を JOIN して返す
meta に total / page / limit を含める

## GET /api/opportunities/:id
詳細 + account / owner / contact 情報 + 関連 todos 配列（assignee の name 付き）

## POST /api/opportunities
必須: name, stage
任意: account_id, owner_id, contact_id, amount, probability, close_date,
      lead_source, campaign, next_step, description

## PUT /api/opportunities/:id
部分更新可。updated_at を NOW() に更新すること

## DELETE /api/opportunities/:id
物理削除
```

---

## Phase 3-D — cases ルート

### 作成ファイル
- `api/routes/cases.js`

### プロンプト

```
以下の仕様に従い `api/routes/cases.js` を作成してください。

## GET /api/cases
クエリパラメータ: status, priority, assigned_to, account_id, category, page（default:1）, limit（default:20）
assigned_to（users.name）・account（accounts.name）を JOIN して返す

## GET /api/cases/:id
詳細 + account / contact / assigned_to ユーザー情報 + 関連 todos 配列

## POST /api/cases
必須: subject, status, priority
任意: account_id, contact_id, assigned_to, description, category, origin, resolution, due_date
status が 'resolved' に変更された場合、resolved_at を NOW() にセットすること

## PUT /api/cases/:id
部分更新可。updated_at を NOW() に更新すること
status が 'resolved' に変更された場合、resolved_at を NOW() にセットすること

## DELETE /api/cases/:id
物理削除
```

---

## Phase 3-E — todos ルート

### 作成ファイル
- `api/routes/todos.js`

### プロンプト

```
以下の仕様に従い `api/routes/todos.js` を作成してください。

## GET /api/todos
クエリパラメータ: assignee_id, opportunity_id, case_id, status, priority,
                 due_date_from, due_date_to, overdue（true: 期限切れのみ）, page, limit
assignee（users.name）・opportunity（opportunities.name）・case（cases.subject）を JOIN して返す

## GET /api/todos/:id
詳細 + assignee / opportunity / case 情報を含める

## POST /api/todos
必須: title, status, priority
任意: description, assignee_id, opportunity_id, case_id, due_date, due_time
created_by は req.user.id をセットすること

## PUT /api/todos/:id
部分更新可。updated_at を NOW() に更新すること
status が 'done' になった場合 completed_at を NOW() に、それ以外は NULL に戻すこと

## DELETE /api/todos/:id
物理削除
```

---

## Phase 3-F — users / stats ルート

### 作成ファイル
- `api/routes/users.js`
- `api/routes/stats.js`

### プロンプト

```
以下の仕様に従い `api/routes/users.js` と `api/routes/stats.js` を作成してください。

## users.js（requireAuth + requireAdmin で保護済み）

### GET /api/users
全ユーザー一覧。password_hash は返さないこと

### GET /api/users/:id
詳細取得。password_hash は返さないこと

### POST /api/users
必須: name, username, password, role
password は bcryptjs でハッシュ化。username 重複時は 409

### PUT /api/users/:id
name, username, role, is_active の更新可
password が含まれる場合は bcryptjs で再ハッシュ化すること
自分自身の role を admin 以外に変更することは禁止（403）

### DELETE /api/users/:id
論理削除（is_active = false）。自分自身の削除は禁止（403）

## stats.js（requireAuth で保護済み）

### GET /api/stats/summary
- accounts_total
- opportunities_active（closed_won / closed_lost 以外）
- revenue_this_month（closed_won かつ close_date が当月の amount 合計）
- cases_open（open / in_progress / pending）
- todos_overdue（due_date < 今日 かつ status != 'done'）

### GET /api/stats/pipeline
ステージ別の件数と金額合計

### GET /api/stats/cases
status 別・priority 別・category 別の件数分布

### GET /api/stats/todos
status 別・期限切れ件数・assignee 別未完了件数（users.name 付き）
```

---

## Phase 4 — AI連携

### 作成ファイル
- `api/services/crypto.js`
- `api/services/openai.js`
- `api/services/dify.js`
- `api/routes/ai.js`

### プロンプト

```
以下の仕様に従い AI 連携の services と routes を作成してください。

## api/services/crypto.js
ENCRYPTION_KEY 環境変数（32文字以上）を使い AES-256-CBC で暗号化・復号する。
- encrypt(text): 暗号化済み文字列を返す
- decrypt(encryptedText): 復号した文字列を返す

## api/services/openai.js
OpenAI API（/chat/completions）へのリレー処理。
- chat({ messages, context, settings })
- `max_completion_tokens` を使うこと（`max_tokens` ではない）
- context は JSON.stringify して systemPrompt の末尾に付与する
- タイムアウト: 30秒

## api/services/dify.js
Dify API（/chat-messages）へのリレー処理。
- chat({ messages, context, settings, conversationId })
- response_mode: "blocking"
- inputs に crm_context として context の JSON 文字列を渡す
- タイムアウト: 30秒

## api/routes/ai.js

### GET /api/ai/settings（requireAdmin）
APIキーは末尾4文字のみ表示（sk-••••1234）

### PUT /api/ai/settings（requireAdmin）
openai_api_key / dify_api_key は crypto.encrypt() で暗号化して保存

### POST /api/ai/test（requireAdmin）
"Hello" を送信して応答を確認
レスポンス: { "data": { "success": true, "provider": "openai", "model": "gpt-4o", "latency_ms": 420 } }

### POST /api/ai/chat（requireAuth）
リクエスト:
{
  "messages": [{ "role": "user", "content": "..." }],
  "context": {
    "page": "opportunities",
    "summary": { ... },
    "records": [ ... ]
  }
}
context 全体（summary + records）を JSON.stringify して LLM に渡すこと
```

---

## Phase 5 — シードデータ

### 作成ファイル
- `api/seed/seed.js`

### プロンプト

```
以下の仕様に従い `api/seed/seed.js` を作成してください。

## 実行条件
SEED_DATA=true の場合のみ実行。users テーブルに1件以上存在する場合はスキップ。

## 投入データ

### ユーザー（4名）
| name | username | password | role |
|---|---|---|---|
| 管理者 | admin | admin1234 | admin |
| 田中マネージャー | tanaka | pass1234 | manager |
| 鈴木スタッフ | suzuki | pass1234 | staff |
| 佐藤スタッフ | sato | pass1234 | staff |
password は bcryptjs でハッシュ化して password_hash に保存すること。
template literal を seed.js 内でネストしないこと（文字列結合を使うこと）。

### 取引先企業（10社）・担当者（20名）・商談（20件）・ケース（30件）・ToDo（30件）
仕様書 v1.2.5 の 10章に従ってデータを投入すること。
（詳細は crm-sdd-spec-v1.2.5.md の 10章を参照）
```

---

## Phase 6-A — Docker構成

### 作成ファイル
- `docker-compose.yml`
- `api/Dockerfile`
- `nginx/default.conf`
- `.env.example`

### プロンプト

```
以下の仕様に従い Docker 構成ファイルを作成してください。

## docker-compose.yml
version: "3.9"
- db（crm_db）: postgres:16-alpine, env_file: .env, healthcheck: pg_isready
- api（crm_api）: build: ./api, env_file: .env, depends_on: db（service_healthy）
- frontend（crm_frontend）: nginx:alpine, volumes: ./frontend/public + ./nginx/default.conf

## api/Dockerfile
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production   ← npm ci ではなく npm install を使うこと
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]

## nginx/default.conf
1. listen 80, root /usr/share/nginx/html, index login.html
2. location /: try_files $uri $uri/ /login.html
3. location /admin-ui/: try_files $uri $uri/ /login.html
4. location ^~ /api-docs: proxy_pass http://crm_api:3000
5. location /api/: proxy_pass http://crm_api:3000
6. location ~* \.(css|js|html)$:
   add_header Cache-Control "no-cache, no-store, must-revalidate";
   add_header Pragma "no-cache";
   expires 0;

## .env.example
（仕様書 2.3 の内容に従って作成すること）
```

---

## Phase 6-B — フロントエンド共通 ✅ v1.2.5変更

### 作成ファイル
- `frontend/public/css/style.css`
- `frontend/public/js/api.js`
- `frontend/public/js/auth.js`
- `frontend/public/js/utils.js`
- `frontend/public/js/ai-panel.js` ← **v1.2.5 で変更**

### プロンプト

```
以下の仕様に従いフロントエンド共通ファイルを作成してください。

## デザイン方針
- CRM業務システムのシンプルな業務UI
- カラー: プライマリ #1A3A5C（ネイビー）/ アクセント #2E86C1（ブルー）
- フォント: system-ui / sans-serif
- レイアウト: 左サイドバー（幅200px）+ メインコンテンツ + AI助言サイドパネル（幅300px）

## css/style.css
生成するHTMLで使用するすべてのクラスをこのファイル内に定義すること。
リセットスタイルを含めること（a { color: inherit; text-decoration: none; }）。

必ず定義するスタイル:
- リセット: *, a
- 全体レイアウト: .app-shell, .sidebar, .main-content, .ai-panel
- サイドバー: .nav-item, .nav-item.active, .nav-badge, .nav-separator
- システム管理画面: .admin-shell, .admin-sidebar
- トップバー: .topbar, .topbar-title, .btn-ai
- テーブル: .data-table, th, td
- バッジ各種（critical / high / medium / low / open / in_progress / done / cancelled / active / prospect / inactive）
- フォーム: .form-group, .form-label, .form-input, .form-select, .search-select
- ボタン: .btn, .btn-primary, .btn-danger, .btn-secondary, .btn-sm
- KPIカード: .kpi-card, .kpi-value, .kpi-label
- 詳細画面: .detail-header, .breadcrumb, .field-view, .field-edit, .tabs, .tab, .tab.active
- AI助言パネル: .ai-panel, .ai-header, .ai-messages, .ai-input, .ai-bubble-user, .ai-bubble-ai
- トースト通知: .toast, .toast-success, .toast-error
- パイプラインバー: .pipeline-bar, .pipeline-bar-inner

## js/api.js
fetch のラッパー:
- baseURL = '/api'
- 全リクエストに Authorization: Bearer <JWT> ヘッダーを自動付与
- 401 受信時は localStorage をクリアして /login.html へリダイレクト
- export: get(path), post(path, body), put(path, body), del(path)

## js/auth.js
- guardCRM(): CRM業務画面用ガード（JWT有効チェックのみ）
- guardAdmin(): システム管理画面用ガード（JWT + role=admin チェック）
- getUser(): JWT をデコードして { id, username, role } を返す
- logout(): localStorage クリア → /login.html
- renderNavUserInfo(): サイドバーのユーザー情報を更新する
- renderAdminNavLink(): admin のみ「システム管理」リンクを表示する

## js/utils.js
- formatDate(dateStr): 'YYYY/MM/DD'
- formatAmount(amount): '¥1,234万'
- formatDateTime(dateStr): 'YYYY/MM/DD HH:mm'
- stageName(stage): ステージ値を日本語に変換
- priorityBadge(priority): バッジHTML
- statusBadge(status): バッジHTML
- showToast(message, type): トースト通知
- searchSelect({ inputEl, listEl, fetchFn, onSelect }): 検索セレクト共通処理

## js/ai-panel.js ✅ v1.2.5変更

### initAiPanel(page) の実装

パネルを開いたタイミングで `GET /api/stats/summary` と records 用エンドポイントを呼び出し、
コンテキストを構築してから会話に使用する。

```javascript
// ai-panel.js 内の処理

// recordsを取得するエンドポイントマッピング
const RECORD_ENDPOINTS = {
  opportunities: () => `/opportunities?limit=50`,
  cases:         () => `/cases?limit=50`,
  accounts:      () => `/accounts?limit=50`,
  todos:         () => `/todos?limit=50`,
};

// 各エンティティのコンテキスト用フィールド（不要フィールドを除外してトークン節約）
const RECORD_FIELDS = {
  opportunities: ['id','name','stage','amount','probability','close_date','next_step','description'],
  cases:         ['id','subject','status','priority','category','due_date','description'],
  accounts:      ['id','name','industry','status','annual_revenue','employee_count'],
  todos:         ['id','title','status','priority','due_date'],
};

// パネルを開いたときに呼ぶ
async function fetchContext(page) {
  // summary は GET /api/stats/summary から取得
  // records は RECORD_ENDPOINTS[page] から取得（page が対象外の場合は null）
  // RECORD_FIELDS[page] のフィールドのみを抽出して返す
  // owner / assigned_to / assignee などのネストされた名前フィールドは
  //   record.owner?.name や record.assignee?.name で展開して文字列にすること
}
```

### コンテキストの構造

```json
{
  "page": "opportunities",
  "summary": { "total": 18, "total_amount": 240000000, "by_stage": {} },
  "records": [
    {
      "id": 5,
      "name": "クラウド移行支援PJ",
      "stage": "proposal",
      "amount": 24000000,
      "probability": 50,
      "close_date": "2026-04-30",
      "owner": "田中マネージャー",
      "account": "株式会社テクノソリューション",
      "next_step": "提案書送付",
      "description": ""
    }
  ]
}
```

### チャット送信

- POST /api/ai/chat に messages と currentContext を送信する
- ローディングインジケーターを表示すること
- 会話履歴（messages 配列）をメモリ上で保持する
- パネルを閉じて再度開いた場合は会話履歴をリセットする

### 画面別サジェストボタン（v1.2.5更新）

| page | サジェスト |
|---|---|
| dashboard | 「今月の業績サマリーを教えて」「注目すべき商談は？」「期限切れToDoを整理して」 |
| opportunities | 「各商談の次にとるべきアクションを教えて」「受注確度の高い商談を教えて」「クローズ日が近い商談のリスクは？」 |
| cases | 「対応が遅れているケースを優先順に並べて」「緊急対応が必要なケースは？」「担当者の負荷状況は？」 |
| todos | 「期限切れToDoの対処方針を担当者別に提案して」「担当者別の負荷バランスは？」「今週完了すべき優先タスクは？」 |
| accounts | 「売上規模別にフォロー優先度を提案して」「最も取引額の大きい企業は？」 |
| contacts | 「キーパーソンを特定して」「連絡が取れていない担当者は？」 |

### エラーハンドリング
- AI_NOT_CONFIGURED: 「AI助言が設定されていません。管理者にお問い合わせください。」
- API認証エラー: 「APIキーが無効です。AI設定を確認してください。」
- タイムアウト: 「応答がタイムアウトしました。しばらくしてから再度お試しください。」
- その他: 「AIとの通信中にエラーが発生しました。」

### フッター
接続中のプロバイダー名・モデル名を常時表示する。
provider=none の場合はグレーアウト表示する。
```

---

## Phase 6-C — login.html

（v1.2.4 から変更なし）

### プロンプト

```
以下の仕様に従い `frontend/public/login.html` を作成してください。

- 認証不要（全員アクセス可）
- 画面中央にログインカードを配置（ロゴ: SpecDrive CRM）
- 入力: ユーザー名（id="username"）/ パスワード（id="password"）
- POST /api/auth/login に { username, password } を送信
- 成功 → localStorage に token と user を保存して /index.html へリダイレクト
- 失敗（401/403）→ サーバーから返ってきた message をエラーエリアに表示
- 既にログイン済みの場合は /index.html にリダイレクト
```

---

## Phase 6-D — index.html

（v1.2.4 から変更なし）

### プロンプト

```
以下の仕様に従い `frontend/public/index.html`（ダッシュボード）を作成してください。

- guardCRM() を呼ぶこと
- initAiPanel('dashboard') を呼ぶこと
- KPI カード4枚（GET /api/stats/summary）
- 商談パイプライン（GET /api/stats/pipeline）横棒グラフ
- 直近の商談5件（GET /api/opportunities?limit=5）
- 直近のケース5件（GET /api/cases?limit=5）
- サイドバー: renderAdminNavLink() で admin のみ「システム管理 →」を表示
```

---

## Phase 6-E — accounts.html

（v1.2.4 から変更なし）

### プロンプト

```
以下の仕様に従い `frontend/public/accounts.html`（取引先一覧）を作成してください。

- guardCRM() を呼ぶこと
- initAiPanel('accounts') を呼ぶこと
- GET /api/accounts で一覧取得（企業名/業種/ステータス/担当者数/商談数/登録日）
- 検索（q）/ 業種・ステータスフィルター / ページネーション
- 「新規作成」→ /account-detail.html
- 企業名クリック → /account-detail.html?id=<id>
```

---

## Phase 6-F — account-detail.html

（v1.2.4 から変更なし）

### プロンプト

```
以下の仕様に従い `frontend/public/account-detail.html`（取引先詳細）を作成してください。

- guardCRM() を呼ぶこと
- initAiPanel('accounts') を呼ぶこと
- 3モード（新規/表示/編集）の実装
- フォーム項目: 企業名(必須) / 業種 / ウェブサイト / 電話 / 住所 / 年間売上 / 従業員数 / ステータス / メモ
- 関連情報タブ: 担当者 / 商談 / ケース / ToDo（各タブに「新規作成」ボタン・account_id を URLパラメータで渡す）
```

---

## Phase 6-G — contacts.html

（v1.2.4 から変更なし）

### プロンプト

```
以下の仕様に従い `frontend/public/contacts.html`（担当者一覧）を作成してください。

- guardCRM() を呼ぶこと
- initAiPanel('contacts') を呼ぶこと
- 氏名/役職/部署/会社名/メール/電話のテーブル
- 取引先名フィルター / ページネーション
```

---

## Phase 6-H — contact-detail.html

（v1.2.4 から変更なし）

### プロンプト

```
以下の仕様に従い `frontend/public/contact-detail.html`（担当者詳細）を作成してください。

- guardCRM() を呼ぶこと
- initAiPanel('contacts') を呼ぶこと
- URLパラメータ: id / account_id
- 3モード実装
- 「会社名」は utils.js の searchSelect() を使った検索セレクト
```

---

## Phase 6-I — opportunities.html

（v1.2.4 から変更なし。ただし v1.2.5 でページネーションを追加すること）

### プロンプト

```
以下の仕様に従い `frontend/public/opportunities.html`（商談一覧）を作成してください。

- guardCRM() を呼ぶこと
- initAiPanel('opportunities') を呼ぶこと
- 商談名/取引先/社内担当者/ステージ/金額/確度/クローズ予定日のテーブル
- ステージ・担当者フィルター / 金額合計フッター
- ステージセルのドロップダウンで直接変更（PUT /api/opportunities/:id）
- ページネーション: 20件/ページ。テーブル下部に「前へ / 次へ」ボタンとページ番号を表示すること。フィルター変更時はページを1にリセットすること
```

---

## Phase 6-J — opportunity-detail.html

（v1.2.4 から変更なし）

### プロンプト

```
以下の仕様に従い `frontend/public/opportunity-detail.html`（商談詳細）を作成してください。

- guardCRM() を呼ぶこと
- initAiPanel('opportunities') を呼ぶこと
- URLパラメータ: id / account_id
- 3モード実装
- 「取引先」選択後に GET /api/contacts?account_id=<id> で「主要連絡先」を絞り込む
- 関連ToDoタブ: GET /api/todos?opportunity_id=<id> / 「ToDo新規作成」→ /todo-detail.html?opportunity_id=<id>
```

---

## Phase 6-K — cases.html

（v1.2.4 から変更なし。ただし v1.2.5 でページネーションを追加すること）

### プロンプト

```
以下の仕様に従い `frontend/public/cases.html`（ケース一覧）を作成してください。

- guardCRM() を呼ぶこと
- initAiPanel('cases') を呼ぶこと
- 件名/取引先/社内担当者/ステータス/優先度/カテゴリー/対応期限/作成日のテーブル
- 優先度バッジ: critical=赤 / high=橙 / medium=黄 / low=緑
- ステータス/優先度/担当者/カテゴリーフィルター
- ページネーション: 20件/ページ。テーブル下部に「前へ / 次へ」ボタンとページ番号を表示すること。フィルター変更時はページを1にリセットすること
```

---

## Phase 6-L — case-detail.html

（v1.2.4 から変更なし）

### プロンプト

```
以下の仕様に従い `frontend/public/case-detail.html`（ケース詳細）を作成してください。

- guardCRM() を呼ぶこと
- initAiPanel('cases') を呼ぶこと
- URLパラメータ: id / account_id
- 3モード実装
- 「取引先」選択後に GET /api/contacts?account_id=<id> で「問い合わせ元担当者」を絞り込む
- 関連ToDoタブ: GET /api/todos?case_id=<id> / 「ToDo新規作成」→ /todo-detail.html?case_id=<id>
```

---

## Phase 6-M — todos.html

（v1.2.4 から変更なし。ただし v1.2.5 でページネーションを追加すること）

### プロンプト

```
以下の仕様に従い `frontend/public/todos.html`（ToDo一覧）を作成してください。

- guardCRM() を呼ぶこと
- initAiPanel('todos') を呼ぶこと
- タイトル/担当者/関連商談/関連ケース/ステータス/優先度/期限日のテーブル
- ステータス/優先度/担当者/関連商談/関連ケースフィルター
- 「期限切れのみ」トグル（overdue=true）
- ステータスセルクリックで次のステータスに変更（open→in_progress→done）
- ページネーション: 20件/ページ。テーブル下部に「前へ / 次へ」ボタンとページ番号を表示すること。フィルター変更時はページを1にリセットすること
```

---

## Phase 6-N — todo-detail.html

（v1.2.4 から変更なし）

### プロンプト

```
以下の仕様に従い `frontend/public/todo-detail.html`（ToDo詳細）を作成してください。

- guardCRM() を呼ぶこと
- initAiPanel('todos') を呼ぶこと
- URLパラメータ: id / opportunity_id / case_id / account_id
- 3モード実装
- 関連商談・関連ケースは searchSelect() で検索セレクト（どちらも任意）
```

---

## Phase 6-O — admin-ui/users.html

（v1.2.4 から変更なし）

### プロンプト

```
以下の仕様に従い `frontend/public/admin-ui/users.html`（ユーザー管理）を作成してください。

- guardAdmin() を呼ぶこと（admin のみアクセス可）
- パス: <link rel="stylesheet" href="../css/style.css"> など ../起点で指定すること
- システム管理画面レイアウト（AI助言サイドパネルなし）
- GET /api/users で一覧表示（名前/ユーザー名/ロール/有効無効/作成日）
- ログイン中の自分自身の削除ボタンはグレーアウト
```

---

## Phase 6-P — admin-ui/user-detail.html

（v1.2.4 から変更なし）

### プロンプト

```
以下の仕様に従い `frontend/public/admin-ui/user-detail.html`（ユーザー詳細）を作成してください。

- guardAdmin() を呼ぶこと
- パス: ../css/style.css などで指定すること
- 3モード実装
- フォーム: 名前(必須) / ユーザー名(必須) / パスワード(新規必須・編集任意) / ロール / 有効無効トグル
- ログイン中の自分自身のロールを admin 以外に変更不可（UIで制御）
```

---

## Phase 6-Q — admin-ui/ai-settings.html

（v1.2.4 から変更なし）

### プロンプト

```
以下の仕様に従い `frontend/public/admin-ui/ai-settings.html`（AI接続設定）を作成してください。

- guardAdmin() を呼ぶこと
- パス: ../css/style.css などで指定すること
- GET /api/ai/settings で現在の設定を取得して表示
- タブ: OpenAI / Dify
- 「接続テスト」ボタン: POST /api/ai/test
- 「設定を保存」ボタン: PUT /api/ai/settings
```

---

## 動作確認チェックリスト

### 起動確認
```bash
cp .env.example .env
docker compose up -d --build
docker compose logs -f api
```

### AI助言 v1.2.5 固有チェック
- [ ] 商談一覧で AI パネルを開くと records がコンテキストに含まれる
- [ ] 「各商談の次にとるべきアクションを教えて」で各商談の next_step を踏まえた回答が返る
- [ ] ダッシュボード・担当者一覧・詳細画面では records が付与されない（summary のみ）
- [ ] records に owner / assigned_to / assignee が name 文字列として展開されている

### バックエンド（Phase 1〜5）
- [ ] DB 起動後 init.sql の全テーブルが作成されている
- [ ] SEED_DATA=true でサンプルデータが投入されている
- [ ] POST /api/auth/login で admin / manager / staff 全員 200 が返る
- [ ] GET /api/users（manager JWT）で 403 が返る
- [ ] GET /api/todos?overdue=true で期限切れ ToDo のみ返る
- [ ] GET /api/stats/summary で全 KPI 値が返る

### フロントエンド（Phase 6）
- [ ] login.html で全ロールログイン可能
- [ ] admin でサイドバーに「システム管理 →」が表示される
- [ ] manager / staff では「システム管理 →」が表示されない
- [ ] /admin-ui/users.html に manager でアクセスすると /login.html にリダイレクトされる
- [ ] 各詳細画面の3モード（新規/表示/編集）が正常動作する
- [ ] 商談・ケース詳細からの「ToDo新規作成」で親IDが自動セットされる
- [ ] 商談・ケース・ToDo一覧にページネーションが表示される
- [ ] フィルター変更時にページが1にリセットされる
