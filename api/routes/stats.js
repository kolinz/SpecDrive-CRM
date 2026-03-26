const express = require('express');
const pool    = require('../db/pool');

const router = express.Router();

// ============================================================
// GET /api/stats/summary
// ============================================================

/**
 * @swagger
 * /stats/summary:
 *   get:
 *     summary: ダッシュボード全体サマリー
 *     tags: [Stats]
 *     responses:
 *       200:
 *         description: KPI サマリー
 */
router.get('/summary', async (req, res) => {
  try {
    const [
      accountsRes,
      opportunitiesActiveRes,
      revenueRes,
      casesOpenRes,
      todosOverdueRes,
    ] = await Promise.all([
      // 取引先総件数
      pool.query(`SELECT COUNT(*) FROM accounts`),

      // 進行中商談（closed_won / closed_lost 以外）
      pool.query(`
        SELECT COUNT(*) FROM opportunities
        WHERE stage NOT IN ('closed_won', 'closed_lost')
      `),

      // 今月の受注額（closed_won かつ close_date が当月）
      pool.query(`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM opportunities
        WHERE stage = 'closed_won'
          AND DATE_TRUNC('month', close_date) = DATE_TRUNC('month', CURRENT_DATE)
      `),

      // 未解決ケース（open / in_progress / pending）
      pool.query(`
        SELECT COUNT(*) FROM cases
        WHERE status IN ('open', 'in_progress', 'pending')
      `),

      // 期限切れ ToDo（due_date < 今日 かつ status != done）
      pool.query(`
        SELECT COUNT(*) FROM todos
        WHERE due_date < CURRENT_DATE
          AND status != 'done'
      `),
    ]);

    res.json({
      data: {
        accounts_total:       parseInt(accountsRes.rows[0].count),
        opportunities_active: parseInt(opportunitiesActiveRes.rows[0].count),
        revenue_this_month:   parseFloat(revenueRes.rows[0].total),
        cases_open:           parseInt(casesOpenRes.rows[0].count),
        todos_overdue:        parseInt(todosOverdueRes.rows[0].count),
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// GET /api/stats/pipeline
// ============================================================

/**
 * @swagger
 * /stats/pipeline:
 *   get:
 *     summary: 商談パイプライン（ステージ別件数・金額）
 *     tags: [Stats]
 *     responses:
 *       200:
 *         description: ステージ別集計
 */
router.get('/pipeline', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        stage,
        COUNT(*)        AS count,
        COALESCE(SUM(amount), 0) AS total_amount
      FROM opportunities
      GROUP BY stage
      ORDER BY
        CASE stage
          WHEN 'prospecting'   THEN 1
          WHEN 'qualification' THEN 2
          WHEN 'proposal'      THEN 3
          WHEN 'negotiation'   THEN 4
          WHEN 'closed_won'    THEN 5
          WHEN 'closed_lost'   THEN 6
          ELSE 7
        END
    `);

    // 全ステージを網羅するため、データがないステージも 0 で補完
    const STAGES = ['prospecting','qualification','proposal','negotiation','closed_won','closed_lost'];
    const map    = {};
    result.rows.forEach(r => { map[r.stage] = r; });

    const data = STAGES.map(stage => ({
      stage,
      count:        parseInt(map[stage]?.count        || 0),
      total_amount: parseFloat(map[stage]?.total_amount || 0),
    }));

    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// GET /api/stats/cases
// ============================================================

/**
 * @swagger
 * /stats/cases:
 *   get:
 *     summary: ケース集計（ステータス別・優先度別・カテゴリー別）
 *     tags: [Stats]
 *     responses:
 *       200:
 *         description: ケース集計
 */
router.get('/cases', async (req, res) => {
  try {
    const [statusRes, priorityRes, categoryRes] = await Promise.all([
      pool.query(`
        SELECT status, COUNT(*) AS count
        FROM cases
        GROUP BY status
        ORDER BY status
      `),
      pool.query(`
        SELECT priority, COUNT(*) AS count
        FROM cases
        GROUP BY priority
        ORDER BY
          CASE priority
            WHEN 'critical' THEN 1
            WHEN 'high'     THEN 2
            WHEN 'medium'   THEN 3
            WHEN 'low'      THEN 4
            ELSE 5
          END
      `),
      pool.query(`
        SELECT
          COALESCE(category, 'uncategorized') AS category,
          COUNT(*) AS count
        FROM cases
        GROUP BY category
        ORDER BY count DESC
      `),
    ]);

    res.json({
      data: {
        by_status:   statusRes.rows.map(r   => ({ status:   r.status,   count: parseInt(r.count) })),
        by_priority: priorityRes.rows.map(r => ({ priority: r.priority, count: parseInt(r.count) })),
        by_category: categoryRes.rows.map(r => ({ category: r.category, count: parseInt(r.count) })),
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// GET /api/stats/todos
// ============================================================

/**
 * @swagger
 * /stats/todos:
 *   get:
 *     summary: ToDo集計（ステータス別・期限切れ数・担当者別）
 *     tags: [Stats]
 *     responses:
 *       200:
 *         description: ToDo集計
 */
router.get('/todos', async (req, res) => {
  try {
    const [statusRes, overdueRes, assigneeRes] = await Promise.all([
      // ステータス別件数
      pool.query(`
        SELECT status, COUNT(*) AS count
        FROM todos
        GROUP BY status
        ORDER BY status
      `),

      // 期限切れ件数
      pool.query(`
        SELECT COUNT(*) FROM todos
        WHERE due_date < CURRENT_DATE
          AND status != 'done'
      `),

      // 担当者別の未完了件数（users.name 付き）
      pool.query(`
        SELECT
          u.id,
          u.name,
          COUNT(t.id) AS count
        FROM todos t
        JOIN users u ON u.id = t.assignee_id
        WHERE t.status NOT IN ('done', 'cancelled')
        GROUP BY u.id, u.name
        ORDER BY count DESC
      `),
    ]);

    res.json({
      data: {
        by_status:    statusRes.rows.map(r => ({ status: r.status, count: parseInt(r.count) })),
        overdue_count: parseInt(overdueRes.rows[0].count),
        by_assignee:  assigneeRes.rows.map(r => ({
          id:    r.id,
          name:  r.name,
          count: parseInt(r.count),
        })),
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

module.exports = router;
