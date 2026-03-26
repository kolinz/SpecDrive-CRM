const fetch = require('node-fetch');

const TIMEOUT_MS = 30_000;

/**
 * OpenAI /chat/completions へのリレー
 *
 * @param {object} params
 * @param {Array}  params.messages    - 会話履歴 [{ role, content }]
 * @param {object} params.context     - CRM コンテキスト（JSON として systemPrompt に付与）
 * @param {object} params.settings    - { endpoint, apiKey, model, maxTokens, systemPrompt }
 * @returns {Promise<string>} AI の返答テキスト
 */
async function chat({ messages, context, settings }) {
  const {
    endpoint    = 'https://api.openai.com/v1',
    apiKey,
    model       = 'gpt-4o',
    maxTokens   = 2048,
    systemPrompt = '',
  } = settings;

  // CRM コンテキストを systemPrompt の末尾に付与
  const contextJson    = context ? JSON.stringify(context, null, 2) : '';
  const LINK_INSTRUCTION = `
回答する際、CRMデータ内のレコードに言及する場合は必ず以下のMarkdownリンク形式を使用してください:
- 商談: [商談名](/opportunity-detail.html?id=ID)
- 取引先企業: [企業名](/account-detail.html?id=ID)
- ケース: [件名](/case-detail.html?id=ID)
- 担当者: [氏名](/contact-detail.html?id=ID)
- ToDo: [タイトル](/todo-detail.html?id=ID)

IDはコンテキストデータのidフィールドの値を使用してください。`;

  const systemContent  = contextJson
    ? `${systemPrompt}\n\n${LINK_INSTRUCTION}\n\n# CRMコンテキスト\n${contextJson}`.trim()
    : (systemPrompt ? `${systemPrompt}\n\n${LINK_INSTRUCTION}` : `You are a helpful CRM assistant.\n\n${LINK_INSTRUCTION}`);

  const body = {
    model,
    max_completion_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemContent },
      ...messages,
    ],
  };

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${endpoint}/chat/completions`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body:   JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.status === 401) {
      const err = new Error('OPENAI_AUTH_ERROR');
      err.statusCode = 401;
      throw err;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      // OpenAI のエラーレスポンスから message を抽出
      let detail = `HTTP ${response.status}`;
      try {
        const json = JSON.parse(text);
        detail = json?.error?.message || detail;
      } catch { detail = text || detail; }
      const err  = new Error(`OpenAI API error: ${response.status}`);
      err.statusCode = response.status;
      err.detail     = detail;
      throw err;
    }

    const data    = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned empty content');
    return content;

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
