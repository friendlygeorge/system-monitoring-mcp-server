import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSystemOverviewTools } from "./tools/system-overview.js";
import { registerProcessListTools } from "./tools/process-list.js";
import { registerDiskUsageTools } from "./tools/disk-usage.js";
import { registerNetworkTools } from "./tools/network-interfaces.js";
import { registerSystemdTools } from "./tools/systemd-services.js";
import { registerSystemLogsTools } from "./tools/system-logs.js";
import { registerCpuInfoTools } from "./tools/cpu-info.js";
import { registerMemoryDetailTools } from "./tools/memory-detail.js";
import { registerIoStatsTools } from "./tools/io-stats.js";
import { registerTemperatureSensorsTools } from "./tools/temperature-sensors.js";
import { registerProcessTreeTools } from "./tools/process-tree.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "system-monitoring-mcp-server",
    version: "0.1.0",
  });

  // Register all tool categories
  registerSystemOverviewTools(server);
  registerProcessListTools(server);
  registerDiskUsageTools(server);
  registerNetworkTools(server);
  registerSystemdTools(server);
  registerSystemLogsTools(server);
  registerCpuInfoTools(server);
  registerMemoryDetailTools(server);
  registerIoStatsTools(server);
  registerTemperatureSensorsTools(server);
  registerProcessTreeTools(server);

  return server;
}
