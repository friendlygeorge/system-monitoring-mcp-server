# System Monitoring MCP Server

[![npm](https://img.shields.io/npm/v/@supernova123/system-monitoring-mcp-server)](https://www.npmjs.com/package/@supernova123/system-monitoring-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP server for Linux system monitoring — CPU, memory, disk, network, processes, systemd services, and system logs. Agent-native structured interface for AI assistants like Claude, Cursor, and Copilot.

## Features (14 Tools)

| Tool | Description |
|------|-------------|
| `system_overview` | Complete system snapshot: CPU load, memory, disk, uptime |
| `process_list` | Top processes by CPU or memory usage |
| `disk_usage` | Filesystem usage with inode counts |
| `inode_usage` | Inode consumption per filesystem |
| `network_interfaces` | Interface stats, IPs, traffic counters |
| `network_connections` | Active TCP/UDP connections with states |
| `systemd_services` | Service status (active/failed/inactive) |
| `service_status` | Detailed service info with recent logs |
| `system_logs` | Journald logs with service/priority/time filters |
| `cpu_info` | CPU model, cores, frequency, current usage |
| `memory_detail` | RAM breakdown: buffers, cache, swap |
| `top_memory_consumers` | Processes consuming most memory |
| `io_stats` | Disk I/O statistics per block device |
| `temperature_sensors` | CPU/system temperatures from thermal zones |

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
