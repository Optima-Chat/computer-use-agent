import { $ } from "bun";

const CONTAINER = "cu-desktop";

async function dockerExec(cmd: string): Promise<string> {
  const result =
    await $`docker exec ${CONTAINER} bash -c ${cmd}`.text();
  return result.trim();
}

async function dockerExecRaw(cmd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const proc = Bun.spawn(["docker", "exec", CONTAINER, "bash", "-c", cmd], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
  } catch (e: any) {
    return { stdout: "", stderr: e.message ?? String(e), exitCode: 1 };
  }
}

// ─── Screenshot ──────────────────────────────────────────────────

export async function takeScreenshot(): Promise<string> {
  // scrot outputs PNG, we pipe to base64
  const b64 = await dockerExec(
    "DISPLAY=:1 scrot -o /tmp/screenshot.png && base64 -w0 /tmp/screenshot.png"
  );
  return b64;
}

export async function saveScreenshot(localPath: string): Promise<void> {
  await $`docker cp ${CONTAINER}:/tmp/screenshot.png ${localPath}`.quiet();
}

// ─── Computer Actions ────────────────────────────────────────────

export async function moveMouse(x: number, y: number): Promise<string> {
  return dockerExec(`DISPLAY=:1 xdotool mousemove ${x} ${y}`);
}

export async function click(x: number, y: number, button: string = "left"): Promise<string> {
  const btn = button === "right" ? 3 : button === "middle" ? 2 : 1;
  return dockerExec(`DISPLAY=:1 xdotool mousemove ${x} ${y} && DISPLAY=:1 xdotool click ${btn}`);
}

export async function doubleClick(x: number, y: number): Promise<string> {
  return dockerExec(`DISPLAY=:1 xdotool mousemove ${x} ${y} && DISPLAY=:1 xdotool click --repeat 2 1`);
}

export async function typeText(text: string): Promise<string> {
  // Use xdotool type with delay for reliability
  const escaped = text.replace(/'/g, "'\\''");
  return dockerExec(`DISPLAY=:1 xdotool type --delay 12 '${escaped}'`);
}

export async function keyPress(keys: string): Promise<string> {
  // keys like "Return", "ctrl+a", "alt+F4"
  return dockerExec(`DISPLAY=:1 xdotool key ${keys}`);
}

export async function scroll(x: number, y: number, direction: "up" | "down", clicks: number = 3): Promise<string> {
  const button = direction === "up" ? 4 : 5;
  return dockerExec(
    `DISPLAY=:1 xdotool mousemove ${x} ${y} && DISPLAY=:1 xdotool click --repeat ${clicks} ${button}`
  );
}

export async function drag(
  startX: number, startY: number,
  endX: number, endY: number
): Promise<string> {
  return dockerExec(
    `DISPLAY=:1 xdotool mousemove ${startX} ${startY} mousedown 1 mousemove ${endX} ${endY} mouseup 1`
  );
}

export async function tripleClick(x: number, y: number): Promise<string> {
  return dockerExec(`DISPLAY=:1 xdotool mousemove ${x} ${y} && DISPLAY=:1 xdotool click --repeat 3 1`);
}

// ─── Bash Execution ──────────────────────────────────────────────

export async function runBash(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return dockerExecRaw(`DISPLAY=:1 ${command}`);
}

// ─── File System Helpers (for verification) ──────────────────────

export async function fileExists(path: string): Promise<boolean> {
  const { exitCode } = await dockerExecRaw(`test -f '${path}'`);
  return exitCode === 0;
}

export async function dirExists(path: string): Promise<boolean> {
  const { exitCode } = await dockerExecRaw(`test -d '${path}'`);
  return exitCode === 0;
}

export async function readFile(path: string): Promise<string> {
  const { stdout } = await dockerExecRaw(`cat '${path}'`);
  return stdout;
}

// ─── Container Management ────────────────────────────────────────

export async function waitForContainer(timeoutMs: number = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const { exitCode } = await dockerExecRaw("DISPLAY=:1 xdotool getmouselocation");
      if (exitCode === 0) return;
    } catch {
      // ignore
    }
    await Bun.sleep(2000);
  }
  throw new Error("Container did not become ready within timeout");
}

// ─── Execute Computer Use Tool Actions ───────────────────────────

export async function executeComputerAction(input: Record<string, any>): Promise<string> {
  const action = input.action as string;

  switch (action) {
    case "screenshot":
      return ""; // screenshot is handled separately by returning base64 image
    case "mouse_move":
      return moveMouse(input.coordinate[0], input.coordinate[1]);
    case "left_click":
      return click(input.coordinate[0], input.coordinate[1], "left");
    case "right_click":
      return click(input.coordinate[0], input.coordinate[1], "right");
    case "middle_click":
      return click(input.coordinate[0], input.coordinate[1], "middle");
    case "double_click":
      return doubleClick(input.coordinate[0], input.coordinate[1]);
    case "triple_click":
      return tripleClick(input.coordinate[0], input.coordinate[1]);
    case "left_click_drag":
      return drag(
        input.start_coordinate[0], input.start_coordinate[1],
        input.coordinate[0], input.coordinate[1]
      );
    case "type":
      return typeText(input.text);
    case "key":
      return keyPress(input.text);
    case "scroll":
      return scroll(
        input.coordinate[0], input.coordinate[1],
        input.scroll_direction,
        input.scroll_amount ?? 3
      );
    default:
      return `Unknown action: ${action}`;
  }
}
