const express = require('express');
const pool    = require('../db/pool');

const router = express.Router();

// ============================================================
// GET /api/contacts
// ============================================================

/**
 * @swagger
 * /contacts:
 *   get:
 *     summary: 担当者一覧取得
 *     tags: [Contacts]
 *     parameters:
 *       - in: query
 *         name: account_id
 *         schema: { type: integer }
 *         description: 取引先でフィルター
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: 氏名（姓または名）部分一致検索
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: 担当者一覧（accounts.name 含む）
 */
router.get('/', async (req, res) => {
  try {
    let { account_id, q, page = 1, limit = 20 } = req.query;
    page  = Math.max(1, parseInt(page)  || 1);
    limit = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params     = [];

    if (account_id) {
      params.push(parseInt(account_id));
      conditions.push(`c.account_id = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      conditions.push(
        `(c.first_name ILIKE $${params.length} OR c.last_name ILIKE $${params.length} OR (c.last_name || ' ' || c.first_name) ILIKE $${params.length})`
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM contacts c ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT
         c.*,
         a.name AS account_name
       FROM contacts c
       LEFT JOIN accounts a ON a.id = c.account_id
       ${where}
       ORDER BY c.last_name, c.first_name
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
// GET /api/contacts/:id
// ============================================================

/**
 * @swagger
 * /contacts/{id}:
 *   get:
 *     summary: 担当者詳細取得
 *     tags: [Contacts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 担当者詳細（account情報含む）
 *       404:
 *         description: 担当者が見つかりません
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         c.*,
         a.id   AS account_id_ref,
         a.name AS account_name
       FROM contacts c
       LEFT JOIN accounts a ON a.id = c.account_id
       WHERE c.id = $1`,
      [id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: '担当者が見つかりません' } });
    }
    const row = result.rows[0];
    // account オブジェクトを整形
    const contact = {
      ...row,
      account: row.account_id
        ? { id: row.account_id, name: row.account_name }
        : null,
    };
    delete contact.account_id_ref;
    delete contact.account_name;

    res.json({ data: contact });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// POST /api/contacts
// ============================================================

/**
 * @swagger
 * /contacts:
 *   post:
 *     summary: 担当者新規作成
 *     tags: [Contacts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [first_name, last_name]
 *             properties:
 *               first_name:  { type: string }
 *               last_name:   { type: string }
 *               account_id:  { type: integer, nullable: true }
 *               email:       { type: string }
 *               phone:       { type: string }
 *               mobile:      { type: string }
 *               title:       { type: string }
 *               department:  { type: string }
 *               is_primary:  { type: boolean }
 *               notes:       { type: string }
 *     responses:
 *       201:
 *         description: 作成成功
 *       400:
 *         description: バリデーションエラー
 */
router.post('/', async (req, res) => {
  const { first_name, last_name, account_id, email, phone, mobile,
          title, department, is_primary, notes } = req.body;

  if (!first_name || !last_name) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '姓・名は必須です' } });
  }

  try {
    const result = await pool.query(
      `INSERT INTO contacts
         (first_name, last_name, account_id, email, phone, mobile,
          title, department, is_primary, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [first_name, last_name,
       account_id  || null,
       email       || null,
       phone       || null,
       mobile      || null,
       title       || null,
       department  || null,
       is_primary  !== undefined ? is_primary : false,
       notes       || null]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// PUT /api/contacts/:id
// ============================================================

/**
 * @swagger
 * /contacts/{id}:
 *   put:
 *     summary: 担当者更新
 *     tags: [Contacts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 更新成功
 *       404:
 *         description: 担当者が見つかりません
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const fields  = ['first_name', 'last_name', 'account_id', 'email', 'phone',
                   'mobile', 'title', 'department', 'is_primary', 'notes'];

  const setClauses = [];
  const params     = [];

  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      params.push(req.body[f] === '' ? null : req.body[f]);
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
      `UPDATE contacts SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: '担当者が見つかりません' } });
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// DELETE /api/contacts/:id
// ============================================================

/**
 * @swagger
 * /contacts/{id}:
 *   delete:
 *     summary: 担当者削除
 *     tags: [Contacts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 削除成功
 *       404:
 *         description: 担当者が見つかりません
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM contacts WHERE id = $1 RETURNING id',
      [id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: '担当者が見つかりません' } });
    }
    res.json({ data: { id: parseInt(id), deleted: true } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

module.exports = router;
