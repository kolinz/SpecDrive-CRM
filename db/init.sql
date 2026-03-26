-- ============================================================
-- Demo CRM — db/init.sql
-- PostgreSQL 16 / 冪等性: CREATE TABLE IF NOT EXISTS
-- ============================================================

-- ------------------------------------------------------------
-- 1. users（ユーザー）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  username      VARCHAR(100)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  role          VARCHAR(20)   NOT NULL DEFAULT 'staff',
                -- 'admin' | 'manager' | 'staff'
  is_active     BOOLEAN       NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2. accounts（取引先企業）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(255)  NOT NULL,
  industry       VARCHAR(100),
  website        VARCHAR(255),
  phone          VARCHAR(50),
  address        TEXT,
  annual_revenue NUMERIC(15,2),
  employee_count INTEGER,
  status         VARCHAR(20)   NOT NULL DEFAULT 'active',
                 -- 'active' | 'inactive' | 'prospect'
  notes          TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 3. contacts（担当者・従業員）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
  id           SERIAL PRIMARY KEY,
  account_id   INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  first_name   VARCHAR(100)  NOT NULL,
  last_name    VARCHAR(100)  NOT NULL,
  email        VARCHAR(255),
  phone        VARCHAR(50),
  mobile       VARCHAR(50),
  title        VARCHAR(100),
  department   VARCHAR(100),
  is_primary   BOOLEAN       NOT NULL DEFAULT false,
  notes        TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 4. opportunities（商談）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opportunities (
  id           SERIAL PRIMARY KEY,
  account_id   INTEGER REFERENCES accounts(id)  ON DELETE SET NULL,
  owner_id     INTEGER REFERENCES users(id)     ON DELETE SET NULL,
               -- 社内担当者（CRMユーザー）
  contact_id   INTEGER REFERENCES contacts(id)  ON DELETE SET NULL,
               -- 主要連絡先（取引先担当者）
  name         VARCHAR(255)  NOT NULL,
  stage        VARCHAR(50)   NOT NULL DEFAULT 'prospecting',
               -- 'prospecting' | 'qualification' | 'proposal'
               -- | 'negotiation' | 'closed_won' | 'closed_lost'
  amount       NUMERIC(15,2),
  probability  INTEGER CHECK (probability BETWEEN 0 AND 100),
  close_date   DATE,
  lead_source  VARCHAR(100),
               -- 'web' | 'referral' | 'event' | 'cold_call' | 'email' | 'other'
  campaign     VARCHAR(255),
  next_step    TEXT,
  description  TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 5. cases（ケース・サポート）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cases (
  id           SERIAL PRIMARY KEY,
  account_id   INTEGER REFERENCES accounts(id)  ON DELETE SET NULL,
  contact_id   INTEGER REFERENCES contacts(id)  ON DELETE SET NULL,
               -- 問い合わせ元の取引先担当者
  assigned_to  INTEGER REFERENCES users(id)     ON DELETE SET NULL,
               -- 社内担当者（CRMユーザー）
  subject      VARCHAR(255)  NOT NULL,
  description  TEXT,
  status       VARCHAR(20)   NOT NULL DEFAULT 'open',
               -- 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed'
  priority     VARCHAR(20)   NOT NULL DEFAULT 'medium',
               -- 'low' | 'medium' | 'high' | 'critical'
  category     VARCHAR(100),
               -- 'technical' | 'billing' | 'general' | 'feature_request' | 'other'
  origin       VARCHAR(50),
               -- 'email' | 'phone' | 'web' | 'chat' | 'other'
  resolution   TEXT,
  resolved_at  TIMESTAMPTZ,
  due_date     DATE,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 6. todos（ToDo）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS todos (
  id             SERIAL PRIMARY KEY,
  title          VARCHAR(255)  NOT NULL,
  description    TEXT,
  assignee_id    INTEGER REFERENCES users(id)          ON DELETE SET NULL,
                 -- 社内担当者（CRMユーザー）。未指定可
  opportunity_id INTEGER REFERENCES opportunities(id)  ON DELETE SET NULL,
                 -- 関連商談（任意）
  case_id        INTEGER REFERENCES cases(id)          ON DELETE SET NULL,
                 -- 関連ケース（任意）
  status         VARCHAR(20)   NOT NULL DEFAULT 'open',
                 -- 'open' | 'in_progress' | 'done' | 'cancelled'
  priority       VARCHAR(20)   NOT NULL DEFAULT 'medium',
                 -- 'low' | 'medium' | 'high'
  due_date       DATE,
  due_time       TIME,
  completed_at   TIMESTAMPTZ,
  created_by     INTEGER REFERENCES users(id)          ON DELETE SET NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_todos_assignee    ON todos(assignee_id);
CREATE INDEX IF NOT EXISTS idx_todos_opportunity ON todos(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_todos_case        ON todos(case_id);
CREATE INDEX IF NOT EXISTS idx_todos_due_date    ON todos(due_date);

-- ------------------------------------------------------------
-- 7. ai_settings（AI接続設定・シングルトン）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_settings (
  id                   INTEGER PRIMARY KEY DEFAULT 1,
  provider             VARCHAR(20)   NOT NULL DEFAULT 'none',
                       -- 'none' | 'openai' | 'dify'
  openai_endpoint      VARCHAR(500)  DEFAULT 'https://api.openai.com/v1',
  openai_api_key       TEXT,
                       -- 暗号化済みで保存
  openai_model         VARCHAR(100)  DEFAULT 'gpt-4o',
  openai_max_tokens    INTEGER       DEFAULT 2048,
  openai_system_prompt TEXT,
  dify_endpoint        VARCHAR(500),
  dify_api_key         TEXT,
                       -- 暗号化済みで保存
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT singleton CHECK (id = 1)
);

-- 初期レコード（未設定状態）
INSERT INTO ai_settings (id, provider)
VALUES (1, 'none')
ON CONFLICT DO NOTHING;
