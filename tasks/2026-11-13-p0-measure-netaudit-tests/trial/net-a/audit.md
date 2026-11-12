# Network audit: trial-n

- editor: tests/fixtures/fake-editor.cmd
- duration: 14 s, interval: 2 s, samples: 7
- destinations: editor 0, claude 0
- not in allowlist: 0
- new vs previous: (no previous list given)

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
