import * as fs from "fs";
function readFile(path) {
    return fs.readFileSync(path, "utf-8").trim();
}
export function registerCpuInfoTools(server) {
    server.tool("cpu_info", "Get detailed CPU information: model, cores, frequency, cache, and current usage per core. Use for capacity planning and performance diagnosis.", {}, async () => {
        try {
            const cpuinfo = readFile("/proc/cpuinfo");
            const cpuMap = {};
            let physicalId = 0;
            let cores = [];
            let current = {};
            for (const line of cpuinfo.split("\n")) {
                const match = line.match(/^([\w\s]+?)\s*:\s*(.*)$/);
                if (match) {
                    const key = match[1].trim().toLowerCase().replace(/\s+/g, "_");
                    const val = match[2].trim();
                    if (key === "processor") {
                        if (Object.keys(current).length > 0)
                            cores.push(current);
                        current = { id: parseInt(val) };
                    }
                    else if (key === "model_name") {
                        current.model_name = val;
                    }
                    else if (key === "cpu_mhz" || key === "cpu_ghz") {
                        current.mhz = parseFloat(val);
                    }
                    else if (key === "cpu_cores") {
                        current.physical_cores = parseInt(val);
                    }
                    else if (key === "cache_size") {
                        current.cache_kb = val;
                    }
                }
            }
            if (Object.keys(current).length > 0)
                cores.push(current);
            // Current usage from /proc/stat
            const statLines = readFile("/proc/stat").split("\n").filter((l) => l.startsWith("cpu"));
            const usage = [];
            for (const line of statLines) {
                const parts = line.split(/\s+/);
                const name = parts[0];
                const user = parseInt(parts[1]) || 0;
                const nice = parseInt(parts[2]) || 0;
                const system = parseInt(parts[3]) || 0;
                const idle = parseInt(parts[4]) || 0;
                const iowait = parseInt(parts[5]) || 0;
                const total = user + nice + system + idle + iowait;
                const busy = user + nice + system;
                usage.push({
                    core: name,
                    total_ticks: total,
                    busy_ticks: busy,
                    idle_percent: total > 0 ? Math.round((idle / total) * 10000) / 100 : 0,
                });
            }
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            processor_count: cores.length,
                            model: cores[0]?.model_name || "unknown",
                            cores,
                            current_usage: usage,
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
//# sourceMappingURL=cpu-info.js.map