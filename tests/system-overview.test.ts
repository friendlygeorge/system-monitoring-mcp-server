import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";

// Mock fs.readFileSync
vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

// Mock child_process.execSync
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

const mockReadFileSync = vi.mocked(fs.readFileSync);
const { execSync: mockExecSync } = await import("child_process");
const mockedExecSync = vi.mocked(mockExecSync);

// Minimal MCP server mock
function createMockServer() {
  const tools: Record<string, { description: string; handler: Function }> = {};
  return {
    tool: (name: string, description: string, _schema: unknown, handler: Function) => {
      tools[name] = { description, handler };
    },
    tools,
  };
}

// Sample data
const SAMPLE_UPTIME = "123456.78 234567.89";
const SAMPLE_LOADAVG = "0.50 0.75 1.00 /proc/loadavg";
const SAMPLE_CPUINFO = `processor\t: 0
model name\t: Intel Core

processor\t: 1
model name\t: Intel Core`;
const SAMPLE_MEMINFO = `MemTotal:       16384000 kB
MemFree:         8192000 kB
MemAvailable:   12288000 kB
Buffers:          512000 kB
Cached:          2048000 kB`;
const SAMPLE_HOSTNAME = "nova-server";
const SAMPLE_DF = `/dev/sda1  100000000000 40000000000 60000000000  40% /`;

describe("system_overview tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("parses system overview correctly", async () => {
    mockReadFileSync.mockImplementation((path: string) => {
      if (path === "/proc/uptime") return SAMPLE_UPTIME;
      if (path === "/proc/loadavg") return SAMPLE_LOADAVG;
      if (path === "/proc/cpuinfo") return SAMPLE_CPUINFO;
      if (path === "/proc/meminfo") return SAMPLE_MEMINFO;
      if (path === "/proc/sys/kernel/hostname") return SAMPLE_HOSTNAME;
      throw new Error(`Unexpected path: ${path}`);
    });
    mockedExecSync.mockReturnValue(SAMPLE_DF);

    const { registerSystemOverviewTools } = await import("../src/tools/system-overview.js");
    const server = createMockServer();
    registerSystemOverviewTools(server as any);

    const result = await server.tools["system_overview"].handler();
    const data = JSON.parse(result.content[0].text);

    expect(data.hostname).toBe("nova-server");
    expect(data.uptime_seconds).toBe(123456);
    expect(data.cpu.count).toBe(2);
    expect(data.cpu.load_1m).toBe(0.5);
    expect(data.cpu.load_5m).toBe(0.75);
    expect(data.cpu.load_15m).toBe(1.0);
  });

  it("calculates memory usage correctly", async () => {
    mockReadFileSync.mockImplementation((path: string) => {
      if (path === "/proc/uptime") return SAMPLE_UPTIME;
      if (path === "/proc/loadavg") return SAMPLE_LOADAVG;
      if (path === "/proc/cpuinfo") return SAMPLE_CPUINFO;
      if (path === "/proc/meminfo") return SAMPLE_MEMINFO;
      if (path === "/proc/sys/kernel/hostname") return SAMPLE_HOSTNAME;
      throw new Error(`Unexpected path: ${path}`);
    });
    mockedExecSync.mockReturnValue(SAMPLE_DF);

    const { registerSystemOverviewTools } = await import("../src/tools/system-overview.js");
    const server = createMockServer();
    registerSystemOverviewTools(server as any);

    const result = await server.tools["system_overview"].handler();
    const data = JSON.parse(result.content[0].text);

    // MemTotal: 16384000 kB = 16384000 * 1024 bytes
    expect(data.memory.total_bytes).toBe(16384000 * 1024);
    // MemAvailable: 12288000 kB
    expect(data.memory.available_bytes).toBe(12288000 * 1024);
    // used = total - available = (16384000 - 12288000) * 1024 = 4096000 * 1024
    expect(data.memory.used_bytes).toBe(4096000 * 1024);
    expect(data.memory.buffers_bytes).toBe(512000 * 1024);
    expect(data.memory.cached_bytes).toBe(2048000 * 1024);
    // usage_percent = 4096000 / 16384000 * 100 = 25%
    expect(data.memory.usage_percent).toBe(25);
  });

  it("parses disk usage from df output", async () => {
    mockReadFileSync.mockImplementation((path: string) => {
      if (path === "/proc/uptime") return SAMPLE_UPTIME;
      if (path === "/proc/loadavg") return SAMPLE_LOADAVG;
      if (path === "/proc/cpuinfo") return SAMPLE_CPUINFO;
      if (path === "/proc/meminfo") return SAMPLE_MEMINFO;
      if (path === "/proc/sys/kernel/hostname") return SAMPLE_HOSTNAME;
      throw new Error(`Unexpected path: ${path}`);
    });
    mockedExecSync.mockReturnValue(SAMPLE_DF);

    const { registerSystemOverviewTools } = await import("../src/tools/system-overview.js");
    const server = createMockServer();
    registerSystemOverviewTools(server as any);

    const result = await server.tools["system_overview"].handler();
    const data = JSON.parse(result.content[0].text);

    expect(data.disk.total_bytes).toBe(100000000000);
    expect(data.disk.used_bytes).toBe(40000000000);
    expect(data.disk.available_bytes).toBe(60000000000);
    expect(data.disk.usage_percent).toBe("40%");
  });

  it("formats uptime correctly", async () => {
    // 90061 seconds = 1d 1h 1m
    mockReadFileSync.mockImplementation((path: string) => {
      if (path === "/proc/uptime") return "90061.00 180122.00";
      if (path === "/proc/loadavg") return SAMPLE_LOADAVG;
      if (path === "/proc/cpuinfo") return SAMPLE_CPUINFO;
      if (path === "/proc/meminfo") return SAMPLE_MEMINFO;
      if (path === "/proc/sys/kernel/hostname") return SAMPLE_HOSTNAME;
      throw new Error(`Unexpected path: ${path}`);
    });
    mockedExecSync.mockReturnValue(SAMPLE_DF);

    const { registerSystemOverviewTools } = await import("../src/tools/system-overview.js");
    const server = createMockServer();
    registerSystemOverviewTools(server as any);

    const result = await server.tools["system_overview"].handler();
    const data = JSON.parse(result.content[0].text);

    expect(data.uptime).toBe("1d 1h 1m");
    expect(data.uptime_seconds).toBe(90061);
  });

  it("returns error on missing /proc files", async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT: no such file or directory");
    });
    mockedExecSync.mockImplementation(() => {
      throw new Error("command not found");
    });

    const { registerSystemOverviewTools } = await import("../src/tools/system-overview.js");
    const server = createMockServer();
    registerSystemOverviewTools(server as any);

    const result = await server.tools["system_overview"].handler();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error");
  });
});
