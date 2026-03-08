import type { Task } from "./types.ts";
import { fileExists, readFile } from "../executor.ts";

const task: Task = {
  id: "07",
  name: "Multi-step workflow",
  difficulty: "Hard",
  prompt: `Complete a multi-step workflow:
1. Open a terminal
2. Get the current date and save it: date > /root/Documents/report.txt
3. Get the hostname and append it: hostname >> /root/Documents/report.txt
4. List all files in /root/Desktop/ and append the listing: ls -la /root/Desktop/ >> /root/Documents/report.txt
5. Verify the file contains all three pieces of information by reading it with: cat /root/Documents/report.txt`,
  async verify() {
    const exists = await fileExists("/root/Documents/report.txt");
    if (!exists) return { passed: false, detail: "report.txt not found" };

    const content = await readFile("/root/Documents/report.txt");
    // Should contain: date output, hostname, and file listing
    // Date usually contains month names or numbers
    const hasDate = /\d{4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i.test(content);
    // File listing should contain sample.txt from fixtures
    const hasListing = content.includes("sample.txt") || content.includes("total");
    // Should have at least 3 lines
    const lineCount = content.split("\n").filter((l) => l.trim()).length;

    if (hasDate && hasListing && lineCount >= 3) {
      return { passed: true, detail: "Report contains all required fields" };
    }

    const missing: string[] = [];
    if (!hasDate) missing.push("date");
    if (!hasListing) missing.push("file listing");
    if (lineCount < 3) missing.push(`only ${lineCount} lines`);
    return { passed: false, detail: `Missing: ${missing.join(", ")}` };
  },
};

export default task;
