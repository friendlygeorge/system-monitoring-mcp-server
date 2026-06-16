import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execSync } from "child_process";

export function registerNetworkSpeedTools(server: McpServer): void {
  server.tool(
    "network_diagnostics",
    "Run network diagnostics: DNS resolution, latency (ping), and download speed test. Returns structured results for each test. Useful for diagnosing connectivity issues, measuring bandwidth, and verifying DNS health.",
    {
      target_host: z
        .string()
        .optional()
        .describe("Host to test against (default: 1.1.1.1 for IP, cloudflare.com for DNS)"),
      download_url: z
        .string()
        .optional()
        .describe("URL to download for speed test (default: 1MB test file from Cloudflare)"),
      timeout_seconds: z
        .number()
        .optional()
        .describe("Timeout per test in seconds (default: 10)"),
    },
    async (args) => {
      const host = args.target_host || "1.1.1.1";
      const dnsHost = host === "1.1.1.1" ? "cloudflare.com" : host;
      const downloadUrl = args.download_url || "https://speed.cloudflare.com/__down?bytes=1000000";
      const timeout = args.timeout_seconds || 10;

      const results: Record<string, any> = {};

      // 1. DNS Resolution
      try {
        const start = Date.now();
        const dnsResult = execSync(
          `timeout ${timeout} nslookup ${dnsHost} 2>&1 | head -10`,
          { encoding: "utf-8", timeout: timeout * 1000 }
        );
        const dnsMs = Date.now() - start;
        results.dns = {
          host: dnsHost,
          resolution_time_ms: dnsMs,
          raw: dnsResult.trim(),
        };
      } catch (e: any) {
        results.dns = { host: dnsHost, error: e.message?.substring(0, 200) };
      }

      // 2. Latency (ping)
      try {
        const pingResult = execSync(
          `timeout ${timeout} ping -c 4 ${host} 2>&1`,
          { encoding: "utf-8", timeout: timeout * 1000 }
        );
        // Parse: rtt min/avg/max/mdev = 1.234/5.678/9.012/3.456 ms
        const match = pingResult.match(
          /rtt min\/avg\/max\/mdev = ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)/
        );
        results.latency = {
          host,
          min_ms: match ? parseFloat(match[1]) : null,
          avg_ms: match ? parseFloat(match[2]) : null,
          max_ms: match ? parseFloat(match[3]) : null,
          mdev_ms: match ? parseFloat(match[4]) : null,
          packets_transmitted: 4,
        };
      } catch (e: any) {
        results.latency = { host, error: e.message?.substring(0, 200) };
      }

      // 3. Download Speed Test
      try {
        const start = Date.now();
        const curlResult = execSync(
          `timeout ${timeout} curl -s -o /dev/null -w "%{speed_download} %{time_total} %{size_download}" "${downloadUrl}"`,
          { encoding: "utf-8", timeout: timeout * 1000 }
        );
        const parts = curlResult.trim().split(" ");
        const bytesPerSec = parseFloat(parts[0]) || 0;
        const timeTotal = parseFloat(parts[1]) || 0;
        const sizeBytes = parseInt(parts[2]) || 0;

        results.download = {
          url: downloadUrl,
          speed_bytes_per_sec: Math.round(bytesPerSec),
          speed_mbps: Math.round((bytesPerSec * 8) / 1_000_000 * 100) / 100,
          time_total_seconds: Math.round(timeTotal * 1000) / 1000,
          size_bytes: sizeBytes,
        };
      } catch (e: any) {
        results.download = { url: downloadUrl, error: e.message?.substring(0, 200) };
      }

      // 4. Network Interfaces Summary
      try {
        const ifconfig = execSync(
          `ip -j addr 2>/dev/null || ifconfig 2>/dev/null | head -30`,
          { encoding: "utf-8", timeout: 5000 }
        );
        // Try JSON first (ip -j)
        try {
          const ifaces = JSON.parse(ifconfig);
          results.interfaces = ifaces
            .filter((i: any) => i.ifname !== "lo")
            .map((i: any) => ({
              name: i.ifname,
              state: i.operstate,
              ips: (i.addr_info || []).map((a: any) => ({
                address: a.local,
                family: a.family,
              })),
            }));
        } catch {
          // Fallback: raw ifconfig output
          results.interfaces_raw = ifconfig.substring(0, 500);
        }
      } catch (e: any) {
        results.interfaces = { error: "Could not retrieve network interfaces" };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    }
  );
}
