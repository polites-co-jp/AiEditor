# Measurement: trial-real5

- editor: C:\b\p0\vscode-1.146.0\Code.exe (1.146.0)
- env template: C:/b/p0/data/upstream-default
- workspace: E:\develop\self\Team\projects\ai-editor\tmp\ws (commit 2385a2ff1ea22ceaa5a039500f3f88361eef2392, dirty=True)
- files opened: E:\develop\self\Team\projects\ai-editor\tmp\ws\apps\api\src\routes\extraction.ts, E:\develop\self\Team\projects\ai-editor\tmp\ws\local-apps\topic-clusterer\topic_clusterer\labeling.py
- warm-up runs discarded: 0; counted runs: 1; milestone: False
- primary metric (docs/07 3.4): private bytes total, claude.exe and its descendants NOT included
- daily argv.json (~\.vscode, ~\.vscode-oss, ~\.shuko) created or changed during the run: no

| metric | median | min | max | range |
|---|---|---|---|---|
| PrivateExclClaude | 1,821.3 MiB | 1,821.3 MiB | 1,821.3 MiB | 0.0 MiB |
| PrivateInclClaude | 1,821.3 MiB | 1,821.3 MiB | 1,821.3 MiB | 0.0 MiB |
| WorkingSetExclClaude | 2,396.8 MiB | 2,396.8 MiB | 2,396.8 MiB | 0.0 MiB |
| WorkingSetInclClaude | 2,396.8 MiB | 2,396.8 MiB | 2,396.8 MiB | 0.0 MiB |

| run | kind | private (no claude) | private (with claude) | working set (no claude) | working set (with claude) | processes | claude procs |
|---|---|---|---|---|---|---|---|
| run-1 | measured | 1,821.3 MiB | 1,821.3 MiB | 2,396.8 MiB | 2,396.8 MiB | 18 | 0 |

See also: runs.csv, run-N-processes.csv, roles.csv, defaults-changed.md, pc-state.json.
To do by hand: one screenshot of the editor Process Explorer (not used for pass/fail; docs/07 3.2).
