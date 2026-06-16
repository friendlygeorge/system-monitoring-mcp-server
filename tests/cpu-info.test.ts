import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";

// Mock fs.readFileSync before importing tools
vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

const mockReadFileSync = vi.mocked(fs.readFileSync);

// Minimal MCP server mock — matches SDK's 4-arg tool(name, desc, schema, cb) signature
function createMockServer() {
  const tools: Record<string, { description: string; handler: Function }> = {};
  return {
    tool: (name: string, description: string, _schema: unknown, handler: Function) => {
      tools[name] = { description, handler };
    },
    tools,
  };
}

// Sample /proc/cpuinfo for 2-core CPU
const SAMPLE_CPUINFO = `processor\t: 0
model name\t: Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz
cpu MHz\t\t: 3800.000
cpu cores\t: 2
cache size\t: 16384 KB

processor\t: 1
model name\t: Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz
cpu MHz\t\t: 3800.000
cpu cores\t: 2
cache size\t: 16384 KB`;

// Sample /proc/stat
const SAMPLE_STAT = `cpu  12345 678 9012 45678 2345 0 123 0 0 0
cpu0 6000 300 4500 23000 1200 0 60 0 0 0
cpu1 6345 378 4512 22678 1145 0 63 0 0 0`;

describe("cpu_info tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("parses /proc/cpuinfo correctly", async () => {
    mockReadFileSync.mockImplementation((path: string) => {
      if (path === "/proc/cpuinfo") return SAMPLE_CPUINFO;
      if (path === "/proc/stat") return SAMPLE_STAT;
      throw new Error(`Unexpected path: ${path}`);
    });

    const { registerCpuInfoTools } = await import("../src/tools/cpu-info.js");
    const server = createMockServer();
    registerCpuInfoTools(server as any);

    const result = await server.tools["cpu_info"].handler();
    const data = JSON.parse(result.content[0].text);

    expect(data.processor_count).toBe(2);
    expect(data.model).toBe("Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz");
    expect(data.cores).toHaveLength(2);
    expect(data.cores[0].model_name).toBe(
      "Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz"
    );
    expect(data.cores[0].mhz).toBe(3800);
    expect(data.cores[0].physical_cores).toBe(2);
    expect(data.cores[0].cache_kb).toBe("16384 KB");
  });

  it("parses /proc/stat usage correctly", async () => {
    mockReadFileSync.mockImplementation((path: string) => {
      if (path === "/proc/cpuinfo") return SAMPLE_CPUINFO;
      if (path === "/proc/stat") return SAMPLE_STAT;
      throw new Error(`Unexpected path: ${path}`);
    });

    const { registerCpuInfoTools } = await import("../src/tools/cpu-info.js");
    const server = createMockServer();
    registerCpuInfoTools(server as any);

    const result = await server.tools["cpu_info"].handler();
    const data = JSON.parse(result.content[0].text);

    expect(data.current_usage).toHaveLength(3); // cpu, cpu0, cpu1
    expect(data.current_usage[0].core).toBe("cpu");
    expect(data.current_usage[0].total_ticks).toBe(12345 + 678 + 9012 + 45678 + 2345);
    expect(data.current_usage[0].busy_ticks).toBe(12345 + 678 + 9012);
    const total = 12345 + 678 + 9012 + 45678 + 2345;
    const expectedIdle = Math.round((45678 / total) * 10000) / 100;
    expect(data.current_usage[0].idle_percent).toBe(expectedIdle);
  });

  it("returns error on missing /proc files", async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT: no such file or directory");
    });

    const { registerCpuInfoTools } = await import("../src/tools/cpu-info.js");
    const server = createMockServer();
    registerCpuInfoTools(server as any);

    const result = await server.tools["cpu_info"].handler();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error");
  });

  it("handles single-core CPU", async () => {
    const singleCore = `processor\t: 0
model name\t: AMD EPYC 7763 64-Core
cpu MHz\t\t: 2445.000
cpu cores\t: 1
cache size\t: 32768 KB`;

    const singleStat = `cpu  5000 100 2000 10000 500 0 50 0 0 0`;

    mockReadFileSync.mockImplementation((path: string) => {
      if (path === "/proc/cpuinfo") return singleCore;
      if (path === "/proc/stat") return singleStat;
      throw new Error(`Unexpected path: ${path}`);
    });

    const { registerCpuInfoTools } = await import("../src/tools/cpu-info.js");
    const server = createMockServer();
    registerCpuInfoTools(server as any);

    const result = await server.tools["cpu_info"].handler();
    const data = JSON.parse(result.content[0].text);

    expect(data.processor_count).toBe(1);
    expect(data.model).toBe("AMD EPYC 7763 64-Core");
    expect(data.cores).toHaveLength(1);
    expect(data.current_usage).toHaveLength(1);
  });
});
