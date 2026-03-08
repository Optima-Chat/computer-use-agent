import type { AgentResult } from "../agent.ts";

export interface Task {
  id: string;
  name: string;
  difficulty: "Easy" | "Medium" | "Hard";
  prompt: string;
  setup?: () => Promise<void>;
  verify: () => Promise<{ passed: boolean; detail: string }>;
}

export interface TaskResult {
  task: Task;
  agentResult: AgentResult;
  verification: { passed: boolean; detail: string };
}
