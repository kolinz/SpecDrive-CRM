# CRM システム仕様書（Specification-Driven Development）

**プロジェクト名:** Demo CRM  
**バージョン:** 1.2.4  
**作成日:** 2026-03-22  
**更新日:** 2026-03-26  
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
| 1.2.4 | 2026-03-26 | AIルーティングバグ修正 / max_completion_tokens対応 / AI設定.env同期 / AI助言コンテキスト強化（全エンティティ） / AIレスポンスMarkdownリンク対応 / Swagger UI Basic認証（Nginx）/ プロバイダー選択UI追加 |

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
| 9. AI助言機能仕様 | AIサイドパネル・LLM連携 | ✅ 実装対象 |
| 10. サンプルデータ仕様 | シードデータ | ✅ 実装対象 |
| 11. Docker構成仕様 | docker-compose / Dockerfile / Nginx | ✅ 実装対象 |
| **12. Metabase連携仕様** | **localtonet設定・Metabase接続・ダッシュボード** | **❌ 実装対象外** |
| 13. ファイル構成 | ディレクトリ構造 | 参照のみ |

> **11章（Metabase連携）について：**  
> localtonetのトンネリング設定・Metabaseのダッシュボード構築は、Docker Composeで起動するCRM本体の外部作業であり、手動セットアップ手順として別途実施する。コード生成・自動実装の対象外とする。  
> CRM側の実装として必要なのは「PostgreSQLのポート5432を外部公開する（docker-compose.ymlで設定済み）」のみであり、これは10章で対応済み。

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

| 機能モジュール | 概要 | v1.2変更 |
|---|---|---|
| 取引先企業管理 | 企業情報のCRUD | - |
| 担当者管理 | 企業に属する従業員・連絡先のCRUD | - |
| 商談管理 | パイプライン・ステージ管理・担当者指定 | ✅ フィールド拡充 |
| ケース管理 | サポートチケット管理・担当者指定 | ✅ フィールド拡充 |
| ToDo管理 | 商談・ケース両対応のタスク管理・担当者指定 | ✅ 新規追加 |
| ユーザー管理 | CRM利用者のアカウント管理 | - |
| アクセス制御 | システム管理画面はadminのみ・CRM業務画面は全ロール共通 | ✅ 修正 |
| ログイン | JWT認証（username + password） | - |
| AI助言 | 各画面でLLMと対話しCRMデータを分析 | - |
| AI接続設定 | OpenAI / Dify の接続設定管理 | - |
| REST API | Metabase等の外部ツールからのデータアクセス | - |

### 1.3 ユーザーロールとアクセス権限 ✅ v1.2修正

| ロール | 説明 | CRM業務画面 | システム管理画面 |
|---|---|---|---|
| admin | システム管理者 | ✅ アクセス可 | ✅ アクセス可 |
| manager | マネージャー | ✅ アクセス可 | ❌ アクセス不可 |
| staff | 一般スタッフ | ✅ アクセス可 | ❌ アクセス不可 |

**CRM業務画面（ダッシュボード・取引先・担当者・商談・ケース・ToDo）** は admin / manager / staff の全ロールが利用できる。  
**システム管理画面（ユーザー管理・AI接続設定）** は admin のみアクセス可能。

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
| 認証 | JWT（jsonwebtoken） + bcryptjs | - |
| AIプロキシ | node-fetch（OpenAI / Dify へのリレー） | - |
| API仕様書 | swagger-ui-express + swagger-jsdoc | - |
| Swagger認証 | Nginx Basic認証（.htpasswd） | - |
| コンテナ | Docker Compose | v3.9 |

### 2.2 ポート定義

| サービス | 内部ポート | 外部ポート | 用途 |
|---|---|---|---|
| crm_frontend | 80 | 8080 | 管理画面（ブラウザアクセス） |
| crm_api | 3000 | 3000 | REST API / Swagger UI（/api-docs・Basic認証付き） |
| crm_db | 5432 | 5432 | PostgreSQL（Metabase接続用） |

### 2.3 環境変数

`.env` ファイルをプロジェクトルートに配置して使用する。`docker-compose.yml` は `env_file: .env` で読み込む。

**.env.example（配布用テンプレート）:**

```env
# ===================================================
# Demo CRM - 環境変数設定
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
# true  : 初回起動時にサンプルデータを自動投入する
# false : データを投入しない（空の状態で起動）
SEED_DATA=true

# -----------------------
# Swagger UI Basic認証
# -----------------------
# nginx/gen-htpasswd.ps1（または gen-htpasswd.sh）を実行して nginx/.htpasswd を生成すること
SWAGGER_USER=swagger
SWAGGER_PASSWORD=swagger1234

# -----------------------
# AI助言機能（オプション）
# 管理画面の「AI設定」から変更可能。
# 起動時点での初期値として使用される。
# -----------------------
# 使用するプロバイダー: none | openai | dify
AI_PROVIDER=none

# OpenAI API
OPENAI_API_KEY=
OPENAI_ENDPOINT=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o

# Dify API
DIFY_API_KEY=
DIFY_ENDPOINT=
```

**最小構成（デモ起動に必要な変更は1行のみ）:**

```env
# OpenAI を使う場合、APIキーだけ設定すれば動く
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
AI_PROVIDER=openai
```

**環境変数の優先順位:**  
`.env` の値 → `docker-compose.yml` の `environment` ハードコード値（`.env` が常に優先）

---

## 3. アクセス制御仕様 ✅ v1.2修正

### 3.1 画面カテゴリとアクセス権限

| 画面カテゴリ | 対象画面 | admin | manager | staff |
|---|---|---|---|---|
| ログイン画面 | login.html | ✅ | ✅ | ✅ |
| CRM業務画面 | ダッシュボード・取引先・担当者・商談・ケース・ToDo | ✅ | ✅ | ✅ |
| システム管理画面 | ユーザー管理・AI接続設定 | ✅ | ❌ | ❌ |

### 3.2 ログイン認証フロー

`POST /api/auth/login` にて、username / password を検証し、全ロールに JWT を発行する。

```
認証フロー：
1. username / password を検証
2. 一致しない           → 401 INVALID_CREDENTIALS
3. is_active = false   → 403 ACCOUNT_DISABLED
4. 一致かつ有効         → role に関わらず JWT を発行（200）
```

**Response 200（全ロール共通）:**
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": { "id": 1, "name": "田中マネージャー", "username": "tanaka", "role": "manager" }
  }
}
```

**Response 401（パスワード不一致）:**
```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "ユーザー名またはパスワードが正しくありません" } }
```

**Response 403（アカウント無効）:**
```json
{ "error": { "code": "ACCOUNT_DISABLED", "message": "このアカウントは無効です" } }
```

### 3.3 フロントエンドのガード

**CRM業務画面（全ロール共通）:**
- ページロード時に localStorage の JWT を検証
- JWT 未存在 or 期限切れ → `/login.html` にリダイレクト
- role は問わない（admin / manager / staff 全員アクセス可）

**システム管理画面（admin のみ）:**
- 上記JWTチェックに加え、JWT の `role` が `admin` 以外 → `/login.html` にリダイレクト

### 3.4 APIレベルのガード

- 全エンドポイント（`/api/auth/login` 除く）：JWT必須、未存在・期限切れは 401
- システム管理系エンドポイント（`/api/users`, `/api/ai/settings`）：`role = admin` 以外は 403
- CRM業務系エンドポイント（`/api/accounts`, `/api/contacts`, `/api/opportunities`, `/api/cases`, `/api/todos`, `/api/stats`, `/api/ai/chat`）：JWT有効であればロール不問

> **操作権限の細分化（READ / WRITE / DELETE）については 6章を参照。**

---

## 4. データモデル仕様

### 4.1 ER図

```
users ──────────────────────────────────────────────────────────┐
 │                                                              │
 ├─< opportunities (owner_id)      ←── 社内担当者               │
 ├─< cases (assigned_to)           ←── 社内担当者               │
 └─< todos (assignee_id)           ←── 社内担当者               │
                                                                │
accounts                                                        │
 ├─< contacts                                                   │
 ├─< opportunities ──< todos (opportunity_id, 任意)             │
 └─< cases         ──< todos (case_id, 任意)                    │
                                                                │
todos.opportunity_id（任意）→ opportunities                      │
todos.case_id（任意）       → cases                              │
todos.assignee_id          → users ─────────────────────────────┘

ai_settings（シングルトン id=1）
```

### 4.2 テーブル定義

#### 4.2.1 users（ユーザー）

```sql
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  username      VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'staff',
                -- 'admin' | 'manager' | 'staff'
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

#### 4.2.2 accounts（取引先企業）

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
                 -- 'active' | 'inactive' | 'prospect'
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 4.2.3 contacts（担当者・従業員）

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

#### 4.2.4 opportunities（商談）✅ v1.2変更

社内担当者（`owner_id`）を明示。フィールドを一般的なCRM標準に拡充。

```sql
CREATE TABLE opportunities (
  id              SERIAL PRIMARY KEY,
  account_id      INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  owner_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
                  -- 社内担当者（CRMユーザー）
  contact_id      INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
                  -- 主要連絡先
  name            VARCHAR(255) NOT NULL,
  stage           VARCHAR(50)  NOT NULL DEFAULT 'prospecting',
                  -- 'prospecting'|'qualification'|'proposal'
                  -- |'negotiation'|'closed_won'|'closed_lost'
  amount          NUMERIC(15,2),
  probability     INTEGER CHECK (probability BETWEEN 0 AND 100),
  close_date      DATE,
  lead_source     VARCHAR(100),
                  -- 'web'|'referral'|'event'|'cold_call'|'email'|'other'
  campaign        VARCHAR(255),
  next_step       TEXT,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| カラム | 型 | 説明 |
|---|---|---|
| owner_id | INTEGER | **社内担当者**（CRMユーザー） |
| contact_id | INTEGER | 主要連絡先（取引先担当者） |
| lead_source | VARCHAR | リードソース（web / referral / event / cold_call / email / other） |
| campaign | VARCHAR | キャンペーン名 |
| next_step | TEXT | 次のアクション |
| probability | INTEGER | 受注確度 0〜100% |

**ステージ定義：**

| ステージ値 | 表示名 | 標準確度(%) |
|---|---|---|
| prospecting | 見込み | 10 |
| qualification | 要件確認 | 25 |
| proposal | 提案中 | 50 |
| negotiation | 交渉中 | 75 |
| closed_won | 受注 | 100 |
| closed_lost | 失注 | 0 |

#### 4.2.5 cases（ケース・サポート）✅ v1.2変更

社内担当者（`assigned_to`）を明示。フィールドを一般的なCRM標準に拡充。

```sql
CREATE TABLE cases (
  id              SERIAL PRIMARY KEY,
  account_id      INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  contact_id      INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
                  -- 問い合わせ元の取引先担当者
  assigned_to     INTEGER REFERENCES users(id) ON DELETE SET NULL,
                  -- 社内担当者（CRMユーザー）
  subject         VARCHAR(255) NOT NULL,
  description     TEXT,
  status          VARCHAR(20)  NOT NULL DEFAULT 'open',
                  -- 'open'|'in_progress'|'pending'|'resolved'|'closed'
  priority        VARCHAR(20)  NOT NULL DEFAULT 'medium',
                  -- 'low'|'medium'|'high'|'critical'
  category        VARCHAR(100),
                  -- 'technical'|'billing'|'general'|'feature_request'|'other'
  origin          VARCHAR(50),
                  -- 'email'|'phone'|'web'|'chat'|'other'
  resolution      TEXT,
  resolved_at     TIMESTAMPTZ,
  due_date        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| カラム | 型 | 説明 |
|---|---|---|
| assigned_to | INTEGER | **社内担当者**（CRMユーザー） |
| contact_id | INTEGER | 問い合わせ元の取引先担当者 |
| status | VARCHAR | open / in_progress / pending / resolved / closed |
| category | VARCHAR | technical / billing / general / feature_request / other |
| origin | VARCHAR | 問い合わせ経路（email / phone / web / chat / other） |
| resolution | TEXT | 解決内容 |
| due_date | DATE | 対応期限 |

#### 4.2.6 todos（ToDo）✅ v1.2追加

商談・ケース両対応のタスク管理テーブル。`opportunity_id` と `case_id` はいずれも任意で、両方同時指定も可能。

```sql
CREATE TABLE todos (
  id              SERIAL PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  assignee_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
                  -- 社内担当者（CRMユーザー）
  opportunity_id  INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,
                  -- 関連商談（任意）
  case_id         INTEGER REFERENCES cases(id) ON DELETE SET NULL,
                  -- 関連ケース（任意）
  status          VARCHAR(20) NOT NULL DEFAULT 'open',
                  -- 'open'|'in_progress'|'done'|'cancelled'
  priority        VARCHAR(20) NOT NULL DEFAULT 'medium',
                  -- 'low'|'medium'|'high'
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

| カラム | 型 | 説明 |
|---|---|---|
| assignee_id | INTEGER | **社内担当者**（CRMユーザー）。未指定可 |
| opportunity_id | INTEGER | 関連商談（任意）。NULLの場合は商談に紐づかない独立ToDo |
| case_id | INTEGER | 関連ケース（任意）。NULLの場合はケースに紐づかない独立ToDo |
| status | VARCHAR | open / in_progress / done / cancelled |
| priority | VARCHAR | low / medium / high |
| due_date | DATE | 期限日 |
| due_time | TIME | 期限時刻（省略可） |
| completed_at | TIMESTAMPTZ | 完了日時（statusがdoneになった時刻） |
| created_by | INTEGER | 作成者（CRMユーザー） |

**関連付けパターン：**

| opportunity_id | case_id | 意味 |
|---|---|---|
| NULL | NULL | 独立ToDo（商談・ケース非紐付け） |
| 指定 | NULL | 商談に紐付いたToDo |
| NULL | 指定 | ケースに紐付いたToDo |
| 指定 | 指定 | 商談とケース両方に紐付いたToDo |

#### 4.2.7 ai_settings（AI接続設定）

```sql
CREATE TABLE ai_settings (
  id                   INTEGER PRIMARY KEY DEFAULT 1,
  provider             VARCHAR(20) NOT NULL DEFAULT 'none',
                       -- 'none' | 'openai' | 'dify'
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
- CRM業務系エンドポイント：JWT有効であればロール不問
- システム管理系エンドポイント（`/api/users`, `/api/ai/settings`）：`role = admin` 以外は 403
- レスポンス形式:

```json
// 成功
{ "data": <payload>, "meta": { "total": 100, "page": 1, "limit": 20 } }

// エラー
{ "error": { "code": "ACCESS_DENIED", "message": "..." } }
```

### 5.2 認証 API

#### `POST /api/auth/login`

```json
// Request
{ "username": "admin", "password": "admin1234" }

// Response 200
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": { "id": 1, "name": "管理者", "username": "admin", "role": "admin" }
  }
}

// Response 403（アカウント無効）
{ "error": { "code": "ACCOUNT_DISABLED", "message": "このアカウントは無効です" } }

// Response 401（パスワード不一致）
{ "error": { "code": "INVALID_CREDENTIALS", "message": "ユーザー名またはパスワードが正しくありません" } }
```

#### `GET /api/auth/me`

現在ログイン中のユーザー情報を返す。

### 5.3 Users API

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/users | 一覧取得 |
| GET | /api/users/:id | 詳細取得 |
| POST | /api/users | 新規作成 |
| PUT | /api/users/:id | 更新 |
| DELETE | /api/users/:id | 削除（論理） |

```json
// POST /api/users Request
{ "name": "山田太郎", "username": "yamada", "password": "pass1234", "role": "staff" }
```

### 5.4 Accounts API

| メソッド | パス | 権限 |
|---|---|---|
| GET | /api/accounts | admin |
| GET | /api/accounts/:id | admin |
| POST | /api/accounts | admin |
| PUT | /api/accounts/:id | admin |
| DELETE | /api/accounts/:id | admin |

**クエリパラメータ（GET /api/accounts）:**

| パラメータ | 説明 |
|---|---|
| q | 企業名の部分一致検索 |
| industry | 業種フィルター |
| status | ステータスフィルター |
| page | ページ番号（default: 1） |
| limit | 件数（default: 20, max: 100） |

### 5.5 Contacts API

| メソッド | パス |
|---|---|
| GET | /api/contacts（account_id フィルター対応） |
| GET | /api/contacts/:id |
| POST | /api/contacts |
| PUT | /api/contacts/:id |
| DELETE | /api/contacts/:id |

### 5.6 Opportunities API ✅ v1.2変更

| メソッド | パス |
|---|---|
| GET | /api/opportunities |
| GET | /api/opportunities/:id（todos含む） |
| POST | /api/opportunities |
| PUT | /api/opportunities/:id |
| DELETE | /api/opportunities/:id |

**クエリパラメータ（GET /api/opportunities）:**

| パラメータ | 説明 |
|---|---|
| stage | ステージフィルター |
| owner_id | 社内担当者フィルター |
| account_id | 取引先フィルター |
| close_date_from | クローズ予定日（from） |
| close_date_to | クローズ予定日（to） |

```json
// POST /api/opportunities Request
{
  "account_id": 1,
  "owner_id": 2,
  "contact_id": 3,
  "name": "クラウド移行支援PJ",
  "stage": "proposal",
  "amount": 24000000,
  "probability": 50,
  "close_date": "2026-04-30",
  "lead_source": "referral",
  "campaign": "",
  "next_step": "提案書送付",
  "description": ""
}
```

### 5.7 Cases API ✅ v1.2変更

| メソッド | パス |
|---|---|
| GET | /api/cases |
| GET | /api/cases/:id（todos含む） |
| POST | /api/cases |
| PUT | /api/cases/:id |
| DELETE | /api/cases/:id |

**クエリパラメータ（GET /api/cases）:**

| パラメータ | 説明 |
|---|---|
| status | ステータスフィルター |
| priority | 優先度フィルター |
| assigned_to | 社内担当者フィルター |
| account_id | 取引先フィルター |
| category | カテゴリーフィルター |

```json
// POST /api/cases Request
{
  "account_id": 1,
  "contact_id": 2,
  "assigned_to": 3,
  "subject": "ログインできない",
  "description": "...",
  "status": "open",
  "priority": "critical",
  "category": "technical",
  "origin": "email",
  "due_date": "2026-04-01"
}
```

### 5.8 ToDo API ✅ v1.2追加

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/todos | 一覧取得 |
| GET | /api/todos/:id | 詳細取得 |
| POST | /api/todos | 新規作成 |
| PUT | /api/todos/:id | 更新 |
| DELETE | /api/todos/:id | 削除 |

**クエリパラメータ（GET /api/todos）:**

| パラメータ | 説明 |
|---|---|
| assignee_id | 担当者フィルター |
| opportunity_id | 関連商談フィルター |
| case_id | 関連ケースフィルター |
| status | ステータスフィルター（open / in_progress / done / cancelled） |
| priority | 優先度フィルター |
| due_date_from | 期限日（from） |
| due_date_to | 期限日（to） |
| overdue | true の場合、期限切れ（due_date < 今日 かつ status != done）のみ |

```json
// POST /api/todos Request
{
  "title": "提案書送付",
  "description": "クラウド移行の提案書をPDFで送付する",
  "assignee_id": 2,
  "opportunity_id": 5,
  "case_id": null,
  "status": "open",
  "priority": "high",
  "due_date": "2026-04-10",
  "due_time": "17:00"
}

// Response 200
{
  "data": {
    "id": 12,
    "title": "提案書送付",
    "assignee": { "id": 2, "name": "田中マネージャー" },
    "opportunity": { "id": 5, "name": "クラウド移行支援PJ" },
    "case": null,
    "status": "open",
    "priority": "high",
    "due_date": "2026-04-10",
    "due_time": "17:00:00",
    "completed_at": null,
    "created_at": "2026-03-23T10:00:00Z"
  }
}
```

### 5.9 統計 API

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/stats/summary | 全体サマリー |
| GET | /api/stats/pipeline | 商談パイプライン集計 |
| GET | /api/stats/cases | ケース集計 |
| GET | /api/stats/todos | ToDo集計（未完了数・期限切れ数・担当者別） |

### 5.10 AI助言 API

#### `POST /api/ai/chat`

```json
// Request
{
  "messages": [{ "role": "user", "content": "..." }],
  "context": {
    "page": "opportunities",
    "summary": { "total": 18, "total_amount": 240000000, "by_stage": {...} }
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
| 発行条件 | is_active = true であれば全ロール発行 |

### 6.2 ロール・アクセス定義 ✅ v1.2修正

| リソース | 操作 | staff | manager | admin |
|---|---|---|---|---|
| ログイン（JWT発行） | - | ✅ | ✅ | ✅ |
| accounts | READ | ✅ | ✅ | ✅ |
| accounts | WRITE | ❌ | ✅ | ✅ |
| accounts | DELETE | ❌ | ❌ | ✅ |
| contacts | READ | ✅ | ✅ | ✅ |
| contacts | WRITE | ✅ | ✅ | ✅ |
| contacts | DELETE | ❌ | ✅ | ✅ |
| opportunities | READ | ✅ | ✅ | ✅ |
| opportunities | WRITE | ✅ | ✅ | ✅ |
| opportunities | DELETE | ❌ | ✅ | ✅ |
| cases | READ | ✅ | ✅ | ✅ |
| cases | WRITE | ✅ | ✅ | ✅ |
| cases | DELETE | ❌ | ✅ | ✅ |
| todos | READ | ✅ | ✅ | ✅ |
| todos | WRITE | ✅ | ✅ | ✅ |
| todos | DELETE | ❌ | ✅ | ✅ |
| stats / ai/chat | USE | ✅ | ✅ | ✅ |
| users | READ/WRITE | ❌ | ❌ | ✅ |
| ai/settings | READ/WRITE | ❌ | ❌ | ✅ |

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

> admin / manager / staff の全ロールがアクセスできる。JWT未存在・期限切れの場合のみ `/login.html` にリダイレクト。

### 7.2 共通レイアウト（CRM業務画面）

```
┌───────────────────────────────────────────────────────────────┐
│  [ロゴ] Demo CRM                  [AI助言] [管理者名] [logout] │
├───────────────┬───────────────────────────┬───────────────────┤
│               │                           │                   │
│ ダッシュボード  │                           │  AI助言           │
│ 取引先企業     │  メインコンテンツエリア      │  サイドパネル      │
│ 担当者         │                           │  （幅300px・開閉） │
│ 商談           │                           │                   │
│ ケース         │                           │                   │
│ ToDo           │                           │                   │
│ ──────────── │                           │                   │  ← セパレータ
│ システム管理 → │                           │                   │  ← admin のみ表示
│               │                           │                   │
└───────────────┴───────────────────────────┴───────────────────┘
```

### 7.3 詳細画面の共通仕様

#### 画面遷移ルール

```
一覧画面
 ├── 「新規作成」ボタン
 │    └── 詳細画面（新規モード）へ遷移
 │         └── フォーム入力 → 「保存」→ 一覧画面へ戻る
 └── 行クリック（レコード名リンク）
      └── 詳細画面（表示モード）へ遷移（URLパラメータ ?id=<id>）
           └── 「編集」ボタン → 同じ詳細画面がインライン編集モードに切り替わる
                └── 「保存」→ 表示モードに戻る / 「キャンセル」→ 表示モードに戻る
```

#### 詳細画面の3モード

| モード | URL例 | 動作 |
|---|---|---|
| 新規作成 | /opportunity-detail.html | URLパラメータなし。フォームが空欄で編集可能状態 |
| 表示 | /opportunity-detail.html?id=5 | 全項目を読み取り専用で表示。「編集」ボタンあり |
| 編集 | /opportunity-detail.html?id=5 | 表示モードから「編集」ボタンで切り替え。全項目が入力可能に |

#### 共通UI要素

- ページ上部にパンくずリスト（例: 商談一覧 > クラウド移行支援PJ）
- 表示モード：右上に「編集」ボタン・「削除」ボタン
- 編集・新規モード：右上に「保存」ボタン・「キャンセル」ボタン
- 削除は確認ダイアログを表示してから実行する
- 保存成功時はトースト通知を表示する

### 7.4 各画面仕様

#### SCR-001 ログイン

- ユーザー名・パスワードの入力フォーム
- 認証成功（全ロール共通）→ `/index.html` へリダイレクト
- 認証失敗（パスワード不一致・アカウント無効）→ エラーメッセージ表示
- JWTはlocalStorageに保存
- リダイレクト後の各画面で、JWT の `role` に応じたアクセス制御を行う（3章参照）

#### SCR-002 ダッシュボード

KPIカード（4枚）：

| KPI | 集計方法 |
|---|---|
| 取引先数 | accounts の総件数 |
| 進行中商談 | stage が closed_won / closed_lost 以外の件数 |
| 今月の受注額 | closed_won かつ close_date が当月の amount 合計 |
| 未解決ケース | status が open / in_progress / pending の件数 |

その他：
- 商談ステージ別件数（横棒グラフ）
- 直近5件の商談
- 直近5件のケース
- 期限切れToDo件数バッジ

#### SCR-003 取引先一覧

- テーブル：企業名 / 業種 / ステータス / 担当者数 / 商談数 / 登録日
- 検索（企業名） / 業種・ステータスフィルター / ページネーション
- 「新規作成」ボタン → `/account-detail.html`（新規モード）へ遷移
- 企業名クリック → `/account-detail.html?id=<id>`（表示モード）へ遷移

#### SCR-004 取引先詳細（/account-detail.html）

**表示・編集エリア（インライン）：**

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

**関連情報タブ（表示モード・編集モード共通）：**

各タブには「新規作成」ボタンを設置し、遷移先の詳細画面に `account_id` を自動セットする。

| タブ | 表示項目 | 行クリック遷移先 | 新規作成遷移先 |
|---|---|---|---|
| 担当者一覧 | 氏名 / 役職 / 部署 / メール / 電話 | `/contact-detail.html?id=<id>` | `/contact-detail.html?account_id=<id>` |
| 商談一覧 | 商談名 / ステージバッジ / 金額 / クローズ予定日 | `/opportunity-detail.html?id=<id>` | `/opportunity-detail.html?account_id=<id>` |
| ケース一覧 | 件名 / ステータスバッジ / 優先度バッジ / 作成日 | `/case-detail.html?id=<id>` | `/case-detail.html?account_id=<id>` |
| ToDo一覧 | タイトル / 担当者 / ステータス / 期限日 | `/todo-detail.html?id=<id>` | `/todo-detail.html?account_id=<id>` |

> 各詳細画面（新規モード）は URLパラメータ `account_id` を受け取った場合、「取引先」フィールドに該当企業を自動セットした状態で開く。

#### SCR-005 担当者一覧

- テーブル：氏名 / 役職 / 部署 / 会社名 / メール / 電話
- 取引先名フィルター / ページネーション
- 「新規作成」ボタン → `/contact-detail.html`（新規モード）へ遷移
- 氏名クリック → `/contact-detail.html?id=<id>`（表示モード）へ遷移

#### SCR-006 担当者詳細（/contact-detail.html）

**表示・編集エリア（インライン）：**

| 項目 | 入力形式 | 必須 |
|---|---|---|
| 姓 | テキスト | ✅ |
| 名 | テキスト | ✅ |
| 会社名 | 検索セレクト（取引先一覧から選択） | - |
| 役職 | テキスト | - |
| 部署 | テキスト | - |
| メール | テキスト | - |
| 電話 | テキスト | - |
| 携帯 | テキスト | - |
| 主要担当者 | チェックボックス | - |
| メモ | テキストエリア | - |

> 「会社名」は `accounts.name` を検索セレクトで選択し、`contacts.account_id` に紐づける。取引先未所属の担当者も登録可能（`account_id = NULL`）。

#### SCR-007 商談一覧

- テーブル：商談名 / 取引先 / 社内担当者 / ステージ / 金額 / 確度 / クローズ予定日
- フィルター：ステージ / 社内担当者
- 金額合計をフッターに表示
- ステージセルのドロップダウンで直接変更可（PUT /api/opportunities/:id）
- 「新規作成」ボタン → `/opportunity-detail.html`（新規モード）へ遷移
- 商談名クリック → `/opportunity-detail.html?id=<id>`（表示モード）へ遷移

#### SCR-008 商談詳細（/opportunity-detail.html）

**表示・編集エリア（インライン）：**

| 項目 | 入力形式 | 必須 |
|---|---|---|
| 商談名 | テキスト | ✅ |
| 取引先 | 検索セレクト（取引先一覧から選択） | - |
| 主要連絡先 | 検索セレクト（選択した取引先の担当者から選択） | - |
| 社内担当者 | セレクト（CRMユーザー一覧） | - |
| ステージ | セレクト | ✅ |
| 金額（円） | 数値 | - |
| 受注確度（%） | 数値 0〜100 | - |
| クローズ予定日 | 日付 | - |
| リードソース | セレクト（web / referral / event / cold_call / email / other） | - |
| キャンペーン | テキスト | - |
| 次のアクション | テキストエリア | - |
| 説明 | テキストエリア | - |

**関連ToDoタブ（表示モード・編集モード共通）：**
- 関連ToDo一覧：タイトル / 担当者 / ステータス / 優先度 / 期限日
- 行クリックで `/todo-detail.html?id=<id>` へ遷移
- 「ToDo新規作成」ボタン → `/todo-detail.html`（新規モード・opportunity_id を自動セット）へ遷移

#### SCR-009 ケース一覧

- テーブル：件名 / 取引先 / 社内担当者 / ステータス / 優先度 / カテゴリー / 対応期限 / 作成日
- フィルター：ステータス / 優先度 / 社内担当者 / カテゴリー
- 優先度バッジ（critical=赤 / high=橙 / medium=黄 / low=緑）
- 「新規作成」ボタン → `/case-detail.html`（新規モード）へ遷移
- 件名クリック → `/case-detail.html?id=<id>`（表示モード）へ遷移

#### SCR-010 ケース詳細（/case-detail.html）

**表示・編集エリア（インライン）：**

| 項目 | 入力形式 | 必須 |
|---|---|---|
| 件名 | テキスト | ✅ |
| 取引先 | 検索セレクト（取引先一覧から選択） | - |
| 問い合わせ元担当者 | 検索セレクト（選択した取引先の担当者から選択） | - |
| 社内担当者 | セレクト（CRMユーザー一覧） | - |
| ステータス | セレクト（open / in_progress / pending / resolved / closed） | ✅ |
| 優先度 | セレクト（low / medium / high / critical） | ✅ |
| カテゴリー | セレクト（technical / billing / general / feature_request / other） | - |
| 問い合わせ経路 | セレクト（email / phone / web / chat / other） | - |
| 対応期限 | 日付 | - |
| 内容 | テキストエリア | - |
| 解決内容 | テキストエリア | - |

**関連ToDoタブ（表示モード・編集モード共通）：**
- 関連ToDo一覧：タイトル / 担当者 / ステータス / 優先度 / 期限日
- 行クリックで `/todo-detail.html?id=<id>` へ遷移
- 「ToDo新規作成」ボタン → `/todo-detail.html`（新規モード・case_id を自動セット）へ遷移

#### SCR-011 ToDo一覧

- テーブル：タイトル / 社内担当者 / 関連商談 / 関連ケース / ステータス / 優先度 / 期限日
- フィルター：ステータス / 優先度 / 担当者 / 関連商談 / 関連ケース / 期限切れのみ
- ステータスセルをクリックするとワンクリックで次のステータスに変更（open → in_progress → done）
- 「新規作成」ボタン → `/todo-detail.html`（新規モード）へ遷移
- タイトルクリック → `/todo-detail.html?id=<id>`（表示モード）へ遷移

#### SCR-012 ToDo詳細（/todo-detail.html）

**表示・編集エリア（インライン）：**

| 項目 | 入力形式 | 必須 |
|---|---|---|
| タイトル | テキスト | ✅ |
| 説明 | テキストエリア | - |
| 社内担当者 | セレクト（CRMユーザー一覧） | - |
| 関連商談 | 検索セレクト（商談一覧から選択・任意） | - |
| 関連ケース | 検索セレクト（ケース一覧から選択・任意） | - |
| ステータス | セレクト（open / in_progress / done / cancelled） | ✅ |
| 優先度 | セレクト（low / medium / high） | ✅ |
| 期限日 | 日付 | - |
| 期限時刻 | 時刻（省略可） | - |

> 商談詳細・ケース詳細からの「ToDo新規作成」遷移時は、`opportunity_id` または `case_id` をURLパラメータで受け取り自動セットする（例: `/todo-detail.html?opportunity_id=5`）。

---

## 8. システム管理画面仕様

### 8.1 画面一覧

| 画面ID | パス | 説明 | 認証 | アクセス権限 |
|---|---|---|---|---|
| SCR-013 | /admin-ui/users.html | ユーザー管理 | 要 | admin のみ |
| SCR-014 | /admin-ui/user-detail.html | ユーザー詳細・新規作成・編集 | 要 | admin のみ |
| SCR-015 | /admin-ui/ai-settings.html | AI接続設定 | 要 | admin のみ |

> `/admin-ui/` 配下に配置し admin のみアクセス可能。JWT の `role` が admin 以外の場合は `/login.html` にリダイレクト。Nginx でも `/admin-ui/` へのアクセスを制御する（11章参照）。

### 8.2 レイアウト

```
┌───────────────────────────────────────────────────────────────┐
│  [ロゴ] Demo CRM  システム管理              [管理者名] [logout] │
├───────────────┬───────────────────────────────────────────────┤
│               │                                               │
│ ユーザー管理   │  メインコンテンツエリア                          │
│ AI接続設定     │  （ユーザー詳細は /admin-ui/user-detail.html）     │
│               │                                               │
│               │                                               │
│ ← CRM業務へ   │                                               │
│               │                                               │
└───────────────┴───────────────────────────────────────────────┘
```

- CRM業務画面とは独立したレイアウト（AI助言サイドパネルなし）
- 「← CRM業務へ」リンク：`/index.html` へ戻る

### 8.3 各画面仕様

#### SCR-013 ユーザー管理（/admin-ui/users.html）

- テーブル：名前 / ユーザー名 / ロール / 有効/無効 / 作成日
- 「新規作成」ボタン → `/admin-ui/user-detail.html`（新規モード）へ遷移
- 名前クリック → `/admin-ui/user-detail.html?id=<id>`（表示モード）へ遷移
- 削除ボタン → 確認ダイアログ後に論理削除（is_active = false）
- adminロール自身の削除は不可

#### SCR-014 ユーザー詳細（/admin-ui/user-detail.html）

CRM業務画面の詳細画面と同様の3モード構成。

| モード | URL例 | 動作 |
|---|---|---|
| 新規作成 | /admin-ui/user-detail.html | 空欄フォームで編集可能状態 |
| 表示 | /admin-ui/user-detail.html?id=3 | 全項目を読み取り専用で表示。「編集」ボタンあり |
| 編集 | /admin-ui/user-detail.html?id=3 | 「編集」ボタン押下でインライン編集に切り替え |

**共通UI要素：**
- パンくず（ユーザー管理 > ユーザー名）
- 表示モード：右上に「編集」「削除」ボタン
- 編集・新規モード：右上に「保存」「キャンセル」ボタン
- 保存成功時はトースト通知
- 削除は確認ダイアログ後に論理削除 → /admin-ui/users.html へ戻る

**フォーム項目：**

| 項目 | 入力形式 | 必須 | 備考 |
|---|---|---|---|
| 名前 | テキスト | ✅ | - |
| ユーザー名 | テキスト | ✅ | - |
| パスワード | パスワード | ✅（新規）/ -（編集） | 編集時は空欄なら変更しない |
| ロール | セレクト（admin / manager / staff） | ✅ | - |
| 有効/無効 | トグル | - | 表示・編集モードのみ |

> ログイン中の自分自身のロールを admin 以外に変更することは不可（UIで制御）。

#### SCR-015 AI接続設定（/admin-ui/ai-settings.html）

- **使用するプロバイダー選択**（ラジオボタン）：使用しない / OpenAI / Dify ✅ v1.2.4追加
- 接続設定タブ：OpenAI / Dify（設定の表示・入力切り替え）
- OpenAI：エンドポイント / APIキー / モデル名 / 最大トークン / システムプロンプト
- Dify：エンドポイント / APIキー
- 接続テストボタン（疎通確認・レイテンシ表示）
- 保存ボタン（選択中のプロバイダーとAPIキーを暗号化してDB保存）
- 注意：`使用しない` 選択時は接続テストボタンが無効になる

---

## 9. AI助言機能仕様

### 9.1 概要

各CRM画面のトップバー右上に「AI助言」ボタンを設置し、クリックで右サイドパネルを開く。  
現在表示中の画面コンテキスト（集計データ）をAIに自動付与することで、CRMデータを踏まえた対話が可能になる。

### 9.2 画面別コンテキスト ✅ v1.2.4変更

各画面で全体サマリー（`GET /api/stats/summary`）に加えて、ページ別の詳細レコードリスト（最大50件）もAIに付与する。

| page値 | 付与されるCRMデータ |
|---|---|
| `dashboard` | 全体サマリー + **商談・ケース・ToDo・取引先・担当者の全データ（最大50件ずつ）** |
| `accounts` | 全体サマリー + 取引先一覧（id・名称・業種・ステータス・売上・担当者数・商談数） |
| `opportunities` | 全体サマリー + 商談一覧（id・名称・取引先・担当者・ステージ・金額・確度・クローズ日） |
| `cases` | 全体サマリー + ケース一覧（id・件名・取引先・担当者・ステータス・優先度・カテゴリー） |
| `todos` | 全体サマリー + ToDo一覧（id・タイトル・担当者・ステータス・優先度・期限日） |
| `contacts` | 全体サマリー + 担当者一覧（id・氏名・所属・役職・部署） |

**AIレスポンスのリンク形式：** AIは回答内でレコードに言及する際、Markdownリンク形式（`[名前](/パス?id=ID)`）で返答する。フロントエンドでクリッカブルなリンクとしてレンダリングされる。

### 9.3 画面別サジェストボタン

| 画面 | サジェスト例 |
|---|---|
| ダッシュボード | 「今月の業績サマリーを教えて」「注目すべき商談は？」「期限切れToDoを整理して」 |
| 商談 | 「受注確度の高い商談を教えて」「リード案件のフォロー優先順位は？」「今月クローズリスクは？」 |
| ケース | 「緊急対応が必要なケースは？」「解決までの平均時間は？」「担当者の負荷状況は？」 |
| ToDo | 「期限切れToDoの対処方針を提案して」「担当者別の負荷バランスは？」「今週完了すべき優先タスクは？」 |
| 取引先 | 「最も取引額の大きい企業は？」「フォローが必要な見込み企業は？」 |
| 担当者 | 「キーパーソンを特定して」「連絡が取れていない担当者は？」 |

### 9.4 LLMプロバイダー別処理

#### OpenAI

```
POST {openai_endpoint}/chat/completions
Authorization: Bearer {openai_api_key}

{
  "model": "{openai_model}",
  "max_tokens": {openai_max_tokens},
  "messages": [
    { "role": "system", "content": "{system_prompt}\n\n# CRMコンテキスト\n{context_json}" },
    ...会話履歴,
    { "role": "user", "content": "{user_message}" }
  ]
}
```

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

### 10.1 ユーザー

| name | username | password | role |
|---|---|---|---|
| 管理者 | admin | admin1234 | admin |
| 田中マネージャー | tanaka | pass1234 | manager |
| 鈴木スタッフ | suzuki | pass1234 | staff |
| 佐藤スタッフ | sato | pass1234 | staff |

> manager / staff はCRM業務画面（ダッシュボード・取引先・担当者・商談・ケース・ToDo）にログインして利用できる。システム管理画面（ユーザー管理・AI設定）は admin のみ。

### 10.2 取引先企業（10社）

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

### 10.3 担当者（20名）

各企業2名ずつ投入。役職・部署をランダム配布。

### 10.4 商談（20件）

各ステージに均等分散。金額は50万〜5000万円。  
社内担当者は admin / tanaka / suzuki / sato をランダム割り当て。  
クローズ予定日は過去〜3ヶ月先。

### 10.5 ケース（30件）

- ステータス分布：open 40% / in_progress 30% / pending 10% / resolved 15% / closed 5%
- 優先度分布：critical 10% / high 25% / medium 45% / low 20%
- カテゴリー・問い合わせ経路はランダム
- 社内担当者はCRMユーザーをランダム割り当て

### 10.6 ToDo（30件）

- 商談に紐付き：10件
- ケースに紐付き：10件
- 両方に紐付き：5件
- 独立ToDo：5件
- ステータス分布：open 40% / in_progress 30% / done 20% / cancelled 10%
- 優先度分布：high 30% / medium 50% / low 20%
- 社内担当者はCRMユーザーをランダム割り当て
- うち5件は due_date が過去（期限切れ）

### 10.7 AI設定初期値

`ai_settings` に provider=`none` のレコードを1件挿入（未設定状態）。

---

## 11. Docker構成仕様

### 11.1 docker-compose.yml

```yaml
version: "3.9"

services:
  db:
    image: postgres:16-alpine
    container_name: crm_db
    restart: unless-stopped
    env_file: .env                        # .env から POSTGRES_* を読み込む
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10

  api:
    build: ./api
    container_name: crm_api
    restart: unless-stopped
    env_file: .env                        # .env から全変数を読み込む
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy

  frontend:
    image: nginx:alpine
    container_name: crm_frontend
    restart: unless-stopped
    volumes:
      - ./frontend/public:/usr/share/nginx/html:ro
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    ports:
      - "8080:80"
    depends_on:
      - api

volumes:
  pgdata:
```

> **`.env` がない場合は起動しない。** `docker compose up` 前に必ず `cp .env.example .env` を実行すること。

### 11.2 Nginx設定

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index login.html;

    location / {
        try_files $uri $uri/ /login.html;
    }

    # システム管理画面（/admin-ui/ 配下）
    # ファイルは配信するが、アクセス制御はフロントエンドのJWT roleチェックで行う
    location /admin-ui/ {
        try_files $uri $uri/ /login.html;
    }

    location /api/ {
        proxy_pass http://crm_api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 11.3 Dockerfile（API）

```dockerfile
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

### 11.4 起動・停止コマンド

```bash
docker compose up -d --build   # 起動
docker compose logs -f api     # ログ確認
docker compose down            # 停止
docker compose down -v         # データ含めて完全削除
```

---

## 12. Metabase連携仕様

### 12.1 localtonet設定

```bash
./localtonet authtoken <YOUR_TOKEN>
./localtonet tcp 5432
# → TCP: tcp.localto.net:XXXXX → localhost:5432
```

### 12.2 Metabase DB接続設定

| 項目 | 値 |
|---|---|
| データベースの種類 | PostgreSQL |
| ホスト | tcp.localto.net |
| ポート | XXXXX（localtonetが発行した番号） |
| データベース名 | crmdb |
| ユーザー名 | crmuser |
| パスワード | crmpassword |

### 12.3 Metabaseダッシュボード案

| カード名 | 種類 | クエリ概要 |
|---|---|---|
| 商談パイプライン（ステージ別件数） | 棒グラフ | opportunities GROUP BY stage |
| 商談パイプライン（ステージ別金額） | 棒グラフ | SUM(amount) GROUP BY stage |
| 月別受注額推移 | 折れ線グラフ | closed_won の close_date 月別集計 |
| 業種別取引先数 | 円グラフ | accounts GROUP BY industry |
| ケースステータス分布 | ドーナツグラフ | cases GROUP BY status |
| ケースカテゴリー分布 | 棒グラフ | cases GROUP BY category ✅追加 |
| 担当者別商談数 | テーブル | opportunities JOIN users GROUP BY owner |
| 優先度別未解決ケース数 | 棒グラフ | cases WHERE status!=closed GROUP BY priority |
| ToDo完了率（担当者別） | テーブル | todos GROUP BY assignee_id ✅追加 |
| 期限切れToDo一覧 | テーブル | todos WHERE due_date < now AND status != done ✅追加 |

---

## 13. ファイル構成

```
crm-demo/
├── docker-compose.yml
├── .env.example
│
├── db/
│   └── init.sql                    # DDL（todos, ai_settings含む全テーブル）
│
├── api/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   ├── swagger.js              # OpenAPI定義（swagger-jsdoc）
│   ├── middleware/
│   │   ├── auth.js                 # JWT検証（全ロール）+ システム管理系エンドポイントのadminチェック
│   │   └── role.js                 # ロール認可（将来拡張用）
│   ├── routes/
│   │   ├── auth.js                 # login（全ロールにJWT発行）
│   │   ├── users.js
│   │   ├── accounts.js
│   │   ├── contacts.js
│   │   ├── opportunities.js        
│   │   ├── cases.js                # フィールド拡充 ✅変更
│   │   ├── todos.js                # ToDo CRUD ✅追加
│   │   ├── stats.js                # todos集計追加 ✅変更
│   │   └── ai.js                   # /api/ai に一本化・requireAdmin をルーター内で制御 ✅変更
│   ├── services/
│   │   ├── openai.js               # max_completion_tokens対応 / エラー詳細化 ✅変更
│   │   ├── dify.js
│   │   └── crypto.js
│   ├── db/
│   │   └── pool.js
│   ├── boot/
│   │   └── syncAiSettings.js       # 起動時に.envのAI設定をDBに同期 ✅追加
│   └── seed/
│       └── seed.js                 # todos シードデータ追加 ✅変更
│
├── frontend/
│   └── public/
│       ├── login.html
│       ├── index.html
│       ├── accounts.html
│       ├── account-detail.html
│       ├── contacts.html
│       ├── contact-detail.html     # 担当者詳細・新規作成・編集 ✅追加
│       ├── opportunities.html
│       ├── opportunity-detail.html  # 商談詳細・新規作成・編集 ✅追加
│       ├── cases.html
│       ├── case-detail.html        # ケース詳細・新規作成・編集 ✅追加
│       ├── todos.html
│       ├── todo-detail.html        # ToDo詳細・新規作成・編集 ✅追加
│       ├── admin-ui/
│       │   ├── users.html          # ユーザー管理一覧
│       │   ├── user-detail.html    # ユーザー詳細・新規作成・編集 ✅追加
│       │   └── ai-settings.html    # AI接続設定
│       ├── css/
│       │   └── style.css
│       └── js/
│           ├── api.js
│           ├── auth.js             # JWT有効チェック（CRM業務画面）/ adminロールチェック（システム管理画面）
│           ├── ai-panel.js         # コンテキスト強化・Markdownリンクレンダリング ✅変更
│           └── utils.js
│
└── nginx/
    ├── default.conf                # Swagger UI Basic認証・^~優先マッチ ✅変更
    ├── gen-htpasswd.sh             # .htpasswd生成スクリプト（Linux/Mac用） ✅追加
    └── gen-htpasswd.ps1            # .htpasswd生成スクリプト（PowerShell用） ✅追加
```

---

## 付録：開発実装順序（SDDフロー）

```
Phase 1: DB層
  └─ db/init.sql 作成（todos, ai_settings含む全テーブル）
  └─ docker compose up db → スキーマ確認

Phase 2: API基盤
  └─ server.js + db/pool.js
  └─ middleware/auth.js（JWT検証 + システム管理系エンドポイントのadminチェック実装）
  └─ POST /api/auth/login（全ロールにJWT発行）動作確認

Phase 3: 各エンドポイント実装
  └─ accounts → contacts → opportunities
  └─ cases（フィールド拡充）→ todos（新規）→ users → stats

Phase 4: AI連携実装
  └─ services/crypto.js → services/openai.js → services/dify.js
  └─ routes/ai.js（settings / chat / test）

Phase 5: シードデータ
  └─ seed/seed.js 実装・投入確認（todos含む）

Phase 6: フロントエンド
  └─ login.html（全ロール通過）
  └─ auth.js（CRM業務画面：JWT有効チェックのみ / システム管理画面：adminロールチェック追加）
  └─ index.html → accounts → contacts → opportunities
  └─ cases（拡充フィールドUI）→ todos.html（新規）
  └─ users / ai-settings / ai-panel.js

Phase 7: Swagger UI Basic認証セットアップ
  └─ nginx/gen-htpasswd.ps1（またはgen-htpasswd.sh）で nginx/.htpasswd 生成
  └─ docker compose up -d で起動

Phase 8: localtonet + Metabase接続テスト
```

---

*本仕様書はSDD（Specification-Driven Development）に基づき、実装前に全仕様を定義したものです。*  
*実装はこの仕様書をそのまま入力として使用し、コード生成を行います。*
