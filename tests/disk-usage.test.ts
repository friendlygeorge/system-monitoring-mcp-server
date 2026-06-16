import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

const mockExecSync = vi.mocked((await import("child_process")).execSync);

function createMockServer() {
  const tools: Record<string, { description: string; handler: Function }> = {};
  return {
    tool: (name: string, description: string, _schema: unknown, handler: Function) => {
      tools[name] = { description, handler };
    },
    tools,
  };
}

const SAMPLE_DF_OUTPUT = `Filesystem     1B-blocks        Used  Available Use% Mounted on
/dev/sda1    107374182400 53687091200 53687091200  50% /
/dev/sdb1    214748364800 85899345920 128849018880  40% /data
tmpfs          4294967296          0    4294967296   0% /dev/shm`;

const SAMPLE_INODE_OUTPUT = `Filesystem      Inodes  IUsed   IFree IUse% Mounted on
/dev/sda1      6553600  327680  6225920    5% /
/dev/sdb1     13107200  655360 12451840    5% /data`;

describe("disk_usage tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("parses df output correctly", async () => {
    mockExecSync.mockReturnValue(SAMPLE_DF_OUTPUT);

    const { registerDiskUsageTools } = await import("../src/tools/disk-usage.js");
    const server = createMockServer();
    registerDiskUsageTools(server as any);

    const result = await server.tools["disk_usage"].handler({});
    const data = JSON.parse(result.content[0].text);

    expect(data).toHaveLength(3);
    expect(data[0].filesystem).toBe("/dev/sda1");
    expect(data[0].total_bytes).toBe(107374182400);
    expect(data[0].used_bytes).toBe(53687091200);
    expect(data[0].available_bytes).toBe(53687091200);
    expect(data[0].usage_percent).toBe("50%");
    expect(data[0].mount_point).toBe("/");
  });

  it("parses multiple filesystems", async () => {
    mockExecSync.mockReturnValue(SAMPLE_DF_OUTPUT);

    const { registerDiskUsageTools } = await import("../src/tools/disk-usage.js");
    const server = createMockServer();
    registerDiskUsageTools(server as any);

    const result = await server.tools["disk_usage"].handler({});
    const data = JSON.parse(result.content[0].text);

    expect(data[1].filesystem).toBe("/dev/sdb1");
    expect(data[1].mount_point).toBe("/data");
    expect(data[1].usage_percent).toBe("40%");
    expect(data[2].filesystem).toBe("tmpfs");
    expect(data[2].mount_point).toBe("/dev/shm");
  });

  it("returns error on df failure", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("df: not found");
    });

    const { registerDiskUsageTools } = await import("../src/tools/disk-usage.js");
    const server = createMockServer();
    registerDiskUsageTools(server as any);

    const result = await server.tools["disk_usage"].handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error");
  });

  it("parses inode output correctly", async () => {
    mockExecSync.mockReturnValue(SAMPLE_INODE_OUTPUT);

    const { registerDiskUsageTools } = await import("../src/tools/disk-usage.js");
    const server = createMockServer();
    registerDiskUsageTools(server as any);

    const result = await server.tools["inode_usage"].handler();
    const data = JSON.parse(result.content[0].text);

    expect(data).toHaveLength(2);
    expect(data[0].filesystem).toBe("/dev/sda1");
    expect(data[0].inodes_total).toBe(6553600);
    expect(data[0].inodes_used).toBe(327680);
    expect(data[0].inodes_free).toBe(6225920);
    expect(data[0].usage_percent).toBe("5%");
    expect(data[0].mount_point).toBe("/");
  });
});
