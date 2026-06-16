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

const SAMPLE_PS_OUTPUT = `root         1  0.0  0.1 169436 11292 ?        Ss   Jun15   0:03 /sbin/init
nova       1234  5.2  2.1 1234567 89012 ?      Sl   10:00   0:45 node server.js
nova       5678  3.1  1.5 987654  45678 ?       Sl   10:00   0:23 python3 worker.py`;

describe("process_list tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns processes sorted by CPU by default", async () => {
    mockExecSync.mockReturnValue(SAMPLE_PS_OUTPUT);
    const { registerProcessListTools } = await import("../src/tools/process-list.js");
    const server = createMockServer();
    registerProcessListTools(server as any);

    const result = await server.tools["process_list"].handler({ sort_by: "cpu", limit: 20 });
    const parsed = JSON.parse(result.content[0].text);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(3);
    expect(parsed[0].pid).toBe(1);
    expect(parsed[1].pid).toBe(1234);
    expect(parsed[1].command).toContain("node server.js");
  });

  it("sorts by memory when sort_by=memory", async () => {
    mockExecSync.mockReturnValue(SAMPLE_PS_OUTPUT);
    const { registerProcessListTools } = await import("../src/tools/process-list.js");
    const server = createMockServer();
    registerProcessListTools(server as any);

    const result = await server.tools["process_list"].handler({ sort_by: "memory", limit: 20 });
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining("--sort=-%mem"),
      expect.any(Object)
    );
  });

  it("clamps limit to valid range", async () => {
    mockExecSync.mockReturnValue(SAMPLE_PS_OUTPUT);
    const { registerProcessListTools } = await import("../src/tools/process-list.js");
    const server = createMockServer();
    registerProcessListTools(server as any);

    // limit=-5 clamps to 1 (Math.max(-5, 1) = 1)
    await server.tools["process_list"].handler({ sort_by: "cpu", limit: -5 });
    const lastCall0 = mockExecSync.mock.calls[mockExecSync.mock.calls.length - 1][0];
    expect(lastCall0).toContain("head -1");

    // limit=200 clamps to 100
    await server.tools["process_list"].handler({ sort_by: "cpu", limit: 200 });
    const lastCall200 = mockExecSync.mock.calls[mockExecSync.mock.calls.length - 1][0];
    expect(lastCall200).toContain("head -100");
  });

  it("handles execSync errors gracefully", async () => {
    mockExecSync.mockImplementation(() => { throw new Error("ps failed"); });
    const { registerProcessListTools } = await import("../src/tools/process-list.js");
    const server = createMockServer();
    registerProcessListTools(server as any);

    const result = await server.tools["process_list"].handler({ sort_by: "cpu", limit: 20 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("ps failed");
  });
});
