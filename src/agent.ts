import Anthropic from "@anthropic-ai/sdk";
import { takeScreenshot, executeComputerAction, runBash, saveScreenshot } from "./executor.ts";

const apiKey = process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error("Set CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY");
}
const client = new Anthropic({ apiKey });

export interface AgentResult {
  success: boolean;
  iterations: number;
  inputTokens: number;
  outputTokens: number;
  elapsed: number;
  error?: string;
}

interface AgentOptions {
  model?: string;
  maxIterations?: number;
  screenshotDir?: string;
  taskId?: string;
}

const SYSTEM_PROMPT = `You are an agent controlling a Linux desktop computer. The screen resolution is 1024x768.
You can use the computer tool to interact with the desktop (take screenshots, click, type, etc.) and the bash tool to run commands.
Complete the given task efficiently. When done, say "TASK_COMPLETE" in your response.`;

export async function runAgent(
  taskPrompt: string,
  options: AgentOptions = {}
): Promise<AgentResult> {
  const {
    model = "claude-sonnet-4-5-20250514",
    maxIterations = 30,
    screenshotDir,
    taskId,
  } = options;

  const startTime = Date.now();
  let totalInput = 0;
  let totalOutput = 0;
  let iterations = 0;

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: taskPrompt,
    },
  ];

  const tools: Anthropic.Beta.BetaToolUnion[] = [
    {
      type: "computer_20251124",
      name: "computer",
      display_width_px: 1024,
      display_height_px: 768,
    },
    {
      type: "bash_20250124",
      name: "bash",
    },
  ];

  try {
    while (iterations < maxIterations) {
      iterations++;
      console.log(`  [iter ${iterations}] Calling ${model}...`);

      const response = await client.beta.messages.create({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages,
        tools,
        betas: ["computer-use-2025-01-24"],
      });

      totalInput += response.usage.input_tokens;
      totalOutput += response.usage.output_tokens;

      // Check if the model wants to stop
      if (response.stop_reason === "end_turn") {
        // Check if any text block contains TASK_COMPLETE
        const hasComplete = response.content.some(
          (block) => block.type === "text" && block.text.includes("TASK_COMPLETE")
        );
        if (hasComplete) {
          return {
            success: true,
            iterations,
            inputTokens: totalInput,
            outputTokens: totalOutput,
            elapsed: Date.now() - startTime,
          };
        }
      }

      // If no tool use, we're done (model finished without calling tools)
      const toolUseBlocks = response.content.filter(
        (block) => block.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) {
        // Check for TASK_COMPLETE in text
        const hasComplete = response.content.some(
          (block) => block.type === "text" && block.text.includes("TASK_COMPLETE")
        );
        return {
          success: hasComplete,
          iterations,
          inputTokens: totalInput,
          outputTokens: totalOutput,
          elapsed: Date.now() - startTime,
        };
      }

      // Add assistant response to messages
      messages.push({
        role: "assistant",
        content: response.content as Anthropic.Beta.BetaContentBlockParam[],
      });

      // Process each tool use
      const toolResults: Anthropic.Beta.BetaToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        if (block.type !== "tool_use") continue;

        const input = block.input as Record<string, any>;

        if (block.name === "computer") {
          const action = input.action as string;
          console.log(`  [iter ${iterations}] computer.${action}${input.coordinate ? ` (${input.coordinate})` : ""}${input.text ? ` "${input.text.slice(0, 50)}"` : ""}`);

          if (action === "screenshot") {
            const b64 = await takeScreenshot();

            // Save screenshot if dir specified
            if (screenshotDir && taskId) {
              await saveScreenshot(`${screenshotDir}/${taskId}-iter${iterations}.png`);
            }

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/png",
                    data: b64,
                  },
                },
              ],
            });
          } else {
            const output = await executeComputerAction(input);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: output || "Action executed successfully.",
            });
          }
        } else if (block.name === "bash") {
          const command = input.command as string;
          console.log(`  [iter ${iterations}] bash: ${command.slice(0, 80)}${command.length > 80 ? "..." : ""}`);

          const { stdout, stderr, exitCode } = await runBash(command);
          let output = "";
          if (stdout) output += stdout;
          if (stderr) output += (output ? "\n" : "") + `stderr: ${stderr}`;
          output += (output ? "\n" : "") + `exit code: ${exitCode}`;

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: output || "Command executed (no output).",
          });
        } else {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Unknown tool: ${block.name}`,
            is_error: true,
          });
        }
      }

      // Add tool results
      messages.push({
        role: "user",
        content: toolResults,
      });
    }

    return {
      success: false,
      iterations,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      elapsed: Date.now() - startTime,
      error: "Max iterations reached",
    };
  } catch (error: any) {
    return {
      success: false,
      iterations,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      elapsed: Date.now() - startTime,
      error: error.message ?? String(error),
    };
  }
}
