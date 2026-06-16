import { z } from "zod";
export function registerProcessListTools(server) {
    server.tool("process_list", "List top processes by CPU or memory usage. Returns PID, name, CPU%, MEM%, and command. Use for diagnosing what's consuming resources.", {
        sort_by: z.enum(["cpu", "memory"]).optional().default("cpu").describe("Sort by CPU usage or memory usage"),
        limit: z.number().optional().default(20).describe("Number of processes to return (1-100)"),
    }, async ({ sort_by, limit }) => {
        try {
            const { execSync } = await import("child_process");
            const sortFlag = sort_by === "memory" ? "--sort=-%mem" : "--sort=-%cpu";
            const safeLimit = Math.min(Math.max(limit || 20, 1), 100);
            const output = execSync(`ps aux ${sortFlag} --no-headers | head -${safeLimit}`, { encoding: "utf-8", timeout: 5000 });
            const processes = output.trim().split("\n").map((line) => {
                const parts = line.trim().split(/\s+/);
                return {
                    user: parts[0],
                    pid: parseInt(parts[1]),
                    cpu_percent: parseFloat(parts[2]),
                    mem_percent: parseFloat(parts[3]),
                    vsz_kb: parseInt(parts[4]),
                    rss_kb: parseInt(parts[5]),
                    stat: parts[7],
                    command: parts.slice(10).join(" ").substring(0, 200),
                };
            });
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify(processes, null, 2),
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
//# sourceMappingURL=process-list.js.map