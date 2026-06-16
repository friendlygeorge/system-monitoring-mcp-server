import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs";

export function registerOpenFilesTools(server: McpServer): void {
  server.tool(
    "open_files",
    "List open files for a given process by reading /proc/{pid}/fd symlinks. Shows file descriptors, target paths, and file types. Useful for debugging file handle leaks, understanding what a process has open, and diagnosing permission issues.",
    {
      pid: z.number().describe("Process ID to inspect"),
      max_files: z.number().optional().default(100).describe("Maximum number of file descriptors to return (default: 100)"),
    },
    async ({ pid, max_files }) => {
      try {
        const fdDir = `/proc/${pid}/fd`;

        if (!fs.existsSync(fdDir)) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                message: `Process ${pid} not found or /proc/${pid}/fd not accessible.`,
                pid,
                open_files: [],
              }, null, 2),
            }],
          };
        }

        const fds = fs.readdirSync(fdDir);
        const limit = Math.min(Math.max(max_files || 100, 1), 1000);
        const openFiles: any[] = [];

        for (const fd of fds.slice(0, limit)) {
          try {
            const target = fs.readlinkSync(`${fdDir}/${fd}`);
            let fileType = "unknown";

            if (target.startsWith("/dev/")) fileType = "device";
            else if (target.startsWith("/proc/")) fileType = "proc";
            else if (target.startsWith("socket:")) fileType = "socket";
            else if (target.startsWith("pipe:")) fileType = "pipe";
            else if (target.startsWith("anon_inode:")) fileType = "anon_inode";
            else if (target.startsWith("/")) fileType = "file";

            openFiles.push({
              fd: parseInt(fd, 10),
              target,
              type: fileType,
            });
          } catch {
            // Skip unreadable FDs (race condition: process may have closed it)
            continue;
          }
        }

        // Get process name for context
        let processName = "unknown";
        try {
          processName = fs.readFileSync(`/proc/${pid}/comm`, "utf-8").trim();
        } catch {
          // Ignore
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              pid,
              process_name: processName,
              total_fds: fds.length,
              returned: openFiles.length,
              truncated: fds.length > limit,
              open_files: openFiles,
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
}
