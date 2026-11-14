# Network audit: p2gate-B-1

- editor: C:/b/p2/1.146.0-p2-B-1/Shuko-win32-x64-1.146.0-p2-B-1/Shuko.exe
- duration: 600 s, interval: 2 s, samples: 300
- destinations: editor 0, claude 0
- not in allowlist: 0
- new vs previous: 0
- net log: 76 events, complete; host names come from it first, then the DNS client cache
- note: Get-DnsClientCache returned no entries (Chromium does its own lookups; on this PC the cache stays empty even for lookups made by PowerShell). Names for the Chromium side come from the net log.

## Editor destinations (removal targets live here)

| host | name from | port | first seen (s) | processes | samples | new | in allowlist |
|---|---|---|---|---|---|---|---|
| (none) | | | | | | | |

## claude.exe destinations (separate table; not an editor removal target)

| host | name from | port | first seen (s) | processes | samples | new | in allowlist |
|---|---|---|---|---|---|---|---|
| (none) | | | | | | | |

## Not in the allowlist

(none)

(Hosts seen by name that are not in the allowlist. Checked one host at a time, so a shared CDN address cannot hide one.)

(none)

## New destinations (not in the previous list)

(none)

## Hosts seen by name (net log = browser side, node = lookups by Node code; includes ones too short for the sampling)

| host | port | seen by | url requests | resolutions | answered | node lookups | seen in sampling | in allowlist |
|---|---|---|---|---|---|---|---|---|
| wpad | 80 | netlog | 0 | 2 | no | 0 | no | NO |

## Limits

- UDP and connections shorter than the interval are missed (docs/07 3.3). Use pktmon or Resource Monitor if needed.
- Loopback destinations are left out. They stay in samples.csv only if they were seen (they are not collected).
- Column "name from": netlog = the Chromium net log of the editor (names the host a Chromium socket was opened for; used only for rows whose processes are all the network service or main, otherwise it is shown as a hint), dns-cache = Get-DnsClientCache, none = unresolved. A "hint only" name (reverse or forward lookup) never makes a destination allowed.
- The net log covers only the Chromium network service of the editor (requests from the windows and the main process). Node code (extension host, agent host) looks names up through Windows; its host names come from NODE_DEBUG=net ("node") - the host list is exact, the pairing of a host with an address is a hint (order of appearance within one pid).
- claude.exe is not Node-instrumented here: its addresses are named only by a forward lookup of the allowlist hosts (a hint). A net-log name is a hint too (its rows have the claude-cli role, not the network service or main) and never makes a destination allowed.
- Not covered without administrator rights: lookups by processes that print nothing (DNS client event log, pktmon, TLS SNI). See hostname-design.md.
