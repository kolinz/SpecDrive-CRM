/**
 * ai-panel.js — AI助言サイドパネル共通処理
 */

const SUGGESTIONS = {
  dashboard:     ['今月の業績サマリーを教えて', '注目すべき商談は？', '期限切れToDoを整理して'],
  opportunities: ['各商談の次にとるべきアクションを教えて', '受注確度の高い商談を教えて', 'クローズ日が近い商談のリスクは？'],
  cases:         ['対応が遅れているケースを優先順に並べて', '緊急対応が必要なケースは？', '担当者の負荷状況は？'],
  todos:         ['期限切れToDoの対処方針を担当者別に提案して', '担当者別の負荷バランスは？', '今週完了すべき優先タスクは？'],
  accounts:      ['売上規模別にフォロー優先度を提案して', '最も取引額の大きい企業は？'],
  contacts:      ['キーパーソンを特定して', '連絡が取れていない担当者は？'],
};

// v1.2.5: レコード詳細コンテキスト定義
const RECORD_ENDPOINTS = {
  opportunities: '/opportunities?limit=50',
  cases:         '/cases?limit=50',
  accounts:      '/accounts?limit=50',
  todos:         '/todos?limit=50',
};

const RECORD_FIELDS = {
  opportunities: ['id','name','stage','amount','probability','close_date','next_step','description'],
  cases:         ['id','subject','status','priority','category','due_date','description'],
  accounts:      ['id','name','industry','status','annual_revenue','employee_count'],
  todos:         ['id','title','status','priority','due_date'],
};

function extractRecord(record, fields) {
  const obj = {};
  fields.forEach(f => { obj[f] = record[f] ?? null; });
  // ネストされた名前フィールドを文字列に展開
  if (record.owner)        obj.owner        = record.owner?.name        ?? null;
  if (record.assigned_to || record.assigned_user)
                           obj.assigned_to  = record.assigned_to?.name  ?? record.assigned_user?.name ?? null;
  if (record.assignee)     obj.assignee     = record.assignee?.name     ?? null;
  if (record.account)      obj.account      = record.account?.name      ?? record.account_name ?? null;
  if (record.opportunity)  obj.opportunity  = record.opportunity?.name  ?? null;
  if (record.case)         obj.case         = record.case?.subject      ?? null;
  return obj;
}

const ERROR_MESSAGES = {
  AI_NOT_CONFIGURED: 'AI助言が設定されていません。管理者にお問い合わせください。',
  AI_AUTH_ERROR:     'APIキーが無効です。AI設定を確認してください。',
  AI_TIMEOUT:        '応答がタイムアウトしました。しばらくしてから再度お試しください。',
  DEFAULT:           'AIとの通信中にエラーが発生しました。',
};

function initAiPanel(page) {
  // パネルの HTML を body に挿入（まだなければ）
  ensurePanelHTML();

  const panel       = document.getElementById('ai-panel');
  const btnAi       = document.getElementById('btn-ai');
  const btnClose    = document.getElementById('ai-close');
  const messagesEl  = document.getElementById('ai-messages');
  const inputEl     = document.getElementById('ai-input-text');
  const sendBtn     = document.getElementById('ai-send-btn');
  const footerEl    = document.getElementById('ai-footer');
  const suggestEl   = document.getElementById('ai-suggestions');

  let messages      = [];    // 会話履歴
  let context       = null;  // CRM コンテキスト
  let isOpen        = false;
  let isLoading     = false;

  // AI設定のフッター表示
  fetchFooterInfo(footerEl);

  // ----------------------------------------------------------
  // パネル開閉
  // ----------------------------------------------------------
  if (btnAi) {
    btnAi.addEventListener('click', () => {
      if (isOpen) {
        closePanel();
      } else {
        openPanel();
      }
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', closePanel);
  }

  function openPanel() {
    isOpen = true;
    panel.classList.add('open');
    // 開くたびに会話をリセット
    messages    = [];
    context     = null;
    messagesEl.innerHTML = '';
    // コンテキスト取得 → サジェスト表示
    loadContextAndSuggestions(page);
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove('open');
  }

  // ----------------------------------------------------------
  // コンテキスト取得とサジェスト表示
  // ----------------------------------------------------------
  async function loadContextAndSuggestions(page) {
    try {
      const res = await window.api.get('/stats/summary');
      context = { page, summary: res.data };
    } catch {
      context = { page };
    }

    // v1.2.5: 一覧画面のみ records を取得（50件固定）
    if (RECORD_ENDPOINTS[page]) {
      try {
        const res = await window.api.get(RECORD_ENDPOINTS[page]);
        const fields = RECORD_FIELDS[page];
        context.records = (res.data || []).map(r => extractRecord(r, fields));
      } catch { /* records 取得失敗はサマリーのみで継続 */ }
    }

    // サジェストボタン表示
    const chips = SUGGESTIONS[page] || [];
    if (suggestEl) {
      suggestEl.innerHTML = chips.map(text =>
        `<button class="ai-suggestion-btn" data-text="${escapeAttr(text)}">${text}</button>`
      ).join('');

      suggestEl.querySelectorAll('.ai-suggestion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          sendMessage(btn.dataset.text);
          suggestEl.innerHTML = ''; // 送信後はサジェストを消す
        });
      });
    }
  }

  // ----------------------------------------------------------
  // メッセージ送信
  // ----------------------------------------------------------
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      const text = inputEl.value.trim();
      if (text) {
        sendMessage(text);
        inputEl.value = '';
      }
    });
  }

  if (inputEl) {
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = inputEl.value.trim();
        if (text) {
          sendMessage(text);
          inputEl.value = '';
        }
      }
    });
  }

  async function sendMessage(text) {
    if (isLoading) return;

    // ユーザーバブルを表示
    appendBubble('user', text);
    messages.push({ role: 'user', content: text });

    // サジェスト非表示
    if (suggestEl) suggestEl.innerHTML = '';

    // ローディング表示
    const loadingEl = appendLoading();
    isLoading = true;
    if (sendBtn) sendBtn.disabled = true;

    try {
      const res = await window.api.post('/ai/chat', {
        messages,
        context,
      });

      loadingEl.remove();
      const reply = res.data.message;
      appendBubble('ai', reply);
      messages.push({ role: 'assistant', content: reply });

    } catch (err) {
      loadingEl.remove();
      const code = err.code || '';
      const msg  = ERROR_MESSAGES[code] || ERROR_MESSAGES.DEFAULT;
      appendBubble('ai', msg);
      // エラーメッセージは履歴に含めない
    } finally {
      isLoading = false;
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  // ----------------------------------------------------------
  // バブル追加
  // ----------------------------------------------------------
  function appendBubble(role, text) {
    const div = document.createElement('div');
    div.className = role === 'user' ? 'ai-bubble-user' : 'ai-bubble-ai';
    if (role === 'ai') {
      div.innerHTML = renderAiText(text);
      // リンクは新しいタブではなく同タブで遷移
      div.querySelectorAll('a').forEach(a => a.target = '_self');
    } else {
      div.textContent = text;
    }
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function appendLoading() {
    const div = document.createElement('div');
    div.className = 'ai-bubble-ai ai-loading';
    div.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }
}

// ----------------------------------------------------------
// フッター（プロバイダー情報）
// ----------------------------------------------------------
async function fetchFooterInfo(footerEl) {
  if (!footerEl) return;
  try {
    const res      = await window.api.get('/ai/settings');
    const settings = res.data;
    if (!settings || settings.provider === 'none') {
      footerEl.textContent = 'AI: 未設定';
      footerEl.classList.add('not-configured');
    } else if (settings.provider === 'openai') {
      footerEl.textContent = `OpenAI · ${settings.openai_model || 'gpt-4o'}`;
      footerEl.classList.remove('not-configured');
    } else if (settings.provider === 'dify') {
      footerEl.textContent = 'Dify';
      footerEl.classList.remove('not-configured');
    }
  } catch {
    footerEl.textContent = 'AI: 未設定';
    footerEl.classList.add('not-configured');
  }
}

// ----------------------------------------------------------
// パネル HTML を body に挿入
// ----------------------------------------------------------
function ensurePanelHTML() {
  if (document.getElementById('ai-panel')) return;

  const panel = document.createElement('div');
  panel.id        = 'ai-panel';
  panel.className = 'ai-panel';
  panel.innerHTML = `
    <div class="ai-header">
      <span class="ai-header-title">✦ AI助言</span>
      <button class="ai-header-close" id="ai-close">×</button>
    </div>
    <div class="ai-messages" id="ai-messages"></div>
    <div class="ai-suggestions" id="ai-suggestions"></div>
    <div class="ai-input">
      <input type="text" id="ai-input-text" placeholder="質問を入力...">
      <button id="ai-send-btn">送信</button>
    </div>
    <div class="ai-footer" id="ai-footer">AI: 未設定</div>
  `;

  // .app-shell の末尾に追加する
  const appShell = document.querySelector('.app-shell');
  if (appShell) {
    appShell.appendChild(panel);
  } else {
    document.body.appendChild(panel);
  }
}

// ----------------------------------------------------------
// AI テキストのレンダリング（Markdownサブセット → HTML）
//
// 対応記法:
//   [テキスト](/path)   → <a href="/path">テキスト</a>
//   **テキスト**        → <strong>テキスト</strong>
//   `テキスト`          → <code>テキスト</code>
//   - テキスト          → <li>テキスト</li>（箇条書き）
//   1. テキスト         → <li>テキスト</li>（番号付き）
//   \n                  → <br>
// ----------------------------------------------------------
function renderAiText(text) {
  if (!text) return '';

  // XSS対策：まず全体をエスケープ
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 行単位で処理
  const lines = escaped.split('\n');
  const htmlLines = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // 箇条書き（- または * で始まる行）
    if (/^[-*]\s+/.test(trimmed)) {
      if (!inList) { htmlLines.push('<ul style="margin:6px 0 6px 16px;padding:0;">'); inList = true; }
      const content = trimmed.replace(/^[-*]\s+/, '');
      htmlLines.push(`<li>${inlineFormat(content)}</li>`);
      continue;
    }
    // 番号付きリスト
    if (/^\d+\.\s+/.test(trimmed)) {
      if (!inList) { htmlLines.push('<ol style="margin:6px 0 6px 16px;padding:0;">'); inList = true; }
      const content = trimmed.replace(/^\d+\.\s+/, '');
      htmlLines.push(`<li>${inlineFormat(content)}</li>`);
      continue;
    }

    // リスト終了
    if (inList) {
      htmlLines.push(inList === 'ol' ? '</ol>' : '</ul>');
      inList = false;
    }

    // 空行
    if (!trimmed) {
      htmlLines.push('<br>');
      continue;
    }

    // 見出し風（## で始まる）
    if (/^#{1,3}\s+/.test(trimmed)) {
      const content = trimmed.replace(/^#{1,3}\s+/, '');
      htmlLines.push(`<strong style="display:block;margin-top:8px;">${inlineFormat(content)}</strong>`);
      continue;
    }

    htmlLines.push(`<span style="display:block;">${inlineFormat(trimmed)}</span>`);
  }

  if (inList) htmlLines.push('</ul>');

  return htmlLines.join('');
}

// インライン要素の変換（リンク・太字・コード）
function inlineFormat(text) {
  return text
    // Markdownリンク [テキスト](/path) → <a>
    .replace(/\[([^\]]+)\]\((\/[^)]*)\)/g,
      (_, label, href) =>
        `<a href="${href}" style="color:var(--accent);text-decoration:underline;">${label}</a>`)
    // **太字**
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // `コード`
    .replace(/`([^`]+)`/g,
      '<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:12px;">$1</code>');
}



window.initAiPanel = initAiPanel;

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
