<#
.SYNOPSIS
  Prepares the measurement workspace <repo>\tmp\ws (docs/07 2.1 and 3.2; decision 2026-11-13,
  first C:\b\p0\ws, then moved into the repo's git-ignored tmp\).

.DESCRIPTION
  The user clones E:\develop\kuebiko to <repo>\tmp\ws (this script does not clone). Then this script
    1. records the commit (git rev-parse HEAD), branch, origin and whether the tree is dirty,
    2. adds .vscode\tasks.json with one task that opens a terminal when the folder opens
       ("runOptions": {"runOn": "folderOpen"}). It never overwrites an existing tasks.json
       that is not ours (exit 3), and touches nothing else in the workspace,
    3. picks the two files the measurement opens with -r (one TypeScript, one Python):
       the largest tracked file of each kind up to 100 KB, outside node_modules/dist/build/out/vendor
       (override with -TsFile / -PyFile),
    4. writes C:\b\p0\ws-info.json (outside the workspace).

.EXAMPLE
  git clone E:\develop\kuebiko <repo>\tmp\ws      (by the user)
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-ws.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-ws.ps1 -TsFile src/app.ts -PyFile tools/run.py

  NOTE: this file is ASCII only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
#>
[CmdletBinding()]
param(
    [string]$Workspace,
    [string]$TsFile,
    [string]$PyFile,
    [string]$InfoPath = 'C:\b\p0\ws-info.json',
    [int]$MaxBytes = 102400
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\p0-common.ps1')

$TaskLabel = 'p0-open-terminal'

function Get-P0TasksJsonText {
    $o = [ordered]@{
        version = '2.0.0'
        tasks   = @(
            [ordered]@{
                label          = $TaskLabel
                type           = 'process'
                command        = 'powershell.exe'
                args           = @('-NoLogo', '-NoProfile')
                isBackground   = $true
                problemMatcher = @()
                presentation   = [ordered]@{ reveal = 'always'; panel = 'dedicated'; focus = $false }
                runOptions     = [ordered]@{ runOn = 'folderOpen' }
            }
        )
    }
    return (ConvertTo-P0Json $o)
}

function Select-P0File {
    <# Pure: from rows @{Path;Size}, the largest file matching $Pattern up to $Max bytes, not under excluded dirs. #>
    param($Rows, [string]$Pattern, [string]$NotPattern, [int]$Max)
    $ex = '(^|/)(node_modules|dist|build|out|vendor|\.venv|venv|site-packages|__pycache__)/'
    $c = @($Rows | Where-Object { $_.Path -match $Pattern -and -not ($NotPattern -and $_.Path -match $NotPattern) -and $_.Path -notmatch $ex -and $_.Size -le $Max } |
            Sort-Object -Property @{ Expression = 'Size'; Descending = $true }, @{ Expression = 'Path'; Descending = $false })
    return $c
}

if (-not $Workspace) { $Workspace = $script:P0Workspace }
$ws = [IO.Path]::GetFullPath($Workspace).TrimEnd('\')
$tmpRoot = [IO.Path]::GetFullPath((Join-Path $script:P0RepoRoot 'tmp')).TrimEnd('\')
if (-not $ws.StartsWith($tmpRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw "the workspace must be under $tmpRoot (git-ignored); got $ws"
}
if (-not (Test-Path -LiteralPath (Join-Path $ws '.git'))) {
    Write-Host "No clone at $ws."
    Write-Host 'The user clones it (decision 2026-11-13), for example:'
    Write-Host "  git clone E:\develop\kuebiko $ws"
    Write-Host 'then runs this script again.'
    exit 2
}

$head = Invoke-P0Native -FilePath 'git' -Arguments @('-C', $ws, 'rev-parse', 'HEAD')
if ($head.ExitCode -ne 0) { throw "git rev-parse failed: $($head.Output -join ' ')" }
$commit = ($head.Output | Select-Object -First 1).Trim()
$branch = ((Invoke-P0Native -FilePath 'git' -Arguments @('-C', $ws, 'rev-parse', '--abbrev-ref', 'HEAD')).Output | Select-Object -First 1)
$origin = ((Invoke-P0Native -FilePath 'git' -Arguments @('-C', $ws, 'remote', 'get-url', 'origin')).Output | Select-Object -First 1)

# tasks.json
$vsdir = Join-Path $ws '.vscode'
$tasks = Join-Path $vsdir 'tasks.json'
$tasksState = ''
if (Test-Path -LiteralPath $tasks) {
    $raw = [IO.File]::ReadAllText($tasks)
    if ($raw -match [regex]::Escape('"' + $TaskLabel + '"')) {
        $tasksState = 'already present (ours, left as is)'
    } else {
        Write-Error "$tasks exists and is not ours. Not touching it; merge the task by hand or ask the leader."
        exit 3
    }
} else {
    Write-P0Text -Path $tasks -Text ((Get-P0TasksJsonText) + "`r`n")
    $tasksState = 'added'
}

# dirty, ignoring our tasks.json
$st = Invoke-P0Native -FilePath 'git' -Arguments @('-C', $ws, 'status', '--porcelain', '--untracked-files=all')
$dirty = @($st.Output | Where-Object { $_ -and ($_ -notmatch '\.vscode/tasks\.json$') -and ($_ -notmatch '^\?\? \.vscode/$') })

# files
$ls = Invoke-P0Native -FilePath 'git' -Arguments @('-C', $ws, 'ls-files', '-z')
$paths = @((($ls.Output -join "`n") -split "`0") | ForEach-Object { $_.Trim("`n") } | Where-Object { $_ })
$rows = @()
foreach ($p in $paths) {
    $full = Join-Path $ws ($p -replace '/', '\')
    if (Test-Path -LiteralPath $full -PathType Leaf) { $rows += [pscustomobject]@{ Path = $p; Size = (Get-Item -LiteralPath $full).Length } }
}
$tsCand = @(Select-P0File -Rows $rows -Pattern '\.tsx?$' -NotPattern '\.d\.ts$' -Max $MaxBytes)
$pyCand = @(Select-P0File -Rows $rows -Pattern '\.py$' -NotPattern '(^|/)__init__\.py$' -Max $MaxBytes)
if (-not $TsFile) { if ($tsCand.Count -gt 0) { $TsFile = $tsCand[0].Path } else { Write-Warning 'no TypeScript file found' } }
if (-not $PyFile) { if ($pyCand.Count -gt 0) { $PyFile = $pyCand[0].Path } else { Write-Warning 'no Python file found' } }
foreach ($f in @($TsFile, $PyFile)) {
    if ($f -and -not (Test-Path -LiteralPath (Join-Path $ws ($f -replace '/', '\')))) { throw "file not in the workspace: $f" }
}

$vsFiles = @(Get-ChildItem -LiteralPath $vsdir -File -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
$info = [ordered]@{
    workspace       = $ws
    source          = $origin   # where the clone came from (git remote get-url origin, i.e. .git/config)
    commit          = $commit
    branch          = $branch
    origin          = $origin
    dirtyExceptTasks = @($dirty)
    tasksJson       = [ordered]@{ path = $tasks; state = $tasksState; label = $TaskLabel }
    vscodeFolder    = $vsFiles
    openFiles       = [ordered]@{ ts = $TsFile; py = $PyFile }
    openFilesFull   = @(@($TsFile, $PyFile) | Where-Object { $_ } | ForEach-Object { Join-Path $ws ($_ -replace '/', '\') })
    candidates      = [ordered]@{
        ts = @($tsCand | Select-Object -First 5 | ForEach-Object { [ordered]@{ path = $_.Path; bytes = $_.Size } })
        py = @($pyCand | Select-Object -First 5 | ForEach-Object { [ordered]@{ path = $_.Path; bytes = $_.Size } })
    }
    rule            = "largest tracked file up to $MaxBytes bytes; excluded dirs node_modules, dist, build, out, vendor, venv; .d.ts and __init__.py excluded"
    createdAt       = (Get-Date).ToString('o')
}
Write-P0Json -Path $InfoPath -Value $info
Write-Host "commit : $commit ($branch)"
Write-Host "tasks  : $tasks ($tasksState)"
Write-Host "open   : $TsFile , $PyFile"
Write-Host "info   : $InfoPath"
if ($dirty.Count -gt 0) { Write-Warning "workspace has other changes: $($dirty -join '; ')" }
