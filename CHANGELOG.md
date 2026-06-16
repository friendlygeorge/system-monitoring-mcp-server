# Changelog

## [0.1.2] - 2026-06-16

### Added
- `process_tree` tool — shows process hierarchy (parent-child relationships) using pstree or /proc fallback. Supports root PID selection, max depth control, and optional PID display. Useful for debugging service dependencies and understanding what spawned what.

### Notes
- 15 tools across 11 source files.

## [0.1.1] - 2026-06-16

### Added
- `temperature_sensors` tool — reads CPU/system temperatures from `/sys/class/thermal/thermal_zone*`, returns zone name, type, and current temperature in Celsius. Falls back to a helpful message when no thermal zones are present (e.g. containers/VMs without thermal monitoring).

### Notes
- 14 tools across 10 source files.

## [0.1.0] - 2026-06-16

### Added
- 13 tools for Linux system monitoring via /proc, /sys, and journald
- `system_overview` — CPU, memory, disk, uptime, load averages
- `process_list` — running processes sorted by CPU/memory
- `disk_usage` — mounted filesystems with usage percentages
- `inode_usage` — inode consumption per filesystem
- `network_interfaces` — interface IPs, MTU, stats
- `network_connections` — active TCP/UDP connections
- `systemd_services` — list all systemd services
- `service_status` — detailed status of a specific service
- `system_logs` — journalctl log entries with filtering
- `cpu_info` — CPU model, cores, frequencies, flags
- `memory_detail` — detailed memory breakdown (buffers, cache, swap)
- `top_memory_consumers` — top N processes by memory usage
- `io_stats` — disk I/O statistics per device
- TypeScript implementation, 13 tools across 9 source files
- README with installation, configuration, and troubleshooting
- Glama metadata (glama.json) for MCP directory indexing