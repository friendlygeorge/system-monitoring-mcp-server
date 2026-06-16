import { z } from "zod";
export function registerSystemLogsTools(server) {
    server.tool("system_logs", "Read recent system logs from journald. Filter by service, priority, or time range. Useful for diagnosing issues.", {
        service: z.string().optional().describe("Filter by service name (e.g., docker, sshd)"),
        priority: z.enum(["emerg", "alert", "crit", "err", "warning", "notice", "info", "debug"]).optional().describe("Filter by log priority"),
        lines: z.number().optional().default(50).describe("Number of log lines to return (1-500)"),
        since: z.string().optional().describe("Show logs since time (e.g., '1 hour ago', '2026-06-16')"),
    }, async ({ service, priority, lines, since }) => {
        try {
            const { execSync } = await import("child_process");
            const parts = ["journalctl", "--no-pager", "-o", "short-iso"];
            if (service)
                parts.push(`-u ${service}`);
            if (priority)
                parts.push(`-p ${priority}`);
            if (since)
                parts.push(`--since="${since}"`);
            const safeLines = Math.min(Math.max(lines || 50, 1), 500);
            parts.push(`-n ${safeLines}`);
            const output = execSync(parts.join(" "), { encoding: "utf-8", timeout: 10000 });
            return {
                content: [{
                        type: "text",
                        text: output.trim() || "(no logs found for the specified filters)",
                    }],
            };
        }
        catch (error) {
            return {
                content: [{ type: "text", text: `Error: ${error.message}` }],
                isError: true,
            };
        }
    });
}
//# sourceMappingURL=system-logs.js.map