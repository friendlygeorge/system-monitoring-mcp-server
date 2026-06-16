import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs";

function readFile(path: string): string {
  return fs.readFileSync(path, "utf-8").trim();
}

export function registerTemperatureSensorsTools(server: McpServer): void {
  server.tool(
    "temperature_sensors",
    "Get CPU and system temperatures from /sys/class/thermal/thermal_zone* files. Returns zone name, type, and current temperature in Celsius. Useful for thermal monitoring and diagnosing overheating.",
    {},
    async () => {
      try {
        const thermalDir = "/sys/class/thermal";
        if (!fs.existsSync(thermalDir)) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                message: "Thermal subsystem not available on this system. /sys/class/thermal does not exist.",
                sensors: [],
              }, null, 2),
            }],
          };
        }

        const entries = fs.readdirSync(thermalDir);
        const zoneDirs = entries
          .filter((name) => name.startsWith("thermal_zone"))
          .sort((a, b) => {
            const aNum = parseInt(a.replace("thermal_zone", ""), 10);
            const bNum = parseInt(b.replace("thermal_zone", ""), 10);
            return aNum - bNum;
          });

        if (zoneDirs.length === 0) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                message: "No thermal zones found on this system. Temperature sensors may be unavailable (e.g., running in a container or VM without thermal monitoring).",
                sensors: [],
              }, null, 2),
            }],
          };
        }

        const sensors: any[] = [];
        for (const zoneDir of zoneDirs) {
          const basePath = `${thermalDir}/${zoneDir}`;
          try {
            // /sys/class/thermal/thermal_zone*/temp is reported in millidegrees Celsius
            const tempMilliC = parseInt(readFile(`${basePath}/temp`), 10);
            const tempCelsius = isNaN(tempMilliC) ? null : Math.round((tempMilliC / 1000) * 100) / 100;

            let type: string;
            try {
              type = readFile(`${basePath}/type`);
            } catch {
              type = "unknown";
            }

            let name: string;
            try {
              name = readFile(`${basePath}/name`);
            } catch {
              name = zoneDir;
            }

            sensors.push({
              zone: zoneDir,
              name,
              type,
              temp_celsius: tempCelsius,
            });
          } catch {
            // Skip zones we can't read (permission denied, etc.)
            continue;
          }
        }

        if (sensors.length === 0) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                message: "Thermal zones exist but no sensor data could be read (insufficient permissions or unsupported hardware).",
                zones_found: zoneDirs.length,
                sensors: [],
              }, null, 2),
            }],
          };
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ sensors }, null, 2),
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
