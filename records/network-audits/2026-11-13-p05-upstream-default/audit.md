# Network audit: p05-upstream-default

- editor: C:\b\p0\vscode-1.146.0\Code.exe
- duration: 600 s, interval: 2 s, samples: 300
- destinations: editor 7, claude 0
- not in allowlist: 7
- new vs previous: (no previous list given)
- net log: 10907 events, complete; host names come from it first, then the DNS client cache
- note: Get-DnsClientCache returned no entries (Chromium does its own lookups; on this PC the cache stays empty even for lookups made by PowerShell). Names for the Chromium side come from the net log.

## Editor destinations (removal targets live here)

| host | name from | port | first seen (s) | processes | samples | new | in allowlist |
|---|---|---|---|---|---|---|---|
| default.exp-tas.com / deault-exp-tas-com.e-0014.e-msedge.net / e-0014.e-msedge.net | netlog | 443 | 2.7 | Code.exe | 64 |  | NO |
| main.vscode-cdn.net / vscode-cdn.z01.azurefd.net / mr-z01.tm-azurefd.net / update.code.visualstudio.com / vscode-update-g6gcb6ggdthkctd9.z01.azurefd.net | netlog | 443 | 2.7 | Code.exe | 105 |  | NO |
| 185.199.108.133 (unresolved) - hint only: cdn-185-199-108-133.github.com [rdns] | none | 443 | 4.8 | Code.exe | 2 |  | NO |
| 20.27.177.113 (unresolved) - hint only: github.com [node-debug] / release-assets.githubusercontent.com [node-debug] / mobile.events.data.microsoft.com [node-debug] | none | 443 | 4.8 | Code.exe | 2 |  | NO |
| 52.175.140.176 (unresolved) - hint only: exp.individual.githubcopilot.com [node-debug] | none | 443 | 4.8 | Code.exe | 3 |  | NO |
| mobile.events.data.microsoft.com / mobile.events.data.trafficmanager.net / onedscolprdjpe52.japaneast.cloudapp.azure.com | netlog | 443 | 4.8 | Code.exe | 83 |  | NO |
| marketplace.visualstudio.com / market.bx-0007.bx-msedge.net / market-l0.trafficmanager.net / bx-0007.bx-msedge.net | netlog | 443 | 6.7 | Code.exe | 80 |  | NO |

## claude.exe destinations (separate table; not an editor removal target)

| host | name from | port | first seen (s) | processes | samples | new | in allowlist |
|---|---|---|---|---|---|---|---|
| (none) | | | | | | | |

## Not in the allowlist

- [editor] default.exp-tas.com:443 via Code.exe, first seen 2.7 s
- [editor] main.vscode-cdn.net:443 via Code.exe, first seen 2.7 s
- [editor] 185.199.108.133:443 via Code.exe, first seen 4.8 s
- [editor] 20.27.177.113:443 via Code.exe, first seen 4.8 s
- [editor] 52.175.140.176:443 via Code.exe, first seen 4.8 s
- [editor] mobile.events.data.microsoft.com:443 via Code.exe, first seen 4.8 s
- [editor] marketplace.visualstudio.com:443 via Code.exe, first seen 6.7 s

(Hosts seen by name that are not in the allowlist. Checked one host at a time, so a shared CDN address cannot hide one.)

- [by name: netlog+node] mobile.events.data.microsoft.com:443, 9 url requests, 28 resolutions, 2 node lookups
- [by name: netlog] marketplace.visualstudio.com:443, 7 url requests, 21 resolutions, 0 node lookups
- [by name: netlog] main.vscode-cdn.net:443, 5 url requests, 17 resolutions, 0 node lookups
- [by name: netlog+node] default.exp-tas.com:443, 2 url requests, 6 resolutions, 1 node lookups
- [by name: netlog] update.code.visualstudio.com:443, 2 url requests, 5 resolutions, 0 node lookups
- [by name: node] exp.individual.githubcopilot.com:443, 0 url requests, 0 resolutions, 1 node lookups
- [by name: node] release-assets.githubusercontent.com:443, 0 url requests, 0 resolutions, 1 node lookups

## New destinations (not in the previous list)

(no previous list given; pass -Previous <dir or destinations.json>)

## Hosts seen by name (net log = browser side, node = lookups by Node code; includes ones too short for the sampling)

| host | port | seen by | url requests | resolutions | answered | node lookups | seen in sampling | in allowlist |
|---|---|---|---|---|---|---|---|---|
| mobile.events.data.microsoft.com | 443 | netlog+node | 9 | 28 | yes | 2 | yes | NO |
| marketplace.visualstudio.com | 443 | netlog | 7 | 21 | yes | 0 | yes | NO |
| main.vscode-cdn.net | 443 | netlog | 5 | 17 | yes | 0 | yes | NO |
| default.exp-tas.com | 443 | netlog+node | 2 | 6 | yes | 1 | yes | NO |
| update.code.visualstudio.com | 443 | netlog | 2 | 5 | yes | 0 | yes | NO |
| wpad | 80 | netlog | 0 | 7 | no | 0 | no | NO |
| exp.individual.githubcopilot.com | 443 | node | 0 | 0 | no | 1 | no | NO |
| github.com | 443 | node | 0 | 0 | no | 1 | no | yes |
| release-assets.githubusercontent.com | 443 | node | 0 | 0 | no | 1 | no | NO |

## Limits

- UDP and connections shorter than the interval are missed (docs/07 3.3). Use pktmon or Resource Monitor if needed.
- Loopback destinations are left out. They stay in samples.csv only if they were seen (they are not collected).
- Column "name from": netlog = the Chromium net log of the editor (resolver answers; valid for any process that reached the same address), dns-cache = Get-DnsClientCache, none = unresolved. A "hint only" name (reverse or forward lookup) never makes a destination allowed.
- The net log covers only the Chromium network service of the editor (requests from the windows and the main process). Node code (extension host, agent host) looks names up through Windows; its host names come from NODE_DEBUG=net ("node") - the host list is exact, the pairing of a host with an address is a hint (order of appearance within one pid).
- claude.exe is not Node-instrumented here: its addresses are named only by a forward lookup of the allowlist hosts (hint) or when the same address is in the net log.
- Not covered without administrator rights: lookups by processes that print nothing (DNS client event log, pktmon, TLS SNI). See hostname-design.md.
