import type { Task } from "./types.ts";
import task01 from "./task-01-create-file.ts";
import task02 from "./task-02-organize-folders.ts";
import task03 from "./task-03-edit-text.ts";
import task04 from "./task-04-browser-form.ts";
import task05 from "./task-05-terminal-pipeline.ts";
import task06 from "./task-06-find-replace.ts";
import task07 from "./task-07-multi-step.ts";

export const allTasks: Task[] = [task01, task02, task03, task04, task05, task06, task07];

export type { Task, TaskResult } from "./types.ts";
