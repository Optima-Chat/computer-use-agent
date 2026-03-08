import type { Task } from "./types.ts";
import { dirExists, fileExists, readFile } from "../executor.ts";

const task: Task = {
  id: "02",
  name: "Organize folders",
  difficulty: "Easy",
  prompt:
    "Using the terminal, create the following directory structure under /root/project/:\n- /root/project/src/\n- /root/project/tests/\n- /root/project/docs/\nAlso create a file /root/project/README.md with the content '# My Project'.",
  async verify() {
    const checks = await Promise.all([
      dirExists("/root/project/src"),
      dirExists("/root/project/tests"),
      dirExists("/root/project/docs"),
      fileExists("/root/project/README.md"),
    ]);

    if (!checks[0]) return { passed: false, detail: "src/ dir missing" };
    if (!checks[1]) return { passed: false, detail: "tests/ dir missing" };
    if (!checks[2]) return { passed: false, detail: "docs/ dir missing" };
    if (!checks[3]) return { passed: false, detail: "README.md missing" };

    const content = await readFile("/root/project/README.md");
    if (!content.includes("# My Project")) {
      return { passed: false, detail: `README content: "${content}"` };
    }

    return { passed: true, detail: "All directories and README.md created" };
  },
};

export default task;
