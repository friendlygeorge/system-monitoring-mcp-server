import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs";

function readFile(path: string): string {
  return fs.readFileSync(path, "utf-8").trim();
}

export function registerMemoryDetailTools(server: McpServer): void {
  server.tool(
    "memory_detail",
    "Get detailed memory breakdown: total, used, free, buffers, cached, swap, available. Shows where memory is actually going.",
    {},
    async () => {
      try {
        const meminfo = readFile("/proc/meminfo");
        const memMap: Record<string, number> = {};
        for (const line of meminfo.split("\n")) {
          const match = line.match(/^(\w+):\s+(\d+)/);
          if (match) memMap[match[1]] = parseInt(match[2]); // in kB
        }

        const toGB = (kb: number) => Math.round((kb / 1048576) * 100) / 100;

        const total = memMap["MemTotal"] || 0;
        const free = memMap["MemFree"] || 0;
        const available = memMap["MemAvailable"] || free;
        const buffers = memMap["Buffers"] || 0;
        const cached = memMap["Cached"] || 0;
        const swapTotal = memMap["SwapTotal"] || 0;
        const swapFree = memMap["SwapFree"] || 0;
        const swapCached = memMap["SwapCached"] || 0;
        const slab = memMap["Slab"] || 0;
        const pageTables = memMap["PageTables"] || 0;

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              ram: {
                total_gb: toGB(total),
                used_gb: toGB(total - available),
                free_gb: toGB(free),
                available_gb: toGB(available),
                buffers_gb: toGB(buffers),
                cached_gb: toGB(cached),
                slab_gb: toGB(slab),
                page_tables_gb: toGB(pageTables),
                usage_percent: total > 0 ? Math.round(((total - available) / total) * 10000) / 100 : 0,
              },
              swap: {
                total_gb: toGB(swapTotal),
                used_gb: toGB(swapTotal - swapFree),
                free_gb: toGB(swapFree),
                cached_gb: toGB(swapCached),
                usage_percent: swapTotal > 0 ? Math.round(((swapTotal - swapFree) / swapTotal) * 10000) / 100 : 0,
              },
            }, null, 2),
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

  server.tool(
    "top_memory_consumers",
    "List processes consuming the most memory. Quick way to find what's eating your RAM.",
    {
      limit: z.number().optional().default(15).describe("Number of processes to return (1-50)"),
    },
    async ({ limit }) => {
      try {
        const { execSync } = await import("child_process");
        const safeLimit = Math.min(Math.max(limit || 15, 1), 50);
        const output = execSync(
          `ps aux --sort=-%mem --no-headers | head -${safeLimit}`,
          { encoding: "utf-8", timeout: 5000 }
        );

        const processes = output.trim().split("\n").map((line) => {
          const parts = line.trim().split(/\s+/);
          return {
            pid: parseInt(parts[1]),
            mem_percent: parseFloat(parts[3]),
            rss_mb: Math.round((parseInt(parts[5]) || 0) / 1024),
            command: parts.slice(10).join(" ").substring(0, 150),
          };
        });

        return {
          content: [{ type: "text", text: JSON.stringify(processes, null, 2) }],
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
