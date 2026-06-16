import { describe, it, expect, vi, beforeEach } from "vitest";
import * as child_process from "child_process";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

const mockExecSync = vi.mocked(child_process.execSync);

function createMockServer() {
  const tools: Record<string, { description: string; handler: Function }> = {};
  return {
    tool: (name: string, description: string, _schema: unknown, handler: Function) => {
      tools[name] = { description, handler };
    },
    tools,
  };
}

const SAMPLE_PSTREE = `systemd(1)─┬─agetty(312)
            ├─cron(313)
            ├─dbus-daemon(314)
            ├─node(1234)───sh(1235)───ps(1236)
            └─sshd(315)───sshd(1237)───bash(1238)`;

describe("process_tree tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns pstree output by default", async () => {
    mockExecSync.mockReturnValue(SAMPLE_PSTREE);
    const { registerProcessTreeTools } = await import("../src/tools/process-tree.js");
    const server = createMockServer();
    registerProcessTreeTools(server as any);

    const result = await server.tools["process_tree"].handler({ max_depth: 3, show_pids: true });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.method).toBe("pstree");
    expect(parsed.tree).toContain("systemd(1)");
    expect(parsed.tree).toContain("node(1234)");
  });

  it("limits depth correctly", async () => {
    mockExecSync.mockReturnValue(SAMPLE_PSTREE);
    const { registerProcessTreeTools } = await import("../src/tools/process-tree.js");
    const server = createMockServer();
    registerProcessTreeTools(server as any);

    await server.tools["process_tree"].handler({ max_depth: 1, show_pids: true });
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining("head -40"),
      expect.any(Object)
    );
  });

  it("falls back to /proc when pstree fails", async () => {
    const PS_FALLBACK = `  1     1 init
1234     1 node
1235  1234 sh
1236  1235 ps
 315     1 sshd
1237   315 sshd
1238  1237 bash`;

    mockExecSync
      .mockImplementationOnce(() => { throw new Error("pstree not found"); })
      .mockReturnValueOnce(PS_FALLBACK);

    const { registerProcessTreeTools } = await import("../src/tools/process-tree.js");
    const server = createMockServer();
    registerProcessTreeTools(server as any);

    const result = await server.tools["process_tree"].handler({ root_pid: 1, max_depth: 3, show_pids: true });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.method).toBe("/proc fallback");
    expect(parsed.tree).toContain("init");
    expect(parsed.tree).toContain("node");
  });

  it("handles errors gracefully", async () => {
    mockExecSync.mockImplementation(() => { throw new Error("all commands failed"); });
    const { registerProcessTreeTools } = await import("../src/tools/process-tree.js");
    const server = createMockServer();
    registerProcessTreeTools(server as any);

    const result = await server.tools["process_tree"].handler({ max_depth: 3, show_pids: true });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("all commands failed");
  });
});
