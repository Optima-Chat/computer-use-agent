import type { Task } from "./types.ts";
import { readFile, runBash } from "../executor.ts";

const task: Task = {
  id: "03",
  name: "Edit text in GUI editor",
  difficulty: "Medium",
  prompt:
    'Open the file /root/Desktop/sample.txt in the Mousepad text editor (you can double-click it on the Desktop or run "mousepad /root/Desktop/sample.txt"). Add a new line at the end of the file with the text "Added by Claude." (exactly this text). Save the file and close the editor.',
  async setup() {
    // Ensure the fixture is in place
    await runBash("cp /tmp/fixtures/sample.txt /root/Desktop/sample.txt");
  },
  async verify() {
    const content = await readFile("/root/Desktop/sample.txt");
    if (content.includes("Added by Claude.")) {
      return { passed: true, detail: "New line added successfully" };
    }
    return { passed: false, detail: `File content: "${content}"` };
  },
};

export default task;
