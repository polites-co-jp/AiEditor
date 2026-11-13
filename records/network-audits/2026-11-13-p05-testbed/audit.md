# Network audit: p05-testbed

- editor: C:\b\p0\testbed\VSCodium.exe
- duration: 600 s, interval: 2 s, samples: 300
- destinations: editor 2, claude 0
- not in allowlist: 2
- new vs previous: (no previous list given)
- net log: 2732 events, complete; host names come from it first, then the DNS client cache
- note: Get-DnsClientCache returned no entries (Chromium does its own lookups; on this PC the cache stays empty even for lookups made by PowerShell). Names for the Chromium side come from the net log.

## Editor destinations (removal targets live here)

| host | name from | port | first seen (s) | processes | samples | new | in allowlist |
|---|---|---|---|---|---|---|---|
| raw.githubusercontent.com | netlog | 443 | 4.6 | VSCodium.exe | 596 |  | NO |
| open-vsx.org | netlog | 443 | 6.6 | VSCodium.exe | 297 |  | NO |

## claude.exe destinations (separate table; not an editor removal target)

| host | name from | port | first seen (s) | processes | samples | new | in allowlist |
|---|---|---|---|---|---|---|---|
| (none) | | | | | | | |

## Not in the allowlist

- [editor] raw.githubusercontent.com:443 via VSCodium.exe, first seen 4.6 s
- [editor] open-vsx.org:443 via VSCodium.exe, first seen 6.6 s

(Hosts seen by name that are not in the allowlist. Checked one host at a time, so a shared CDN address cannot hide one.)

- [by name: netlog] open-vsx.org:443, 14 url requests, 36 resolutions, 0 node lookups
- [by name: netlog] raw.githubusercontent.com:443, 5 url requests, 17 resolutions, 0 node lookups

## New destinations (not in the previous list)

(no previous list given; pass -Previous <dir or destinations.json>)

## Hosts seen by name (net log = browser side, node = lookups by Node code; includes ones too short for the sampling)

| host | port | seen by | url requests | resolutions | answered | node lookups | seen in sampling | in allowlist |
|---|---|---|---|---|---|---|---|---|
| open-vsx.org | 443 | netlog | 14 | 36 | yes | 0 | yes | NO |
| raw.githubusercontent.com | 443 | netlog | 5 | 17 | yes | 0 | yes | NO |
| wpad | 80 | netlog | 0 | 5 | no | 0 | no | NO |

## Limits

- UDP and connections shorter than the interval are missed (docs/07 3.3). Use pktmon or Resource Monitor if needed.
- Loopback destinations are left out. They stay in samples.csv only if they were seen (they are not collected).
- Column "name from": netlog = the Chromium net log of the editor (resolver answers; valid for any process that reached the same address), dns-cache = Get-DnsClientCache, none = unresolved. A "hint only" name (reverse or forward lookup) never makes a destination allowed.
- The net log covers only the Chromium network service of the editor (requests from the windows and the main process). Node code (extension host, agent host) looks names up through Windows; its host names come from NODE_DEBUG=net ("node") - the host list is exact, the pairing of a host with an address is a hint (order of appearance within one pid).
- claude.exe is not Node-instrumented here: its addresses are named only by a forward lookup of the allowlist hosts (hint) or when the same address is in the net log.
- Not covered without administrator rights: lookups by processes that print nothing (DNS client event log, pktmon, TLS SNI). See hostname-design.md.
