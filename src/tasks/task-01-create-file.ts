import type { Task } from "./types.ts";
import { fileExists, readFile } from "../executor.ts";

const task: Task = {
  id: "01",
  name: "Create a text file",
  difficulty: "Easy",
  prompt:
    "Open a terminal and create a file at /root/Documents/hello.txt with the content 'Hello, World!' (exactly this text). Then take a screenshot to confirm.",
  async verify() {
    const exists = await fileExists("/root/Documents/hello.txt");
    if (!exists) return { passed: false, detail: "File does not exist" };

    const content = await readFile("/root/Documents/hello.txt");
    if (content.includes("Hello, World!")) {
      return { passed: true, detail: "File exists with correct content" };
    }
    return { passed: false, detail: `Unexpected content: "${content}"` };
  },
};

export default task;
