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

Write-Host ''
Write-Host ("passed: {0}  failed: {1}" -f $script:Pass, $script:Fail)
exit $script:Fail
