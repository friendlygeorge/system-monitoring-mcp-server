# Contributing to System Monitoring MCP Server

Thanks for your interest in contributing! This server provides AI agents with structured access to Linux system metrics. Contributions that improve reliability, add tools, or fix edge cases are welcome.

## Getting Started

1. Fork and clone the repo:
   ```bash
   git clone https://github.com/YOUR_USERNAME/system-monitoring-mcp-server.git
   cd system-monitoring-mcp-server
   npm install
   ```

2. Run the tests:
   ```bash
   npx vitest run
   ```

3. Start the server locally:
   ```bash
   npx ts-node src/index.ts
   ```

## Development Workflow

- Each tool lives in `src/tools/` as a separate file
- Tool schemas are defined in `src/types.ts`
- Tools are registered in `src/server.ts`
- Tests live in `tests/` — one test file per tool file

### Adding a New Tool

1. Add the Zod input schema to `src/types.ts`
2. Create `src/tools/your-tool.ts` exporting an async function
3. Register it in `src/server.ts` via `server.tool()`
4. Write tests in `tests/your-tool.test.ts` — mock `fs.readFileSync` and `child_process.execSync`
5. Update the README with tool description and usage

### Testing Conventions

- Tests mock filesystem reads (`/proc`, `/sys`) for deterministic results
- Use `vi.mock('fs')` and `vi.mock('child_process')` at the top of each test file
- Each test file covers one tool, with 3-5 test cases (happy path, edge cases, error handling)
- Run `npx vitest run` before submitting

## What We're Looking For

**High value:**
- New tools for metrics not yet covered (e.g., GPU stats, Docker-in-Docker, RAID status)
- Better error messages when data is unavailable
- Performance improvements for frequent polling scenarios
- Cross-distribution compatibility fixes

**Medium value:**
- Documentation improvements
- Test coverage for edge cases (containers, VMs, minimal installs)
- README examples showing real agent workflows

**Skip:**
- Write/modify tools (this server is read-only by design)
- Windows support (out of scope — use a different server)
- Tools that require root access

## Code Style

- TypeScript strict mode
- No external dependencies beyond the MCP SDK
- Read from `/proc`, `/sys`, `journald` directly — no shell commands
- Handle missing data gracefully (return what's available, skip what isn't)

## Submitting Changes

1. Create a branch: `git checkout -b tool/add-gpu-stats`
2. Make your changes with tests
3. Ensure all tests pass: `npx vitest run`
4. Commit with a clear message: `feat: add gpu_stats tool for NVIDIA GPU monitoring`
5. Open a PR with a description of what the tool does and why it's useful

## Questions?

Open a [GitHub Discussion](https://github.com/friendlygeorge/system-monitoring-mcp-server/discussions) or comment on an existing issue.
