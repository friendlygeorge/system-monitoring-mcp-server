import { describe, it, expect, vi, beforeEach } from "vitest";
import * as child_process from "child_process";
import * as fs from "fs";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));
vi.mock("fs", () => ({
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  existsSync: vi.fn(),
  readlinkSync: vi.fn(),
}));

const mockExecSync = vi.mocked(child_process.execSync);
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

const SAMPLE_IP_JSON = JSON.stringify([
  {
    ifname: "eth0",
    operstate: "up",
    address: "aa:bb:cc:dd:ee:ff",
    mtu: 1500,
    addr_info: [
      { family: "inet", address: "192.168.1.100", prefixlen: 24 },
      { family: "inet6", address: "fe80::1", prefixlen: 64 },
    ],
    stats: { rx_bytes: 1234567, tx_bytes: 987654 },
  },
  {
    ifname: "lo",
    operstate: "up",
    address: "00:00:00:00:00:00",
    mtu: 65536,
    addr_info: [
      { family: "inet", address: "127.0.0.1", prefixlen: 8 },
    ],
    stats: { rx_bytes: 0, tx_bytes: 0 },
  },
]);

describe("network_interfaces tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("parses JSON output from ip -j", async () => {
    mockExecSync.mockReturnValue(SAMPLE_IP_JSON);
    const { registerNetworkTools } = await import("../src/tools/network-interfaces.js");
    const server = createMockServer();
    registerNetworkTools(server as any);

    const result = await server.tools["network_interfaces"].handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1); // lo filtered out
    expect(parsed[0].name).toBe("eth0");
    expect(parsed[0].state).toBe("up");
    expect(parsed[0].mac).toBe("aa:bb:cc:dd:ee:ff");
    expect(parsed[0].ipv4[0].address).toBe("192.168.1.100");
    expect(parsed[0].stats.rx_bytes).toBe(1234567);
  });

  it("filters by interface_name", async () => {
    mockExecSync.mockReturnValue(SAMPLE_IP_JSON);
    const { registerNetworkTools } = await import("../src/tools/network-interfaces.js");
    const server = createMockServer();
    registerNetworkTools(server as any);

    const result = await server.tools["network_interfaces"].handler({ interface_name: "lo" });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.length).toBe(1);
    expect(parsed[0].name).toBe("lo");
  });

  it("falls back to /proc/net/dev when ip JSON fails", async () => {
    const PROC_NET_DEV = `Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo frame compressed
  eth0: 1234567  10000    0    0    0     0          0         0  987654   8000    0    0    0     0       0
    lo:       0       0    0    0    0     0          0         0       0       0    0    0    0     0       0`;

    mockExecSync.mockReturnValue("text output that can't be JSON parsed");
    mockReadFileSync.mockReturnValue(PROC_NET_DEV);

    const { registerNetworkTools } = await import("../src/tools/network-interfaces.js");
    const server = createMockServer();
    registerNetworkTools(server as any);

    const result = await server.tools["network_interfaces"].handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.some((i: any) => i.name === "eth0")).toBe(true);
  });

  it("handles errors gracefully", async () => {
    mockExecSync.mockImplementation(() => { throw new Error("ip command failed"); });
    const { registerNetworkTools } = await import("../src/tools/network-interfaces.js");
    const server = createMockServer();
    registerNetworkTools(server as any);

    const result = await server.tools["network_interfaces"].handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("ip command failed");
  });
});

describe("network_connections tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("parses ss output for established connections", async () => {
    const SS_OUTPUT = `tcp    ESTAB   0       0        192.168.1.100:22     10.0.0.1:54321       users:(("sshd",pid=1234,fd=3))`;
    mockExecSync.mockReturnValue(SS_OUTPUT);

    const { registerNetworkTools } = await import("../src/tools/network-interfaces.js");
    const server = createMockServer();
    registerNetworkTools(server as any);

    const result = await server.tools["network_connections"].handler({ state: "established" });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.count).toBeGreaterThanOrEqual(1);
    expect(parsed.connections[0].local_address).toBe("192.168.1.100:22");
  });

  it("filters by state parameter", async () => {
    mockExecSync.mockReturnValue("");
    const { registerNetworkTools } = await import("../src/tools/network-interfaces.js");
    const server = createMockServer();
    registerNetworkTools(server as any);

    await server.tools["network_connections"].handler({ state: "listening" });
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining("state listening"),
      expect.any(Object)
    );
  });
});
