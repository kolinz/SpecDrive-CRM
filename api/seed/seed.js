const bcrypt = require('bcryptjs');
const pool   = require('../db/pool');

// ============================================================
// ユーティリティ
// ============================================================
const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rInt  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const daysFromNow = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const pastDate = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
};

// ============================================================
// マスターデータ
// ============================================================
const TITLES      = ['部長', '課長', '主任', '担当', 'マネージャー', 'シニアスタッフ'];
const DEPARTMENTS = ['営業部', '技術部', '管理部', '企画部', '開発部', 'カスタマーサポート部'];
const STAGES      = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
const LEAD_SRCS   = ['web', 'referral', 'event', 'cold_call', 'email', 'other'];
const CATEGORIES  = ['technical', 'billing', 'general', 'feature_request', 'other'];
const ORIGINS     = ['email', 'phone', 'web', 'chat', 'other'];

// ============================================================
// メイン
// ============================================================
async function runSeed() {
  if (process.env.SEED_DATA !== 'true') return;

  // 冪等性チェック
  const check = await pool.query('SELECT COUNT(*) FROM users');
  if (parseInt(check.rows[0].count) > 0) {
    console.log('[Seed] Data already exists. Skipping.');
    return;
  }

  console.log('[Seed] Inserting sample data...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ----------------------------------------------------------
    // 1. ユーザー（4名）
    // ----------------------------------------------------------
    const usersData = [
      { name: '管理者',           username: 'admin',  password: 'admin1234', role: 'admin'   },
      { name: '田中マネージャー', username: 'tanaka', password: 'pass1234',  role: 'manager' },
      { name: '鈴木スタッフ',     username: 'suzuki', password: 'pass1234',  role: 'staff'   },
      { name: '佐藤スタッフ',     username: 'sato',   password: 'pass1234',  role: 'staff'   },
    ];

    const userIds = [];
    for (const u of usersData) {
      const hash = await bcrypt.hash(u.password, 10);
      const res  = await client.query(
        `INSERT INTO users (name, username, password_hash, role)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [u.name, u.username, hash, u.role]
      );
      userIds.push(res.rows[0].id);
    }

    // ----------------------------------------------------------
    // 2. 取引先企業（10社）
    // ----------------------------------------------------------
    const accountsData = [
      { name: '株式会社テクノソリューション',   industry: 'IT',   status: 'active'   },
      { name: '東京製造株式会社',               industry: '製造', status: 'active'   },
      { name: 'グローバル商事株式会社',         industry: '商社', status: 'active'   },
      { name: 'フィンテックジャパン株式会社',   industry: '金融', status: 'active'   },
      { name: 'メディケアサービス株式会社',     industry: '医療', status: 'active'   },
      { name: 'リテールプラス株式会社',         industry: '小売', status: 'active'   },
      { name: 'エデュケーションワン株式会社',   industry: '教育', status: 'prospect' },
      { name: 'ロジスティクス東日本株式会社',   industry: '物流', status: 'active'   },
      { name: 'クラウドビズ株式会社',           industry: 'IT',   status: 'prospect' },
      { name: 'オールドファッション株式会社',   industry: '製造', status: 'inactive' },
    ];

    const accountIds = [];
    for (const a of accountsData) {
      const res = await client.query(
        `INSERT INTO accounts (name, industry, status,
           annual_revenue, employee_count, phone, website)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [a.name, a.industry, a.status,
         rInt(10, 500) * 1_000_000,
         rInt(50, 2000),
         `03-${rInt(1000,9999)}-${rInt(1000,9999)}`,
         `https://www.example-${accountIds.length + 1}.co.jp`]
      );
      accountIds.push(res.rows[0].id);
    }

    // ----------------------------------------------------------
    // 3. 担当者（各企業2名 = 20名）
    // ----------------------------------------------------------
    const firstNames = ['太郎','花子','次郎','美咲','健二','由美','剛','さくら','浩二','明子'];
    const lastNames  = ['山田','佐藤','鈴木','高橋','伊藤','渡辺','松本','小林','加藤','吉田'];

    const contactIds = [];
    let nameIdx = 0;
    for (const accountId of accountIds) {
      for (let i = 0; i < 2; i++) {
        const res = await client.query(
          `INSERT INTO contacts
             (account_id, last_name, first_name, email, phone,
              title, department, is_primary)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [accountId,
           lastNames[nameIdx % lastNames.length],
           firstNames[nameIdx % firstNames.length],
           `contact${nameIdx + 1}@example.co.jp`,
           `090-${rInt(1000,9999)}-${rInt(1000,9999)}`,
           pick(TITLES),
           pick(DEPARTMENTS),
           i === 0]  // 1人目を主要担当者に
        );
        contactIds.push({ id: res.rows[0].id, accountId });
        nameIdx++;
      }
    }

    // ----------------------------------------------------------
    // 4. 商談（20件）— 各ステージに均等分散（20 / 6 ≒ 3〜4件）
    // ----------------------------------------------------------
    const oppNames = [
      'クラウド移行支援PJ', 'ERPシステム刷新', 'セキュリティ強化コンサル',
      'DXロードマップ策定', 'AIチャットボット導入', 'データ分析基盤構築',
      '基幹システム開発', 'モバイルアプリ開発', 'ゼロトラスト導入支援',
      'RPAツール展開', 'インフラ統合', 'クラウドコスト最適化',
      'マーケティングオートメーション', 'BIダッシュボード構築', 'SaaS移行支援',
      'IoTプラットフォーム', 'ブロックチェーン実証実験', 'API連携開発',
      'デジタルサイネージ導入', 'コンタクトセンターCX改善',
    ];

    const opportunityIds = [];
    for (let i = 0; i < 20; i++) {
      const stage     = STAGES[i % STAGES.length];
      const accountId = pick(accountIds);
      const contact   = pick(contactIds.filter(c => c.accountId === accountId) || contactIds);
      const daysOffset = rInt(-90, 90);
      const closeDate  = daysFromNow(daysOffset);
      const amount     = rInt(5, 500) * 100_000; // 50万〜5000万

      const res = await client.query(
        `INSERT INTO opportunities
           (account_id, owner_id, contact_id, name, stage, amount,
            probability, close_date, lead_source, next_step)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [accountId,
         pick(userIds),
         contact.id,
         oppNames[i] || `商談 ${i + 1}`,
         stage,
         amount,
         stage === 'closed_won' ? 100 : stage === 'closed_lost' ? 0 : rInt(10, 90),
         closeDate,
         pick(LEAD_SRCS),
         '次のアクション: ' + pick(['提案書送付', '見積もり作成', 'デモ実施', '契約書確認', 'キックオフ準備'])]
      );
      opportunityIds.push(res.rows[0].id);
    }

    // ----------------------------------------------------------
    // 5. ケース（30件）
    // ----------------------------------------------------------
    //  open 40% = 12件 / in_progress 30% = 9件 / pending 10% = 3件
    //  resolved 15% = 4〜5件 / closed 5% = 1〜2件
    const caseStatuses = [
      ...Array(12).fill('open'),
      ...Array(9).fill('in_progress'),
      ...Array(3).fill('pending'),
      ...Array(4).fill('resolved'),
      ...Array(2).fill('closed'),
    ];
    // critical 10% = 3件 / high 25% = 7〜8件 / medium 45% = 13〜14件 / low 20% = 6件
    const casePriorities = [
      ...Array(3).fill('critical'),
      ...Array(8).fill('high'),
      ...Array(13).fill('medium'),
      ...Array(6).fill('low'),
    ];

    const caseSubjects = [
      'ログインできない', 'パスワードリセット不可', '請求書の金額が間違っている',
      'データが消えた', 'レポートが表示されない', 'APIが応答しない',
      '新機能のリクエスト', '処理が遅い', '画面が崩れる',
      'メール通知が届かない', '権限設定がおかしい', 'CSVエクスポートが失敗する',
      'モバイルアプリのクラッシュ', 'SSO連携のエラー', '契約内容の確認',
      '請求サイクルの変更希望', 'ユーザー追加ができない', 'ダッシュボードが読み込まれない',
      'バックアップの設定方法', 'アップグレードについての問い合わせ',
      '操作マニュアルのリクエスト', 'データ移行の支援依頼', 'セキュリティ監査対応',
      'カスタムレポートの作成', '多言語対応の確認', 'SLA違反の報告',
      '障害発生の報告', 'パフォーマンスチューニング', 'APIキーの再発行', 'アカウント削除申請',
    ];

    const caseIds = [];
    for (let i = 0; i < 30; i++) {
      const status   = caseStatuses[i];
      const priority = casePriorities[i];
      const isResolved = status === 'resolved' || status === 'closed';
      const resolvedAt = isResolved ? pastDate(rInt(1, 30)) : null;
      const accountId  = pick(accountIds);
      const contact    = pick(contactIds.filter(c => c.accountId === accountId) || contactIds);

      const res = await client.query(
        `INSERT INTO cases
           (account_id, contact_id, assigned_to, subject, status, priority,
            category, origin, resolved_at, due_date, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [accountId,
         contact.id,
         pick(userIds),
         caseSubjects[i] || `ケース ${i + 1}`,
         status,
         priority,
         pick(CATEGORIES),
         pick(ORIGINS),
         resolvedAt,
         daysFromNow(rInt(-7, 30)),
         `お問い合わせ内容: ${caseSubjects[i] || `ケース ${i + 1}`} についての詳細をご確認ください。`]
      );
      caseIds.push(res.rows[0].id);
    }

    // ----------------------------------------------------------
    // 6. ToDo（30件）
    // ----------------------------------------------------------
    //  ステータス分布: open 40% / in_progress 30% / done 20% / cancelled 10%
    const todoStatuses = [
      ...Array(12).fill('open'),
      ...Array(9).fill('in_progress'),
      ...Array(6).fill('done'),
      ...Array(3).fill('cancelled'),
    ];
    // 優先度分布: high 30% / medium 50% / low 20%
    const todoPriorities = [
      ...Array(9).fill('high'),
      ...Array(15).fill('medium'),
      ...Array(6).fill('low'),
    ];

    const todoTitles = [
      '提案書作成', '見積書送付', 'デモ環境準備', '契約書レビュー', '請求書確認',
      'フォローアップ電話', 'ミーティング準備', '議事録作成', 'ステータス報告',
      '技術検証', '要件定義書作成', 'テスト実施', 'デプロイ作業', 'ドキュメント更新',
      '顧客確認連絡', 'エスカレーション対応', 'パッチ適用', 'バグ調査',
      'レポート提出', 'データバックアップ', 'アカウント設定', 'トレーニング実施',
      'ナレッジベース更新', 'コードレビュー', '品質チェック',
      'スプリント計画', 'リリースノート作成', '承認申請', 'ユーザーインタビュー', '競合調査',
    ];

    // 期限切れにする5件のインデックス
    const overdueIndices = new Set([0, 5, 10, 15, 20]);

    for (let i = 0; i < 30; i++) {
      const status     = todoStatuses[i];
      const priority   = todoPriorities[i];
      const assigneeId = pick(userIds);
      const isDone     = status === 'done';
      const completedAt = isDone ? pastDate(rInt(1, 14)) : null;
      const isOverdue  = overdueIndices.has(i) && status !== 'done';
      const dueDate    = isOverdue
        ? daysFromNow(-rInt(1, 14))   // 過去の日付
        : daysFromNow(rInt(1, 30));   // 未来の日付

      // 紐付けパターンの決定
      let opportunityId = null;
      let caseId        = null;

      if (i < 10) {
        // 商談に紐付き (0〜9)
        opportunityId = opportunityIds[i % opportunityIds.length];
      } else if (i < 20) {
        // ケースに紐付き (10〜19)
        caseId = caseIds[(i - 10) % caseIds.length];
      } else if (i < 25) {
        // 商談とケース両方 (20〜24)
        opportunityId = opportunityIds[i % opportunityIds.length];
        caseId        = caseIds[i % caseIds.length];
      }
      // 25〜29: 独立ToDo（両方 NULL のまま）

      await client.query(
        `INSERT INTO todos
           (title, status, priority, assignee_id, opportunity_id, case_id,
            due_date, completed_at, created_by, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [todoTitles[i] || `ToDo ${i + 1}`,
         status,
         priority,
         assigneeId,
         opportunityId,
         caseId,
         dueDate,
         completedAt,
         assigneeId,
         `タスク詳細: ${todoTitles[i] || `ToDo ${i + 1}`} を期限内に完了させること。`]
      );
    }

    // ----------------------------------------------------------
    // 7. AI設定初期値
    // ----------------------------------------------------------
    await client.query(
      `INSERT INTO ai_settings (id, provider) VALUES (1, 'none') ON CONFLICT DO NOTHING`
    );

    await client.query('COMMIT');
    console.log('[Seed] Done. Inserted users(4), accounts(10), contacts(20), opportunities(20), cases(30), todos(30).');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Seed] Failed. Transaction rolled back.', err);
  } finally {
    client.release();
  }
}

module.exports = runSeed;
