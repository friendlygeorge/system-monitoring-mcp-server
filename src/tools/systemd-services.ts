import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerSystemdTools(server: McpServer): void {
  server.tool(
    "systemd_services",
    "List systemd services with their status (active, inactive, failed). Useful for checking if key services are running.",
    {
      state_filter: z.enum(["all", "active", "failed", "inactive"]).optional().default("all").describe("Filter services by state"),
    },
    async ({ state_filter }) => {
      try {
        const { execSync } = await import("child_process");
        const filterFlag = state_filter === "all" ? "" : `--state=${state_filter}`;
        const output = execSync(
          `systemctl list-units --type=service --no-pager --no-legend ${filterFlag} 2>/dev/null`,
          { encoding: "utf-8", timeout: 5000 }
        );

        const services = output.trim().split("\n").filter(Boolean).map((line) => {
          const parts = line.trim().split(/\s+/);
          return {
            name: parts[0].replace(".service", ""),
            load: parts[1],
            active: parts[2],
            sub: parts[3],
            description: parts.slice(4).join(" "),
          };
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ count: services.length, services }, null, 2),
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
    "service_status",
    "Get detailed status of a specific systemd service including its recent log entries.",
    {
      service_name: z.string().describe("Name of the service (e.g., nginx, docker, sshd)"),
    },
    async ({ service_name }) => {
      try {
        const { execSync } = await import("child_process");
        const name = service_name.endsWith(".service") ? service_name : `${service_name}.service`;
        const statusOutput = execSync(
          `systemctl status "${name}" --no-pager 2>&1`,
          { encoding: "utf-8", timeout: 5000 }
        );
        const logOutput = execSync(
          `journalctl -u "${name}" -n 10 --no-pager 2>&1`,
          { encoding: "utf-8", timeout: 5000 }
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              service: name,
              status: statusOutput.trim(),
              recent_logs: logOutput.trim(),
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
