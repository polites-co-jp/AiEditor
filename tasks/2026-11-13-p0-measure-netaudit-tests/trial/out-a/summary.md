# Measurement: trial-a

- editor: tests/fixtures/fake-editor.cmd ()
- env template: tasks/2026-11-13-p0-measure-netaudit-tests/trial/env
- workspace: tasks/2026-11-13-p0-measure-netaudit-tests/trial/ws (commit b96e889462868d8b49a52fb4463d9493438e3a4b, dirty=True)
- files opened: a.ts,b.py
- warm-up runs discarded: 1; counted runs: 2; milestone: False
- primary metric (docs/07 3.4): private bytes total, claude.exe and its descendants NOT included

| metric | median | min | max | range |
|---|---|---|---|---|
| PrivateExclClaude | 9.9 MiB | 9.9 MiB | 9.9 MiB | 0.0 MiB |
| PrivateInclClaude | 9.9 MiB | 9.9 MiB | 9.9 MiB | 0.0 MiB |
| WorkingSetExclClaude | 27.5 MiB | 27.5 MiB | 27.5 MiB | 0.0 MiB |
| WorkingSetInclClaude | 27.5 MiB | 27.5 MiB | 27.5 MiB | 0.0 MiB |

| run | kind | private (no claude) | private (with claude) | working set (no claude) | working set (with claude) | processes | claude procs |
|---|---|---|---|---|---|---|---|
| warmup-1 | warmup | 9.6 MiB | 9.6 MiB | 27.3 MiB | 27.3 MiB | 3 | 0 |
| run-1 | measured | 9.9 MiB | 9.9 MiB | 27.5 MiB | 27.5 MiB | 3 | 0 |
| run-2 | measured | 9.9 MiB | 9.9 MiB | 27.5 MiB | 27.5 MiB | 3 | 0 |

See also: runs.csv, run-N-processes.csv, roles.csv, defaults-changed.md, pc-state.json.
To do by hand: one screenshot of the editor Process Explorer (not used for pass/fail; docs/07 3.2).
