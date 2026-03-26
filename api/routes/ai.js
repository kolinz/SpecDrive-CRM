const express  = require('express');
const pool     = require('../db/pool');
const { encrypt, decrypt } = require('../services/crypto');
const { requireAdmin } = require('../middleware/auth');
const openaiService = require('../services/openai');
const difyService   = require('../services/dify');

const router = express.Router();

// ============================================================
// ユーティリティ: APIキーをマスク表示する
// ============================================================
function maskApiKey(key) {
  if (!key) return '';
  try {
    const plain = decrypt(key);
    if (!plain || plain.length < 4) return '••••';
    return `••••${plain.slice(-4)}`;
  } catch {
    return '••••';
  }
}

// ============================================================
// ユーティリティ: ai_settings を取得して復号する
// ============================================================
async function getSettings() {
  const result = await pool.query('SELECT * FROM ai_settings WHERE id = 1');
  return result.rows[0] || null;
}

// ============================================================
// ユーティリティ: エラーを共通形式に変換する
// ============================================================
function handleAiError(err, res) {
  console.error('[AI Error]', err.message);

  if (err.isTimeout) {
    return res.status(504).json({
      error: { code: 'AI_TIMEOUT', message: '応答がタイムアウトしました。しばらくしてから再度お試しください。' }
    });
  }
  if (err.statusCode === 401) {
    return res.status(502).json({
      error: { code: 'AI_AUTH_ERROR', message: 'APIキーが無効です。AI設定を確認してください。' }
    });
  }
  return res.status(502).json({
    error: { code: 'AI_ERROR', message: 'AIとの通信中にエラーが発生しました。' }
  });
}

// ============================================================
// GET /api/ai/settings（requireAdmin — server.js でマウント済み）
// ============================================================

/**
 * @swagger
 * /ai/settings:
 *   get:
 *     summary: AI接続設定取得（admin のみ）
 *     tags: [AI]
 *     responses:
 *       200:
 *         description: AI設定（APIキーはマスク済み）
 */
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await getSettings();
    if (!settings) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'AI設定が見つかりません' } });
    }

    // APIキーをマスク表示
    res.json({
      data: {
        ...settings,
        openai_api_key: maskApiKey(settings.openai_api_key),
        dify_api_key:   maskApiKey(settings.dify_api_key),
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// PUT /api/ai/settings（requireAdmin — server.js でマウント済み）
// ============================================================

/**
 * @swagger
 * /ai/settings:
 *   put:
 *     summary: AI接続設定更新（admin のみ）
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               provider:             { type: string }
 *               openai_endpoint:      { type: string }
 *               openai_api_key:       { type: string }
 *               openai_model:         { type: string }
 *               openai_max_tokens:    { type: integer }
 *               openai_system_prompt: { type: string }
 *               dify_endpoint:        { type: string }
 *               dify_api_key:         { type: string }
 *     responses:
 *       200:
 *         description: 更新成功
 */
router.put('/settings', requireAdmin, async (req, res) => {
  const {
    provider, openai_endpoint, openai_api_key, openai_model,
    openai_max_tokens, openai_system_prompt,
    dify_endpoint, dify_api_key,
  } = req.body;

  const setClauses = [];
  const params     = [];

  const addField = (col, val) => {
    params.push(val);
    setClauses.push(`${col} = $${params.length}`);
  };

  if (provider             !== undefined) addField('provider',             provider);
  if (openai_endpoint      !== undefined) addField('openai_endpoint',      openai_endpoint || null);
  if (openai_model         !== undefined) addField('openai_model',         openai_model    || null);
  if (openai_max_tokens    !== undefined) addField('openai_max_tokens',    openai_max_tokens);
  if (openai_system_prompt !== undefined) addField('openai_system_prompt', openai_system_prompt || null);
  if (dify_endpoint        !== undefined) addField('dify_endpoint',        dify_endpoint   || null);

  // APIキーは暗号化して保存（マスク文字列 '••••...' が来た場合は更新しない）
  if (openai_api_key !== undefined && openai_api_key && !openai_api_key.startsWith('••••')) {
    addField('openai_api_key', encrypt(openai_api_key));
  }
  if (dify_api_key !== undefined && dify_api_key && !dify_api_key.startsWith('••••')) {
    addField('dify_api_key', encrypt(dify_api_key));
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '更新するフィールドがありません' } });
  }

  setClauses.push(`updated_at = NOW()`);

  try {
    const result = await pool.query(
      `UPDATE ai_settings SET ${setClauses.join(', ')} WHERE id = 1 RETURNING *`,
      params
    );

    const updated = result.rows[0];
    res.json({
      data: {
        ...updated,
        openai_api_key: maskApiKey(updated.openai_api_key),
        dify_api_key:   maskApiKey(updated.dify_api_key),
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// POST /api/ai/test（requireAdmin — server.js でマウント済み）
// ============================================================

/**
 * @swagger
 * /ai/test:
 *   post:
 *     summary: AI接続テスト（admin のみ）
 *     tags: [AI]
 *     responses:
 *       200:
 *         description: 接続テスト成功
 *       503:
 *         description: AI未設定
 */
router.post('/test', requireAdmin, async (req, res) => {
  try {
    const settings = await getSettings();
    if (!settings || settings.provider === 'none') {
      return res.status(503).json({
        error: { code: 'AI_NOT_CONFIGURED', message: 'AIプロバイダーが設定されていません' }
      });
    }

    const start = Date.now();

    if (settings.provider === 'openai') {
      const apiKey = decrypt(settings.openai_api_key || '');
      await openaiService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        context:  null,
        settings: {
          endpoint:     settings.openai_endpoint,
          apiKey,
          model:        settings.openai_model,
          maxTokens:    256,
          systemPrompt: '',
        },
      });

      return res.json({
        data: {
          success:    true,
          provider:   'openai',
          model:      settings.openai_model,
          latency_ms: Date.now() - start,
        }
      });
    }

    if (settings.provider === 'dify') {
      const apiKey = decrypt(settings.dify_api_key || '');
      await difyService.chat({
        messages:       [{ role: 'user', content: 'Hello' }],
        context:        null,
        settings:       { endpoint: settings.dify_endpoint, apiKey },
        conversationId: null,
      });

      return res.json({
        data: {
          success:    true,
          provider:   'dify',
          model:      null,
          latency_ms: Date.now() - start,
        }
      });
    }

    res.status(400).json({ error: { code: 'UNKNOWN_PROVIDER', message: '不明なプロバイダーです' } });
  } catch (err) {
    handleAiError(err, res);
  }
});

// ============================================================
// POST /api/ai/chat（requireAuth — server.js でマウント済み）
// ============================================================

/**
 * @swagger
 * /ai/chat:
 *   post:
 *     summary: AI助言チャット
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [messages]
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:    { type: string }
 *                     content: { type: string }
 *               context:
 *                 type: object
 *     responses:
 *       200:
 *         description: AI からの返答
 *       503:
 *         description: AI未設定
 */
router.post('/chat', async (req, res) => {
  const { messages, context } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'messages は必須です' } });
  }

  try {
    const settings = await getSettings();

    if (!settings || settings.provider === 'none') {
      return res.status(503).json({
        error: { code: 'AI_NOT_CONFIGURED', message: 'AI助言が設定されていません。管理者にお問い合わせください。' }
      });
    }

    if (settings.provider === 'openai') {
      const apiKey = decrypt(settings.openai_api_key || '');
      const reply  = await openaiService.chat({
        messages,
        context,
        settings: {
          endpoint:     settings.openai_endpoint,
          apiKey,
          model:        settings.openai_model,
          maxTokens:    settings.openai_max_tokens,
          systemPrompt: settings.openai_system_prompt || '',
        },
      });

      return res.json({
        data: {
          message:  reply,
          provider: 'openai',
          model:    settings.openai_model,
        }
      });
    }

    if (settings.provider === 'dify') {
      const apiKey        = decrypt(settings.dify_api_key || '');
      const conversationId = req.body.conversation_id || null;
      const result         = await difyService.chat({
        messages,
        context,
        settings:       { endpoint: settings.dify_endpoint, apiKey },
        conversationId,
      });

      return res.json({
        data: {
          message:         result.message,
          provider:        'dify',
          model:           null,
          conversation_id: result.conversationId,
        }
      });
    }

    res.status(400).json({ error: { code: 'UNKNOWN_PROVIDER', message: '不明なプロバイダーです' } });
  } catch (err) {
    handleAiError(err, res);
  }
});

module.exports = router;
