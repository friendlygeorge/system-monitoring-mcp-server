import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs";
import { execSync } from "child_process";

function readFile(path: string): string {
  try {
    return fs.readFileSync(path, "utf-8").trim();
  } catch {
    return "";
  }
}

export function registerSystemInfoTools(server: McpServer): void {
  server.tool(
    "system_info",
    "Get OS identification: kernel version, architecture, hostname, distribution, time zone, and NTP status. Use this to understand what system you're working on before running commands.",
    {
      include_packages: z
        .boolean()
        .optional()
        .describe("Include installed package count (slower, runs dpkg/rpm)"),
    },
    async ({ include_packages }) => {
      try {
        const kernel = readFile("/proc/version");
        const hostname = readFile("/proc/sys/kernel/hostname");
        const osRelease = readFile("/etc/os-release");
        const arch = readFile("/etc/arch") || execSync("uname -m", { encoding: "utf-8" }).trim();
        const kernelRelease = execSync("uname -r", { encoding: "utf-8" }).trim();
        const kernelName = execSync("uname -s", { encoding: "utf-8" }).trim();

        // Parse /etc/os-release for distro info
        let distro = "unknown";
        let distroVersion = "";
        let prettyName = "";
        if (osRelease) {
          const nameMatch = osRelease.match(/PRETTY_NAME="?([^"\n]+)"?/);
          const idMatch = osRelease.match(/^(?:VERSION_ID="?([^"\n]+)"?|ID=(\S+))/m);
          prettyName = nameMatch?.[1] || "";
          distroVersion = idMatch?.[1] || idMatch?.[2] || "";
          const idLine = osRelease.match(/^ID=(\S+)/m);
          distro = idLine?.[1]?.replace(/"/g, "") || "unknown";
        }

        // Timezone
        let timezone = "unknown";
        try {
          timezone = execSync("readlink /etc/localtime 2>/dev/null || cat /etc/timezone 2>/dev/null || date +%Z", {
            encoding: "utf-8",
          }).trim();
          // Strip prefix if readlink returned path
          if (timezone.startsWith("/usr/share/zoneinfo/")) {
            timezone = timezone.replace("/usr/share/zoneinfo/", "");
          }
        } catch {}

        // NTP sync status
        let ntp_synced = false;
        try {
          const timedatectl = execSync("timedatectl show --property=NTPSynchronized --value 2>/dev/null", {
            encoding: "utf-8",
          }).trim();
          ntp_synced = timedatectl === "yes";
        } catch {}

        // Package count (optional)
        let package_count: number | null = null;
        if (include_packages) {
          try {
            if (distro === "debian" || distro === "ubuntu") {
              const dpkg = execSync("dpkg -l 2>/dev/null | grep '^ii' | wc -l", { encoding: "utf-8" }).trim();
              package_count = parseInt(dpkg) || 0;
            } else {
              const rpm = execSync("rpm -qa 2>/dev/null | wc -l", { encoding: "utf-8" }).trim();
              package_count = parseInt(rpm) || 0;
            }
          } catch {}
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  hostname,
                  kernel_name: kernelName,
                  kernel_release: kernelRelease,
                  kernel_version: kernel.split(" ").slice(2, 5).join(" "),
                  architecture: arch,
                  distro,
                  distro_version: distroVersion,
                  pretty_name: prettyName,
                  timezone,
                  ntp_synced,
                  ...(package_count !== null ? { package_count } : {}),
                },
                null,
                2
              ),
            },
          ],
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
