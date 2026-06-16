import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs";

function readFile(path: string): string {
  return fs.readFileSync(path, "utf-8").trim();
}

export function registerIoStatsTools(server: McpServer): void {
  server.tool(
    "io_stats",
    "Get disk I/O statistics per block device: reads, writes, I/O time. Use for diagnosing slow disks or I/O bottlenecks.",
    {},
    async () => {
      try {
        const diskstats = readFile("/proc/diskstats");
        const devices: any[] = [];

        for (const line of diskstats.split("\n")) {
          const parts = line.trim().split(/\s+/);
          const name = parts[2];
          // Skip partitions (only show whole disks like sda, nvme0n1, vda)
          if (name.match(/\d$/) && !name.startsWith("nvme")) continue;
          if (name === "loop" || name === "ram" || name.startsWith("dm-")) continue;

          const readsCompleted = parseInt(parts[3]) || 0;
          const readsMerged = parseInt(parts[4]) || 0;
          const sectorsRead = parseInt(parts[5]) || 0;
          const readTimeMs = parseInt(parts[6]) || 0;
          const writesCompleted = parseInt(parts[7]) || 0;
          const writesMerged = parseInt(parts[8]) || 0;
          const sectorsWritten = parseInt(parts[9]) || 0;
          const writeTimeMs = parseInt(parts[10]) || 0;
          const ioInProgress = parseInt(parts[11]) || 0;
          const ioTimeMs = parseInt(parts[12]) || 0;

          devices.push({
            device: name,
            reads: readsCompleted,
            writes: writesCompleted,
            sectors_read: sectorsRead,
            sectors_written: sectorsWritten,
            read_time_ms: readTimeMs,
            write_time_ms: writeTimeMs,
            io_in_progress: ioInProgress,
            total_io_time_ms: ioTimeMs,
          });
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ devices }, null, 2),
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
