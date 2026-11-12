# Measurement: trial-real

- editor: C:\b\p0\vscode-1.146.0\Code.exe (1.146.0)
- env template: C:/b/p0/data/upstream-default
- workspace: E:/develop/self/Team/projects/ai-editor/tasks/2026-11-13-p0-measure-netaudit-tests/trial/ws (commit d12a7cce644df56884f37a0edb04a5280cfe5875, dirty=True)
- files opened: a.ts,b.py
- warm-up runs discarded: 0; counted runs: 1; milestone: False
- primary metric (docs/07 3.4): private bytes total, claude.exe and its descendants NOT included
- daily argv.json (~\.vscode, ~\.vscode-oss, ~\.shuko) created or changed during the run: no

| metric | median | min | max | range |
|---|---|---|---|---|
| PrivateExclClaude | 1,318.4 MiB | 1,318.4 MiB | 1,318.4 MiB | 0.0 MiB |
| PrivateInclClaude | 1,318.4 MiB | 1,318.4 MiB | 1,318.4 MiB | 0.0 MiB |
| WorkingSetExclClaude | 1,650.2 MiB | 1,650.2 MiB | 1,650.2 MiB | 0.0 MiB |
| WorkingSetInclClaude | 1,650.2 MiB | 1,650.2 MiB | 1,650.2 MiB | 0.0 MiB |

| run | kind | private (no claude) | private (with claude) | working set (no claude) | working set (with claude) | processes | claude procs |
|---|---|---|---|---|---|---|---|
| run-1 | measured | 1,318.4 MiB | 1,318.4 MiB | 1,650.2 MiB | 1,650.2 MiB | 12 | 0 |

See also: runs.csv, run-N-processes.csv, roles.csv, defaults-changed.md, pc-state.json.
To do by hand: one screenshot of the editor Process Explorer (not used for pass/fail; docs/07 3.2).
