# Network audit: trial-real2

- editor: C:\b\p0\vscode-1.146.0\Code.exe
- duration: 60 s, interval: 2 s, samples: 30
- destinations: editor 9, claude 0
- not in allowlist: 9
- new vs previous: (no previous list given)
- WARNING: Get-DnsClientCache returned no entries in any snapshot, so every destination is shown as an IP address. Check the permissions / DNS Client service, or add pktmon.

## Editor destinations (removal targets live here)

| host | port | first seen (s) | processes | samples | new | in allowlist |
|---|---|---|---|---|---|---|
| 13.107.5.93 (unresolved) | 443 | 4.4 | Code.exe | 29 |  | NO |
| 2603:1061:14:188::1 (unresolved) | 443 | 4.4 | Code.exe | 29 |  | NO |
| 51.132.193.108 (unresolved) | 443 | 5 | Code.exe | 28 |  | NO |
| 185.199.111.133 (unresolved) | 443 | 6.8 | Code.exe | 2 |  | NO |
| 20.27.177.113 (unresolved) | 443 | 6.8 | Code.exe | 2 |  | NO |
| 2603:1061:10::16 (unresolved) | 443 | 6.8 | Code.exe | 27 |  | NO |
| 2603:1061:14:189::1 (unresolved) | 443 | 6.8 | Code.exe | 27 |  | NO |
| 52.175.140.176 (unresolved) | 443 | 8.6 | Code.exe | 2 |  | NO |
| 74.151.238.100 (unresolved) | 443 | 19.5 | Code.exe | 1 |  | NO |

## claude.exe destinations (separate table; not an editor removal target)

| host | port | first seen (s) | processes | samples | new | in allowlist |
|---|---|---|---|---|---|---|
| (none) | | | | | | |

## Not in the allowlist

- [editor] 13.107.5.93:443 via Code.exe, first seen 4.4 s
- [editor] 2603:1061:14:188::1:443 via Code.exe, first seen 4.4 s
- [editor] 51.132.193.108:443 via Code.exe, first seen 5 s
- [editor] 185.199.111.133:443 via Code.exe, first seen 6.8 s
- [editor] 20.27.177.113:443 via Code.exe, first seen 6.8 s
- [editor] 2603:1061:10::16:443 via Code.exe, first seen 6.8 s
- [editor] 2603:1061:14:189::1:443 via Code.exe, first seen 6.8 s
- [editor] 52.175.140.176:443 via Code.exe, first seen 8.6 s
- [editor] 74.151.238.100:443 via Code.exe, first seen 19.5 s

## New destinations (not in the previous list)

(no previous list given; pass -Previous <dir or destinations.json>)

## Limits

- UDP and connections shorter than the interval are missed (docs/07 3.3). Use pktmon or Resource Monitor if needed.
- Loopback destinations are left out. They stay in samples.csv only if they were seen (they are not collected).
- Host names come from the DNS client cache; entries that expired between snapshots are lost. Unresolved addresses are shown as IPs.
