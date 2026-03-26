const express = require('express');
const pool    = require('../db/pool');

const router = express.Router();

// ============================================================
// GET /api/accounts
// ============================================================

/**
 * @swagger
 * /accounts:
 *   get:
 *     summary: 取引先一覧取得
 *     tags: [Accounts]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: 企業名部分一致検索
 *       - in: query
 *         name: industry
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: 取引先一覧
 */
router.get('/', async (req, res) => {
  try {
    let { q, industry, status, page = 1, limit = 20 } = req.query;
    page  = Math.max(1, parseInt(page)  || 1);
    limit = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params     = [];

    if (q) {
      params.push(`%${q}%`);
      conditions.push(`a.name ILIKE $${params.length}`);
    }
    if (industry) {
      params.push(industry);
      conditions.push(`a.industry = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`a.status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // 総件数
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM accounts a ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // 一覧 + contacts数 + opportunities数
    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT
         a.*,
         COUNT(DISTINCT c.id)  AS contacts_count,
         COUNT(DISTINCT o.id)  AS opportunities_count
       FROM accounts a
       LEFT JOIN contacts     c ON c.account_id = a.id
       LEFT JOIN opportunities o ON o.account_id = a.id
       ${where}
       GROUP BY a.id
       ORDER BY a.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      data: dataResult.rows,
      meta: { total, page, limit }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// GET /api/accounts/:id
// ============================================================

/**
 * @swagger
 * /accounts/{id}:
 *   get:
 *     summary: 取引先詳細取得
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 取引先詳細（contacts / opportunities / cases / todos 含む）
 *       404:
 *         description: 取引先が見つかりません
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const accountResult = await pool.query(
      'SELECT * FROM accounts WHERE id = $1',
      [id]
    );
    if (!accountResult.rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: '取引先が見つかりません' } });
    }
    const account = accountResult.rows[0];

    const [contacts, opportunities, cases, todos] = await Promise.all([
      pool.query(
        'SELECT * FROM contacts WHERE account_id = $1 ORDER BY created_at DESC',
        [id]
      ),
      pool.query(
        `SELECT o.*, u.name AS owner_name
         FROM opportunities o
         LEFT JOIN users u ON u.id = o.owner_id
         WHERE o.account_id = $1
         ORDER BY o.created_at DESC`,
        [id]
      ),
      pool.query(
        `SELECT c.*, u.name AS assigned_to_name
         FROM cases c
         LEFT JOIN users u ON u.id = c.assigned_to
         WHERE c.account_id = $1
         ORDER BY c.created_at DESC`,
        [id]
      ),
      pool.query(
        `SELECT t.*, u.name AS assignee_name
         FROM todos t
         LEFT JOIN users u ON u.id = t.assignee_id
         LEFT JOIN opportunities o ON o.id = t.opportunity_id
         LEFT JOIN cases cs ON cs.id = t.case_id
         WHERE o.account_id = $1 OR cs.account_id = $1
         ORDER BY t.created_at DESC`,
        [id]
      ),
    ]);

    res.json({
      data: {
        ...account,
        contacts:      contacts.rows,
        opportunities: opportunities.rows,
        cases:         cases.rows,
        todos:         todos.rows,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// POST /api/accounts
// ============================================================

/**
 * @swagger
 * /accounts:
 *   post:
 *     summary: 取引先新規作成
 *     tags: [Accounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               industry: { type: string }
 *               website: { type: string }
 *               phone: { type: string }
 *               address: { type: string }
 *               annual_revenue: { type: number }
 *               employee_count: { type: integer }
 *               status: { type: string }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: 作成成功
 *       400:
 *         description: バリデーションエラー
 */
router.post('/', async (req, res) => {
  const { name, industry, website, phone, address, annual_revenue, employee_count, status, notes } = req.body;

  if (!name) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '企業名は必須です' } });
  }

  try {
    const result = await pool.query(
      `INSERT INTO accounts
         (name, industry, website, phone, address, annual_revenue, employee_count, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [name, industry || null, website || null, phone || null, address || null,
       annual_revenue || null, employee_count || null, status || 'active', notes || null]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// PUT /api/accounts/:id
// ============================================================

/**
 * @swagger
 * /accounts/{id}:
 *   put:
 *     summary: 取引先更新
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 更新成功
 *       404:
 *         description: 取引先が見つかりません
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const fields  = ['name', 'industry', 'website', 'phone', 'address',
                   'annual_revenue', 'employee_count', 'status', 'notes'];

  const setClauses = [];
  const params     = [];

  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      params.push(req.body[f]);
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
      `UPDATE accounts SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: '取引先が見つかりません' } });
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// DELETE /api/accounts/:id
// ============================================================

/**
 * @swagger
 * /accounts/{id}:
 *   delete:
 *     summary: 取引先削除
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 削除成功
 *       404:
 *         description: 取引先が見つかりません
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM accounts WHERE id = $1 RETURNING id',
      [id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: '取引先が見つかりません' } });
    }
    res.json({ data: { id: parseInt(id), deleted: true } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

module.exports = router;
