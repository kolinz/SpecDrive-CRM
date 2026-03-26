const express = require('express');
const pool    = require('../db/pool');

const router = express.Router();

// ============================================================
// GET /api/todos
// ============================================================

/**
 * @swagger
 * /todos:
 *   get:
 *     summary: ToDo一覧取得
 *     tags: [Todos]
 *     parameters:
 *       - in: query
 *         name: assignee_id
 *         schema: { type: integer }
 *       - in: query
 *         name: opportunity_id
 *         schema: { type: integer }
 *       - in: query
 *         name: case_id
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: priority
 *         schema: { type: string }
 *       - in: query
 *         name: due_date_from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: due_date_to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: overdue
 *         schema: { type: boolean }
 *         description: true の場合、期限切れ（due_date < 今日 かつ status != done）のみ
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: ToDo一覧
 */
router.get('/', async (req, res) => {
  try {
    let { assignee_id, opportunity_id, case_id, status, priority,
          due_date_from, due_date_to, overdue,
          page = 1, limit = 20 } = req.query;

    page  = Math.max(1, parseInt(page)  || 1);
    limit = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params     = [];

    if (assignee_id) {
      params.push(parseInt(assignee_id));
      conditions.push(`t.assignee_id = $${params.length}`);
    }
    if (opportunity_id) {
      params.push(parseInt(opportunity_id));
      conditions.push(`t.opportunity_id = $${params.length}`);
    }
    if (case_id) {
      params.push(parseInt(case_id));
      conditions.push(`t.case_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`t.status = $${params.length}`);
    }
    if (priority) {
      params.push(priority);
      conditions.push(`t.priority = $${params.length}`);
    }
    if (due_date_from) {
      params.push(due_date_from);
      conditions.push(`t.due_date >= $${params.length}`);
    }
    if (due_date_to) {
      params.push(due_date_to);
      conditions.push(`t.due_date <= $${params.length}`);
    }
    if (overdue === 'true') {
      conditions.push(`t.due_date < CURRENT_DATE`);
      conditions.push(`t.status != 'done'`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM todos t ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT
         t.*,
         u.name  AS assignee_name,
         o.name  AS opportunity_name,
         cs.subject AS case_subject
       FROM todos t
       LEFT JOIN users         u  ON u.id  = t.assignee_id
       LEFT JOIN opportunities o  ON o.id  = t.opportunity_id
       LEFT JOIN cases         cs ON cs.id = t.case_id
       ${where}
       ORDER BY
         CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
         t.due_date ASC,
         CASE t.priority
           WHEN 'high'   THEN 1
           WHEN 'medium' THEN 2
           WHEN 'low'    THEN 3
           ELSE 4
         END
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const rows = dataResult.rows.map(row => ({
      ...row,
      assignee:    row.assignee_id    ? { id: row.assignee_id,    name: row.assignee_name    } : null,
      opportunity: row.opportunity_id ? { id: row.opportunity_id, name: row.opportunity_name } : null,
      case:        row.case_id        ? { id: row.case_id,        subject: row.case_subject  } : null,
    }));

    res.json({ data: rows, meta: { total, page, limit } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// GET /api/todos/:id
// ============================================================

/**
 * @swagger
 * /todos/{id}:
 *   get:
 *     summary: ToDo詳細取得
 *     tags: [Todos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: ToDo詳細（assignee / opportunity / case 含む）
 *       404:
 *         description: ToDoが見つかりません
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         t.*,
         u.id         AS u_id,
         u.name       AS u_name,
         o.id         AS o_id,
         o.name       AS o_name,
         cs.id        AS cs_id,
         cs.subject   AS cs_subject
       FROM todos t
       LEFT JOIN users         u  ON u.id  = t.assignee_id
       LEFT JOIN opportunities o  ON o.id  = t.opportunity_id
       LEFT JOIN cases         cs ON cs.id = t.case_id
       WHERE t.id = $1`,
      [id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'ToDoが見つかりません' } });
    }

    const row = result.rows[0];

    const todo = {
      ...row,
      assignee:    row.assignee_id    ? { id: row.u_id,  name: row.u_name       } : null,
      opportunity: row.opportunity_id ? { id: row.o_id,  name: row.o_name       } : null,
      case:        row.case_id        ? { id: row.cs_id, subject: row.cs_subject } : null,
    };

    ['u_id','u_name','o_id','o_name','cs_id','cs_subject'].forEach(k => delete todo[k]);

    res.json({ data: todo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// POST /api/todos
// ============================================================

/**
 * @swagger
 * /todos:
 *   post:
 *     summary: ToDo新規作成
 *     tags: [Todos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, status, priority]
 *             properties:
 *               title:          { type: string }
 *               status:         { type: string }
 *               priority:       { type: string }
 *               description:    { type: string,  nullable: true }
 *               assignee_id:    { type: integer, nullable: true }
 *               opportunity_id: { type: integer, nullable: true }
 *               case_id:        { type: integer, nullable: true }
 *               due_date:       { type: string, format: date,    nullable: true }
 *               due_time:       { type: string, format: time,    nullable: true }
 *     responses:
 *       201:
 *         description: 作成成功
 *       400:
 *         description: バリデーションエラー
 */
router.post('/', async (req, res) => {
  const { title, status, priority, description, assignee_id,
          opportunity_id, case_id, due_date, due_time } = req.body;

  if (!title || !status || !priority) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'タイトル・ステータス・優先度は必須です' }
    });
  }

  // status が 'done' で作成された場合は completed_at をセット
  const completedAt = status === 'done' ? new Date() : null;

  try {
    const result = await pool.query(
      `INSERT INTO todos
         (title, status, priority, description, assignee_id,
          opportunity_id, case_id, due_date, due_time, completed_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [title, status, priority,
       description    || null,
       assignee_id    || null,
       opportunity_id || null,
       case_id        || null,
       due_date       || null,
       due_time       || null,
       completedAt,
       req.user.id]
    );

    const row = result.rows[0];

    // assignee / opportunity / case を整形して返す
    const [assigneeRes, oppRes, caseRes] = await Promise.all([
      row.assignee_id    ? pool.query('SELECT id, name FROM users WHERE id = $1',         [row.assignee_id])    : null,
      row.opportunity_id ? pool.query('SELECT id, name FROM opportunities WHERE id = $1', [row.opportunity_id]) : null,
      row.case_id        ? pool.query('SELECT id, subject FROM cases WHERE id = $1',      [row.case_id])        : null,
    ]);

    res.status(201).json({
      data: {
        ...row,
        assignee:    assigneeRes ? assigneeRes.rows[0] : null,
        opportunity: oppRes      ? oppRes.rows[0]      : null,
        case:        caseRes     ? caseRes.rows[0]     : null,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// PUT /api/todos/:id
// ============================================================

/**
 * @swagger
 * /todos/{id}:
 *   put:
 *     summary: ToDo更新
 *     tags: [Todos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 更新成功
 *       404:
 *         description: ToDoが見つかりません
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const fields  = ['title', 'status', 'priority', 'description', 'assignee_id',
                   'opportunity_id', 'case_id', 'due_date', 'due_time'];

  const setClauses = [];
  const params     = [];

  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      const val = req.body[f] === '' ? null : req.body[f];
      params.push(val);
      setClauses.push(`${f} = $${params.length}`);
    }
  });

  if (setClauses.length === 0) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '更新するフィールドがありません' } });
  }

  // completed_at の自動制御
  if (req.body.status === 'done') {
    setClauses.push(`completed_at = NOW()`);
  } else if (req.body.status !== undefined) {
    // done 以外のステータスに変更された場合は completed_at を NULL に戻す
    setClauses.push(`completed_at = NULL`);
  }

  setClauses.push(`updated_at = NOW()`);
  params.push(id);

  try {
    const result = await pool.query(
      `UPDATE todos SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'ToDoが見つかりません' } });
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ============================================================
// DELETE /api/todos/:id
// ============================================================

/**
 * @swagger
 * /todos/{id}:
 *   delete:
 *     summary: ToDo削除
 *     tags: [Todos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 削除成功
 *       404:
 *         description: ToDoが見つかりません
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM todos WHERE id = $1 RETURNING id',
      [id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'ToDoが見つかりません' } });
    }
    res.json({ data: { id: parseInt(id), deleted: true } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

module.exports = router;
