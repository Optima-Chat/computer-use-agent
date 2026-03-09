import { runAgent } from "./src/agent.ts";
import { waitForContainer, runBash, copyToContainer } from "./src/executor.ts";
import { mkdir } from "fs/promises";
import { parseArgs } from "util";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    model: { type: "string", default: "claude-opus-4-6" },
    scenario: { type: "string", default: "add-product" },
  },
  strict: false,
});

const model = values.model!;
const scenario = values.scenario!;

// ─── Demo Scenarios ──────────────────────────────────────────

const scenarios: Record<string, { name: string; setup: () => Promise<void>; prompt: string; verify: () => Promise<string> }> = {
  "add-product": {
    name: "Add a new product via the store admin panel",
    setup: async () => {
      await runBash("pkill -9 firefox 2>/dev/null; rm -rf /root/.mozilla 2>/dev/null; sleep 1");
      await runBash("mkdir -p /root/Desktop");
      await copyToContainer("fixtures/demo-store-admin.html", "/root/Desktop/store-admin.html");
      await runBash("DISPLAY=:1 firefox file:///root/Desktop/store-admin.html &");
      await runBash("sleep 4");
    },
    prompt: `You are looking at an e-commerce store admin panel in Firefox.

Your task:
1. Click the "+ Add Product" button to open the modal
2. Fill in the form with the following details:
   - Product Name: Smart Watch Ultra
   - SKU: SWU-200
   - Category: Electronics
   - Price: 299.99
   - Stock: 150
   - Status: Active
   - Description: Next-gen smart watch with health monitoring, GPS, and 7-day battery life.
3. Click "Save Product" to submit

After saving, take a screenshot to confirm the product appears in the table.`,
    verify: async () => {
      // Check page title for saved data
      const result = await runBash(`DISPLAY=:1 xdotool getactivewindow getwindowname`);
      if (result.stdout.includes("Smart Watch Ultra")) {
        return "Product 'Smart Watch Ultra' saved successfully!";
      }
      return "Could not verify product was saved. Page title: " + result.stdout.trim();
    },
  },

  "edit-product": {
    name: "Edit an existing product's price and stock",
    setup: async () => {
      const html = await Bun.file("fixtures/demo-store-admin.html").text();
      await runBash(`mkdir -p /root/Desktop && cat > /root/Desktop/store-admin.html << 'HTMLEOF'\n${html}\nHTMLEOF`);
      await runBash(`DISPLAY=:1 firefox file:///root/Desktop/store-admin.html &`);
      await runBash("sleep 3");
    },
    prompt: `You are looking at an e-commerce store admin panel in Firefox.

Your task:
1. Find the "Wireless Earbuds Pro" product in the table
2. Click its "Edit" button
3. In the edit modal, change:
   - Price from $79.99 to $59.99 (a promotional discount)
   - Stock from 234 to 500 (restocked)
   - Description: add " Now on sale!" at the end of the existing description
4. Click "Save Product"

After saving, take a screenshot to confirm the changes are reflected in the table.`,
    verify: async () => {
      const result = await runBash(`DISPLAY=:1 xdotool getactivewindow getwindowname`);
      if (result.stdout.includes("59.99")) {
        return "Product price updated to $59.99 successfully!";
      }
      return "Could not verify edit. Page title: " + result.stdout.trim();
    },
  },

  "search-filter": {
    name: "Search and filter products by category",
    setup: async () => {
      const html = await Bun.file("fixtures/demo-store-admin.html").text();
      await runBash(`mkdir -p /root/Desktop && cat > /root/Desktop/store-admin.html << 'HTMLEOF'\n${html}\nHTMLEOF`);
      await runBash(`DISPLAY=:1 firefox file:///root/Desktop/store-admin.html &`);
      await runBash("sleep 3");
    },
    prompt: `You are looking at an e-commerce store admin panel in Firefox.

Your task:
1. Take a screenshot first to see the current state
2. Use the search box to type "Wool"
3. Take a screenshot to show the filtered results
4. Clear the search and select "Electronics" from the category filter dropdown
5. Take a final screenshot

This demonstrates the filtering capabilities of the admin panel.`,
    verify: async () => {
      return "Filter demo completed.";
    },
  },
};

// ─── Main ────────────────────────────────────────────────────

async function main() {
  const s = scenarios[scenario];
  if (!s) {
    console.error(`Unknown scenario: ${scenario}`);
    console.error(`Available: ${Object.keys(scenarios).join(", ")}`);
    process.exit(1);
  }

  console.log("============================================================");
  console.log("  COMPUTER USE AGENT — LIVE DEMO");
  console.log("============================================================");
  console.log(`  Model:    ${model}`);
  console.log(`  Scenario: ${s.name}`);
  console.log(`  VNC:      http://localhost:6080/vnc.html`);
  console.log("============================================================\n");

  // Setup
  await mkdir("results/screenshots", { recursive: true });

  console.log("Waiting for container...");
  await waitForContainer(30000);
  console.log("Container ready!\n");

  // Close any existing windows
  await runBash("DISPLAY=:1 wmctrl -c :ACTIVE: 2>/dev/null || true");
  await runBash("sleep 1");

  console.log("Setting up demo environment...\n");
  await s.setup();

  console.log("Starting CUA agent...\n");
  console.log("──────────────────────────────────────────────────────────");

  const result = await runAgent(s.prompt, {
    model,
    maxIterations: 30,
    screenshotDir: "results/screenshots",
    taskId: `demo-${scenario}`,
  });

  console.log("──────────────────────────────────────────────────────────\n");

  // Verify
  const verification = await s.verify();

  const elapsed = (result.elapsed / 1000).toFixed(1);
  const tokens = result.inputTokens + result.outputTokens;

  console.log("============================================================");
  console.log("  DEMO RESULT");
  console.log("============================================================");
  console.log(`  Status:     ${result.success ? "✅ Complete" : "❌ Incomplete"}`);
  console.log(`  Verify:     ${verification}`);
  console.log(`  Time:       ${elapsed}s`);
  console.log(`  Tokens:     ${tokens.toLocaleString()}`);
  console.log(`  Iterations: ${result.iterations}`);
  if (result.error) {
    console.log(`  Error:      ${result.error}`);
  }
  console.log("============================================================");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
