/**
 * syncAiSettings.js
 *
 * サーバー起動時に .env の AI 関連環境変数を ai_settings テーブルに反映する。
 * SEED_DATA の値に関わらず常に実行される。
 *
 * 反映ルール:
 *  - ai_settings レコード（id=1）が存在しない場合は INSERT する。
 *  - AI_PROVIDER が設定されている場合は provider を上書きする。
 *  - OPENAI_API_KEY が設定されている場合は暗号化して openai_api_key を上書きする。
 *  - OPENAI_ENDPOINT / OPENAI_MODEL も設定があれば上書きする。
 *  - DIFY_API_KEY / DIFY_ENDPOINT も同様。
 *  - 環境変数が空の場合は既存の DB 値を維持する（上書きしない）。
 */

const pool             = require('../db/pool');
const { encrypt }      = require('../services/crypto');

async function syncAiSettings() {
  try {
    // レコードがなければ最低限 INSERT
    await pool.query(
      `INSERT INTO ai_settings (id, provider) VALUES (1, 'none') ON CONFLICT DO NOTHING`
    );

    const setClauses = [];
    const params     = [];

    const addField = (col, val) => {
      params.push(val);
      setClauses.push(`${col} = $${params.length}`);
    };

    // AI_PROVIDER
    const provider = process.env.AI_PROVIDER;
    if (provider) addField('provider', provider);

    // OpenAI
    const openaiKey      = process.env.OPENAI_API_KEY;
    const openaiEndpoint = process.env.OPENAI_ENDPOINT;
    const openaiModel    = process.env.OPENAI_MODEL;

    if (openaiKey)      addField('openai_api_key',  encrypt(openaiKey));
    if (openaiEndpoint) addField('openai_endpoint', openaiEndpoint);
    if (openaiModel)    addField('openai_model',    openaiModel);

    // Dify
    const difyKey      = process.env.DIFY_API_KEY;
    const difyEndpoint = process.env.DIFY_ENDPOINT;

    if (difyKey)      addField('dify_api_key',  encrypt(difyKey));
    if (difyEndpoint) addField('dify_endpoint', difyEndpoint);

    if (setClauses.length > 0) {
      setClauses.push(`updated_at = NOW()`);
      await pool.query(
        `UPDATE ai_settings SET ${setClauses.join(', ')} WHERE id = 1`,
        params
      );
      console.log('[Boot] ai_settings synced from .env');
    }
  } catch (err) {
    console.error('[Boot] Failed to sync ai_settings:', err.message);
  }
}

module.exports = syncAiSettings;
