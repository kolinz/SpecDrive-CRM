# SpecDrive CRM

Docker Compose で起動する CRM（顧客関係管理）デモシステムです。開発手法として、「Spec-Driven Development（仕様駆動開発）」を採用しています。SDDのためのドキュメントは、下記３つになります。

---
## SDD（仕様駆動開発）のためのドキュメント
| ドキュメント | 説明 |
|---|---|
| [システム仕様書 v1.2.4](docs/crm-sdd-spec-v1_2_4.md) | アーキテクチャ・データモデル・API・画面仕様の全詳細 |
| [実装プロンプト集 v1.2.4](docs/crm-impl-prompts-v1_2_4.md) | AI コーディングアシスタント向け実装プロンプト |
| [プロジェクトプロンプト v1.2.4](docs/project-prompt-v1_2_4.md) | 生成AIで実装する際に用いるシステムプロンプトのこと |
---
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

![ダッシュボード画面](docs/thumbnail-dashboard.png "サンプル")
---

## 機能

| 機能 | 概要 |
|---|---|
| 取引先企業管理 | 企業情報の CRUD |
| 担当者管理 | 企業に属する連絡先の CRUD |
| 商談管理 | パイプライン・ステージ管理 |
| ケース管理 | サポートチケット管理 |
| ToDo 管理 | 商談・ケース両対応のタスク管理 |
| ダッシュボード | 取引先数・進行中商談数・今月の受注額・未解決ケースを表示 |
| ユーザー管理 | CRM 利用者のアカウント管理（admin のみ） |
| AI 助言 | 各画面で LLM と対話し CRM データを分析 |
| REST API | Metabase 等の外部ツールからのデータアクセス |
| Swagger UI | `http://localhost:3000/api-docs` で API 仕様を確認 |

### ロールとアクセス権限

| ロール | CRM 業務画面 | システム管理画面 |
|---|---|---|
| admin | ✅ | ✅ |
| manager | ✅ | ❌ |
| staff | ✅ | ❌ |

## ロール別操作権限
staff と manager の主な違いは削除権限です。staff は全リソースで削除ができませんが、manager は担当者・商談・ケース・ToDo を削除できます。取引先の削除は admin 専権です。
| リソース | staff | manager | admin |
|---|:---:|:---:|:---:|
| 取引先（accounts）READ | ✅ | ✅ | ✅ |
| 取引先（accounts）WRITE | ❌ | ✅ | ✅ |
| 取引先（accounts）DELETE | ❌ | ❌ | ✅ |
| 担当者（contacts）READ | ✅ | ✅ | ✅ |
| 担当者（contacts）WRITE | ✅ | ✅ | ✅ |
| 担当者（contacts）DELETE | ❌ | ✅ | ✅ |
| 商談（opportunities）READ | ✅ | ✅ | ✅ |
| 商談（opportunities）WRITE | ✅ | ✅ | ✅ |
| 商談（opportunities）DELETE | ❌ | ✅ | ✅ |
| ケース（cases）READ | ✅ | ✅ | ✅ |
| ケース（cases）WRITE | ✅ | ✅ | ✅ |
| ケース（cases）DELETE | ❌ | ✅ | ✅ |
| ToDo READ | ✅ | ✅ | ✅ |
| ToDo WRITE | ✅ | ✅ | ✅ |
| ToDo DELETE | ❌ | ✅ | ✅ |
| ユーザー管理（users）| ❌ | ❌ | ✅ |
| AI接続設定（ai/settings）| ❌ | ❌ | ✅ |
| システム管理画面（/admin-ui/）| ❌ | ❌ | ✅ |

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | HTML / CSS / Vanilla JS |
| Web サーバー | Nginx alpine |
| バックエンド API | Node.js 24.x + Express |
| データベース | PostgreSQL 16 |
| 認証 | JWT（HS256）+ bcryptjs |
| API 仕様書 | swagger-ui-express + swagger-jsdoc |
| コンテナ | Docker Compose v3.9 |

---

## 必要環境

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)（または Docker Engine + Docker Compose v2）
- Git
- PowerShell（Windows 標準搭載。macOS / Linux は [PowerShell Core](https://github.com/PowerShell/PowerShell) をインストール）

---

## クイックスタート

### 1. リポジトリをクローン

```bash
git clone https://github.com/kolinz/SpecDrive-CRM.git
cd cd SpecDrive-CRM
```

### 2. 環境変数ファイルを作成
#### Windows環境
```PowerShell
copy .\env.example .env
```
#### macOS / Linux
```bash
cp .\env.example .env
```

デフォルト設定のままでも動作します。AI 助言機能を使う場合は `.env` を編集して API キーを設定してください（後述）。

### 3. Swagger UI 用の認証ファイルを生成

Swagger UI（`/api-docs`）は Basic 認証で保護されています。  
Nginx にマウントする `.htpasswd` ファイルを、付属のスクリプトで生成します。

```powershell(Windows環境)
# スクリプトの実行ポリシーを一時的に緩和してから実行
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; .\nginx\gen-htpasswd.ps1
```

> **Linux の場合：**  
> `htpasswd` コマンドが利用できる環境（Apache Tools など）では以下でも生成できます。  
> ```bash
> sudo apt-get install -y apache2-utils
> htpasswd -cb nginx/.htpasswd admin admin1234
> ```

### 4. 起動

```powershell
# ファイルマウントを確実に反映するため down → up の順で起動する
docker compose down
docker compose up -d
```

初回起動時はイメージのビルドとサンプルデータの自動投入が行われます（数分かかる場合があります）。

### 5. ブラウザでアクセス

| URL | 説明 |
|---|---|
| http://localhost:8080 | CRM 管理画面 |
| http://localhost:3000/api-docs | Swagger UI（Basic 認証あり） |

> **Swagger UI の Basic 認証：**  
> ユーザー名・パスワードは `nginx/gen-htpasswd.ps1` スクリプト内で設定した値を使用してください。

### 6. ログイン

| ユーザー名 | パスワード | ロール |
|---|---|---|
| `admin` | `admin1234` | 管理者（全機能） |
| `tanaka` | `pass1234` | マネージャー |
| `suzuki` | `pass1234` | スタッフ |
| `sato` | `pass1234` | スタッフ |

---

## AI 助言機能の設定（オプション）

各 CRM 画面の右上「AI 助言」ボタンから LLM と対話できます。

### OpenAI を使う場合

`.env` の以下の行を編集してください。

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
```

### Dify を使う場合

```env
AI_PROVIDER=dify
DIFY_API_KEY=your-dify-api-key
DIFY_ENDPOINT=https://api.dify.ai/v1
```

設定変更後は `docker compose restart api` で API を再起動してください。  
管理画面（`システム管理 > AI 接続設定`）から起動後に設定を変更することも可能です。

---

## よく使うコマンド

```powershell(Windows環境)
# 初回・設定変更後の起動（htpasswd 生成 → down → up）
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; .\nginx\gen-htpasswd.ps1
docker compose down
docker compose up -d

# ログ確認
docker compose logs -f api

# 停止
docker compose down

# データも含めて完全削除
docker compose down -v

# サンプルデータを再投入（データを一度削除してから起動）
docker compose down -v
docker compose up -d
```

---

## ポート一覧

| サービス | 外部ポート | 用途 |
|---|---|---|
| crm_frontend | 8080 | CRM 管理画面 |
| crm_api | 3000 | REST API / Swagger UI |
| crm_db | 5432 | PostgreSQL（Metabase 接続用） |

---

## プロジェクト構成

```
demo-crm/
├── docker-compose.yml
├── .env.example
├── db/
│   └── init.sql              # DDL（全テーブル定義）
├── api/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   ├── swagger.js
│   ├── middleware/           # JWT 認証・ロール認可
│   ├── routes/               # 各エンドポイント
│   ├── services/             # OpenAI / Dify / 暗号化
│   ├── db/
│   │   └── pool.js
│   └── seed/
│       └── seed.js           # サンプルデータ
├── frontend/
│   └── public/
│       ├── login.html
│       ├── index.html        # ダッシュボード
│       ├── accounts.html     # 取引先一覧
│       ├── contacts.html     # 担当者一覧
│       ├── opportunities.html # 商談一覧
│       ├── cases.html        # ケース一覧
│       ├── todos.html        # ToDo 一覧
│       ├── *-detail.html     # 各詳細・新規作成・編集画面
│       ├── admin-ui/         # システム管理画面（admin のみ）
│       ├── css/
│       └── js/
├── nginx/
│   ├── default.conf
│   └── gen-htpasswd.ps1      # Swagger UI 用 Basic 認証ファイル生成スクリプト
└── docs/
    ├── crm-impl-prompts-v1.2.4.md # 実装プロンプト集
    ├── crm-sdd-spec-v1.2.4.md     # システム仕様書
    └── project-prompt-v1.2.4.md # プロジェクトプロンプト
```

## ライセンス

[MIT License](LICENSE)
