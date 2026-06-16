import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerProcessTreeTools(server: McpServer): void {
  server.tool(
    "process_tree",
    "Show process tree (parent-child hierarchy) using pstree or /proc. Useful for understanding service dependencies, debugging runaway processes, and seeing what spawned what.",
    {
      root_pid: z.number().optional().describe("Show tree from a specific PID (default: init/systemd)"),
      max_depth: z.number().optional().default(3).describe("Maximum tree depth to display (1-10)"),
      show_pids: z.boolean().optional().default(true).describe("Include PID numbers in output"),
    },
    async ({ root_pid, max_depth, show_pids }) => {
      try {
        const { execSync } = await import("child_process");
        const depth = Math.min(Math.max(max_depth || 3, 1), 10);

        // Try pstree first (more readable)
        try {
          const pidFlag = root_pid ? `-p ${root_pid}` : "";
          const output = execSync(
            `pstree ${show_pids ? "-a" : ""} ${pidFlag} 2>/dev/null | head -${Math.pow(2, depth) * 20}`,
            { encoding: "utf-8", timeout: 5000 }
          );

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                method: "pstree",
                depth_limit: depth,
                tree: output.trim(),
              }, null, 2),
            }],
          };
        } catch {
          // Fallback: build tree from /proc
          const procs = execSync(
            `ps -eo pid,ppid,comm --no-headers 2>/dev/null`,
            { encoding: "utf-8", timeout: 5000 }
          );

          const processMap = new Map<number, { pid: number; ppid: number; name: string; children: number[] }>();
          const lines = procs.trim().split("\n").filter(Boolean);

          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parseInt(parts[0]);
            const ppid = parseInt(parts[1]);
            const name = parts.slice(2).join(" ");
            processMap.set(pid, { pid, ppid, name, children: [] });
          }

          // Build children lists
          for (const proc of Array.from(processMap.values())) {
            const parent = processMap.get(proc.ppid);
            if (parent) {
              parent.children.push(proc.pid);
            }
          }

          // Build tree string
          const buildTree = (pid: number, prefix: string, isLast: boolean, currentDepth: number): string[] => {
            if (currentDepth > depth) return [];
            const proc = processMap.get(pid);
            if (!proc) return [];

            const lines: string[] = [];
            const connector = isLast ? "└── " : "├── ";
            const pidStr = show_pids ? ` (${proc.pid})` : "";
            lines.push(`${prefix}${connector}${proc.name}${pidStr}`);

            const childPrefix = prefix + (isLast ? "    " : "│   ");
            for (let i = 0; i < proc.children.length; i++) {
              lines.push(...buildTree(proc.children[i], childPrefix, i === proc.children.length - 1, currentDepth + 1));
            }
            return lines;
          };

          const rootPid = root_pid || 1;
          const treeLines = buildTree(rootPid, "", true, 1);

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                method: "/proc fallback",
                depth_limit: depth,
                root_pid: rootPid,
                tree: treeLines.join("\n"),
              }, null, 2),
            }],
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
}
