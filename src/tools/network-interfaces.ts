import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs";

function readFile(path: string): string {
  return fs.readFileSync(path, "utf-8").trim();
}

export function registerNetworkTools(server: McpServer): void {
  server.tool(
    "network_interfaces",
    "List all network interfaces with IPs, MAC addresses, link status, and traffic stats (bytes in/out). Use for diagnosing connectivity issues.",
    {
      interface_name: z.string().optional().describe("Check a specific interface (e.g., eth0, wlan0)"),
    },
    async ({ interface_name }) => {
      try {
        const { execSync } = await import("child_process");
        const output = execSync("ip -j addr 2>/dev/null || ip -json addr 2>/dev/null || ip addr", {
          encoding: "utf-8",
          timeout: 5000,
        });

        // Try JSON parse first (ip -j)
        try {
          const ifaces = JSON.parse(output);
          const filtered = interface_name
            ? ifaces.filter((i: any) => i.ifname === interface_name)
            : ifaces.filter((i: any) => i.ifname !== "lo");

          const result = filtered.map((iface: any) => ({
            name: iface.ifname,
            state: iface.operstate || "unknown",
            mac: iface.address || null,
            mtu: iface.mtu || 0,
            ipv4: (iface.addr_info || [])
              .filter((a: any) => a.family === "inet")
              .map((a: any) => ({ address: a.address, prefix: a.prefixlen })),
            ipv6: (iface.addr_info || [])
              .filter((a: any) => a.family === "inet6")
              .map((a: any) => ({ address: a.address, prefix: a.prefixlen })),
            stats: iface.stats
              ? { rx_bytes: iface.stats.rx_bytes, tx_bytes: iface.stats.tx_bytes }
              : null,
          }));

          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        } catch {
          // Fallback: parse text output from /proc/net/dev
          const netDev = fs.readFileSync("/proc/net/dev", "utf-8");
          const lines = netDev.trim().split("\n").slice(2);
          const interfaces = lines.map((line) => {
            const parts = line.trim().split(/[\s:]+/);
            return {
              name: parts[0],
              rx_bytes: parseInt(parts[1]) || 0,
              tx_bytes: parseInt(parts[9]) || 0,
            };
          }).filter((i) => i.name !== "lo");

          return {
            content: [{ type: "text", text: JSON.stringify(interfaces, null, 2) }],
          };
        }
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "network_connections",
    "List active network connections (TCP/UDP). Shows local/remote addresses, state, and associated process PID/name.",
    {
      state: z.enum(["all", "established", "listening"]).optional().default("all").describe("Filter by connection state"),
    },
    async ({ state }) => {
      try {
        const { execSync } = await import("child_process");
        const ssFlags = state === "all" ? "-tuna" : state === "established" ? "-tuna state established" : "-tuna state listening";
        const output = execSync(`ss ${ssFlags} 2>/dev/null | tail -n +2`, {
          encoding: "utf-8",
          timeout: 5000,
        });

        const connections = output.trim().split("\n").filter(Boolean).map((line) => {
          const parts = line.trim().split(/\s+/);
          return {
            protocol: parts[0],
            state: parts[1] || "",
            recv_q: parseInt(parts[2]) || 0,
            send_q: parseInt(parts[3]) || 0,
            local_address: parts[4],
            remote_address: parts[5],
            process: parts[6] || null,
          };
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ count: connections.length, connections: connections.slice(0, 50) }, null, 2),
          }],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
