/**
 * utils.js — 共通ユーティリティ
 */

// ============================================================
// 日付フォーマット
// ============================================================
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return '—';
    const y  = d.getFullYear();
    const m  = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${dd}`;
  } catch {
    return '—';
  }
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return '—';
    const y  = d.getFullYear();
    const m  = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const h  = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${y}/${m}/${dd} ${h}:${mi}`;
  } catch {
    return '—';
  }
}

// ============================================================
// 金額フォーマット（¥1,234万）
// ============================================================
function formatAmount(amount) {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = parseFloat(amount);
  if (isNaN(n)) return '—';
  if (n === 0) return '¥0';
  if (n >= 100_000_000) {
    return `¥${(n / 100_000_000).toFixed(1).replace(/\.0$/, '')}億`;
  }
  if (n >= 10_000) {
    return `¥${Math.round(n / 10_000).toLocaleString()}万`;
  }
  return `¥${n.toLocaleString()}`;
}

// ============================================================
// ステージ名（日本語）
// ============================================================
const STAGE_NAMES = {
  prospecting:   '見込み',
  qualification: '要件確認',
  proposal:      '提案中',
  negotiation:   '交渉中',
  closed_won:    '受注',
  closed_lost:   '失注',
};

function stageName(stage) {
  return STAGE_NAMES[stage] || stage || '—';
}

function stageBadgeClass(stage) {
  const map = {
    prospecting:   'badge-prospecting',
    qualification: 'badge-qualification',
    proposal:      'badge-proposal',
    negotiation:   'badge-negotiation',
    closed_won:    'badge-closed-won',
    closed_lost:   'badge-closed-lost',
  };
  return map[stage] || 'badge';
}

function stageBadge(stage) {
  return `<span class="badge ${stageBadgeClass(stage)}">${stageName(stage)}</span>`;
}

// ============================================================
// 優先度バッジ
// ============================================================
const PRIORITY_LABELS = {
  critical: '緊急',
  high:     '高',
  medium:   '中',
  low:      '低',
};

function priorityBadge(priority) {
  const label = PRIORITY_LABELS[priority] || priority || '—';
  return `<span class="badge badge-${priority || 'medium'}">${label}</span>`;
}

// ============================================================
// ステータスバッジ
// ============================================================
const STATUS_LABELS = {
  // ケース
  open:        'オープン',
  in_progress: '対応中',
  pending:     '保留',
  resolved:    '解決済',
  closed:      'クローズ',
  // ToDo
  done:        '完了',
  cancelled:   'キャンセル',
  // 取引先
  active:      'アクティブ',
  prospect:    '見込み',
  inactive:    '無効',
};

function statusBadge(status) {
  const label    = STATUS_LABELS[status] || status || '—';
  const cssClass = status ? `badge-${status.replace(/_/g, '-')}` : '';
  return `<span class="badge ${cssClass}">${label}</span>`;
}

// ============================================================
// トースト通知
// ============================================================
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // アニメーション終了後に削除（3秒）
  setTimeout(() => toast.remove(), 3100);
}

// ============================================================
// 確認ダイアログ
// ============================================================
function showConfirm({ title = '確認', message, onConfirm }) {
  let overlay = document.getElementById('confirm-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id        = 'confirm-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-title" id="confirm-title"></div>
        <div class="modal-message" id="confirm-message"></div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="confirm-cancel">キャンセル</button>
          <button class="btn btn-danger"    id="confirm-ok">削除する</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }

  document.getElementById('confirm-title').textContent   = title;
  document.getElementById('confirm-message').textContent = message;
  overlay.classList.add('open');

  const close = () => overlay.classList.remove('open');

  document.getElementById('confirm-cancel').onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  document.getElementById('confirm-ok').onclick = () => {
    close();
    onConfirm();
  };
}

// ============================================================
// 検索セレクト（取引先・担当者・商談・ケースで共通使用）
// ============================================================
/**
 * @param {object} opts
 * @param {HTMLInputElement} opts.inputEl   - テキスト入力欄
 * @param {HTMLElement}      opts.listEl    - ドロップダウンリスト要素
 * @param {Function}         opts.fetchFn   - 非同期で候補配列を返す関数 (query) => [{id, label}]
 * @param {Function}         opts.onSelect  - 選択時コールバック ({id, label}) => void
 */
function searchSelect({ inputEl, listEl, fetchFn, onSelect }) {
  let debounceTimer = null;
  let selectedId    = null;

  listEl.classList.add('search-select-list');

  inputEl.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = inputEl.value.trim();
    if (!q) {
      listEl.classList.remove('open');
      listEl.innerHTML = '';
      return;
    }
    debounceTimer = setTimeout(async () => {
      try {
        const items = await fetchFn(q);
        renderList(items);
      } catch {
        listEl.classList.remove('open');
      }
    }, 300);
  });

  inputEl.addEventListener('focus', async () => {
    const q = inputEl.value.trim();
    if (q.length >= 0) {
      try {
        const items = await fetchFn(q);
        renderList(items);
      } catch { /* ignore */ }
    }
  });

  // 外側クリックで閉じる
  document.addEventListener('click', (e) => {
    if (!inputEl.contains(e.target) && !listEl.contains(e.target)) {
      listEl.classList.remove('open');
    }
  });

  function renderList(items) {
    listEl.innerHTML = '';
    if (!items || items.length === 0) {
      const li = document.createElement('div');
      li.className   = 'search-select-item';
      li.textContent = '候補が見つかりません';
      li.style.color = '#9ca3af';
      listEl.appendChild(li);
    } else {
      items.forEach(item => {
        const li = document.createElement('div');
        li.className   = 'search-select-item';
        li.textContent = item.label;
        if (item.id == selectedId) li.classList.add('selected');
        li.addEventListener('mousedown', (e) => {
          e.preventDefault();
          selectedId         = item.id;
          inputEl.value      = item.label;
          listEl.classList.remove('open');
          onSelect(item);
        });
        listEl.appendChild(li);
      });
    }
    listEl.classList.add('open');
  }

  // 外から値をリセットするための関数を返す
  return {
    clear() {
      selectedId    = null;
      inputEl.value = '';
      listEl.classList.remove('open');
    },
    setValue(id, label) {
      selectedId    = id;
      inputEl.value = label || '';
    },
  };
}

// ============================================================
// グローバルに公開
// ============================================================
window.formatDate    = formatDate;
window.formatDateTime = formatDateTime;
window.formatAmount  = formatAmount;
window.stageName     = stageName;
window.stageBadge    = stageBadge;
window.priorityBadge = priorityBadge;
window.statusBadge   = statusBadge;
window.showToast     = showToast;
window.showConfirm   = showConfirm;
window.searchSelect  = searchSelect;
