import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs";

function readFile(path: string): string {
  return fs.readFileSync(path, "utf-8").trim();
}

export function registerDiskUsageTools(server: McpServer): void {
  server.tool(
    "disk_usage",
    "Get disk usage for all mounted filesystems. Shows total, used, available, mount point, and filesystem type.",
    {
      path: z.string().optional().describe("Check a specific path instead of all filesystems"),
    },
    async ({ path: targetPath }) => {
      try {
        const { execSync } = await import("child_process");
        const cmd = targetPath
          ? `df -B1 "${targetPath}" 2>/dev/null`
          : `df -B1 -x tmpfs -x devtmpfs -x squashfs 2>/dev/null`;
        const output = execSync(cmd, { encoding: "utf-8", timeout: 5000 });
        const lines = output.trim().split("\n");

        const filesystems = lines.slice(1).map((line) => {
          const parts = line.trim().split(/\s+/);
          return {
            filesystem: parts[0],
            total_bytes: parseInt(parts[1]) || 0,
            used_bytes: parseInt(parts[2]) || 0,
            available_bytes: parseInt(parts[3]) || 0,
            usage_percent: parts[4] || "0%",
            mount_point: parts[5],
          };
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify(filesystems, null, 2),
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
    "inode_usage",
    "Get inode usage for all filesystems. Inodes track file metadata — if inodes are exhausted, you can't create new files even with free disk space.",
    {},
    async () => {
      try {
        const { execSync } = await import("child_process");
        const output = execSync("df -i -x tmpfs -x devtmpfs -x squashfs 2>/dev/null", {
          encoding: "utf-8",
          timeout: 5000,
        });
        const lines = output.trim().split("\n");

        const filesystems = lines.slice(1).map((line) => {
          const parts = line.trim().split(/\s+/);
          return {
            filesystem: parts[0],
            inodes_total: parseInt(parts[1]) || 0,
            inodes_used: parseInt(parts[2]) || 0,
            inodes_free: parseInt(parts[3]) || 0,
            usage_percent: parts[4] || "0%",
            mount_point: parts[5],
          };
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify(filesystems, null, 2),
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
