const fetch = require('node-fetch');

const TIMEOUT_MS = 30_000;

/**
 * Dify /chat-messages へのリレー
 *
 * @param {object} params
 * @param {Array}  params.messages        - 会話履歴（直近のユーザー発言を query として使用）
 * @param {object} params.context         - CRM コンテキスト（inputs.crm_context に付与）
 * @param {object} params.settings        - { endpoint, apiKey }
 * @param {string|null} params.conversationId - Dify の会話セッション ID（null の場合は新規）
 * @returns {Promise<{ message: string, conversationId: string }>}
 */
async function chat({ messages, context, settings, conversationId }) {
  const { endpoint, apiKey } = settings;

  if (!endpoint) throw new Error('Dify endpoint is not configured');

  // 直近のユーザーメッセージを query として使用
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  const query = lastUserMessage?.content || '';

  const body = {
    inputs:          { crm_context: context ? JSON.stringify(context) : '' },
    query,
    response_mode:   'blocking',
    conversation_id: conversationId || '',
    user:            'crm-user',
  };

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${endpoint}/chat-messages`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body:   JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.status === 401) {
      const err = new Error('DIFY_AUTH_ERROR');
      err.statusCode = 401;
      throw err;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const err  = new Error(`Dify API error: ${response.status} ${text}`);
      err.statusCode = response.status;
      throw err;
    }

    const data = await response.json();
    return {
      message:        data?.answer || '',
      conversationId: data?.conversation_id || conversationId || '',
    };

  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('TIMEOUT');
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { chat };
