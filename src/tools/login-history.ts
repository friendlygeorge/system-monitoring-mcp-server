import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execSync } from "child_process";

export function registerLoginHistoryTools(server: McpServer): void {
  server.tool(
    "login_history",
    "Show login/logout history from wtmp/btmp logs using the `last` command. Shows who logged in, from where, when, and session duration. Useful for security auditing, tracking access patterns, and debugging session issues.",
    {
      username: z.string().optional().describe("Filter by specific username (default: show all)"),
      max_entries: z.number().optional().default(20).describe("Maximum number of entries to return (default: 20)"),
      show_failed: z.boolean().optional().default(false).describe("Include failed login attempts (from btmp)"),
    },
    async ({ username, max_entries, show_failed }) => {
      try {
        const limit = Math.min(Math.max(max_entries || 20, 1), 100);
        const userFlag = username ? `-u ${username}` : "";
        const source = show_failed ? "-f /var/log/btmp" : "";
        const cmd = `last ${userFlag} ${source} -F -d -n ${limit} 2>/dev/null`;

        let output: string;
        try {
          output = execSync(cmd, { encoding: "utf-8", timeout: 5000 });
        } catch (execError: any) {
          // `last` may fail if wtmp doesn't exist (e.g., in containers)
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                message: "Login history unavailable. The `last` command failed — wtmp/btmp logs may not exist on this system.",
                error: execError.stderr?.trim() || execError.message,
                suggestion: "This is common in containers and minimal systems. Use system_logs tool for journald-based login tracking.",
              }, null, 2),
            }],
          };
        }

        const lines = output.trim().split("\n").filter(line => line.trim() && !line.startsWith("wtmp") && !line.startsWith("btmp"));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              type: show_failed ? "failed_logins" : "login_history",
              entries_found: lines.length,
              raw: output.trim(),
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
