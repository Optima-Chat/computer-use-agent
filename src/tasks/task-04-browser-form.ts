import type { Task } from "./types.ts";
import { runBash, readFile, fileExists } from "../executor.ts";

const task: Task = {
  id: "04",
  name: "Fill a browser form",
  difficulty: "Medium",
  prompt: `Open Firefox and navigate to file:///root/Desktop/form.html. Fill out the registration form with these details:
- Full Name: John Doe
- Email: john@example.com
- Department: Engineering
- Message: Hello from Claude
Then click the Submit button. After submission, use the terminal to run this command to save the page title which contains the form data:
xdotool getactivewindow getwindowname > /root/Documents/form-result.txt`,
  async setup() {
    // Kill any existing Firefox
    await runBash("pkill -f firefox || true");
    // Ensure form.html is in place
    await runBash("cp /tmp/fixtures/form.html /root/Desktop/form.html");
  },
  async verify() {
    // Check if result file exists with form data
    const exists = await fileExists("/root/Documents/form-result.txt");
    if (!exists) {
      return { passed: false, detail: "form-result.txt not found" };
    }

    const content = await readFile("/root/Documents/form-result.txt");
    // The page title should contain SUBMITTED: with the form data
    const hasName = content.includes("John Doe") || content.includes("john");
    const hasEmail = content.includes("john@example.com");

    if (hasName && hasEmail) {
      return { passed: true, detail: "Form submitted with correct data" };
    }

    // Fallback: check if form was at least submitted
    if (content.includes("SUBMITTED")) {
      return { passed: true, detail: `Form submitted: ${content.slice(0, 100)}` };
    }

    return { passed: false, detail: `Result: "${content}"` };
  },
};

export default task;
