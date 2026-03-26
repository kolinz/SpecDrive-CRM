/**
 * api.js — fetch ラッパー
 *
 * - baseURL = '/api'
 * - Authorization: Bearer <JWT> を自動付与
 * - 401 受信時は localStorage クリア → /login.html リダイレクト
 */

const BASE_URL = '/api';

function getToken() {
  return localStorage.getItem('token') || '';
}

async function request(method, path, body) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
  };

  const options = { method, headers };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, options);

  if (res.status === 401) {
    localStorage.clear();
    window.location.href = '/login.html';
    return;
  }

  // レスポンスが空の場合（204 No Content など）
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: { code: 'PARSE_ERROR', message: text } };
  }

  if (!res.ok) {
    const err = new Error(data?.error?.message || `HTTP ${res.status}`);
    err.code    = data?.error?.code || 'API_ERROR';
    err.status  = res.status;
    err.data    = data;
    throw err;
  }

  return data;
}

const api = {
  get:  (path)        => request('GET',    path),
  post: (path, body)  => request('POST',   path, body),
  put:  (path, body)  => request('PUT',    path, body),
  del:  (path)        => request('DELETE', path),
};

// グローバルに公開（<script> タグで読み込む場合）
window.api = api;
