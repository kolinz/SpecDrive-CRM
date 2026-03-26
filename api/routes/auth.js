const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const pool     = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// POST /api/auth/login
// ============================================================

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: ログイン
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *               password:
 *                 type: string
 *                 example: admin1234
 *     responses:
 *       200:
 *         description: 認証成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         name:
 *                           type: string
 *                         username:
 *                           type: string
 *                         role:
 *                           type: string
 *       401:
 *         description: 認証失敗（パスワード不一致）
 *       403:
 *         description: アカウント無効
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: 'ユーザー名またはパスワードが正しくありません' }
    });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    const user = result.rows[0];

    // ユーザーが存在しない or パスワード不一致
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'ユーザー名またはパスワードが正しくありません' }
      });
    }

    // アカウント無効
    if (!user.is_active) {
      return res.status(403).json({
        error: { code: 'ACCOUNT_DISABLED', message: 'このアカウントは無効です' }
      });
    }

    // JWT 発行（全ロール共通）
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      data: {
        token,
        user: { id: user.id, name: user.name, username: user.username, role: user.role }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// GET /api/auth/me
// ============================================================

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: ログイン中のユーザー情報を取得
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ユーザー情報
 *       401:
 *         description: 未認証
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, username, role, is_active, created_at, updated_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'ユーザーが見つかりません' } });
    }
    res.json({ data: user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

module.exports = router;
