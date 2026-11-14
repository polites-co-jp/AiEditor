<#
.SYNOPSIS
  Phase 1 (docs/07 section 4): unpacks a built zip and starts the editor once in a separate place
  (VSCODE_PORTABLE), to see that it starts and where the user data, the extensions and argv.json go.

.DESCRIPTION
  1. Unpacks -Zip with %SystemRoot%\System32\tar.exe into -Dest (default C:\b\p1\<zip name>), unless
     -Dest already has the unpacked folder. -Dest must be under C:\b\p1.
  2. Finds exe / CLI / product.json (flat <top>\resources\app or versioned <top>\<commit10>\resources\app).
  3. Runs "<cli> --version" and starts "<exe> --new-window" with ELECTRON_RUN_AS_NODE,
     ELECTRON_NO_ATTACH_CONSOLE and every VSCODE_* removed and only VSCODE_PORTABLE=<Dest>\portable
     set (scripts\lib\p0-common.ps1 Invoke-P0WithEditorEnv). No --user-data-dir / --extensions-dir:
     the point is to see the editor's own portable defaults.
  4. Checks the process is alive after -CheckSeconds, waits -SmokeSeconds, lists the process tree,
     lists what appeared under the portable folder (user-data, extensions, argv.json), then stops
     exactly the started process and its descendants.
  5. Compares the daily editor data folders (%APPDATA%\Code, %APPDATA%\Code - OSS,
     %USERPROFILE%\.vscode, %USERPROFILE%\.vscode-oss, and %APPDATA%\<nameLong>,
     %USERPROFILE%\<dataFolderName>) before and after: exists + LastWriteTime of the folder only
     (nothing inside them is read or written).
  Writes JSON to stdout and to -OutFile.

  Exit code: 0 = started and stayed alive and no daily data folder changed, 1 = otherwise, 2 = bad arguments.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -Zip C:\b\dist\1.146.0-upstream.zip -OutFile tasks\x\launch-check.json
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -Root C:\b\wt\VSCode-win32-x64 -OutFile tasks\x\launch-check.json
    (-Root: start an editor folder in place instead of unpacking a zip; exactly one of -Zip / -Root)

  NOTE: ASCII only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
#>
[CmdletBinding()]
param(
    [string]$Zip,
    # Instead of -Zip: an editor folder that is already there (for example the gulp output
    # C:\b\wt\VSCode-win32-x64). It is started in place (read only); the portable folder goes to
    # -Dest (default C:\b\p1\<folder name>), never next to the editor. Must be under C:\b.
    [string]$Root,
    [string]$Dest,
    [int]$CheckSeconds = 10,
    [int]$SmokeSeconds = 15,
    [string]$OutFile
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\p0-common.ps1')

$p1Root = 'C:\b\p1'
$tar = Join-Path $env:SystemRoot 'System32\tar.exe'

function Assert-P1Path {
    param([Parameter(Mandatory)][string]$Path)
    $full = [IO.Path]::GetFullPath($Path).TrimEnd('\')
    if (-not $full.StartsWith($p1Root + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "refusing a path outside $p1Root : $full" }
    return $full
}

function Get-FolderStamp {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path) {
        $i = Get-Item -LiteralPath $Path -Force
        return [ordered]@{ path = $Path; exists = $true; lastWriteTime = $i.LastWriteTimeUtc.ToString('o') }
    }
    return [ordered]@{ path = $Path; exists = $false; lastWriteTime = $null }
}

if ([string]::IsNullOrEmpty($Zip) -eq [string]::IsNullOrEmpty($Root)) { [Console]::Error.WriteLine('give exactly one of -Zip and -Root'); exit 2 }
if ($Zip) {
    if (-not (Test-Path -LiteralPath $Zip)) { [Console]::Error.WriteLine("zip not found: $Zip"); exit 2 }
    $Zip = [IO.Path]::GetFullPath($Zip)
    if (-not $Dest) { $Dest = Join-Path $p1Root ([IO.Path]::GetFileNameWithoutExtension($Zip)) }
} else {
    if (-not (Test-Path -LiteralPath $Root)) { [Console]::Error.WriteLine("folder not found: $Root"); exit 2 }
    $Root = [IO.Path]::GetFullPath($Root).TrimEnd('\')
    if (-not $Root.StartsWith('C:\b\', [StringComparison]::OrdinalIgnoreCase)) { [Console]::Error.WriteLine("refusing a folder outside C:\b : $Root"); exit 2 }
    if (-not $Dest) { $Dest = Join-Path $p1Root (Split-Path -Leaf $Root) }
}
try { $Dest = Assert-P1Path $Dest } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 2 }

$result = [ordered]@{
    checkedAt = (Get-Date).ToString('o'); zip = $Zip; root = $Root; dest = $Dest
    unpack = $null; editor = $null; cliVersion = $null; portable = $null
    started = $null; dailyData = $null; result = 'error'; message = $null
}

function Write-Result {
    $json = ConvertTo-Json -InputObject $result -Depth 10
    if ($OutFile) {
        $dir = Split-Path -Parent ([IO.Path]::GetFullPath($OutFile))
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
        [IO.File]::WriteAllText([IO.Path]::GetFullPath($OutFile), $json + "`r`n", (New-Object System.Text.UTF8Encoding($false)))
    }
    Write-Output $json
}

try {
    # 1. unpack (or use -Root as it is)
    if ($Root) {
        if (-not (Test-Path -LiteralPath $Dest)) { New-Item -ItemType Directory -Force -Path $Dest | Out-Null }
        $result.unpack = [ordered]@{ done = $false; reason = 'started in place (-Root)' }
        $top = $Root
    } else {
        $t0 = Get-Date
        $tops = @()
        if (Test-Path -LiteralPath $Dest) { $tops = @(Get-ChildItem -LiteralPath $Dest -Directory | Where-Object { $_.Name -ne 'portable' }) }
        if ($tops.Count -eq 0) {
            New-Item -ItemType Directory -Force -Path $Dest | Out-Null
            $r = Invoke-P0Native -FilePath $tar -Arguments @('-x', '-f', $Zip, '-C', $Dest)
            if ($r.ExitCode -ne 0) { throw "tar.exe -x failed ($($r.ExitCode)): $($r.Output -join ' ')" }
            $tops = @(Get-ChildItem -LiteralPath $Dest -Directory | Where-Object { $_.Name -ne 'portable' })
            $result.unpack = [ordered]@{ done = $true; seconds = [math]::Round(((Get-Date) - $t0).TotalSeconds, 1) }
        } else {
            $result.unpack = [ordered]@{ done = $false; reason = 'already unpacked' }
        }
        if ($tops.Count -ne 1) { throw "expected one top folder in $Dest, found $($tops.Count)" }
        $top = $tops[0].FullName
    }

    # 2. layout
    $ed = Resolve-P0Editor -Root $top
    $product = Read-P0Json $ed.ProductJson
    $result.editor = [ordered]@{
        root = $top; exe = $ed.Exe; cli = $ed.Cli; productJson = $ed.ProductJson
        appDirRelative = (Split-Path -Parent $ed.ProductJson).Substring($top.Length + 1)
        nameShort = $product.nameShort; nameLong = $product.nameLong; applicationName = $product.applicationName
        dataFolderName = $product.dataFolderName; version = $ed.Version; commit = $ed.Commit; portableOk = $ed.PortableOk
    }
    if (-not $ed.PortableOk) { throw 'product.json has "target"; portable mode would not apply' }

    # daily data folders (before)
    $daily = @(
        (Join-Path $env:APPDATA 'Code'),
        (Join-Path $env:APPDATA 'Code - OSS'),
        (Join-Path $env:USERPROFILE '.vscode'),
        (Join-Path $env:USERPROFILE '.vscode-oss')
    )
    if ($product.nameLong) { $daily += (Join-Path $env:APPDATA $product.nameLong) }
    if ($product.dataFolderName) { $daily += (Join-Path $env:USERPROFILE $product.dataFolderName) }
    $daily = @($daily | Select-Object -Unique)
    $before = @($daily | ForEach-Object { Get-FolderStamp $_ })

    # 3. portable folder, CLI, start
    $portable = Join-Path $Dest 'portable'
    if (-not (Test-Path -LiteralPath $portable)) { New-Item -ItemType Directory -Force -Path $portable | Out-Null }
    $cli = $ed.Cli
    $v = Invoke-P0WithEditorEnv -Portable $portable -Body { Invoke-P0Native -FilePath $cli -Arguments @('--version') }
    $result.cliVersion = [ordered]@{ exitCode = $v.ExitCode; output = @($v.Output | Select-Object -First 5) }

    $exe = $ed.Exe
    $p = Invoke-P0WithEditorEnv -Portable $portable -Body { Start-Process -FilePath $exe -ArgumentList '--new-window' -PassThru }
    $null = $p.Handle
    $deadline = (Get-Date).AddSeconds($CheckSeconds)
    while ((Get-Date) -lt $deadline -and -not $p.HasExited) { Start-Sleep -Milliseconds 500 }
    $alive = -not $p.HasExited
    $treeNames = $null
    $stopped = 0
    if ($alive) {
        Start-Sleep -Seconds $SmokeSeconds
        $alive = -not $p.HasExited
        $tree = @(Get-P0ProcessTree -RootId $p.Id)
        $treeNames = @($tree | Group-Object Name | ForEach-Object { '{0} x{1}' -f $_.Name, $_.Count }) -join ', '
        $stopped = Stop-P0ProcessTree -RootId $p.Id
        Start-Sleep -Seconds 3
    }
    $result.started = [ordered]@{
        pid = $p.Id; aliveAfterCheck = $alive; exitCode = $(if ($p.HasExited -and -not $alive) { $p.ExitCode } else { $null })
        checkSeconds = $CheckSeconds; smokeSeconds = $SmokeSeconds; tree = $treeNames; stoppedProcesses = $stopped
    }

    # 4. what the editor made in the portable folder
    $entries = @(Get-ChildItem -LiteralPath $portable -Force | ForEach-Object { $_.Name + $(if ($_.PSIsContainer) { '\' } else { '' }) })
    $result.portable = [ordered]@{
        path = $portable
        entries = $entries
        userData = $(if (Test-Path -LiteralPath (Join-Path $portable 'user-data')) { Join-Path $portable 'user-data' } else { $null })
        userSettingsDir = $(if (Test-Path -LiteralPath (Join-Path $portable 'user-data\User')) { Join-Path $portable 'user-data\User' } else { $null })
        extensions = $(if (Test-Path -LiteralPath (Join-Path $portable 'extensions')) { Join-Path $portable 'extensions' } else { $null })
        argvJson = $(if (Test-Path -LiteralPath (Join-Path $portable 'argv.json')) { Join-Path $portable 'argv.json' } else { $null })
    }

    # 5. daily data folders (after)
    $after = @($daily | ForEach-Object { Get-FolderStamp $_ })
    $changed = @()
    for ($i = 0; $i -lt $daily.Count; $i++) {
        if ($before[$i].exists -ne $after[$i].exists -or $before[$i].lastWriteTime -ne $after[$i].lastWriteTime) { $changed += $daily[$i] }
    }
    $result.dailyData = [ordered]@{ before = $before; after = $after; changed = $changed }

    if ($alive -and $changed.Count -eq 0) {
        $result.result = 'ok'
        $result.message = 'started, stayed alive, stopped; daily editor data folders unchanged'
    } elseif (-not $alive) {
        $result.message = "the editor ended within the check (exit code $($p.ExitCode))"
    } else {
        $result.message = "daily editor data folder changed: $($changed -join ', ')"
    }
} catch {
    $result.message = $_.Exception.Message
}

Write-Result
if ($result.result -eq 'ok') { exit 0 } else { exit 1 }
