<#
.SYNOPSIS
  Phase 1 (docs/07 section 4): unpacks a built zip and starts the editor once in a separate place
  (VSCODE_PORTABLE), to see that it starts and where the user data, the extensions and argv.json go.

.DESCRIPTION
  1. Unpacks -Zip with %SystemRoot%\System32\tar.exe into -Dest (default <buildRoot>\p1\<zip name>), unless
     -Dest already has the unpacked folder. -Dest must be under <buildRoot>\p1 or <buildRoot>\p2
     (<buildRoot>: local.json, default <repo>\tmp\b since 2026-11-15; before that C:\b).
  2. Finds exe / CLI / product.json (flat <top>\resources\app or versioned <top>\<commit10>\resources\app).
  3. Runs "<cli> --version" and starts "<exe> --new-window" with ELECTRON_RUN_AS_NODE,
     ELECTRON_NO_ATTACH_CONSOLE and every VSCODE_* removed and only VSCODE_PORTABLE=<Dest>\portable
     set (scripts\lib\p0-common.ps1 Invoke-P0WithEditorEnv). No --user-data-dir / --extensions-dir:
     the point is to see the editor's own portable defaults.
     With -InstallExtension, first runs "<cli> --install-extension <vsix>" for each VSIX in the same
     environment (docs/04: the ledger extensions are put in this way). Each must end with exit code 0
     and no "Error while installing" / "Failed Installing" line (result field installs).
  4. Checks the process is alive after -CheckSeconds, waits -SmokeSeconds, lists the process tree,
     lists what appeared under the portable folder (user-data, extensions, argv.json), then stops
     exactly the started process and its descendants.
  5. Workbench check (result field workbench; since 2026-11-16, tasks/2026-11-16-p5-c1-product-keys:
     a live process is not enough, the 21-unit build kept its window open with a dead workbench).
     The start also gets --enable-logging=file --log-file=<Dest>\chromium-<stamp>.log (Chromium's log;
     the developer tools console is in it as INFO:CONSOLE lines). After the stop, the logs folder of
     this start (<portable>\user-data\logs\<stamp>, the newest one with window1\ made since the start)
     must have
       window1\renderer.log          "Started local extension host with pid <n>."
       window1\exthost\exthost.log   "Extension host with pid <n> started" and "Eager extensions activated"
     and the Chromium log must have no "Uncaught" console error whose source is the workbench itself
     (vscode-file://). Uncaught errors inside webviews (vscode-webview://) are listed but do not fail.
  6. Compares the daily editor data folders (%APPDATA%\Code, %APPDATA%\Code - OSS,
     %USERPROFILE%\.vscode, %USERPROFILE%\.vscode-oss, and %APPDATA%\<nameLong>,
     %USERPROFILE%\<dataFolderName>) before and after: exists + LastWriteTime of the folder only
     (nothing inside them is read or written).
  -LogsFolder <logs\<stamp> folder> [-ChromiumLog <file>]: starts nothing; only judges the workbench
  from those logs (the same check as 5; for re-judging a run and for tests).
  Writes JSON to stdout and to -OutFile.

  Exit code: 0 = started, stayed alive, the workbench came up, every -InstallExtension went in and no
  daily data folder changed (-LogsFolder: the workbench came up), 1 = otherwise, 2 = bad arguments.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -Zip <buildRoot>\dist\1.146.0-upstream.zip -OutFile tasks\x\launch-check.json
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -Root <buildRoot>\wt\VSCode-win32-x64 -OutFile tasks\x\launch-check.json
    (-Root: start an editor folder in place instead of unpacking a zip; exactly one of -Zip / -Root / -LogsFolder)
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -Zip <buildRoot>\dist\<label>.zip -Dest <buildRoot>\p2\<label> -InstallExtension <a.vsix>,<b.vsix> -OutFile tasks\x\launch-check.json
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-launch-check.ps1 -LogsFolder <portable>\user-data\logs\<stamp> -ChromiumLog <Dest>\chromium-<stamp>.log -OutFile tasks\x\workbench.json

  NOTE: ASCII only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
#>
[CmdletBinding()]
param(
    [string]$Zip,
    # Instead of -Zip: an editor folder that is already there (for example the gulp output
    # <buildRoot>\wt\VSCode-win32-x64). It is started in place (read only); the portable folder goes to
    # -Dest (default <buildRoot>\p1\<folder name>), never next to the editor. Must be under <buildRoot>.
    [string]$Root,
    [string]$Dest,
    [int]$CheckSeconds = 10,
    [int]$SmokeSeconds = 15,
    # VSIX files to put in with the CLI before the start, comma separated (powershell -File passes
    # "a,b" as one string). A folder means every *.vsix under it.
    [string]$InstallExtension,
    # Instead of -Zip / -Root: judge only these logs (a <portable>\user-data\logs\<stamp> folder).
    [string]$LogsFolder,
    # With -LogsFolder: the Chromium log of the same start (optional; without it no console errors are seen).
    [string]$ChromiumLog,
    [string]$OutFile
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\p0-common.ps1')

# <buildRoot> from local.json (default <repo>\tmp\b; decision 2026-11-15, nothing on C:). Before: C:\b.
. (Join-Path $PSScriptRoot 'lib\local-config.ps1')
$buildRoot = (Resolve-ShukoLocalConfig).buildRoot
$p1Root = Join-Path $buildRoot 'p1'
# -Dest may be under <buildRoot>\p1 (Phase 1) or <buildRoot>\p2 (Phase 2 builds, unpacked for the gate checks;
# tasks/2026-11-14-p2-builds). The default stays <buildRoot>\p1.
$destRoots = @($p1Root, (Join-Path $buildRoot 'p2'))
$tar = Join-Path $env:SystemRoot 'System32\tar.exe'

function Assert-P1Path {
    param([Parameter(Mandatory)][string]$Path)
    $full = [IO.Path]::GetFullPath($Path).TrimEnd('\')
    foreach ($r in $destRoots) {
        if ($full.StartsWith($r + '\', [StringComparison]::OrdinalIgnoreCase)) { return $full }
    }
    throw "refusing a path outside $($destRoots -join ' and ') : $full"
}

function Get-FolderStamp {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path) {
        $i = Get-Item -LiteralPath $Path -Force
        return [ordered]@{ path = $Path; exists = $true; lastWriteTime = $i.LastWriteTimeUtc.ToString('o') }
    }
    return [ordered]@{ path = $Path; exists = $false; lastWriteTime = $null }
}

# ---- workbench check (description 5) -----------------------------------------------------------

# A log the editor may still hold open. $null when there is no such file.
function Read-SharedText {
    param([AllowNull()][AllowEmptyString()][string]$Path)
    if (-not $Path -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    $fs = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
    try {
        $sr = New-Object IO.StreamReader($fs, (New-Object System.Text.UTF8Encoding($false)), $true)
        return $sr.ReadToEnd()
    } finally { $fs.Dispose() }
}

function Get-FileFacts {
    param([AllowNull()][AllowEmptyString()][string]$Path)
    if (-not $Path) { return [ordered]@{ path = $null; exists = $false; bytes = $null } }
    if (Test-Path -LiteralPath $Path -PathType Leaf) { return [ordered]@{ path = $Path; exists = $true; bytes = (Get-Item -LiteralPath $Path -Force).Length } }
    return [ordered]@{ path = $Path; exists = $false; bytes = $null }
}

# "Uncaught" errors of the developer tools console in a Chromium log. A line looks like
#   [59188:1116/115143.357:INFO:CONSOLE:1847] "Uncaught (in promise) TypeError: ...", source: vscode-file://vscode-app/.../workbench.desktop.main.js (1847)
# (older Chromium: INFO:CONSOLE(1847)). workbench = the source is the workbench itself (vscode-file://);
# others = anything else, for example a webview (vscode-webview://), which a passing build also has.
function Get-ConsoleUncaught {
    param([AllowNull()][AllowEmptyString()][string]$Text)
    $lines = @()
    if ($Text) { $lines = @($Text -split "`r?`n") }
    $uncaught = @($lines | Where-Object { $_ -match ':CONSOLE[:(]' -and $_ -match '"Uncaught\b' })
    $wb = @($uncaught | Where-Object { $_ -match 'source:\s*vscode-file://' })
    $others = @($uncaught | Where-Object { $_ -notmatch 'source:\s*vscode-file://' })
    $cut = { param($l) if ($l.Length -gt 400) { $l.Substring(0, 400) + '...' } else { $l } }
    return [ordered]@{
        workbenchCount = $wb.Count
        othersCount = $others.Count
        workbench = @($wb | Select-Object -First 10 | ForEach-Object { & $cut $_ })
        others = @($others | Select-Object -First 10 | ForEach-Object { & $cut $_ })
    }
}

# Judges one start from its logs folder (<portable>\user-data\logs\<stamp>) and its Chromium log.
# ready = the three markers are there and no Uncaught console error came from the workbench.
function Get-WorkbenchState {
    param([AllowNull()][AllowEmptyString()][string]$Folder, [AllowNull()][AllowEmptyString()][string]$Chromium)
    $rendererPath = $null; $exthostPath = $null
    if ($Folder) {
        $rendererPath = Join-Path $Folder 'window1\renderer.log'
        $exthostPath = Join-Path $Folder 'window1\exthost\exthost.log'
    }
    $renderer = Read-SharedText $rendererPath
    $exthost = Read-SharedText $exthostPath
    $markers = [ordered]@{
        rendererStartedExtHost = [bool]($renderer -and ($renderer -match 'Started local extension host with pid \d+'))
        extHostStarted = [bool]($exthost -and ($exthost -match 'Extension host with pid \d+ started'))
        eagerExtensionsActivated = [bool]($exthost -and ($exthost -match 'Eager extensions activated'))
    }
    $missing = @($markers.Keys | Where-Object { -not $markers[$_] })
    $console = Get-ConsoleUncaught (Read-SharedText $Chromium)
    return [ordered]@{
        logsFolder = $(if ($Folder) { $Folder } else { $null })
        rendererLog = Get-FileFacts $rendererPath
        exthostLog = Get-FileFacts $exthostPath
        chromiumLog = Get-FileFacts $Chromium
        markers = $markers
        missing = $missing
        consoleUncaught = $console
        ready = ($missing.Count -eq 0 -and $console.workbenchCount -eq 0)
    }
}

# The logs folder of the start at $SinceUtc: the newest folder under $LogsRoot made since then that has
# window1\ (the CLI runs before the start make folders without it); else the newest made since then.
function Find-StartLogsFolder {
    param([Parameter(Mandatory)][string]$LogsRoot, [Parameter(Mandatory)][datetime]$SinceUtc)
    if (-not (Test-Path -LiteralPath $LogsRoot -PathType Container)) { return $null }
    $since = @(Get-ChildItem -LiteralPath $LogsRoot -Directory | Where-Object { $_.CreationTimeUtc -ge $SinceUtc.AddSeconds(-2) } | Sort-Object CreationTimeUtc -Descending)
    $withWindow = @($since | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'window1') -PathType Container })
    if ($withWindow.Count -gt 0) { return $withWindow[0].FullName }
    if ($since.Count -gt 0) { return $since[0].FullName }
    return $null
}

# -InstallExtension: comma separated VSIX files or folders (every *.vsix under a folder). Throws on a missing one.
function Get-VsixList {
    param([AllowNull()][AllowEmptyString()][string]$Spec)
    $out = New-Object System.Collections.Generic.List[string]
    if (-not $Spec) { return $out.ToArray() }
    foreach ($item in @($Spec -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })) {
        if (Test-Path -LiteralPath $item -PathType Container) {
            foreach ($f in @(Get-ChildItem -LiteralPath $item -Recurse -File -Filter '*.vsix' | Sort-Object FullName)) { $out.Add($f.FullName) }
        } elseif (Test-Path -LiteralPath $item -PathType Leaf) {
            $out.Add([IO.Path]::GetFullPath($item))
        } else {
            throw "VSIX not found: $item"
        }
    }
    return $out.ToArray()
}

# One "<cli> --install-extension <vsix>" run: ok = exit code 0 and no error line of the CLI
# (2026-11-16: every ledger extension failed with "Error while installing extensions: ... is not iterable").
function Get-InstallVerdict {
    param([string]$Vsix, $ExitCode, [string[]]$Output)
    $bad = @($Output | Where-Object { $_ -match 'Error while installing|Failed Installing|is not iterable' })
    return [ordered]@{
        vsix = $Vsix; exitCode = $ExitCode; ok = ($ExitCode -eq 0 -and $bad.Count -eq 0)
        errors = @($bad | Select-Object -First 5); output = @($Output | Select-Object -Last 5)
    }
}

# ---- -LogsFolder: judge logs only, start nothing --------------------------------------------------
$modes = @(@($Zip, $Root, $LogsFolder) | Where-Object { -not [string]::IsNullOrEmpty($_) })
if ($modes.Count -ne 1) { [Console]::Error.WriteLine('give exactly one of -Zip, -Root and -LogsFolder'); exit 2 }
if ($LogsFolder) {
    if (-not (Test-Path -LiteralPath $LogsFolder -PathType Container)) { [Console]::Error.WriteLine("logs folder not found: $LogsFolder"); exit 2 }
    if ($ChromiumLog -and -not (Test-Path -LiteralPath $ChromiumLog -PathType Leaf)) { [Console]::Error.WriteLine("Chromium log not found: $ChromiumLog"); exit 2 }
    if ($InstallExtension) { [Console]::Error.WriteLine('-InstallExtension needs -Zip or -Root'); exit 2 }
    $LogsFolder = [IO.Path]::GetFullPath($LogsFolder).TrimEnd('\')
    $wbOnly = Get-WorkbenchState -Folder $LogsFolder -Chromium $(if ($ChromiumLog) { [IO.Path]::GetFullPath($ChromiumLog) } else { $null })
    $verdict = $(if ($wbOnly.ready) { 'ok' } else { 'error' })
    $logsResult = [ordered]@{
        checkedAt = (Get-Date).ToString('o'); logsFolder = $LogsFolder; workbench = $wbOnly; result = $verdict
        message = $(if ($wbOnly.ready) { 'the workbench came up (logs only)' } else { "the workbench did not come up (missing: $(if ($wbOnly.missing.Count) { $wbOnly.missing -join ', ' } else { 'none' }); uncaught workbench console errors: $($wbOnly.consoleUncaught.workbenchCount))" })
    }
    $json = ConvertTo-Json -InputObject $logsResult -Depth 10
    if ($OutFile) {
        $dir = Split-Path -Parent ([IO.Path]::GetFullPath($OutFile))
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
        [IO.File]::WriteAllText([IO.Path]::GetFullPath($OutFile), $json + "`r`n", (New-Object System.Text.UTF8Encoding($false)))
    }
    Write-Output $json
    if ($verdict -eq 'ok') { exit 0 } else { exit 1 }
}

try { $vsixList = @(Get-VsixList $InstallExtension) } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 2 }
if ($Zip) {
    if (-not (Test-Path -LiteralPath $Zip)) { [Console]::Error.WriteLine("zip not found: $Zip"); exit 2 }
    $Zip = [IO.Path]::GetFullPath($Zip)
    if (-not $Dest) { $Dest = Join-Path $p1Root ([IO.Path]::GetFileNameWithoutExtension($Zip)) }
} else {
    if (-not (Test-Path -LiteralPath $Root)) { [Console]::Error.WriteLine("folder not found: $Root"); exit 2 }
    $Root = [IO.Path]::GetFullPath($Root).TrimEnd('\')
    if (-not $Root.StartsWith($buildRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { [Console]::Error.WriteLine("refusing a folder outside $buildRoot : $Root"); exit 2 }
    if (-not $Dest) { $Dest = Join-Path $p1Root (Split-Path -Leaf $Root) }
}
try { $Dest = Assert-P1Path $Dest } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 2 }

$result = [ordered]@{
    checkedAt = (Get-Date).ToString('o'); zip = $Zip; root = $Root; dest = $Dest
    unpack = $null; editor = $null; cliVersion = $null; installs = @(); portable = $null
    started = $null; workbench = $null; dailyData = $null; result = 'error'; message = $null
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

    # 3b. -InstallExtension: the CLI path the ledger extensions take (docs/04)
    $installs = @()
    foreach ($vsix in $vsixList) {
        $iv = Invoke-P0WithEditorEnv -Portable $portable -Body { Invoke-P0Native -FilePath $cli -Arguments @('--install-extension', $vsix) }
        $installs += Get-InstallVerdict -Vsix $vsix -ExitCode $iv.ExitCode -Output @($iv.Output)
    }
    $result.installs = $installs
    $installsOk = @($installs | Where-Object { -not $_.ok }).Count -eq 0

    $exe = $ed.Exe
    # Chromium's log (with the developer tools console) goes next to the portable folder, one file per start
    $chromium = Join-Path $Dest ('chromium-' + (Get-Date).ToString('yyyyMMddTHHmmss') + '.log')
    $startArgs = @('--new-window', '--enable-logging=file', ('--log-file="{0}"' -f $chromium))
    $startUtc = (Get-Date).ToUniversalTime()
    $p = Invoke-P0WithEditorEnv -Portable $portable -Body { Start-Process -FilePath $exe -ArgumentList $startArgs -PassThru }
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

    # 5. did the workbench come up (read after the stop, so the logs are written out)
    $startLogs = Find-StartLogsFolder -LogsRoot (Join-Path $portable 'user-data\logs') -SinceUtc $startUtc
    $result.workbench = Get-WorkbenchState -Folder $startLogs -Chromium $chromium
    $workbenchReady = [bool]$result.workbench.ready

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

    if ($alive -and $workbenchReady -and $installsOk -and $changed.Count -eq 0) {
        $result.result = 'ok'
        $result.message = 'started, stayed alive, the workbench came up, stopped; daily editor data folders unchanged'
    } elseif (-not $alive) {
        $result.message = "the editor ended within the check (exit code $($p.ExitCode))"
    } elseif ($changed.Count -gt 0) {
        $result.message = "daily editor data folder changed: $($changed -join ', ')"
    } elseif (-not $workbenchReady) {
        $result.message = "the window stayed alive but the workbench did not come up (missing: $(if ($result.workbench.missing.Count) { $result.workbench.missing -join ', ' } else { 'none' }); uncaught workbench console errors: $($result.workbench.consoleUncaught.workbenchCount))"
    } else {
        $result.message = "--install-extension failed: $((@($installs | Where-Object { -not $_.ok }) | ForEach-Object { Split-Path -Leaf $_.vsix }) -join ', ')"
    }
} catch {
    $result.message = $_.Exception.Message
}

Write-Result
if ($result.result -eq 'ok') { exit 0 } else { exit 1 }
