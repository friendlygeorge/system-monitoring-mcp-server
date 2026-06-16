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

const SAMPLE_JOURNALCTL = `2026-06-16T10:00:01+00:00 server systemd[1]: Started Docker Application Container Engine.
2026-06-16T10:00:02+00:00 server dockerd[1234]: API listen on /var/run/docker.sock
2026-06-16T10:01:00+00:00 server sshd[5678]: Accepted publickey for nova from 10.0.0.1`;

describe("system_logs tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns journalctl output with default params", async () => {
    mockExecSync.mockReturnValue(SAMPLE_JOURNALCTL);
    const { registerSystemLogsTools } = await import("../src/tools/system-logs.js");
    const server = createMockServer();
    registerSystemLogsTools(server as any);

    const result = await server.tools["system_logs"].handler({ lines: 50 });
    expect(result.content[0].text).toContain("Started Docker");
    expect(result.content[0].text).toContain("Accepted publickey");
  });

  it("passes service filter", async () => {
    mockExecSync.mockReturnValue("logs");
    const { registerSystemLogsTools } = await import("../src/tools/system-logs.js");
    const server = createMockServer();
    registerSystemLogsTools(server as any);

    await server.tools["system_logs"].handler({ service: "docker", lines: 50 });
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining("-u docker"),
      expect.any(Object)
    );
  });

  it("passes priority filter", async () => {
    mockExecSync.mockReturnValue("logs");
    const { registerSystemLogsTools } = await import("../src/tools/system-logs.js");
    const server = createMockServer();
    registerSystemLogsTools(server as any);

    await server.tools["system_logs"].handler({ priority: "err", lines: 50 });
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining("-p err"),
      expect.any(Object)
    );
  });

  it("passes since filter", async () => {
    mockExecSync.mockReturnValue("logs");
    const { registerSystemLogsTools } = await import("../src/tools/system-logs.js");
    const server = createMockServer();
    registerSystemLogsTools(server as any);

    await server.tools["system_logs"].handler({ since: "1 hour ago", lines: 50 });
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('--since="1 hour ago"'),
      expect.any(Object)
    );
  });

  it("clamps lines to max 500", async () => {
    mockExecSync.mockReturnValue("logs");
    const { registerSystemLogsTools } = await import("../src/tools/system-logs.js");
    const server = createMockServer();
    registerSystemLogsTools(server as any);

    await server.tools["system_logs"].handler({ lines: 1000 });
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining("-n 500"),
      expect.any(Object)
    );
  });

  it("returns helpful message when no logs found", async () => {
    mockExecSync.mockReturnValue("");
    const { registerSystemLogsTools } = await import("../src/tools/system-logs.js");
    const server = createMockServer();
    registerSystemLogsTools(server as any);

    const result = await server.tools["system_logs"].handler({ lines: 50 });
    expect(result.content[0].text).toContain("no logs found");
  });

  it("handles errors gracefully", async () => {
    mockExecSync.mockImplementation(() => { throw new Error("journalctl not found"); });
    const { registerSystemLogsTools } = await import("../src/tools/system-logs.js");
    const server = createMockServer();
    registerSystemLogsTools(server as any);

    const result = await server.tools["system_logs"].handler({ lines: 50 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("journalctl not found");
  });
});
