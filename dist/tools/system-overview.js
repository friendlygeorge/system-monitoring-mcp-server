import * as fs from "fs";
function readFile(path) {
    return fs.readFileSync(path, "utf-8").trim();
}
export function registerSystemOverviewTools(server) {
    server.tool("system_overview", "Get a complete system snapshot: CPU load, memory, disk usage, uptime, and hostname. One call gives you the full picture.", {}, async () => {
        try {
            // Uptime
            const uptimeRaw = readFile("/proc/uptime");
            const uptimeSec = parseFloat(uptimeRaw.split(" ")[0]);
            const days = Math.floor(uptimeSec / 86400);
            const hours = Math.floor((uptimeSec % 86400) / 3600);
            const minutes = Math.floor((uptimeSec % 3600) / 60);
            // Load averages
            const loadavg = readFile("/proc/loadavg").split(" ");
            const load1 = parseFloat(loadavg[0]);
            const load5 = parseFloat(loadavg[1]);
            const load15 = parseFloat(loadavg[2]);
            // CPU count
            const cpuinfo = readFile("/proc/cpuinfo");
            const cpuCount = (cpuinfo.match(/^processor/gm) || []).length;
            // Memory from /proc/meminfo
            const meminfo = readFile("/proc/meminfo");
            const memMap = {};
            for (const line of meminfo.split("\n")) {
                const match = line.match(/^(\w+):\s+(\d+)/);
                if (match)
                    memMap[match[1]] = parseInt(match[2]) * 1024; // kB to bytes
            }
            const totalMem = memMap["MemTotal"] || 0;
            const freeMem = memMap["MemFree"] || 0;
            const availableMem = memMap["MemAvailable"] || freeMem;
            const buffers = memMap["Buffers"] || 0;
            const cached = memMap["Cached"] || 0;
            const usedMem = totalMem - availableMem;
            // Disk from statvfs
            const { execSync } = await import("child_process");
            const dfOutput = execSync("df -B1 / 2>/dev/null | tail -1", { encoding: "utf-8" });
            const dfParts = dfOutput.trim().split(/\s+/);
            const diskTotal = parseInt(dfParts[1]) || 0;
            const diskUsed = parseInt(dfParts[2]) || 0;
            const diskAvail = parseInt(dfParts[3]) || 0;
            const diskPercent = dfParts[4] || "0%";
            // Hostname
            const hostname = readFile("/proc/sys/kernel/hostname");
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            hostname,
                            uptime: `${days}d ${hours}h ${minutes}m`,
                            uptime_seconds: Math.floor(uptimeSec),
                            cpu: {
                                count: cpuCount,
                                load_1m: load1,
                                load_5m: load5,
                                load_15m: load15,
                            },
                            memory: {
                                total_bytes: totalMem,
                                used_bytes: usedMem,
                                available_bytes: availableMem,
                                buffers_bytes: buffers,
                                cached_bytes: cached,
                                usage_percent: totalMem > 0 ? Math.round((usedMem / totalMem) * 10000) / 100 : 0,
                            },
                            disk: {
                                total_bytes: diskTotal,
                                used_bytes: diskUsed,
                                available_bytes: diskAvail,
                                usage_percent: diskPercent,
                            },
                        }, null, 2),
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
//# sourceMappingURL=system-overview.js.map