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

  // ─── Profiling Summary ───────────────────────────────────────

  console.log("\n============================================================");
  console.log("LATENCY PROFILE (Inference vs VM Execution)");
  console.log("============================================================");

  let grandInferenceMs = 0;
  let grandToolMs = 0;
  let grandScreenshotMs = 0;
  let grandActionMs = 0;
  let grandBashMs = 0;
  let totalScreenshots = 0;
  let totalScreenshotBytes = 0;

  for (const r of results) {
    const profile = r.agentResult.profile;
    if (!profile || profile.length === 0) continue;

    let taskInference = 0;
    let taskTool = 0;
    let taskScreenshot = 0;
    let taskAction = 0;
    let taskBash = 0;
    let taskScreenshotCount = 0;
    let taskScreenshotBytes = 0;

    for (const iter of profile) {
      taskInference += iter.inferenceMs;
      taskTool += iter.toolExecutionMs;
      for (const t of iter.tools) {
        if (t.tool === "computer.screenshot") {
          taskScreenshot += t.executionMs;
          taskScreenshotCount++;
          if (t.screenshotBytes) taskScreenshotBytes += t.screenshotBytes;
        } else if (t.tool === "bash") {
          taskBash += t.executionMs;
        } else {
          taskAction += t.executionMs;
        }
      }
    }

    const taskTotal = taskInference + taskTool;
    const infPct = taskTotal > 0 ? Math.round((taskInference / taskTotal) * 100) : 0;
    const vmPct = taskTotal > 0 ? Math.round((taskTool / taskTotal) * 100) : 0;

    console.log(`\n  Task ${r.task.id}: ${r.task.name}`);
    console.log(`  ├─ Inference:  ${(taskInference / 1000).toFixed(1)}s (${infPct}%)`);
    console.log(`  ├─ VM Total:   ${(taskTool / 1000).toFixed(1)}s (${vmPct}%)`);
    console.log(`  │  ├─ Screenshots: ${(taskScreenshot / 1000).toFixed(1)}s (${taskScreenshotCount} captures, ${(taskScreenshotBytes / 1024).toFixed(0)}KB)`);
    console.log(`  │  ├─ GUI Actions: ${(taskAction / 1000).toFixed(1)}s`);
    console.log(`  │  └─ Bash:        ${(taskBash / 1000).toFixed(1)}s`);
    console.log(`  └─ Total:      ${(taskTotal / 1000).toFixed(1)}s`);

    grandInferenceMs += taskInference;
    grandToolMs += taskTool;
    grandScreenshotMs += taskScreenshot;
    grandActionMs += taskAction;
    grandBashMs += taskBash;
    totalScreenshots += taskScreenshotCount;
    totalScreenshotBytes += taskScreenshotBytes;
  }

  const grandTotal = grandInferenceMs + grandToolMs;
  if (grandTotal > 0) {
    console.log(`\n──────────────────────────────────────────────────────────`);
    console.log(`  AGGREGATE`);
    console.log(`  ├─ Inference:  ${(grandInferenceMs / 1000).toFixed(1)}s (${Math.round((grandInferenceMs / grandTotal) * 100)}%)`);
    console.log(`  ├─ VM Total:   ${(grandToolMs / 1000).toFixed(1)}s (${Math.round((grandToolMs / grandTotal) * 100)}%)`);
    console.log(`  │  ├─ Screenshots: ${(grandScreenshotMs / 1000).toFixed(1)}s (${totalScreenshots} captures, ${(totalScreenshotBytes / 1024).toFixed(0)}KB total)`);
    console.log(`  │  ├─ GUI Actions: ${(grandActionMs / 1000).toFixed(1)}s`);
    console.log(`  │  └─ Bash:        ${(grandBashMs / 1000).toFixed(1)}s`);
    console.log(`  └─ Total:      ${(grandTotal / 1000).toFixed(1)}s`);
    console.log(`\n  Avg screenshot: ${totalScreenshots > 0 ? (grandScreenshotMs / totalScreenshots).toFixed(0) : 0}ms capture, ${totalScreenshots > 0 ? ((totalScreenshotBytes / totalScreenshots) / 1024).toFixed(0) : 0}KB/frame`);
  }
  console.log("============================================================");

  // Save report
  const report = {
    model,
    timestamp: new Date().toISOString(),
    score: { passed, total, percentage: Math.round((passed / total) * 100) },
    totalElapsedMs: totalElapsed,
    totalTokens,
    profile: {
      inferenceMs: grandInferenceMs,
      vmExecutionMs: grandToolMs,
      screenshotMs: grandScreenshotMs,
      guiActionMs: grandActionMs,
      bashMs: grandBashMs,
      screenshotCount: totalScreenshots,
      screenshotBytesTotal: totalScreenshotBytes,
    },
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
      profile: r.agentResult.profile,
    })),
  };

  await Bun.write("results/report.json", JSON.stringify(report, null, 2));
  console.log("\nReport saved to results/report.json");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
