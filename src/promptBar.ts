import {
  BoxRenderable,
  TextRenderable,
  InputRenderable,
  InputRenderableEvents,
  type RenderContext,
} from "@opentui/core";

/** A one-shot bottom prompt: label + input, resolves with the typed value or null on cancel. */
export class PromptBar {
  readonly root: BoxRenderable;
  readonly input: InputRenderable;
  private label: TextRenderable;
  private resolver: ((value: string | null) => void) | null = null;

  constructor(ctx: RenderContext) {
    this.root = new BoxRenderable(ctx, {
      id: "prompt-bar",
      height: 1,
      flexDirection: "row",
      backgroundColor: "#181825",
      visible: false,
      columnGap: 1,
    });

    this.label = new TextRenderable(ctx, {
      content: "",
      fg: "#f9e2af",
    });

    this.input = new InputRenderable(ctx, {
      flexGrow: 1,
      backgroundColor: "#181825",
      textColor: "#cdd6f4",
      focusedBackgroundColor: "#181825",
      focusedTextColor: "#cdd6f4",
    });

    this.root.add(this.label);
    this.root.add(this.input);

    this.input.on(InputRenderableEvents.ENTER, (value: string) => this.finish(value));
  }

  get visible(): boolean {
    return this.root.visible;
  }

  ask(label: string, initialValue = ""): Promise<string | null> {
    this.label.content = label;
    this.input.value = initialValue;
    this.root.visible = true;
    this.input.focus();
    return new Promise((resolve) => {
      this.resolver = resolve;
    });
  }

  cancel(): void {
    if (!this.resolver) return;
    this.input.blur();
    this.root.visible = false;
    const resolve = this.resolver;
    this.resolver = null;
    resolve(null);
  }

  private finish(value: string): void {
    if (!this.resolver) return;
    this.input.blur();
    this.root.visible = false;
    const resolve = this.resolver;
    this.resolver = null;
    resolve(value);
  }
}
