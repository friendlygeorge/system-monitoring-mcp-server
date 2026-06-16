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
const mockReadlinkSync = vi.mocked(fs.readlinkSync);
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

describe("open_files tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("lists open files for a process", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["0", "1", "2", "3"] as any);
    mockReadlinkSync
      .mockReturnValueOnce("/dev/pts/0")
      .mockReturnValueOnce("/dev/null")
      .mockReturnValueOnce("socket:[12345]")
      .mockReturnValueOnce("/home/nova/data.txt");
    mockReadFileSync.mockReturnValue("node");

    const { registerOpenFilesTools } = await import("../src/tools/open-files.js");
    const server = createMockServer();
    registerOpenFilesTools(server as any);

    const result = await server.tools["open_files"].handler({ pid: 1234, max_files: 100 });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.pid).toBe(1234);
    expect(parsed.process_name).toBe("node");
    expect(parsed.total_fds).toBe(4);
    expect(parsed.open_files.length).toBe(4);
    expect(parsed.open_files[0].type).toBe("device");
    expect(parsed.open_files[1].type).toBe("device");
    expect(parsed.open_files[2].type).toBe("socket");
    expect(parsed.open_files[3].type).toBe("file");
  });

  it("returns message when process not found", async () => {
    mockExistsSync.mockReturnValue(false);

    const { registerOpenFilesTools } = await import("../src/tools/open-files.js");
    const server = createMockServer();
    registerOpenFilesTools(server as any);

    const result = await server.tools["open_files"].handler({ pid: 99999, max_files: 100 });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.message).toContain("not found");
    expect(parsed.open_files).toEqual([]);
  });

  it("classifies pipe and anon_inode types", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["0", "1"] as any);
    mockReadlinkSync
      .mockReturnValueOnce("pipe:[67890]")
      .mockReturnValueOnce("anon_inode:[eventpoll]");
    mockReadFileSync.mockReturnValue("test");

    const { registerOpenFilesTools } = await import("../src/tools/open-files.js");
    const server = createMockServer();
    registerOpenFilesTools(server as any);

    const result = await server.tools["open_files"].handler({ pid: 100, max_files: 100 });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.open_files[0].type).toBe("pipe");
    expect(parsed.open_files[1].type).toBe("anon_inode");
  });

  it("truncates when max_files exceeded", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["0", "1", "2", "3", "4"] as any);
    mockReadlinkSync.mockReturnValue("/dev/null");
    mockReadFileSync.mockReturnValue("test");

    const { registerOpenFilesTools } = await import("../src/tools/open-files.js");
    const server = createMockServer();
    registerOpenFilesTools(server as any);

    const result = await server.tools["open_files"].handler({ pid: 100, max_files: 3 });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.open_files.length).toBe(3);
    expect(parsed.truncated).toBe(true);
  });

  it("skips unreadable FDs gracefully", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["0", "1", "2"] as any);
    mockReadlinkSync
      .mockReturnValueOnce("/dev/pts/0")
      .mockImplementationOnce(() => { throw new Error("permission denied"); })
      .mockReturnValueOnce("/dev/null");
    mockReadFileSync.mockReturnValue("test");

    const { registerOpenFilesTools } = await import("../src/tools/open-files.js");
    const server = createMockServer();
    registerOpenFilesTools(server as any);

    const result = await server.tools["open_files"].handler({ pid: 100, max_files: 100 });
    const parsed = JSON.parse(result.content[0].text);

    // FD 1 was skipped due to permission error
    expect(parsed.open_files.length).toBe(2);
    expect(parsed.open_files[0].fd).toBe(0);
    expect(parsed.open_files[1].fd).toBe(2);
  });
});
