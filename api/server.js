require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const { requireAuth, requireAdmin } = require('./middleware/auth');

// ルーター
const authRouter          = require('./routes/auth');
const usersRouter         = require('./routes/users');
const accountsRouter      = require('./routes/accounts');
const contactsRouter      = require('./routes/contacts');
const opportunitiesRouter = require('./routes/opportunities');
const casesRouter         = require('./routes/cases');
const todosRouter         = require('./routes/todos');
const statsRouter         = require('./routes/stats');
const aiRouter            = require('./routes/ai');

// Swagger
const swaggerUi   = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

// シードデータ
const runSeed        = require('./seed/seed');
const syncAiSettings = require('./boot/syncAiSettings');

// ============================================================
// アプリ初期化
// ============================================================
const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ============================================================
// Swagger UI（認証不要・公開）
// ============================================================
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ============================================================
// ルーティング
// ============================================================

// 認証（/api/auth/login は認証不要。/api/auth/me は authRouter 内で requireAuth）
app.use('/api/auth', authRouter);

// システム管理系（requireAuth + requireAdmin）
app.use('/api/users', requireAuth, requireAdmin, usersRouter);

// CRM業務系（requireAuth のみ）
app.use('/api/accounts',      requireAuth, accountsRouter);
app.use('/api/contacts',      requireAuth, contactsRouter);
app.use('/api/opportunities', requireAuth, opportunitiesRouter);
app.use('/api/cases',         requireAuth, casesRouter);
app.use('/api/todos',         requireAuth, todosRouter);
app.use('/api/stats',         requireAuth, statsRouter);

// AI（/api/ai 配下を一本化。settings・test は adminOnly、chat は全ロール）
// エンドポイント別の認可は routes/ai.js 内の requireAdmin で制御する
app.use('/api/ai', requireAuth, aiRouter);

// ============================================================
// グローバルエラーハンドラー
// ============================================================
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' }
  });
});

// ============================================================
// 起動（app.listen はここの1箇所のみ）
// ============================================================
app.listen(PORT, async () => {
  console.log(`[CRM API] Server running on port ${PORT}`);
  await runSeed();
  await syncAiSettings();
});
