import {
  BoxRenderable,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  TextAttributes,
  type CliRenderer,
  type KeyEvent,
  type SelectOption,
} from "@opentui/core";
import { TodoStore } from "./db";
import { PromptBar } from "./promptBar";
import { parseDate, formatStamp, todayStamp } from "./dateUtil";
import type { Todo } from "./types";

export class App {
  private readonly renderer: CliRenderer;
  private readonly root: BoxRenderable;
  private readonly hotkeysText: TextRenderable;
  private readonly activeList: SelectRenderable;
  private readonly completedList: SelectRenderable;
  private readonly activeBox: BoxRenderable;
  private readonly completedBox: BoxRenderable;
  private readonly promptBar: PromptBar;
  private readonly statusText: TextRenderable;

  private readonly store: TodoStore;
  private readonly focusables: SelectRenderable[];
  private focusIdx = 0;
  private statusTimer: ReturnType<typeof setTimeout> | null = null;

  private static readonly PAGE_SIZE = 10;
  private activePage = 0;
  private completedPage = 0;

  constructor(renderer: CliRenderer, store: TodoStore) {
    this.renderer = renderer;
    this.store = store;

    this.root = new BoxRenderable(renderer, {
      flexGrow: 1,
      flexDirection: "column",
      backgroundColor: "#1e1e2e",
    });

    const titleText = new TextRenderable(renderer, {
      content: " dexTodo",
      fg: "#11111b",
      attributes: TextAttributes.BOLD,
    });
    this.hotkeysText = new TextRenderable(renderer, {
      content: "a Add  Enter Modify  s Start  c Complete  d Delete  PgUp/PgDn Page  Tab Switch  q Quit ",
      fg: "#11111b",
    });
    const titleBar = new BoxRenderable(renderer, {
      height: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: "#89b4fa",
    });
    titleBar.add(titleText);
    titleBar.add(this.hotkeysText);

    this.activeList = new SelectRenderable(renderer, {
      flexGrow: 1,
      backgroundColor: "#1e1e2e",
      textColor: "#cdd6f4",
      focusedBackgroundColor: "#1e1e2e",
      focusedTextColor: "#cdd6f4",
      selectedBackgroundColor: "#45475a",
      selectedTextColor: "#f5e0dc",
      descriptionColor: "#a6adc8",
      selectedDescriptionColor: "#bac2de",
      showDescription: true,
      wrapSelection: true,
    });
    this.activeBox = new BoxRenderable(renderer, {
      flexGrow: 3,
      flexDirection: "column",
      border: true,
      borderStyle: "rounded",
      borderColor: "#89b4fa",
      title: "Active",
      titleAlignment: "left",
    });
    this.activeBox.add(this.activeList);

    this.completedList = new SelectRenderable(renderer, {
      flexGrow: 1,
      backgroundColor: "#1e1e2e",
      textColor: "#6c7086",
      focusedBackgroundColor: "#1e1e2e",
      focusedTextColor: "#a6adc8",
      selectedBackgroundColor: "#313244",
      selectedTextColor: "#cdd6f4",
      descriptionColor: "#6c7086",
      selectedDescriptionColor: "#a6adc8",
      showDescription: true,
      wrapSelection: true,
    });
    this.completedBox = new BoxRenderable(renderer, {
      flexGrow: 2,
      flexDirection: "column",
      border: true,
      borderStyle: "rounded",
      borderColor: "#585b70",
      title: "Completed",
      titleAlignment: "left",
    });
    this.completedBox.add(this.completedList);

    this.promptBar = new PromptBar(renderer);

    this.statusText = new TextRenderable(renderer, {
      content: "",
      height: 1,
      fg: "#11111b",
    });
    const statusBar = new BoxRenderable(renderer, {
      height: 1,
      backgroundColor: "#89b4fa",
      paddingLeft: 1,
    });
    statusBar.add(this.statusText);

    this.root.add(titleBar);
    this.root.add(this.activeBox);
    this.root.add(this.completedBox);
    this.root.add(this.promptBar.root);
    this.root.add(statusBar);

    renderer.root.add(this.root);

    this.activeList.on(SelectRenderableEvents.ITEM_SELECTED, (_i: number, option: SelectOption) =>
      this.modify(option.value as number),
    );
    this.completedList.on(SelectRenderableEvents.ITEM_SELECTED, (_i: number, option: SelectOption) =>
      this.modify(option.value as number),
    );

    renderer.keyInput.on("keypress", (key) => this.handleGlobalKey(key));

    this.focusables = [this.activeList, this.completedList];
    this.focusCurrent();
    this.refresh();
  }

  private focusCurrent(): void {
    this.focusables[this.focusIdx]?.focus();
  }

  private blurCurrent(): void {
    this.focusables[this.focusIdx]?.blur();
  }

  private cycleFocus(): void {
    this.blurCurrent();
    this.focusIdx = (this.focusIdx + 1) % this.focusables.length;
    this.focusCurrent();
  }

  private currentList(): SelectRenderable {
    return this.focusables[this.focusIdx]!;
  }

  private flash(message: string): void {
    this.statusText.content = ` ${message}`;
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.statusTimer = setTimeout(() => {
      this.statusText.content = "";
      this.renderer.requestRender();
    }, 2500);
  }

  private paginate<T>(items: T[], page: number): { slice: T[]; page: number; totalPages: number; total: number } {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / App.PAGE_SIZE));
    const clampedPage = Math.min(Math.max(page, 0), totalPages - 1);
    const start = clampedPage * App.PAGE_SIZE;
    return { slice: items.slice(start, start + App.PAGE_SIZE), page: clampedPage, totalPages, total };
  }

  private paginatedTitle(label: string, pag: { page: number; totalPages: number; total: number }): string {
    const pageInfo = pag.totalPages > 1 ? ` — page ${pag.page + 1}/${pag.totalPages}` : "";
    return `${label} (${pag.total})${pageInfo}`;
  }

  private refresh(): void {
    const active = this.paginate(this.store.listActive(), this.activePage);
    this.activePage = active.page;
    const completed = this.paginate(this.store.listCompleted(), this.completedPage);
    this.completedPage = completed.page;

    const activeOptions: SelectOption[] = active.slice.map((todo) => ({
      name: `${todo.status === "started" ? "[~]" : "[ ]"} ${todo.title}`,
      description: describeActive(todo),
      value: todo.id,
    }));
    const completedOptions: SelectOption[] = completed.slice.map((todo) => ({
      name: `[x] ${todo.title}`,
      description: describeCompleted(todo),
      value: todo.id,
    }));

    this.activeList.options = activeOptions;
    this.completedList.options = completedOptions;
    this.activeBox.title = this.paginatedTitle("Active", active);
    this.completedBox.title = this.paginatedTitle("Completed", completed);
  }

  private changePage(delta: number): void {
    const isActive = this.currentList() === this.activeList;
    const total = isActive ? this.store.listActive().length : this.store.listCompleted().length;
    const totalPages = Math.max(1, Math.ceil(total / App.PAGE_SIZE));
    if (isActive) {
      this.activePage = Math.min(Math.max(this.activePage + delta, 0), totalPages - 1);
    } else {
      this.completedPage = Math.min(Math.max(this.completedPage + delta, 0), totalPages - 1);
    }
    this.refresh();
    this.currentList().setSelectedIndex(0);
  }

  // ---- commands ----

  private async addTodo(): Promise<void> {
    this.blurCurrent();
    const title = await this.promptBar.ask("New todo:");
    if (!title || !title.trim()) {
      this.focusCurrent();
      if (title !== null) this.flash("Title cannot be empty");
      return;
    }

    const dueInput = await this.promptBar.ask("Due date (YYYY-MM-DD, optional):", todayStamp());
    this.focusCurrent();

    let dueDate: string | null = null;
    if (dueInput && dueInput.trim()) {
      dueDate = parseDate(dueInput.trim());
      if (!dueDate) {
        this.flash(`Ignored invalid date "${dueInput.trim()}" (expected YYYY-MM-DD)`);
      }
    }

    try {
      this.store.add(title.trim(), dueDate);
    } catch (err) {
      this.flash(`Failed to add todo: ${errorMessage(err)}`);
      return;
    }
    this.refresh();
    this.flash(`Added "${title.trim()}"`);
  }

  private async modify(id: number): Promise<void> {
    const todo = this.store.get(id);
    if (!todo) return;

    this.blurCurrent();
    const title = await this.promptBar.ask("Edit title:", todo.title);
    if (title === null) {
      this.focusCurrent();
      return;
    }
    if (!title.trim()) {
      this.focusCurrent();
      this.flash("Title cannot be empty");
      return;
    }

    const dueInput = await this.promptBar.ask("Edit due date (YYYY-MM-DD, blank = none):", todo.dueDate ?? "");
    this.focusCurrent();

    const fields: { title?: string; dueDate?: string | null } = { title: title.trim() };
    if (dueInput !== null) {
      if (!dueInput.trim()) {
        fields.dueDate = null;
      } else {
        const parsed = parseDate(dueInput.trim());
        if (parsed) {
          fields.dueDate = parsed;
        } else {
          this.flash(`Ignored invalid date "${dueInput.trim()}" (expected YYYY-MM-DD)`);
        }
      }
    }

    try {
      this.store.update(id, fields);
    } catch (err) {
      this.flash(`Failed to update todo: ${errorMessage(err)}`);
      return;
    }
    this.refresh();
    this.flash(`Updated "${title.trim()}"`);
  }

  private markStarted(): void {
    if (this.currentList() !== this.activeList) return;
    const option = this.activeList.getSelectedOption();
    if (!option) return;
    const todo = this.store.get(option.value as number);
    if (!todo || todo.status !== "pending") return;
    this.store.markStarted(todo.id);
    this.refresh();
    this.flash(`Started "${todo.title}"`);
  }

  private markCompleted(): void {
    if (this.currentList() !== this.activeList) return;
    const option = this.activeList.getSelectedOption();
    if (!option) return;
    const todo = this.store.get(option.value as number);
    if (!todo) return;
    this.store.markCompleted(todo.id);
    this.refresh();
    this.flash(`Completed "${todo.title}"`);
  }

  private async deleteTodo(): Promise<void> {
    if (this.currentList() !== this.completedList) return;
    const option = this.completedList.getSelectedOption();
    if (!option) return;
    const todo = this.store.get(option.value as number);
    if (!todo) return;

    this.blurCurrent();
    const answer = await this.promptBar.ask(`Delete "${todo.title}"? (y/N)`);
    this.focusCurrent();
    if (answer === null || answer.trim().toLowerCase() !== "y") {
      this.flash("Delete cancelled");
      return;
    }

    try {
      this.store.remove(todo.id);
    } catch (err) {
      this.flash(`Failed to delete todo: ${errorMessage(err)}`);
      return;
    }
    this.refresh();
    this.flash(`Deleted "${todo.title}"`);
  }

  private quit(): void {
    this.store.close();
    this.renderer.destroy();
    process.exit(0);
  }

  // ---- key routing ----

  private handleGlobalKey(key: KeyEvent): void {
    if (this.promptBar.visible) {
      if (key.name === "escape") {
        this.promptBar.cancel();
        key.preventDefault();
      }
      return;
    }

    if (key.name === "tab") {
      this.cycleFocus();
      key.preventDefault();
      return;
    }

    switch (key.name) {
      case "a":
        this.addTodo();
        key.preventDefault();
        return;
      case "s":
        this.markStarted();
        key.preventDefault();
        return;
      case "c":
        this.markCompleted();
        key.preventDefault();
        return;
      case "d":
        this.deleteTodo();
        key.preventDefault();
        return;
      case "pageup":
        this.changePage(-1);
        key.preventDefault();
        return;
      case "pagedown":
        this.changePage(1);
        key.preventDefault();
        return;
      case "q":
        this.quit();
        key.preventDefault();
        return;
    }
  }
}

function describeActive(todo: Todo): string {
  const parts: string[] = [];
  if (todo.status === "started") parts.push("started");
  if (todo.dueDate) parts.push(`due ${todo.dueDate}`);
  return parts.join(" · ");
}

function describeCompleted(todo: Todo): string {
  const parts: string[] = [];
  if (todo.completedAt) parts.push(`completed ${formatStamp(todo.completedAt)}`);
  if (todo.dueDate) parts.push(`due ${todo.dueDate}`);
  return parts.join(" · ");
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
