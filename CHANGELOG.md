## [0.1.7] - 2026-06-16

### Added
- `system_info` tool: OS identification (kernel, architecture, hostname, distro, timezone, NTP status, optional package count)
- 5 unit tests for system_info (mocked fs and child_process)
- CONTRIBUTING.md development guide

### Changed
- Tool count: 18 → 19
- Test count: 72 → 77

## [0.1.6] - 2026-06-16

### Added
- `network_diagnostics` tool: DNS resolution, latency (ping), download speed test, and network interface summary in one call
- 5 unit tests for network_diagnostics (mocked nslookup, ping, curl, ip)
- CONTRIBUTING.md development guide

### Changed
- Tool count: 17 → 18
- Test count: 67 → 72

## [0.1.5] - 2026-06-16

### Added
- 67 unit tests across 13 test files (all 17 tools covered)
- README: comparison table (vs node_exporter, Netdata, telegraf)
- README: use cases section (5 agent scenarios)
- README: testing section with test count badge
- README: companion server link to Docker MCP
- README: Claude Desktop + Docker MCP combined config

### Changed
- All 17 tools fully tested with mocked fs and child_process

     1|## [0.1.4] - 2026-06-16
     2|
     3|### Fixed
     4|- README and glama.json tool count corrected from 13/15 to 17 (actual registered tools)
     5|- server.ts version field updated to match package.json
     6|
     7|# Changelog
     8|
     9|## [0.1.3] - 2026-06-16
    10|
    11|### Added
    12|- `open_files` tool — lists open file descriptors for a process by reading /proc/{pid}/fd symlinks. Shows FD number, target path, and file type (device, socket, pipe, file). Useful for debugging file handle leaks and understanding what a process has open.
    13|- `login_history` tool — shows login/logout history from wtmp/btmp logs via the `last` command. Supports username filtering, failed login attempts, and configurable entry limits. Useful for security auditing and access tracking.
    14|
    15|### Notes
    16|- 17 tools across 13 source files.
    17|
    18|## [0.1.2] - 2026-06-16
    19|
    20|### Added
    21|- `process_tree` tool — shows process hierarchy (parent-child relationships) using pstree or /proc fallback. Supports root PID selection, max depth control, and optional PID display. Useful for debugging service dependencies and understanding what spawned what.
    22|
    23|### Notes
    24|- 15 tools across 11 source files.
    25|
    26|## [0.1.1] - 2026-06-16
    27|
    28|### Added
    29|- `temperature_sensors` tool — reads CPU/system temperatures from `/sys/class/thermal/thermal_zone*`, returns zone name, type, and current temperature in Celsius. Falls back to a helpful message when no thermal zones are present (e.g. containers/VMs without thermal monitoring).
    30|
    31|### Notes
    32|- 14 tools across 10 source files.
    33|
    34|## [0.1.0] - 2026-06-16
    35|
    36|### Added
    37|- 13 tools for Linux system monitoring via /proc, /sys, and journald
    38|- `system_overview` — CPU, memory, disk, uptime, load averages
    39|- `process_list` — running processes sorted by CPU/memory
    40|- `disk_usage` — mounted filesystems with usage percentages
    41|- `inode_usage` — inode consumption per filesystem
    42|- `network_interfaces` — interface IPs, MTU, stats
    43|- `network_connections` — active TCP/UDP connections
    44|- `systemd_services` — list all systemd services
    45|- `service_status` — detailed status of a specific service
    46|- `system_logs` — journalctl log entries with filtering
    47|- `cpu_info` — CPU model, cores, frequencies, flags
    48|- `memory_detail` — detailed memory breakdown (buffers, cache, swap)
    49|- `top_memory_consumers` — top N processes by memory usage
    50|- `io_stats` — disk I/O statistics per device
    51|- TypeScript implementation, 13 tools across 9 source files
    52|- README with installation, configuration, and troubleshooting
    53|- Glama metadata (glama.json) for MCP directory indexing