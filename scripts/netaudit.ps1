<#
.SYNOPSIS
  Outbound connection audit (docs/07 section 3.3). Fixed in Phase 0, used from then on.

.DESCRIPTION
  Starts the editor on a fresh data dir (copied from an env template, same as
  measure.ps1), then for -DurationSeconds (default 600) every -IntervalSeconds
  (default 2) takes Get-NetTCPConnection -State Established, keeps only the
  connections of the editor process tree, and ties remote IPs to host names with
  (1) the Chromium net log (the editor is started with --log-net-log=<file>; the
  file goes to <WorkRoot parent>\netlog, outside the repo, because it can hold secrets;
  only host names and counts are copied into the output), (2) Get-DnsClientCache
  (at the start, at the end, and every -DnsIntervalSeconds; often empty, see
  hostname-design.md), (3) weak hints only (reverse lookup, forward lookup of the
  allowlist hosts) that never make a destination "allowed" (-NoHints skips them).
  Output: samples.csv, destinations.csv/json (with NameMethod), named-hosts.csv,
  dns-cache.csv, audit.md. -NoNetLog starts the editor without the log.

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
    [string]$NetLogDir,        # default <WorkRoot parent>\netlog (C:\b\p0\netlog)
    [switch]$NoNetLog,
    [switch]$NoNodeDebug,      # do not set NODE_DEBUG=net / ELECTRON_ENABLE_LOGGING=1 (host names of Node code)
    [switch]$NoHints,          # skip the weak name hints (reverse lookup, forward lookup of allowlist hosts)
    [switch]$KeepData,
    [switch]$CleanStale,
    [string]$StaleFilter = '*',
    [switch]$Force
)

# Keep our parameters: dot-sourcing measure.ps1 would overwrite same-named variables.
$na = @{
    Exe = $Exe; EnvDir = $EnvDir; Workspace = $Workspace; OpenFiles = $OpenFiles; Label = $Label
    DurationSeconds = $DurationSeconds; IntervalSeconds = $IntervalSeconds; DnsIntervalSeconds = $DnsIntervalSeconds
    LaunchWaitSeconds = $LaunchWaitSeconds; OutDir = $OutDir; Allowlist = $Allowlist; Previous = $Previous
    NetLogDir = $NetLogDir; NoNetLog = [bool]$NoNetLog; NoNodeDebug = [bool]$NoNodeDebug; NoHints = [bool]$NoHints
    WorkRoot = $WorkRoot; ProcessName = $ProcessName; KeepData = [bool]$KeepData; Force = [bool]$Force
    CleanStale = [bool]$CleanStale; StaleFilter = $StaleFilter
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

# ---- host names from the Chromium net log (--log-net-log) ---------------------
# Why: Chromium resolves names itself (built-in resolver / DoH) and never asks the Windows DNS client,
# so Get-DnsClientCache has no entry for it. The net log has the names (see hostname-design.md).
# Only host names and counts are kept from the log; URL paths, queries, headers and user info are dropped.

function ConvertTo-NetLogHostName {
    <# 'https://Host.Example.com:443/x?y' / 'host:80' / 'host' -> 'host.example.com'. $null for IP literals and empty input. #>
    param([string]$Text)
    if (-not $Text) { return $null }
    $t = $Text.Trim()
    $t = [regex]::Replace($t, '^[A-Za-z][A-Za-z0-9+.-]*://', '')
    $i = $t.IndexOfAny([char[]]@('/', '?', '#'))
    if ($i -ge 0) { $t = $t.Substring(0, $i) }
    $at = $t.LastIndexOf('@')
    if ($at -ge 0) { $t = $t.Substring($at + 1) }
    if ($t.StartsWith('[')) { return $null }
    $t = [regex]::Replace($t, ':\d+$', '').TrimEnd('.').ToLowerInvariant()
    if (-not $t) { return $null }
    if (ConvertTo-NormalIp $t) { return $null }
    return $t
}

function Get-NetLogUrlParts {
    <# http/https/ws/wss URL -> @{ Host; Port }, else $null. Nothing but the host and the port is kept. #>
    param([string]$Url)
    $m = [regex]::Match("$Url", '^(?<s>[A-Za-z][A-Za-z0-9+.-]*)://(?:[^/@?#]*@)?(?<h>\[[^\]]+\]|[^/:?#]+)(?::(?<p>\d+))?')
    if (-not $m.Success) { return $null }
    $s = $m.Groups['s'].Value.ToLowerInvariant()
    $port = 0
    switch ($s) {
        'https' { $port = 443 }
        'wss' { $port = 443 }
        'http' { $port = 80 }
        'ws' { $port = 80 }
        default { return $null }
    }
    if ($m.Groups['p'].Success) { $port = [int]$m.Groups['p'].Value }
    $h = ConvertTo-NetLogHostName $m.Groups['h'].Value
    if (-not $h) { return $null }
    return [pscustomobject]@{ Host = $h; Port = $port }
}

function Get-NetLogInfo {
    <#
      Lines: the lines of a net log file (one JSON event per line; a truncated file is fine).
      Returns:
        Map      IP -> string[] host names, for addresses a socket was opened to: the host the socket was opened
                 for first, then its aliases, canonical name last (connect job + resolver answer of the same source)
        AnswerMap  IP -> string[] for every address in a resolver answer (shared CDN addresses get many hosts: hint only)
        Hosts    host -> @{ Requests; Resolutions; Answered; Port }  (Requests = URL requests started,
                 Resolutions = resolver requests; Answered = got addresses)
        Events   number of lines read, Complete = the file ended properly
    #>
    param($Lines)
    $sources = @{}
    $hosts = @{}
    $count = 0
    $last = ''
    function Add-HostEntry { param($Table, [string]$Name, [int]$Port)
        if (-not $Table.ContainsKey($Name)) { $Table[$Name] = [pscustomobject]@{ Requests = 0; Resolutions = 0; Answered = $false; Port = $Port } }
        return $Table[$Name]
    }
    foreach ($line in $Lines) {
        if (-not $line) { continue }
        $count++
        $last = $line
        $hasAnswer = $line.Contains('"ip_endpoints":[')
        $hasResolve = ($line.Contains('"dns_query_type":"') -and $line.Contains('"host":"'))
        $hasUrl = ($line.Contains('"url":"') -and $line.Contains('"load_flags":') -and $line.Contains('"method":"'))
        # the connect job of one socket: {"address":"1.2.3.4:443","source_dependency":{...}} in the source that asked for the host
        $hasConnect = ($line.Contains('"address":"') -and $line.Contains('"source_dependency":'))
        if (-not ($hasAnswer -or $hasResolve -or $hasUrl -or $hasConnect)) { continue }
        $o = $null
        try { $o = $line.Trim().TrimEnd(',') | ConvertFrom-Json } catch { continue }
        if (-not $o -or -not $o.params) { continue }
        $sid = -1
        if ($o.source -and $null -ne $o.source.id) { $sid = [int]$o.source.id }
        if ($hasResolve -and $o.params.host) {
            $raw = "$($o.params.host)"
            $h = ConvertTo-NetLogHostName $raw
            if ($h) {
                $port = 443
                $pm = [regex]::Match($raw, ':(\d+)$')
                if ($pm.Success) { $port = [int]$pm.Groups[1].Value }
                elseif ($raw -match '^http://') { $port = 80 }
                $e = Add-HostEntry $hosts $h $port
                $e.Resolutions++
                if (-not $sources.ContainsKey($sid)) { $sources[$sid] = [pscustomobject]@{ Host = $null; Aliases = @(); Canon = @(); Ips = @(); Connected = @() } }
                $sources[$sid].Host = $h
            }
        }
        if ($hasUrl -and $o.params.url) {
            $u = Get-NetLogUrlParts "$($o.params.url)"
            if ($u) { $e = Add-HostEntry $hosts $u.Host $u.Port; $e.Requests++ }
        }
        if ($hasConnect -and $o.params.address) {
            $am = [regex]::Match("$($o.params.address)", '^\[?(?<ip>[^\]]+?)\]?:(?<port>\d+)$')
            if ($am.Success) {
                $cip = ConvertTo-NormalIp $am.Groups['ip'].Value
                if ($cip) {
                    if (-not $sources.ContainsKey($sid)) { $sources[$sid] = [pscustomobject]@{ Host = $null; Aliases = @(); Canon = @(); Ips = @(); Connected = @() } }
                    if ($sources[$sid].Connected -notcontains $cip) { $sources[$sid].Connected += $cip }
                }
            }
        }
        if ($hasAnswer -and $o.params.results) {
            $res = $o.params.results
            if (-not $sources.ContainsKey($sid)) { $sources[$sid] = [pscustomobject]@{ Host = $null; Aliases = @(); Canon = @(); Ips = @(); Connected = @() } }
            $s = $sources[$sid]
            foreach ($a in @($res.aliases)) { $n = ConvertTo-NetLogHostName "$a"; if ($n -and $s.Aliases -notcontains $n) { $s.Aliases += $n } }
            foreach ($a in @($res.canonical_names)) { $n = ConvertTo-NetLogHostName "$a"; if ($n -and $s.Canon -notcontains $n) { $s.Canon += $n } }
            foreach ($ep in @($res.ip_endpoints)) {
                $ip = ConvertTo-NormalIp "$($ep.endpoint_address)"
                if ($ip -and $s.Ips -notcontains $ip) { $s.Ips += $ip }
            }
        }
    }
    # Map = addresses a socket was really opened to, named after the host it was opened for.
    # AnswerMap = every address a resolver answer contained. Many hosts share one CDN address, so
    # AnswerMap is ambiguous and only a hint; Map is the fact "a connection to this address was opened for this host".
    $map = @{}
    $answerMap = @{}
    foreach ($s in $sources.Values) {
        $names = @()
        if ($s.Host) { $names += $s.Host }
        foreach ($a in @($s.Aliases | Sort-Object)) { if ($names -notcontains $a -and $s.Canon -notcontains $a) { $names += $a } }
        foreach ($c in $s.Canon) { if ($names -notcontains $c) { $names += $c } }
        if ($s.Ips.Count -gt 0 -and $s.Host -and $hosts.ContainsKey($s.Host)) { $hosts[$s.Host].Answered = $true }
        foreach ($ip in $s.Ips) {
            if (-not $answerMap.ContainsKey($ip)) { $answerMap[$ip] = @() }
            foreach ($n in $names) { if ($answerMap[$ip] -notcontains $n) { $answerMap[$ip] = @($answerMap[$ip]) + $n } }
        }
        if ($s.Host) {
            foreach ($ip in $s.Connected) {
                if (-not $map.ContainsKey($ip)) { $map[$ip] = @() }
                foreach ($n in $names) { if ($map[$ip] -notcontains $n) { $map[$ip] = @($map[$ip]) + $n } }
            }
        }
    }
    return [pscustomobject]@{ Map = $map; AnswerMap = $answerMap; Hosts = $hosts; Events = $count; Complete = ($last.Trim() -eq '}') }
}

function Read-NetLogFile {
    <# Reads a net log written by --log-net-log. Returns the Get-NetLogInfo result plus Path; $null when the file is missing or empty. #>
    param([string]$Path)
    if (-not $Path -or -not (Test-Path -LiteralPath $Path)) { return $null }
    $fs = New-Object System.IO.FileStream($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
    $sr = New-Object System.IO.StreamReader($fs, [Text.Encoding]::UTF8)
    try {
        $lines = New-Object System.Collections.Generic.List[string]
        while ($null -ne ($ln = $sr.ReadLine())) { $lines.Add($ln) }
    }
    finally { $sr.Dispose() }
    if ($lines.Count -eq 0) { return $null }
    $info = Get-NetLogInfo $lines
    if ($info.Events -eq 0) { return $null }
    $info | Add-Member -NotePropertyName Path -NotePropertyValue $Path -Force
    return $info
}

# ---- host names of Node code from NODE_DEBUG=net -----------------------------
# Node (extension host, agent host) looks names up through Windows, not through Chromium. With NODE_DEBUG=net it
# prints "NET <pid>: connect: find host <name>" and "NET <pid>: connect: attempting to connect to <ip>:<port>"
# to stderr (ELECTRON_ENABLE_LOGGING=1 makes the extension host's console reach stderr too).

function Get-NodeDebugInfo {
    <#
      Lines: text captured from the editor's stderr/stdout. The same event often appears 2-3 times (console echo), so
      first appearances per pid are used. Returns:
        Hosts   host -> @{ Lookups (distinct pids); Pids; Port }   (a host that Node code asked for: a fact)
        Map     IP -> string[] hosts: pairs host and address in order of appearance within one pid when both lists
                have the same length; otherwise every host of that pid is a candidate. A hint (order is not guaranteed).
    #>
    param($Lines)
    $pidHosts = @{}   # pid -> ordered distinct hosts
    $pidIps = @{}     # pid -> ordered distinct ips
    $ports = @{}      # ip -> port
    $reHost = [regex]'NET (?<pid>\d+): connect: find host (?<h>[A-Za-z0-9._-]+)'
    $reAddr = [regex]'NET (?<pid>\d+): connect: attempting to connect to (?<a>\S+?):(?<port>\d+) '
    foreach ($line in $Lines) {
        if (-not $line -or -not $line.Contains('connect: ')) { continue }
        $m = $reHost.Match($line)
        if ($m.Success) {
            $id = [int]$m.Groups['pid'].Value
            $h = ConvertTo-NetLogHostName $m.Groups['h'].Value
            if ($h) {
                if (-not $pidHosts.ContainsKey($id)) { $pidHosts[$id] = @() }
                if ($pidHosts[$id] -notcontains $h) { $pidHosts[$id] = @($pidHosts[$id]) + $h }
            }
            continue
        }
        $m = $reAddr.Match($line)
        if ($m.Success) {
            $id = [int]$m.Groups['pid'].Value
            $ip = ConvertTo-NormalIp ($m.Groups['a'].Value.Trim('[', ']'))
            if ($ip) {
                if (-not $pidIps.ContainsKey($id)) { $pidIps[$id] = @() }
                if ($pidIps[$id] -notcontains $ip) { $pidIps[$id] = @($pidIps[$id]) + $ip }
                $ports[$ip] = [int]$m.Groups['port'].Value
            }
        }
    }
    $hosts = @{}
    foreach ($id in $pidHosts.Keys) {
        foreach ($h in $pidHosts[$id]) {
            if (-not $hosts.ContainsKey($h)) { $hosts[$h] = [pscustomobject]@{ Lookups = 0; Pids = @(); Port = 443 } }
            $hosts[$h].Lookups++
            $hosts[$h].Pids += $id
        }
    }
    $map = @{}
    foreach ($id in $pidIps.Keys) {
        $hs = @()
        if ($pidHosts.ContainsKey($id)) { $hs = @($pidHosts[$id]) }
        $ips = @($pidIps[$id])
        for ($i = 0; $i -lt $ips.Count; $i++) {
            $cand = $hs
            if ($hs.Count -eq $ips.Count) { $cand = @($hs[$i]) }
            if ($cand.Count -eq 0) { continue }
            if (-not $map.ContainsKey($ips[$i])) { $map[$ips[$i]] = @() }
            foreach ($c in $cand) { if ($map[$ips[$i]] -notcontains $c) { $map[$ips[$i]] = @($map[$ips[$i]]) + $c } }
            if ($hs.Count -eq $ips.Count -and $hosts.ContainsKey($hs[$i])) { $hosts[$hs[$i]].Port = $ports[$ips[$i]] }
        }
    }
    return [pscustomobject]@{ Hosts = $hosts; Map = $map }
}

function Read-NodeDebugFiles {
    <# Reads the captured stderr/stdout files (shared read: the editor may still hold them). $null when none has content. #>
    param([string[]]$Paths)
    $lines = New-Object System.Collections.Generic.List[string]
    foreach ($pth in @($Paths)) {
        if (-not $pth -or -not (Test-Path -LiteralPath $pth)) { continue }
        $fs = New-Object System.IO.FileStream($pth, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
        $sr = New-Object System.IO.StreamReader($fs, [Text.Encoding]::UTF8)
        try { while ($null -ne ($ln = $sr.ReadLine())) { if ($ln.Contains('connect: ')) { $lines.Add($ln) } } }
        finally { $sr.Dispose() }
    }
    if ($lines.Count -eq 0) { return $null }
    return (Get-NodeDebugInfo $lines)
}

function New-NamedHostRows {
    <#
      One row per host that was seen by name: in the net log (browser-side requests, including ones too short for the
      2 s sampling) and/or in Node lookups (NODE_DEBUG=net). Each host is checked against the allowlist by itself, so a
      shared CDN address cannot hide one. SeenInSampling = the host is among the names of a destination row.
    #>
    param($Hosts, $NodeHosts, $Rows, $List, [string]$ProcessName)
    $seen = @{}
    foreach ($r in @($Rows)) { foreach ($n in @("$($r.Names)" -split ' / ')) { if ($n) { $seen[$n] = $true } } }
    $all = @{}
    if ($Hosts) { foreach ($k in $Hosts.Keys) { $all[$k] = $true } }
    if ($NodeHosts) { foreach ($k in $NodeHosts.Keys) { $all[$k] = $true } }
    $out = @()
    foreach ($k in $all.Keys) {
        $e = $null; $nd = $null
        if ($Hosts -and $Hosts.ContainsKey($k)) { $e = $Hosts[$k] }
        if ($NodeHosts -and $NodeHosts.ContainsKey($k)) { $nd = $NodeHosts[$k] }
        $port = 443
        if ($e) { $port = $e.Port } elseif ($nd) { $port = $nd.Port }
        $by = @()
        if ($e) { $by += 'netlog' }
        if ($nd) { $by += 'node' }
        $a = Test-DestinationAllowed -List $List -Names @($k) -Port $port -ProcessNames @($ProcessName)
        $out += [pscustomobject][ordered]@{
            Host = $k; Port = $port; SeenBy = ($by -join '+')
            Requests = $(if ($e) { $e.Requests } else { 0 })
            Resolutions = $(if ($e) { $e.Resolutions } else { 0 })
            Answered = $(if ($e) { $e.Answered } else { $false })
            NodeLookups = $(if ($nd) { $nd.Lookups } else { 0 })
            SeenInSampling = $seen.ContainsKey($k); Allowed = $a.Allowed; AllowReason = $a.Reason
        }
    }
    return @($out | Sort-Object @{ Expression = 'Requests'; Descending = $true }, @{ Expression = 'Resolutions'; Descending = $true }, @{ Expression = 'NodeLookups'; Descending = $true }, Host)
}

function Get-ReverseNameMap {
    <#
      Weak hint: PTR lookup of addresses nobody named. Resolver = scriptblock { param($ip) -> string[] } (injectable for tests).
      CDN addresses often have no or unrelated PTR names, and a PTR name is chosen by the address owner, so it never decides "allowed".
    #>
    param([string[]]$Ips, [scriptblock]$Resolver = $null, [int]$Max = 40)
    if (-not $Resolver) {
        $Resolver = {
            param($ip)
            $r = Resolve-DnsName -Name $ip -Type PTR -QuickTimeout -DnsOnly -ErrorAction SilentlyContinue
            @($r | Where-Object { $_.Type -eq 'PTR' } | ForEach-Object { "$($_.NameHost)" })
        }
    }
    $map = @{}
    $n = 0
    foreach ($ip in @($Ips)) {
        if ($n -ge $Max) { break }
        $n++
        $names = @()
        try { $names = @(& $Resolver $ip) } catch { }
        $clean = @()
        foreach ($nm in $names) { $c = ConvertTo-NetLogHostName "$nm"; if ($c -and $clean -notcontains $c) { $clean += $c } }
        if ($clean.Count -gt 0) { $map[(ConvertTo-NormalIp $ip)] = $clean }
    }
    return $map
}

function Get-ForwardNameMap {
    <#
      Weak hint: resolves the exact (non-wildcard) hosts of the allowlist now and ties the addresses to them.
      Used for destinations of processes that do their own lookups (claude.exe, Node) when nothing else named them.
      A shared CDN address can belong to several hosts, so this is a hint only and never decides "allowed".
      Resolver = scriptblock { param($name) -> string[] of IPs } (injectable for tests).
    #>
    param($List, [scriptblock]$Resolver = $null)
    if (-not $Resolver) {
        $Resolver = {
            param($name)
            $ips = @()
            try { $ips = @([System.Net.Dns]::GetHostAddresses($name) | ForEach-Object { $_.ToString() }) } catch { }
            $ips
        }
    }
    $map = @{}
    if (-not $List -or -not $List.PSObject.Properties['allow']) { return $map }
    foreach ($e in @($List.allow)) {
        $h = "$($e.host)".Trim().ToLowerInvariant()
        if (-not $h -or $h.Contains('*') -or (ConvertTo-NormalIp $h)) { continue }
        $ips = @()
        try { $ips = @(& $Resolver $h) } catch { }
        foreach ($ip in $ips) {
            $n = ConvertTo-NormalIp "$ip"
            if (-not $n) { continue }
            if (-not $map.ContainsKey($n)) { $map[$n] = @() }
            if ($map[$n] -notcontains $h) { $map[$n] = @($map[$n]) + $h }
        }
    }
    return $map
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
    param($State, $DnsMap, $Previous, $List, $ExtraMaps = @())
    # Name sources, in this order of trust: ExtraMaps without Weak (e.g. 'netlog'), then the DNS cache,
    # then ExtraMaps with Weak (reverse lookup, forward lookup of allowlist hosts). Weak names are only a
    # hint (WeakNames): they never become the host key and never make a destination "allowed".
    $strongMaps = @()
    foreach ($em in @($ExtraMaps)) { if (-not $em.Weak) { $strongMaps += $em } }
    $strongMaps += [pscustomobject]@{ Method = 'dns-cache'; Map = $DnsMap; Weak = $false }
    $weakMaps = @()
    foreach ($em in @($ExtraMaps)) { if ($em.Weak) { $weakMaps += $em } }
    $merged = @{}
    foreach ($r in @($State.Values | Sort-Object FirstSeenElapsed, RemoteAddress)) {
        $names = @()
        $methods = @()
        $weak = @()
        foreach ($sm in $strongMaps) {
            $got = @(Get-HostNames -Map $sm.Map -Address $r.RemoteAddress)
            # A map with OnlyRoles (the net log: it only knows what the Chromium network service connected to) names a
            # row only when every process role on the row is one of those. If Node code (extension host ...) also
            # connected to the same address, the name may belong to another host, so it stays a hint.
            if ($got.Count -gt 0 -and $sm.PSObject.Properties['OnlyRoles'] -and $sm.OnlyRoles) {
                $foreign = @($r.Roles.Keys | Where-Object { @($sm.OnlyRoles) -notcontains $_ })
                if ($foreign.Count -gt 0) {
                    foreach ($g in $got) { $tag = "$g [$($sm.Method), shared with other process]"; if ($weak -notcontains $tag) { $weak += $tag } }
                    continue
                }
            }
            if ($got.Count -gt 0) { $methods += $sm.Method }
            foreach ($g in $got) { if ($names -notcontains $g) { $names += $g } }
        }
        if ($names.Count -eq 0) {
            foreach ($wm in $weakMaps) {
                foreach ($g in @(Get-HostNames -Map $wm.Map -Address $r.RemoteAddress)) {
                    $tag = "$g [$($wm.Method)]"
                    if ($weak -notcontains $tag) { $weak += $tag }
                }
            }
        }
        $hostKey = $r.RemoteAddress
        $resolved = $false
        if ($names.Count -gt 0) { $hostKey = $names[0]; $resolved = $true }
        $key = "$($r.Group)|$hostKey|$($r.RemotePort)"
        if (-not $merged.ContainsKey($key)) {
            $merged[$key] = [pscustomobject]@{
                Group = $r.Group; HostKey = $hostKey; Resolved = $resolved
                Names = @(); Addresses = @(); Port = $r.RemotePort
                Methods = @(); WeakNames = @()
                FirstSeen = $r.FirstSeen; FirstSeenElapsed = $r.FirstSeenElapsed
                SampleCount = 0; Processes = @{}; Roles = @{}
            }
        }
        $m = $merged[$key]
        foreach ($mt in $methods) { if ($m.Methods -notcontains $mt) { $m.Methods += $mt } }
        foreach ($wn in $weak) { if ($m.WeakNames -notcontains $wn) { $m.WeakNames += $wn } }
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
            NameMethod       = $(if ($m.Methods.Count -gt 0) { $m.Methods -join '+' } else { 'none' })
            WeakNames        = ($m.WeakNames -join ' / ')
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
    $lines = @('| host | name from | port | first seen (s) | processes | samples | new | in allowlist |', '|---|---|---|---|---|---|---|---|')
    foreach ($r in $Rows) {
        $h = $r.HostKey
        $from = ''
        if ($r.PSObject.Properties['NameMethod']) { $from = $r.NameMethod }
        if (-not $r.Resolved) {
            $h = "$($r.HostKey) (unresolved)"
            if ($r.PSObject.Properties['WeakNames'] -and $r.WeakNames) { $h += " - hint only: $($r.WeakNames)" }
        }
        elseif ($r.Names -ne $r.HostKey) { $h = $r.Names }
        $lines += "| $h | $from | $($r.Port) | $($r.FirstSeenSeconds) | $($r.Processes) | $($r.SampleCount) | $(if ($r.New) { 'NEW' } else { '' }) | $(if ($r.Allowed) { 'yes' } else { 'NO' }) |"
    }
    if (@($Rows).Count -eq 0) { $lines += '| (none) | | | | | | | |' }
    return $lines
}

function New-AuditMarkdown {
    param($Meta, $Rows, [bool]$HasPrevious, $AllowlistInfo, $NetLogHostRows = $null)
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
    $netLogUsed = ($Meta.PSObject.Properties['NetLogEvents'] -and [int]$Meta.NetLogEvents -gt 0)
    if ($netLogUsed) {
        $md += "- net log: $($Meta.NetLogEvents) events, $(if ($Meta.NetLogComplete) { 'complete' } else { 'INCOMPLETE (the editor was stopped before Chromium closed the file)' }); host names come from it first, then the DNS client cache"
    }
    elseif ($Meta.PSObject.Properties['NetLogPath'] -and $Meta.NetLogPath) {
        $md += '- WARNING: the net log is missing or empty, so names come only from the DNS client cache.'
    }
    if ($Meta.PSObject.Properties['DnsEntries'] -and [int]$Meta.DnsEntries -eq 0) {
        if ($netLogUsed) {
            $md += '- note: Get-DnsClientCache returned no entries (Chromium does its own lookups; on this PC the cache stays empty even for lookups made by PowerShell). Names for the Chromium side come from the net log.'
        }
        else {
            $md += '- WARNING: Get-DnsClientCache returned no entries in any snapshot, so every destination is shown as an IP address. Check the permissions / DNS Client service, or add pktmon.'
        }
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
    if ($null -ne $NetLogHostRows) {
        $nlUnlisted = @($NetLogHostRows | Where-Object { -not $_.Allowed -and ($_.Requests -gt 0 -or $_.Answered -or $_.NodeLookups -gt 0) })
        $md += '', '(Hosts seen by name that are not in the allowlist. Checked one host at a time, so a shared CDN address cannot hide one.)', ''
        if ($nlUnlisted.Count -eq 0) { $md += '(none)' }
        else { foreach ($h in $nlUnlisted) { $md += "- [by name: $($h.SeenBy)] $($h.Host):$($h.Port), $($h.Requests) url requests, $($h.Resolutions) resolutions, $($h.NodeLookups) node lookups" } }
    }
    $md += '', '## New destinations (not in the previous list)', ''
    if (-not $HasPrevious) { $md += '(no previous list given; pass -Previous <dir or destinations.json>)' }
    elseif ($new.Count -eq 0) { $md += '(none)' }
    else { foreach ($r in $new) { $md += "- **NEW** [$($r.Group)] $($r.HostKey):$($r.Port) via $($r.Processes), first seen $($r.FirstSeenSeconds) s" } }
    if ($null -ne $NetLogHostRows) {
        $md += '', '## Hosts seen by name (net log = browser side, node = lookups by Node code; includes ones too short for the sampling)', ''
        $md += '| host | port | seen by | url requests | resolutions | answered | node lookups | seen in sampling | in allowlist |', '|---|---|---|---|---|---|---|---|---|'
        foreach ($h in @($NetLogHostRows)) {
            $md += "| $($h.Host) | $($h.Port) | $($h.SeenBy) | $($h.Requests) | $($h.Resolutions) | $(if ($h.Answered) { 'yes' } else { 'no' }) | $($h.NodeLookups) | $(if ($h.SeenInSampling) { 'yes' } else { 'no' }) | $(if ($h.Allowed) { 'yes' } else { 'NO' }) |"
        }
        if (@($NetLogHostRows).Count -eq 0) { $md += '| (none) | | | | | | | | |' }
    }
    $md += '', '## Limits', '',
        '- UDP and connections shorter than the interval are missed (docs/07 3.3). Use pktmon or Resource Monitor if needed.',
        '- Loopback destinations are left out. They stay in samples.csv only if they were seen (they are not collected).',
        '- Column "name from": netlog = the Chromium net log of the editor (names the host a Chromium socket was opened for; used only for rows whose processes are all the network service or main, otherwise it is shown as a hint), dns-cache = Get-DnsClientCache, none = unresolved. A "hint only" name (reverse or forward lookup) never makes a destination allowed.',
        '- The net log covers only the Chromium network service of the editor (requests from the windows and the main process). Node code (extension host, agent host) looks names up through Windows; its host names come from NODE_DEBUG=net ("node") - the host list is exact, the pairing of a host with an address is a hint (order of appearance within one pid).',
        '- claude.exe is not Node-instrumented here: its addresses are named only by a forward lookup of the allowlist hosts (a hint). A net-log name is a hint too (its rows have the claude-cli role, not the network service or main) and never makes a destination allowed.',
        '- Not covered without administrator rights: lookups by processes that print nothing (DNS client event log, pktmon, TLS SNI). See hostname-design.md.'
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

    $stale = @(Clear-StaleRunDirs -WorkRoot $P.WorkRoot -Filter $P.StaleFilter -Delete ([bool]$P.CleanStale))
    if ($stale.Count -gt 0 -and -not $P.CleanStale) {
        Write-Warning ("{0} stale run dir(s) under {1} (use -CleanStale to remove): {2}" -f $stale.Count, $P.WorkRoot, ($stale -join ', '))
    }
    # Chromium net log (host names of the browser-side network stack). Kept outside the repo: it can hold secrets.
    $netLogPath = $null
    $nodeOut = $null
    $nodeErr = $null
    $nlDir = $P.NetLogDir
    if (-not $nlDir) { $nlDir = Join-Path (Split-Path $P.WorkRoot -Parent) 'netlog' }
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    if (-not $P.NoNetLog -or -not $P.NoNodeDebug) { New-Item -ItemType Directory -Force -Path $nlDir | Out-Null }
    if (-not $P.NoNetLog) { $netLogPath = Join-Path $nlDir ("{0}-{1}.netlog.json" -f $P.Label, $stamp) }
    if (-not $P.NoNodeDebug) {
        # NODE_DEBUG=net output (host names of Node code). Same place and same care as the net log: outside the repo.
        $nodeOut = Join-Path $nlDir ("{0}-{1}.node-stdout.txt" -f $P.Label, $stamp)
        $nodeErr = Join-Path $nlDir ("{0}-{1}.node-stderr.txt" -f $P.Label, $stamp)
    }
    $dailyBefore = @(Get-DailyArgvState)
    $data = New-RunDataDir -EnvDir $P.EnvDir -WorkRoot $P.WorkRoot -Name ("{0}-netaudit" -f $P.Label)
    $state = @{}
    $samples = New-Object System.Collections.ArrayList
    $dnsAll = @()
    $dnsRows = New-Object System.Collections.ArrayList
    $sampleIndex = 0
    $openIndex = 0
    $leftovers = @()
    $launched = $null
    $t0 = Get-Date
    try {
        # time zero = just before the editor is started (B-7); first-seen seconds are measured from here
        $t0 = Get-Date
        $launchArgs = Get-EditorArguments -User $data.User -Ext $data.Ext -Workspace $P.Workspace
        if ($netLogPath) { $launchArgs = $launchArgs + ' --log-net-log="' + $netLogPath + '"' }
        if ($nodeOut) {
            $launched = Start-EditorProcess -Exe $P.Exe -Arguments $launchArgs -Portable $data.User -ExtraEnv @{ NODE_DEBUG = 'net'; ELECTRON_ENABLE_LOGGING = '1' } -StdoutFile $nodeOut -StderrFile $nodeErr
        }
        else {
            $launched = Start-EditorProcess -Exe $P.Exe -Arguments $launchArgs -Portable $data.User
        }
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
            $roleSources = @{}
            $roleMap = Get-RoleMap -Tree $tree -Sources $roleSources
            $sampleIndex++
            Update-Observations -State $state -Connections $mine -ProcessIndex $index -ClaudeIds $split.ClaudeIds -Elapsed $obsElapsed -Time $now -SampleIndex $sampleIndex -RoleMap $roleMap
            foreach ($c in $mine) {
                $o = [int]$c.OwningProcess
                $pr = $index[$o]
                $grp = 'editor'
                if ($split.ClaudeIds.ContainsKey($o)) { $grp = 'claude' }
                [void]$samples.Add([pscustomobject][ordered]@{
                    Time = $now.ToString('o'); Elapsed = [math]::Round($obsElapsed, 1); ProcessId = $o
                    ProcessName = $pr.Name; Role = $roleMap[$o]; RoleSource = $roleSources[$o]
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
        $tree2 = @()
        if ($ids2.Count -gt 0) { $tree2 = @(Get-Descendants -Processes $procs2 -RootIds $ids2) }
        # Ask the main window to close first so Chromium can finish the net log file; then force-stop what is left (our PID tree only).
        if ($netLogPath -and $launched) {
            try { [void]$launched.CloseMainWindow() } catch { }
            try { [void]$launched.WaitForExit(15000) } catch { }
        }
        if ($tree2.Count -gt 0) { Stop-EditorTree -Tree $tree2 }
        Start-Sleep -Seconds 5
        if ($P.KeepData) {
            Write-Warning "-KeepData: the data of this run stays at $($data.Root) (remove it with -CleanStale)"
            $leftovers += $data.Root
        }
        elseif (-not (Remove-RunDataDir -Path $data.Root)) {
            Write-Warning "could not remove $($data.Root)"
            $leftovers += $data.Root
        }
    }

    $dailyTouched = @(Compare-DailyArgvState -Before $dailyBefore -After @(Get-DailyArgvState))
    if ($dailyTouched.Count -gt 0) { Write-Warning ("daily argv.json was created or changed: " + ($dailyTouched -join ', ')) }
    $map = Get-DnsMap $dnsAll
    $netLog = $null
    if ($netLogPath) {
        try { $netLog = Read-NetLogFile $netLogPath } catch { Write-Warning "could not read the net log: $_" }
    }
    $nodeInfo = $null
    if ($nodeOut) {
        try { $nodeInfo = Read-NodeDebugFiles @($nodeOut, $nodeErr) } catch { Write-Warning "could not read the Node debug output: $_" }
    }
    $extra = @()
    if ($nodeInfo -and $nodeInfo.Map.Count -gt 0) { $extra += [pscustomobject]@{ Method = 'node-debug'; Map = $nodeInfo.Map; Weak = $true } }
    if ($netLog -and $netLog.Map.Count -gt 0) { $extra += [pscustomobject]@{ Method = 'netlog'; Map = $netLog.Map; Weak = $false; OnlyRoles = @('utility-network', 'main') } }
    if ($netLog -and $netLog.AnswerMap.Count -gt 0) { $extra += [pscustomobject]@{ Method = 'netlog-answer'; Map = $netLog.AnswerMap; Weak = $true } }
    # weak hints for addresses still unnamed after the net log and the DNS cache (never used for "allowed")
    $firstPass = @(New-DestinationRows -State $state -DnsMap $map -Previous $prev -List $allow.List -ExtraMaps $extra)
    $unnamed = @($firstPass | Where-Object { -not $_.Resolved } | ForEach-Object { @("$($_.Addresses)" -split ' ') } | Where-Object { $_ } | Select-Object -Unique)
    if (-not $P.NoHints -and $unnamed.Count -gt 0) {
        $fwd = Get-ForwardNameMap -List $allow.List
        if ($fwd.Count -gt 0) { $extra += [pscustomobject]@{ Method = 'forward'; Map = $fwd; Weak = $true } }
        $rev = Get-ReverseNameMap -Ips $unnamed
        if ($rev.Count -gt 0) { $extra += [pscustomobject]@{ Method = 'rdns'; Map = $rev; Weak = $true } }
    }
    $rows = @(New-DestinationRows -State $state -DnsMap $map -Previous $prev -List $allow.List -ExtraMaps $extra)
    $nlRows = $null
    if ($netLog -or $nodeInfo) {
        $nlHosts = $null; if ($netLog) { $nlHosts = $netLog.Hosts }
        $ndHosts = $null; if ($nodeInfo) { $ndHosts = $nodeInfo.Hosts }
        $nlRows = @(New-NamedHostRows -Hosts $nlHosts -NodeHosts $ndHosts -Rows $rows -List $allow.List -ProcessName $procName)
    }
    $samples | Export-Csv -LiteralPath (Join-Path $outDir 'samples.csv') -NoTypeInformation -Encoding UTF8
    $rows | Export-Csv -LiteralPath (Join-Path $outDir 'destinations.csv') -NoTypeInformation -Encoding UTF8
    if ($nlRows) { $nlRows | Export-Csv -LiteralPath (Join-Path $outDir 'named-hosts.csv') -NoTypeInformation -Encoding UTF8 }
    $dnsAll | Export-Csv -LiteralPath (Join-Path $outDir 'dns-cache.csv') -NoTypeInformation -Encoding UTF8
    $ver = $null
    try { $ver = (Get-Item -LiteralPath $P.Exe).VersionInfo.ProductVersion } catch { }
    $meta = [ordered]@{
        Label = $P.Label; Exe = $P.Exe; ExeVersion = $ver; EnvDir = $P.EnvDir
        DurationSeconds = $P.DurationSeconds; IntervalSeconds = $P.IntervalSeconds
        Samples = $sampleIndex; StartedAt = $t0.ToString('o'); DnsEntries = @($dnsAll).Count; DailyArgvTouched = $dailyTouched; RunDataLeftOver = $leftovers
        Allowlist = $allowPath; AllowlistMissing = $allow.Missing; Previous = $P.Previous
        NetLogPath = $netLogPath; NetLogEvents = $(if ($netLog) { $netLog.Events } else { 0 }); NetLogComplete = $(if ($netLog) { $netLog.Complete } else { $false })
    }
    ([ordered]@{ Meta = $meta; Destinations = $rows }) | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $outDir 'destinations.json') -Encoding UTF8
    $md = New-AuditMarkdown -Meta ([pscustomobject]$meta) -Rows $rows -HasPrevious ($null -ne $prev) -AllowlistInfo $allow -NetLogHostRows $nlRows
    Set-Content -LiteralPath (Join-Path $outDir 'audit.md') -Value $md -Encoding UTF8
    Write-Host ($md -join "`n")
    return $outDir
}

if ($naIsLibrary) { return }

Invoke-NetAudit -P $na | Out-Null
