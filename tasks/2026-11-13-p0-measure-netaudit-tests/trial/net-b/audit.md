# Network audit: trial-n2

- editor: tests/fixtures/fake-net-editor.cmd
- duration: 24 s, interval: 2 s, samples: 12
- destinations: editor 1, claude 0
- not in allowlist: 1
- new vs previous: 1

## Editor destinations (removal targets live here)

| host | port | first seen (s) | processes | samples | new | in allowlist |
|---|---|---|---|---|---|---|
| 104.20.23.154 (unresolved) | 443 | 0 | powershell.exe | 9 | NEW | NO |

## claude.exe destinations (separate table; not an editor removal target)

| host | port | first seen (s) | processes | samples | new | in allowlist |
|---|---|---|---|---|---|---|
| (none) | | | | | | |

## Not in the allowlist

- [editor] 104.20.23.154:443 via powershell.exe, first seen 0 s

## New destinations (not in the previous list)

- **NEW** [editor] 104.20.23.154:443 via powershell.exe, first seen 0 s

## Limits

- UDP and connections shorter than the interval are missed (docs/07 3.3). Use pktmon or Resource Monitor if needed.
- Loopback destinations are left out. They stay in samples.csv only if they were seen (they are not collected).
- Host names come from the DNS client cache; entries that expired between snapshots are lost. Unresolved addresses are shown as IPs.
