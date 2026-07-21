import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Todo, TodoStatus } from "./types";

interface TodoRow {
  id: number;
  title: string;
  due_date: string | null;
  status: TodoStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

function rowToTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    title: row.title,
    dueDate: row.due_date,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

export class TodoStore {
  private readonly db: Database;

  constructor(dbPath?: string) {
    const path = dbPath ?? TodoStore.defaultPath();
    const dir = join(path, "..");

    try {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      this.db = new Database(path, { create: true });
      this.db.run("PRAGMA journal_mode = WAL;");
      this.db.run(`
        CREATE TABLE IF NOT EXISTS todos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          due_date TEXT,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'started', 'completed')),
          started_at TEXT,
          completed_at TEXT,
          created_at TEXT NOT NULL
        );
      `);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`dexTodo: could not open database at ${path}: ${reason}`);
      process.exit(1);
    }
  }

  static defaultPath(): string {
    return join(homedir(), ".dextodo", "todos.sqlite");
  }

  listActive(): Todo[] {
    const rows = this.db
      .query<TodoRow, []>(
        `SELECT * FROM todos WHERE status != 'completed' ORDER BY
           CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC, created_at ASC`,
      )
      .all();
    return rows.map(rowToTodo);
  }

  listCompleted(): Todo[] {
    const rows = this.db
      .query<TodoRow, []>(`SELECT * FROM todos WHERE status = 'completed' ORDER BY completed_at DESC`)
      .all();
    return rows.map(rowToTodo);
  }

  get(id: number): Todo | null {
    const row = this.db.query<TodoRow, [number]>(`SELECT * FROM todos WHERE id = ?`).get(id);
    return row ? rowToTodo(row) : null;
  }

  add(title: string, dueDate: string | null): Todo {
    const now = new Date().toISOString();
    const result = this.db
      .query<{ id: number }, [string, string | null, string]>(
        `INSERT INTO todos (title, due_date, status, created_at) VALUES (?, ?, 'pending', ?) RETURNING id`,
      )
      .get(title, dueDate, now);
    return this.get(result!.id)!;
  }

  update(id: number, fields: { title?: string; dueDate?: string | null }): void {
    if (fields.title !== undefined) {
      this.db.query(`UPDATE todos SET title = ? WHERE id = ?`).run(fields.title, id);
    }
    if (fields.dueDate !== undefined) {
      this.db.query(`UPDATE todos SET due_date = ? WHERE id = ?`).run(fields.dueDate, id);
    }
  }

  markStarted(id: number): void {
    const now = new Date().toISOString();
    this.db
      .query(`UPDATE todos SET status = 'started', started_at = ? WHERE id = ? AND status = 'pending'`)
      .run(now, id);
  }

  markCompleted(id: number): void {
    const now = new Date().toISOString();
    this.db.query(`UPDATE todos SET status = 'completed', completed_at = ? WHERE id = ?`).run(now, id);
  }

  remove(id: number): void {
    this.db.query(`DELETE FROM todos WHERE id = ?`).run(id);
  }

  close(): void {
    this.db.close();
  }
}
