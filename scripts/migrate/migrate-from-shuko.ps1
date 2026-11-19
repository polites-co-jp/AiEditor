<#
.SYNOPSIS
  Copies the daily Shuko data to the places of Sukuna (the rename, decisions 2026-11-18 "rename steps"
  and "rename permissions"; plan: tasks/2026-11-18-rename-sukuna-survey/rename-plan.md 3.2, 4 (2a-4);
  guards: tasks/2026-11-18-rename-sukuna-survey/permission-requests.md 1.5).

.DESCRIPTION
  This is the only script that still names the old places after the rename.

  What it copies (byte for byte; it never opens, decrypts or hashes a file):
    appdata  %APPDATA%\Shuko\            -> %APPDATA%\Sukuna\
             except the top-level entries Cache, CachedData, Code Cache, GPUCache, CachedExtensionVSIXs,
             logs, Crashpad, clp, languagepacks.json, code.lock (rebuilt by the editor, or pointing at the
             old version folders; code.lock is the running-instance lock of electron-main/main.ts).
             Folders User\globalStorage\shuko.<name> are written as User\globalStorage\sukuna.<name>
             (the built-in extensions changed their publisher; notion-sync keeps its sync-base.json).
    argv     %USERPROFILE%\.shuko\argv.json -> %USERPROFILE%\.sukuna\argv.json (this one file only)
    watch    %LOCALAPPDATA%\Shuko\watch\  -> %LOCALAPPDATA%\Sukuna\watch\   (state.json, notion-token.dpapi, ...)
    secrets  %LOCALAPPDATA%\Shuko\secrets\ -> %LOCALAPPDATA%\Sukuna\secrets\ (when it exists)
  %LOCALAPPDATA%\Shuko\local.json is not copied (configure.ps1 writes the new one).

  Guards:
    - Never writes, moves or deletes anything under the old places. Never deletes anything at all.
    - Stops without writing (exit 3) when Shuko or Sukuna is running, when a destination already has
      content (appdata, watch, secrets: the folder must be absent or empty; argv: the file must be absent),
      when a path would be too long (no long paths on this PC), or when a source has a reparse point or
      an unreadable folder.
    - On a failure in the middle it stops, deletes nothing, and prints what it created (exit 1).
      Cleaning up is for the user (the destinations are outside the team's delete permission).
    - Output: one JSON object on stdout with kinds, relative names, existence, counts and sizes only.
      No file content and no hash of any file. Messages go to stderr. No log file.

  Usage:
    (no -List / -Apply)  prints the usage to stderr, writes nothing, exit 2
    -List                plans only: what would be copied and what blocks it; writes nothing
    -Apply               copies (only when nothing blocks), then checks the copies by count and size
    -SandboxRoot <dir>   trials and tests: the three bases become
                           USERPROFILE  = <dir>\Users\sandbox
                           APPDATA      = <dir>\Users\sandbox\AppData\Roaming
                           LOCALAPPDATA = <dir>\Users\sandbox\AppData\Local
                         and the running check looks only at <LOCALAPPDATA>\Programs\Shuko|Sukuna of the
                         sandbox (never at the real ones, so a running daily editor does not matter).
                         <dir> must be <buildRoot>\trial-<name> or below it (buildRoot of local.json).
    -ConfigPath <file>   only with -SandboxRoot: the local.json that gives buildRoot (tests).

  Exit codes: 0 ok, 1 failed in the middle (or the check after the copy differs), 2 usage, 3 blocked
  (nothing written).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/migrate/migrate-from-shuko.ps1 -List
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/migrate/migrate-from-shuko.ps1 -Apply
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/migrate/migrate-from-shuko.ps1 -SandboxRoot tmp/b/trial-migrate -List

  NOTE: this file is ASCII only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
  NOTE: no [CmdletBinding()] on purpose: unknown arguments land in $args and are refused with exit 2.
#>
param(
    [switch]$List,
    [switch]$Apply,
    [string]$SandboxRoot,
    [string]$ConfigPath
)

$ErrorActionPreference = 'Stop'
if ([Console]::IsOutputRedirected) { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) }

$script:OldName = 'Shuko'
$script:NewName = 'Sukuna'
$script:OldDot = '.shuko'
$script:NewDot = '.sukuna'
$script:OldExtPrefix = 'shuko.'
$script:NewExtPrefix = 'sukuna.'
$script:ExcludedTop = @('Cache', 'CachedData', 'Code Cache', 'GPUCache', 'CachedExtensionVSIXs', 'logs', 'Crashpad', 'clp', 'languagepacks.json', 'code.lock')
$script:MaxFile = 259   # MAX_PATH 260 minus the terminating NUL
$script:MaxDir = 247    # CreateDirectory needs room for an 8.3 name

function Write-Msg { param([string]$Text) [Console]::Error.WriteLine("[migrate-from-shuko] $Text") }

function Show-Usage {
    $u = @(
        'usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/migrate/migrate-from-shuko.ps1 -List | -Apply [-SandboxRoot <dir> [-ConfigPath <local.json>]]',
        '  -List   plan only (writes nothing)   -Apply  copy (only when nothing blocks)',
        '  copies %APPDATA%\Shuko -> %APPDATA%\Sukuna (no caches/logs), ~\.shuko\argv.json -> ~\.sukuna\argv.json,',
        '  %LOCALAPPDATA%\Shuko\watch|secrets -> %LOCALAPPDATA%\Sukuna\watch|secrets. Exit: 0 ok, 1 failed, 2 usage, 3 blocked.'
    )
    foreach ($l in $u) { [Console]::Error.WriteLine($l) }
}

function Exit-Usage { param([string]$Text) if ($Text) { Write-Msg $Text }; Show-Usage; exit 2 }

function Write-Result {
    param($Obj, [int]$Code)
    [Console]::Out.WriteLine(($Obj | ConvertTo-Json -Depth 12))
    exit $Code
}

function New-List { return , (New-Object System.Collections.Generic.List[object]) }

# ---------------------------------------------------------------------------
# Arguments
# ---------------------------------------------------------------------------

if ($args.Count -gt 0) { Exit-Usage "unknown argument: $($args -join ' ')" }
if (-not $List -and -not $Apply) { Exit-Usage '' }
if ($List -and $Apply) { Exit-Usage '-List and -Apply cannot be used together' }
if ($ConfigPath -and -not $SandboxRoot) { Exit-Usage '-ConfigPath is only for -SandboxRoot' }

$sandbox = [bool]$SandboxRoot
$displayPrefixes = @()   # (prefix, label) pairs, longest first
if ($sandbox) {
    $sb = $SandboxRoot
    if (-not [IO.Path]::IsPathRooted($sb)) { $sb = Join-Path (Get-Location).Path $sb }
    $sb = [IO.Path]::GetFullPath($sb).TrimEnd('\', '/')
    try {
        . (Join-Path $PSScriptRoot '..\lib\local-config.ps1')
        $cfg = Resolve-SukunaLocalConfig -ConfigPath $ConfigPath
    } catch {
        Exit-Usage "cannot resolve buildRoot: $($_.Exception.Message)"
    }
    $br = ([string]$cfg.buildRoot).TrimEnd('\', '/')
    $ok = $false
    if ($sb.Length -gt $br.Length + 1 -and $sb.StartsWith($br + '\', [StringComparison]::OrdinalIgnoreCase)) {
        $first = $sb.Substring($br.Length + 1).Split('\')[0]
        if ($first -match '^trial-.+') { $ok = $true }
    }
    if (-not $ok) { Exit-Usage "SandboxRoot must be <buildRoot>\trial-<name> or below it (buildRoot: $br): $sb" }
    $baseHome = Join-Path $sb 'Users\sandbox'
    $baseAppData = Join-Path $baseHome 'AppData\Roaming'
    $baseLocal = Join-Path $baseHome 'AppData\Local'
    $displayPrefixes = @(, @($sb, '<sandbox>'))
} else {
    foreach ($n in @('APPDATA', 'USERPROFILE', 'LOCALAPPDATA')) {
        if (-not [Environment]::GetEnvironmentVariable($n)) { Exit-Usage "environment variable $n is not set" }
    }
    $baseAppData = $env:APPDATA.TrimEnd('\')
    $baseHome = $env:USERPROFILE.TrimEnd('\')
    $baseLocal = $env:LOCALAPPDATA.TrimEnd('\')
    $displayPrefixes = @(@($baseAppData, '%APPDATA%'), @($baseLocal, '%LOCALAPPDATA%'), @($baseHome, '%USERPROFILE%')) |
        Sort-Object { $_[0].Length } -Descending
}

function Show-Path {
    param([string]$Full)
    foreach ($p in $displayPrefixes) {
        $pre = $p[0]
        if ($Full.Equals($pre, [StringComparison]::OrdinalIgnoreCase)) { return $p[1] }
        if ($Full.StartsWith($pre + '\', [StringComparison]::OrdinalIgnoreCase)) { return $p[1] + $Full.Substring($pre.Length) }
    }
    return $Full
}

$oldRoots = @(
    (Join-Path $baseAppData $script:OldName),
    (Join-Path $baseHome $script:OldDot),
    (Join-Path $baseLocal $script:OldName)
)

# ---------------------------------------------------------------------------
# Reading the trees (names, kinds and sizes only)
# ---------------------------------------------------------------------------

function Get-Tree {
    <# Entries under $Root (relative names with '\'), without descending into reparse points or into the
       top-level names in $SkipTop. Returns @{ entries; skipped; problems }. #>
    param([string]$Root, [string[]]$SkipTop = @())
    $entries = New-List
    $skipped = New-List
    $problems = New-List
    $stack = New-Object System.Collections.Generic.Stack[string]
    $stack.Push('')
    while ($stack.Count -gt 0) {
        $rel = $stack.Pop()
        if ($rel) { $dirFull = [IO.Path]::Combine($Root, $rel) } else { $dirFull = $Root }
        try {
            $infos = (New-Object System.IO.DirectoryInfo($dirFull)).GetFileSystemInfos()
        } catch {
            $problems.Add([pscustomobject]@{ name = $rel; problem = 'unreadable'; message = $_.Exception.Message })
            continue
        }
        foreach ($e in $infos) {
            if ($rel) { $r = $rel + '\' + $e.Name } else { $r = $e.Name }
            $isDir = [bool]($e.Attributes -band [IO.FileAttributes]::Directory)
            if (-not $rel -and ($SkipTop | Where-Object { $_ -ieq $e.Name })) {
                $t = 'file'; if ($isDir) { $t = 'dir' }
                $skipped.Add([pscustomobject]@{ name = $e.Name; type = $t })
                continue
            }
            $isRp = [bool]($e.Attributes -band [IO.FileAttributes]::ReparsePoint)
            $bytes = [long]0
            if (-not $isDir) { $bytes = [long]$e.Length }
            $entries.Add([pscustomobject]@{ rel = $r; full = $e.FullName; isDir = $isDir; bytes = $bytes })
            if ($isRp) {
                $problems.Add([pscustomobject]@{ name = $r; problem = 'reparsePoint'; message = 'reparse point (junction or link); not copied' })
            } elseif ($isDir) {
                $stack.Push($r)
            }
        }
    }
    return @{ entries = $entries; skipped = $skipped; problems = $problems }
}

function Get-DirState {
    param([string]$Path)
    if ([IO.File]::Exists($Path)) { return 'notEmpty' }
    if (-not [IO.Directory]::Exists($Path)) { return 'absent' }
    if ([IO.Directory]::GetFileSystemEntries($Path).Length -gt 0) { return 'notEmpty' }
    return 'empty'
}

function Convert-AppDataRel {
    <# User\globalStorage\shuko.<name>[\...] -> User\globalStorage\sukuna.<name>[\...] #>
    param([string]$Rel)
    $m = [regex]::Match($Rel, '^(User\\globalStorage\\)(' + [regex]::Escape($script:OldExtPrefix) + ')([^\\]+)(\\.*)?$', 'IgnoreCase')
    if (-not $m.Success) { return $Rel }
    return $m.Groups[1].Value + $script:NewExtPrefix + $m.Groups[3].Value + $m.Groups[4].Value
}

function New-Plan {
    param([string]$Kind, [string]$Src, [string]$Dst, [bool]$IsFile)
    $p = [ordered]@{
        kind = $Kind; from = (Show-Path $Src); to = (Show-Path $Dst)
        sourceExists = $false; destState = 'absent'
        files = 0; dirs = 0; bytes = [long]0
        entries = (New-List); excluded = (New-List); renamed = (New-List)
    }
    if ($Kind -eq 'appdata') { $p.userFiles = (New-List) }
    $items = New-List
    $problems = New-List
    if ($IsFile) {
        $p.sourceExists = [IO.File]::Exists($Src)
        if ([IO.File]::Exists($Dst) -or [IO.Directory]::Exists($Dst)) { $p.destState = 'exists' }
        if ($p.sourceExists) {
            $len = [long](New-Object System.IO.FileInfo($Src)).Length
            $items.Add([pscustomobject]@{ rel = [IO.Path]::GetFileName($Src); src = $Src; dst = $Dst; isDir = $false; bytes = $len })
            $p.files = 1; $p.bytes = $len
            $p.entries.Add([pscustomobject]@{ name = [IO.Path]::GetFileName($Src); type = 'file'; bytes = $len })
        }
    } else {
        $p.sourceExists = [IO.Directory]::Exists($Src)
        $p.destState = Get-DirState $Dst
        if ($p.sourceExists) {
            $skip = @()
            if ($Kind -eq 'appdata') { $skip = $script:ExcludedTop }
            $tree = Get-Tree -Root $Src -SkipTop $skip
            foreach ($s in $tree.skipped) { $p.excluded.Add($s) }
            foreach ($x in $tree.problems) { $problems.Add($x) }
            $renamedSeen = @{}
            $top = [ordered]@{}
            $userAgg = [ordered]@{}
            foreach ($e in $tree.entries) {
                $rel = $e.rel
                if ($Kind -eq 'appdata') {
                    $rel = Convert-AppDataRel $e.rel
                    if ($rel -ne $e.rel) {
                        $seg = ($e.rel.Split('\')[0..2]) -join '\'
                        if (-not $renamedSeen.ContainsKey($seg)) {
                            $renamedSeen[$seg] = $true
                            $p.renamed.Add([pscustomobject]@{ from = $seg; to = (($rel.Split('\')[0..2]) -join '\') })
                        }
                    }
                }
                $items.Add([pscustomobject]@{ rel = $rel; src = $e.full; dst = [IO.Path]::Combine($Dst, $rel); isDir = $e.isDir; bytes = $e.bytes })
                if ($e.isDir) { $p.dirs++ } else { $p.files++; $p.bytes += $e.bytes }
                # appdata: summary by top-level entry; watch / secrets: every file (name and size)
                if ($Kind -eq 'appdata') {
                    $segs = $e.rel.Split('\')
                    $t = $segs[0]
                    if (-not $top.Contains($t)) { $top[$t] = [ordered]@{ name = $t; type = 'file'; files = 0; bytes = [long]0 } }
                    if ($e.rel -eq $t -and $e.isDir) { $top[$t].type = 'dir' }
                    if (-not $e.isDir) { $top[$t].files++; $top[$t].bytes += $e.bytes }
                    # files under User\ one by one (name and size), except the two big folders, which are summed
                    if (-not $e.isDir -and $segs.Count -ge 2 -and $t -ieq 'User') {
                        $sub = $segs[1]
                        if ($segs.Count -ge 3 -and ($sub -ieq 'workspaceStorage' -or $sub -ieq 'History')) {
                            $key = 'User\' + $sub
                            if (-not $userAgg.Contains($key)) { $userAgg[$key] = [ordered]@{ name = $key; type = 'dir'; files = 0; bytes = [long]0 } }
                            $userAgg[$key].files++; $userAgg[$key].bytes += $e.bytes
                        } else {
                            $p.userFiles.Add([pscustomobject]@{ name = $e.rel; type = 'file'; bytes = $e.bytes })
                        }
                    }
                } elseif (-not $e.isDir) {
                    $p.entries.Add([pscustomobject]@{ name = $e.rel; type = 'file'; bytes = $e.bytes })
                }
            }
            foreach ($k in $top.Keys) { $p.entries.Add([pscustomobject]$top[$k]) }
            foreach ($k in $userAgg.Keys) { $p.userFiles.Add([pscustomobject]$userAgg[$k]) }
        }
    }
    return @{ plan = $p; items = $items; problems = $problems; src = $Src; dst = $Dst; isFile = $IsFile }
}

# ---------------------------------------------------------------------------
# Running editors
# ---------------------------------------------------------------------------

function Get-RunningEditors {
    param([string[]]$Roots, [string[]]$Names)
    $prefixes = @($Roots | ForEach-Object { $_.TrimEnd('\') + '\' })
    $hits = New-List
    foreach ($pr in @(Get-CimInstance Win32_Process -ErrorAction Stop)) {
        $exe = [string]$pr.ExecutablePath
        $byName = $Names -and ($Names | Where-Object { $_ -ieq [string]$pr.Name })
        $byPath = $exe -and ($prefixes | Where-Object { $exe.StartsWith($_, [StringComparison]::OrdinalIgnoreCase) })
        if ($byName -or $byPath) {
            $hits.Add([pscustomobject]@{ pid = [int]$pr.ProcessId; name = [string]$pr.Name; path = (Show-Path $exe) })
        }
    }
    return , $hits
}

# ---------------------------------------------------------------------------
# Plan
# ---------------------------------------------------------------------------

$mode = 'list'
if ($Apply) { $mode = 'apply' }
$result = [ordered]@{
    tool = 'migrate-from-shuko'; mode = $mode; sandbox = $sandbox; result = 'ok'; written = $false
    running = (New-List); blockers = (New-List); locations = (New-List); writtenTo = (New-List)
}

$specs = @(
    @('appdata', (Join-Path $baseAppData $script:OldName), (Join-Path $baseAppData $script:NewName), $false),
    @('argv', (Join-Path (Join-Path $baseHome $script:OldDot) 'argv.json'), (Join-Path (Join-Path $baseHome $script:NewDot) 'argv.json'), $true),
    @('watch', (Join-Path (Join-Path $baseLocal $script:OldName) 'watch'), (Join-Path (Join-Path $baseLocal $script:NewName) 'watch'), $false),
    @('secrets', (Join-Path (Join-Path $baseLocal $script:OldName) 'secrets'), (Join-Path (Join-Path $baseLocal $script:NewName) 'secrets'), $false)
)
$plans = @()
try {
    foreach ($s in $specs) {
        $pl = New-Plan -Kind $s[0] -Src $s[1] -Dst $s[2] -IsFile $s[3]
        $plans += , $pl
        $result.locations.Add($pl.plan)
    }
} catch {
    $result.result = 'failed'
    $result.error = "cannot read the sources: $($_.Exception.Message)"
    Write-Result $result 1
}

# running check
$progRoots = @((Join-Path (Join-Path $baseLocal 'Programs') $script:OldName), (Join-Path (Join-Path $baseLocal 'Programs') $script:NewName))
$exeNames = @()
if (-not $sandbox) { $exeNames = @(($script:OldName + '.exe'), ($script:NewName + '.exe')) }
try {
    $running = Get-RunningEditors -Roots $progRoots -Names $exeNames
    foreach ($r in $running) { $result.running.Add($r) }
    if ($running.Count -gt 0) {
        $result.blockers.Add([pscustomobject]@{ kind = 'running'; detail = "Shuko or Sukuna is running ($($running.Count) process(es)); close every window and retry" })
    }
} catch {
    $result.blockers.Add([pscustomobject]@{ kind = 'runningUnknown'; detail = "cannot list the processes: $($_.Exception.Message)" })
}

foreach ($pl in $plans) {
    $p = $pl.plan
    if ($pl.items.Count -eq 0) { continue }
    if ($pl.isFile) {
        if ($p.destState -ne 'absent') { $result.blockers.Add([pscustomobject]@{ kind = 'destNotEmpty'; location = $p.kind; detail = "$($p.to) already exists" }) }
    } elseif ($p.destState -eq 'notEmpty') {
        $result.blockers.Add([pscustomobject]@{ kind = 'destNotEmpty'; location = $p.kind; detail = "$($p.to) is not empty" })
    }
    foreach ($x in $pl.problems) {
        $result.blockers.Add([pscustomobject]@{ kind = $x.problem; location = $p.kind; detail = "$($x.name): $($x.message)" })
    }
    $long = 0
    foreach ($it in $pl.items) {
        $lim = $script:MaxFile; if ($it.isDir) { $lim = $script:MaxDir }
        if ($it.src.Length -gt $lim -or $it.dst.Length -gt $lim) {
            $long++
            if ($long -le 20) { $result.blockers.Add([pscustomobject]@{ kind = 'pathTooLong'; location = $p.kind; detail = "$($it.rel) ($($it.dst.Length) characters at the destination)" }) }
        }
    }
    if ($long -gt 20) { $result.blockers.Add([pscustomobject]@{ kind = 'pathTooLong'; location = $p.kind; detail = "... and $($long - 20) more" }) }
}

if ($result.blockers.Count -gt 0) { $result.result = 'blocked' }
if ($List -or $result.blockers.Count -gt 0) {
    $code = 0; if ($result.blockers.Count -gt 0) { $code = 3 }
    Write-Result $result $code
}

# ---------------------------------------------------------------------------
# Apply
# ---------------------------------------------------------------------------

$created = New-List   # display paths of the folders and files this run created

function Assert-NotOld {
    param([string]$Path)
    foreach ($o in $oldRoots) {
        if ($Path.Equals($o, [StringComparison]::OrdinalIgnoreCase) -or $Path.StartsWith($o + '\', [StringComparison]::OrdinalIgnoreCase)) {
            throw "refusing to write under an old place: $(Show-Path $Path)"
        }
    }
}

function New-DirChain {
    param([string]$Path)
    if ([IO.Directory]::Exists($Path)) { return }
    $missing = New-Object System.Collections.Generic.Stack[string]
    $d = $Path
    while ($d -and -not [IO.Directory]::Exists($d)) { $missing.Push($d); $d = [IO.Path]::GetDirectoryName($d) }
    while ($missing.Count -gt 0) {
        $m = $missing.Pop()
        Assert-NotOld $m
        [void][IO.Directory]::CreateDirectory($m)
        $created.Add((Show-Path $m))
    }
}

$copied = New-List
try {
    foreach ($pl in $plans) {
        if ($pl.items.Count -eq 0) { continue }
        $result.written = $true
        $result.writtenTo.Add($pl.plan.to)
        if ($pl.isFile) { New-DirChain ([IO.Path]::GetDirectoryName($pl.dst)) } else { New-DirChain $pl.dst }
        # folders first (keeps empty folders), then files
        foreach ($it in ($pl.items | Where-Object { $_.isDir } | Sort-Object { $_.rel.Length })) { New-DirChain $it.dst }
        foreach ($it in ($pl.items | Where-Object { -not $_.isDir })) {
            New-DirChain ([IO.Path]::GetDirectoryName($it.dst))
            Assert-NotOld $it.dst
            [IO.File]::Copy($it.src, $it.dst, $false)
            $created.Add((Show-Path $it.dst))
        }
        # check by count and size (the destination was absent or empty, so it holds only these copies)
        $mism = New-List
        $gotFiles = 0; $gotDirs = 0; $gotBytes = [long]0
        if ($pl.isFile) {
            $gotFiles = 1
            $gotBytes = [long](New-Object System.IO.FileInfo($pl.dst)).Length
            if ($gotBytes -ne $pl.items[0].bytes) { $mism.Add([pscustomobject]@{ name = $pl.items[0].rel; sourceBytes = $pl.items[0].bytes; destBytes = $gotBytes }) }
        } else {
            $want = @{}
            foreach ($it in $pl.items) { if (-not $it.isDir) { $want[$it.rel.ToLowerInvariant()] = $it } }
            $t = Get-Tree -Root $pl.dst
            foreach ($e in $t.entries) {
                if ($e.isDir) { $gotDirs++; continue }
                $gotFiles++; $gotBytes += $e.bytes
                $w = $want[$e.rel.ToLowerInvariant()]
                if (-not $w) { $mism.Add([pscustomobject]@{ name = $e.rel; sourceBytes = $null; destBytes = $e.bytes }) }
                elseif ($w.bytes -ne $e.bytes) { $mism.Add([pscustomobject]@{ name = $e.rel; sourceBytes = $w.bytes; destBytes = $e.bytes }) }
            }
        }
        $ok = ($mism.Count -eq 0) -and ($gotFiles -eq $pl.plan.files) -and ($gotBytes -eq $pl.plan.bytes) -and ($pl.isFile -or $gotDirs -eq $pl.plan.dirs)
        $copied.Add([pscustomobject]@{
                kind = $pl.plan.kind; files = $gotFiles; dirs = $gotDirs; bytes = $gotBytes
                expectedFiles = $pl.plan.files; expectedDirs = $pl.plan.dirs; expectedBytes = $pl.plan.bytes
                verified = $ok; mismatches = $mism
            })
    }
} catch {
    $result.result = 'failed'
    $result.error = $_.Exception.Message
    $result.copied = $copied
    $result.createdCount = $created.Count
    $result.created = @($created | Select-Object -First 200)
    Write-Msg 'stopped in the middle; nothing was deleted. The created folders and files are listed in "created"; the user removes them before a retry.'
    Write-Result $result 1
}

$result.copied = $copied
$result.createdCount = $created.Count
if (@($copied | Where-Object { -not $_.verified }).Count -gt 0) {
    $result.result = 'failed'
    $result.error = 'the copies differ from the sources by count or size (see copied)'
    $result.created = @($created | Select-Object -First 200)
    Write-Result $result 1
}
Write-Result $result 0
