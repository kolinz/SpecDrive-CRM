# パブリッククラウド上のBIツール × オンプレミス or PC内のSpecDrive CRM 連携デモ 手順書

**対象:** SpecDrive CRM — Metabase 連携セットアップ  
**更新日:** 2026-04-19

---

## 前提条件

- SpecDrive CRM が オンプレミスまたはPC内で`docker compose up -d` で起動済みであること。
- トンネルサービスの[localtonet](https://localtonet.com/)のアカウントが作成済みであること。localtonetのトップページから、`Get Started Free`でアカウント作成ができます。
- localtonetのアプリケーションがPCにインストール済みであること。
  - localtonetアプリの[ダウンロード](https://localtonet.com/download)

---

## 起動手順

### 1. オンプレミスまたはPC内で、SpecDrive CRM を起動

こちらの[README](https://github.com/kolinz/SpecDrive-CRM/blob/main/README.md)を参照のこと。

### 2. localtonet を TCP Tunnelの作成とトンネルの起動

#### 2-1. TCP Tunnelの作成

1. Webブラウザで[localtonet](https://localtonet.com/)にアクセスします。
2. 画面右上の`Dashbaord`をクリックします。
3. ログインします。
4. 画面左側の`My Tokens`をクリックします。
5. DefaultのToken値をコピーします。メモアプリなどに転記しましょう。
6. 画面左側の`My Tunnels`をクリックします。
7. `TCP-UDP`をクリックします。
8. `Create TCP-UDP Tunnel`をクリックします。
9. `Port`に、5432 を入力します。
10. `Create`をクリックします

##### 2-2. localtonet アプリの起動

オンプレミスサーバーまたはPCにインストールした、localtonetのアプリケーションを起動します。

`Please Enter AuthToken or PIN`が表示されるので、先ほどメモしておいた、Token値をコピーして貼り付け、Enterキーを押します。

```
 [ Session Status: Connected ]

                IP/Url                  Protocol         Client IP          Client Port           Ping        Status
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
         Default (Logout F12)                                                                                  Free
```

##### 2-3. Webブラウザ上で、TCP-UDP Tunnelの起動

1. localtonetのDashboardに戻ります。
2. 画面左側の`My Tunnels`をクリックします。
3. `TCP-UDP`をクリックします。
4. 作成済みのTCP Tunnelを起動します。緑色の▶アイコンをクリックすれば起動開始です。

##### 2-4. localtonetアプリで起動確認

表示されたホスト名（例: `ksotptccvs.localto.net`）とポート番号（例: `8310`）を控えます。

```
[ Session Status: Connected ]

                    IP/Url                     Protocol        Client IP        Client Port         Ping      Status
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
         ksotptccvs.localto.net:8310           TCP             127.0.0.1        5432                7           OK

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
             Default (Logout F12)                                                                              Free
```

> **注意:** ホスト名とポートはセッションごとに変わります。毎回確認してください。

### 3. パブリッククラウド(例 AWS Lightsail)上で、BIツールのMetabaseを起動

```bash
docker run -d \
  -p 3000:3000 \
  --name metabase \
  metabase/metabase
```

ブラウザで `http://localhost:3000` にアクセスします。

---

## Metabase DB 接続設定

Metabase 管理画面で以下の手順で設定します。

**設定場所:** 管理 → データベース → データベースを追加（または既存DBを編集）

| 項目 | 値 |
|---|---|
| データベースの種類 | PostgreSQL |
| ホスト | 今回のセッションのホスト名（例: `ksotptccvs.localto.net`） |
| ポート | 今回のセッションのポート番号（例: `8310`） |
| データベース名 | `crmdb` |
| ユーザー名 | `crmuser` |
| パスワード | `crmpassword` |

> `.env` でデフォルト値から変更している場合は、変更後の値を使用してください。

---

## 接続確認（任意）

Metabase で接続する前に[pgAdmin](https://www.pgadmin.org/)で事前確認すると、トラブル時の切り分けがしやすくなります。

| 項目 | 値 |
|---|---|
| ホスト | 今回のセッションのホスト名（例: `ksotptccvs.localto.net`） |
| ポート | 今回のセッションのポート番号（例: `8310`） |
| データベース名 | `crmdb` |
| ユーザー名 | `crmuser` |
| パスワード | `crmpassword` |
---

## ダッシュボード構成案

| カード名 | 種類 | クエリ概要 |
|---|---|---|
| 商談パイプライン（件数） | 棒グラフ | `SELECT stage, COUNT(*) FROM opportunities GROUP BY stage` |
| 商談パイプライン（金額） | 棒グラフ | `SELECT stage, SUM(amount) FROM opportunities GROUP BY stage` |
| 月別受注額推移 | 折れ線グラフ | `closed_won` かつ `close_date` を月別集計 |
| 業種別取引先数 | 円グラフ | `SELECT industry, COUNT(*) FROM accounts GROUP BY industry` |
| ケースステータス分布 | ドーナツグラフ | `SELECT status, COUNT(*) FROM cases GROUP BY status` |
| ケースカテゴリー分布 | 棒グラフ | `SELECT category, COUNT(*) FROM cases GROUP BY category` |
| 担当者別商談数 | テーブル | `opportunities JOIN users GROUP BY owner_id` |
| 優先度別未解決ケース数 | 棒グラフ | `WHERE status != 'closed' GROUP BY priority` |
| ToDo完了率（担当者別） | テーブル | `SELECT assignee_id, ... FROM todos GROUP BY assignee_id` |
| 期限切れToDo一覧 | テーブル | `WHERE due_date < NOW() AND status != 'done'` |

---

## 注意事項

### localtonet の再起動時
セッションが切れて再起動した場合、ホスト名とポートが変わります。  
Metabase の接続設定を以下の手順で更新してください。

1. Metabase 管理画面 → データベース → 該当DB を選択
2. ホスト名とポートを新しい値に更新して保存

### 起動順序
Metabase がデータを取得するタイミングで localtonet が落ちていると接続エラーになります。  
**必ず localtonet を先に起動してから Metabase を操作してください。**

### 無料プランの制限
localtonet の無料プランはセッション時間に制限がある場合があります。  
長時間のデモには有料プランの使用を検討してください。

### セキュリティ
このデモ構成では PostgreSQL のポートをインターネットに公開します。  
デモ終了後は localtonet を停止することを推奨します。
