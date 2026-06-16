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

const SAMPLE_SYSTEMCTL = `ssh.service             loaded active running OpenSSH server daemon
docker.service          loaded active running Docker Application Container Engine
nginx.service           loaded inactive dead    A high performance web server
fail2ban.service        loaded active running Ban repetitive SSH attackers`;

describe("systemd_services tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("parses systemctl list-units output", async () => {
    mockExecSync.mockReturnValue(SAMPLE_SYSTEMCTL);
    const { registerSystemdTools } = await import("../src/tools/systemd-services.js");
    const server = createMockServer();
    registerSystemdTools(server as any);

    const result = await server.tools["systemd_services"].handler({ state_filter: "all" });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.count).toBeGreaterThanOrEqual(4);
    expect(parsed.services[0].name).toBe("ssh");
    expect(parsed.services[0].active).toBe("active");
    expect(parsed.services[0].sub).toBe("running");
    expect(parsed.services[2].name).toBe("nginx");
    expect(parsed.services[2].active).toBe("inactive");
  });

  it("passes --state=failed filter", async () => {
    mockExecSync.mockReturnValue("");
    const { registerSystemdTools } = await import("../src/tools/systemd-services.js");
    const server = createMockServer();
    registerSystemdTools(server as any);

    await server.tools["systemd_services"].handler({ state_filter: "failed" });
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining("--state=failed"),
      expect.any(Object)
    );
  });

  it("passes --state=active filter", async () => {
    mockExecSync.mockReturnValue("");
    const { registerSystemdTools } = await import("../src/tools/systemd-services.js");
    const server = createMockServer();
    registerSystemdTools(server as any);

    await server.tools["systemd_services"].handler({ state_filter: "active" });
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining("--state=active"),
      expect.any(Object)
    );
  });

  it("handles errors gracefully", async () => {
    mockExecSync.mockImplementation(() => { throw new Error("systemctl not found"); });
    const { registerSystemdTools } = await import("../src/tools/systemd-services.js");
    const server = createMockServer();
    registerSystemdTools(server as any);

    const result = await server.tools["systemd_services"].handler({ state_filter: "all" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("systemctl not found");
  });
});

describe("service_status tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns status and recent logs for a service", async () => {
    mockExecSync
      .mockReturnValueOnce("● ssh.service - OpenSSH server daemon\n   Active: active (running)")
      .mockReturnValueOnce("Jun 16 10:00 sshd[1234]: Accepted publickey");

    const { registerSystemdTools } = await import("../src/tools/systemd-services.js");
    const server = createMockServer();
    registerSystemdTools(server as any);

    const result = await server.tools["service_status"].handler({ service_name: "ssh" });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.service).toBe("ssh.service");
    expect(parsed.status).toContain("Active: active");
    expect(parsed.recent_logs).toContain("Accepted publickey");
  });

  it("appends .service suffix if missing", async () => {
    mockExecSync.mockReturnValue("status output").mockReturnValue("log output");
    const { registerSystemdTools } = await import("../src/tools/systemd-services.js");
    const server = createMockServer();
    registerSystemdTools(server as any);

    await server.tools["service_status"].handler({ service_name: "nginx" });
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining("nginx.service"),
      expect.any(Object)
    );
  });

  it("does not double .service suffix", async () => {
    mockExecSync.mockReturnValue("status").mockReturnValue("logs");
    const { registerSystemdTools } = await import("../src/tools/systemd-services.js");
    const server = createMockServer();
    registerSystemdTools(server as any);

    await server.tools["service_status"].handler({ service_name: "docker.service" });
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining("docker.service"),
      expect.any(Object)
    );
    // Should NOT contain docker.service.service
    expect(mockExecSync).not.toHaveBeenCalledWith(
      expect.stringContaining("docker.service.service"),
      expect.any(Object)
    );
  });
});
