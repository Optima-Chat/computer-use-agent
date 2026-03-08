import type { Task } from "./types.ts";
import { readFile, runBash } from "../executor.ts";

const task: Task = {
  id: "06",
  name: "Find and replace",
  difficulty: "Hard",
  prompt:
    'Open the file /root/Desktop/replace.txt in Mousepad (run: mousepad /root/Desktop/replace.txt). Use the Find and Replace feature (Ctrl+H) to replace all occurrences of "foo" with "bar". Save the file and close the editor.',
  async setup() {
    await runBash("cp /tmp/fixtures/replace.txt /root/Desktop/replace.txt");
  },
  async verify() {
    const content = await readFile("/root/Desktop/replace.txt");
    const hasFoo = content.includes("foo");
    const hasBar = content.includes("bar");

    if (!hasFoo && hasBar) {
      return { passed: true, detail: 'All "foo" replaced with "bar"' };
    }
    if (hasFoo) {
      return { passed: false, detail: `Still contains "foo": "${content}"` };
    }
    return { passed: false, detail: `Unexpected content: "${content}"` };
  },
};

export default task;
