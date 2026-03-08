import type { Task } from "./types.ts";
import { fileExists, readFile } from "../executor.ts";

const task: Task = {
  id: "05",
  name: "Terminal pipeline",
  difficulty: "Medium",
  prompt:
    'Open a terminal and run the following pipeline command:\necho -e "banana\\napple\\ncherry\\ndate\\napple\\nbanana" | sort | uniq -c | sort -rn > /root/Documents/fruit-count.txt\nThen verify the file was created by reading it.',
  async verify() {
    const exists = await fileExists("/root/Documents/fruit-count.txt");
    if (!exists) return { passed: false, detail: "fruit-count.txt not found" };

    const content = await readFile("/root/Documents/fruit-count.txt");
    // Should have sorted unique counts: 2 banana, 2 apple, 1 cherry, 1 date (or similar)
    const hasApple = content.includes("apple");
    const hasBanana = content.includes("banana");
    const hasCherry = content.includes("cherry");
    const has2 = content.includes("2");

    if (hasApple && hasBanana && hasCherry && has2) {
      return { passed: true, detail: "Pipeline output correct" };
    }
    return { passed: false, detail: `Content: "${content}"` };
  },
};

export default task;
