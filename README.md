# System Monitoring MCP Server

[![npm version](https://img.shields.io/npm/v/@supernova123/system-monitoring-mcp-server)](https://www.npmjs.com/package/@supernova123/system-monitoring-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@supernova123/system-monitoring-mcp-server)](https://www.npmjs.com/package/@supernova123/system-monitoring-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-compatible-green)](https://modelcontextprotocol.io)
[![Claude Desktop](https://img.shields.io/badge/Claude%20Desktop-compatible-purple)](https://claude.ai)

[![Tests](https://img.shields.io/badge/tests-77%20passing-brightgreen)](#testing)

MCP server for Linux system monitoring — CPU, memory, disk, network, processes, systemd services, and system logs. Agent-native structured interface for AI assistants like Claude, Cursor, and Copilot.

## Why This Exists

Most system monitoring tools (Prometheus, Grafana, Netdata) are designed for dashboards and humans. This server gives AI agents structured, queryable access to the same data — no dashboards, no config files, no scraping. One tool call returns exactly what the agent needs.

**Companion server:** [Docker MCP Server](https://github.com/friendlygeorge/docker-mcp-server) for container-level monitoring. This server handles host-level monitoring. Together they cover the full infrastructure stack.

## Features (19 Tools)

| Tool | Description |
|------|-------------|
| `system_overview` | Complete system snapshot: CPU load, memory, disk, uptime |
| `process_list` | Top processes by CPU or memory usage |
| `disk_usage` | Filesystem usage with inode counts |
| `inode_usage` | Inode consumption per filesystem |
| `network_interfaces` | Interface stats, IPs, traffic counters |
| `network_connections` | Active TCP/UDP connections with states |
| `network_diagnostics` | DNS resolution, latency (ping), and download speed test |
| `systemd_services` | Service status (active/failed/inactive) |
| `service_status` | Detailed service info with recent logs |
| `system_logs` | Journald logs with service/priority/time filters |
| `system_info` | OS, kernel, hostname, architecture details |
| `cpu_info` | CPU model, cores, frequency, current usage |
| `memory_detail` | RAM breakdown: buffers, cache, swap |
| `top_memory_consumers` | Processes consuming most memory |
| `io_stats` | Disk I/O statistics per block device |
| `temperature_sensors` | CPU/system temperatures from thermal zones |
| `process_tree` | Process tree hierarchy (parent-child relationships) |
| `open_files` | List open files for a process via /proc/{pid}/fd symlinks |
| `login_history` | Login/logout history from wtmp/btmp logs |

## Comparison

| Feature | This Server | node_exporter | Netdata | telegraf |
|---------|------------|---------------|---------|----------|
| **MCP native** | ✅ stdio | ❌ HTTP/REST | ❌ HTTP/REST | ❌ HTTP/REST |
| **Agent-ready JSON** | ✅ structured | ⚠️ Prometheus format | ⚠️ JSON but nested | ⚠️ InfluxDB line protocol |
| **Zero config** | ✅ | ❌ needs scraping | ❌ needs agent install | ❌ needs config file |
| **Tool count** | 19 | ~200 metrics | ~1,000 metrics | ~300 inputs |
| **Install weight** | ~5 MB | ~30 MB binary | ~200 MB | ~100 MB |
| **Dependencies** | Node.js | None | C, many libs | Go |

**When to use this:** You want an AI agent to query host metrics via MCP. Fast install, structured output, no infrastructure.

**When to use alternatives:** You need long-term metric storage, dashboards, alerting pipelines, or Kubernetes-level metrics.

## Use Cases

**Infrastructure debugging:** Agent detects slow response times, queries `cpu_info` + `memory_detail` + `io_stats` to identify the bottleneck.

**Capacity planning:** Agent periodically checks `system_overview` + `disk_usage` + `top_memory_consumers` to track resource trends.

**Security monitoring:** Agent uses `login_history` + `network_connections` + `open_files` to detect unusual activity.

**Service health:** Agent checks `systemd_services` for failed units, then `service_status` for logs — all in one conversation turn.

**Combined with Docker MCP:** Agent queries host-level (`cpu_info`) and container-level (`container_stats`) simultaneously to correlate performance issues.

## Installation

```bash
npm install -g @supernova123/system-monitoring-mcp-server
```

## Usage

### Claude Desktop

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "system-monitoring": {
      "command": "system-monitoring-mcp-server"
    }
  }
}
```

### Claude Desktop + Docker MCP (Full Stack)

```json
{
  "mcpServers": {
    "system-monitoring": {
      "command": "system-monitoring-mcp-server"
    },
    "docker": {
      "command": "npx",
      "args": ["@supernova123/docker-mcp-server"]
    }
  }
}
```

### npx

```bash
npx @supernova123/system-monitoring-mcp-server
```

### Cursor / Other MCP Clients

Configure the MCP server connection in your client's settings. The server communicates via stdio (standard input/output).

## Requirements

- Linux (reads from /proc, /sys, journald)
- Node.js >= 18
- systemd (for service monitoring tools)

## Tools Detail

### system_overview
Returns a complete system snapshot in one call. Use this first to understand the current state.

```json
{
  "hostname": "nova-server",
  "uptime": "14d 3h 22m",
  "cpu": { "count": 2, "load_1m": 0.5, "load_5m": 0.3, "load_15m": 0.2 },
  "memory": { "total_bytes": 4294967296, "usage_percent": 45.2 },
  "disk": { "total_bytes": 107374182400, "usage_percent": "62%" }
}
```

### process_list
Like `top` but structured. Sort by CPU or memory. Returns PID, user, CPU%, MEM%, and truncated command.

### disk_usage
Shows all mounted filesystems or a specific path. Includes total, used, available, and usage percentage.

### network_interfaces
Lists all interfaces with IPs, MAC addresses, link state, and traffic stats. Supports filtering by interface name.

### network_connections
Active TCP/UDP connections. Filter by state: all, established, or listening. Shows local/remote addresses.

### systemd_services
List all systemd services filtered by state (active, failed, inactive). Shows service name, state, and description.

### service_status
Deep dive into a single service: full status output + last 10 journal entries.

### system_logs
Read journald logs with filters. Service name, priority level, line count, and time range all supported.

### cpu_info
CPU model, per-core details, and current usage breakdown from /proc/stat.

### memory_detail
Full RAM + swap breakdown: total, used, free, buffers, cached, slab, page tables.

### top_memory_consumers
Quick list of processes eating the most RAM. Returns PID, MEM%, RSS (MB), and command.

### io_stats
Per-device disk I/O: reads, writes, sectors, I/O time. From /proc/diskstats.

### temperature_sensors
CPU and system temperatures from /sys/class/thermal/thermal_zone*. Each entry includes the zone identifier, sensor name, sensor type (e.g. `x86_pkg_temp`, `cpu-thermal`), and current temperature in Celsius (converted from the kernel's millidegree units). Returns a helpful message if no thermal zones are present (common in containers/VMs).

```json
{
  "sensors": [
    { "zone": "thermal_zone0", "name": "x86_pkg_temp", "type": "x86_pkg_temp", "temp_celsius": 52.5 },
    { "zone": "thermal_zone1", "name": "acpitz", "type": "acpitz", "temp_celsius": 45.0 }
  ]
}
```

### system_info
OS identification: kernel version, architecture, hostname, distribution, time zone, and NTP status. Use this to understand what system you're working on before running other commands.

### network_diagnostics
Run network diagnostics: DNS resolution, latency (ping), and download speed test. Returns structured results for each test. Useful for diagnosing connectivity issues, measuring bandwidth, and verifying DNS health.

### login_history
Show login/logout history from wtmp/btmp logs using the `last` command. Shows who logged in, from where, when, and session duration. Useful for security auditing, tracking access patterns, and debugging session issues.

### open_files
List open files for a given process by reading `/proc/{pid}/fd` symlinks. Shows file descriptors, target paths, and file types. Useful for debugging file handle leaks, understanding what a process has open, and diagnosing permission issues.

### process_tree
Show process tree (parent-child hierarchy) using pstree or /proc. Useful for understanding service dependencies, debugging runaway processes, and seeing what spawned what.

## Testing

77 unit tests covering all 19 tools:

```bash
npx vitest run
```

Tests mock `/proc` and `/sys` filesystem reads for deterministic results — no root required.

## Troubleshooting

### Permission denied on /proc or /sys
Most tools read from `/proc` and `/sys` which are world-readable. If you see permission errors, check that your user can read these paths:
```bash
ls -la /proc/stat /proc/meminfo /proc/diskstats
```

### systemd tools return empty
The `systemd_services` and `service_status` tools require `systemctl` to be available. On systems without systemd (e.g., Docker containers, Alpine Linux), these tools will return empty results. The server will still function for non-systemd tools.

### Journal access denied
`system_logs` reads from journald. If you get permission errors, your user may need to be in the `systemd-journal` group:
```bash
sudo usermod -aG systemd-journal $USER
```

### High CPU usage
The server reads live data from `/proc` on each tool call. Under normal usage this is negligible. If you're polling frequently (every second), consider using `system_overview` instead of individual tools to reduce overhead.

## License

MIT