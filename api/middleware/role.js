/**
 * role.js — ロール別権限細分化ミドルウェア（将来拡張用スタブ）
 *
 * 現時点では通過のみ。
 * 将来的に READ / WRITE / DELETE の細粒度アクセス制御が必要になった場合、
 * このファイルにロール判定ロジックを追加する。
 *
 * 使用例（将来）:
 *   router.delete('/:id', requireAuth, canDelete('accounts'), handler);
 */

/**
 * 指定リソースの書き込み権限チェック（スタブ）
 */
const canWrite = (resource) => (req, res, next) => {
  // TODO: 仕様書 6.2 のロール・アクセス定義に基づき実装
  next();
};

/**
 * 指定リソースの削除権限チェック（スタブ）
 */
const canDelete = (resource) => (req, res, next) => {
  // TODO: 仕様書 6.2 のロール・アクセス定義に基づき実装
  next();
};

module.exports = { canWrite, canDelete };
