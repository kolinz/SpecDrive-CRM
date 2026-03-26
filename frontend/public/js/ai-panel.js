/**
 * ai-panel.js — AI助言サイドパネル共通処理
 */

const SUGGESTIONS = {
  dashboard:     ['受注確度の高い商談トップ5を教えて', '未解決の緊急ケースを一覧にして', '期限切れToDoを担当者別にまとめて'],
  opportunities: ['受注確度の高い商談を上位5件教えて', '今月クローズ予定の商談は？', 'ステージ別に商談を整理して'],
  cases:         ['緊急・高優先度のケースを一覧にして', '未解決ケースを担当者別にまとめて', '対応期限切れのケースは？'],
  todos:         ['期限切れToDoを優先度順に教えて', '担当者別の未完了タスク数は？', '今週中に完了すべきToDoは？'],
  accounts:      ['取引額の大きい取引先トップ5は？', 'フォローが必要な見込み企業を教えて', '業種別の取引先数を教えて'],
  contacts:      ['各企業のキーパーソンを一覧にして', '主要担当者（is_primary）を教えて'],
};

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

    // ページ別に詳細データも追加取得してコンテキストに含める
    try {
      const isDashboard = page === 'dashboard';

      // ダッシュボードは全エンティティを並列取得
      if (isDashboard) {
        const [oppsRes, casesRes, todosRes, accountsRes, contactsRes] = await Promise.all([
          window.api.get('/opportunities?limit=100'),
          window.api.get('/cases?limit=100'),
          window.api.get('/todos?limit=100'),
          window.api.get('/accounts?limit=100'),
          window.api.get('/contacts?limit=100'),
        ]);
        context.opportunities = (oppsRes.data     || []).map(o => ({ id: o.id, name: o.name, account: o.account?.name || o.account_name, owner: o.owner?.name || o.owner_name, stage: o.stage, amount: o.amount, probability: o.probability, close_date: o.close_date, lead_source: o.lead_source, next_step: o.next_step }));
        context.cases         = (casesRes.data    || []).map(c => ({ id: c.id, subject: c.subject, account: c.account?.name || c.account_name, assigned_to: c.assigned_user?.name || c.assigned_user_name, status: c.status, priority: c.priority, category: c.category, due_date: c.due_date }));
        context.todos         = (todosRes.data    || []).map(t => ({ id: t.id, title: t.title, assignee: t.assignee?.name || t.assignee_name, status: t.status, priority: t.priority, due_date: t.due_date, opportunity: t.opportunity?.name, case: t.case?.subject }));
        context.accounts      = (accountsRes.data || []).map(a => ({ id: a.id, name: a.name, industry: a.industry, status: a.status, annual_revenue: a.annual_revenue, employee_count: a.employee_count, contacts_count: a.contacts_count, opportunities_count: a.opportunities_count }));
        context.contacts      = (contactsRes.data || []).map(c => ({ id: c.id, name: `${c.last_name} ${c.first_name}`, account: c.account_name, title: c.title, department: c.department, email: c.email }));
      } else {
        if (page === 'opportunities') {
          const res = await window.api.get('/opportunities?limit=100');
          context.opportunities = (res.data || []).map(o => ({ id: o.id, name: o.name, account: o.account?.name || o.account_name, owner: o.owner?.name || o.owner_name, stage: o.stage, amount: o.amount, probability: o.probability, close_date: o.close_date, lead_source: o.lead_source, next_step: o.next_step }));
        } else if (page === 'cases') {
          const res = await window.api.get('/cases?limit=100');
          context.cases = (res.data || []).map(c => ({ id: c.id, subject: c.subject, account: c.account?.name || c.account_name, assigned_to: c.assigned_user?.name || c.assigned_user_name, status: c.status, priority: c.priority, category: c.category, due_date: c.due_date }));
        } else if (page === 'todos') {
          const res = await window.api.get('/todos?limit=100');
          context.todos = (res.data || []).map(t => ({ id: t.id, title: t.title, assignee: t.assignee?.name || t.assignee_name, status: t.status, priority: t.priority, due_date: t.due_date, opportunity: t.opportunity?.name, case: t.case?.subject }));
        } else if (page === 'accounts') {
          const res = await window.api.get('/accounts?limit=100');
          context.accounts = (res.data || []).map(a => ({ id: a.id, name: a.name, industry: a.industry, status: a.status, annual_revenue: a.annual_revenue, employee_count: a.employee_count, contacts_count: a.contacts_count, opportunities_count: a.opportunities_count }));
        } else if (page === 'contacts') {
          const res = await window.api.get('/contacts?limit=100');
          context.contacts = (res.data || []).map(c => ({ id: c.id, name: `${c.last_name} ${c.first_name}`, account: c.account_name, title: c.title, department: c.department, email: c.email }));
        }
      }
    } catch { /* 詳細取得失敗はサマリーのみで継続 */ }

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
