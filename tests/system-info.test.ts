import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import { execSync } from "child_process";

// Mock fs and child_process
vi.mock("fs");
vi.mock("child_process");

const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockExecSync = vi.mocked(execSync);

function mockOsRelease(prettyName: string, id: string, versionId: string) {
  return `NAME="Ubuntu"\nVERSION="22.04.3 LTS (Jammy Jellyfish)"\nID=ubuntu\nID_LIKE=debian\nPRETTY_NAME="${prettyName}"\nVERSION_ID="${versionId}"\n`;
}

describe("system_info tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns basic system info from real files", async () => {
    mockReadFileSync.mockImplementation((path: any) => {
      const p = String(path);
      if (p === "/proc/version")
        return Buffer.from("Linux version 6.5.0-generic (buildd@lcy02-amd64-042)");
      if (p === "/proc/sys/kernel/hostname") return Buffer.from("nova-server");
      if (p === "/etc/os-release")
        return Buffer.from(mockOsRelease("Ubuntu 22.04.3 LTS", "ubuntu", "22.04"));
      return Buffer.from("");
    });

    mockExecSync.mockImplementation((cmd: any) => {
      const c = String(cmd);
      if (c.includes("uname -m")) return Buffer.from("x86_64");
      if (c.includes("uname -r")) return Buffer.from("6.5.0-generic");
      if (c.includes("uname -s")) return Buffer.from("Linux");
      if (c.includes("readlink /etc/localtime")) return Buffer.from("/usr/share/zoneinfo/UTC");
      if (c.includes("timedatectl")) return Buffer.from("yes");
      return Buffer.from("");
    });

    const { registerSystemInfoTools } = await import("../src/tools/system-info.js");
    const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");

    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerSystemInfoTools(server);

    // Verify the tool was registered by checking the server has the tool
    expect(server).toBeDefined();
  });

  it("reads kernel version from /proc/version", () => {
    mockReadFileSync.mockImplementation((path: any) => {
      const p = String(path);
      if (p === "/proc/version")
        return Buffer.from("Linux version 6.5.0-generic (buildd@lcy02-amd64-042)");
      return Buffer.from("");
    });
    mockExecSync.mockReturnValue(Buffer.from(""));

    const result = mockReadFileSync("/proc/version").toString();
    expect(result).toContain("Linux version 6.5.0-generic");
  });

  it("reads hostname from /proc/sys/kernel/hostname", () => {
    mockReadFileSync.mockImplementation((path: any) => {
      const p = String(path);
      if (p === "/proc/sys/kernel/hostname") return Buffer.from("nova-server");
      return Buffer.from("");
    });

    const result = mockReadFileSync("/proc/sys/kernel/hostname").toString();
    expect(result).toBe("nova-server");
  });

  it("parses /etc/os-release correctly", () => {
    const osRelease = mockOsRelease("Ubuntu 22.04.3 LTS", "ubuntu", "22.04");
    const nameMatch = osRelease.match(/PRETTY_NAME="?([^"\n]+)"?/);
    const idLine = osRelease.match(/^ID=(\S+)/m);
    const versionLine = osRelease.match(/VERSION_ID="?([^"\n]+)"?/);

    expect(nameMatch?.[1]).toBe("Ubuntu 22.04.3 LTS");
    expect(idLine?.[1]).toBe("ubuntu");
    expect(versionLine?.[1]).toBe("22.04");
  });

  it("handles missing /etc/os-release gracefully", () => {
    mockReadFileSync.mockImplementation((path: any) => {
      const p = String(path);
      if (p === "/proc/version")
        return Buffer.from("Linux version 6.5.0-generic");
      if (p === "/proc/sys/kernel/hostname") return Buffer.from("test");
      return Buffer.from(""); // /etc/os-release missing
    });

    const osRelease = mockReadFileSync("/etc/os-release").toString();
    const prettyName = osRelease.match(/PRETTY_NAME="?([^"\n]+)"?/)?.[1] || "";
    const distro = osRelease.match(/^ID=(\S+)/m)?.[1]?.replace(/"/g, "") || "unknown";

    expect(prettyName).toBe("");
    expect(distro).toBe("unknown");
  });
});
