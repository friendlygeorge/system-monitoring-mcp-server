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

const SAMPLE_LAST = `nova     pts/0        10.0.0.1        Mon Jun 16 10:00   still logged in
root     pts/1        192.168.1.50    Sun Jun 15 22:00 - 23:30  (01:30)
wtmp begins Sat Jun  1 00:00:01 2026`;

describe("login_history tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns login history from last command", async () => {
    mockExecSync.mockReturnValue(SAMPLE_LAST);
    const { registerLoginHistoryTools } = await import("../src/tools/login-history.js");
    const server = createMockServer();
    registerLoginHistoryTools(server as any);

    const result = await server.tools["login_history"].handler({ max_entries: 20, show_failed: false });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.type).toBe("login_history");
    expect(parsed.entries_found).toBe(2);
    expect(parsed.raw).toContain("nova");
    expect(parsed.raw).toContain("root");
  });

  it("passes username filter", async () => {
    mockExecSync.mockReturnValue(SAMPLE_LAST);
    const { registerLoginHistoryTools } = await import("../src/tools/login-history.js");
    const server = createMockServer();
    registerLoginHistoryTools(server as any);

    await server.tools["login_history"].handler({ username: "nova", max_entries: 20, show_failed: false });
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining("-u nova"),
      expect.any(Object)
    );
  });

  it("uses btmp for failed logins", async () => {
    mockExecSync.mockReturnValue("");
    const { registerLoginHistoryTools } = await import("../src/tools/login-history.js");
    const server = createMockServer();
    registerLoginHistoryTools(server as any);

    await server.tools["login_history"].handler({ max_entries: 20, show_failed: true });
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining("-f /var/log/btmp"),
      expect.any(Object)
    );
  });

  it("handles wtmp not existing (containers)", async () => {
    mockExecSync.mockImplementation(() => {
      const err: any = new Error("last: /var/log/wtmp: No such file or directory");
      err.stderr = "/var/log/wtmp: No such file or directory";
      throw err;
    });

    const { registerLoginHistoryTools } = await import("../src/tools/login-history.js");
    const server = createMockServer();
    registerLoginHistoryTools(server as any);

    const result = await server.tools["login_history"].handler({ max_entries: 20, show_failed: false });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.message).toContain("unavailable");
    expect(parsed.suggestion).toContain("containers");
  });

  it("clamps max_entries to 100", async () => {
    mockExecSync.mockReturnValue(SAMPLE_LAST);
    const { registerLoginHistoryTools } = await import("../src/tools/login-history.js");
    const server = createMockServer();
    registerLoginHistoryTools(server as any);

    await server.tools["login_history"].handler({ max_entries: 200, show_failed: false });
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining("-n 100"),
      expect.any(Object)
    );
  });
});
