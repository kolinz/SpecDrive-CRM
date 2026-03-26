const express = require('express');
const bcrypt  = require('bcryptjs');
const pool    = require('../db/pool');

const router = express.Router();

const SAFE_FIELDS = 'id, name, username, role, is_active, created_at, updated_at';

// ============================================================
// GET /api/users
// ============================================================

/**
 * @swagger
 * /users:
 *   get:
 *     summary: ユーザー一覧取得（admin のみ）
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: ユーザー一覧（password_hash 除く）
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${SAFE_FIELDS} FROM users ORDER BY created_at ASC`
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// GET /api/users/:id
// ============================================================

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: ユーザー詳細取得（admin のみ）
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: ユーザー詳細（password_hash 除く）
 *       404:
 *         description: ユーザーが見つかりません
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT ${SAFE_FIELDS} FROM users WHERE id = $1`,
      [id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'ユーザーが見つかりません' } });
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// POST /api/users
// ============================================================

/**
 * @swagger
 * /users:
 *   post:
 *     summary: ユーザー新規作成（admin のみ）
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, username, password, role]
 *             properties:
 *               name:     { type: string }
 *               username: { type: string }
 *               password: { type: string }
 *               role:     { type: string, enum: [admin, manager, staff] }
 *     responses:
 *       201:
 *         description: 作成成功
 *       400:
 *         description: バリデーションエラー
 *       409:
 *         description: ユーザー名が既に使用されています
 */
router.post('/', async (req, res) => {
  const { name, username, password, role } = req.body;

  if (!name || !username || !password || !role) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '名前・ユーザー名・パスワード・ロールは必須です' }
    });
  }

  try {
    // username 重複チェック
    const dup = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (dup.rows[0]) {
      return res.status(409).json({
        error: { code: 'DUPLICATE_USERNAME', message: 'このユーザー名は既に使用されています' }
      });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, username, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING ${SAFE_FIELDS}`,
      [name, username, password_hash, role]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// PUT /api/users/:id
// ============================================================

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: ユーザー更新（admin のみ）
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 更新成功
 *       403:
 *         description: 自分自身の role を admin 以外に変更することはできません
 *       404:
 *         description: ユーザーが見つかりません
 */
router.put('/:id', async (req, res) => {
  const { id }            = req.params;
  const { name, username, password, role, is_active } = req.body;

  // 自分自身の role を admin 以外に変更しようとした場合は禁止
  if (parseInt(id) === req.user.id && role && role !== 'admin') {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '自分自身のロールを admin 以外に変更することはできません' }
    });
  }

  const setClauses = [];
  const params     = [];

  if (name !== undefined) {
    params.push(name);
    setClauses.push(`name = $${params.length}`);
  }
  if (username !== undefined) {
    // username 重複チェック（自分以外）
    const dup = await pool.query(
      'SELECT id FROM users WHERE username = $1 AND id != $2',
      [username, id]
    );
    if (dup.rows[0]) {
      return res.status(409).json({
        error: { code: 'DUPLICATE_USERNAME', message: 'このユーザー名は既に使用されています' }
      });
    }
    params.push(username);
    setClauses.push(`username = $${params.length}`);
  }
  if (role !== undefined) {
    params.push(role);
    setClauses.push(`role = $${params.length}`);
  }
  if (is_active !== undefined) {
    params.push(is_active);
    setClauses.push(`is_active = $${params.length}`);
  }
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    params.push(hash);
    setClauses.push(`password_hash = $${params.length}`);
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '更新するフィールドがありません' } });
  }

  setClauses.push(`updated_at = NOW()`);
  params.push(id);

  try {
    const result = await pool.query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING ${SAFE_FIELDS}`,
      params
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'ユーザーが見つかりません' } });
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// DELETE /api/users/:id
// ============================================================

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: ユーザー削除（論理削除・admin のみ）
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 削除成功（is_active = false）
 *       403:
 *         description: 自分自身は削除できません
 *       404:
 *         description: ユーザーが見つかりません
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  // 自分自身の削除は禁止
  if (parseInt(id) === req.user.id) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '自分自身を削除することはできません' }
    });
  }

  try {
    const result = await pool.query(
      `UPDATE users SET is_active = false, updated_at = NOW()
       WHERE id = $1 RETURNING ${SAFE_FIELDS}`,
      [id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'ユーザーが見つかりません' } });
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

module.exports = router;
