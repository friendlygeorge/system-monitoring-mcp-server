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

const SAMPLE_DISKSTATS = ` 259       0 nvme0n1 12345 234 567890 1234 5678 123 901234 5678 0 3456 6789 0 0 0 0 0
 259       1 nvme0n1p1 1234 23 56789 123 567 12 90123 567 0 345 678 0 0 0 0 0
   8       0 sda 98765 432 1234567 8765 43210 876 987654 43210 0 23456 51975 0 0 0 0 0
   8       1 sda1 9876 43 123456 876 4321 87 98765 4321 0 2345 5197 0 0 0 0 0
   7       0 loop0 100 0 800 10 50 0 400 5 0 15 0 0 0 0 0 0`;

describe("io_stats tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("parses /proc/diskstats correctly", async () => {
    mockReadFileSync.mockReturnValue(SAMPLE_DISKSTATS);

    const { registerIoStatsTools } = await import("../src/tools/io-stats.js");
    const server = createMockServer();
    registerIoStatsTools(server as any);

    const result = await server.tools["io_stats"].handler();
    const data = JSON.parse(result.content[0].text);

    expect(data.devices).toBeDefined();
    expect(Array.isArray(data.devices)).toBe(true);
  });

  it("includes whole disks, skips partitions and loop devices", async () => {
    mockReadFileSync.mockReturnValue(SAMPLE_DISKSTATS);

    const { registerIoStatsTools } = await import("../src/tools/io-stats.js");
    const server = createMockServer();
    registerIoStatsTools(server as any);

    const result = await server.tools["io_stats"].handler();
    const data = JSON.parse(result.content[0].text);

    const names = data.devices.map((d: any) => d.device);
    expect(names).toContain("nvme0n1");
    expect(names).toContain("sda");
    // sda1 (partition ending with digit), loop0 (loop prefix) excluded
    // nvme0n1p1 is kept because source code only skips non-nvme partitions
    expect(names).not.toContain("sda1");
    expect(names).not.toContain("loop0");
  });

  it("extracts correct read/write counts for sda", async () => {
    mockReadFileSync.mockReturnValue(SAMPLE_DISKSTATS);

    const { registerIoStatsTools } = await import("../src/tools/io-stats.js");
    const server = createMockServer();
    registerIoStatsTools(server as any);

    const result = await server.tools["io_stats"].handler();
    const data = JSON.parse(result.content[0].text);

    const sda = data.devices.find((d: any) => d.device === "sda");
    expect(sda).toBeDefined();
    expect(sda.reads).toBe(98765);
    expect(sda.writes).toBe(43210);
    expect(sda.sectors_read).toBe(1234567);
    expect(sda.sectors_written).toBe(987654);
    expect(sda.read_time_ms).toBe(8765);
    expect(sda.write_time_ms).toBe(43210);
  });

  it("returns error on missing /proc/diskstats", async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT: no such file or directory");
    });

    const { registerIoStatsTools } = await import("../src/tools/io-stats.js");
    const server = createMockServer();
    registerIoStatsTools(server as any);

    const result = await server.tools["io_stats"].handler();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error");
  });

  it("handles error on missing /proc/diskstats", async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const { registerIoStatsTools } = await import("../src/tools/io-stats.js");
    const server = createMockServer();
    registerIoStatsTools(server as any);

    const result = await server.tools["io_stats"].handler();
    expect(result.isError).toBe(true);
  });
});
