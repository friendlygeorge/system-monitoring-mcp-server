import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

const mockReadFileSync = vi.mocked(fs.readFileSync);

function createMockServer() {
  const tools: Record<string, { description: string; handler: Function }> = {};
  return {
    tool: (name: string, description: string, _schema: unknown, handler: Function) => {
      tools[name] = { description, handler };
    },
    tools,
  };
}

const SAMPLE_MEMINFO = `MemTotal:       16384000 kB
MemFree:         2048000 kB
MemAvailable:    8192000 kB
Buffers:          512000 kB
Cached:          4096000 kB
SwapCached:       128000 kB
Active:          9216000 kB
Inactive:        4096000 kB
SwapTotal:       2097152 kB
SwapFree:        1800000 kB
Slab:             256000 kB
PageTables:        64000 kB
Dirty:              1024 kB
Writeback:             0 kB
AnonPages:       3072000 kB
Mapped:           512000 kB
Shmem:            256000 kB
KernelStack:       32000 kB
CommitLimit:    10289152 kB
Committed_AS:   8192000 kB
HugePages_Total:       0
HugePages_Free:        0
Hugepagesize:       2048 kB`;

describe("memory_detail tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("parses /proc/meminfo correctly", async () => {
    mockReadFileSync.mockReturnValue(SAMPLE_MEMINFO);

    const { registerMemoryDetailTools } = await import("../src/tools/memory-detail.js");
    const server = createMockServer();
    registerMemoryDetailTools(server as any);

    const result = await server.tools["memory_detail"].handler();
    const data = JSON.parse(result.content[0].text);

    expect(data.ram.total_gb).toBe(15.63);
    expect(data.ram.free_gb).toBe(1.95);
    expect(data.ram.available_gb).toBe(7.81);
    expect(data.ram.buffers_gb).toBe(0.49);
    expect(data.ram.cached_gb).toBe(3.91);
    expect(data.ram.slab_gb).toBe(0.24);
    expect(data.ram.page_tables_gb).toBe(0.06);
  });

  it("calculates usage percent correctly", async () => {
    mockReadFileSync.mockReturnValue(SAMPLE_MEMINFO);

    const { registerMemoryDetailTools } = await import("../src/tools/memory-detail.js");
    const server = createMockServer();
    registerMemoryDetailTools(server as any);

    const result = await server.tools["memory_detail"].handler();
    const data = JSON.parse(result.content[0].text);

    // Usage = (total - available) / total * 100
    const expectedUsage = Math.round(((16384000 - 8192000) / 16384000) * 10000) / 100;
    expect(data.ram.usage_percent).toBe(expectedUsage);
  });

  it("parses swap info correctly", async () => {
    mockReadFileSync.mockReturnValue(SAMPLE_MEMINFO);

    const { registerMemoryDetailTools } = await import("../src/tools/memory-detail.js");
    const server = createMockServer();
    registerMemoryDetailTools(server as any);

    const result = await server.tools["memory_detail"].handler();
    const data = JSON.parse(result.content[0].text);

    expect(data.swap.total_gb).toBe(2.0);
    expect(data.swap.free_gb).toBe(1.72);
    expect(data.swap.usage_percent).toBeCloseTo(14.16, 0);
  });

  it("returns error on missing /proc/meminfo", async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT: no such file or directory");
    });

    const { registerMemoryDetailTools } = await import("../src/tools/memory-detail.js");
    const server = createMockServer();
    registerMemoryDetailTools(server as any);

    const result = await server.tools["memory_detail"].handler();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error");
  });

  it("handles minimal meminfo (no swap)", async () => {
    const minimalMeminfo = `MemTotal:        4096000 kB
MemFree:         2048000 kB
MemAvailable:    3072000 kB
Buffers:          128000 kB
Cached:           512000 kB
SwapTotal:             0 kB
SwapFree:              0 kB`;

    mockReadFileSync.mockReturnValue(minimalMeminfo);

    const { registerMemoryDetailTools } = await import("../src/tools/memory-detail.js");
    const server = createMockServer();
    registerMemoryDetailTools(server as any);

    const result = await server.tools["memory_detail"].handler();
    const data = JSON.parse(result.content[0].text);

    expect(data.ram.total_gb).toBe(3.91);
    expect(data.swap.total_gb).toBe(0);
    expect(data.swap.usage_percent).toBe(0);
  });
});
