const express = require('express');
const pool    = require('../db/pool');

const router = express.Router();

// ============================================================
// GET /api/cases
// ============================================================

/**
 * @swagger
 * /cases:
 *   get:
 *     summary: ケース一覧取得
 *     tags: [Cases]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: priority
 *         schema: { type: string }
 *       - in: query
 *         name: assigned_to
 *         schema: { type: integer }
 *       - in: query
 *         name: account_id
 *         schema: { type: integer }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: ケース一覧
 */
router.get('/', async (req, res) => {
  try {
    let { status, priority, assigned_to, account_id, category,
          page = 1, limit = 20 } = req.query;

    page  = Math.max(1, parseInt(page)  || 1);
    limit = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params     = [];

    if (status) {
      params.push(status);
      conditions.push(`c.status = $${params.length}`);
    }
    if (priority) {
      params.push(priority);
      conditions.push(`c.priority = $${params.length}`);
    }
    if (assigned_to) {
      params.push(parseInt(assigned_to));
      conditions.push(`c.assigned_to = $${params.length}`);
    }
    if (account_id) {
      params.push(parseInt(account_id));
      conditions.push(`c.account_id = $${params.length}`);
    }
    if (category) {
      params.push(category);
      conditions.push(`c.category = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM cases c ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT
         c.*,
         u.id   AS assigned_user_id,
         u.name AS assigned_user_name,
         a.id   AS account_id_ref,
         a.name AS account_name
       FROM cases c
       LEFT JOIN users    u ON u.id = c.assigned_to
       LEFT JOIN accounts a ON a.id = c.account_id
       ${where}
       ORDER BY
         CASE c.priority
           WHEN 'critical' THEN 1
           WHEN 'high'     THEN 2
           WHEN 'medium'   THEN 3
           WHEN 'low'      THEN 4
           ELSE 5
         END,
         c.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const rows = dataResult.rows.map(row => ({
      ...row,
      assigned_user: row.assigned_to
        ? { id: row.assigned_to, name: row.assigned_user_name }
        : null,
      account: row.account_id
        ? { id: row.account_id, name: row.account_name }
        : null,
    }));

    res.json({ data: rows, meta: { total, page, limit } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// GET /api/cases/:id
// ============================================================

/**
 * @swagger
 * /cases/{id}:
 *   get:
 *     summary: ケース詳細取得
 *     tags: [Cases]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: ケース詳細（account / contact / assigned_user / todos 含む）
 *       404:
 *         description: ケースが見つかりません
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const caseResult = await pool.query(
      `SELECT
         c.*,
         a.id         AS a_id,
         a.name       AS a_name,
         ct.id        AS ct_id,
         ct.first_name AS ct_first_name,
         ct.last_name  AS ct_last_name,
         u.id         AS u_id,
         u.name       AS u_name
       FROM cases c
       LEFT JOIN accounts a  ON a.id  = c.account_id
       LEFT JOIN contacts ct ON ct.id = c.contact_id
       LEFT JOIN users    u  ON u.id  = c.assigned_to
       WHERE c.id = $1`,
      [id]
    );

    if (!caseResult.rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'ケースが見つかりません' } });
    }

    const row = caseResult.rows[0];

    // 関連 todos
    const todosResult = await pool.query(
      `SELECT
         t.*,
         u.name AS assignee_name
       FROM todos t
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.case_id = $1
       ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC`,
      [id]
    );

    const caseData = {
      ...row,
      account: row.a_id
        ? { id: row.a_id, name: row.a_name }
        : null,
      contact: row.ct_id
        ? { id: row.ct_id, first_name: row.ct_first_name, last_name: row.ct_last_name }
        : null,
      assigned_user: row.assigned_to
        ? { id: row.assigned_to, name: row.u_name }
        : null,
      todos: todosResult.rows.map(t => ({
        ...t,
        assignee: t.assignee_id ? { id: t.assignee_id, name: t.assignee_name } : null,
      })),
    };

    // JOIN の生カラムを削除
    ['a_id','a_name','ct_id','ct_first_name','ct_last_name','u_id','u_name'].forEach(k => {
      delete caseData[k];
    });

    res.json({ data: caseData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// POST /api/cases
// ============================================================

/**
 * @swagger
 * /cases:
 *   post:
 *     summary: ケース新規作成
 *     tags: [Cases]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, status, priority]
 *             properties:
 *               subject:     { type: string }
 *               status:      { type: string }
 *               priority:    { type: string }
 *               account_id:  { type: integer, nullable: true }
 *               contact_id:  { type: integer, nullable: true }
 *               assigned_to: { type: integer, nullable: true }
 *               description: { type: string, nullable: true }
 *               category:    { type: string, nullable: true }
 *               origin:      { type: string, nullable: true }
 *               resolution:  { type: string, nullable: true }
 *               due_date:    { type: string, format: date, nullable: true }
 *     responses:
 *       201:
 *         description: 作成成功
 *       400:
 *         description: バリデーションエラー
 */
router.post('/', async (req, res) => {
  const { subject, status, priority, account_id, contact_id, assigned_to,
          description, category, origin, resolution, due_date } = req.body;

  if (!subject || !status || !priority) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '件名・ステータス・優先度は必須です' }
    });
  }

  // status が 'resolved' の場合は resolved_at を NOW() にセット
  const resolvedAt = status === 'resolved' ? new Date() : null;

  try {
    const result = await pool.query(
      `INSERT INTO cases
         (subject, status, priority, account_id, contact_id, assigned_to,
          description, category, origin, resolution, resolved_at, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [subject, status, priority,
       account_id  || null,
       contact_id  || null,
       assigned_to || null,
       description || null,
       category    || null,
       origin      || null,
       resolution  || null,
       resolvedAt,
       due_date    || null]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// PUT /api/cases/:id
// ============================================================

/**
 * @swagger
 * /cases/{id}:
 *   put:
 *     summary: ケース更新
 *     tags: [Cases]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 更新成功
 *       404:
 *         description: ケースが見つかりません
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const fields  = ['subject', 'status', 'priority', 'account_id', 'contact_id',
                   'assigned_to', 'description', 'category', 'origin',
                   'resolution', 'due_date'];

  const setClauses = [];
  const params     = [];

  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      const val = req.body[f] === '' ? null : req.body[f];
      params.push(val);
      setClauses.push(`${f} = $${params.length}`);
    }
  });

  if (setClauses.length === 0) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '更新するフィールドがありません' } });
  }

  // status が 'resolved' に変更された場合は resolved_at を NOW() にセット
  if (req.body.status === 'resolved') {
    setClauses.push(`resolved_at = NOW()`);
  }

  setClauses.push(`updated_at = NOW()`);
  params.push(id);

  try {
    const result = await pool.query(
      `UPDATE cases SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'ケースが見つかりません' } });
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// DELETE /api/cases/:id
// ============================================================

/**
 * @swagger
 * /cases/{id}:
 *   delete:
 *     summary: ケース削除
 *     tags: [Cases]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 削除成功
 *       404:
 *         description: ケースが見つかりません
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM cases WHERE id = $1 RETURNING id',
      [id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'ケースが見つかりません' } });
    }
    res.json({ data: { id: parseInt(id), deleted: true } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

module.exports = router;
