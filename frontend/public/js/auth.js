/**
 * auth.js — 認証ガード・ユーザー情報ユーティリティ
 */

// ============================================================
// JWT デコード（署名検証なし。フロント表示用）
// ============================================================
function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

function isTokenValid(token) {
  if (!token) return false;
  const decoded = decodeToken(token);
  if (!decoded) return false;
  // exp（秒）と現在時刻（秒）を比較
  return decoded.exp && decoded.exp * 1000 > Date.now();
}

// ============================================================
// guardCRM() — CRM業務画面用ガード（全ロール共通）
// ============================================================
function guardCRM() {
  const token = localStorage.getItem('token');
  if (!isTokenValid(token)) {
    localStorage.clear();
    window.location.href = '/login.html';
  }
}

// ============================================================
// guardAdmin() — システム管理画面用ガード（admin のみ）
// ============================================================
function guardAdmin() {
  const token = localStorage.getItem('token');
  if (!isTokenValid(token)) {
    localStorage.clear();
    window.location.href = '/login.html';
    return;
  }
  const user = decodeToken(token);
  if (!user || user.role !== 'admin') {
    window.location.href = '/login.html';
  }
}

// ============================================================
// getUser() — JWT のペイロードを返す
// ============================================================
function getUser() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  return decodeToken(token); // { id, username, role }
}

// ============================================================
// logout()
// ============================================================
function logout() {
  localStorage.clear();
  window.location.href = '/login.html';
}

// ============================================================
// renderNavUserInfo() — サイドバーのユーザー情報を更新
// ============================================================
function renderNavUserInfo() {
  const user      = getUser();
  const nameEl    = document.getElementById('nav-user-name');
  const roleEl    = document.getElementById('nav-user-role');
  const logoutEl  = document.getElementById('btn-logout');
  const topbarEl  = document.getElementById('topbar-user');

  const roleLabel = {
    admin:   '管理者',
    manager: 'マネージャー',
    staff:   'スタッフ',
  };

  if (user) {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const displayName = storedUser.name || user.username;

    if (nameEl) nameEl.textContent = displayName;
    if (roleEl) roleEl.textContent = roleLabel[user.role] || user.role;
    if (topbarEl) topbarEl.textContent = displayName;
  }

  if (logoutEl) {
    logoutEl.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }
}

// ============================================================
// renderAdminNavLink() — admin のみ「システム管理」リンクを表示
// ============================================================
function renderAdminNavLink() {
  const user = getUser();
  const el   = document.getElementById('nav-admin-link');
  if (el) {
    el.style.display = (user && user.role === 'admin') ? 'flex' : 'none';
  }
}

// グローバルに公開
window.guardCRM           = guardCRM;
window.guardAdmin         = guardAdmin;
window.getUser            = getUser;
window.logout             = logout;
window.renderNavUserInfo  = renderNavUserInfo;
window.renderAdminNavLink = renderAdminNavLink;
