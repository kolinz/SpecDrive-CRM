# SpecDrive CRM システム仕様書（Specification-Driven Development）

**プロジェクト名:** SpecDrive CRM  
**バージョン:** 1.2.5  
**作成日:** 2026-03-22  
**更新日:** 2026-03-30  
**対象環境:** Docker Compose（ローカルPC）  
**目的:** localtonet + AWS Lightsail Metabase との連携デモ

### 変更履歴

| バージョン | 日付 | 変更内容 |
|---|---|---|
| 1.0.0 | 2026-03-22 | 初版作成 |
| 1.1.0 | 2026-03-23 | ログイン仕様変更（email→username）/ AI助言機能追加 / AI接続設定画面追加 |
| 1.2.0 | 2026-03-23 | アクセス制御修正（CRM業務画面は全ロール共通・システム管理画面はadminのみ）/ ToDo機能追加 / 商談・ケースフィールド拡充 |
| 1.2.1 | 2026-03-24 | 詳細画面追加（担当者・商談・ケース・ToDo）/ 新規作成・編集の画面遷移を明示 |
| 1.2.2 | 2026-03-26 | 技術スタックを bcryptjs に修正 / package.json・auth.js・pool.js の実装詳細を追記 |
| 1.2.3 | 2026-03-26 | Swagger UI 追加（swagger-ui-express + swagger-jsdoc） |
| 1.2.4 | 2026-03-26 | プロジェクト名を Demo CRM → SpecDrive CRM にリネーム（全ファイル適用） |
| 1.2.5 | 2026-03-30 | AI助言コンテキスト拡張：一覧画面でレコード詳細をAIコンテキストに付与 |

---

## 実装スコープ定義

本仕様書を使ってコード生成を行う際の、**実装対象・対象外**を明示する。

| 章 | 内容 | 実装 |
|---|---|---|
| 1. システム概要 | 概要・構成図 | 参照のみ |
| 2. アーキテクチャ仕様 | 技術スタック・ポート・環境変数 | ✅ 実装対象 |
| 3. アクセス制御仕様 | adminのみログイン | ✅ 実装対象 |
| 4. データモデル仕様 | テーブルDDL | ✅ 実装対象 |
| 5. API仕様 | REST APIエンドポイント + Swagger UI | ✅ 実装対象 |
| 6. 認証・認可仕様 | JWT・ロール定義 | ✅ 実装対象 |
| 7. CRM業務画面仕様 | CRM業務画面UI | ✅ 実装対象 |
| 8. システム管理画面仕様 | システム管理画面UI | ✅ 実装対象 |
| 9. AI助言機能仕様 | AIサイドパネル・LLM連携・レコード詳細コンテキスト | ✅ 実装対象 |
| 10. サンプルデータ仕様 | シードデータ | ✅ 実装対象 |
| 11. Docker構成仕様 | docker-compose / Dockerfile / Nginx | ✅ 実装対象 |
| **12. Metabase連携仕様** | **localtonet設定・Metabase接続・ダッシュボード** | **❌ 実装対象外** |
| 13. ファイル構成 | ディレクトリ構造 | 参照のみ |

---

## 目次

1. [システム概要](#1-システム概要)
2. [アーキテクチャ仕様](#2-アーキテクチャ仕様)
3. [アクセス制御仕様](#3-アクセス制御仕様)
4. [データモデル仕様](#4-データモデル仕様)
5. [API仕様](#5-api仕様)
6. [認証・認可仕様](#6-認証認可仕様)
7. [CRM業務画面仕様](#7-crm業務画面仕様)
8. [システム管理画面仕様](#8-システム管理画面仕様)
9. [AI助言機能仕様](#9-ai助言機能仕様)
10. [サンプルデータ仕様](#10-サンプルデータ仕様)
11. [Docker構成仕様](#11-docker構成仕様)
12. [Metabase連携仕様](#12-metabase連携仕様)
13. [ファイル構成](#13-ファイル構成)

---

## 1. システム概要

### 1.1 目的

PCをオンプレミスサーバーに見立て、Dockerで起動するCRMシステム。  
localtonetによるトンネリングを通じてAWS Lightsail上のMetabaseと接続し、CRMデータのBIダッシュボード可視化を実演するデモシステム。

### 1.2 機能スコープ

| 機能モジュール | 概要 | 変更 |
|---|---|---|
| 取引先企業管理 | 企業情報のCRUD | - |
| 担当者管理 | 企業に属する従業員・連絡先のCRUD | - |
| 商談管理 | パイプライン・ステージ管理・担当者指定 | - |
| ケース管理 | サポートチケット管理・担当者指定 | - |
| ToDo管理 | 商談・ケース両対応のタスク管理・担当者指定 | - |
| ユーザー管理 | CRM利用者のアカウント管理 | - |
| アクセス制御 | システム管理画面はadminのみ・CRM業務画面は全ロール共通 | - |
| ログイン | JWT認証（username + password） | - |
| AI助言 | 各画面でLLMと対話しCRMデータを分析（レコード詳細付与） | ✅ v1.2.5拡張 |
| AI接続設定 | OpenAI / Dify の接続設定管理 | - |
| REST API | Metabase等の外部ツールからのデータアクセス | - |

### 1.3 ユーザーロールとアクセス権限

| ロール | 説明 | CRM業務画面 | システム管理画面 |
|---|---|---|---|
| admin | システム管理者 | ✅ アクセス可 | ✅ アクセス可 |
| manager | マネージャー | ✅ アクセス可 | ❌ アクセス不可 |
| staff | 一般スタッフ | ✅ アクセス可 | ❌ アクセス不可 |

---

## 2. アーキテクチャ仕様

### 2.1 技術スタック

| レイヤー | 技術 | バージョン |
|---|---|---|
| フロントエンド | HTML / CSS / Vanilla JS | - |
| Webサーバー | Nginx | alpine |
| バックエンドAPI | Node.js + Express | 24.x |
| ORM | pg（node-postgres） | 8.x |
| データベース | PostgreSQL | 16 |
| 認証 | JWT（jsonwebtoken）+ bcryptjs | - |
| AIプロキシ | node-fetch（OpenAI / Dify へのリレー） | - |
| API仕様書 | swagger-ui-express + swagger-jsdoc | - |
| コンテナ | Docker Compose | v3.9 |

### 2.2 ポート定義

| サービス | 内部ポート | 外部ポート | 用途 |
|---|---|---|---|
| crm_frontend | 80 | 8080 | 管理画面（ブラウザアクセス） |
| crm_api | 3000 | 3000 | REST API / Swagger UI（/api-docs） |
| crm_db | 5432 | 5432 | PostgreSQL（Metabase接続用） |

### 2.3 環境変数

`.env` ファイルをプロジェクトルートに配置して使用する。

**.env.example（配布用テンプレート）:**

```env
# ===================================================
# SpecDrive CRM - 環境変数設定
# このファイルを .env にコピーして値を編集してください
# cp .env.example .env
# ===================================================

# -----------------------
# データベース設定
# -----------------------
POSTGRES_USER=crmuser
POSTGRES_PASSWORD=crmpassword
POSTGRES_DB=crmdb

# -----------------------
# API サーバー設定
# -----------------------
PORT=3000
DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}

# JWT 認証キー（本番環境では必ず変更すること）
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=8h

# APIキー暗号化キー（32文字以上の任意の文字列）
ENCRYPTION_KEY=change-me-to-a-32-char-random-key

# -----------------------
# デモデータ
# -----------------------
SEED_DATA=true

# -----------------------
# AI助言機能（オプション）
# -----------------------
AI_PROVIDER=none
OPENAI_API_KEY=
OPENAI_ENDPOINT=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
DIFY_API_KEY=
DIFY_ENDPOINT=
```

---

## 3. アクセス制御仕様

### 3.1 画面カテゴリとアクセス権限

| 画面カテゴリ | 対象画面 | admin | manager | staff |
|---|---|---|---|---|
| ログイン画面 | login.html | ✅ | ✅ | ✅ |
| CRM業務画面 | ダッシュボード・取引先・担当者・商談・ケース・ToDo | ✅ | ✅ | ✅ |
| システム管理画面 | ユーザー管理・AI接続設定 | ✅ | ❌ | ❌ |

### 3.2 ログイン認証フロー

`POST /api/auth/login` にて、username / password を検証し、全ロールに JWT を発行する。

### 3.3 フロントエンドのガード

**CRM業務画面（全ロール共通）:** JWT 未存在 or 期限切れ → `/login.html` にリダイレクト  
**システム管理画面（admin のみ）:** JWT チェックに加え、`role` が `admin` 以外 → `/login.html` にリダイレクト

### 3.4 APIレベルのガード

- 全エンドポイント（`/api/auth/login` 除く）：JWT必須
- システム管理系（`/api/users`, `/api/ai/settings`）：`role = admin` 以外は 403
- CRM業務系：JWT有効であればロール不問

---

## 4. データモデル仕様

### 4.1 ER図

```
users ─────────────────────────────────────────────────┐
 ├─< opportunities (owner_id)                           │
 ├─< cases (assigned_to)                                │
 └─< todos (assignee_id)                                │
                                                        │
accounts                                                │
 ├─< contacts                                           │
 ├─< opportunities ──< todos (opportunity_id, 任意)     │
 └─< cases         ──< todos (case_id, 任意)            │
                                                        │
ai_settings（シングルトン id=1）                         │
```

### 4.2 テーブル定義

#### 4.2.1 users

```sql
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  username      VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'staff',
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

#### 4.2.2 accounts

```sql
CREATE TABLE accounts (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(255) NOT NULL,
  industry       VARCHAR(100),
  website        VARCHAR(255),
  phone          VARCHAR(50),
  address        TEXT,
  annual_revenue NUMERIC(15,2),
  employee_count INTEGER,
  status         VARCHAR(20) NOT NULL DEFAULT 'active',
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 4.2.3 contacts

```sql
CREATE TABLE contacts (
  id           SERIAL PRIMARY KEY,
  account_id   INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  first_name   VARCHAR(100) NOT NULL,
  last_name    VARCHAR(100) NOT NULL,
  email        VARCHAR(255),
  phone        VARCHAR(50),
  mobile       VARCHAR(50),
  title        VARCHAR(100),
  department   VARCHAR(100),
  is_primary   BOOLEAN NOT NULL DEFAULT false,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 4.2.4 opportunities

```sql
CREATE TABLE opportunities (
  id              SERIAL PRIMARY KEY,
  account_id      INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  owner_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  contact_id      INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  name            VARCHAR(255) NOT NULL,
  stage           VARCHAR(50)  NOT NULL DEFAULT 'prospecting',
  amount          NUMERIC(15,2),
  probability     INTEGER CHECK (probability BETWEEN 0 AND 100),
  close_date      DATE,
  lead_source     VARCHAR(100),
  campaign        VARCHAR(255),
  next_step       TEXT,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 4.2.5 cases

```sql
CREATE TABLE cases (
  id              SERIAL PRIMARY KEY,
  account_id      INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  contact_id      INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  assigned_to     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  subject         VARCHAR(255) NOT NULL,
  description     TEXT,
  status          VARCHAR(20)  NOT NULL DEFAULT 'open',
  priority        VARCHAR(20)  NOT NULL DEFAULT 'medium',
  category        VARCHAR(100),
  origin          VARCHAR(50),
  resolution      TEXT,
  resolved_at     TIMESTAMPTZ,
  due_date        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 4.2.6 todos

```sql
CREATE TABLE todos (
  id              SERIAL PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  assignee_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  opportunity_id  INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,
  case_id         INTEGER REFERENCES cases(id) ON DELETE SET NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'open',
  priority        VARCHAR(20) NOT NULL DEFAULT 'medium',
  due_date        DATE,
  due_time        TIME,
  completed_at    TIMESTAMPTZ,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_todos_assignee    ON todos(assignee_id);
CREATE INDEX idx_todos_opportunity ON todos(opportunity_id);
CREATE INDEX idx_todos_case        ON todos(case_id);
CREATE INDEX idx_todos_due_date    ON todos(due_date);
```

#### 4.2.7 ai_settings

```sql
CREATE TABLE ai_settings (
  id                   INTEGER PRIMARY KEY DEFAULT 1,
  provider             VARCHAR(20) NOT NULL DEFAULT 'none',
  openai_endpoint      VARCHAR(500) DEFAULT 'https://api.openai.com/v1',
  openai_api_key       TEXT,
  openai_model         VARCHAR(100) DEFAULT 'gpt-4o',
  openai_max_tokens    INTEGER DEFAULT 2048,
  openai_system_prompt TEXT,
  dify_endpoint        VARCHAR(500),
  dify_api_key         TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT singleton CHECK (id = 1)
);

INSERT INTO ai_settings (id, provider) VALUES (1, 'none') ON CONFLICT DO NOTHING;
```

---

## 5. API仕様

### 5.1 共通ルール

- ベースURL: `http://localhost:3000/api`
- Content-Type: `application/json`
- 認証: `Authorization: Bearer <JWT>`（`/auth/login` を除く全エンドポイント）
- レスポンス形式:

```json
{ "data": <payload>, "meta": { "total": 100, "page": 1, "limit": 20 } }
{ "error": { "code": "ACCESS_DENIED", "message": "..." } }
```

### 5.2 認証 API

#### `POST /api/auth/login`

```json
{ "username": "admin", "password": "admin1234" }
```

#### `GET /api/auth/me`

### 5.3 Users API

| メソッド | パス |
|---|---|
| GET | /api/users |
| GET | /api/users/:id |
| POST | /api/users |
| PUT | /api/users/:id |
| DELETE | /api/users/:id |

### 5.4 Accounts API

| メソッド | パス |
|---|---|
| GET | /api/accounts |
| GET | /api/accounts/:id |
| POST | /api/accounts |
| PUT | /api/accounts/:id |
| DELETE | /api/accounts/:id |

**クエリパラメータ（GET /api/accounts）:** q / industry / status / page / limit

### 5.5 Contacts API

| メソッド | パス |
|---|---|
| GET | /api/contacts |
| GET | /api/contacts/:id |
| POST | /api/contacts |
| PUT | /api/contacts/:id |
| DELETE | /api/contacts/:id |

### 5.6 Opportunities API

| メソッド | パス |
|---|---|
| GET | /api/opportunities |
| GET | /api/opportunities/:id（todos含む） |
| POST | /api/opportunities |
| PUT | /api/opportunities/:id |
| DELETE | /api/opportunities/:id |

**クエリパラメータ（GET /api/opportunities）:** stage / owner_id / account_id / close_date_from / close_date_to / page / limit

### 5.7 Cases API

| メソッド | パス |
|---|---|
| GET | /api/cases |
| GET | /api/cases/:id（todos含む） |
| POST | /api/cases |
| PUT | /api/cases/:id |
| DELETE | /api/cases/:id |

**クエリパラメータ（GET /api/cases）:** status / priority / assigned_to / account_id / category / page / limit

### 5.8 ToDo API

| メソッド | パス |
|---|---|
| GET | /api/todos |
| GET | /api/todos/:id |
| POST | /api/todos |
| PUT | /api/todos/:id |
| DELETE | /api/todos/:id |

**クエリパラメータ（GET /api/todos）:** assignee_id / opportunity_id / case_id / status / priority / due_date_from / due_date_to / overdue / page / limit

### 5.9 統計 API

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/stats/summary | 全体サマリー |
| GET | /api/stats/pipeline | 商談パイプライン集計 |
| GET | /api/stats/cases | ケース集計 |
| GET | /api/stats/todos | ToDo集計 |

### 5.10 AI助言 API

#### `POST /api/ai/chat`

```json
// Request
{
  "messages": [{ "role": "user", "content": "..." }],
  "context": {
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
}

// Response 200
{ "data": { "message": "...", "provider": "openai", "model": "gpt-4o" } }
```

#### `GET /api/ai/settings`（admin）
#### `PUT /api/ai/settings`（admin）
#### `POST /api/ai/test`（admin）

---

## 6. 認証・認可仕様

### 6.1 JWT仕様

| 項目 | 値 |
|---|---|
| アルゴリズム | HS256 |
| 有効期限 | 8時間 |
| ペイロード | `{ id, username, role }` |

### 6.2 ロール・アクセス定義

| リソース | 操作 | staff | manager | admin |
|---|---|---|---|---|
| accounts | READ | ✅ | ✅ | ✅ |
| accounts | WRITE | ❌ | ✅ | ✅ |
| accounts | DELETE | ❌ | ❌ | ✅ |
| contacts | READ/WRITE | ✅ | ✅ | ✅ |
| contacts | DELETE | ❌ | ✅ | ✅ |
| opportunities | READ/WRITE | ✅ | ✅ | ✅ |
| opportunities | DELETE | ❌ | ✅ | ✅ |
| cases | READ/WRITE | ✅ | ✅ | ✅ |
| cases | DELETE | ❌ | ✅ | ✅ |
| todos | READ/WRITE | ✅ | ✅ | ✅ |
| todos | DELETE | ❌ | ✅ | ✅ |
| stats / ai/chat | USE | ✅ | ✅ | ✅ |
| users / ai/settings | READ/WRITE | ❌ | ❌ | ✅ |

---

## 7. CRM業務画面仕様

### 7.1 画面一覧

| 画面ID | パス | 説明 | 認証 | アクセス権限 |
|---|---|---|---|---|
| SCR-001 | /login.html | ログイン | 不要 | 全員 |
| SCR-002 | /index.html | ダッシュボード | 要 | 全ロール |
| SCR-003 | /accounts.html | 取引先一覧 | 要 | 全ロール |
| SCR-004 | /account-detail.html | 取引先詳細・新規作成・編集 | 要 | 全ロール |
| SCR-005 | /contacts.html | 担当者一覧 | 要 | 全ロール |
| SCR-006 | /contact-detail.html | 担当者詳細・新規作成・編集 | 要 | 全ロール |
| SCR-007 | /opportunities.html | 商談一覧 | 要 | 全ロール |
| SCR-008 | /opportunity-detail.html | 商談詳細・新規作成・編集 | 要 | 全ロール |
| SCR-009 | /cases.html | ケース一覧 | 要 | 全ロール |
| SCR-010 | /case-detail.html | ケース詳細・新規作成・編集 | 要 | 全ロール |
| SCR-011 | /todos.html | ToDo一覧 | 要 | 全ロール |
| SCR-012 | /todo-detail.html | ToDo詳細・新規作成・編集 | 要 | 全ロール |

### 7.2 共通レイアウト（CRM業務画面）

```
┌─────────────────────────────────────────────────────────────────┐
│  [ロゴ] SpecDrive CRM             [AI助言] [管理者名] [logout]  │
├───────────────┬───────────────────────────┬─────────────────────┤
│               │                           │                     │
│ ダッシュボード  │                           │  AI助言             │
│ 取引先企業     │  メインコンテンツエリア      │  サイドパネル        │
│ 担当者         │                           │  （幅300px・開閉）   │
│ 商談           │                           │                     │
│ ケース         │                           │                     │
│ ToDo           │                           │                     │
│ ──────────── │                           │                     │
│ システム管理 → │                           │  ← admin のみ表示   │
│               │                           │                     │
└───────────────┴───────────────────────────┴─────────────────────┘
```

### 7.3 詳細画面の共通仕様

#### 詳細画面の3モード

| モード | URL例 | 動作 |
|---|---|---|
| 新規作成 | /opportunity-detail.html | URLパラメータなし。空欄フォームで編集可能状態 |
| 表示 | /opportunity-detail.html?id=5 | 全項目を読み取り専用で表示。「編集」ボタンあり |
| 編集 | /opportunity-detail.html?id=5 | 「編集」ボタンで切り替え。全項目が入力可能に |

### 7.4 各画面仕様

基本仕様は v1.2.3 仕様書を参照。以下は v1.2.3 からの差分のみ記載する。

#### SCR-007 商談一覧 / SCR-009 ケース一覧 / SCR-011 ToDo一覧 ✅ v1.2.5追記

ページネーションを追加すること。

- 1ページあたり **20件** 表示
- ページ送りUI（前へ / 次へ ボタン、現在ページ番号）をテーブル下部に設置する
- API クエリパラメータ `page` / `limit=20` を使って取得する
- フィルター変更時はページを 1 にリセットすること

---

## 8. システム管理画面仕様

### 8.1 画面一覧

| 画面ID | パス | 説明 | 認証 | アクセス権限 |
|---|---|---|---|---|
| SCR-013 | /admin-ui/users.html | ユーザー管理 | 要 | admin のみ |
| SCR-014 | /admin-ui/user-detail.html | ユーザー詳細・新規作成・編集 | 要 | admin のみ |
| SCR-015 | /admin-ui/ai-settings.html | AI接続設定 | 要 | admin のみ |

（SCR-013〜SCR-015 の各画面仕様は v1.2.3 から変更なし。詳細は v1.2.3 仕様書を参照。）

---

## 9. AI助言機能仕様 ✅ v1.2.5変更

### 9.1 概要

各CRM画面のトップバー右上に「AI助言」ボタンを設置し、クリックで右サイドパネルを開く。  
v1.2.5 より、一覧画面では集計データ（summary）に加えてレコード詳細（records）をコンテキストとしてAIに付与する。  
これにより「各商談の次にとるべきアクションは？」のような個別レコードを踏まえた対話が可能になる。  
レコード件数は**50件固定**とする。ユーザーが件数を変更するUIは設けない。

### 9.2 画面別コンテキスト ✅ v1.2.5変更

#### コンテキスト構造

```json
{
  "page": "<ページ識別子>",
  "summary": { ... },
  "records": [ ... ]
}
```

`records` は一覧画面でのみ付与する。詳細画面（`?id=<id>` あり）は変更なし（summary のみ）。

#### 一覧画面ごとのコンテキスト

| page値 | summary に含まれるデータ | records に含まれるフィールド |
|---|---|---|
| `opportunities` | 件数・合計金額・ステージ別件数・今月クローズ予定数 | id / name / stage / amount / probability / close_date / owner / account / next_step / description |
| `cases` | 未解決件数・優先度分布・カテゴリー分布・平均解決時間 | id / subject / status / priority / category / assigned_to / account / due_date / description |
| `accounts` | 企業数・業種分布・ステータス分布 | id / name / industry / status / annual_revenue / employee_count |
| `todos` | 未完了件数・期限切れ件数・担当者別件数・優先度分布 | id / title / status / priority / due_date / assignee / opportunity / case |
| `dashboard` | 全体サマリー（企業数・商談数・受注額・未解決ケース・期限切れToDo数） | なし（summary のみ） |
| `contacts` | 担当者総数・企業別担当者数上位 | なし（summary のみ） |

> **詳細画面（opportunity-detail, case-detail 等）**は引き続き summary のみ。レコード数が1件確定しているため records 配列は付与しない。

#### レコード件数の上限

一覧画面では上位 **50件固定**で records を取得・付与する。ユーザーが件数を変更するUIは設けない。

### 9.3 画面別サジェストボタン ✅ v1.2.5更新

| 画面 | サジェスト |
|---|---|
| ダッシュボード | 「今月の業績サマリーを教えて」「注目すべき商談は？」「期限切れToDoを整理して」 |
| 商談 | 「各商談の次にとるべきアクションを教えて」「受注確度の高い商談を教えて」「クローズ日が近い商談のリスクは？」「今月クローズリスクは？」 |
| ケース | 「対応が遅れているケースを優先順に並べて」「緊急対応が必要なケースは？」「担当者の負荷状況は？」 |
| ToDo | 「期限切れToDoの対処方針を担当者別に提案して」「担当者別の負荷バランスは？」「今週完了すべき優先タスクは？」 |
| 取引先 | 「売上規模別にフォロー優先度を提案して」「最も取引額の大きい企業は？」「フォローが必要な見込み企業は？」 |
| 担当者 | 「キーパーソンを特定して」「連絡が取れていない担当者は？」 |

### 9.4 LLMプロバイダー別処理

#### OpenAI

```
POST {openai_endpoint}/chat/completions
Authorization: Bearer {openai_api_key}

{
  "model": "{openai_model}",
  "max_completion_tokens": {openai_max_tokens},
  "messages": [
    { "role": "system", "content": "{system_prompt}\n\n# CRMコンテキスト\n{context_json}" },
    ...会話履歴,
    { "role": "user", "content": "{user_message}" }
  ]
}
```

> `max_tokens` ではなく `max_completion_tokens` を使うこと（新しいOpenAIモデルの要件）。

#### Dify

```
POST {dify_endpoint}/chat-messages
Authorization: Bearer {dify_api_key}

{
  "inputs": { "crm_context": "{context_json}" },
  "query": "{user_message}",
  "conversation_id": "{session_conversation_id}",
  "response_mode": "blocking"
}
```

### 9.5 エラーハンドリング

| エラー条件 | 表示メッセージ |
|---|---|
| provider=none | 「AI助言が設定されていません。管理者にお問い合わせください。」 |
| API認証エラー（401） | 「APIキーが無効です。AI設定を確認してください。」 |
| タイムアウト（>30秒） | 「応答がタイムアウトしました。しばらくしてから再度お試しください。」 |
| その他APIエラー | 「AIとの通信中にエラーが発生しました。」 |

---

## 10. サンプルデータ仕様

（v1.2.3 から変更なし。詳細は v1.2.3 仕様書を参照。）

### ユーザー（4名）

| name | username | password | role |
|---|---|---|---|
| 管理者 | admin | admin1234 | admin |
| 田中マネージャー | tanaka | pass1234 | manager |
| 鈴木スタッフ | suzuki | pass1234 | staff |
| 佐藤スタッフ | sato | pass1234 | staff |

---

## 11. Docker構成仕様

（v1.2.3 から変更なし。詳細は v1.2.3 仕様書を参照。）

### 11.1 docker-compose.yml（抜粋）

```yaml
version: "3.9"
services:
  db:
    image: postgres:16-alpine
    container_name: crm_db
  api:
    build: ./api
    container_name: crm_api
  frontend:
    image: nginx:alpine
    container_name: crm_frontend
```

### 11.2 Dockerfile（API）

```dockerfile
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## 12. Metabase連携仕様

❌ 実装対象外。手動セットアップ手順として別途実施する。

---

## 13. ファイル構成

```
specdrive-crm/
├── docker-compose.yml
├── .env.example
│
├── db/
│   └── init.sql
│
├── api/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   ├── swagger.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── role.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── accounts.js
│   │   ├── contacts.js
│   │   ├── opportunities.js
│   │   ├── cases.js
│   │   ├── todos.js
│   │   ├── stats.js
│   │   └── ai.js
│   ├── services/
│   │   ├── openai.js
│   │   ├── dify.js
│   │   └── crypto.js
│   ├── db/
│   │   └── pool.js
│   └── seed/
│       └── seed.js
│
├── frontend/
│   └── public/
│       ├── login.html
│       ├── index.html
│       ├── accounts.html
│       ├── account-detail.html
│       ├── contacts.html
│       ├── contact-detail.html
│       ├── opportunities.html
│       ├── opportunity-detail.html
│       ├── cases.html
│       ├── case-detail.html
│       ├── todos.html
│       ├── todo-detail.html
│       ├── admin-ui/
│       │   ├── users.html
│       │   ├── user-detail.html
│       │   └── ai-settings.html
│       ├── css/
│       │   └── style.css
│       └── js/
│           ├── api.js
│           ├── auth.js
│           ├── ai-panel.js    ← v1.2.5変更（records取得処理・サジェスト更新）
│           └── utils.js
│
└── nginx/
    └── default.conf
```

---

## 付録：開発実装順序

Phase 1〜5（DB・API・シード）は v1.2.3 から変更なし。  
フロントエンドは Phase 6-B（ai-panel.js）のみ v1.2.5 の変更を適用する。

---

## バックログ

今後のバージョンで検討する機能・改善項目。優先度・実装バージョンは未定。

| # | 概要 | 詳細 |
|---|---|---|
| BL-001 | サイドバーのハンバーガーメニュー対応 | 768px 以下でサイドバーを自動非表示にし、ハンバーガーボタンでプッシュ形式で開閉できるようにする。スマホからのアクセス時にサイドバーがコンテンツを妨げないようにする。 |

---

*本仕様書はSDD（Specification-Driven Development）に基づき、実装前に全仕様を定義したものです。*
