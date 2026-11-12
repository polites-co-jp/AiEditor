# Network audit: trial-n3

- editor: tests/fixtures/fake-editor.cmd
- duration: 6 s, interval: 2 s, samples: 3
- destinations: editor 0, claude 0
- not in allowlist: 0
- new vs previous: (no previous list given)
- WARNING: Get-DnsClientCache returned no entries in any snapshot, so every destination is shown as an IP address. Check the permissions / DNS Client service, or add pktmon.
- allowlist: file not found, so everything is reported as not allowed

## Editor destinations (removal targets live here)

| host | port | first seen (s) | processes | samples | new | in allowlist |
|---|---|---|---|---|---|---|
| (none) | | | | | | |

## claude.exe destinations (separate table; not an editor removal target)

| host | port | first seen (s) | processes | samples | new | in allowlist |
|---|---|---|---|---|---|---|
| (none) | | | | | | |

## Not in the allowlist

(none)

## New destinations (not in the previous list)

(no previous list given; pass -Previous <dir or destinations.json>)

## Limits

- UDP and connections shorter than the interval are missed (docs/07 3.3). Use pktmon or Resource Monitor if needed.
- Loopback destinations are left out. They stay in samples.csv only if they were seen (they are not collected).
- Host names come from the DNS client cache; entries that expired between snapshots are lost. Unresolved addresses are shown as IPs.
