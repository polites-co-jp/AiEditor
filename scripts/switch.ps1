<#
.SYNOPSIS
  Switches the editor version (docs/02 section 6, docs/04 section 5).

.DESCRIPTION
  Layout under <installRoot> (local.json, docs/02 6.1):
    versions\<label>\     one unpacked zip per version (label = upstream tag - build number)
    current               junction -> versions\<label>
    history.txt           one line per switch: <ISO 8601 time> TAB <from label or -> TAB <to label>
    backups\<time>\       copy of the user data taken before the switch (+ backup.json)

  switch.ps1 <label>    switch to versions\<label>:
    0. (-Zip) unpack the zip into versions\<label> first (System32 tar.exe; refuses an existing label);
    1. check that the version folder has the exe and the CLI, and that its version satisfies the
       engines of every extension in the ledger (extensions.lock.json); stop (exit 4) if not;
    2. stop (exit 3) if an editor process runs from current (closes nothing itself);
    3. copy settings.json, keybindings.json, snippets\, tasks.json, globalStorage\state.vscdb
       of <user data dir>\User to backups\<time>\User\ (missing ones are listed, not an error);
    4. re-point the current junction, append to history.txt;
    5. list version folders beyond keepVersions (it never deletes them; the user does).
  switch.ps1 -Previous  switch back to the "from" of the last history line that switched to the
                        current label. Running it twice toggles between two versions.
  switch.ps1 -List      print the versions, current, the last history lines and the removable folders.
  switch.ps1 <label> [-Zip <zip> [-Sha256 <hex>]] -ExpandOnly
                        step 0 (unpack, when -Zip) and the exe/CLI check of versions\<label> only. It does not
                        check engines, does not look for running editors, and never touches current,
                        history.txt, backups or the user data (docs/06 section 9: the take-in unpacks, the
                        user switches later with "switch.ps1 <label>").

  The user data dir defaults to %VSCODE_APPDATA% or %APPDATA%, plus the product's nameShort
  (src/vs/platform/environment/node/userDataPath.ts of 1.146.0). -UserDataDir overrides it (trials:
  never point the trial at the daily editor data).

  Prints one JSON object to stdout.
  Exit codes: 0 ok, 1 error, 3 the editor is running, 4 the engines check failed.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/switch.ps1 1.146.0-1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/switch.ps1 1.147.0-1 -Zip C:\b\dist\1.147.0-1.zip
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/switch.ps1 -Previous
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/switch.ps1 -List
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/switch.ps1 1.147.0-1 -Zip C:\b\dist\1.147.0-1.zip -Sha256 <hex> -ExpandOnly
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/switch.ps1 1.146.0-t1 -ConfigPath C:\b\trial-install\local.json -UserDataDir C:\b\trial-install\userdata

  NOTE: this file is ASCII only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)][string]$Label,
    [switch]$Previous,
    [switch]$List,
    [switch]$ExpandOnly,
    [string]$Zip,
    [string]$Sha256,
    [string]$InstallRoot,
    [string]$ConfigPath,
    [string]$UserDataDir,
    [string]$LedgerPath
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\local-config.ps1')
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))

$summary = [ordered]@{ result = 'error' }
function Out-Summary {
    param([string]$Result, [string]$Message, [int]$Code)
    $summary.result = $Result
    if ($Message) { $summary.message = $Message }
    $summary | ConvertTo-Json -Depth 8
    exit $Code
}

# ---------------------------------------------------------------------------
# Pure helpers (test entry points; build-switch-design.md section 5)
# ---------------------------------------------------------------------------

function Test-EngineRange {
    <# Same rule as satisfiesEngine in scripts/lib/lock.mjs: ^x.y.z (npm caret) and >=x.y.z; anything else is false. #>
    param([string]$Range, [string]$Version)
    if (-not $Range -or -not $Version) { return $false }
    $m = [regex]::Match($Range.Trim(), '^(\^|>=)\s*(\d+)\.(\d+)\.(\d+)$')
    $vm = [regex]::Match($Version.Trim(), '^v?(\d+)\.(\d+)\.(\d+)')
    if (-not $m.Success -or -not $vm.Success) { return $false }
    $r = [version]('{0}.{1}.{2}' -f $m.Groups[2].Value, $m.Groups[3].Value, $m.Groups[4].Value)
    $v = [version]('{0}.{1}.{2}' -f $vm.Groups[1].Value, $vm.Groups[2].Value, $vm.Groups[3].Value)
    if ($v -lt $r) { return $false }
    if ($m.Groups[1].Value -eq '>=') { return $true }
    if ($r.Major -gt 0) { return ($v.Major -eq $r.Major) }
    if ($r.Minor -gt 0) { return ($v.Major -eq 0 -and $v.Minor -eq $r.Minor) }
    return ($v.Major -eq 0 -and $v.Minor -eq 0 -and $v.Build -eq $r.Build)
}

function ConvertFrom-HistoryLine {
    param([string]$Line)
    $p = $Line.Split("`t")
    if ($p.Count -lt 3) { return $null }
    return [pscustomobject]@{ time = $p[0]; from = $p[1]; to = $p[2] }
}

function Get-PreviousLabel {
    <# The "from" of the last history entry whose "to" is the current label; $null when there is none. #>
    param([object[]]$Entries, [string]$Current)
    for ($i = $Entries.Count - 1; $i -ge 0; $i--) {
        $e = $Entries[$i]
        if ($e -and $e.to -eq $Current) {
            if ($e.from -and $e.from -ne '-') { return $e.from }
            return $null
        }
    }
    return $null
}

function Get-LabelSortKey {
    <# "1.146.0-2" -> 0001.0146.0000.000002 ; other labels sort before them by name. #>
    param([string]$Name)
    $m = [regex]::Match($Name, '^(\d+)\.(\d+)\.(\d+)-(\d+)$')
    if ($m.Success) { return ('1|{0:D4}.{1:D4}.{2:D4}.{3:D6}' -f [int]$m.Groups[1].Value, [int]$m.Groups[2].Value, [int]$m.Groups[3].Value, [int]$m.Groups[4].Value) }
    return ('0|' + $Name)
}

function Get-RemovableVersions {
    <# Version folder names beyond keepVersions, oldest first. current is always kept and counted. #>
    param([string[]]$Names, [string]$Current, [int]$Keep)
    $others = @($Names | Where-Object { $_ -ne $Current } | Sort-Object -Property @{ Expression = { Get-LabelSortKey $_ } } -Descending)
    $room = $Keep
    if ($Current -and ($Names -contains $Current)) { $room = $Keep - 1 }
    if ($room -lt 0) { $room = 0 }
    $drop = @($others | Select-Object -Skip $room)
    return , @($drop | Sort-Object -Property @{ Expression = { Get-LabelSortKey $_ } })
}

# ---------------------------------------------------------------------------
# Filesystem helpers
# ---------------------------------------------------------------------------

function Read-JsonFile {
    param([string]$Path)
    $raw = [IO.File]::ReadAllText($Path)
    if ($raw.Length -gt 0 -and $raw[0] -eq [char]0xFEFF) { $raw = $raw.Substring(1) }
    return (ConvertFrom-Json -InputObject $raw)
}

function Get-JunctionTarget {
    param([string]$Path)
    $item = Get-Item -LiteralPath $Path -Force
    if (-not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { return $null }
    $t = @($item.Target) | Select-Object -First 1
    if ($t -and -not [IO.Path]::IsPathRooted($t)) { $t = [IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $Path) $t)) }
    return $t
}

function Get-ShukoEditorInfo {
    <# Finds resources\app (directly under the folder, or under one <commit10>\ folder: docs/02 4 step 7),
       the exe (<nameShort>.exe) and the CLI (bin\<applicationName>.cmd) of an unpacked version. #>
    param([Parameter(Mandatory)][string]$Root)
    if (-not (Test-Path -LiteralPath $Root -PathType Container)) { throw "version folder not found: $Root" }
    $app = Join-Path $Root 'resources\app'
    $versioned = $null
    if (-not (Test-Path -LiteralPath (Join-Path $app 'product.json'))) {
        $cand = @(Get-ChildItem -LiteralPath $Root -Directory | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'resources\app\product.json') })
        if ($cand.Count -ne 1) { throw "resources\app\product.json not found (or more than one) under $Root" }
        $versioned = $cand[0].Name
        $app = Join-Path $cand[0].FullName 'resources\app'
    }
    $product = Read-JsonFile (Join-Path $app 'product.json')
    $version = $null
    $pkgPath = Join-Path $app 'package.json'
    if (Test-Path -LiteralPath $pkgPath) { $version = (Read-JsonFile $pkgPath).version }
    if (-not $version) { $version = $product.version }
    $exe = Join-Path $Root ($product.nameShort + '.exe')
    $cli = Join-Path $Root ('bin\' + $product.applicationName + '.cmd')
    if (-not (Test-Path -LiteralPath $exe)) { throw "exe not found: $exe" }
    if (-not (Test-Path -LiteralPath $cli)) { throw "CLI not found: $cli" }
    return [pscustomobject]@{
        root = $Root; appDir = $app; versionedFolder = $versioned; exe = $exe; cli = $cli
        version = [string]$version; commit = $product.commit; nameShort = $product.nameShort
        applicationName = $product.applicationName; dataFolderName = $product.dataFolderName
    }
}

function Get-EditorProcessesUnder {
    param([string[]]$Roots)
    $prefixes = @($Roots | Where-Object { $_ } | ForEach-Object { $_.TrimEnd('\') + '\' })
    return @(Get-CimInstance Win32_Process | Where-Object {
            $exe = $_.ExecutablePath
            $exe -and @($prefixes | Where-Object { $exe.StartsWith($_, [StringComparison]::OrdinalIgnoreCase) }).Count -gt 0
        })
}

function Expand-VersionZip {
    <# Unpacks a zip into <versions>\<label> with System32 tar.exe (bsdtar). If the zip has one top
       folder (Shuko-win32-x64-<label>), its content becomes the version folder. #>
    param([string]$ZipPath, [string]$VersionsDir, [string]$Name)
    $tar = Join-Path $env:SystemRoot 'System32\tar.exe'
    if (-not (Test-Path -LiteralPath $tar)) { throw "tar.exe not found: $tar" }
    $dest = Join-Path $VersionsDir $Name
    if (Test-Path -LiteralPath $dest) { throw "version folder already exists: $dest" }
    $staging = Join-Path $VersionsDir ('.staging-' + $Name)
    if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $staging | Out-Null
    try {
        $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
        $out = & $tar -x -f $ZipPath -C $staging 2>&1 | ForEach-Object { "$_" }
        $rc = $LASTEXITCODE
        $ErrorActionPreference = $old
        if ($rc -ne 0) { throw "tar -x failed ($rc): $(($out | Select-Object -First 5) -join ' | ')" }
        $dirs = @(Get-ChildItem -LiteralPath $staging -Directory -Force)
        $files = @(Get-ChildItem -LiteralPath $staging -File -Force)
        $inner = $staging
        $top = $null
        if ($dirs.Count -eq 1 -and $files.Count -eq 0) { $inner = $dirs[0].FullName; $top = $dirs[0].Name }
        [IO.Directory]::Move($inner, $dest)
        return [ordered]@{ zip = $ZipPath; topFolder = $top; dest = $dest }
    } finally {
        if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
    }
}

function Backup-UserData {
    param([string]$UserData, [string]$BackupRoot, [string]$From, [string]$To)
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $dir = Join-Path $BackupRoot $stamp
    $n = 1
    while (Test-Path -LiteralPath $dir) { $dir = Join-Path $BackupRoot ('{0}-{1}' -f $stamp, $n); $n++ }
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $items = @('User\settings.json', 'User\keybindings.json', 'User\snippets', 'User\tasks.json', 'User\globalStorage\state.vscdb')
    $copied = @(); $missing = @()
    foreach ($rel in $items) {
        $src = Join-Path $UserData $rel
        if (-not (Test-Path -LiteralPath $src)) { $missing += $rel; continue }
        $dst = Join-Path $dir $rel
        $parent = Split-Path -Parent $dst
        if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
        Copy-Item -LiteralPath $src -Destination $dst -Recurse -Force
        $copied += $rel
    }
    $manifest = [ordered]@{ createdAt = (Get-Date).ToString('o'); from = $From; to = $To; userDataDir = $UserData; copied = $copied; missing = $missing }
    [IO.File]::WriteAllText((Join-Path $dir 'backup.json'), (($manifest | ConvertTo-Json -Depth 4) + "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
    $manifest.dir = $dir
    return $manifest
}

function Read-History {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return , @() }
    $lines = @([IO.File]::ReadAllLines($Path) | Where-Object { $_.Trim() -ne '' })
    return , @($lines | ForEach-Object { ConvertFrom-HistoryLine $_ } | Where-Object { $_ })
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

try {
    $cfg = Resolve-ShukoLocalConfig -ConfigPath $ConfigPath -Overrides @{ installRoot = $InstallRoot }
} catch {
    Out-Summary -Result 'error' -Message $_.Exception.Message -Code 1
}
$root = $cfg.installRoot
$versionsDir = Join-Path $root 'versions'
$currentPath = Join-Path $root 'current'
$historyPath = Join-Path $root 'history.txt'
$backupsDir = Join-Path $root 'backups'
$summary.installRoot = $root
$summary.configPath = $cfg.configPath

try {
    $currentLabel = $null
    if (Test-Path -LiteralPath $currentPath) {
        $t = Get-JunctionTarget $currentPath
        if (-not $t) { throw "$currentPath exists but is not a junction" }
        $currentLabel = Split-Path -Leaf $t
    }
    $summary.from = $currentLabel
    $versionNames = @()
    if (Test-Path -LiteralPath $versionsDir) {
        $versionNames = @(Get-ChildItem -LiteralPath $versionsDir -Directory | Where-Object { -not $_.Name.StartsWith('.') } | ForEach-Object { $_.Name })
    }
    $history = Read-History $historyPath

    if ($ExpandOnly -and ($List -or $Previous)) { throw '-ExpandOnly cannot be used with -List or -Previous' }
    if ($List) {
        $summary.current = $currentLabel
        $summary.keepVersions = $cfg.keepVersions
        $summary.versions = @($versionNames | Sort-Object -Property @{ Expression = { Get-LabelSortKey $_ } } | ForEach-Object {
                $info = $null
                try { $info = Get-ShukoEditorInfo (Join-Path $versionsDir $_) } catch { }
                [ordered]@{ label = $_; version = $(if ($info) { $info.version } else { $null }); current = ($_ -eq $currentLabel) }
            })
        $summary.history = @($history | Select-Object -Last 10)
        $summary.removable = Get-RemovableVersions -Names $versionNames -Current $currentLabel -Keep $cfg.keepVersions
        Out-Summary -Result 'ok' -Code 0
    }

    if ($Previous) {
        if ($Label) { throw 'give either a label or -Previous, not both' }
        if (-not $currentLabel) { throw 'no current version; nothing to go back from' }
        $Label = Get-PreviousLabel -Entries $history -Current $currentLabel
        if (-not $Label) { throw "history.txt has no earlier version for $currentLabel" }
    }
    if (-not $Label) { throw 'give a label, -Previous or -List' }
    if ($Label -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*$') { throw "bad label: $Label" }
    $summary.to = $Label

    if ($Zip) {
        if ($Sha256) {
            $h = (Get-FileHash -LiteralPath $Zip -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($h -ne $Sha256.ToLowerInvariant()) { throw "zip SHA-256 $h does not match $Sha256" }
            $summary.zipSha256 = $h
        }
        if (-not (Test-Path -LiteralPath $versionsDir)) { New-Item -ItemType Directory -Force -Path $versionsDir | Out-Null }
        $summary.expanded = Expand-VersionZip -ZipPath $Zip -VersionsDir $versionsDir -Name $Label
        $versionNames = @(Get-ChildItem -LiteralPath $versionsDir -Directory | Where-Object { -not $_.Name.StartsWith('.') } | ForEach-Object { $_.Name })
    }

    $targetDir = Join-Path $versionsDir $Label
    $info = Get-ShukoEditorInfo $targetDir
    $summary.target = [ordered]@{ dir = $targetDir; version = $info.version; commit = $info.commit; exe = $info.exe; cli = $info.cli; versionedFolder = $info.versionedFolder }

    if ($ExpandOnly) {
        # Unpack (when -Zip) and check exe/CLI only: current, history.txt, backups and the user data are not touched
        # (docs/06 section 9: the take-in unpacks; the user switches).
        $summary.expandOnly = $true
        $summary.current = $currentLabel
        Out-Summary -Result 'ok' -Message "expanded/checked $Label only; current is still $(if ($currentLabel) { $currentLabel } else { '(none)' })" -Code 0
    }

    if ($Label -eq $currentLabel) {
        $summary.removable = Get-RemovableVersions -Names $versionNames -Current $currentLabel -Keep $cfg.keepVersions
        Out-Summary -Result 'ok' -Message "$Label is already current; nothing changed" -Code 0
    }

    # 1. engines of the ledger
    if (-not $LedgerPath) { $LedgerPath = Join-Path $repo 'extensions.lock.json' }
    $ledger = @(Read-JsonFile $LedgerPath)
    $bad = @()
    foreach ($e in $ledger) {
        if (-not (Test-EngineRange -Range ([string]$e.engines) -Version $info.version)) { $bad += [ordered]@{ id = $e.id; version = $e.version; engines = $e.engines } }
    }
    $summary.engines = [ordered]@{ ledger = $LedgerPath; editorVersion = $info.version; checked = $ledger.Count; unsatisfied = $bad }
    if ($bad.Count -gt 0) {
        Out-Summary -Result 'engines-unsatisfied' -Message "$($bad.Count) extension(s) of the ledger do not accept $($info.version); not switched" -Code 4
    }

    # 2. running editor
    $roots = @($currentPath)
    if ($currentLabel) { $roots += (Join-Path $versionsDir $currentLabel) }
    $busy = @(Get-EditorProcessesUnder $roots)
    if ($busy.Count -gt 0) {
        $summary.running = @($busy | ForEach-Object { [ordered]@{ pid = [int]$_.ProcessId; path = $_.ExecutablePath } })
        Out-Summary -Result 'editor-running' -Message "close the editor first ($($busy.Count) process(es) run from the current version)" -Code 3
    }

    # 3. backup of the user data
    if (-not $UserDataDir) {
        $nameShort = $info.nameShort
        if ($currentLabel) { try { $nameShort = (Get-ShukoEditorInfo (Join-Path $versionsDir $currentLabel)).nameShort } catch { } }
        $base = $env:VSCODE_APPDATA
        if (-not $base) { $base = $env:APPDATA }
        $UserDataDir = Join-Path $base $nameShort
    }
    $summary.backup = Backup-UserData -UserData $UserDataDir -BackupRoot $backupsDir -From $(if ($currentLabel) { $currentLabel } else { '-' }) -To $Label

    # 4. junction and history
    $oldTarget = $null
    if (Test-Path -LiteralPath $currentPath) {
        $oldTarget = Get-JunctionTarget $currentPath
        [IO.Directory]::Delete($currentPath, $false)
    }
    try {
        New-Item -ItemType Junction -Path $currentPath -Target $targetDir | Out-Null
    } catch {
        if ($oldTarget -and -not (Test-Path -LiteralPath $currentPath)) { New-Item -ItemType Junction -Path $currentPath -Target $oldTarget | Out-Null }
        throw
    }
    $line = '{0}{1}{2}{1}{3}' -f (Get-Date).ToString('o'), "`t", $(if ($currentLabel) { $currentLabel } else { '-' }), $Label
    [IO.File]::AppendAllText($historyPath, $line + "`r`n", (New-Object System.Text.UTF8Encoding($false)))
    $summary.history = $line

    # 5. old versions (listed, never deleted)
    $summary.keepVersions = $cfg.keepVersions
    $summary.removable = Get-RemovableVersions -Names $versionNames -Current $Label -Keep $cfg.keepVersions
    if ($summary.removable.Count -gt 0) {
        $msg = "[switch] {0} version folder(s) beyond keepVersions={1}; delete them yourself if not needed: {2}" -f $summary.removable.Count, $cfg.keepVersions, ($summary.removable -join ', ')
        [Console]::Error.WriteLine($msg)
    }
    Out-Summary -Result 'ok' -Code 0
} catch {
    Out-Summary -Result 'error' -Message $_.Exception.Message -Code 1
}
