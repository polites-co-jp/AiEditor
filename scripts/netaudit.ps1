<#
.SYNOPSIS
  Outbound connection audit (docs/07 section 3.3). Fixed in Phase 0, used from then on.

.DESCRIPTION
  Starts the editor on a fresh data dir (copied from an env template, same as
  measure.ps1), then for -DurationSeconds (default 600) every -IntervalSeconds
  (default 2) takes Get-NetTCPConnection -State Established, keeps only the
  connections of the editor process tree, and ties remote IPs to host names with
  Get-DnsClientCache (at the start, at the end, and every -DnsIntervalSeconds).
  Output: samples.csv, destinations.csv/json, dns-cache.csv, audit.md.

  Destinations are split in two groups: "editor" and "claude" (claude.exe and its
  descendants; not a removal target, listed in a separate table).

  Allowed destinations: records\network-allowlist.json (format: see
  tasks\2026-11-13-p0-measure-netaudit-tests\netaudit-design.md). Anything not
  matched is reported as "not in allowlist".

  Dot-source this file to load only the functions:  . scripts\netaudit.ps1
  (it also loads scripts\measure.ps1 for the shared functions).

  ASCII only on purpose (Windows PowerShell 5.1 reads a BOM-less file as ANSI).
#>
[CmdletBinding()]
param(
    [string]$Exe,
    [string]$EnvDir,
    [string]$Workspace,   # default <repo>\tmp\ws, decided in the body
    [string[]]$OpenFiles,
    [string]$Label,
    [int]$DurationSeconds = 600,
    [int]$IntervalSeconds = 2,
    [int]$DnsIntervalSeconds = 30,
    [int]$LaunchWaitSeconds = 30,
    [string]$OutDir,
    [string]$Allowlist,
    [string]$Previous,
    [string]$WorkRoot = 'C:\b\p0\run',
    [string]$ProcessName,
    [switch]$KeepData,
    [switch]$Force
)

# Keep our parameters: dot-sourcing measure.ps1 would overwrite same-named variables.
$na = @{
    Exe = $Exe; EnvDir = $EnvDir; Workspace = $Workspace; OpenFiles = $OpenFiles; Label = $Label
    DurationSeconds = $DurationSeconds; IntervalSeconds = $IntervalSeconds; DnsIntervalSeconds = $DnsIntervalSeconds
    LaunchWaitSeconds = $LaunchWaitSeconds; OutDir = $OutDir; Allowlist = $Allowlist; Previous = $Previous
    WorkRoot = $WorkRoot; ProcessName = $ProcessName; KeepData = [bool]$KeepData; Force = [bool]$Force
}
$naIsLibrary = ($MyInvocation.InvocationName -eq '.')

. (Join-Path $PSScriptRoot 'measure.ps1')

# ---------------------------------------------------------------------------
# Pure functions (tested by tests\netaudit.tests.ps1)
# ---------------------------------------------------------------------------

function ConvertTo-NormalIp {
    <# Canonical IP string, or $null. Strips %scope; IPv4-mapped IPv6 becomes IPv4. #>
    param([string]$Text)
    if (-not $Text) { return $null }
    $t = $Text.Trim()
    $i = $t.IndexOf('%')
    if ($i -ge 0) { $t = $t.Substring(0, $i) }
    $ip = $null
    if (-not [System.Net.IPAddress]::TryParse($t, [ref]$ip)) { return $null }
    if ($ip.IsIPv4MappedToIPv6) { $ip = $ip.MapToIPv4() }
    return $ip.ToString()
}

function Test-IgnoredAddress {
    <# Loopback and unspecified addresses are not "destinations". #>
    param([string]$Address)
    $n = ConvertTo-NormalIp $Address
    if (-not $n) { return $true }
    if ($n -like '127.*') { return $true }
    if ($n -eq '0.0.0.0' -or $n -eq '::' -or $n -eq '::1') { return $true }
    return $false
}

function Get-DnsRecordType {
    param($Type)
    $t = "$Type".Trim().ToUpperInvariant()
    switch ($t) {
        '1' { return 'A' }
        'A' { return 'A' }
        '28' { return 'AAAA' }
        'AAAA' { return 'AAAA' }
        '5' { return 'CNAME' }
        'CNAME' { return 'CNAME' }
        default { return $t }
    }
}

function Get-DnsMap {
    <#
      Entries: objects with Name (or Entry), Type (1/A, 28/AAAA, 5/CNAME) and Data
      (from Get-DnsClientCache, possibly several snapshots concatenated).
      Returns a hashtable: normalized IP -> string[] of lower-case host names,
      outermost alias (what the program asked for) first, canonical name last.
    #>
    param($Entries)
    $aliasesOf = @{}   # target -> alias list
    $addr = @()        # @{ Name; Ip }
    foreach ($e in $Entries) {
        $nm = $null
        if ($e.PSObject.Properties['Entry'] -and $e.Entry) { $nm = "$($e.Entry)" }
        elseif ($e.PSObject.Properties['Name'] -and $e.Name) { $nm = "$($e.Name)" }
        if (-not $nm) { continue }
        $nm = $nm.TrimEnd('.').ToLowerInvariant()
        $type = Get-DnsRecordType $e.Type
        $data = "$($e.Data)"
        if ($type -eq 'CNAME') {
            $target = $data.TrimEnd('.').ToLowerInvariant()
            if (-not $target) { continue }
            if (-not $aliasesOf.ContainsKey($target)) { $aliasesOf[$target] = New-Object System.Collections.ArrayList }
            if (-not $aliasesOf[$target].Contains($nm)) { [void]$aliasesOf[$target].Add($nm) }
        }
        elseif ($type -eq 'A' -or $type -eq 'AAAA') {
            $ip = ConvertTo-NormalIp $data
            if ($ip) { $addr += [pscustomobject]@{ Name = $nm; Ip = $ip } }
        }
    }
    $map = @{}
    foreach ($a in $addr) {
        # levels: canonical, then aliases pointing to it, then aliases of those...
        $levels = @(, @($a.Name))
        $seen = @{ $a.Name = $true }
        $frontier = @($a.Name)
        for ($d = 0; $d -lt 10; $d++) {
            $next = @()
            foreach ($f in $frontier) {
                if ($aliasesOf.ContainsKey($f)) {
                    foreach ($al in $aliasesOf[$f]) {
                        if (-not $seen.ContainsKey($al)) { $seen[$al] = $true; $next += $al }
                    }
                }
            }
            if ($next.Count -eq 0) { break }
            $levels += , $next
            $frontier = $next
        }
        $ordered = @()
        for ($k = $levels.Count - 1; $k -ge 0; $k--) { $ordered += $levels[$k] }
        if (-not $map.ContainsKey($a.Ip)) { $map[$a.Ip] = @() }
        foreach ($o in $ordered) {
            if ($map[$a.Ip] -notcontains $o) { $map[$a.Ip] = @($map[$a.Ip]) + $o }
        }
    }
    return $map
}

function Get-HostNames {
    <# Names for an address, outermost first. Empty array when not in the map. #>
    param($Map, [string]$Address)
    $ip = ConvertTo-NormalIp $Address
    if ($ip -and $Map.ContainsKey($ip)) { return $Map[$ip] }
    return @()
}

function Select-TreeConnections {
    <# Established connections owned by a PID in PidSet (hashtable), excluding loopback. #>
    param($Connections, $PidSet)
    $res = @()
    foreach ($c in $Connections) {
        if (-not $PidSet.ContainsKey([int]$c.OwningProcess)) { continue }
        if ($c.PSObject.Properties['State'] -and $c.State -and ("$($c.State)" -ne 'Established')) { continue }
        if (Test-IgnoredAddress $c.RemoteAddress) { continue }
        $res += $c
    }
    return $res
}

function Update-Observations {
    <#
      Adds one sample to State (hashtable key -> record). Key = group|ip|port.
      SampleCount counts samples, not connections. ProcessIndex: pid -> process
      (Name, CommandLine). ClaudeIds: hashtable of pids in the claude subtree.
    #>
    param($State, $Connections, $ProcessIndex, $ClaudeIds, [double]$Elapsed, [datetime]$Time, [int]$SampleIndex, $RoleMap = $null)
    foreach ($c in $Connections) {
        $ownerPid = [int]$c.OwningProcess
        $grp = 'editor'
        if ($ClaudeIds.ContainsKey($ownerPid)) { $grp = 'claude' }
        $ip = ConvertTo-NormalIp $c.RemoteAddress
        if (-not $ip) { continue }
        $port = [int]$c.RemotePort
        $key = "$grp|$ip|$port"
        $proc = $null
        if ($ProcessIndex.ContainsKey($ownerPid)) { $proc = $ProcessIndex[$ownerPid] }
        $pname = '(pid ' + $ownerPid + ')'
        $role = 'unknown'
        if ($proc) {
            $pname = $proc.Name
            $role = Get-ProcessRole -Name $proc.Name -CommandLine $proc.CommandLine
            if ($RoleMap -and $RoleMap.ContainsKey($ownerPid)) { $role = $RoleMap[$ownerPid] }
        }
        if (-not $State.ContainsKey($key)) {
            $State[$key] = [pscustomobject]@{
                Group = $grp; RemoteAddress = $ip; RemotePort = $port
                FirstSeen = $Time; FirstSeenElapsed = $Elapsed; LastSeen = $Time
                SampleCount = 0; LastSampleIndex = -1
                Processes = @{}; Roles = @{}; Pids = @{}
            }
        }
        $r = $State[$key]
        if ($r.LastSampleIndex -ne $SampleIndex) {
            $r.SampleCount++
            $r.LastSampleIndex = $SampleIndex
        }
        $r.LastSeen = $Time
        $r.Processes[$pname] = $true
        $r.Roles[$role] = $true
        $r.Pids[$ownerPid] = $true
    }
}

# ---- allowed-destination list ----------------------------------------------

function Test-AllowlistFormat {
    <# Returns an array of error strings (empty = valid). Input: parsed JSON object. #>
    param($List)
    $errs = @()
    if (-not $List) { return @('allowlist is empty or not JSON') }
    if (-not $List.PSObject.Properties['version'] -or $List.version -ne 1) { $errs += 'version must be 1' }
    if (-not $List.PSObject.Properties['allow']) { return @($errs + 'allow (array) is required') }
    $i = 0
    foreach ($e in @($List.allow)) {
        $tag = "allow[$i]"
        $i++
        if (-not $e.PSObject.Properties['host'] -or -not "$($e.host)".Trim()) { $errs += "$tag.host is required"; continue }
        $h = "$($e.host)".Trim()
        if ($h -eq '*' -or $h -eq '*.*') { $errs += "$tag.host must not match everything: $h" }
        if ($h.Contains('*') -and -not $h.StartsWith('*.')) { $errs += "$tag.host: '*' is allowed only as a leading '*.' : $h" }
        if ($h.Substring(1).Contains('*')) { $errs += "$tag.host: only one leading '*.' is allowed : $h" }
        if (-not $e.PSObject.Properties['reason'] -or -not "$($e.reason)".Trim()) { $errs += "$tag.reason is required" }
        if ($e.PSObject.Properties['ports']) {
            foreach ($p in @($e.ports)) {
                $n = 0
                if (-not [int]::TryParse("$p", [ref]$n) -or $n -lt 1 -or $n -gt 65535) { $errs += "$tag.ports has a bad port: $p" }
            }
        }
        if ($e.PSObject.Properties['processes']) {
            foreach ($p in @($e.processes)) {
                if (-not "$p".Trim()) { $errs += "$tag.processes has an empty name" }
            }
        }
    }
    return $errs
}

function Test-HostPattern {
    <# exact name (case-insensitive), or '*.example.com' = any subdomain (not the apex). IP literals match exactly. #>
    param([string]$Pattern, [string]$HostName)
    if (-not $Pattern -or -not $HostName) { return $false }
    $p = $Pattern.Trim().TrimEnd('.').ToLowerInvariant()
    $h = $HostName.Trim().TrimEnd('.').ToLowerInvariant()
    if ($p.StartsWith('*.')) {
        $suffix = $p.Substring(1)   # ".example.com"
        return ($h.Length -gt $suffix.Length -and $h.EndsWith($suffix))
    }
    $pn = ConvertTo-NormalIp $p
    $hn = ConvertTo-NormalIp $h
    if ($pn -and $hn) { return ($pn -eq $hn) }
    return ($p -eq $h)
}

function Test-DestinationAllowed {
    <#
      List: parsed allowlist (may be $null = nothing allowed).
      Names: host names of the destination plus its IP (any one may match).
      Port: remote port. ProcessNames: processes seen connecting.
      Entry with ports: port must be in it. Entry with processes: every process seen
      must be in it. Returns @{ Allowed; Reason }.
    #>
    param($List, [string[]]$Names, [int]$Port, [string[]]$ProcessNames)
    if (-not $List -or -not $List.PSObject.Properties['allow']) {
        return [pscustomobject]@{ Allowed = $false; Reason = '' }
    }
    foreach ($e in @($List.allow)) {
        $hostMatch = $false
        foreach ($n in $Names) {
            if (Test-HostPattern -Pattern "$($e.host)" -HostName $n) { $hostMatch = $true; break }
        }
        if (-not $hostMatch) { continue }
        if ($e.PSObject.Properties['ports'] -and @($e.ports).Count -gt 0) {
            $ok = $false
            foreach ($p in @($e.ports)) { if ([int]$p -eq $Port) { $ok = $true } }
            if (-not $ok) { continue }
        }
        if ($e.PSObject.Properties['processes'] -and @($e.processes).Count -gt 0) {
            $allIn = $true
            foreach ($pn in $ProcessNames) {
                $found = $false
                foreach ($ap in @($e.processes)) { if ("$ap" -ieq $pn) { $found = $true } }
                if (-not $found) { $allIn = $false }
            }
            if (-not $allIn) { continue }
        }
        return [pscustomobject]@{ Allowed = $true; Reason = "$($e.reason)" }
    }
    return [pscustomobject]@{ Allowed = $false; Reason = '' }
}

function New-DestinationRows {
    <#
      Turns observations into destination rows (one per group + host-or-ip + port),
      ties IPs to names with DnsMap, marks New against Previous (array of rows with
      Group and HostKey; $null = no previous list, then New is always false) and
      Allowed against the allowlist. Sorted by first seen.
    #>
    param($State, $DnsMap, $Previous, $List)
    $merged = @{}
    foreach ($r in @($State.Values | Sort-Object FirstSeenElapsed, RemoteAddress)) {
        $names = @(Get-HostNames -Map $DnsMap -Address $r.RemoteAddress)
        $hostKey = $r.RemoteAddress
        $resolved = $false
        if ($names.Count -gt 0) { $hostKey = $names[0]; $resolved = $true }
        $key = "$($r.Group)|$hostKey|$($r.RemotePort)"
        if (-not $merged.ContainsKey($key)) {
            $merged[$key] = [pscustomobject]@{
                Group = $r.Group; HostKey = $hostKey; Resolved = $resolved
                Names = @(); Addresses = @(); Port = $r.RemotePort
                FirstSeen = $r.FirstSeen; FirstSeenElapsed = $r.FirstSeenElapsed
                SampleCount = 0; Processes = @{}; Roles = @{}
            }
        }
        $m = $merged[$key]
        foreach ($n in $names) { if ($m.Names -notcontains $n) { $m.Names += $n } }
        if ($m.Addresses -notcontains $r.RemoteAddress) { $m.Addresses += $r.RemoteAddress }
        if ($r.FirstSeen -lt $m.FirstSeen) { $m.FirstSeen = $r.FirstSeen; $m.FirstSeenElapsed = $r.FirstSeenElapsed }
        $m.SampleCount += $r.SampleCount
        foreach ($k in $r.Processes.Keys) { $m.Processes[$k] = $true }
        foreach ($k in $r.Roles.Keys) { $m.Roles[$k] = $true }
    }
    $prevKeys = @{}
    if ($null -ne $Previous) {
        foreach ($p in $Previous) { $prevKeys["$($p.Group)|$($p.HostKey)"] = $true }
    }
    $rows = @()
    foreach ($m in $merged.Values) {
        $procNames = @($m.Processes.Keys | Sort-Object)
        $allNames = @($m.Names) + @($m.Addresses)
        $a = Test-DestinationAllowed -List $List -Names $allNames -Port $m.Port -ProcessNames $procNames
        $isNew = $false
        if ($null -ne $Previous) { $isNew = (-not $prevKeys.ContainsKey("$($m.Group)|$($m.HostKey)")) }
        $rows += [pscustomobject][ordered]@{
            Group            = $m.Group
            HostKey          = $m.HostKey
            Resolved         = $m.Resolved
            Names            = ($m.Names -join ' / ')
            Addresses        = ($m.Addresses -join ' ')
            Port             = $m.Port
            FirstSeen        = $m.FirstSeen.ToString('o')
            FirstSeenSeconds = [math]::Round($m.FirstSeenElapsed, 1)
            Processes        = ($procNames -join ' ')
            Roles            = (@($m.Roles.Keys | Sort-Object) -join ' ')
            SampleCount      = $m.SampleCount
            New              = $isNew
            Allowed          = $a.Allowed
            AllowReason      = $a.Reason
        }
    }
    return @($rows | Sort-Object FirstSeenSeconds, HostKey)
}

function Get-UnlistedDestinations {
    param($Rows)
    return @($Rows | Where-Object { -not $_.Allowed })
}

function Get-NewDestinations {
    param($Rows)
    return @($Rows | Where-Object { $_.New })
}

function Read-AllowlistFile {
    <# Returns @{ List; Errors; Missing }. A missing file = nothing allowed (first inventory). #>
    param([string]$Path)
    if (-not $Path -or -not (Test-Path -LiteralPath $Path)) {
        return [pscustomobject]@{ List = $null; Errors = @(); Missing = $true }
    }
    $obj = $null
    try { $obj = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json }
    catch { return [pscustomobject]@{ List = $null; Errors = @("not valid JSON: $_"); Missing = $false } }
    $errs = @(Test-AllowlistFormat $obj)
    return [pscustomobject]@{ List = $obj; Errors = $errs; Missing = $false }
}

function Read-PreviousDestinations {
    <# Previous run: a destinations.json file or a dir containing it. $null when not given. #>
    param([string]$Path)
    if (-not $Path) { return $null }
    $f = $Path
    if (Test-Path -LiteralPath $Path -PathType Container) { $f = Join-Path $Path 'destinations.json' }
    if (-not (Test-Path -LiteralPath $f)) { throw "previous list not found: $f" }
    $o = Get-Content -LiteralPath $f -Raw -Encoding UTF8 | ConvertFrom-Json
    # Leading comma on purpose: an empty previous list must stay an empty array
    # (not $null, which means "no previous list"). Assign the result directly; do not wrap in @().
    return ,@($o.Destinations)
}

function Format-DestTable {
    param($Rows)
    $lines = @('| host | port | first seen (s) | processes | samples | new | in allowlist |', '|---|---|---|---|---|---|---|')
    foreach ($r in $Rows) {
        $h = $r.HostKey
        if (-not $r.Resolved) { $h = "$($r.HostKey) (unresolved)" }
        elseif ($r.Names -ne $r.HostKey) { $h = $r.Names }
        $lines += "| $h | $($r.Port) | $($r.FirstSeenSeconds) | $($r.Processes) | $($r.SampleCount) | $(if ($r.New) { 'NEW' } else { '' }) | $(if ($r.Allowed) { 'yes' } else { 'NO' }) |"
    }
    if (@($Rows).Count -eq 0) { $lines += '| (none) | | | | | | |' }
    return $lines
}

function New-AuditMarkdown {
    param($Meta, $Rows, [bool]$HasPrevious, $AllowlistInfo)
    $editor = @($Rows | Where-Object { $_.Group -eq 'editor' })
    $claude = @($Rows | Where-Object { $_.Group -eq 'claude' })
    $unlisted = @(Get-UnlistedDestinations $Rows)
    $new = @(Get-NewDestinations $Rows)
    $md = @("# Network audit: $($Meta.Label)", '',
        "- editor: $($Meta.Exe)",
        "- duration: $($Meta.DurationSeconds) s, interval: $($Meta.IntervalSeconds) s, samples: $($Meta.Samples)",
        "- destinations: editor $($editor.Count), claude $($claude.Count)",
        "- not in allowlist: $($unlisted.Count)",
        "- new vs previous: $(if ($HasPrevious) { $new.Count } else { '(no previous list given)' })")
    if ($Meta.PSObject.Properties['DailyArgvTouched'] -and @($Meta.DailyArgvTouched).Count -gt 0) {
        $md += "- WARNING: the daily argv.json was created or changed during the run: $(@($Meta.DailyArgvTouched) -join ', ')"
    }
    if ($Meta.PSObject.Properties['DnsEntries'] -and [int]$Meta.DnsEntries -eq 0) {
        $md += '- WARNING: Get-DnsClientCache returned no entries in any snapshot, so every destination is shown as an IP address. Check the permissions / DNS Client service, or add pktmon.'
    }
    if ($AllowlistInfo.Missing) { $md += '- allowlist: file not found, so everything is reported as not allowed' }
    $md += '', '## Editor destinations (removal targets live here)', ''
    $md += Format-DestTable $editor
    $md += '', '## claude.exe destinations (separate table; not an editor removal target)', ''
    $md += Format-DestTable $claude
    $md += '', '## Not in the allowlist', ''
    if ($unlisted.Count -eq 0) { $md += '(none)' } else {
        foreach ($r in $unlisted) { $md += "- [$($r.Group)] $($r.HostKey):$($r.Port) via $($r.Processes), first seen $($r.FirstSeenSeconds) s" }
    }
    $md += '', '## New destinations (not in the previous list)', ''
    if (-not $HasPrevious) { $md += '(no previous list given; pass -Previous <dir or destinations.json>)' }
    elseif ($new.Count -eq 0) { $md += '(none)' }
    else { foreach ($r in $new) { $md += "- **NEW** [$($r.Group)] $($r.HostKey):$($r.Port) via $($r.Processes), first seen $($r.FirstSeenSeconds) s" } }
    $md += '', '## Limits', '',
        '- UDP and connections shorter than the interval are missed (docs/07 3.3). Use pktmon or Resource Monitor if needed.',
        '- Loopback destinations are left out. They stay in samples.csv only if they were seen (they are not collected).',
        '- Host names come from the DNS client cache; entries that expired between snapshots are lost. Unresolved addresses are shown as IPs.'
    return $md
}

# ---------------------------------------------------------------------------
# Machine-touching function
# ---------------------------------------------------------------------------

function Invoke-NetAudit {
    param($P)
    $ErrorActionPreference = 'Stop'
    if (-not $P.EnvDir -or -not (Test-Path -LiteralPath $P.EnvDir)) { throw "-EnvDir not found: $($P.EnvDir)" }
    if (-not $P.Exe) {
        $rec = Read-P0EnvRecord $P.EnvDir
        if ($rec -and $rec.editor -and $rec.editor.exe) { $P.Exe = "$($rec.editor.exe)" }
    }
    if (-not $P.Exe -or -not (Test-Path -LiteralPath $P.Exe)) { throw "-Exe not found (and no p0-env.json with editor.exe): $($P.Exe)" }
    if (-not $P.Label) { throw '-Label is required' }
    if (-not $P.Workspace) { $P.Workspace = Get-DefaultWorkspace }
    if (-not (Test-Path -LiteralPath $P.Workspace)) { throw "-Workspace not found: $($P.Workspace)" }
    if ($P.IntervalSeconds -lt 1) { throw '-IntervalSeconds must be 1 or more' }
    # -File passes "a,b" as one string: split it, and check that there are two existing files
    $ofiles = $P.OpenFiles
    if (-not $ofiles -or @($ofiles).Count -eq 0) { $ofiles = @(Get-DefaultOpenFiles) }
    $of = Resolve-OpenFiles -Files $ofiles -Workspace $P.Workspace
    foreach ($w in $of.Warnings) { Write-Warning $w }
    if ($of.Errors.Count -gt 0) { throw ("-OpenFiles: " + ($of.Errors -join '; ')) }
    $P.OpenFiles = $of.Files
    $procName = $P.ProcessName
    if (-not $procName) { $procName = [IO.Path]::GetFileName($P.Exe) }
    $repoRoot = Split-Path $PSScriptRoot -Parent
    $outDir = $P.OutDir
    if (-not $outDir) { $outDir = Join-Path $repoRoot ("records\network-audits\{0}-{1}" -f (Get-Date -Format 'yyyy-MM-dd'), $P.Label) }
    if ((Test-Path -LiteralPath (Join-Path $outDir 'destinations.json')) -and -not $P.Force) {
        throw "output already has destinations.json (use -Force to overwrite): $outDir"
    }
    $allowPath = $P.Allowlist
    if (-not $allowPath) { $allowPath = Join-Path $repoRoot 'records\network-allowlist.json' }
    $allow = Read-AllowlistFile $allowPath
    if ($allow.Errors.Count -gt 0) { throw ("allowlist is invalid:`n  " + ($allow.Errors -join "`n  ")) }
    $prev = Read-PreviousDestinations $P.Previous
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null

    $dailyBefore = @(Get-DailyArgvState)
    $data = New-RunDataDir -EnvDir $P.EnvDir -WorkRoot $P.WorkRoot -Name ("{0}-netaudit" -f $P.Label)
    $state = @{}
    $samples = New-Object System.Collections.ArrayList
    $dnsAll = @()
    $dnsRows = New-Object System.Collections.ArrayList
    $sampleIndex = 0
    $openIndex = 0
    $launched = $null
    $t0 = Get-Date
    try {
        # time zero = just before the editor is started (B-7); first-seen seconds are measured from here
        $t0 = Get-Date
        $launched = Start-Editor -Exe $P.Exe -User $data.User -Ext $data.Ext -Workspace $P.Workspace
        $nextDns = 0
        $nextTick = 0.0
        while ($true) {
            $elapsed = ((Get-Date) - $t0).TotalSeconds
            if ($elapsed -ge $P.DurationSeconds) { break }
            # one file at a time, 10 s apart (see Open-EditorFiles), without stopping the sampling
            if ($openIndex -lt @($P.OpenFiles).Count -and $elapsed -ge ($P.LaunchWaitSeconds + 10 * $openIndex)) {
                Open-EditorFiles -Exe $P.Exe -User $data.User -Ext $data.Ext -Files @(@($P.OpenFiles)[$openIndex]) -Workspace $P.Workspace -GapSeconds 0
                $openIndex++
            }
            $procs = @(Get-ProcessSnapshot)
            $main = @(Find-MainProcesses -Processes $procs -ExeName $procName -UserDir $data.User)
            $rootIds = @($main | ForEach-Object { [int]$_.ProcessId })
            if ($rootIds.Count -eq 0) { $rootIds = @([int]$launched.Id) }
            $tree = @(Get-Descendants -Processes $procs -RootIds $rootIds)
            $split = Split-ClaudeSubtree -Tree $tree
            $pidSet = @{}
            $index = @{}
            # NOTE: variable names are case-insensitive; do not reuse $p here ($P is the parameter).
            foreach ($tp in $tree) { $pidSet[[int]$tp.ProcessId] = $true; $index[[int]$tp.ProcessId] = $tp }
            $conns = @(Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue)
            $mine = @(Select-TreeConnections -Connections $conns -PidSet $pidSet)
            $now = Get-Date
            $obsElapsed = ($now - $t0).TotalSeconds   # when the connections were actually read
            $roleMap = Get-RoleMap -Tree $tree
            $sampleIndex++
            Update-Observations -State $state -Connections $mine -ProcessIndex $index -ClaudeIds $split.ClaudeIds -Elapsed $obsElapsed -Time $now -SampleIndex $sampleIndex -RoleMap $roleMap
            foreach ($c in $mine) {
                $o = [int]$c.OwningProcess
                $pr = $index[$o]
                $grp = 'editor'
                if ($split.ClaudeIds.ContainsKey($o)) { $grp = 'claude' }
                [void]$samples.Add([pscustomobject][ordered]@{
                    Time = $now.ToString('o'); Elapsed = [math]::Round($obsElapsed, 1); ProcessId = $o
                    ProcessName = $pr.Name; Role = $roleMap[$o]
                    Group = $grp; RemoteAddress = $c.RemoteAddress; RemotePort = $c.RemotePort
                })
            }
            if ($elapsed -ge $nextDns) {
                $dnsAll += @(Get-DnsClientCache -ErrorAction SilentlyContinue | Select-Object Entry, Name, Type, Data, TimeToLive)
                $nextDns = $elapsed + $P.DnsIntervalSeconds
            }
            $nextTick += $P.IntervalSeconds
            $sleep = $nextTick - ((Get-Date) - $t0).TotalSeconds
            if ($sleep -gt 0) { Start-Sleep -Milliseconds ([int]($sleep * 1000)) }
        }
        $dnsAll += @(Get-DnsClientCache -ErrorAction SilentlyContinue | Select-Object Entry, Name, Type, Data, TimeToLive)
    }
    finally {
        $procs2 = @(Get-ProcessSnapshot)
        $m2 = @(Find-MainProcesses -Processes $procs2 -ExeName $procName -UserDir $data.User)
        $ids2 = @($m2 | ForEach-Object { [int]$_.ProcessId })
        if ($ids2.Count -eq 0 -and $launched) { $ids2 = @([int]$launched.Id) }
        if ($ids2.Count -gt 0) { Stop-EditorTree -Tree (Get-Descendants -Processes $procs2 -RootIds $ids2) }
        Start-Sleep -Seconds 5
        if (-not $P.KeepData) {
            try { Remove-Item -LiteralPath $data.Root -Recurse -Force -ErrorAction Stop } catch { Write-Warning "could not remove $($data.Root): $_" }
        }
    }

    $dailyTouched = @(Compare-DailyArgvState -Before $dailyBefore -After @(Get-DailyArgvState))
    if ($dailyTouched.Count -gt 0) { Write-Warning ("daily argv.json was created or changed: " + ($dailyTouched -join ', ')) }
    $map = Get-DnsMap $dnsAll
    $rows = @(New-DestinationRows -State $state -DnsMap $map -Previous $prev -List $allow.List)
    $samples | Export-Csv -LiteralPath (Join-Path $outDir 'samples.csv') -NoTypeInformation -Encoding UTF8
    $rows | Export-Csv -LiteralPath (Join-Path $outDir 'destinations.csv') -NoTypeInformation -Encoding UTF8
    $dnsAll | Export-Csv -LiteralPath (Join-Path $outDir 'dns-cache.csv') -NoTypeInformation -Encoding UTF8
    $ver = $null
    try { $ver = (Get-Item -LiteralPath $P.Exe).VersionInfo.ProductVersion } catch { }
    $meta = [ordered]@{
        Label = $P.Label; Exe = $P.Exe; ExeVersion = $ver; EnvDir = $P.EnvDir
        DurationSeconds = $P.DurationSeconds; IntervalSeconds = $P.IntervalSeconds
        Samples = $sampleIndex; StartedAt = $t0.ToString('o'); DnsEntries = @($dnsAll).Count; DailyArgvTouched = $dailyTouched
        Allowlist = $allowPath; AllowlistMissing = $allow.Missing; Previous = $P.Previous
    }
    ([ordered]@{ Meta = $meta; Destinations = $rows }) | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $outDir 'destinations.json') -Encoding UTF8
    $md = New-AuditMarkdown -Meta ([pscustomobject]$meta) -Rows $rows -HasPrevious ($null -ne $prev) -AllowlistInfo $allow
    Set-Content -LiteralPath (Join-Path $outDir 'audit.md') -Value $md -Encoding UTF8
    Write-Host ($md -join "`n")
    return $outDir
}

if ($naIsLibrary) { return }

Invoke-NetAudit -P $na | Out-Null
