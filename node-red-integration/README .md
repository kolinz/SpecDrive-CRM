# Node-RED × SpecDrive CRM 連携デモ 手順書
 
**作成日:** 2026-04-20  
**構成:** API連携によるハイブリッドクラウドデモ。AWS Lightsail（CRM）× オンプレミスサーバー or PC内Docker（Node-RED）。
 
---
 
## 構成概要
 
```
┌─ AWS Lightsail（パブリッククラウド）──┐     ┌─ オンプレミス（Windows）──────────┐
│                                     │     │                                  │
│  SpecDrive CRM                      │     │  Node-RED (Docker)               │
│  - Nginx      :8080                 │←────│  - 定期取得フロー（5分ごと）       │
│  - API        :3000                 │HTTP │  - FlowFuse Dashboard 表示       │
│  - PostgreSQL :5432                 │     │  - HTTP エンドポイント公開        │
│                                     │     │                                  │
└──────────────────────────────────-──┘     └──────────────────────────────────┘
```
 
---
 
## 前提条件
 
| 項目 | 内容 |
|---|---|
| CRM の URL | `http://IPアドレスまたは独自名:3000` |
| Swagger UI | `http://IPアドレスまたは独自名:3000/api-docs` |
| Node-RED | `http://localhost:1880` |
| Dashboard | `http://localhost:1880/dashboard` |

---
 
## Phase 1: Node-RED のセットアップ
 
### 1-1. Docker で Node-RED 起動（永続化あり）
 
```powershell
docker volume create node_red_data
docker run -d `
  -p 1880:1880 `
  -v node_red_data:/data `
  --name node-red `
  --restart unless-stopped `
  nodered/node-red
```
 
> **重要:** `-v node_red_data:/data` がないとコンテナ再起動時にフロー・インストール済みノードが消える。
 
### 1-2. FlowFuse Dashboard のインストール
 
1. `http://localhost:1880` を開く
2. 右上メニュー → **Manage Palettes** をクリック
3. **ノードを追加** タブで `@flowfuse/node-red-dashboard` を検索
4. **インストール**
---

## フローのインポートと動作確認

### 2-1. サンプルファイルのダウンロード

下記をダウンロードします。

[SpecDriveCRM-Node-RED-Integration-flows.json](SpecDriveCRM-Node-RED-Integration-flows.json)

### 2-2. サンプルファイルをNode-REDにインポート

1. `http://localhost:1880` を開く
2. 右上メニュー → **Import** をクリック
3. `Import nodes`画面で、`select a file to import`ボタンをクリックして、サンプルファイルである `SpecDriveCRM-Node-RED-Integration-flows.json` を読み込む
4. `Import`ボタンをクリック
5. `Import Copy`をクリック
6. `SpecDriveCRM 連携デモ`タブができる。
7. `SpecDriveCRM 連携デモ`タブをクリック。

<img src="https://github.com/kolinz/SpecDrive-CRM/blob/main/node-red-integration/flow-image.png" width="90%" />
   
### 動作確認

1. `POSTログイン`ノード（Node-REDの画面の箱状のもの）内のURLの値が、SpecDrive CRMの接続先情報なので、IPアドレスや独自ドメイン名に書き換えます。
2. `GET opportunities（商談取得）`ノード内のURLの値が、SpecDrive CRMの接続先情報なので、IPアドレスや独自ドメイン名に書き換えます。
3. `GET opportunities（商談取得）`ノード内のURLの値が、SpecDrive CRMの接続先情報なので、IPアドレスや独自ドメイン名に書き換えます。
4. 画面右上の`Deploy`をクリックします。
5. 画面左上の`timestamp`ノードの左隣のボタンをクリック。
6. `http://localhost:1880/dashboard`を開く。
7. 5分おきに自動更新される。

<img src="https://github.com/kolinz/SpecDrive-CRM/blob/main/node-red-integration/node-red-dashboard-image.png" width="90%" />




