import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  existsSync: vi.fn(),
  readlinkSync: vi.fn(),
}));

const mockExistsSync = vi.mocked(fs.existsSync);
const mockReaddirSync = vi.mocked(fs.readdirSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);

function createMockServer() {
  const tools: Record<string, { description: string; handler: Function }> = {};
  return {
    tool: (name: string, description: string, _schema: unknown, handler: Function) => {
      tools[name] = { description, handler };
    },
    tools,
  };
}

describe("temperature_sensors tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("reads thermal zones from /sys/class/thermal", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["thermal_zone0", "thermal_zone1"] as any);
    mockReadFileSync
      .mockReturnValueOnce("45000")     // thermal_zone0/temp (45°C in millidegrees)
      .mockReturnValueOnce("x86_pkg_temp")  // thermal_zone0/type
      .mockReturnValueOnce("CPU temp")       // thermal_zone0/name
      .mockReturnValueOnce("38000")     // thermal_zone1/temp (38°C)
      .mockReturnValueOnce("acpitz")         // thermal_zone1/type
      .mockReturnValueOnce("thermal_zone1"); // thermal_zone1/name

    const { registerTemperatureSensorsTools } = await import("../src/tools/temperature-sensors.js");
    const server = createMockServer();
    registerTemperatureSensorsTools(server as any);

    const result = await server.tools["temperature_sensors"].handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.sensors.length).toBe(2);
    expect(parsed.sensors[0].temp_celsius).toBe(45);
    expect(parsed.sensors[0].type).toBe("x86_pkg_temp");
    expect(parsed.sensors[0].name).toBe("CPU temp");
    expect(parsed.sensors[1].temp_celsius).toBe(38);
    expect(parsed.sensors[1].type).toBe("acpitz");
  });

  it("handles /sys/class/thermal not existing", async () => {
    mockExistsSync.mockReturnValue(false);

    const { registerTemperatureSensorsTools } = await import("../src/tools/temperature-sensors.js");
    const server = createMockServer();
    registerTemperatureSensorsTools(server as any);

    const result = await server.tools["temperature_sensors"].handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.message).toContain("not available");
    expect(parsed.sensors).toEqual([]);
  });

  it("handles no thermal zones found", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["cooling_device0"] as any); // no thermal_zone*

    const { registerTemperatureSensorsTools } = await import("../src/tools/temperature-sensors.js");
    const server = createMockServer();
    registerTemperatureSensorsTools(server as any);

    const result = await server.tools["temperature_sensors"].handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.message).toContain("No thermal zones found");
  });

  it("skips unreadable zones gracefully", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["thermal_zone0", "thermal_zone1"] as any);
    mockReadFileSync
      .mockReturnValueOnce("45000")           // zone0 temp
      .mockReturnValueOnce("x86_pkg_temp")    // zone0 type
      .mockReturnValueOnce("CPU temp")         // zone0 name
      .mockImplementationOnce(() => { throw new Error("permission denied"); }); // zone1 temp fails

    const { registerTemperatureSensorsTools } = await import("../src/tools/temperature-sensors.js");
    const server = createMockServer();
    registerTemperatureSensorsTools(server as any);

    const result = await server.tools["temperature_sensors"].handler({});
    const parsed = JSON.parse(result.content[0].text);

    // Only zone0 returned, zone1 skipped
    expect(parsed.sensors.length).toBe(1);
    expect(parsed.sensors[0].temp_celsius).toBe(45);
  });

  it("returns null temp_celsius for non-numeric temp values", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["thermal_zone0"] as any);
    mockReadFileSync
      .mockReturnValueOnce("N/A")             // non-numeric temp
      .mockReturnValueOnce("unknown")
      .mockReturnValueOnce("zone0");

    const { registerTemperatureSensorsTools } = await import("../src/tools/temperature-sensors.js");
    const server = createMockServer();
    registerTemperatureSensorsTools(server as any);

    const result = await server.tools["temperature_sensors"].handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.sensors[0].temp_celsius).toBeNull();
  });

  it("handles all zones unreadable", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["thermal_zone0"] as any);
    mockReadFileSync.mockImplementation(() => { throw new Error("permission denied"); });

    const { registerTemperatureSensorsTools } = await import("../src/tools/temperature-sensors.js");
    const server = createMockServer();
    registerTemperatureSensorsTools(server as any);

    const result = await server.tools["temperature_sensors"].handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.message).toContain("no sensor data could be read");
    expect(parsed.zones_found).toBe(1);
  });
});
