const jwt = require('jsonwebtoken');

/**
 * 一般認証ミドルウェア（全エンドポイント共通）
 * Authorization: Bearer <JWT> を検証し、req.user にセットする
 */
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '認証が必要です' } });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded; // { id, username, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: '無効なトークンです' } });
  }
};

/**
 * 管理者権限チェックミドルウェア（システム管理系エンドポイント専用）
 * requireAuth の後に使用する。role が admin 以外は 403 を返す。
 */
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: { code: 'ACCESS_DENIED', message: '管理者権限が必要です' } });
  }
};

module.exports = { requireAuth, requireAdmin };
