import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerNetworkSpeedTools } from "../src/tools/network-speed.js";

// Mock child_process
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "child_process";

function createMockServer() {
  const tools: Record<string, { description: string; handler: Function }> = {};
  return {
    tool: (name: string, description: string, _schema: unknown, handler: Function) => {
      tools[name] = { description, handler };
    },
    tools,
  };
}

describe("network_diagnostics tool", () => {
  let mockServer: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockServer = createMockServer();
  });

  it("registers the network_diagnostics tool", () => {
    registerNetworkSpeedTools(mockServer as any);
    expect(mockServer.tools["network_diagnostics"]).toBeDefined();
  });

  it("returns DNS, latency, download, and interface results", async () => {
    (execSync as any)
      .mockReturnValueOnce("Server: 1.1.1.1\nAddress: 1.1.1.1#53\n\nName: cloudflare.com\nAddress: 104.16.132.229")
      .mockReturnValueOnce("PING 1.1.1.1 (1.1.1.1) 56(84) bytes of data.\n64 bytes from 1.1.1.1: icmp_seq=1 ttl=56 time=1.234 ms\n64 bytes from 1.1.1.1: icmp_seq=2 ttl=56 time=2.345 ms\n64 bytes from 1.1.1.1: icmp_seq=3 ttl=56 time=3.456 ms\n64 bytes from 1.1.1.1: icmp_seq=4 ttl=56 time=4.567 ms\n\nrtt min/avg/max/mdev = 1.234/2.901/4.567/1.234 ms")
      .mockReturnValueOnce("1048576 1.000 1048576")
      .mockReturnValueOnce(JSON.stringify([
        { ifname: "eth0", operstate: "up", addr_info: [{ local: "192.168.1.100", family: "inet" }] },
        { ifname: "lo", operstate: "up", addr_info: [{ local: "127.0.0.1", family: "inet" }] },
      ]));

    registerNetworkSpeedTools(mockServer as any);
    const handler = mockServer.tools["network_diagnostics"].handler;
    const result = await handler({});

    expect(result.content).toHaveLength(1);
    const data = JSON.parse(result.content[0].text);

    expect(data.dns).toBeDefined();
    expect(data.dns.host).toBe("cloudflare.com");

    expect(data.latency).toBeDefined();
    expect(data.latency.avg_ms).toBe(2.901);

    expect(data.download).toBeDefined();
    expect(data.download.speed_bytes_per_sec).toBe(1048576);

    expect(data.interfaces).toBeDefined();
    expect(data.interfaces).toHaveLength(1); // lo filtered out
    expect(data.interfaces[0].name).toBe("eth0");
  });

  it("handles custom target host", async () => {
    (execSync as any)
      .mockReturnValueOnce("Server: 8.8.8.8\nAddress: 8.8.8.8#53")
      .mockReturnValueOnce("PING 8.8.8.8 ... rtt min/avg/max/mdev = 5.000/10.000/15.000/3.000 ms")
      .mockReturnValueOnce("524288 0.500 524288")
      .mockReturnValueOnce(JSON.stringify([]));

    registerNetworkSpeedTools(mockServer as any);
    const handler = mockServer.tools["network_diagnostics"].handler;
    const result = await handler({ target_host: "8.8.8.8" });

    const data = JSON.parse(result.content[0].text);
    expect(data.dns.host).toBe("8.8.8.8");
    expect(data.latency.host).toBe("8.8.8.8");
  });

  it("handles DNS lookup failure gracefully", async () => {
    (execSync as any)
      .mockImplementationOnce(() => { throw new Error("nslookup: can't resolve"); })
      .mockReturnValueOnce("PING 1.1.1.1 ... rtt min/avg/max/mdev = 1.000/2.000/3.000/0.500 ms")
      .mockReturnValueOnce("1048576 1.000 1048576")
      .mockReturnValueOnce(JSON.stringify([]));

    registerNetworkSpeedTools(mockServer as any);
    const handler = mockServer.tools["network_diagnostics"].handler;
    const result = await handler({});

    const data = JSON.parse(result.content[0].text);
    expect(data.dns.error).toBeDefined();
    expect(data.latency.avg_ms).toBe(2.0);
  });

  it("handles ping failure gracefully", async () => {
    (execSync as any)
      .mockReturnValueOnce("Server: 1.1.1.1")
      .mockImplementationOnce(() => { throw new Error("ping: network unreachable"); })
      .mockReturnValueOnce("1048576 1.000 1048576")
      .mockReturnValueOnce(JSON.stringify([]));

    registerNetworkSpeedTools(mockServer as any);
    const handler = mockServer.tools["network_diagnostics"].handler;
    const result = await handler({});

    const data = JSON.parse(result.content[0].text);
    expect(data.latency.error).toBeDefined();
  });
});
