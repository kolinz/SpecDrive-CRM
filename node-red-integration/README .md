# Node-RED × SpecDrive CRM 連携デモ 手順書
 
**作成日:** 2026-04-20  
**構成:** AWS Lightsail（CRM）× Windows Docker（Node-RED）
 
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
2. 右上メニュー → **パレットの管理**
3. **ノードを追加** タブで `@flowfuse/node-red-dashboard` を検索
4. **インストール**
---

## フローのインポート

### 2-1. サンプルファイルのダウンロード

下記をダウンロードします。

[SpecDriveCRM-Node-RED-Integration-flows.json](node-red-integration/SpecDriveCRM-Node-RED-Integration-flows.json)

### 2-2. サンプルファイルをNode-REDにインポート

1. `http://localhost:1880` を開く
2. 右上メニュー → **IMPORT**
3. 





