import { parseArgs } from "util";
import { allTasks, type Task, type TaskResult } from "./src/tasks/index.ts";
import { runAgent, type AgentResult } from "./src/agent.ts";
import { waitForContainer } from "./src/executor.ts";
import { mkdir } from "fs/promises";

// ─── CLI Args ────────────────────────────────────────────────────

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    model: { type: "string", default: "claude-sonnet-4-6" },
    tasks: { type: "string" },
    "max-iterations": { type: "string", default: "30" },
  },
  strict: false,
});

const model = values.model!;
const maxIterations = parseInt(values["max-iterations"]!, 10);

// Filter tasks if specified
let tasks: Task[] = allTasks;
if (values.tasks) {
  const ids = values.tasks.split(",").map((s) => s.trim().padStart(2, "0"));
  tasks = allTasks.filter((t) => ids.includes(t.id));
  if (tasks.length === 0) {
    console.error(`No tasks found for IDs: ${values.tasks}`);
    console.error(`Available: ${allTasks.map((t) => t.id).join(", ")}`);
    process.exit(1);
  }
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  console.log("============================================================");
  console.log("COMPUTER USE BENCHMARK");
  console.log("============================================================");
  console.log(`Model: ${model}`);
  console.log(`Tasks: ${tasks.map((t) => t.id).join(", ")}`);
  console.log(`Max iterations per task: ${maxIterations}`);
  console.log("");

  // Setup directories
  const screenshotDir = "results/screenshots";
  await mkdir(screenshotDir, { recursive: true });

  // Wait for container
  console.log("Waiting for container to be ready...");
  try {
    await waitForContainer(60000);
    console.log("Container is ready!\n");
  } catch (e) {
    console.error("Failed to connect to container. Is it running?");
    console.error("Run: docker compose up -d");
    process.exit(1);
  }

  // Run tasks
  const results: TaskResult[] = [];

  for (const task of tasks) {
    console.log(`──────────────────────────────────────────────────────────`);
    console.log(`Running Task ${task.id}: ${task.name} [${task.difficulty}]`);
    console.log(`──────────────────────────────────────────────────────────`);

    // Setup task fixtures if needed
    if (task.setup) {
      await task.setup();
    }

    // Run agent
    const agentResult = await runAgent(task.prompt, {
      model,
      maxIterations,
      screenshotDir,
      taskId: task.id,
    });

    // Verify
    let verification: { passed: boolean; detail: string };
    try {
      verification = await task.verify();
    } catch (e: any) {
      verification = { passed: false, detail: `Verification error: ${e.message}` };
    }

    results.push({ task, agentResult, verification });

    const status = verification.passed ? "PASS" : "FAIL";
    const elapsed = (agentResult.elapsed / 1000).toFixed(1);
    const tokens = agentResult.inputTokens + agentResult.outputTokens;
    console.log(`\n  Result: [${status}] ${verification.detail}`);
    console.log(`  ${elapsed}s, ${tokens.toLocaleString()} tokens, ${agentResult.iterations} iterations`);
    if (agentResult.error) {
      console.log(`  Error: ${agentResult.error}`);
    }
    console.log("");
  }

  // ─── Report ──────────────────────────────────────────────────

  const passed = results.filter((r) => r.verification.passed).length;
  const total = results.length;
  const totalElapsed = results.reduce((s, r) => s + r.agentResult.elapsed, 0);
  const totalTokens = results.reduce(
    (s, r) => s + r.agentResult.inputTokens + r.agentResult.outputTokens,
    0
  );

  console.log("============================================================");
  console.log("BENCHMARK RESULTS");
  console.log("============================================================");
  console.log(`Model: ${model}`);
  console.log(`Score: ${passed}/${total} (${Math.round((passed / total) * 100)}%)`);
  console.log("──────────────────────────────────────────────────────────");

  for (const r of results) {
    const status = r.verification.passed ? "PASS" : "FAIL";
    const elapsed = (r.agentResult.elapsed / 1000).toFixed(1);
    const tokens = r.agentResult.inputTokens + r.agentResult.outputTokens;
    console.log(
      `  [${status}] ${r.task.id}: ${r.task.name.padEnd(28)} ${elapsed.padStart(6)}s ${tokens.toLocaleString().padStart(10)} tokens`
    );
  }

  console.log("──────────────────────────────────────────────────────────");
  console.log(
    `Total: ${(totalElapsed / 1000).toFixed(1)}s, ${totalTokens.toLocaleString()} tokens`
  );
  console.log("============================================================");

  // Save report
  const report = {
    model,
    timestamp: new Date().toISOString(),
    score: { passed, total, percentage: Math.round((passed / total) * 100) },
    totalElapsedMs: totalElapsed,
    totalTokens,
    tasks: results.map((r) => ({
      id: r.task.id,
      name: r.task.name,
      difficulty: r.task.difficulty,
      passed: r.verification.passed,
      detail: r.verification.detail,
      elapsedMs: r.agentResult.elapsed,
      iterations: r.agentResult.iterations,
      inputTokens: r.agentResult.inputTokens,
      outputTokens: r.agentResult.outputTokens,
      error: r.agentResult.error,
    })),
  };

  await Bun.write("results/report.json", JSON.stringify(report, null, 2));
  console.log("\nReport saved to results/report.json");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
