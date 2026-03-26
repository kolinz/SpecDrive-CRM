# SpecDrive CRM 実装プロンプト集

**バージョン:** 1.2.4  
**対象仕様書:** crm-sdd-spec-v1.2.4.md  
**作成日:** 2026-03-26  
**使い方:** 各プロンプトを上から順番に AI コーディングアシスタントに貼り付けて実行する。前のフェーズが完了してから次に進むこと。

> **実装対象外:** 12章（Metabase連携）は手動セットアップのため本プロンプト集には含まない。

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
- [Phase 6-A — Docker構成（docker-compose.yml / Dockerfile / Nginx / .env.example）](#phase-6-a--docker構成)
- [Phase 6-B — フロントエンド共通（style.css / api.js / auth.js / utils.js / ai-panel.js）](#phase-6-b--フロントエンド共通)
- [Phase 6-C — login.html（ログイン画面）](#phase-6-c--loginhtml)
- [Phase 6-D — index.html（ダッシュボード）](#phase-6-d--indexhtml)
- [Phase 6-E — accounts.html（取引先一覧）](#phase-6-e--accountshtml)
- [Phase 6-F — account-detail.html（取引先詳細）](#phase-6-f--account-detailhtml)
- [Phase 6-G — contacts.html（担当者一覧）](#phase-6-g--contactshtml)
- [Phase 6-H — contact-detail.html（担当者詳細）](#phase-6-h--contact-detailhtml)
- [Phase 6-I — opportunities.html（商談一覧）](#phase-6-i--opportunitieshtml)
- [Phase 6-J — opportunity-detail.html（商談詳細）](#phase-6-j--opportunity-detailhtml)
- [Phase 6-K — cases.html（ケース一覧）](#phase-6-k--caseshtml)
- [Phase 6-L — case-detail.html（ケース詳細）](#phase-6-l--case-detailhtml)
- [Phase 6-M — todos.html（ToDo一覧）](#phase-6-m--todoshtml)
- [Phase 6-N — todo-detail.html（ToDo詳細）](#phase-6-n--todo-detailhtml)
- [Phase 6-O — admin-ui/users.html（ユーザー管理）](#phase-6-o--admin-uiusershtml)
- [Phase 6-P — admin-ui/user-detail.html（ユーザー詳細）](#phase-6-p--admin-uiuser-detailhtml)
- [Phase 6-Q — admin-ui/ai-settings.html（AI接続設定）](#phase-6-q--admin-uiai-settingshtml)
- [Phase 6-R — nginx/.htpasswd 生成（Swagger UI Basic認証）](#phase-6-r--nginxhtpasswd-生成)
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
- username VARCHAR(100) NOT NULL UNIQUE  ← ログインID
- password_hash VARCHAR(255) NOT NULL
- role VARCHAR(20) NOT NULL DEFAULT 'staff'  ← 'admin'|'manager'|'staff'
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
- status VARCHAR(20) NOT NULL DEFAULT 'active'  ← 'active'|'inactive'|'prospect'
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
- owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL  ← 社内担当者
- contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL  ← 主要連絡先
- name VARCHAR(255) NOT NULL
- stage VARCHAR(50) NOT NULL DEFAULT 'prospecting'
  ← 'prospecting'|'qualification'|'proposal'|'negotiation'|'closed_won'|'closed_lost'
- amount NUMERIC(15,2)
- probability INTEGER CHECK (probability BETWEEN 0 AND 100)
- close_date DATE
- lead_source VARCHAR(100)  ← 'web'|'referral'|'event'|'cold_call'|'email'|'other'
- campaign VARCHAR(255)
- next_step TEXT
- description TEXT
- created_at / updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

### cases
- id SERIAL PK
- account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL
- contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL  ← 問い合わせ元担当者
- assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL  ← 社内担当者
- subject VARCHAR(255) NOT NULL
- description TEXT
- status VARCHAR(20) NOT NULL DEFAULT 'open'
  ← 'open'|'in_progress'|'pending'|'resolved'|'closed'
- priority VARCHAR(20) NOT NULL DEFAULT 'medium'
  ← 'low'|'medium'|'high'|'critical'
- category VARCHAR(100)  ← 'technical'|'billing'|'general'|'feature_request'|'other'
- origin VARCHAR(50)  ← 'email'|'phone'|'web'|'chat'|'other'
- resolution TEXT
- resolved_at TIMESTAMPTZ
- due_date DATE
- created_at / updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

### todos
- id SERIAL PK
- title VARCHAR(255) NOT NULL
- description TEXT
- assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL  ← 社内担当者（任意）
- opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL  ← 関連商談（任意）
- case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL  ← 関連ケース（任意）
- status VARCHAR(20) NOT NULL DEFAULT 'open'  ← 'open'|'in_progress'|'done'|'cancelled'
- priority VARCHAR(20) NOT NULL DEFAULT 'medium'  ← 'low'|'medium'|'high'
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
- provider VARCHAR(20) NOT NULL DEFAULT 'none'  ← 'none'|'openai'|'dify'
- openai_endpoint VARCHAR(500) DEFAULT 'https://api.openai.com/v1'
- openai_api_key TEXT  ← 暗号化済みで保存
- openai_model VARCHAR(100) DEFAULT 'gpt-4o'
- openai_max_tokens INTEGER DEFAULT 2048
- openai_system_prompt TEXT
- dify_endpoint VARCHAR(500)
- dify_api_key TEXT  ← 暗号化済みで保存
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
  ※ `bcrypt`（ネイティブモジュール）ではなく `bcryptjs`（ピュアJS）を使うこと。Alpine Linux環境でのビルドエラーを回避するため。
- 環境変数は process.env から読み込む（.env は docker-compose が注入）

## package.json
以下の内容で作成すること（フィールドを省略せず完全な形で出力すること）:

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
以下の内容で作成すること（このコードをそのまま使用すること）:

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
```

## api/middleware/auth.js
以下の内容で作成すること（このコードをそのまま使用すること）:

```javascript
const jwt = require('jsonwebtoken');

/**
 * 一般認証ミドルウェア（全エンドポイント共通）
 * Authorization: Bearer <JWT> を検証し、req.user にセットする
 */
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '認証が必要です' } });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded; // { id, username, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: '無効なトークンです' } });
  }
};

/**
 * 管理者権限チェックミドルウェア（システム管理系エンドポイント専用）
 * requireAuth の後に使用する。role が admin 以外は 403 を返す。
 */
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
- 将来のロール別権限細分化用のスタブとして作成
- 現時点では通過のみの空ミドルウェアでよい

## api/server.js
- Express アプリを初期化
- JSON ボディパーサーを設定
- CORS を許可（全オリジン）
- ルーティングのマウント先（後続フェーズで実装）：
  - POST   /api/auth/login  → routes/auth.js（認証不要）
  - GET    /api/auth/me     → routes/auth.js（requireAuth）
  - /api/users             → routes/users.js（requireAuth + requireAdmin）
  - /api/accounts          → routes/accounts.js（requireAuth）
  - /api/contacts          → routes/contacts.js（requireAuth）
  - /api/opportunities     → routes/opportunities.js（requireAuth）
  - /api/cases             → routes/cases.js（requireAuth）
  - /api/todos             → routes/todos.js（requireAuth）
  - /api/stats             → routes/stats.js（requireAuth）
  - /api/ai/settings       → routes/ai.js（requireAuth + requireAdmin）
  - /api/ai/chat           → routes/ai.js（requireAuth）
  - /api/ai/test           → routes/ai.js（requireAuth + requireAdmin）
- PORT=3000 で listen
- app.listen は必ずファイル末尾の1箇所だけにすること。絶対に2つ目の listen を生成しないこと。
- 共通エラーレスポンス形式:
  成功: { "data": <payload>, "meta": { "total": N, "page": N, "limit": N } }
  エラー: { "error": { "code": "...", "message": "..." } }
```

---

## Phase 2-B — Swagger UI

### 作成ファイル
- `api/swagger.js`

### プロンプト

```
以下の仕様に従い `api/swagger.js` を作成し、`api/server.js` に Swagger UI を組み込んでください。

## api/swagger.js
swagger-jsdoc を使って OpenAPI 3.0 定義を生成する設定ファイルを作成すること。

以下の内容で作成すること（このコードをそのまま使用すること）:

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

## api/server.js への組み込み
server.js の既存コードに以下を追加すること（app.listen は変更しないこと）:

1. 依存の require を先頭に追加:
```javascript
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
```

2. ルートのマウント（requireAuth なし・認証不要で公開）:
```javascript
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

3. 各ルートファイル（routes/*.js）に JSDoc コメントを追加すること。
   最低限 auth.js の POST /api/auth/login に以下の形式でコメントを追加すること:

```javascript
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: ログイン
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: 認証成功
 *       401:
 *         description: 認証失敗
 */
```

## 動作確認
`http://localhost:3000/api-docs` にアクセスして Swagger UI が表示されること。
JWT 認証が必要なエンドポイントは画面右上の「Authorize」ボタンから Bearer トークンを設定して試せること。
```

---

## Phase 3-A — 認証ルート

### 作成ファイル
- `api/routes/auth.js`

### プロンプト

```
以下の仕様に従い `api/routes/auth.js` を作成してください。

## POST /api/auth/login

### 処理フロー
1. リクエストボディから username, password を受け取る
2. users テーブルから username で検索
3. ユーザーが存在しない、またはパスワード不一致
   → 401 { "error": { "code": "INVALID_CREDENTIALS", "message": "ユーザー名またはパスワードが正しくありません" } }
4. is_active = false
   → 403 { "error": { "code": "ACCOUNT_DISABLED", "message": "このアカウントは無効です" } }
5. 認証成功 → role に関わらず JWT を発行して 200 を返す
   ※ admin / manager / staff 全ロールに JWT を発行すること

### JWT ペイロード: { id, username, role }
### JWT 有効期限: JWT_EXPIRES_IN 環境変数（デフォルト 8h）

### Response 200
{
  "data": {
    "token": "<JWT>",
    "user": { "id": 1, "name": "管理者", "username": "admin", "role": "admin" }
  }
}

## GET /api/auth/me
- requireAuth ミドルウェアで保護
- req.user の id で users テーブルを検索して返す
- password_hash は返さないこと
```

---

## Phase 3-B — accounts / contacts ルート

### 作成ファイル
- `api/routes/accounts.js`
- `api/routes/contacts.js`

### プロンプト

```
以下の仕様に従い `api/routes/accounts.js` と `api/routes/contacts.js` を作成してください。
どちらも requireAuth ミドルウェアで保護済み（server.js でマウント済み）。

## accounts.js

### GET /api/accounts
クエリパラメータ: q（企業名部分一致）, industry, status, page（default:1）, limit（default:20, max:100）
レスポンス: accounts 一覧 + 各取引先の contacts 数・opportunities 数を COUNT で付与
meta に total / page / limit を含める

### GET /api/accounts/:id
accounts の詳細 + 関連する contacts / opportunities / cases / todos を配列で返す

### POST /api/accounts
必須: name
任意: industry, website, phone, address, annual_revenue, employee_count, status, notes

### PUT /api/accounts/:id
部分更新可。updated_at を NOW() に更新すること

### DELETE /api/accounts/:id
物理削除

## contacts.js

### GET /api/contacts
クエリパラメータ: account_id（フィルター）, q（氏名部分一致）, page, limit
レスポンス: contacts 一覧 + accounts.name を JOIN して返す

### GET /api/contacts/:id
詳細取得。account 情報も含める

### POST /api/contacts
必須: first_name, last_name
任意: account_id, email, phone, mobile, title, department, is_primary, notes
account_id は accounts テーブルの id を外部キーとして参照（取引先一覧から選択）
account_id が NULL の場合は取引先未所属の担当者として登録可能

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
requireAuth ミドルウェアで保護済み（server.js でマウント済み）。

## GET /api/opportunities
クエリパラメータ:
- stage: ステージフィルター
- owner_id: 社内担当者フィルター
- account_id: 取引先フィルター
- close_date_from / close_date_to: クローズ予定日範囲
- page（default:1）, limit（default:20）

レスポンス:
- opportunities 一覧
- owner（users.name）を JOIN して返す
- account（accounts.name）を JOIN して返す
- meta に total / page / limit を含める

## GET /api/opportunities/:id
詳細取得。以下を含めること:
- account 情報（id, name）
- owner 情報（id, name）
- contact 情報（id, first_name, last_name）
- 関連する todos 配列（assignee の name 付き）

## POST /api/opportunities
必須: name, stage
任意: account_id, owner_id, contact_id, amount, probability, close_date,
      lead_source, campaign, next_step, description

account_id は accounts テーブルから選択（取引先一覧から選択）
owner_id は users テーブルから選択（CRMユーザー一覧から選択）
contact_id は contacts テーブルから選択（選択した account_id に紐づく担当者から選択）

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
requireAuth ミドルウェアで保護済み（server.js でマウント済み）。

## GET /api/cases
クエリパラメータ:
- status: ステータスフィルター（open|in_progress|pending|resolved|closed）
- priority: 優先度フィルター（low|medium|high|critical）
- assigned_to: 社内担当者フィルター
- account_id: 取引先フィルター
- category: カテゴリーフィルター
- page（default:1）, limit（default:20）

レスポンス:
- cases 一覧
- assigned_to（users.name）を JOIN して返す
- account（accounts.name）を JOIN して返す
- meta に total / page / limit を含める

## GET /api/cases/:id
詳細取得。以下を含めること:
- account 情報（id, name）
- contact 情報（id, first_name, last_name）
- assigned_to ユーザー情報（id, name）
- 関連する todos 配列（assignee の name 付き）

## POST /api/cases
必須: subject, status, priority
任意: account_id, contact_id, assigned_to, description, category, origin,
      resolution, due_date

account_id は accounts テーブルから選択（取引先一覧から選択）
contact_id は contacts テーブルから選択（選択した account_id に紐づく担当者から選択）
assigned_to は users テーブルから選択（CRMユーザー一覧から選択）

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
requireAuth ミドルウェアで保護済み（server.js でマウント済み）。

## GET /api/todos
クエリパラメータ:
- assignee_id: 担当者フィルター
- opportunity_id: 関連商談フィルター
- case_id: 関連ケースフィルター
- status: ステータスフィルター（open|in_progress|done|cancelled）
- priority: 優先度フィルター（low|medium|high）
- due_date_from / due_date_to: 期限日範囲
- overdue: true の場合、due_date < 今日 かつ status != 'done' のみ返す
- page（default:1）, limit（default:20）

レスポンス:
- todos 一覧
- assignee（users.name）を JOIN して返す
- opportunity（opportunities.name）を JOIN して返す
- case（cases.subject）を JOIN して返す
- meta に total / page / limit を含める

## GET /api/todos/:id
詳細取得。assignee / opportunity / case の情報を含める

## POST /api/todos
必須: title, status, priority
任意: description, assignee_id, opportunity_id, case_id, due_date, due_time

assignee_id は users テーブルから選択（CRMユーザー一覧から選択）
opportunity_id は opportunities テーブルから選択（商談一覧から選択・任意）
case_id は cases テーブルから選択（ケース一覧から選択・任意）
opportunity_id / case_id は両方 NULL でも、片方指定でも、両方指定でも可

created_by は req.user.id をセットすること

## PUT /api/todos/:id
部分更新可。updated_at を NOW() に更新すること
status が 'done' に変更された場合、completed_at を NOW() にセットすること
status が 'done' 以外に変更された場合、completed_at を NULL に戻すこと

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

## users.js
requireAuth + requireAdmin で保護済み（server.js でマウント済み）。

### GET /api/users
全ユーザー一覧。password_hash は返さないこと

### GET /api/users/:id
詳細取得。password_hash は返さないこと

### POST /api/users
必須: name, username, password, role
- password は bcryptjs でハッシュ化してから保存すること
- username の重複チェックを行い、重複時は 409 を返すこと

### PUT /api/users/:id
name, username, role, is_active の更新可
password が含まれる場合は bcryptjs で再ハッシュ化すること
自分自身の role を admin 以外に変更することは禁止（403 を返す）

### DELETE /api/users/:id
論理削除（is_active = false にする）
自分自身の削除は禁止（403 を返す）

## stats.js
requireAuth で保護済み（server.js でマウント済み）。

### GET /api/stats/summary
以下をまとめて返す:
- accounts_total: accounts の総件数
- opportunities_active: stage が closed_won / closed_lost 以外の件数
- revenue_this_month: stage = 'closed_won' かつ close_date が当月の amount 合計
- cases_open: status が open / in_progress / pending の件数
- todos_overdue: due_date < 今日 かつ status != 'done' の件数

### GET /api/stats/pipeline
ステージ別の商談件数と金額合計を返す
例: [{ stage: 'proposal', count: 3, total_amount: 50000000 }, ...]

### GET /api/stats/cases
- status 別の件数分布
- priority 別の件数分布
- category 別の件数分布

### GET /api/stats/todos
- status 別の件数
- 期限切れ件数（due_date < 今日 かつ status != 'done'）
- assignee 別の未完了件数（users.name 付き）
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
- encrypt(text): string → 暗号化済み文字列を返す
- decrypt(encryptedText): string → 復号した文字列を返す
APIキーの保存・取得時に使用する。

## api/services/openai.js
OpenAI API（/chat/completions）へのリレー処理を実装する。
- chat({ messages, context, settings }): string
  - settings: { endpoint, apiKey, model, maxTokens, systemPrompt }
  - context は JSON.stringify して systemPrompt の末尾に付与する
  - レスポンスから content を抽出して返す
  - タイムアウトは 30 秒

## api/services/dify.js
Dify API（/chat-messages）へのリレー処理を実装する。
- chat({ messages, context, settings, conversationId }): { message, conversationId }
  - settings: { endpoint, apiKey }
  - response_mode: "blocking"
  - inputs に crm_context として context の JSON 文字列を渡す
  - conversationId が null の場合は新規セッション
  - タイムアウトは 30 秒

## api/routes/ai.js

### GET /api/ai/settings（requireAdmin）
ai_settings テーブルの設定を返す。
APIキーは末尾4文字のみ表示し、それ以外はマスク（sk-••••1234）すること

### PUT /api/ai/settings（requireAdmin）
リクエストボディの設定で ai_settings を更新する。
openai_api_key / dify_api_key が含まれる場合は crypto.encrypt() で暗号化して保存する
updated_at を NOW() にセットすること

### POST /api/ai/test（requireAdmin）
現在の設定で接続テストを実行する。
- provider = 'openai': "Hello" を送信して応答を確認
- provider = 'dify': "Hello" を送信して応答を確認
- provider = 'none': エラーを返す
レスポンス: { "data": { "success": true, "provider": "openai", "model": "gpt-4o", "latency_ms": 420 } }

### POST /api/ai/chat（requireAuth）
リクエスト:
{
  "messages": [{ "role": "user", "content": "..." }],
  "context": { "page": "opportunities", "summary": { ... } }
}

処理フロー:
1. ai_settings から provider と設定を取得
2. provider = 'none' → 503 AI_NOT_CONFIGURED
3. APIキーを crypto.decrypt() で復号
4. provider に応じて openai.js または dify.js を呼び出す
5. レスポンス: { "data": { "message": "...", "provider": "openai", "model": "gpt-4o" } }

エラーハンドリング:
- API認証エラー（401）: "APIキーが無効です。AI設定を確認してください。"
- タイムアウト: "応答がタイムアウトしました。しばらくしてから再度お試しください。"
- その他: "AIとの通信中にエラーが発生しました。"
```

---

## Phase 5 — シードデータ

### 作成ファイル
- `api/seed/seed.js`

### プロンプト

```
以下の仕様に従い `api/seed/seed.js` を作成してください。

## 実行条件
SEED_DATA 環境変数が 'true' の場合のみ実行する。
server.js の起動時に呼び出すこと。
すでにデータが存在する場合（users テーブルに1件以上）は何もしない（冪等性の確保）。

## 投入するデータ

### ユーザー（4名）
| name | username | password | role |
|---|---|---|---|
| 管理者 | admin | admin1234 | admin |
| 田中マネージャー | tanaka | pass1234 | manager |
| 鈴木スタッフ | suzuki | pass1234 | staff |
| 佐藤スタッフ | sato | pass1234 | staff |
password は bcryptjs でハッシュ化して password_hash に保存すること

### 取引先企業（10社）
| 企業名 | 業種 | ステータス |
|---|---|---|
| 株式会社テクノソリューション | IT | active |
| 東京製造株式会社 | 製造 | active |
| グローバル商事株式会社 | 商社 | active |
| フィンテックジャパン株式会社 | 金融 | active |
| メディケアサービス株式会社 | 医療 | active |
| リテールプラス株式会社 | 小売 | active |
| エデュケーションワン株式会社 | 教育 | prospect |
| ロジスティクス東日本株式会社 | 物流 | active |
| クラウドビズ株式会社 | IT | prospect |
| オールドファッション株式会社 | 製造 | inactive |

### 担当者（20名）
各企業に2名ずつ投入。
役職・部署はランダムに振り分ける（例: 部長/課長/担当、営業部/技術部/管理部など）。

### 商談（20件）
- 各ステージ（prospecting/qualification/proposal/negotiation/closed_won/closed_lost）に均等分散
- 金額は 50万〜5000万円の範囲でランダム生成
- owner_id は 4ユーザーをランダム割り当て
- close_date は 過去3ヶ月〜3ヶ月先の範囲でランダム生成
- lead_source は 'web'|'referral'|'event'|'cold_call'|'email'|'other' からランダム

### ケース（30件）
- ステータス分布: open 40% / in_progress 30% / pending 10% / resolved 15% / closed 5%
- 優先度分布: critical 10% / high 25% / medium 45% / low 20%
- category はランダム（technical/billing/general/feature_request/other）
- origin はランダム（email/phone/web/chat/other）
- assigned_to は 4ユーザーをランダム割り当て
- resolved のケースは resolved_at に過去の日時をセットする

### ToDo（30件）
- 商談に紐付き（opportunity_id のみ指定）: 10件
- ケースに紐付き（case_id のみ指定）: 10件
- 商談とケース両方に紐付き: 5件
- 独立ToDo（両方 NULL）: 5件
- ステータス分布: open 40% / in_progress 30% / done 20% / cancelled 10%
- 優先度分布: high 30% / medium 50% / low 20%
- assignee_id は 4ユーザーをランダム割り当て
- うち5件は due_date を過去の日付にする（期限切れデータ）
- done のものは completed_at に過去の日時をセットする
- created_by は assignee_id と同じ値にする

### AI設定
ai_settings に provider='none' のレコードを1件挿入（ON CONFLICT DO NOTHING）
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
services:
  db（crm_db）:
    - image: postgres:16-alpine
    - env_file: .env（POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB を読み込む）
    - volumes: pgdata + ./db/init.sql → /docker-entrypoint-initdb.d/init.sql
    - ports: 5432:5432
    - healthcheck: pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}
      interval: 5s, timeout: 5s, retries: 10
  api（crm_api）:
    - build: ./api
    - env_file: .env
    - ports: 3000:3000
    - depends_on: db（condition: service_healthy）
  frontend（crm_frontend）:
    - image: nginx:alpine
    - volumes: ./frontend/public → /usr/share/nginx/html:ro
               ./nginx/default.conf → /etc/nginx/conf.d/default.conf:ro
    - ports: 8080:80
    - depends_on: api
volumes: pgdata

## api/Dockerfile
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]

## nginx/default.conf
以下の要件をすべて満たすこと:

1. listen 80, root /usr/share/nginx/html, index login.html
2. location /: try_files $uri $uri/ /login.html
3. location /admin-ui/: try_files $uri $uri/ /login.html
   （ファイル配信のみ。アクセス制御はフロントエンドの JWT roleチェックで行う）
4. location /api/: proxy_pass http://crm_api:3000
   proxy_set_header Host $host / X-Real-IP $remote_addr
5. 開発時のキャッシュ無効化（CSS/JS/HTMLの変更が即時反映されるよう）:
   location ~* \.(css|js|html)$ に以下を追加:
   add_header Cache-Control "no-cache, no-store, must-revalidate";
   add_header Pragma "no-cache";
   expires 0;

## .env.example
以下の内容で作成すること:

# ===================================================
# SpecDrive CRM - 環境変数設定
# cp .env.example .env してから値を編集してください
# ===================================================

# データベース設定
POSTGRES_USER=crmuser
POSTGRES_PASSWORD=crmpassword
POSTGRES_DB=crmdb

# API サーバー設定
PORT=3000
DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=8h
ENCRYPTION_KEY=change-me-to-a-32-char-random-key

# デモデータ（true: 自動投入 / false: 投入しない）
SEED_DATA=true

# AI助言機能（none | openai | dify）
AI_PROVIDER=none
OPENAI_API_KEY=
OPENAI_ENDPOINT=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
DIFY_API_KEY=
DIFY_ENDPOINT=
```

---

## Phase 6-B — フロントエンド共通

### 作成ファイル
- `frontend/public/css/style.css`
- `frontend/public/js/api.js`
- `frontend/public/js/auth.js`
- `frontend/public/js/utils.js`
- `frontend/public/js/ai-panel.js`

### プロンプト

```
以下の仕様に従いフロントエンド共通ファイルを作成してください。

## デザイン方針
- よくあるCRMシステムの見た目（Salesforceライクなシンプルな業務UI）
- カラー: プライマリ #1A3A5C（ネイビー）/ アクセント #2E86C1（ブルー）
- フォント: system-ui / sans-serif
- レイアウト: 左サイドバー（幅200px）+ メインコンテンツ + AI助言サイドパネル（幅300px）

## css/style.css
【重要】生成するHTMLで使用するすべてのクラスをこのファイル内に定義すること。
ブラウザ標準の青いリンク表示にならないよう、リセットスタイルも含めること。

必ず定義するスタイル:
- リセット: *, a（color: inherit; text-decoration: none;）
- 全体レイアウト: body, .app-shell, .sidebar, .main-content, .ai-panel
- CRM業務画面サイドバー: .nav-item, .nav-item.active, .nav-badge, .nav-separator
- システム管理画面レイアウト: .admin-shell, .admin-sidebar（CRM業務画面とは独立したレイアウト）
- トップバー: .topbar, .topbar-title, .btn-ai
- テーブル: .data-table, th, td
- バッジ各種: .badge, .badge-critical, .badge-high, .badge-medium, .badge-low,
             .badge-open, .badge-in-progress, .badge-done, .badge-cancelled,
             .badge-active, .badge-prospect, .badge-inactive
- モーダル: .modal, .modal-overlay（position: fixed は使わず min-height で実装）
- フォーム: .form-group, .form-label, .form-input, .form-select, .search-select
- ボタン: .btn, .btn-primary, .btn-danger, .btn-secondary, .btn-sm
- KPIカード: .kpi-card, .kpi-value, .kpi-label
- 詳細画面: .detail-header, .breadcrumb, .field-view, .field-edit, .tabs, .tab, .tab.active
- AI助言パネル: .ai-panel, .ai-header, .ai-messages, .ai-input, .ai-bubble-user, .ai-bubble-ai
- トースト通知: .toast, .toast-success, .toast-error
- パイプラインバー: .pipeline-bar, .pipeline-bar-inner

## js/api.js
fetch のラッパーを実装すること:
- baseURL = '/api'
- 全リクエストに Authorization: Bearer <JWT> ヘッダーを自動付与（localStorageから取得）
- 401 レスポンス受信時は localStorage をクリアして /login.html へリダイレクト
- export: get(path), post(path, body), put(path, body), del(path)

## js/auth.js
以下の関数を export すること:

### guardCRM()
CRM業務画面（SCR-002〜SCR-012）用のガード。
- localStorage に token が存在しない、または期限切れ → /login.html にリダイレクト
- role は問わない（admin / manager / staff 全員アクセス可）
- 各CRM業務画面の DOMContentLoaded で最初に呼ぶこと

### guardAdmin()
システム管理画面（/admin-ui/）用のガード。
- guardCRM() と同様のJWTチェックに加え、role が 'admin' 以外 → /login.html にリダイレクト
- /admin-ui/ 配下の各画面の DOMContentLoaded で最初に呼ぶこと

### getUser()
localStorage の JWT をデコードして { id, username, role } を返す

### logout()
localStorage をクリアして /login.html にリダイレクト

### renderNavUserInfo()
サイドバーのユーザー情報エリア（名前・ロール表示）を更新する

### renderAdminNavLink()
CRM業務画面のサイドバーで role が 'admin' の場合のみ「システム管理」リンクを表示する

## js/utils.js
以下のユーティリティ関数を実装すること:
- formatDate(dateStr): 'YYYY/MM/DD' 形式に変換
- formatAmount(amount): '¥1,234万' 形式に変換
- formatDateTime(dateStr): 'YYYY/MM/DD HH:mm' 形式に変換
- stageName(stage): ステージ値を日本語表示名に変換
  （prospecting=見込み / qualification=要件確認 / proposal=提案中
    negotiation=交渉中 / closed_won=受注 / closed_lost=失注）
- priorityBadge(priority): 優先度バッジHTMLを返す
- statusBadge(status): ステータスバッジHTMLを返す
- showToast(message, type): トースト通知を表示（type: 'success'|'error'）
- searchSelect({ inputEl, listEl, fetchFn, onSelect }):
  入力に応じて候補をドロップダウン表示し、選択時に onSelect を呼ぶ
  取引先・担当者・商談・ケースの検索セレクトで共通使用

## js/ai-panel.js
AI助言サイドパネルの共通処理を実装すること:

### 初期化: initAiPanel(page)
- 各CRM業務画面から呼び出す
- トップバーの「AI助言」ボタンクリックでパネルを開閉する
- パネル開時に GET /api/stats/summary で現在の画面コンテキストを取得してチップ表示する

### チャット送信
- POST /api/ai/chat に messages と context を送信する
- ローディングインジケーターを表示すること
- レスポンスをチャットバブルとして表示する
- 会話履歴（messages 配列）をメモリ上で保持する
- パネルを閉じて再度開いた場合は会話履歴をリセットする

### サジェストボタン（初回表示時に画面別で表示）
- dashboard: 「今月の業績サマリーを教えて」「注目すべき商談は？」「期限切れToDoを整理して」
- opportunities: 「受注確度の高い商談を教えて」「今月のクローズリスクは？」「パイプラインの課題を分析して」
- cases: 「緊急対応が必要なケースは？」「解決までの平均時間は？」「担当者の負荷状況は？」
- todos: 「期限切れToDoの対処方針を提案して」「担当者別の負荷バランスは？」「今週完了すべき優先タスクは？」
- accounts: 「最も取引額の大きい企業は？」「フォローが必要な見込み企業は？」
- contacts: 「キーパーソンを特定して」「連絡が取れていない担当者は？」

### エラーハンドリング
- AI_NOT_CONFIGURED: 「AI助言が設定されていません。管理者にお問い合わせください。」
- API認証エラー: 「APIキーが無効です。AI設定を確認してください。」
- タイムアウト: 「応答がタイムアウトしました。しばらくしてから再度お試しください。」
- その他: 「AIとの通信中にエラーが発生しました。」

### フッター
- 接続中のプロバイダー名・モデル名を常時表示する
- provider=none の場合はグレーアウト表示する
```

---

## Phase 6-C — login.html

### 作成ファイル
- `frontend/public/login.html`

### プロンプト

```
以下の仕様に従い `frontend/public/login.html` を作成してください。

## 画面仕様（SCR-001）
- 認証不要（全員アクセス可）
- CSS: <link rel="stylesheet" href="css/style.css">
- JS: 直接 fetch を使う（api.js は JWT 付与が前提のため使わない）

## UI
- 画面中央にログインカードを配置する
- ロゴ（SpecDrive CRM）をカード上部に表示する
- 入力フィールド: ユーザー名（id="username"）/ パスワード（id="password"）
- ログインボタン
- エラーメッセージ表示エリア

## 処理
- POST /api/auth/login に { username, password } を送信する
- 認証成功（全ロール共通）→ localStorage に token と user を保存して /index.html へリダイレクト
- 認証失敗（401 / 403）→ サーバーから返ってきた message をエラーエリアに表示する
- 入力欄が空の場合はバリデーションエラーを表示する
- ボタンは送信中に disabled にする
- 既にログイン済み（localStorageに有効なJWTがある）の場合は /index.html にリダイレクトする
```

---

## Phase 6-D — index.html

### 作成ファイル
- `frontend/public/index.html`

### プロンプト

```
以下の仕様に従い `frontend/public/index.html`（ダッシュボード / SCR-002）を作成してください。

## 前提
- ページ先頭で auth.js の guardCRM() を呼ぶこと（全ロールアクセス可）
- CSS: <link rel="stylesheet" href="css/style.css">
- JS: <script src="js/api.js">, <script src="js/auth.js">, <script src="js/utils.js">, <script src="js/ai-panel.js">

## レイアウト（仕様書 7.2 の共通レイアウト）
- 左サイドバー + メインコンテンツ + AI助言サイドパネル
- サイドバー: ダッシュボード（アクティブ）/ 取引先企業 / 担当者 / 商談 / ケース / ToDo
  セパレータ → 「システム管理 →」（admin のみ表示）
  renderAdminNavLink() を使うこと
- AI助言: initAiPanel('dashboard') を呼ぶこと

## KPIカード（4枚）
GET /api/stats/summary から取得:
- 取引先数（accounts_total）
- 進行中商談（opportunities_active）
- 今月の受注額（revenue_this_month）← formatAmount() で表示
- 未解決ケース（cases_open）
- 期限切れToDo（todos_overdue）← バッジとして表示

## 商談パイプライン
GET /api/stats/pipeline から取得して横棒グラフで表示:
ステージ順（prospecting→qualification→proposal→negotiation→closed_won→closed_lost）
棒の長さは件数に比例した CSS width% で実装

## 直近の商談（5件）
GET /api/opportunities?limit=5 から取得:
商談名 / 取引先名 / ステージバッジ / 金額

## 直近のケース（5件）
GET /api/cases?limit=5 から取得:
件名 / 取引先名 / 優先度バッジ
```

---

## Phase 6-E — accounts.html

### 作成ファイル
- `frontend/public/accounts.html`

### プロンプト

```
以下の仕様に従い `frontend/public/accounts.html`（取引先一覧 / SCR-003）を作成してください。

## 前提
- ページ先頭で auth.js の guardCRM() を呼ぶこと
- CSS/JS は index.html と同様に読み込む
- initAiPanel('accounts') を呼ぶこと

## テーブル表示項目
企業名 / 業種 / ステータス / 担当者数 / 商談数 / 登録日

## 機能
- GET /api/accounts で一覧取得・表示
- 検索バー（q パラメータ、debounce 300ms）
- 業種・ステータスドロップダウンフィルター
- ページネーション（20件/ページ）
- 「新規作成」ボタン → /account-detail.html（新規モード）へ遷移
- 企業名クリック → /account-detail.html?id=<id>（表示モード）へ遷移
```

---

## Phase 6-F — account-detail.html

### 作成ファイル
- `frontend/public/account-detail.html`

### プロンプト

```
以下の仕様に従い `frontend/public/account-detail.html`（取引先詳細 / SCR-004）を作成してください。

## 前提
- ページ先頭で auth.js の guardCRM() を呼ぶこと
- URL パラメータ id の有無で新規モード / 表示モードを切り替える
- initAiPanel('accounts') を呼ぶこと

## 3モードの実装
- 新規モード（id なし）: フォームが空欄で編集可能状態。右上に「保存」「キャンセル」ボタン
- 表示モード（id あり）: GET /api/accounts/:id で取得して全項目を読み取り専用表示。右上に「編集」「削除」ボタン
- 編集モード（id あり + 編集ボタン押下）: 全項目が入力可能に切り替わる。右上に「保存」「キャンセル」ボタン

## 共通UI要素
- ページ上部にパンくず（取引先一覧 > 企業名）
- 保存成功時はトースト通知を表示
- 削除は確認ダイアログ後に DELETE /api/accounts/:id → /accounts.html へ戻る

## フォーム項目
| 項目 | 入力形式 | 必須 |
|---|---|---|
| 企業名 | テキスト | ✅ |
| 業種 | テキスト | - |
| ウェブサイト | テキスト | - |
| 電話 | テキスト | - |
| 住所 | テキストエリア | - |
| 年間売上（円） | 数値 | - |
| 従業員数 | 数値 | - |
| ステータス | セレクト（active / inactive / prospect） | - |
| メモ | テキストエリア | - |

## 関連情報タブ（表示モード・編集モード共通）
GET /api/accounts/:id のレスポンスから取得して表示する。
各タブに「新規作成」ボタンを設置し、遷移先に account_id を URLパラメータで渡す。

| タブ | 表示項目 | 行クリック遷移先 | 新規作成遷移先 |
|---|---|---|---|
| 担当者 | 氏名 / 役職 / 部署 / メール | /contact-detail.html?id=<id> | /contact-detail.html?account_id=<id> |
| 商談 | 商談名 / ステージバッジ / 金額 / クローズ予定日 | /opportunity-detail.html?id=<id> | /opportunity-detail.html?account_id=<id> |
| ケース | 件名 / ステータスバッジ / 優先度バッジ / 作成日 | /case-detail.html?id=<id> | /case-detail.html?account_id=<id> |
| ToDo | タイトル / 担当者 / ステータス / 期限日 | /todo-detail.html?id=<id> | /todo-detail.html?account_id=<id> |
```

---

## Phase 6-G — contacts.html

### 作成ファイル
- `frontend/public/contacts.html`

### プロンプト

```
以下の仕様に従い `frontend/public/contacts.html`（担当者一覧 / SCR-005）を作成してください。

## 前提
- ページ先頭で auth.js の guardCRM() を呼ぶこと
- initAiPanel('contacts') を呼ぶこと

## テーブル表示項目
氏名（姓名）/ 役職 / 部署 / 会社名 / メール / 電話

## 機能
- GET /api/contacts で一覧取得・表示
- 取引先名フィルター（account_id パラメータ）/ ページネーション
- 「新規作成」ボタン → /contact-detail.html（新規モード）へ遷移
- 氏名クリック → /contact-detail.html?id=<id>（表示モード）へ遷移
```

---

## Phase 6-H — contact-detail.html

### 作成ファイル
- `frontend/public/contact-detail.html`

### プロンプト

```
以下の仕様に従い `frontend/public/contact-detail.html`（担当者詳細 / SCR-006）を作成してください。

## 前提
- ページ先頭で auth.js の guardCRM() を呼ぶこと
- URLパラメータ: id（表示・編集モード）/ account_id（取引先詳細からの新規作成時に自動セット）
- initAiPanel('contacts') を呼ぶこと

## 3モードの実装
- 新規モード（id なし）: 空欄フォーム。account_id パラメータがあれば「会社名」を自動セット
- 表示モード（id あり）: GET /api/contacts/:id で取得して読み取り専用表示
- 編集モード: 「編集」ボタン押下でインライン編集に切り替え

## 共通UI要素
- パンくず（担当者一覧 > 氏名）
- 保存成功時はトースト通知
- 削除は確認ダイアログ後に DELETE /api/contacts/:id → /contacts.html へ戻る

## フォーム項目
| 項目 | 入力形式 | 必須 |
|---|---|---|
| 姓 | テキスト | ✅ |
| 名 | テキスト | ✅ |
| 会社名 | 検索セレクト（GET /api/accounts?q=入力値 で候補取得） | - |
| 役職 | テキスト | - |
| 部署 | テキスト | - |
| メール | テキスト | - |
| 電話 | テキスト | - |
| 携帯 | テキスト | - |
| 主要担当者 | チェックボックス | - |
| メモ | テキストエリア | - |

「会社名」は utils.js の searchSelect() を使って実装すること。
取引先未所属（account_id = NULL）での登録も可能。
```

---

## Phase 6-I — opportunities.html

### 作成ファイル
- `frontend/public/opportunities.html`

### プロンプト

```
以下の仕様に従い `frontend/public/opportunities.html`（商談一覧 / SCR-007）を作成してください。

## 前提
- ページ先頭で auth.js の guardCRM() を呼ぶこと
- initAiPanel('opportunities') を呼ぶこと

## テーブル表示項目
商談名 / 取引先 / 社内担当者 / ステージバッジ / 金額 / 確度(%) / クローズ予定日

## 機能
- GET /api/opportunities で一覧取得・表示
- フィルター: ステージ / 社内担当者（owner_id）
- フッターに金額合計を表示
- ステージセルをクリックするとドロップダウンで直接変更（PUT /api/opportunities/:id）
- 「新規作成」ボタン → /opportunity-detail.html（新規モード）へ遷移
- 商談名クリック → /opportunity-detail.html?id=<id>（表示モード）へ遷移
```

---

## Phase 6-J — opportunity-detail.html

### 作成ファイル
- `frontend/public/opportunity-detail.html`

### プロンプト

```
以下の仕様に従い `frontend/public/opportunity-detail.html`（商談詳細 / SCR-008）を作成してください。

## 前提
- ページ先頭で auth.js の guardCRM() を呼ぶこと
- URLパラメータ: id（表示・編集）/ account_id（取引先から新規作成時に自動セット）
- initAiPanel('opportunities') を呼ぶこと

## 3モードの実装
- 新規モード: 空欄フォーム。account_id があれば「取引先」を自動セット
- 表示モード: GET /api/opportunities/:id で取得して読み取り専用表示
- 編集モード: 「編集」ボタン押下でインライン編集に切り替え

## 共通UI要素
- パンくず（商談一覧 > 商談名）
- 保存成功時はトースト通知
- 削除は確認ダイアログ後に DELETE /api/opportunities/:id → /opportunities.html へ戻る

## フォーム項目
| 項目 | 入力形式 | 必須 |
|---|---|---|
| 商談名 | テキスト | ✅ |
| 取引先 | 検索セレクト（取引先一覧から選択） | - |
| 主要連絡先 | 検索セレクト（選択した取引先の担当者から選択） | - |
| 社内担当者 | セレクト（GET /api/users で取得） | - |
| ステージ | セレクト | ✅ |
| 金額（円） | 数値 | - |
| 受注確度（%） | 数値 0〜100 | - |
| クローズ予定日 | 日付 | - |
| リードソース | セレクト（web/referral/event/cold_call/email/other） | - |
| キャンペーン | テキスト | - |
| 次のアクション | テキストエリア | - |
| 説明 | テキストエリア | - |

「取引先」選択後に GET /api/contacts?account_id=<id> で「主要連絡先」の候補を絞り込むこと。

## 関連ToDoタブ（表示・編集モード共通）
- GET /api/todos?opportunity_id=<id> で取得して表示
  表示項目: タイトル / 担当者 / ステータス / 優先度 / 期限日
- 行クリック → /todo-detail.html?id=<id>
- 「ToDo新規作成」ボタン → /todo-detail.html?opportunity_id=<id>（opportunity_id を自動セット）
```

---

## Phase 6-K — cases.html

### 作成ファイル
- `frontend/public/cases.html`

### プロンプト

```
以下の仕様に従い `frontend/public/cases.html`（ケース一覧 / SCR-009）を作成してください。

## 前提
- ページ先頭で auth.js の guardCRM() を呼ぶこと
- initAiPanel('cases') を呼ぶこと

## テーブル表示項目
件名 / 取引先 / 社内担当者 / ステータスバッジ / 優先度バッジ / カテゴリー / 対応期限 / 作成日

## 優先度バッジの色分け
critical=赤 / high=橙 / medium=黄 / low=緑

## 機能
- GET /api/cases で一覧取得・表示
- フィルター: ステータス / 優先度 / 社内担当者（assigned_to）/ カテゴリー
- 「新規作成」ボタン → /case-detail.html（新規モード）へ遷移
- 件名クリック → /case-detail.html?id=<id>（表示モード）へ遷移
```

---

## Phase 6-L — case-detail.html

### 作成ファイル
- `frontend/public/case-detail.html`

### プロンプト

```
以下の仕様に従い `frontend/public/case-detail.html`（ケース詳細 / SCR-010）を作成してください。

## 前提
- ページ先頭で auth.js の guardCRM() を呼ぶこと
- URLパラメータ: id（表示・編集）/ account_id（取引先から新規作成時に自動セット）
- initAiPanel('cases') を呼ぶこと

## 3モードの実装
- 新規モード: 空欄フォーム。account_id があれば「取引先」を自動セット
- 表示モード: GET /api/cases/:id で取得して読み取り専用表示
- 編集モード: 「編集」ボタン押下でインライン編集に切り替え

## 共通UI要素
- パンくず（ケース一覧 > 件名）
- 保存成功時はトースト通知
- 削除は確認ダイアログ後に DELETE /api/cases/:id → /cases.html へ戻る

## フォーム項目
| 項目 | 入力形式 | 必須 |
|---|---|---|
| 件名 | テキスト | ✅ |
| 取引先 | 検索セレクト（取引先一覧から選択） | - |
| 問い合わせ元担当者 | 検索セレクト（選択した取引先の担当者から選択） | - |
| 社内担当者 | セレクト（GET /api/users で取得） | - |
| ステータス | セレクト（open/in_progress/pending/resolved/closed） | ✅ |
| 優先度 | セレクト（low/medium/high/critical） | ✅ |
| カテゴリー | セレクト（technical/billing/general/feature_request/other） | - |
| 問い合わせ経路 | セレクト（email/phone/web/chat/other） | - |
| 対応期限 | 日付 | - |
| 内容 | テキストエリア | - |
| 解決内容 | テキストエリア | - |

「取引先」選択後に GET /api/contacts?account_id=<id> で「問い合わせ元担当者」の候補を絞り込むこと。

## 関連ToDoタブ（表示・編集モード共通）
- GET /api/todos?case_id=<id> で取得して表示
  表示項目: タイトル / 担当者 / ステータス / 優先度 / 期限日
- 行クリック → /todo-detail.html?id=<id>
- 「ToDo新規作成」ボタン → /todo-detail.html?case_id=<id>（case_id を自動セット）
```

---

## Phase 6-M — todos.html

### 作成ファイル
- `frontend/public/todos.html`

### プロンプト

```
以下の仕様に従い `frontend/public/todos.html`（ToDo一覧 / SCR-011）を作成してください。

## 前提
- ページ先頭で auth.js の guardCRM() を呼ぶこと
- initAiPanel('todos') を呼ぶこと

## テーブル表示項目
タイトル / 社内担当者 / 関連商談 / 関連ケース / ステータスバッジ / 優先度バッジ / 期限日

## 機能
- GET /api/todos で一覧取得・表示
- フィルター: ステータス / 優先度 / 担当者 / 関連商談 / 関連ケース
- 「期限切れのみ」トグルフィルター（overdue=true）
- ステータスセルをクリックするとワンクリックで次のステータスに変更（open→in_progress→done）
- 「新規作成」ボタン → /todo-detail.html（新規モード）へ遷移
- タイトルクリック → /todo-detail.html?id=<id>（表示モード）へ遷移
```

---

## Phase 6-N — todo-detail.html

### 作成ファイル
- `frontend/public/todo-detail.html`

### プロンプト

```
以下の仕様に従い `frontend/public/todo-detail.html`（ToDo詳細 / SCR-012）を作成してください。

## 前提
- ページ先頭で auth.js の guardCRM() を呼ぶこと
- URLパラメータ:
  - id（表示・編集モード）
  - opportunity_id（商談詳細からの新規作成時に自動セット）
  - case_id（ケース詳細からの新規作成時に自動セット）
  - account_id（取引先詳細からの新規作成時に自動セット）
- initAiPanel('todos') を呼ぶこと

## 3モードの実装
- 新規モード: 空欄フォーム。各URLパラメータを受け取った場合は対応フィールドを自動セット
- 表示モード: GET /api/todos/:id で取得して読み取り専用表示
- 編集モード: 「編集」ボタン押下でインライン編集に切り替え

## 共通UI要素
- パンくず（ToDo一覧 > タイトル）
- 保存成功時はトースト通知
- 削除は確認ダイアログ後に DELETE /api/todos/:id → /todos.html へ戻る

## フォーム項目
| 項目 | 入力形式 | 必須 |
|---|---|---|
| タイトル | テキスト | ✅ |
| 説明 | テキストエリア | - |
| 社内担当者 | セレクト（GET /api/users で取得） | - |
| 関連商談 | 検索セレクト（GET /api/opportunities?q=入力値 で候補取得・任意） | - |
| 関連ケース | 検索セレクト（GET /api/cases?q=入力値 で候補取得・任意） | - |
| ステータス | セレクト（open/in_progress/done/cancelled） | ✅ |
| 優先度 | セレクト（low/medium/high） | ✅ |
| 期限日 | 日付 | - |
| 期限時刻 | 時刻（省略可） | - |

関連商談・関連ケースはどちらも任意。両方 NULL でも、片方指定でも、両方指定でも可。
```

---

## Phase 6-O — admin-ui/users.html

### 作成ファイル
- `frontend/public/admin-ui/users.html`

### プロンプト

```
以下の仕様に従い `frontend/public/admin-ui/users.html`（ユーザー管理 / SCR-013）を作成してください。

## 前提
- ページ先頭で auth.js の guardAdmin() を呼ぶこと（admin のみアクセス可）
- admin-ui/ 配下からのパス指定に注意すること:
  <link rel="stylesheet" href="../css/style.css">
  <script src="../js/api.js"></script>
  <script src="../js/auth.js"></script>
  <script src="../js/utils.js"></script>

## レイアウト（仕様書 8.2 のシステム管理画面レイアウト）
- CRM業務画面とは独立したレイアウト（AI助言サイドパネルなし）
- ヘッダー: 「SpecDrive CRM  システム管理」+ ユーザー名 + ログアウト
- 左サイドバー:「ユーザー管理」（アクティブ）/「AI接続設定」/「← CRM業務へ（/index.html）」

## テーブル表示項目
名前 / ユーザー名 / ロール / 有効/無効 / 作成日

## 機能
- GET /api/users で一覧取得・表示
- 「新規作成」ボタン → /admin-ui/user-detail.html（新規モード）へ遷移
- 名前クリック → /admin-ui/user-detail.html?id=<id>（表示モード）へ遷移
- 削除ボタン → 確認ダイアログ後に DELETE /api/users/:id（論理削除）

## 制約
- ログイン中の自分自身を削除できないこと（削除ボタンをグレーアウト）
```

---

## Phase 6-P — admin-ui/user-detail.html

### 作成ファイル
- `frontend/public/admin-ui/user-detail.html`

### プロンプト

```
以下の仕様に従い `frontend/public/admin-ui/user-detail.html`（ユーザー詳細 / SCR-014）を作成してください。

## 前提
- ページ先頭で auth.js の guardAdmin() を呼ぶこと（admin のみアクセス可）
- admin-ui/ 配下からのパス指定に注意すること:
  <link rel="stylesheet" href="../css/style.css">
  <script src="../js/api.js"></script>
  <script src="../js/auth.js"></script>
  <script src="../js/utils.js"></script>
- URLパラメータ: id（表示・編集モード）

## レイアウト
SCR-013 と同様のシステム管理画面レイアウト:
- ヘッダー: 「SpecDrive CRM  システム管理」+ ユーザー名 + ログアウト
- 左サイドバー:「ユーザー管理」（アクティブ）/「AI接続設定」/「← CRM業務へ（/index.html）」

## 3モードの実装
- 新規モード（id なし）: 空欄フォームで編集可能状態。右上に「保存」「キャンセル」ボタン
- 表示モード（id あり）: GET /api/users/:id で取得して全項目を読み取り専用表示。右上に「編集」「削除」ボタン
- 編集モード（id あり + 編集ボタン押下）: 全項目が入力可能に切り替わる。右上に「保存」「キャンセル」ボタン

## 共通UI要素
- パンくず（ユーザー管理 > ユーザー名）
- 保存成功時はトースト通知を表示
- 削除は確認ダイアログ後に DELETE /api/users/:id（論理削除）→ /admin-ui/users.html へ戻る

## フォーム項目
| 項目 | 入力形式 | 必須 | 備考 |
|---|---|---|---|
| 名前 | テキスト | ✅ | - |
| ユーザー名 | テキスト | ✅ | - |
| パスワード | パスワード | ✅（新規）/ -（編集） | 編集時は空欄なら変更しない |
| ロール | セレクト（admin / manager / staff） | ✅ | - |
| 有効/無効 | トグル | - | 表示・編集モードのみ表示 |

## 制約
- ログイン中の自分自身のロールを admin 以外に変更できないこと（UIで制御）
```

---

## Phase 6-Q — admin-ui/ai-settings.html

### 作成ファイル
- `frontend/public/admin-ui/ai-settings.html`

### プロンプト

```
以下の仕様に従い `frontend/public/admin-ui/ai-settings.html`（AI接続設定 / SCR-014）を作成してください。

## 前提
- ページ先頭で auth.js の guardAdmin() を呼ぶこと（admin のみアクセス可）
- admin-ui/ 配下からのパス指定に注意すること:
  <link rel="stylesheet" href="../css/style.css">
  <script src="../js/api.js"></script>
  <script src="../js/auth.js"></script>
  <script src="../js/utils.js"></script>

## レイアウト
SCR-013 と同様のシステム管理画面レイアウト:
- ヘッダー: 「SpecDrive CRM  システム管理」+ ユーザー名 + ログアウト
- 左サイドバー:「ユーザー管理」/「AI接続設定」（アクティブ）/「← CRM業務へ（/index.html）」

## 画面起動時
GET /api/ai/settings から現在の設定を取得して各フォームフィールドに表示する

## プロバイダー選択タブ
「OpenAI」「Dify」の2タブで切り替える

### OpenAI タブのフォーム項目
- エンドポイント（テキスト・デフォルト: https://api.openai.com/v1）
- APIキー（パスワード入力・取得時はマスク表示 sk-••••1234）
- モデル名（テキスト・デフォルト: gpt-4o）
- 最大トークン数（数値・デフォルト: 2048）
- システムプロンプト（テキストエリア・省略可）

### Dify タブのフォーム項目
- エンドポイント（テキスト・例: https://api.dify.ai/v1）
- APIキー（パスワード入力・取得時はマスク表示）

## ボタン
- 「接続テスト」ボタン: POST /api/ai/test を呼び、
  成功時は「接続テスト成功 — gpt-4o · レイテンシ 420ms」を表示
- 「設定を保存」ボタン: PUT /api/ai/settings を呼ぶ。
  provider は選択中のタブに応じて 'openai' または 'dify' をセット
- 保存成功時はトースト通知を表示
```

---

## Phase 6-R — nginx/.htpasswd 生成

### 作成ファイル
- `nginx/.htpasswd`（自動生成）
- `nginx/gen-htpasswd.ps1`
- `nginx/gen-htpasswd.sh`

### プロンプト

```
以下の仕様に従い Swagger UI の Basic認証用ファイルを作成してください。

## nginx/gen-htpasswd.ps1（PowerShell用）
- .env の SWAGGER_USER / SWAGGER_PASSWORD を読み込む
- Docker（httpd:alpine）で htpasswd -nb を実行してハッシュを生成
- nginx/.htpasswd がディレクトリになっている場合は自動削除してからファイルを生成
- ASCII エンコード・LF 改行で書き出す
- デフォルト値: SWAGGER_USER=swagger / SWAGGER_PASSWORD=swagger1234

## nginx/gen-htpasswd.sh（Linux/Mac用）
- 同様に .env から読み込み openssl passwd -apr1 でハッシュを生成

## 実行手順（PowerShell）
1. Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; .\nginx\gen-htpasswd.ps1
2. docker compose down && docker compose up -d
   ※ restart ではなく down → up で確実にファイルマウントを再評価すること

## nginx/default.conf の要件
- location ^~ /api-docs に auth_basic と auth_basic_user_file /etc/nginx/.htpasswd を設定
- ^~ プレフィックスで正規表現マッチより優先し、サブパスの .js/.css も含めてプロキシする
- docker-compose.yml で ./nginx/.htpasswd:/etc/nginx/.htpasswd:ro をマウント

## Swagger UI の使い方
1. http://localhost:8080/api-docs にアクセス（Basic認証ダイアログが表示される）
2. POST /auth/login でトークン取得
3. Servers ドロップダウンで http://localhost:3000/api（直接接続）を選択
4. Authorize ボタンにトークン（Bearer プレフィックスなし）をセット
```

---

## 動作確認チェックリスト

### 起動確認
```bash
cp .env.example .env
# 必要に応じて OPENAI_API_KEY と AI_PROVIDER=openai を設定
docker compose up -d --build
docker compose logs -f api
```

### 事前準備
- [ ] `nginx/.htpasswd` が生成されている（gen-htpasswd.ps1 または gen-htpasswd.sh を実行）
- [ ] `docker compose down && docker compose up -d` で起動（restart ではなく down→up）

### バックエンド（Phase 1〜5）
- [ ] DB起動後 init.sql の全テーブルが作成されている
- [ ] API起動時に SEED_DATA=true でサンプルデータが投入されている
- [ ] 起動ログに `[Boot] ai_settings synced from .env` が出力されている
- [ ] `POST /api/auth/login` で admin / manager / staff 全員 200 が返る
- [ ] `GET /api/accounts`（JWT付き）で 200 が返る
- [ ] `GET /api/users`（admin JWT）で 200 / （manager JWT）で 403 が返る
- [ ] `GET /api/opportunities/:id` で関連 todos が含まれている
- [ ] `GET /api/cases/:id` で関連 todos が含まれている
- [ ] `GET /api/todos?overdue=true` で期限切れ ToDo のみ返る
- [ ] `GET /api/stats/summary` で全 KPI 値が返る

### Swagger UI（Phase 2-B / Phase 6-R）
- [ ] `http://localhost:8080/api-docs` でBasic認証ダイアログが表示される
- [ ] Basic認証通過後にSwagger UIが表示される
- [ ] POST /auth/login でトークン取得できる
- [ ] Servers を `http://localhost:3000/api` に切り替えてAuthorizeセット後にAPIが実行できる

### フロントエンド（Phase 6）
- [ ] `http://localhost:8080` で login.html が表示される
- [ ] admin / manager / staff 全員ログイン後 index.html へリダイレクトされる
- [ ] ダッシュボードで KPI カード・パイプライン・直近商談・直近ケースが表示される
- [ ] manager でログイン時にサイドバーに「システム管理」リンクが表示されない
- [ ] admin でログイン時にサイドバーに「システム管理 →」リンクが表示される
- [ ] 「システム管理 →」クリックで /admin-ui/users.html に遷移する
- [ ] manager で /admin-ui/users.html に直接アクセスすると /login.html にリダイレクトされる
- [ ] 取引先一覧の「新規作成」ボタンで /account-detail.html（新規モード）に遷移する
- [ ] 取引先詳細で表示→編集→保存のフローが動作する
- [ ] 取引先詳細の各タブ「新規作成」ボタンで account_id が自動セットされる
- [ ] 担当者詳細の「会社名」が検索セレクトで選択できる
- [ ] 商談詳細で「取引先」選択後に「主要連絡先」の候補が絞り込まれる
- [ ] ケース詳細で「取引先」選択後に「問い合わせ元担当者」の候補が絞り込まれる
- [ ] 商談詳細・ケース詳細から「ToDo新規作成」で親IDが自動セットされる
- [ ] ToDo一覧のステータスセルをクリックでステータスが変更される
- [ ] AI助言ボタンクリックでサイドパネルが開く
- [ ] AI未設定時に「AI助言が設定されていません」と表示される
- [ ] /admin-ui/ai-settings.html でプロバイダー選択ラジオが表示される
- [ ] ラジオで OpenAI を選択して保存後、接続テストが成功する
- [ ] AI助言の回答にリンクが含まれ、クリックで詳細画面に遷移できる
- [ ] ダッシュボードから「上位〇件の商談を教えて」のような質問に答えられる
- [ ] CSS・JS が admin-ui/ 配下から ../css/style.css などで正しく読み込まれる
- [ ] ログアウトで localStorage がクリアされ login.html に戻る
