# Computer Use Agent Benchmark

End-to-end benchmark for Anthropic's [Computer Use](https://docs.anthropic.com/en/docs/agents-and-tools/computer-use) API. Runs Claude in a Docker virtual desktop, executes real GUI and terminal tasks, and automatically verifies results.

```
┌──────────────────────────────────────────────────────┐
│  Host (Bun + TypeScript)                             │
│                                                      │
│  run.ts ──▶ agent.ts ──▶ Anthropic API (Beta)        │
│                ↕                                     │
│             executor.ts ──▶ docker exec ──▶ Container │
│                                    │                 │
│                        Xvfb + Fluxbox + Firefox      │
│                        xdotool / scrot               │
└──────────────────────────────────────────────────────┘
```

## Results

| Model | Resolution | Score | Time | Tokens |
|-------|-----------|-------|------|--------|
| Sonnet 4.6 | 1024x768 | 6/7 (86%) | 605s | 1.23M |
| **Opus 4.6** | **768x576** | **7/7 (100%)** | **329s** | **324K** |

See [docs/REPORT.md](docs/REPORT.md) for detailed analysis.

## Tasks

| ID | Task | Difficulty | Type |
|----|------|-----------|------|
| 01 | Create a text file | Easy | Terminal |
| 02 | Organize folders | Easy | Terminal |
| 03 | Edit text in GUI editor | Medium | GUI (Mousepad) |
| 04 | Fill a browser form | Medium | GUI (Firefox) |
| 05 | Terminal pipeline | Medium | Terminal |
| 06 | Find and replace | Hard | GUI (Mousepad) |
| 07 | Multi-step workflow | Hard | Mixed |

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Set API key
export ANTHROPIC_API_KEY=sk-ant-api03-...
# or
export CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...

# 3. Start the desktop container
docker compose up -d

# 4. (Optional) Watch the desktop in browser
open http://localhost:6080/vnc.html

# 5. Run benchmark
bun run run.ts
```

## Options

```bash
# Specify model
bun run run.ts --model claude-opus-4-6

# Run specific tasks
bun run run.ts --tasks 01,04,07

# Set max iterations per task
bun run run.ts --max-iterations 20

# Combine options
bun run run.ts --model claude-opus-4-6 --tasks 03,06 --max-iterations 15
```

## Project Structure

```
├── run.ts                  # CLI entry point
├── src/
│   ├── agent.ts            # Agent loop: screenshot → Claude → execute → repeat
│   ├── executor.ts         # Docker exec wrapper (xdotool, scrot, bash)
│   └── tasks/              # Task definitions with prompts and verifiers
├── fixtures/               # Test fixtures (form.html, sample.txt, etc.)
├── scripts/
│   ├── start-desktop.sh    # Xvfb + Fluxbox + VNC startup
│   └── setup-fixtures.sh   # Copy fixtures into container
├── Dockerfile              # Ubuntu 22.04 desktop environment
├── docker-compose.yml
├── results/                # Output (screenshots + report.json)
└── docs/REPORT.md          # Detailed benchmark report
```

## How It Works

1. **Docker container** runs a headless Linux desktop (Xvfb + Fluxbox) with Firefox, Mousepad, and terminal
2. **Agent loop** sends task prompts to Claude, which returns tool calls (`computer` for GUI, `bash` for terminal)
3. **Executor** translates tool calls into `docker exec` commands (xdotool clicks/types, scrot screenshots)
4. **Verifier** checks task completion by reading files or inspecting state inside the container
5. **Report** aggregates pass/fail, timing, and token usage into `results/report.json`

## License

MIT
