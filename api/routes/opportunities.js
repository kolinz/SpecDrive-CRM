const express = require('express');
const pool    = require('../db/pool');

const router = express.Router();

// ============================================================
// GET /api/opportunities
// ============================================================

/**
 * @swagger
 * /opportunities:
 *   get:
 *     summary: 商談一覧取得
 *     tags: [Opportunities]
 *     parameters:
 *       - in: query
 *         name: stage
 *         schema: { type: string }
 *       - in: query
 *         name: owner_id
 *         schema: { type: integer }
 *       - in: query
 *         name: account_id
 *         schema: { type: integer }
 *       - in: query
 *         name: close_date_from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: close_date_to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: 商談一覧
 */
router.get('/', async (req, res) => {
  try {
    let { stage, owner_id, account_id, close_date_from, close_date_to,
          page = 1, limit = 20 } = req.query;

    page  = Math.max(1, parseInt(page)  || 1);
    limit = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params     = [];

    if (stage) {
      params.push(stage);
      conditions.push(`o.stage = $${params.length}`);
    }
    if (owner_id) {
      params.push(parseInt(owner_id));
      conditions.push(`o.owner_id = $${params.length}`);
    }
    if (account_id) {
      params.push(parseInt(account_id));
      conditions.push(`o.account_id = $${params.length}`);
    }
    if (close_date_from) {
      params.push(close_date_from);
      conditions.push(`o.close_date >= $${params.length}`);
    }
    if (close_date_to) {
      params.push(close_date_to);
      conditions.push(`o.close_date <= $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM opportunities o ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT
         o.*,
         u.id   AS owner_id_ref,
         u.name AS owner_name,
         a.id   AS account_id_ref,
         a.name AS account_name
       FROM opportunities o
       LEFT JOIN users    u ON u.id = o.owner_id
       LEFT JOIN accounts a ON a.id = o.account_id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const rows = dataResult.rows.map(row => ({
      ...row,
      owner:   row.owner_id   ? { id: row.owner_id,   name: row.owner_name   } : null,
      account: row.account_id ? { id: row.account_id, name: row.account_name } : null,
    }));

    res.json({ data: rows, meta: { total, page, limit } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// GET /api/opportunities/:id
// ============================================================

/**
 * @swagger
 * /opportunities/{id}:
 *   get:
 *     summary: 商談詳細取得
 *     tags: [Opportunities]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 商談詳細（account / owner / contact / todos 含む）
 *       404:
 *         description: 商談が見つかりません
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const oppResult = await pool.query(
      `SELECT
         o.*,
         a.id         AS a_id,
         a.name       AS a_name,
         u.id         AS u_id,
         u.name       AS u_name,
         c.id         AS c_id,
         c.first_name AS c_first_name,
         c.last_name  AS c_last_name
       FROM opportunities o
       LEFT JOIN accounts a  ON a.id = o.account_id
       LEFT JOIN users    u  ON u.id = o.owner_id
       LEFT JOIN contacts c  ON c.id = o.contact_id
       WHERE o.id = $1`,
      [id]
    );

    if (!oppResult.rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: '商談が見つかりません' } });
    }

    const row = oppResult.rows[0];

    // 関連 todos
    const todosResult = await pool.query(
      `SELECT
         t.*,
         u.name AS assignee_name
       FROM todos t
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.opportunity_id = $1
       ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC`,
      [id]
    );

    const opportunity = {
      ...row,
      account: row.a_id ? { id: row.a_id, name: row.a_name } : null,
      owner:   row.u_id ? { id: row.u_id, name: row.u_name } : null,
      contact: row.c_id
        ? { id: row.c_id, first_name: row.c_first_name, last_name: row.c_last_name }
        : null,
      todos: todosResult.rows.map(t => ({
        ...t,
        assignee: t.assignee_id ? { id: t.assignee_id, name: t.assignee_name } : null,
      })),
    };

    // 整形用に JOIN で追加した生カラムを削除
    ['a_id','a_name','u_id','u_name','c_id','c_first_name','c_last_name'].forEach(k => {
      delete opportunity[k];
    });

    res.json({ data: opportunity });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// POST /api/opportunities
// ============================================================

/**
 * @swagger
 * /opportunities:
 *   post:
 *     summary: 商談新規作成
 *     tags: [Opportunities]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, stage]
 *             properties:
 *               name:        { type: string }
 *               stage:       { type: string }
 *               account_id:  { type: integer, nullable: true }
 *               owner_id:    { type: integer, nullable: true }
 *               contact_id:  { type: integer, nullable: true }
 *               amount:      { type: number,  nullable: true }
 *               probability: { type: integer, nullable: true }
 *               close_date:  { type: string, format: date, nullable: true }
 *               lead_source: { type: string, nullable: true }
 *               campaign:    { type: string, nullable: true }
 *               next_step:   { type: string, nullable: true }
 *               description: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: 作成成功
 *       400:
 *         description: バリデーションエラー
 */
router.post('/', async (req, res) => {
  const { name, stage, account_id, owner_id, contact_id, amount, probability,
          close_date, lead_source, campaign, next_step, description } = req.body;

  if (!name || !stage) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '商談名・ステージは必須です' } });
  }

  try {
    const result = await pool.query(
      `INSERT INTO opportunities
         (name, stage, account_id, owner_id, contact_id, amount, probability,
          close_date, lead_source, campaign, next_step, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [name, stage,
       account_id   || null,
       owner_id     || null,
       contact_id   || null,
       amount       !== undefined && amount !== '' ? amount       : null,
       probability  !== undefined && probability !== '' ? probability : null,
       close_date   || null,
       lead_source  || null,
       campaign     || null,
       next_step    || null,
       description  || null]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// PUT /api/opportunities/:id
// ============================================================

/**
 * @swagger
 * /opportunities/{id}:
 *   put:
 *     summary: 商談更新
 *     tags: [Opportunities]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 更新成功
 *       404:
 *         description: 商談が見つかりません
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const fields  = ['name', 'stage', 'account_id', 'owner_id', 'contact_id',
                   'amount', 'probability', 'close_date', 'lead_source',
                   'campaign', 'next_step', 'description'];

  const setClauses = [];
  const params     = [];

  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      // 空文字列は null に変換（外部キー・数値フィールド対策）
      const val = req.body[f] === '' ? null : req.body[f];
      params.push(val);
      setClauses.push(`${f} = $${params.length}`);
    }
  });

  if (setClauses.length === 0) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '更新するフィールドがありません' } });
  }

  setClauses.push(`updated_at = NOW()`);
  params.push(id);

  try {
    const result = await pool.query(
      `UPDATE opportunities SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: '商談が見つかりません' } });
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// DELETE /api/opportunities/:id
// ============================================================

/**
 * @swagger
 * /opportunities/{id}:
 *   delete:
 *     summary: 商談削除
 *     tags: [Opportunities]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 削除成功
 *       404:
 *         description: 商談が見つかりません
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM opportunities WHERE id = $1 RETURNING id',
      [id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: '商談が見つかりません' } });
    }
    res.json({ data: { id: parseInt(id), deleted: true } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

module.exports = router;
