# Unit tests for the calculations in scripts\netaudit.ps1 (no editor, no network access).
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File tests/netaudit.tests.ps1
# Exit code = number of failed tests. ASCII only (Windows PowerShell 5.1).
$ErrorActionPreference = 'Stop'
$script:Pass = 0
$script:Fail = 0
function Test-Case {
    param([string]$Name, [scriptblock]$Body)
    try { & $Body; $script:Pass++; Write-Host "ok   $Name" }
    catch { $script:Fail++; Write-Host "FAIL $Name : $_" }
}
function Assert-True { param($Cond, [string]$Msg) if (-not $Cond) { throw "expected true: $Msg" } }
function Assert-Equal { param($Actual, $Expected, [string]$Msg) if ("$Actual" -ne "$Expected") { throw "expected '$Expected' but got '$Actual' : $Msg" } }
function Assert-Throws { param([scriptblock]$Body, [string]$Msg) $threw = $false; try { & $Body } catch { $threw = $true }; if (-not $threw) { throw "expected an error: $Msg" } }
function New-Conn { param([int]$OwnerPid, [string]$Remote, [int]$Port = 443, [string]$State = 'Established') [pscustomobject]@{ OwningProcess = $OwnerPid; RemoteAddress = $Remote; RemotePort = $Port; State = $State } }
function New-Dns { param([string]$Name, $Type, [string]$Data) [pscustomobject]@{ Entry = $Name; Name = $Name; Type = $Type; Data = $Data } }
function New-Proc { param([int]$Id, [int]$ParentId, [string]$Name, [string]$Cmd = '') [pscustomobject]@{ ProcessId = $Id; ParentProcessId = $ParentId; Name = $Name; CommandLine = $Cmd } }

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent $here
. (Join-Path $repo 'scripts\netaudit.ps1')

Test-Case 'dot-source loads functions without running an audit' {
    Assert-True (Get-Command Get-DnsMap -ErrorAction SilentlyContinue) 'Get-DnsMap'
    Assert-True (Get-Command Get-Descendants -ErrorAction SilentlyContinue) 'shared function from measure.ps1'
}

# ---- IP handling -------------------------------------------------------------
Test-Case 'ip: IPv4-mapped IPv6 becomes IPv4' { Assert-Equal (ConvertTo-NormalIp '::ffff:160.79.104.10') '160.79.104.10' '' }
Test-Case 'ip: scope id is dropped' { Assert-Equal (ConvertTo-NormalIp 'fe80::1%12') 'fe80::1' '' }
Test-Case 'ip: IPv6 is written in canonical form' { Assert-Equal (ConvertTo-NormalIp '2606:4700:0:0:0:0:6810:84E5') '2606:4700::6810:84e5' '' }
Test-Case 'ip: garbage and empty give null' {
    Assert-True ($null -eq (ConvertTo-NormalIp 'not-an-ip')) ''
    Assert-True ($null -eq (ConvertTo-NormalIp '')) ''
    Assert-True ($null -eq (ConvertTo-NormalIp $null)) ''
}
foreach ($a in @('127.0.0.1', '127.1.2.3', '::1', '0.0.0.0', '::', '::ffff:127.0.0.1')) {
    Test-Case "ignored address: $a" { Assert-True (Test-IgnoredAddress $a) '' }
}
foreach ($a in @('160.79.104.10', '2606:4700::6810:84e5', '10.0.0.5', '192.168.1.1')) {
    Test-Case "kept address: $a" { Assert-True (-not (Test-IgnoredAddress $a)) '' }
}

# ---- DNS cache -> names ------------------------------------------------------
Test-Case 'dns: A record maps the IP to the name' {
    $m = Get-DnsMap @((New-Dns 'api.notion.com' 1 '104.18.1.1'))
    Assert-Equal (@(Get-HostNames $m '104.18.1.1') -join ',') 'api.notion.com' ''
}
Test-Case 'dns: CNAME chain - the name the program asked for comes first, canonical last' {
    $m = Get-DnsMap @(
        (New-Dns 'update.code.visualstudio.com' 5 'vscode-update.azurefd.net.'),
        (New-Dns 'vscode-update.azurefd.net' 5 'azurefd-edge.example.net'),
        (New-Dns 'azurefd-edge.example.net' 1 '13.107.213.1')
    )
    Assert-Equal (@(Get-HostNames $m '13.107.213.1') -join ',') 'update.code.visualstudio.com,vscode-update.azurefd.net,azurefd-edge.example.net' ''
}
Test-Case 'dns: type given as a name (A / AAAA / CNAME) works like a number' {
    $m = Get-DnsMap @((New-Dns 'a.example.com' 'CNAME' 'b.example.net'), (New-Dns 'b.example.net' 'AAAA' '2606:4700::6810:84e5'))
    Assert-Equal (@(Get-HostNames $m '2606:4700::6810:84E5') -join ',') 'a.example.com,b.example.net' ''
}
Test-Case 'dns: IPv4-mapped lookups find the IPv4 record' {
    $m = Get-DnsMap @((New-Dns 'x.example.com' 1 '203.0.113.9'))
    Assert-Equal (@(Get-HostNames $m '::ffff:203.0.113.9') -join ',') 'x.example.com' ''
}
Test-Case 'dns: names are lower-cased, trailing dots dropped' {
    $m = Get-DnsMap @((New-Dns 'API.Example.COM.' 1 '203.0.113.9'))
    Assert-Equal (@(Get-HostNames $m '203.0.113.9') -join ',') 'api.example.com' ''
}
Test-Case 'dns: unknown IP gives no names' {
    $m = Get-DnsMap @((New-Dns 'x.example.com' 1 '203.0.113.9'))
    Assert-Equal @(Get-HostNames $m '203.0.113.99').Count 0 ''
}
Test-Case 'dns: two names for one IP are both kept; duplicates from several snapshots are not repeated' {
    $m = Get-DnsMap @(
        (New-Dns 'a.example.com' 1 '203.0.113.9'), (New-Dns 'b.example.com' 1 '203.0.113.9'),
        (New-Dns 'a.example.com' 1 '203.0.113.9')
    )
    $n = @(Get-HostNames $m '203.0.113.9')
    Assert-Equal $n.Count 2 ''
}
Test-Case 'dns: a CNAME loop does not hang' {
    $m = Get-DnsMap @((New-Dns 'a.example.com' 5 'b.example.com'), (New-Dns 'b.example.com' 5 'a.example.com'), (New-Dns 'b.example.com' 1 '203.0.113.9'))
    Assert-True (@(Get-HostNames $m '203.0.113.9').Count -ge 1) ''
}
Test-Case 'dns: records of other types (PTR, MX ...) and empty input are ignored' {
    $m = Get-DnsMap @((New-Dns 'x.example.com' 12 'whatever'), (New-Dns 'y.example.com' 15 'mail.example.com'))
    Assert-Equal $m.Count 0 ''
    Assert-Equal (Get-DnsMap @()).Count 0 ''
}

# ---- connections of the process tree ----------------------------------------
Test-Case 'tree connections: only PIDs of the tree, no loopback, only Established' {
    $pids = @{ 10 = $true; 11 = $true }
    $conns = @(
        (New-Conn 10 '160.79.104.10'),
        (New-Conn 11 '127.0.0.1' 5000),
        (New-Conn 12 '160.79.104.10'),
        (New-Conn 10 '::1' 443),
        (New-Conn 11 '104.18.1.1' 443 'TimeWait'),
        (New-Conn 11 '104.18.1.1' 443)
    )
    $r = @(Select-TreeConnections -Connections $conns -PidSet $pids)
    Assert-Equal $r.Count 2 ''
    Assert-Equal (($r | ForEach-Object { "$($_.OwningProcess)>$($_.RemoteAddress)" }) -join ',') '10>160.79.104.10,11>104.18.1.1' ''
}

# ---- observations ------------------------------------------------------------
$index = @{
    10 = (New-Proc 10 1 'Code.exe' '"Code.exe" --type=utility --utility-sub-type=network.mojom.NetworkService')
    11 = (New-Proc 11 1 'Code.exe' '"Code.exe" --type=extensionHost')
    20 = (New-Proc 20 11 'claude.exe' 'claude.exe')
}
$claudeIds = @{ 20 = $true }
$tA = [datetime]'2026-11-13T10:00:00'
Test-Case 'observations: first seen is kept, count is per sample (not per connection)' {
    $st = @{}
    # sample 1: two connections to the same destination
    Update-Observations -State $st -Connections @((New-Conn 10 '1.1.1.1'), (New-Conn 10 '1.1.1.1')) -ProcessIndex $index -ClaudeIds $claudeIds -Elapsed 2 -Time $tA.AddSeconds(2) -SampleIndex 1
    Update-Observations -State $st -Connections @((New-Conn 10 '1.1.1.1')) -ProcessIndex $index -ClaudeIds $claudeIds -Elapsed 4 -Time $tA.AddSeconds(4) -SampleIndex 2
    $r = $st['editor|1.1.1.1|443']
    Assert-Equal $r.SampleCount 2 'two samples'
    Assert-Equal $r.FirstSeenElapsed 2 'first seen stays at sample 1'
    Assert-Equal $r.LastSeen $tA.AddSeconds(4) 'last seen moves on'
}
Test-Case 'observations: claude.exe goes to its own group; same IP in both groups stays apart' {
    $st = @{}
    Update-Observations -State $st -Connections @((New-Conn 10 '1.1.1.1'), (New-Conn 20 '1.1.1.1')) -ProcessIndex $index -ClaudeIds $claudeIds -Elapsed 2 -Time $tA -SampleIndex 1
    Assert-Equal $st.Count 2 ''
    Assert-True $st.ContainsKey('editor|1.1.1.1|443') 'editor'
    Assert-True $st.ContainsKey('claude|1.1.1.1|443') 'claude'
}
Test-Case 'observations: processes and roles are collected per destination; ports are separate' {
    $st = @{}
    Update-Observations -State $st -Connections @((New-Conn 10 '1.1.1.1'), (New-Conn 11 '1.1.1.1'), (New-Conn 11 '1.1.1.1' 80)) -ProcessIndex $index -ClaudeIds $claudeIds -Elapsed 2 -Time $tA -SampleIndex 1
    Assert-Equal $st.Count 2 'port 443 and port 80'
    $r = $st['editor|1.1.1.1|443']
    Assert-True $r.Roles.ContainsKey('utility-network') 'network service'
    Assert-True $r.Roles.ContainsKey('extension-host') 'ext host'
    Assert-Equal $r.Pids.Count 2 ''
}
Test-Case 'observations: a PID that exited before the lookup is kept as "(pid N)"' {
    $st = @{}
    Update-Observations -State $st -Connections @((New-Conn 99 '1.1.1.1')) -ProcessIndex $index -ClaudeIds $claudeIds -Elapsed 2 -Time $tA -SampleIndex 1
    Assert-True $st['editor|1.1.1.1|443'].Processes.ContainsKey('(pid 99)') ''
}

Test-Case 'observations: a RoleMap (refined roles) is used for the role when given' {
    $st = @{}
    Update-Observations -State $st -Connections @((New-Conn 11 '1.1.1.1')) -ProcessIndex $index -ClaudeIds $claudeIds -Elapsed 2 -Time $tA -SampleIndex 1 -RoleMap @{ 11 = 'agent-host' }
    Assert-True $st['editor|1.1.1.1|443'].Roles.ContainsKey('agent-host') 'refined role'
    Assert-True (-not $st['editor|1.1.1.1|443'].Roles.ContainsKey('extension-host')) 'not the first-pass role'
}
Test-Case 'observations: first seen uses the Elapsed it is given (seconds from the editor start, B-7)' {
    $st = @{}
    Update-Observations -State $st -Connections @((New-Conn 10 '1.1.1.1')) -ProcessIndex $index -ClaudeIds $claudeIds -Elapsed 3.7 -Time $tA -SampleIndex 1
    Assert-Equal $st['editor|1.1.1.1|443'].FirstSeenElapsed 3.7 ''
}

# ---- allowed-destination list -----------------------------------------------
$fixture = Join-Path $here 'fixtures\network-allowlist.example.json'
Test-Case 'allowlist: the example file is valid' {
    $a = Read-AllowlistFile $fixture
    Assert-True (-not $a.Missing) 'found'
    Assert-Equal $a.Errors.Count 0 ($a.Errors -join '; ')
    Assert-True ($a.List.allow.Count -ge 4) 'has entries'
}
Test-Case 'allowlist: a missing file means nothing is allowed' {
    $a = Read-AllowlistFile (Join-Path $here 'fixtures\no-such-file.json')
    Assert-True $a.Missing ''
    Assert-True ($null -eq $a.List) ''
}
Test-Case 'allowlist: broken JSON is reported' {
    $f = Join-Path ([IO.Path]::GetTempPath()) ("badjson-" + [guid]::NewGuid().ToString('N') + '.json')
    Set-Content -LiteralPath $f -Value '{ not json'
    try { $a = Read-AllowlistFile $f; Assert-True ($a.Errors.Count -gt 0) 'error reported' }
    finally { Remove-Item -LiteralPath $f -Force -ErrorAction SilentlyContinue }
}
function Parse-Json { param([string]$Text) $Text | ConvertFrom-Json }
Test-Case 'format: wrong version / no allow array' {
    Assert-True (@(Test-AllowlistFormat (Parse-Json '{"version":2,"allow":[]}')).Count -ge 1) 'version 2'
    Assert-True (@(Test-AllowlistFormat (Parse-Json '{"version":1}')).Count -ge 1) 'no allow'
    Assert-True (@(Test-AllowlistFormat $null).Count -ge 1) 'null'
}
Test-Case 'format: an empty allow list is valid' {
    Assert-Equal @(Test-AllowlistFormat (Parse-Json '{"version":1,"allow":[]}')).Count 0 ''
}
foreach ($bad in @(
    '{"host":"*","reason":"x"}',
    '{"host":"*.*","reason":"x"}',
    '{"host":"a.*.com","reason":"x"}',
    '{"host":"*.a.*.com","reason":"x"}',
    '{"reason":"x"}',
    '{"host":"a.com"}',
    '{"host":"a.com","reason":"x","ports":[0]}',
    '{"host":"a.com","reason":"x","ports":[70000]}',
    '{"host":"a.com","reason":"x","ports":["abc"]}',
    '{"host":"a.com","reason":"x","processes":[""]}'
)) {
    Test-Case "format: rejected $bad" {
        $o = Parse-Json ('{"version":1,"allow":[' + $bad + ']}')
        Assert-True (@(Test-AllowlistFormat $o).Count -ge 1) 'should have an error'
    }
}
Test-Case 'host pattern: exact, case-insensitive, trailing dot' {
    Assert-True (Test-HostPattern 'api.notion.com' 'API.Notion.com.') ''
    Assert-True (-not (Test-HostPattern 'api.notion.com' 'www.notion.com')) ''
}
Test-Case 'host pattern: wildcard matches subdomains at any depth but not the apex or look-alikes' {
    Assert-True (Test-HostPattern '*.anthropic.com' 'api.anthropic.com') 'one level'
    Assert-True (Test-HostPattern '*.anthropic.com' 'a.b.anthropic.com') 'two levels'
    Assert-True (-not (Test-HostPattern '*.anthropic.com' 'anthropic.com')) 'apex'
    Assert-True (-not (Test-HostPattern '*.anthropic.com' 'evilanthropic.com')) 'look-alike'
    Assert-True (-not (Test-HostPattern '*.anthropic.com' 'anthropic.com.evil.net')) 'suffix trick'
}
Test-Case 'host pattern: IP literal matches the same address in any spelling' {
    Assert-True (Test-HostPattern '198.51.100.7' '::ffff:198.51.100.7') ''
    Assert-True (-not (Test-HostPattern '198.51.100.7' '198.51.100.8')) ''
}
$list = (Read-AllowlistFile $fixture).List
Test-Case 'allowed: a listed host on the listed port' {
    Assert-True (Test-DestinationAllowed -List $list -Names @('api.notion.com') -Port 443 -ProcessNames @('Code.exe')).Allowed ''
}
Test-Case 'allowed: the listed host on another port is not allowed' {
    Assert-True (-not (Test-DestinationAllowed -List $list -Names @('api.notion.com') -Port 8443 -ProcessNames @('Code.exe')).Allowed) ''
}
Test-Case 'allowed: restricted to claude.exe - the editor reaching it is not allowed' {
    Assert-True (Test-DestinationAllowed -List $list -Names @('api.anthropic.com') -Port 443 -ProcessNames @('claude.exe')).Allowed 'claude'
    Assert-True (-not (Test-DestinationAllowed -List $list -Names @('api.anthropic.com') -Port 443 -ProcessNames @('Code.exe')).Allowed) 'editor'
    Assert-True (-not (Test-DestinationAllowed -List $list -Names @('api.anthropic.com') -Port 443 -ProcessNames @('claude.exe', 'Code.exe')).Allowed) 'both'
}
Test-Case 'allowed: any one of the names may match (CNAME alias or canonical)' {
    Assert-True (Test-DestinationAllowed -List $list -Names @('lb-123.example.net', 'api.notion.com') -Port 443 -ProcessNames @('Code.exe')).Allowed ''
}
Test-Case 'allowed: a listed IP literal covers an unresolved destination' {
    Assert-True (Test-DestinationAllowed -List $list -Names @('198.51.100.7') -Port 443 -ProcessNames @('Code.exe')).Allowed ''
    Assert-True (-not (Test-DestinationAllowed -List $list -Names @('198.51.100.8') -Port 443 -ProcessNames @('Code.exe')).Allowed) ''
}
Test-Case 'allowed: reason is returned; null list allows nothing' {
    Assert-Equal (Test-DestinationAllowed -List $list -Names @('api.notion.com') -Port 443 -ProcessNames @()).Reason 'Notion sync (docs/05)' ''
    Assert-True (-not (Test-DestinationAllowed -List $null -Names @('api.notion.com') -Port 443 -ProcessNames @()).Allowed) ''
}

# ---- destination rows: first seen, process, count, new, unlisted -------------
function New-StateFrom {
    # sample 1 at 2 s: editor -> 104.18.1.1 (api.notion.com) ; sample 2 at 4 s: same plus a new unknown IP and a second IP of the same host
    $st = @{}
    Update-Observations -State $st -Connections @((New-Conn 11 '104.18.1.1')) -ProcessIndex $index -ClaudeIds $claudeIds -Elapsed 2 -Time $tA.AddSeconds(2) -SampleIndex 1
    Update-Observations -State $st -Connections @((New-Conn 11 '104.18.1.1'), (New-Conn 11 '104.18.1.2'), (New-Conn 10 '203.0.113.77'), (New-Conn 20 '160.79.104.10')) -ProcessIndex $index -ClaudeIds $claudeIds -Elapsed 4 -Time $tA.AddSeconds(4) -SampleIndex 2
    return $st
}
$dnsMap = Get-DnsMap @(
    (New-Dns 'api.notion.com' 1 '104.18.1.1'), (New-Dns 'api.notion.com' 1 '104.18.1.2'),
    (New-Dns 'api.anthropic.com' 1 '160.79.104.10')
)
Test-Case 'rows: IPs of one host are merged; first seen, processes and counts are right' {
    $rows = @(New-DestinationRows -State (New-StateFrom) -DnsMap $dnsMap -Previous $null -List $list)
    $n = @($rows | Where-Object { $_.HostKey -eq 'api.notion.com' })
    Assert-Equal $n.Count 1 'merged into one row'
    Assert-Equal $n[0].FirstSeenSeconds 2 ''
    Assert-Equal $n[0].SampleCount 3 '2 samples for .1 and 1 for .2'
    Assert-Equal $n[0].Processes 'Code.exe' ''
    Assert-Equal $n[0].Addresses '104.18.1.1 104.18.1.2' ''
}
Test-Case 'rows: sorted by first seen' {
    $rows = @(New-DestinationRows -State (New-StateFrom) -DnsMap $dnsMap -Previous $null -List $list)
    Assert-Equal $rows[0].HostKey 'api.notion.com' ''
}
Test-Case 'rows: unresolved IP is its own host key and is flagged as unresolved' {
    $rows = @(New-DestinationRows -State (New-StateFrom) -DnsMap $dnsMap -Previous $null -List $list)
    $u = $rows | Where-Object { $_.HostKey -eq '203.0.113.77' }
    Assert-True (-not $u.Resolved) ''
    Assert-True (-not $u.Allowed) ''
}
Test-Case 'rows: claude destination is in the claude group and allowed for claude.exe' {
    $rows = @(New-DestinationRows -State (New-StateFrom) -DnsMap $dnsMap -Previous $null -List $list)
    $c = $rows | Where-Object { $_.Group -eq 'claude' }
    Assert-Equal $c.HostKey 'api.anthropic.com' ''
    Assert-True $c.Allowed ''
}
Test-Case 'unlisted: exactly the destinations the allowlist does not cover' {
    $rows = @(New-DestinationRows -State (New-StateFrom) -DnsMap $dnsMap -Previous $null -List $list)
    $u = @(Get-UnlistedDestinations $rows)
    Assert-Equal (($u | ForEach-Object { $_.HostKey }) -join ',') '203.0.113.77' ''
}
Test-Case 'unlisted: with no allowlist everything is unlisted' {
    $rows = @(New-DestinationRows -State (New-StateFrom) -DnsMap $dnsMap -Previous $null -List $null)
    Assert-Equal @(Get-UnlistedDestinations $rows).Count $rows.Count ''
}
Test-Case 'new: no previous list means nothing is marked new' {
    $rows = @(New-DestinationRows -State (New-StateFrom) -DnsMap $dnsMap -Previous $null -List $list)
    Assert-Equal @(Get-NewDestinations $rows).Count 0 ''
}
Test-Case 'new: destinations missing from the previous list are marked new (by host, not by IP)' {
    $prev = @([pscustomobject]@{ Group = 'editor'; HostKey = 'api.notion.com' })
    $rows = @(New-DestinationRows -State (New-StateFrom) -DnsMap $dnsMap -Previous $prev -List $list)
    $new = @(Get-NewDestinations $rows | ForEach-Object { "$($_.Group):$($_.HostKey)" } | Sort-Object)
    Assert-Equal ($new -join ',') 'claude:api.anthropic.com,editor:203.0.113.77' ''
}
Test-Case 'new: same host with a different IP is not new' {
    $prev = @([pscustomobject]@{ Group = 'editor'; HostKey = 'api.notion.com' }, [pscustomobject]@{ Group = 'editor'; HostKey = '203.0.113.77' }, [pscustomobject]@{ Group = 'claude'; HostKey = 'api.anthropic.com' })
    $rows = @(New-DestinationRows -State (New-StateFrom) -DnsMap $dnsMap -Previous $prev -List $list)
    Assert-Equal @(Get-NewDestinations $rows).Count 0 ''
}
Test-Case 'new: an empty previous list (not null) marks everything new' {
    $rows = @(New-DestinationRows -State (New-StateFrom) -DnsMap $dnsMap -Previous @() -List $list)
    Assert-Equal @(Get-NewDestinations $rows).Count $rows.Count ''
}

# ---- report and previous list round trip --------------------------------------
Test-Case 'markdown: has both tables, the NEW mark and the unlisted entry' {
    $prev = @([pscustomobject]@{ Group = 'editor'; HostKey = 'api.notion.com' })
    $rows = @(New-DestinationRows -State (New-StateFrom) -DnsMap $dnsMap -Previous $prev -List $list)
    $meta = [pscustomobject]@{ Label = 't'; Exe = 'x'; DurationSeconds = 600; IntervalSeconds = 2; Samples = 2 }
    $md = (New-AuditMarkdown -Meta $meta -Rows $rows -HasPrevious $true -AllowlistInfo ([pscustomobject]@{ Missing = $false })) -join "`n"
    Assert-True ($md -match 'Editor destinations') 'editor table'
    Assert-True ($md -match 'claude.exe destinations') 'claude table'
    Assert-True ($md -match 'NEW') 'new mark'
    Assert-True ($md -match '203\.0\.113\.77') 'unlisted ip'
    Assert-True ($md -match 'Not in the allowlist') 'section'
}
Test-Case 'previous list: destinations.json written by a run can be read back' {
    $dir = Join-Path ([IO.Path]::GetTempPath()) ("na-prev-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $dir | Out-Null
    try {
        $rows = @(New-DestinationRows -State (New-StateFrom) -DnsMap $dnsMap -Previous $null -List $list)
        ([ordered]@{ Meta = @{ Label = 'x' }; Destinations = $rows }) | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $dir 'destinations.json') -Encoding UTF8
        $back = Read-PreviousDestinations $dir
        Assert-Equal $back.Count $rows.Count ''
        $prevRows = @(New-DestinationRows -State (New-StateFrom) -DnsMap $dnsMap -Previous $back -List $list)
        Assert-Equal @(Get-NewDestinations $prevRows).Count 0 'same run vs itself has nothing new'
        $back2 = Read-PreviousDestinations (Join-Path $dir 'destinations.json')
        Assert-Equal $back2.Count $rows.Count 'file path also works'
        Assert-True ($null -eq (Read-PreviousDestinations $null)) 'null stays null'
        Assert-Throws { Read-PreviousDestinations (Join-Path $dir 'nope') } 'missing'
    }
    finally { Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue }
}

# ---- host names from the Chromium net log ------------------------------------
# Synthetic lines in the shape of a real --log-net-log file (checked against Electron 1.146.0 / Chromium output, 2026-11-13).
function New-NlResolve { param([int]$Sid, [string]$HostText) '{"params":{"allow_cached_response":true,"dns_query_type":"UNSPECIFIED","host":"' + $HostText + '","is_speculative":false,"network_anonymization_key":"null","secure_dns_policy":0},"phase":1,"source":{"id":' + $Sid + ',"start_time":"1","type":5},"time":"2","type":5},' }
function New-NlAnswer { param([int]$Sid, [string[]]$Aliases, [string[]]$Canon, [string[]]$Ips)
    $al = ($Aliases | ForEach-Object { '"' + $_ + '"' }) -join ','
    $ca = ($Canon | ForEach-Object { '"' + $_ + '"' }) -join ','
    $ep = ($Ips | ForEach-Object { '{"endpoint_address":"' + $_ + '","endpoint_port":0}' }) -join ','
    '{"params":{"results":{"aliases":[' + $al + '],"canonical_names":[' + $ca + '],"endpoint_metadatas":[],"expiration":"1","host_ports":[],"hostname_results":[],"ip_endpoints":[' + $ep + '],"text_records":[]}},"phase":0,"source":{"id":' + $Sid + ',"start_time":"1","type":5},"time":"3","type":8},'
}
function New-NlConnect { param([int]$Sid, [string]$Addr) '{"params":{"address":"' + $Addr + '","source_dependency":{"id":99,"type":10}},"phase":0,"source":{"id":' + $Sid + ',"start_time":"1","type":5},"time":"4","type":110},' }
function New-NlUrl { param([int]$Sid, [string]$Url) '{"params":{"initiator":"vscode-file://vscode-app","load_flags":64,"method":"GET","url":"' + $Url + '"},"phase":1,"source":{"id":' + $Sid + ',"start_time":"1","type":1},"time":"5","type":133},' }
$nlHead = '{"constants":{"logEventTypes":{"HOST_RESOLVER_MANAGER_REQUEST":5}},'
$nlLines = @(
    $nlHead, '"events": [',
    (New-NlResolve 10 'https://marketplace.visualstudio.com'),
    (New-NlAnswer 10 @('market.bx-0007.bx-msedge.net', 'marketplace.visualstudio.com', 'bx-0007.bx-msedge.net') @('bx-0007.bx-msedge.net') @('2603:1061:10:1::16', '13.107.5.93')),
    (New-NlConnect 10 '[2603:1061:10:1::16]:443'),
    (New-NlResolve 11 'default.exp-tas.com:443'),
    (New-NlAnswer 11 @('default.exp-tas.com', 'e-0014.e-msedge.net') @('e-0014.e-msedge.net') @('13.107.5.93')),
    (New-NlConnect 11 '13.107.5.93:443'),
    (New-NlResolve 12 'wpad:80'),
    (New-NlUrl 20 'https://user:pw@marketplace.visualstudio.com/_apis/x?token=SECRET123'),
    (New-NlUrl 21 'https://marketplace.visualstudio.com/other'),
    (New-NlUrl 22 'vscode-file://vscode-app/c:/x'),
    '{"phase":2,"source":{"id":10,"start_time":"1","type":5},"time":"9","type":5}',
    ']', '}'
)
$nl = Get-NetLogInfo $nlLines
Test-Case 'netlog name: URL, host:port and scheme-host forms give a lower-case host; IP literals and empty give null' {
    Assert-Equal (ConvertTo-NetLogHostName 'https://Marketplace.VisualStudio.com:443/x?y=1') 'marketplace.visualstudio.com' ''
    Assert-Equal (ConvertTo-NetLogHostName 'wpad:80') 'wpad' ''
    Assert-Equal (ConvertTo-NetLogHostName 'api.notion.com.') 'api.notion.com' 'trailing dot'
    Assert-Equal (ConvertTo-NetLogHostName 'https://u:p@a.example.com/') 'a.example.com' 'user info dropped'
    Assert-True ($null -eq (ConvertTo-NetLogHostName '203.0.113.5:443')) 'ipv4'
    Assert-True ($null -eq (ConvertTo-NetLogHostName '[2001:db8::1]:443')) 'ipv6'
    Assert-True ($null -eq (ConvertTo-NetLogHostName '')) 'empty'
}
Test-Case 'netlog url: only http/https/ws/wss are kept, port defaults by scheme' {
    $u = Get-NetLogUrlParts 'https://a.example.com/p?q=1'
    Assert-Equal "$($u.Host):$($u.Port)" 'a.example.com:443' ''
    $u = Get-NetLogUrlParts 'http://a.example.com:8080/'
    Assert-Equal "$($u.Host):$($u.Port)" 'a.example.com:8080' ''
    Assert-Equal (Get-NetLogUrlParts 'wss://a.example.com/s').Port 443 ''
    Assert-True ($null -eq (Get-NetLogUrlParts 'vscode-file://vscode-app/x')) 'file scheme'
    Assert-True ($null -eq (Get-NetLogUrlParts 'https://203.0.113.5/x')) 'ip literal'
}
Test-Case 'netlog: an address a socket was opened to is named after the host it was opened for (asked-for name first, canonical last)' {
    Assert-Equal (@(Get-HostNames $nl.Map '2603:1061:10:1::16') -join ',') 'marketplace.visualstudio.com,market.bx-0007.bx-msedge.net,bx-0007.bx-msedge.net' ''
    Assert-Equal (@(Get-HostNames $nl.Map '13.107.5.93') -join ',') 'default.exp-tas.com,e-0014.e-msedge.net' 'host:port form'
}
Test-Case 'netlog: an address that is only in a resolver answer is not in Map (shared CDN addresses), but is in AnswerMap with both hosts' {
    # 13.107.5.93 was an answer for marketplace too, but the socket was opened for default.exp-tas.com
    Assert-True (@(Get-HostNames $nl.Map '13.107.5.93') -notcontains 'marketplace.visualstudio.com') 'not attributed to marketplace in Map'
    Assert-True (@(Get-HostNames $nl.AnswerMap '13.107.5.93') -contains 'marketplace.visualstudio.com') 'but listed in AnswerMap'
    Assert-True (@(Get-HostNames $nl.AnswerMap '13.107.5.93') -contains 'default.exp-tas.com') ''
}
Test-Case 'netlog: hosts get request and resolution counts; wpad is there with no answer; file scheme is not a host' {
    Assert-Equal $nl.Hosts['marketplace.visualstudio.com'].Requests 2 'two url requests'
    Assert-Equal $nl.Hosts['marketplace.visualstudio.com'].Resolutions 1 ''
    Assert-True $nl.Hosts['marketplace.visualstudio.com'].Answered ''
    Assert-True (-not $nl.Hosts['wpad'].Answered) ''
    Assert-Equal $nl.Hosts['wpad'].Port 80 ''
    Assert-Equal $nl.Hosts['default.exp-tas.com'].Port 443 ''
    Assert-True (-not $nl.Hosts.ContainsKey('vscode-app')) ''
}
Test-Case 'netlog: nothing but host names and counts is kept (no path, query, user info, secrets)' {
    $json = ($nl | ConvertTo-Json -Depth 6)
    Assert-True ($json -notmatch 'SECRET123') 'query value'
    Assert-True ($json -notmatch '_apis') 'path'
    Assert-True ($json -notmatch 'user:pw') 'user info'
}
Test-Case 'netlog: a complete file ends with a closing brace; a truncated one still gives names and is flagged' {
    Assert-True $nl.Complete 'complete'
    $cut = Get-NetLogInfo @($nlLines[0..7])
    Assert-True (-not $cut.Complete) 'truncated'
    Assert-Equal (@(Get-HostNames $cut.Map '13.107.5.93') -join ',') 'default.exp-tas.com,e-0014.e-msedge.net' ''
}
Test-Case 'netlog: garbage, empty lines and half lines are skipped without an error' {
    $r = Get-NetLogInfo @('', 'not json "ip_endpoints":[ {{{', '{"params":{"dns_query_type":"X","host":"ok.example.com:443"},"phase":1,"source":{"id":1},"time":"1","type":5},')
    Assert-True $r.Hosts.ContainsKey('ok.example.com') ''
    Assert-Equal $r.Map.Count 0 ''
}
Test-Case 'netlog: an empty line list gives empty results' {
    $r = Get-NetLogInfo @()
    Assert-Equal $r.Map.Count 0 ''
    Assert-Equal $r.Hosts.Count 0 ''
    Assert-True (-not $r.Complete) ''
}
Test-Case 'netlog file: read from disk (shared read), missing file gives null' {
    $f = Join-Path ([IO.Path]::GetTempPath()) ("nl-" + [guid]::NewGuid().ToString('N') + '.json')
    try {
        Set-Content -LiteralPath $f -Value $nlLines -Encoding UTF8
        $r = Read-NetLogFile $f
        Assert-Equal $r.Path $f ''
        Assert-True (@(Get-HostNames $r.Map '13.107.5.93').Count -ge 1) ''
        Assert-True ($null -eq (Read-NetLogFile (Join-Path ([IO.Path]::GetTempPath()) 'no-such-netlog.json'))) 'missing'
        Set-Content -LiteralPath $f -Value '' -Encoding ASCII
        Assert-True ($null -eq (Read-NetLogFile $f)) 'empty'
    }
    finally { Remove-Item -LiteralPath $f -Force -ErrorAction SilentlyContinue }
}

# ---- name sources in the destination rows ----------------------------------
$nlMap = $nl.Map
Test-Case 'rows+netlog: the net log names an address the DNS cache does not know; method is netlog' {
    $st = @{}
    Update-Observations -State $st -Connections @((New-Conn 10 '13.107.5.93')) -ProcessIndex $index -ClaudeIds $claudeIds -Elapsed 2 -Time $tA -SampleIndex 1
    $rows = @(New-DestinationRows -State $st -DnsMap @{} -Previous $null -List $null -ExtraMaps @([pscustomobject]@{ Method = 'netlog'; Map = $nlMap; Weak = $false }))
    Assert-Equal $rows[0].HostKey 'default.exp-tas.com' ''
    Assert-True $rows[0].Resolved ''
    Assert-Equal $rows[0].NameMethod 'netlog' ''
}
Test-Case 'rows+netlog: both sources name it -> method lists both, net log names first' {
    $st = @{}
    Update-Observations -State $st -Connections @((New-Conn 10 '13.107.5.93')) -ProcessIndex $index -ClaudeIds $claudeIds -Elapsed 2 -Time $tA -SampleIndex 1
    $dns = Get-DnsMap @((New-Dns 'dns.example.net' 1 '13.107.5.93'))
    $rows = @(New-DestinationRows -State $st -DnsMap $dns -Previous $null -List $null -ExtraMaps @([pscustomobject]@{ Method = 'netlog'; Map = $nlMap; Weak = $false }))
    Assert-Equal $rows[0].NameMethod 'netlog+dns-cache' ''
    Assert-Equal $rows[0].HostKey 'default.exp-tas.com' ''
    Assert-True ($rows[0].Names -match 'dns\.example\.net') ''
}
Test-Case 'rows+netlog: only the DNS cache names it -> method dns-cache; nothing names it -> none' {
    $st = @{}
    Update-Observations -State $st -Connections @((New-Conn 10 '104.18.1.1'), (New-Conn 10 '203.0.113.77')) -ProcessIndex $index -ClaudeIds $claudeIds -Elapsed 2 -Time $tA -SampleIndex 1
    $rows = @(New-DestinationRows -State $st -DnsMap $dnsMap -Previous $null -List $list -ExtraMaps @())
    Assert-Equal ($rows | Where-Object { $_.HostKey -eq 'api.notion.com' }).NameMethod 'dns-cache' ''
    Assert-Equal ($rows | Where-Object { $_.HostKey -eq '203.0.113.77' }).NameMethod 'none' ''
}
Test-Case 'rows+hints: a weak name stays a hint - the host key is still the IP, it is not resolved, and it never makes the row allowed' {
    $st = @{}
    Update-Observations -State $st -Connections @((New-Conn 10 '198.51.100.99')) -ProcessIndex $index -ClaudeIds $claudeIds -Elapsed 2 -Time $tA -SampleIndex 1
    $weak = [pscustomobject]@{ Method = 'forward'; Map = @{ '198.51.100.99' = @('api.notion.com') }; Weak = $true }
    $rows = @(New-DestinationRows -State $st -DnsMap @{} -Previous $null -List $list -ExtraMaps @($weak))
    Assert-Equal $rows[0].HostKey '198.51.100.99' ''
    Assert-True (-not $rows[0].Resolved) ''
    Assert-True (-not $rows[0].Allowed) 'weak name must not allow'
    Assert-Equal $rows[0].WeakNames 'api.notion.com [forward]' ''
    Assert-Equal $rows[0].NameMethod 'none' ''
}
Test-Case 'rows+hints: weak names are not looked at when a strong source already named the address' {
    $st = @{}
    Update-Observations -State $st -Connections @((New-Conn 10 '13.107.5.93')) -ProcessIndex $index -ClaudeIds $claudeIds -Elapsed 2 -Time $tA -SampleIndex 1
    $weak = [pscustomobject]@{ Method = 'rdns'; Map = @{ '13.107.5.93' = @('whatever.example.net') }; Weak = $true }
    $rows = @(New-DestinationRows -State $st -DnsMap @{} -Previous $null -List $null -ExtraMaps @([pscustomobject]@{ Method = 'netlog'; Map = $nlMap; Weak = $false }, $weak))
    Assert-Equal $rows[0].WeakNames '' ''
}
Test-Case 'rows+netlog: a host named by the net log and listed in the allowlist is allowed' {
    $st = @{}
    Update-Observations -State $st -Connections @((New-Conn 10 '104.18.1.9')) -ProcessIndex $index -ClaudeIds $claudeIds -Elapsed 2 -Time $tA -SampleIndex 1
    $m = [pscustomobject]@{ Method = 'netlog'; Map = @{ '104.18.1.9' = @('api.notion.com') }; Weak = $false }
    $rows = @(New-DestinationRows -State $st -DnsMap @{} -Previous $null -List $list -ExtraMaps @($m))
    Assert-True $rows[0].Allowed ''
}
Test-Case 'rows: existing callers without ExtraMaps still work (four arguments)' {
    $rows = @(New-DestinationRows -State (New-StateFrom) -DnsMap $dnsMap -Previous $null -List $list)
    Assert-True ($rows.Count -ge 1) ''
    Assert-True ($rows[0].PSObject.Properties['NameMethod']) 'new column present'
}

# ---- weak hints: reverse lookup and forward lookup of the allowlist --------
Test-Case 'reverse hints: names from an injected PTR resolver are cleaned, empty answers are skipped, the number of lookups is capped' {
    $calls = 0
    $res = { param($ip) $script:revCalls++; if ($ip -eq '198.51.100.1') { @('Host-1.Example.NET.') } else { @() } }
    $script:revCalls = 0
    $m = Get-ReverseNameMap -Ips @('198.51.100.1', '198.51.100.2', '198.51.100.3') -Resolver $res -Max 2
    Assert-Equal (@(Get-HostNames $m '198.51.100.1') -join ',') 'host-1.example.net' ''
    Assert-Equal @(Get-HostNames $m '198.51.100.2').Count 0 ''
    Assert-Equal $script:revCalls 2 'capped at 2'
}
Test-Case 'reverse hints: a failing resolver does not stop the run' {
    $m = Get-ReverseNameMap -Ips @('198.51.100.1') -Resolver { param($ip) throw 'boom' }
    Assert-Equal $m.Count 0 ''
}
Test-Case 'forward hints: exact allowlist hosts are resolved; wildcards and IP literals are not' {
    $asked = @()
    $res = { param($n) $script:fwdAsked += $n; if ($n -eq 'api.notion.com') { @('104.18.1.1', '::ffff:104.18.1.2') } else { @() } }
    $script:fwdAsked = @()
    $m = Get-ForwardNameMap -List $list -Resolver $res
    Assert-Equal (@(Get-HostNames $m '104.18.1.1') -join ',') 'api.notion.com' ''
    Assert-Equal (@(Get-HostNames $m '104.18.1.2') -join ',') 'api.notion.com' 'mapped address normalised'
    Assert-True (-not (@($script:fwdAsked) | Where-Object { "$_".Contains('*') -or $_ -match '^\d+\.\d+\.\d+\.\d+$' })) 'no wildcard or IP literal was resolved'
}
Test-Case 'forward hints: no allowlist gives an empty map' {
    Assert-Equal (Get-ForwardNameMap -List $null -Resolver { param($n) @('1.2.3.4') }).Count 0 ''
}

# ---- Node code: NODE_DEBUG=net text -----------------------------------------
$nodeLines = @(
    '[main 2026-11-13T12:56:46.117Z] [AgentHost:stderr] NET 40864: connect: find host mobile.events.data.microsoft.com',
    '[main 2026-11-13T12:56:46.181Z] [AgentHost:stderr] NET 40864: connect: attempting to connect to 20.184.175.17:443 (addressType: 4)',
    '[24684:1113/215646.575:INFO:CONSOLE:39] "%c  ERR color: #f33 [Extension Host] NET 5188: connect: find host default.exp-tas.com", source: vscode-file://vscode-app/x.js (39)',
    '[24684:1113/215646.575:INFO:CONSOLE:721] "%c[Extension Host] %cNET 5188: connect: find host default.exp-tas.com color: blue color: ", source: x',
    '[24684:1113/215646.581:INFO:CONSOLE:39] "%c  ERR color: #f33 [Extension Host] NET 5188: connect: find host exp.individual.githubcopilot.com", source: x',
    '[24684:1113/215646.584:INFO:CONSOLE:39] "%c  ERR color: #f33 [Extension Host] NET 5188: connect: attempting to connect to 13.107.5.93:443 (addressType: 4)", source: x',
    '[24684:1113/215646.584:INFO:CONSOLE:721] "%c[Extension Host] %cNET 5188: connect: attempting to connect to 13.107.5.93:443 (addressType: 4) color: blue", source: x',
    '%cNET 5188: connect: attempting to connect to 52.175.140.176:443 (addressType: 4)',
    'NET 5188: _read - n 16384 isConnecting? false hasHandle? true',
    'NET 77: connect: find host a.example.com',
    'NET 77: connect: find host b.example.com',
    'NET 77: connect: attempting to connect to 203.0.113.5:443 (addressType: 4)'
)
$nd = Get-NodeDebugInfo $nodeLines
Test-Case 'node debug: host names are cut at the end of the name (no quote or comma from a console echo) and lower-cased' {
    Assert-True $nd.Hosts.ContainsKey('default.exp-tas.com') ''
    Assert-True (-not (@($nd.Hosts.Keys) | Where-Object { $_ -match '[",\s]' })) 'no stray characters'
}
Test-Case 'node debug: a repeated echo of the same line counts once per pid' {
    Assert-Equal $nd.Hosts['default.exp-tas.com'].Lookups 1 ''
}
Test-Case 'node debug: same number of hosts and addresses in one pid -> paired in order of appearance' {
    Assert-Equal (@(Get-HostNames $nd.Map '13.107.5.93') -join ',') 'default.exp-tas.com' ''
    Assert-Equal (@(Get-HostNames $nd.Map '52.175.140.176') -join ',') 'exp.individual.githubcopilot.com' ''
    Assert-Equal (@(Get-HostNames $nd.Map '20.184.175.17') -join ',') 'mobile.events.data.microsoft.com' ''
}
Test-Case 'node debug: different counts in one pid -> every host of that pid is a candidate' {
    Assert-Equal (@(Get-HostNames $nd.Map '203.0.113.5') -join ',') 'a.example.com,b.example.com' ''
}
Test-Case 'node debug: lines about other things are ignored; no input gives empty results; the port is the connect port' {
    Assert-Equal (Get-NodeDebugInfo @('NET 1: close handle', '')).Hosts.Count 0 ''
    Assert-Equal $nd.Hosts['default.exp-tas.com'].Port 443 ''
}
Test-Case 'node debug file: lines are read from disk, others are dropped; none gives null' {
    $f = Join-Path ([IO.Path]::GetTempPath()) ("nd-" + [guid]::NewGuid().ToString('N') + '.txt')
    try {
        Set-Content -LiteralPath $f -Value (@('unrelated') + $nodeLines) -Encoding UTF8
        $r = Read-NodeDebugFiles @($f, (Join-Path ([IO.Path]::GetTempPath()) 'no-such-file.txt'))
        Assert-True $r.Hosts.ContainsKey('a.example.com') ''
        Set-Content -LiteralPath $f -Value 'unrelated' -Encoding UTF8
        Assert-True ($null -eq (Read-NodeDebugFiles @($f))) 'no connect lines'
    }
    finally { Remove-Item -LiteralPath $f -Force -ErrorAction SilentlyContinue }
}

# ---- hosts seen by name ------------------------------------------------------
Test-Case 'named hosts: net log and Node lookups are merged per host; each host is checked against the allowlist by itself' {
    $nodeHosts = @{ 'api.notion.com' = [pscustomobject]@{ Lookups = 1; Pids = @(5); Port = 443 }; 'tracker.example.net' = [pscustomobject]@{ Lookups = 2; Pids = @(5, 6); Port = 443 } }
    $logHosts = @{ 'api.notion.com' = [pscustomobject]@{ Requests = 3; Resolutions = 4; Answered = $true; Port = 443 }; 'telemetry.example.com' = [pscustomobject]@{ Requests = 1; Resolutions = 1; Answered = $true; Port = 443 } }
    $rows = @(New-DestinationRows -State (New-StateFrom) -DnsMap $dnsMap -Previous $null -List $list)
    $r = @(New-NamedHostRows -Hosts $logHosts -NodeHosts $nodeHosts -Rows $rows -List $list -ProcessName 'Code.exe')
    Assert-Equal $r.Count 3 ''
    $n = $r | Where-Object { $_.Host -eq 'api.notion.com' }
    Assert-Equal $n.SeenBy 'netlog+node' ''
    Assert-True $n.Allowed ''
    Assert-True $n.SeenInSampling 'its name is in a destination row'
    Assert-Equal $n.Requests 3 ''
    Assert-Equal $n.NodeLookups 1 ''
    $t = $r | Where-Object { $_.Host -eq 'tracker.example.net' }
    Assert-Equal $t.SeenBy 'node' ''
    Assert-True (-not $t.Allowed) ''
    Assert-True (-not $t.SeenInSampling) ''
    Assert-Equal $r[0].Host 'api.notion.com' 'most requests first'
}
Test-Case 'named hosts: no net log and no Node output gives no rows' {
    Assert-Equal @(New-NamedHostRows -Hosts $null -NodeHosts $null -Rows @() -List $list -ProcessName 'Code.exe').Count 0 ''
}
Test-Case 'markdown: has the "name from" column, the hint, the by-name table and the by-name unlisted entry' {
    $st = @{}
    Update-Observations -State $st -Connections @((New-Conn 10 '13.107.5.93'), (New-Conn 10 '198.51.100.99')) -ProcessIndex $index -ClaudeIds $claudeIds -Elapsed 2 -Time $tA -SampleIndex 1
    $weak = [pscustomobject]@{ Method = 'rdns'; Map = @{ '198.51.100.99' = @('hint.example.net') }; Weak = $true }
    $rows = @(New-DestinationRows -State $st -DnsMap @{} -Previous $null -List $list -ExtraMaps @([pscustomobject]@{ Method = 'netlog'; Map = $nlMap; Weak = $false }, $weak))
    $named = @(New-NamedHostRows -Hosts $nl.Hosts -NodeHosts $null -Rows $rows -List $list -ProcessName 'Code.exe')
    $meta = [pscustomobject]@{ Label = 't'; Exe = 'x'; DurationSeconds = 60; IntervalSeconds = 2; Samples = 1; NetLogEvents = 12; NetLogComplete = $true; NetLogPath = 'C:\b\p0\netlog\x.json'; DnsEntries = 0 }
    $md = (New-AuditMarkdown -Meta $meta -Rows $rows -HasPrevious $false -AllowlistInfo ([pscustomobject]@{ Missing = $false }) -NetLogHostRows $named) -join "`n"
    Assert-True ($md -match '\| name from \|') 'column'
    Assert-True ($md -match 'hint only: hint\.example\.net \[rdns\]') 'hint'
    Assert-True ($md -match 'Hosts seen by name') 'section'
    Assert-True ($md -match '\[by name: netlog\] marketplace\.visualstudio\.com') 'unlisted by name'
    Assert-True ($md -match 'net log: 12 events, complete') 'meta line'
    Assert-True ($md -notmatch 'WARNING: Get-DnsClientCache') 'empty DNS cache is only a note when the net log is there'
}
Test-Case 'markdown: without a net log an empty DNS cache is still a warning; an unreadable net log is a warning' {
    $meta = [pscustomobject]@{ Label = 't'; Exe = 'x'; DurationSeconds = 60; IntervalSeconds = 2; Samples = 1; DnsEntries = 0; NetLogPath = 'C:\b\p0\netlog\x.json'; NetLogEvents = 0 }
    $md = (New-AuditMarkdown -Meta $meta -Rows @() -HasPrevious $false -AllowlistInfo ([pscustomobject]@{ Missing = $false })) -join "`n"
    Assert-True ($md -match 'WARNING: Get-DnsClientCache') ''
    Assert-True ($md -match 'WARNING: the net log is missing or empty') ''
}

Write-Host ''
Write-Host ("passed: {0}  failed: {1}" -f $script:Pass, $script:Fail)
exit $script:Fail
