<#
.SYNOPSIS
  Memory measurement script (docs/07 section 3.1-3.4). Fixed in Phase 0, used from then on.

.DESCRIPTION
  Measure mode (default):
    For each run: copy the env template to a fresh data dir, start the editor, wait,
    open two files with the CLI (-r), wait for the folderOpen task, wait, collect
    Win32_Process for the editor process tree, stop the tree, wait.
    The first -Warmup runs are recorded but not counted. -Runs runs are counted.

  Compare mode (-Baseline <dir> -Candidate <dir>):
    Reads two output dirs and writes the pass/fail verdict of docs/07 3.4.

  Dot-source this file to load only the functions (no side effects):
    . scripts\measure.ps1

  NOTE: this file is ASCII only on purpose. Windows PowerShell 5.1 reads a BOM-less
  script as the ANSI code page, so non-ASCII text would be garbled.
#>
[CmdletBinding()]
param(
    [string]$Exe,
    [string]$EnvDir,
    [string]$Workspace,   # default <repo>\tmp\ws, decided in the body ($PSScriptRoot is empty in a 5.1 param default under -File)
    [string[]]$OpenFiles,
    [string]$Label,
    [int]$Runs = 5,
    [int]$Warmup = 1,
    [string]$OutDir,
    [switch]$Milestone,
    [int]$LaunchWaitSeconds = 30,
    [int]$SettleSeconds = 120,
    [int]$StopWaitSeconds = 10,
    [string]$WorkRoot = 'C:\b\p0\run',
    [string]$ProcessName,
    [string]$DefaultsNote,
    [switch]$KeepData,
    [switch]$CleanStale,          # delete run dirs left under -WorkRoot (alone: only clean and exit)
    [string]$StaleFilter = '*',   # name filter for -CleanStale, e.g. 'trial-*'
    [switch]$Force,
    [switch]$SkipTaskCheck,
    [string]$Baseline,
    [string]$Candidate,
    [string]$Metric = 'PrivateExclClaude'
)

# ---------------------------------------------------------------------------
# Pure functions (tested by tests\measure.tests.ps1; no machine access)
# ---------------------------------------------------------------------------

function Get-ProcessRole {
    <# Role of one process from Name and CommandLine. Returns a short string. #>
    param([string]$Name, [string]$CommandLine)
    $n = ''
    if ($Name) { $n = $Name.ToLowerInvariant() }
    $c = ''
    if ($CommandLine) { $c = $CommandLine }

    if ($n -eq 'claude.exe') { return 'claude-cli' }
    if ($n -eq 'copilot-runtime.exe') { return 'copilot-runtime' }
    if ($c -match '(?i)extensionHost') { return 'extension-host' }
    if ($c -match '(?i)ptyHost') { return 'pty-host' }
    if ($c -match '(?i)fileWatcher|parcelWatcher') { return 'file-watcher' }
    if ($c -match '(?i)shared-?process') { return 'shared-process' }
    if ($c -match '(?i)tsserver|typingsInstaller') { return 'ts-server' }
    if ($c -match '(?i)pyright|pylance') { return 'language-server' }
    # server scripts are given with or without the extension (1.146.0: ...\jsonServerMain --node-ipc)
    if ($c -match '(?i)language-?server|[\\/][A-Za-z0-9_-]*server(main)?(\.[cm]?js)?("|\s|$)') { return 'language-server' }

    $m = [regex]::Match($c, '--type=([A-Za-z0-9_-]+)')
    if ($m.Success) {
        $t = $m.Groups[1].Value.ToLowerInvariant()
        switch ($t) {
            'renderer' { return 'renderer' }
            'gpu-process' { return 'gpu' }
            'crashpad-handler' { return 'crashpad' }
            'utility' {
                $s = [regex]::Match($c, '--utility-sub-type=([^\s"]+)')
                $sub = ''
                if ($s.Success) { $sub = $s.Groups[1].Value.ToLowerInvariant() }
                if ($sub -like '*network*') { return 'utility-network' }
                if ($sub -like '*audio*') { return 'utility-audio' }
                if ($sub -like '*nodeservice*') { return 'utility-node' }
                return 'utility-other'
            }
            default { return ('type-' + $t) }
        }
    }

    if ($n -in @('powershell.exe', 'pwsh.exe', 'cmd.exe', 'bash.exe', 'wsl.exe', 'sh.exe')) { return 'shell' }
    if ($n -in @('conhost.exe', 'openconsole.exe')) { return 'console-host' }
    if ($n -eq 'node.exe') { return 'node-other' }
    # The editor main process is the one started with the data-dir flags (step 1).
    if ($c -match '--(user-data-dir|extensions-dir)') { return 'main' }
    return 'other'
}

function Get-RoleMap {
    <#
      Role of every process of a tree: pid -> role. First the role from Name/CommandLine
      (Get-ProcessRole), then a second pass for what the command line cannot tell
      (1.146.0: extension host, ptyHost, agent host and others are all
      --type=utility --utility-sub-type=node.mojom.NodeService).
      Clues that stay in the CSV:
        extension-host : --inspect-port=0 in the command line
        agent-host     : a child copilot-runtime.exe
        pty-host       : a child shell (powershell, cmd ...) or console host (OpenConsole, conhost)
        shared-process : a child file-watcher (inferred; only when none of the above fits)
      Only processes whose first-pass role is utility-node are refined; the rest keep their role.
      Sources: optional hashtable filled with pid -> commandline | child | inferred (C-1: an
      inferred role must stay recognisable as a guess).
    #>
    param($Tree, $Sources = $null)
    $roles = @{}
    $kids = @{}
    if ($null -eq $Sources) { $Sources = @{} }
    foreach ($p in $Tree) {
        $roles[[int]$p.ProcessId] = Get-ProcessRole -Name $p.Name -CommandLine $p.CommandLine
        $Sources[[int]$p.ProcessId] = 'commandline'
    }
    foreach ($p in $Tree) {
        $pp = [int]$p.ParentProcessId
        if (-not $kids.ContainsKey($pp)) { $kids[$pp] = @() }
        $kids[$pp] += [int]$p.ProcessId
    }
    foreach ($p in $Tree) {
        $id = [int]$p.ProcessId
        if ($roles[$id] -ne 'utility-node') { continue }
        $cl = ''
        if ($p.CommandLine) { $cl = [string]$p.CommandLine }
        $childRoles = @()
        if ($kids.ContainsKey($id)) { foreach ($k in $kids[$id]) { $childRoles += $roles[$k] } }
        # Source of each decision: commandline = read from the command line, child = from a child process,
        # inferred = a guess with no observed case behind it (shared-process: NOT confirmed on a real run).
        if ($cl -match '--inspect-port=0') { $roles[$id] = 'extension-host'; $Sources[$id] = 'commandline'; continue }
        if ($childRoles -contains 'copilot-runtime') { $roles[$id] = 'agent-host'; $Sources[$id] = 'child'; continue }
        if (($childRoles -contains 'shell') -or ($childRoles -contains 'console-host')) { $roles[$id] = 'pty-host'; $Sources[$id] = 'child'; continue }
        if ($childRoles -contains 'file-watcher') { $roles[$id] = 'shared-process'; $Sources[$id] = 'inferred'; continue }
    }
    return $roles
}

function Get-Descendants {
    <#
      Processes under RootIds (roots included), breadth first.
      Guards: cycles (visited set) and PID reuse (a child created before its
      "parent" is not a child, when both have CreationDate).
    #>
    param($Processes, [int[]]$RootIds)
    $byId = @{}
    $children = @{}
    foreach ($p in $Processes) {
        $byId[[int]$p.ProcessId] = $p
    }
    foreach ($p in $Processes) {
        $ppid = [int]$p.ParentProcessId
        if (-not $children.ContainsKey($ppid)) { $children[$ppid] = New-Object System.Collections.ArrayList }
        [void]$children[$ppid].Add($p)
    }
    $visited = @{}
    $result = New-Object System.Collections.ArrayList
    $queue = New-Object System.Collections.Queue
    foreach ($r in $RootIds) {
        if ($byId.ContainsKey([int]$r) -and -not $visited.ContainsKey([int]$r)) {
            $visited[[int]$r] = $true
            $queue.Enqueue($byId[[int]$r])
        }
    }
    while ($queue.Count -gt 0) {
        $cur = $queue.Dequeue()
        [void]$result.Add($cur)
        $cid = [int]$cur.ProcessId
        if ($children.ContainsKey($cid)) {
            foreach ($ch in $children[$cid]) {
                $chid = [int]$ch.ProcessId
                if ($visited.ContainsKey($chid)) { continue }
                $curDate = $cur.PSObject.Properties['CreationDate']
                $chDate = $ch.PSObject.Properties['CreationDate']
                if ($curDate -and $chDate -and $curDate.Value -and $chDate.Value) {
                    if ($chDate.Value -lt $curDate.Value) { continue }
                }
                $visited[$chid] = $true
                $queue.Enqueue($ch)
            }
        }
    }
    # No leading comma: callers wrap the call in @() (a comma would nest the array).
    return $result.ToArray()
}

function Split-ClaudeSubtree {
    <# Splits a process tree into claude.exe + its descendants, and the rest. #>
    param($Tree)
    $claudeRoots = @()
    foreach ($p in $Tree) {
        if ($p.Name -and ($p.Name -ieq 'claude.exe')) { $claudeRoots += [int]$p.ProcessId }
    }
    $claude = @()
    if ($claudeRoots.Count -gt 0) {
        $claude = @(Get-Descendants -Processes $Tree -RootIds $claudeRoots)
    }
    $ids = @{}
    foreach ($p in $claude) { $ids[[int]$p.ProcessId] = $true }
    $editor = @()
    foreach ($p in $Tree) {
        if (-not $ids.ContainsKey([int]$p.ProcessId)) { $editor += $p }
    }
    return [pscustomobject]@{ Claude = @($claude); Editor = @($editor); ClaudeIds = $ids }
}

function Get-PropertySum {
    param($Items, [string]$Property)
    $sum = [double]0
    foreach ($i in $Items) {
        $v = $i.$Property
        if ($null -ne $v -and "$v" -ne '') { $sum += [double]$v }
    }
    return $sum
}

function Get-ProcessTotals {
    <# The four totals of docs/07 3.2 (6 and 7). Input: the editor process tree. #>
    param($Tree)
    $s = Split-ClaudeSubtree -Tree $Tree
    return [pscustomobject]@{
        PrivateInclClaude    = (Get-PropertySum $Tree 'PrivatePageCount')
        PrivateExclClaude    = (Get-PropertySum $s.Editor 'PrivatePageCount')
        WorkingSetInclClaude = (Get-PropertySum $Tree 'WorkingSetSize')
        WorkingSetExclClaude = (Get-PropertySum $s.Editor 'WorkingSetSize')
        ProcessCount         = @($Tree).Count
        ClaudeProcessCount   = @($s.Claude).Count
    }
}

function New-ProcessRows {
    <# One row per process, with role and claude flag, for the per-process CSV. #>
    param($Tree, [string]$RunName)
    $s = Split-ClaudeSubtree -Tree $Tree
    $sources = @{}
    $roleMap = Get-RoleMap -Tree $Tree -Sources $sources
    $rows = @()
    foreach ($p in $Tree) {
        $rows += [pscustomobject][ordered]@{
            Run             = $RunName
            ProcessId       = [int]$p.ProcessId
            ParentProcessId = [int]$p.ParentProcessId
            Name            = $p.Name
            Role            = $roleMap[[int]$p.ProcessId]
            RoleSource      = $sources[[int]$p.ProcessId]
            Extension       = $(if ($roleMap[[int]$p.ProcessId] -eq 'language-server') { Get-ExtensionFolder -CommandLine $p.CommandLine } else { '' })
            InClaudeSubtree = $s.ClaudeIds.ContainsKey([int]$p.ProcessId)
            PrivateBytes    = [double]$p.PrivatePageCount
            WorkingSetBytes = [double]$p.WorkingSetSize
            CommandLine     = $p.CommandLine
        }
    }
    return ,@($rows)
}

function Get-Median {
    param([double[]]$Values)
    if (-not $Values -or $Values.Count -eq 0) { return $null }
    $sorted = @($Values | Sort-Object)
    $n = $sorted.Count
    if ($n % 2 -eq 1) { return [double]$sorted[($n - 1) / 2] }
    return ([double]$sorted[$n / 2 - 1] + [double]$sorted[$n / 2]) / 2
}

function Get-RangeInfo {
    <# Median, Min, Max, Range (max - min), Count. #>
    param([double[]]$Values)
    if (-not $Values -or $Values.Count -eq 0) { return $null }
    $mn = [double]($Values | Measure-Object -Minimum).Minimum
    $mx = [double]($Values | Measure-Object -Maximum).Maximum
    return [pscustomobject]@{
        Count  = $Values.Count
        Median = (Get-Median $Values)
        Min    = $mn
        Max    = $mx
        Range  = ($mx - $mn)
    }
}

function Get-MeasureVerdict {
    <#
      docs/07 3.4: pass when the candidate median is strictly smaller than the
      baseline median. If the reduction is smaller than the range, still a pass
      but WithinRange is true and the note says so.
      "Range" for that check = the larger of the two ranges (decision: docs does
      not say which range).
    #>
    param([double[]]$BaselineValues, [double[]]$CandidateValues)
    if (-not $BaselineValues -or $BaselineValues.Count -eq 0) { throw 'baseline has no values' }
    if (-not $CandidateValues -or $CandidateValues.Count -eq 0) { throw 'candidate has no values' }
    $b = Get-RangeInfo $BaselineValues
    $c = Get-RangeInfo $CandidateValues
    $diff = $b.Median - $c.Median
    $pass = ($diff -gt 0)
    $maxRange = [Math]::Max($b.Range, $c.Range)
    $within = ($pass -and ($diff -lt $maxRange))
    $note = ''
    if ($pass -and $within) {
        $note = 'Pass, but the reduction is smaller than the run-to-run range. Recorded as required by docs/07 3.4.'
    } elseif ($pass) {
        $note = 'Pass. The reduction is larger than the range.'
    } elseif ($diff -eq 0) {
        $note = 'Fail. The medians are equal (must be strictly smaller).'
    } else {
        $note = 'Fail. The candidate median is larger than the baseline median.'
    }
    return [pscustomobject]@{
        Pass            = $pass
        BaselineMedian  = $b.Median
        CandidateMedian = $c.Median
        Reduction       = $diff
        ReductionPct    = $(if ($b.Median -ne 0) { 100 * $diff / $b.Median } else { 0 })
        BaselineRange   = $b.Range
        CandidateRange  = $c.Range
        WithinRange     = $within
        BaselineCount   = $b.Count
        CandidateCount  = $c.Count
        Note            = $note
    }
}

function Find-MainProcesses {
    <# Main processes of the editor started with this data dir (not --type=...). #>
    param($Processes, [string]$ExeName, [string]$UserDir)
    $res = @()
    foreach ($p in $Processes) {
        if (-not $p.Name -or ($p.Name -ine $ExeName)) { continue }
        $cl = $p.CommandLine
        if (-not $cl) { continue }
        if ($cl.IndexOf('--type=', [StringComparison]::OrdinalIgnoreCase) -ge 0) { continue }
        if ($cl.IndexOf($UserDir, [StringComparison]::OrdinalIgnoreCase) -lt 0) { continue }
        $res += $p
    }
    return $res
}

function Assert-SafeDataPath {
    <# Refuses paths that look like the daily editor data. Throws on unsafe. #>
    param([string]$Path)
    $full = [IO.Path]::GetFullPath($Path).TrimEnd('\')
    $bad = @()
    if ($env:APPDATA) { $bad += $env:APPDATA.TrimEnd('\') }
    if ($env:USERPROFILE) {
        $bad += (Join-Path $env:USERPROFILE '.vscode')
        $bad += (Join-Path $env:USERPROFILE '.vscode-oss')
        $bad += (Join-Path $env:USERPROFILE '.shuko')
    }
    foreach ($b in $bad) {
        $bb = $b.TrimEnd('\')
        if ($full -ieq $bb -or $full.StartsWith($bb + '\', [StringComparison]::OrdinalIgnoreCase)) {
            throw "refusing to use a path under the daily editor data: $full"
        }
    }
    return $full
}

function Get-DefaultWorkspace {
    <# <repo>\tmp\ws (decision 2026-11-13). Decided here, not in a param default. #>
    $root = $PSScriptRoot
    if (-not $root) { $root = Split-Path -Parent $PSCommandPath }
    return (Join-Path (Split-Path $root -Parent) 'tmp\ws')
}

function Get-DefaultOpenFiles {
    <# The two files chosen by p0-ws.ps1 (openFilesFull in ws-info.json), or an empty array. #>
    param([string]$InfoPath = 'C:\b\p0\ws-info.json')
    if (-not (Test-Path -LiteralPath $InfoPath)) { return @() }
    try {
        $o = Get-Content -LiteralPath $InfoPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($o.openFilesFull) { return @($o.openFilesFull | ForEach-Object { "$_" }) }
    } catch { }
    return @()
}

function Resolve-OpenFiles {
    <#
      Windows PowerShell 5.1 with -File passes "a,b" as ONE string (not an array), so every
      element is split on ',' here. Relative paths are taken from the workspace.
      Returns @{ Files (full paths); Errors; Warnings }. Errors: not exactly 2 files, or a file is missing.
      Warnings: the two are not one TS (.ts/.tsx) and one Python (.py) file (docs/07 3.2 step 2).
    #>
    param($Files, [string]$Workspace)
    $parts = @()
    foreach ($f in @($Files)) {
        if ($null -eq $f) { continue }
        foreach ($s in ("$f" -split ',')) {
            $t = $s.Trim().Trim('"')
            if ($t) { $parts += $t }
        }
    }
    $full = @()
    foreach ($p in $parts) {
        if ([IO.Path]::IsPathRooted($p)) { $full += $p } else { $full += (Join-Path $Workspace $p) }
    }
    $errors = @()
    $warnings = @()
    if ($full.Count -ne 2) { $errors += "need exactly 2 files to open (a TS file and a Python file), got $($full.Count): $($parts -join ' | ')" }
    foreach ($p in $full) {
        if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { $errors += "file to open not found: $p" }
    }
    if ($full.Count -eq 2) {
        $ts = @($full | Where-Object { $_ -match '\.(ts|tsx)$' }).Count
        $py = @($full | Where-Object { $_ -match '\.py$' }).Count
        if ($ts -ne 1 -or $py -ne 1) { $warnings += 'the two files are not one TS (.ts/.tsx) and one Python (.py) file' }
    }
    return [pscustomobject]@{ Files = $full; Errors = $errors; Warnings = $warnings }
}

function Format-MiB {
    param([double]$Bytes)
    return ('{0:N1} MiB' -f ($Bytes / 1MB))
}

# ---------------------------------------------------------------------------
# Machine-touching functions (checked by the trial run, not by unit tests)
# ---------------------------------------------------------------------------

function Get-ProcessSnapshot {
    Get-CimInstance Win32_Process |
        Select-Object ProcessId, ParentProcessId, Name, CommandLine, PrivatePageCount, WorkingSetSize, CreationDate
}

$script:P0DefaultRunRoot = 'C:\b\p0\run'
$script:P0RunRootMarker = '.p0-run-root'

function Test-RunDirName {
    <# Names this script gives to run dirs: <label>-run-<n>, <label>-warmup-<n>, <label>-netaudit. #>
    param([string]$Name)
    return [bool]($Name -match '^.+-(run-\d+|warmup-\d+|netaudit)$')
}

function Test-RunDirShape {
    <# A run dir has user\ and ext\ (copied from the env template). #>
    param([string]$Path)
    return ((Test-Path -LiteralPath (Join-Path $Path 'user') -PathType Container) -and (Test-Path -LiteralPath (Join-Path $Path 'ext') -PathType Container))
}

function Test-CleanableRoot {
    <#
      D-1: only a work root this script owns may be cleaned: C:\b\p0\run (or below it), or a
      folder carrying the marker file .p0-run-root (written by New-RunDataDir into a work root
      it created or found empty). C:\b\p0 itself, a drive root, etc. are refused.
    #>
    param([string]$WorkRoot)
    $full = [IO.Path]::GetFullPath($WorkRoot).TrimEnd('\')
    $def = $script:P0DefaultRunRoot
    if ($full -ieq $def -or $full.StartsWith($def + '\', [StringComparison]::OrdinalIgnoreCase)) { return $true }
    return (Test-Path -LiteralPath (Join-Path $full $script:P0RunRootMarker))
}

function Get-ExtensionFolder {
    <# Folder name of the extension a language server belongs to, from its command line ('' if unknown). #>
    param([string]$CommandLine)
    if (-not $CommandLine) { return '' }
    $m = [regex]::Match($CommandLine, '(?i)[\\/](?:extensions|ext)[\\/]([^\\/"\s]+)[\\/]')
    if ($m.Success -and $m.Groups[1].Value -ine 'node_modules') { return $m.Groups[1].Value }
    return ''
}

function Find-StaleRunDirs {
    <#
      Direct subdirectories of WorkRoot (matching Filter) that no running process refers to
      (no command line contains the path): data of runs that were kept (-KeepData), stopped
      half way, or could not be removed. Only dirs with a run dir NAME (Test-RunDirName) and
      SHAPE (Test-RunDirShape) are listed, so nothing else in the work root can be touched.
      Reparse points are never listed.
    #>
    param([string]$WorkRoot, $Processes, [string]$Filter = '*')
    $root = Assert-SafeDataPath $WorkRoot
    if (-not (Test-Path -LiteralPath $root)) { return @() }
    $res = @()
    foreach ($d in @(Get-ChildItem -LiteralPath $root -Directory -Filter $Filter -ErrorAction SilentlyContinue)) {
        if ($d.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
        if (-not (Test-RunDirName $d.Name)) { continue }
        if (-not (Test-RunDirShape $d.FullName)) { continue }
        $busy = $false
        foreach ($p in $Processes) {
            $cl = $p.CommandLine
            if ($cl -and $cl.IndexOf($d.FullName, [StringComparison]::OrdinalIgnoreCase) -ge 0) { $busy = $true; break }
        }
        if (-not $busy) { $res += $d.FullName }
    }
    return $res
}

function Remove-RunDataDir {
    <# Removes one run dir; retries because a just-stopped process may still hold a file. $true when gone. #>
    param([string]$Path, [int]$Tries = 5)
    for ($i = 1; $i -le $Tries; $i++) {
        try { Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop } catch { }
        if (-not (Test-Path -LiteralPath $Path)) { return $true }
        Start-Sleep -Seconds 2
    }
    return $false
}

function Clear-StaleRunDirs {
    <# Lists (Delete = $false) or removes (Delete = $true) the stale run dirs. Returns the paths found. #>
    param([string]$WorkRoot, [string]$Filter = '*', [bool]$Delete = $false)
    if ($Delete -and -not (Test-CleanableRoot $WorkRoot)) {
        throw "refusing to delete under $WorkRoot : only C:\b\p0\run (or below it) or a work root with the marker file $($script:P0RunRootMarker) may be cleaned"
    }
    $found = @(Find-StaleRunDirs -WorkRoot $WorkRoot -Processes @(Get-ProcessSnapshot) -Filter $Filter)
    foreach ($f in $found) {
        if ($Delete) {
            if (Remove-RunDataDir -Path $f) { Write-Host "removed stale run dir: $f" }
            else { Write-Warning "could not remove stale run dir: $f" }
        }
    }
    return $found
}

function New-RunDataDir {
    <# Copies the env template (EnvDir\user, EnvDir\ext) to a brand-new dir under WorkRoot. #>
    param([string]$EnvDir, [string]$WorkRoot, [string]$Name)
    $tplUser = Join-Path $EnvDir 'user'
    $tplExt = Join-Path $EnvDir 'ext'
    if (-not (Test-Path -LiteralPath $tplUser)) { throw "env template has no user dir: $tplUser" }
    if (-not (Test-Path -LiteralPath $tplExt)) { throw "env template has no ext dir: $tplExt" }
    $workFull = Assert-SafeDataPath $WorkRoot
    [void](Assert-SafeDataPath $EnvDir)
    if (-not (Test-RunDirName $Name)) { throw "run dir name must look like <label>-run-<n>, <label>-warmup-<n> or <label>-netaudit: $Name" }
    # mark a work root that is new or empty as ours (never a non-empty folder such as C:\b\p0)
    $existed = Test-Path -LiteralPath $workFull
    $isEmpty = $existed -and -not (Get-ChildItem -LiteralPath $workFull -Force -ErrorAction SilentlyContinue | Select-Object -First 1)
    if (-not $existed) { New-Item -ItemType Directory -Force -Path $workFull | Out-Null }
    if (-not $existed -or $isEmpty) {
        Set-Content -LiteralPath (Join-Path $workFull $script:P0RunRootMarker) -Value 'work root of measure.ps1 / netaudit.ps1; -CleanStale may delete run dirs here' -Encoding ASCII
    }
    $root = Join-Path $workFull $Name
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
    $u = Join-Path $root 'user'
    $e = Join-Path $root 'ext'
    New-Item -ItemType Directory -Force -Path $u, $e | Out-Null
    foreach ($pair in @(@($tplUser, $u), @($tplExt, $e))) {
        & robocopy $pair[0] $pair[1] /E /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
        if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE): $($pair[0])" }
    }
    $global:LASTEXITCODE = 0
    return [pscustomobject]@{ Root = $root; User = $u; Ext = $e }
}

function Get-EditorArguments {
    <#
      Command line of the editor. Layout (written by p0-env.ps1): $User is the
      VSCODE_PORTABLE dir (argv.json inside), the user data is $User\user-data.
      In portable mode --user-data-dir is ignored by the editor, but it is passed
      anyway: it keeps the command line unique per run (used to find the main process).
    #>
    param([string]$User, [string]$Ext, [string]$Workspace, [string[]]$Files)
    $ud = Join-Path $User 'user-data'
    $a = '--user-data-dir "{0}" --extensions-dir "{1}"' -f $ud, $Ext
    if ($Files -and $Files.Count -gt 0) {
        $q = @()
        foreach ($f in $Files) {
            $p = $f
            if (-not [IO.Path]::IsPathRooted($p)) { $p = Join-Path $Workspace $p }
            $q += ('"{0}"' -f $p)
        }
        return ($a + ' -r ' + ($q -join ' '))
    }
    return ($a + (' "{0}"' -f $Workspace))
}

function Start-EditorProcess {
    <# Starts Exe with VSCODE_PORTABLE set (only for the child), then restores our own environment. #>
    param([string]$Exe, [string]$Arguments, [string]$Portable, [hashtable]$ExtraEnv = $null, [string]$StdoutFile = '', [string]$StderrFile = '')
    # ExtraEnv: more variables for the child only (netaudit.ps1 uses NODE_DEBUG=net). StdoutFile / StderrFile: redirect the child's output.
    # Variables inherited from a parent editor / Electron app would change how the child starts
    # (ELECTRON_RUN_AS_NODE=1 makes Code.exe run as plain node and exit with code 9 on --user-data-dir).
    $saved = @{}
    foreach ($item in @(Get-ChildItem Env:)) {
        if ($item.Name -match '^(ELECTRON_RUN_AS_NODE|ELECTRON_NO_ATTACH_CONSOLE|VSCODE_.*)$') { $saved[$item.Name] = $item.Value }
    }
    foreach ($k in $saved.Keys) { Remove-Item -LiteralPath ("Env:\" + $k) -ErrorAction SilentlyContinue }
    $env:VSCODE_PORTABLE = $Portable
    $extraSaved = @{}
    if ($ExtraEnv) {
        foreach ($k in $ExtraEnv.Keys) {
            $extraSaved[$k] = [Environment]::GetEnvironmentVariable($k, 'Process')
            [Environment]::SetEnvironmentVariable($k, [string]$ExtraEnv[$k], 'Process')
        }
    }
    try {
        $sp = @{ FilePath = $Exe; ArgumentList = $Arguments; PassThru = $true }
        if ($StdoutFile) { $sp['RedirectStandardOutput'] = $StdoutFile }
        if ($StderrFile) { $sp['RedirectStandardError'] = $StderrFile }
        return Start-Process @sp
    }
    finally {
        foreach ($k in $extraSaved.Keys) { [Environment]::SetEnvironmentVariable($k, $extraSaved[$k], 'Process') }
        Remove-Item Env:\VSCODE_PORTABLE -ErrorAction SilentlyContinue
        foreach ($k in $saved.Keys) { Set-Item -LiteralPath ("Env:\" + $k) -Value $saved[$k] }
    }
}

function Start-Editor {
    param([string]$Exe, [string]$User, [string]$Ext, [string]$Workspace)
    $args1 = Get-EditorArguments -User $User -Ext $Ext -Workspace $Workspace
    return Start-EditorProcess -Exe $Exe -Arguments $args1 -Portable $User
}

function Open-EditorFiles {
    <#
      Step 2: CLI -r hands a file to the running instance and exits.
      The files are opened ONE BY ONE with GapSeconds between them: with both in one -r call only
      the last one becomes visible, the other stays a background tab whose language is never
      activated (no language server). One at a time, each is shown for a while, so the
      TypeScript and the Python servers both start (checked on 1.146.0).
    #>
    param([string]$Exe, [string]$User, [string]$Ext, [string[]]$Files, [string]$Workspace, [int]$GapSeconds = 10)
    $i = 0
    foreach ($f in @($Files)) {
        $i++
        $args2 = Get-EditorArguments -User $User -Ext $Ext -Workspace $Workspace -Files @($f)
        $proc = Start-EditorProcess -Exe $Exe -Arguments $args2 -Portable $User
        if (-not $proc.WaitForExit(30000)) {
            try { Stop-Process -Id $proc.Id -Force } catch { }
        }
        if ($i -lt @($Files).Count -and $GapSeconds -gt 0) { Start-Sleep -Seconds $GapSeconds }
    }
}

function Get-DailyArgvState {
    <# State of the daily editor argv.json files, which a measured run must never read-create or change. #>
    param([string]$ProfileRoot = $env:USERPROFILE)
    $res = @()
    foreach ($d in @('.vscode', '.vscode-oss', '.shuko')) {
        $f = Join-Path $ProfileRoot "$d\argv.json"
        $e = Test-Path -LiteralPath $f
        $t = $null
        if ($e) { $t = (Get-Item -LiteralPath $f).LastWriteTimeUtc.ToString('o') }
        $res += [pscustomobject]@{ Path = $f; Exists = $e; LastWriteUtc = $t }
    }
    return $res
}

function Compare-DailyArgvState {
    <# Returns the list of paths that appeared or changed between two Get-DailyArgvState results. #>
    param($Before, $After)
    $bad = @()
    foreach ($a in $After) {
        $b = $Before | Where-Object { $_.Path -eq $a.Path } | Select-Object -First 1
        if (-not $b) { continue }
        if ($a.Exists -ne $b.Exists -or $a.LastWriteUtc -ne $b.LastWriteUtc) { $bad += $a.Path }
    }
    return $bad
}

function Read-P0EnvRecord {
    <# <EnvDir>\p0-env.json written by p0-env.ps1 (editor.exe, data.*, settings, argv, extensions[]). $null if absent. #>
    param([string]$EnvDir)
    $f = Join-Path $EnvDir 'p0-env.json'
    if (-not (Test-Path -LiteralPath $f)) { return $null }
    return (Get-Content -LiteralPath $f -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function Stop-EditorTree {
    <# Stops exactly the given processes, then waits until they are gone (max 20 s). #>
    param($Tree)
    foreach ($p in $Tree) {
        try { Stop-Process -Id ([int]$p.ProcessId) -Force -ErrorAction Stop } catch { }
    }
    $deadline = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $deadline) {
        $alive = 0
        foreach ($p in $Tree) {
            if (Get-Process -Id ([int]$p.ProcessId) -ErrorAction SilentlyContinue) { $alive++ }
        }
        if ($alive -eq 0) { break }
        Start-Sleep -Milliseconds 500
    }
}

function Test-FolderOpenTask {
    param([string]$Workspace)
    $f = Join-Path $Workspace '.vscode\tasks.json'
    if (-not (Test-Path -LiteralPath $f)) { return $false }
    $raw = Get-Content -LiteralPath $f -Raw
    return ($raw -match 'folderOpen')
}

function Get-WorkspaceInfo {
    param([string]$Workspace)
    $info = [ordered]@{ Path = $Workspace; Commit = $null; Dirty = $null }
    try {
        $c = (& git -C $Workspace rev-parse HEAD 2>$null)
        if ($LASTEXITCODE -eq 0) { $info.Commit = "$c".Trim() }
        $st = (& git -C $Workspace status --porcelain 2>$null)
        $info.Dirty = [bool]($st)
    } catch { }
    $global:LASTEXITCODE = 0
    return [pscustomobject]$info
}

function Get-PcState {
    <# Machine state at the start (docs/07 3.1 last row; 3.2 record). #>
    $s = [ordered]@{ CapturedAt = (Get-Date).ToString('o') }
    try {
        $os = Get-CimInstance Win32_OperatingSystem
        $s.OS = "$($os.Caption) $($os.Version)"
        $s.TotalMemoryMiB = [math]::Round($os.TotalVisibleMemorySize / 1024)
        $s.FreeMemoryMiB = [math]::Round($os.FreePhysicalMemory / 1024)
        $s.LastBoot = $os.LastBootUpTime.ToString('o')
    } catch { $s.OSError = "$_" }
    try {
        $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
        $s.Cpu = $cpu.Name
        $s.Cores = $cpu.NumberOfCores
        $s.LogicalProcessors = $cpu.NumberOfLogicalProcessors
    } catch { $s.CpuError = "$_" }
    try {
        $plan = (& powercfg /getactivescheme) -join ' '
        $s.PowerPlan = $plan.Trim()
    } catch { $s.PowerPlanError = "$_" }
    $global:LASTEXITCODE = 0
    try {
        $bat = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue
        if ($bat) { $s.Battery = "present; status=$($bat.BatteryStatus); charge=$($bat.EstimatedChargeRemaining)%" } else { $s.Battery = 'none' }
    } catch { }
    try {
        $all = @(Get-Process)
        $s.RunningProcessCount = $all.Count
        $top = $all | Sort-Object WorkingSet64 -Descending | Select-Object -First 15
        $s.TopProcessesByWorkingSet = @($top | ForEach-Object { '{0} (pid {1}) {2:N0} MiB' -f $_.ProcessName, $_.Id, ($_.WorkingSet64 / 1MB) })
    } catch { }
    return [pscustomobject]$s
}

function Write-DefaultsChanged {
    <# Copies the settings the env template carries; lists them in defaults-changed.md. #>
    param([string]$EnvDir, [string]$OutDir, [string]$Note)
    $dest = Join-Path $OutDir 'env-template'
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    $candidates = @(
        (Join-Path $EnvDir 'user\user-data\User\settings.json'),
        (Join-Path $EnvDir 'user\argv.json'),
        (Join-Path $EnvDir 'user\user-data\User\keybindings.json')
    )
    $rec = Join-Path $EnvDir 'p0-env.json'
    if (Test-Path -LiteralPath $rec) { Copy-Item -LiteralPath $rec -Destination (Join-Path $dest 'p0-env.json') -Force }
    $lines = @('# Changed defaults (from the env template)', '', "- env template: $EnvDir")
    if ($Note) { $lines += "- note: $Note" }
    $lines += ''
    $found = 0
    foreach ($c in $candidates) {
        if (Test-Path -LiteralPath $c) {
            $found++
            $leaf = (Split-Path $c -Parent | Split-Path -Leaf) + '_' + (Split-Path $c -Leaf)
            Copy-Item -LiteralPath $c -Destination (Join-Path $dest $leaf) -Force
            $lines += "## $c"
            $lines += '```json'
            $lines += (Get-Content -LiteralPath $c -Raw)
            $lines += '```'
            $lines += ''
        }
    }
    if ($found -eq 0) { $lines += '(no settings.json / argv.json found in the template)' }
    Set-Content -LiteralPath (Join-Path $OutDir 'defaults-changed.md') -Value $lines -Encoding UTF8
}

function Read-RunValues {
    <# Counted (not warmup) values of one metric from runs.csv of an output dir. #>
    param([string]$Dir, [string]$Metric)
    $f = Join-Path $Dir 'runs.csv'
    if (-not (Test-Path -LiteralPath $f)) { throw "runs.csv not found: $f" }
    $rows = @(Import-Csv -LiteralPath $f | Where-Object { $_.Kind -eq 'measured' })
    $vals = @()
    foreach ($r in $rows) {
        if (-not ($r.PSObject.Properties.Name -contains $Metric)) { throw "no column '$Metric' in $f" }
        $vals += [double]$r.$Metric
    }
    return ,@($vals)
}

function Invoke-Compare {
    param([string]$Baseline, [string]$Candidate, [string]$Metric, [string]$OutDir)
    $bv = Read-RunValues -Dir $Baseline -Metric $Metric
    $cv = Read-RunValues -Dir $Candidate -Metric $Metric
    $v = Get-MeasureVerdict -BaselineValues $bv -CandidateValues $cv
    if (-not $OutDir) { $OutDir = $Candidate }
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
    $result = [ordered]@{
        Metric = $Metric; Baseline = $Baseline; Candidate = $Candidate
        BaselineValues = $bv; CandidateValues = $cv; Verdict = $v
    }
    $result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $OutDir 'verdict.json') -Encoding UTF8
    $verdictWord = $(if ($v.Pass) { 'PASS' } else { 'FAIL' })
    $md = @(
        "# Verdict: $verdictWord",
        '',
        "- metric: $Metric (docs/07 3.4: private bytes total, claude.exe not included)",
        "- baseline: $Baseline  (n=$($v.BaselineCount))",
        "- candidate: $Candidate  (n=$($v.CandidateCount))",
        '',
        '| | median | range (max - min) |',
        '|---|---|---|',
        "| baseline | $(Format-MiB $v.BaselineMedian) | $(Format-MiB $v.BaselineRange) |",
        "| candidate | $(Format-MiB $v.CandidateMedian) | $(Format-MiB $v.CandidateRange) |",
        '',
        ('- reduction: {0} ({1:N2} %)' -f (Format-MiB $v.Reduction), $v.ReductionPct),
        "- within range: $($v.WithinRange)",
        "- note: $($v.Note)"
    )
    if ($v.BaselineCount -ne $v.CandidateCount) {
        $md += "- WARNING: the number of counted runs differs ($($v.BaselineCount) vs $($v.CandidateCount))."
    }
    Set-Content -LiteralPath (Join-Path $OutDir 'verdict.md') -Value $md -Encoding UTF8
    Write-Host ($md -join "`n")
    return $v
}

function Invoke-Measure {
    param(
        [string]$Exe, [string]$EnvDir, [string]$Workspace, [string[]]$OpenFiles, [string]$Label,
        [int]$Runs, [int]$Warmup, [string]$OutDir, [bool]$Milestone,
        [int]$LaunchWaitSeconds, [int]$SettleSeconds, [int]$StopWaitSeconds,
        [string]$WorkRoot, [string]$ProcessName, [string]$DefaultsNote,
        [bool]$KeepData, [bool]$Force, [bool]$SkipTaskCheck, [bool]$CleanStale = $false, [string]$StaleFilter = '*'
    )
    $ErrorActionPreference = 'Stop'
    $leftovers = @()
    if (-not $EnvDir -or -not (Test-Path -LiteralPath $EnvDir)) { throw "-EnvDir not found: $EnvDir" }
    if (-not $Exe) {
        # use the env record written by p0-env.ps1 (editor.exe)
        $rec = Read-P0EnvRecord $EnvDir
        if ($rec -and $rec.editor -and $rec.editor.exe) { $Exe = "$($rec.editor.exe)" }
    }
    if (-not $Exe -or -not (Test-Path -LiteralPath $Exe)) { throw "-Exe not found (and no p0-env.json with editor.exe): $Exe" }
    if (-not $Label) { throw '-Label is required' }
    if (-not $Workspace) { $Workspace = Get-DefaultWorkspace }
    if ($Runs -lt 1) { throw '-Runs must be 1 or more' }
    if (-not (Test-Path -LiteralPath $Workspace)) { throw "-Workspace not found: $Workspace" }
    if (-not $OpenFiles -or @($OpenFiles).Count -eq 0) { $OpenFiles = @(Get-DefaultOpenFiles) }
    $of = Resolve-OpenFiles -Files $OpenFiles -Workspace $Workspace
    foreach ($w in $of.Warnings) { Write-Warning $w }
    if ($of.Errors.Count -gt 0) { throw ("-OpenFiles: " + ($of.Errors -join '; ')) }
    $OpenFiles = $of.Files
    if (-not $ProcessName) { $ProcessName = [IO.Path]::GetFileName($Exe) }
    if (-not $SkipTaskCheck -and -not (Test-FolderOpenTask $Workspace)) {
        throw "workspace has no .vscode\tasks.json with runOn folderOpen (docs/07 3.2 step 3): $Workspace  (use -SkipTaskCheck to ignore)"
    }
    $repoRoot = Split-Path $PSScriptRoot -Parent
    if (-not $OutDir) { $OutDir = Join-Path $repoRoot ("records\measurements\{0}-{1}" -f (Get-Date -Format 'yyyy-MM-dd'), $Label) }
    if ((Test-Path -LiteralPath (Join-Path $OutDir 'runs.csv')) -and -not $Force) {
        throw "output already has runs.csv (use -Force to overwrite): $OutDir"
    }
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

    # data of earlier runs that were kept or stopped half way: clean them, or at least say so
    $stale = @(Clear-StaleRunDirs -WorkRoot $WorkRoot -Filter $StaleFilter -Delete $CleanStale)
    if ($stale.Count -gt 0 -and -not $CleanStale) {
        Write-Warning ("{0} stale run dir(s) under {1} (use -CleanStale to remove): {2}" -f $stale.Count, $WorkRoot, ($stale -join ', '))
    }

    $pc = Get-PcState
    $pc | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $OutDir 'pc-state.json') -Encoding UTF8
    Write-DefaultsChanged -EnvDir $EnvDir -OutDir $OutDir -Note $DefaultsNote
    $wsInfo = Get-WorkspaceInfo $Workspace
    $dailyBefore = @(Get-DailyArgvState)
    $ver = $null
    try { $ver = (Get-Item -LiteralPath $Exe).VersionInfo.ProductVersion } catch { }

    $runRows = @()
    $allProc = @()
    $total = $Warmup + $Runs
    for ($i = 1; $i -le $total; $i++) {
        $isWarm = ($i -le $Warmup)
        $runName = $(if ($isWarm) { "warmup-$i" } else { "run-$($i - $Warmup)" })
        Write-Host "[$runName] fresh data dir"
        $data = New-RunDataDir -EnvDir $EnvDir -WorkRoot $WorkRoot -Name "$Label-$runName"
        $started = Get-Date
        Write-Host "[$runName] start"
        $launched = Start-Editor -Exe $Exe -User $data.User -Ext $data.Ext -Workspace $Workspace
        try {
            Start-Sleep -Seconds $LaunchWaitSeconds
            Write-Host "[$runName] open files with -r"
            Open-EditorFiles -Exe $Exe -User $data.User -Ext $data.Ext -Files $OpenFiles -Workspace $Workspace
            if ($Milestone) {
                Read-Host "[$runName] MILESTONE: send the fixed sentence in the Claude Code panel, wait for the reply, then press Enter" | Out-Null
            }
            Write-Host "[$runName] settle $SettleSeconds s"
            Start-Sleep -Seconds $SettleSeconds

            $procs = @(Get-ProcessSnapshot)
            $main = @(Find-MainProcesses -Processes $procs -ExeName $ProcessName -UserDir $data.User)
            $rootIds = @($main | ForEach-Object { [int]$_.ProcessId })
            if ($rootIds.Count -eq 0) { $rootIds = @([int]$launched.Id) }
            $tree = @(Get-Descendants -Processes $procs -RootIds $rootIds)
            if ($tree.Count -eq 0) { throw "[$runName] no editor process found (the editor may have exited)" }

            $rows = New-ProcessRows -Tree $tree -RunName $runName
            $t = Get-ProcessTotals -Tree $tree
            $rows | Export-Csv -LiteralPath (Join-Path $OutDir "$runName-processes.csv") -NoTypeInformation -Encoding UTF8
            $allProc += $rows
            $runRows += [pscustomobject][ordered]@{
                Run                  = $runName
                Kind                 = $(if ($isWarm) { 'warmup' } else { 'measured' })
                StartedAt            = $started.ToString('o')
                PrivateExclClaude    = $t.PrivateExclClaude
                PrivateInclClaude    = $t.PrivateInclClaude
                WorkingSetExclClaude = $t.WorkingSetExclClaude
                WorkingSetInclClaude = $t.WorkingSetInclClaude
                ProcessCount         = $t.ProcessCount
                ClaudeProcessCount   = $t.ClaudeProcessCount
            }
            Write-Host ("[{0}] private (no claude) {1}, working set (no claude) {2}, processes {3}, claude {4}" -f $runName, (Format-MiB $t.PrivateExclClaude), (Format-MiB $t.WorkingSetExclClaude), $t.ProcessCount, $t.ClaudeProcessCount)
            # checkpoint so a crash keeps what was measured
            $runRows | Export-Csv -LiteralPath (Join-Path $OutDir 'runs.csv') -NoTypeInformation -Encoding UTF8
        }
        finally {
            Write-Host "[$runName] stop"
            $procs2 = @(Get-ProcessSnapshot)
            $m2 = @(Find-MainProcesses -Processes $procs2 -ExeName $ProcessName -UserDir $data.User)
            $ids2 = @($m2 | ForEach-Object { [int]$_.ProcessId })
            if ($ids2.Count -eq 0) { $ids2 = @([int]$launched.Id) }
            Stop-EditorTree -Tree (Get-Descendants -Processes $procs2 -RootIds $ids2)
            Start-Sleep -Seconds $StopWaitSeconds
            if ($KeepData) {
                Write-Warning "-KeepData: the data of this run stays at $($data.Root) (remove it with -CleanStale before the real measurement)"
                $leftovers += $data.Root
            }
            elseif (-not (Remove-RunDataDir -Path $data.Root)) {
                Write-Warning "could not remove $($data.Root)"
                $leftovers += $data.Root
            }
        }
    }

    # the daily editor argv.json must be neither created nor changed (VSCODE_PORTABLE keeps it out)
    $dailyAfter = @(Get-DailyArgvState)
    $dailyTouched = @(Compare-DailyArgvState -Before $dailyBefore -After $dailyAfter)
    if ($dailyTouched.Count -gt 0) { Write-Warning ("daily argv.json was created or changed: " + ($dailyTouched -join ', ')) }

    # roles table (sum per role, per run) and summary
    $allProc | Export-Csv -LiteralPath (Join-Path $OutDir 'processes-all.csv') -NoTypeInformation -Encoding UTF8
    $roleRows = @()
    foreach ($g in ($allProc | Group-Object Run, Role, RoleSource, Extension)) {
        $first = $g.Group[0]
        $roleRows += [pscustomobject][ordered]@{
            Run = $first.Run; Role = $first.Role; RoleSource = $first.RoleSource; Extension = $first.Extension; Count = $g.Count
            PrivateBytes = (Get-PropertySum $g.Group 'PrivateBytes')
            WorkingSetBytes = (Get-PropertySum $g.Group 'WorkingSetBytes')
        }
    }
    $roleRows | Export-Csv -LiteralPath (Join-Path $OutDir 'roles.csv') -NoTypeInformation -Encoding UTF8

    $measured = @($runRows | Where-Object { $_.Kind -eq 'measured' })
    $metrics = [ordered]@{}
    foreach ($m in @('PrivateExclClaude', 'PrivateInclClaude', 'WorkingSetExclClaude', 'WorkingSetInclClaude')) {
        $vals = @($measured | ForEach-Object { [double]$_.$m })
        $metrics[$m] = [pscustomobject]@{ Values = $vals; Stats = (Get-RangeInfo $vals) }
    }
    $summary = [ordered]@{
        DailyArgvTouched = $dailyTouched
        DailyArgvAfter = $dailyAfter
        RunDataLeftOver = $leftovers
        StaleRunDirsBefore = $stale
        Label = $Label; Exe = $Exe; ExeVersion = $ver; EnvDir = $EnvDir
        Workspace = $wsInfo; OpenFiles = $OpenFiles
        Warmup = $Warmup; Runs = $Runs; Milestone = $Milestone
        LaunchWaitSeconds = $LaunchWaitSeconds; SettleSeconds = $SettleSeconds; StopWaitSeconds = $StopWaitSeconds
        PrimaryMetric = 'PrivateExclClaude'
        Metrics = $metrics
    }
    $summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutDir 'summary.json') -Encoding UTF8

    $md = @("# Measurement: $Label", '',
        "- editor: $Exe ($ver)",
        "- env template: $EnvDir",
        "- workspace: $Workspace (commit $($wsInfo.Commit), dirty=$($wsInfo.Dirty))",
        "- files opened: $($OpenFiles -join ', ')",
        "- warm-up runs discarded: $Warmup; counted runs: $Runs; milestone: $Milestone",
        '- primary metric (docs/07 3.4): private bytes total, claude.exe and its descendants NOT included',
        "- daily argv.json (~\.vscode, ~\.vscode-oss, ~\.shuko) created or changed during the run: $(if ($dailyTouched.Count -gt 0) { 'YES - ' + ($dailyTouched -join ', ') } else { 'no' })", '',
        '| metric | median | min | max | range |', '|---|---|---|---|---|')
    foreach ($k in $metrics.Keys) {
        $st = $metrics[$k].Stats
        if ($st) { $md += "| $k | $(Format-MiB $st.Median) | $(Format-MiB $st.Min) | $(Format-MiB $st.Max) | $(Format-MiB $st.Range) |" }
    }
    $md += ''
    $md += '| run | kind | private (no claude) | private (with claude) | working set (no claude) | working set (with claude) | processes | claude procs |'
    $md += '|---|---|---|---|---|---|---|---|'
    foreach ($r in $runRows) {
        $md += "| $($r.Run) | $($r.Kind) | $(Format-MiB $r.PrivateExclClaude) | $(Format-MiB $r.PrivateInclClaude) | $(Format-MiB $r.WorkingSetExclClaude) | $(Format-MiB $r.WorkingSetInclClaude) | $($r.ProcessCount) | $($r.ClaudeProcessCount) |"
    }
    $md += ''
    $md += 'See also: runs.csv, run-N-processes.csv, roles.csv, defaults-changed.md, pc-state.json.'
    $md += 'To do by hand: one screenshot of the editor Process Explorer (not used for pass/fail; docs/07 3.2).'
    Set-Content -LiteralPath (Join-Path $OutDir 'summary.md') -Value $md -Encoding UTF8
    Write-Host ($md -join "`n")
    return $OutDir
}

# ---------------------------------------------------------------------------
# Entry point. Dot-sourcing (. scripts\measure.ps1) loads functions only.
# ---------------------------------------------------------------------------
if ($MyInvocation.InvocationName -eq '.') { return }

if ($Baseline -or $Candidate) {
    if (-not ($Baseline -and $Candidate)) { throw 'give both -Baseline and -Candidate' }
    $v = Invoke-Compare -Baseline $Baseline -Candidate $Candidate -Metric $Metric -OutDir $OutDir
    if ($v.Pass) { exit 0 } else { exit 1 }
}

if ($CleanStale -and -not $EnvDir) {
    # clean only: no editor is started
    $gone = @(Clear-StaleRunDirs -WorkRoot $WorkRoot -Filter $StaleFilter -Delete $true)
    Write-Host ("stale run dirs found: {0}" -f $gone.Count)
    exit 0
}

Invoke-Measure -Exe $Exe -EnvDir $EnvDir -Workspace $Workspace -OpenFiles $OpenFiles -Label $Label `
    -Runs $Runs -Warmup $Warmup -OutDir $OutDir -Milestone ([bool]$Milestone) `
    -LaunchWaitSeconds $LaunchWaitSeconds -SettleSeconds $SettleSeconds -StopWaitSeconds $StopWaitSeconds `
    -WorkRoot $WorkRoot -ProcessName $ProcessName -DefaultsNote $DefaultsNote `
    -KeepData ([bool]$KeepData) -Force ([bool]$Force) -SkipTaskCheck ([bool]$SkipTaskCheck) `
    -CleanStale ([bool]$CleanStale) -StaleFilter $StaleFilter | Out-Null
