import { createCliRenderer } from "@opentui/core";
import { App } from "./app";
import { TodoStore } from "./db";

const store = new TodoStore();
const renderer = await createCliRenderer({});
new App(renderer, store);
