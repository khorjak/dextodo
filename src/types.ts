export type TodoStatus = "pending" | "started" | "completed";

export interface Todo {
  id: number;
  title: string;
  dueDate: string | null;
  status: TodoStatus;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}
