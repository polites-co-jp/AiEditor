# Network audit: ooka-trial-net

- editor: C:\b\p0\vscode-1.146.0\Code.exe
- duration: 60 s, interval: 2 s, samples: 30
- destinations: editor 8, claude 0
- not in allowlist: 8
- new vs previous: (no previous list given)
- WARNING: Get-DnsClientCache returned no entries in any snapshot, so every destination is shown as an IP address. Check the permissions / DNS Client service, or add pktmon.
- allowlist: file not found, so everything is reported as not allowed

## Editor destinations (removal targets live here)

| host | port | first seen (s) | processes | samples | new | in allowlist |
|---|---|---|---|---|---|---|
| 13.107.5.93 (unresolved) | 443 | 0 | Code.exe | 30 |  | NO |
| 2603:1061:14:185::1 (unresolved) | 443 | 0 | Code.exe | 30 |  | NO |
| 185.199.111.133 (unresolved) | 443 | 2.9 | Code.exe | 3 |  | NO |
| 20.27.163.208 (unresolved) | 443 | 2.9 | Code.exe | 3 |  | NO |
| 2603:1061:14:187::1 (unresolved) | 443 | 2.9 | Code.exe | 29 |  | NO |
| 2603:1061:10:1::16 (unresolved) | 443 | 4 | Code.exe | 28 |  | NO |
| 52.175.140.176 (unresolved) | 443 | 4 | Code.exe | 2 |  | NO |
| 74.151.238.137 (unresolved) | 443 | 4 | Code.exe | 28 |  | NO |

## claude.exe destinations (separate table; not an editor removal target)

| host | port | first seen (s) | processes | samples | new | in allowlist |
|---|---|---|---|---|---|---|
| (none) | | | | | | |

## Not in the allowlist

- [editor] 13.107.5.93:443 via Code.exe, first seen 0 s
- [editor] 2603:1061:14:185::1:443 via Code.exe, first seen 0 s
- [editor] 185.199.111.133:443 via Code.exe, first seen 2.9 s
- [editor] 20.27.163.208:443 via Code.exe, first seen 2.9 s
- [editor] 2603:1061:14:187::1:443 via Code.exe, first seen 2.9 s
- [editor] 2603:1061:10:1::16:443 via Code.exe, first seen 4 s
- [editor] 52.175.140.176:443 via Code.exe, first seen 4 s
- [editor] 74.151.238.137:443 via Code.exe, first seen 4 s

## New destinations (not in the previous list)

(no previous list given; pass -Previous <dir or destinations.json>)

## Limits

- UDP and connections shorter than the interval are missed (docs/07 3.3). Use pktmon or Resource Monitor if needed.
- Loopback destinations are left out. They stay in samples.csv only if they were seen (they are not collected).
- Host names come from the DNS client cache; entries that expired between snapshots are lost. Unresolved addresses are shown as IPs.
