<#
.SYNOPSIS
  Creates or changes the per-PC settings file local.json (docs/02 section 6.1).

.DESCRIPTION
  No arguments, no local.json yet : creates it with the defaults; builderRepo = this repository.
  No arguments, local.json exists : prints the resolved values; changes nothing.
  -KeepVersions / -BuildRoot / -BuilderRepo : sets the value (validated) and rewrites local.json.
     -BuildRoot does not move anything already under the old build root.
  -InstallRoot <new> : moves the version folders to a new place (docs/02 6.1 "changing the place"):
     1. stops (exit 3) if an editor process runs from the old install root;
     2. checks that the new place is on a local NTFS volume (a junction is needed);
     3. moves versions\, history.txt, backups\ to the new place (-NoMove: moves nothing and starts
        empty there; the old place is left as it is);
     4. re-creates the "current" junction in the new place (junctions point at absolute paths);
     5. re-points existing Start menu shortcuts (top level of the user's Programs folder) and user
        PATH entries that point at <old>\current, to <new>\current. It never creates new ones.
        The user PATH is read and written raw in HKCU\Environment with its kind kept (REG_EXPAND_SZ
        stays REG_EXPAND_SZ; other entries keep their %VAR% form), then WM_SETTINGCHANGE is broadcast.
        -NoShellIntegration skips this step (trials);
     6. rewrites local.json last. If any step fails, the moves are undone and local.json is kept.

  -ConfigPath : another local.json (trials and tests). The default is %LOCALAPPDATA%\Shuko\local.json.

  Prints one JSON object (what was done) to stdout.
  Exit codes: 0 ok, 1 error, 3 an editor process is running from the install root.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/configure.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/configure.ps1 -InstallRoot D:\Apps\Shuko
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/configure.ps1 -ConfigPath C:\b\trial-install\local.json -InstallRoot C:\b\trial-install\B -NoShellIntegration

  NOTE: this file is ASCII only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
#>
[CmdletBinding()]
param(
    [string]$InstallRoot,
    [int]$KeepVersions,
    [string]$BuildRoot,
    [string]$BuilderRepo,
    [switch]$NoMove,
    [switch]$NoShellIntegration,
    [string]$ConfigPath
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\local-config.ps1')

$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $ConfigPath) { $ConfigPath = Get-ShukoLocalConfigPath }
$ConfigPath = [IO.Path]::GetFullPath($ConfigPath)

$summary = [ordered]@{ configPath = $ConfigPath; actions = @(); result = 'error' }

function Out-Summary {
    param([string]$Result, [string]$Message, [int]$Code)
    $summary.result = $Result
    if ($Message) { $summary.message = $Message }
    $summary | ConvertTo-Json -Depth 8
    exit $Code
}

function Test-UnderPath {
    param([string]$Path, [string]$Root)
    $p = $Path.TrimEnd('\'); $r = $Root.TrimEnd('\')
    return ($p -ieq $r) -or $p.StartsWith($r + '\', [StringComparison]::OrdinalIgnoreCase)
}

function Get-JunctionTarget {
    <# Target of a junction / symlink directory, or $null when the path is not a reparse point. #>
    param([string]$Path)
    $item = Get-Item -LiteralPath $Path -Force
    if (-not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { return $null }
    $t = @($item.Target) | Select-Object -First 1
    if ($t -and -not [IO.Path]::IsPathRooted($t)) { $t = [IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $Path) $t)) }
    return $t
}

function Get-EditorProcessesUnder {
    param([string]$Root)
    $r = $Root.TrimEnd('\') + '\'
    return @(Get-CimInstance Win32_Process | Where-Object {
            $_.ExecutablePath -and $_.ExecutablePath.StartsWith($r, [StringComparison]::OrdinalIgnoreCase)
        })
}

function Assert-LocalNtfs {
    param([string]$Path)
    if ($Path.StartsWith('\\')) { throw "not a local volume (UNC path): $Path" }
    $drive = New-Object IO.DriveInfo ($Path.Substring(0, 1))
    if (-not $drive.IsReady) { throw "the drive of $Path is not ready" }
    if ($drive.DriveType -ne [IO.DriveType]::Fixed) { throw "not a local fixed drive ($($drive.DriveType)): $Path" }
    if ($drive.DriveFormat -ne 'NTFS') { throw "not NTFS ($($drive.DriveFormat)): $Path" }
    return [ordered]@{ drive = $drive.Name; type = "$($drive.DriveType)"; format = $drive.DriveFormat }
}

function Move-Entry {
    <# Moves a file or a folder. Same volume: rename. Other volume: copy then delete (robocopy /MOVE for folders). #>
    param([string]$From, [string]$To)
    $same = ([IO.Path]::GetPathRoot($From) -ieq [IO.Path]::GetPathRoot($To))
    $isDir = Test-Path -LiteralPath $From -PathType Container
    if ($same) {
        if ($isDir) { [IO.Directory]::Move($From, $To) } else { [IO.File]::Move($From, $To) }
        return
    }
    if ($isDir) {
        $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
        & robocopy $From $To /E /MOVE /COPY:DAT /DCOPY:T /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
        $rc = $LASTEXITCODE
        $ErrorActionPreference = $old
        if ($rc -ge 8) { throw "robocopy $From -> $To failed ($rc)" }
        if (Test-Path -LiteralPath $From) { Remove-Item -LiteralPath $From -Recurse -Force }
    } else {
        Copy-Item -LiteralPath $From -Destination $To
        Remove-Item -LiteralPath $From -Force
    }
}

function Update-PathEntries {
    <# Pure. Replaces the PATH entries that point at $OldBin with $NewBin and returns the new raw text,
       or $null when nothing matched. Entries are compared after expanding %VAR% and trimming a trailing
       backslash (case-insensitive); every other entry, its %VAR% form and the separators are kept as they are. #>
    param([AllowEmptyString()][string]$Raw, [string]$OldBin, [string]$NewBin)
    if (-not $Raw) { return $null }
    $target = $OldBin.TrimEnd('\')
    $parts = $Raw.Split(';')
    $changed = $false
    for ($i = 0; $i -lt $parts.Count; $i++) {
        $p = $parts[$i]
        if ($p.Trim() -eq '') { continue }
        $expanded = [Environment]::ExpandEnvironmentVariables($p.Trim()).TrimEnd('\')
        if ($expanded -ieq $target) { $parts[$i] = $NewBin; $changed = $true }
    }
    if (-not $changed) { return $null }
    return ($parts -join ';')
}

function Get-UserPathRaw {
    <# The user PATH as stored (HKCU\Environment, %VAR% not expanded) and its kind, or $null. #>
    $k = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $false)
    if ($null -eq $k) { return $null }
    try {
        $v = $k.GetValue('Path', $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
        if ($null -eq $v) { return $null }
        return [pscustomobject]@{ value = [string]$v; kind = $k.GetValueKind('Path') }
    } finally {
        $k.Close()
    }
}

function Set-UserPathRaw {
    <# Writes the user PATH with the given kind (ExpandString stays REG_EXPAND_SZ; [Environment]::SetEnvironmentVariable
       could store an expanded REG_SZ instead) and tells running programs that the environment changed. #>
    param([string]$Value, [Microsoft.Win32.RegistryValueKind]$Kind)
    $k = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)
    if ($null -eq $k) { throw 'HKCU\Environment not found' }
    try { $k.SetValue('Path', $Value, $Kind) } finally { $k.Close() }
    if (-not ('ShukoEnvBroadcast' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ShukoEnvBroadcast {
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);
    public static void Send() {
        UIntPtr r;
        SendMessageTimeout(new IntPtr(0xffff), 0x001A, UIntPtr.Zero, "Environment", 0x0002, 5000, out r);
    }
}
'@
    }
    [ShukoEnvBroadcast]::Send()
}

function Invoke-UndoStep {
    <# Undo records are data (not closures: a GetNewClosure() block cannot see this script's functions). #>
    param([System.Collections.IDictionary]$Step)
    switch ($Step.kind) {
        'rmdir-if-empty' { if ((Test-Path -LiteralPath $Step.path) -and -not (Get-ChildItem -LiteralPath $Step.path -Force)) { Remove-Item -LiteralPath $Step.path -Force } }
        'move' { Move-Entry -From $Step.from -To $Step.to }
        'junction' { if (-not (Test-Path -LiteralPath $Step.path)) { New-Item -ItemType Junction -Path $Step.path -Target $Step.target | Out-Null } }
        'unjunction' { if (Test-Path -LiteralPath $Step.path) { [IO.Directory]::Delete($Step.path, $false) } }
        'shortcut' { $x = (New-Object -ComObject WScript.Shell).CreateShortcut($Step.path); $x.TargetPath = $Step.target; $x.WorkingDirectory = $Step.workdir; $x.Save() }
        'userpath' { Set-UserPathRaw -Value $Step.value -Kind ([Microsoft.Win32.RegistryValueKind]$Step.valueKind) }
        default { throw "unknown undo step $($Step.kind)" }
    }
}

function Invoke-Undo {
    param([System.Collections.ArrayList]$Steps)
    # Reverse order, but re-creating a junction waits until everything else is undone
    # (its target folder must have been moved back first).
    $done = @()
    $ordered = @()
    for ($i = $Steps.Count - 1; $i -ge 0; $i--) { if ($Steps[$i].kind -ne 'junction') { $ordered += , $Steps[$i] } }
    for ($i = $Steps.Count - 1; $i -ge 0; $i--) { if ($Steps[$i].kind -eq 'junction') { $ordered += , $Steps[$i] } }
    foreach ($s in $ordered) {
        try { Invoke-UndoStep $s; $done += "undo $($s.kind) ok" } catch { $done += "undo $($s.kind) FAILED: $($_.Exception.Message)" }
    }
    return , $done
}

# --- read the current file (throws on errors: never silently fall back) ---
try {
    $raw = Read-ShukoLocalConfig -Path $ConfigPath
} catch {
    Out-Summary -Result 'error' -Message $_.Exception.Message -Code 1
}
$exists = Test-Path -LiteralPath $ConfigPath -PathType Leaf
# -KeepVersions is "given" when it is on the command line, whatever its value (0 must be an error, not "not given")
$keepGiven = $PSBoundParameters.ContainsKey('KeepVersions')
$changing = [bool]($InstallRoot -or $keepGiven -or $BuildRoot -or $BuilderRepo)

$new = [ordered]@{}
if ($exists) {
    foreach ($k in $raw.Keys) { $new[$k] = $raw[$k] }
} else {
    foreach ($k in $script:ShukoLocalDefaults.Keys) { $new[$k] = $script:ShukoLocalDefaults[$k] }
    $new['builderRepo'] = $repo
}

if (-not $changing) {
    if (-not $exists) {
        try {
            Write-ShukoLocalConfig -Path $ConfigPath -Values $new
        } catch {
            Out-Summary -Result 'error' -Message $_.Exception.Message -Code 1
        }
        $summary.actions += 'created local.json with the defaults'
    }
    $summary.values = $new
    try {
        $summary.resolved = Resolve-ShukoLocalConfig -ConfigPath $ConfigPath
    } catch {
        Out-Summary -Result 'error' -Message $_.Exception.Message -Code 1
    }
    Out-Summary -Result 'ok' -Code 0
}

# --- simple values ---
try {
    if ($keepGiven) {
        if ($KeepVersions -lt 1) { throw "KeepVersions must be an integer >= 1 ($KeepVersions)" }
        $new['keepVersions'] = $KeepVersions
        $summary.actions += "keepVersions = $KeepVersions"
    }
    if ($BuildRoot) {
        [void](ConvertTo-ShukoLocalPath -Key 'buildRoot' -Raw $BuildRoot)
        $new['buildRoot'] = $BuildRoot
        $summary.actions += "buildRoot = $BuildRoot (nothing under the old build root is moved)"
    }
    if ($BuilderRepo) {
        $br = ConvertTo-ShukoLocalPath -Key 'builderRepo' -Raw $BuilderRepo
        if (-not (Test-Path -LiteralPath (Join-Path $br 'extensions.lock.json'))) { throw "builderRepo has no extensions.lock.json: $br" }
        $new['builderRepo'] = $BuilderRepo
        $summary.actions += "builderRepo = $BuilderRepo"
    }
    # every path value that will be written must expand to an absolute path
    foreach ($k in $script:ShukoLocalPathKeys) {
        if ($k -eq 'installRoot' -and $InstallRoot) { continue }
        if ($new.Contains($k) -and $null -ne $new[$k]) { [void](ConvertTo-ShukoLocalPath -Key $k -Raw ([string]$new[$k])) }
    }
} catch {
    Out-Summary -Result 'error' -Message $_.Exception.Message -Code 1
}

# --- install root ---
$undo = New-Object System.Collections.ArrayList
if ($InstallRoot) {
    try {
        $before = Resolve-ShukoLocalConfig -ConfigPath $ConfigPath
        $oldRoot = $before.installRoot
        $newRoot = ConvertTo-ShukoLocalPath -Key 'installRoot' -Raw $InstallRoot
        $summary.oldInstallRoot = $oldRoot
        $summary.newInstallRoot = $newRoot
        if ($oldRoot -ieq $newRoot) {
            $summary.actions += 'installRoot unchanged (same place)'
        } else {
            if ((Test-UnderPath $newRoot $oldRoot) -or (Test-UnderPath $oldRoot $newRoot)) {
                throw "the new place and the old place are nested: $oldRoot / $newRoot"
            }
            # 1. running editors
            if (Test-Path -LiteralPath $oldRoot) {
                $busy = @(Get-EditorProcessesUnder $oldRoot)
                if ($busy.Count -gt 0) {
                    $summary.running = @($busy | ForEach-Object { [ordered]@{ pid = [int]$_.ProcessId; path = $_.ExecutablePath } })
                    Out-Summary -Result 'editor-running' -Message "close the editor first: $($busy.Count) process(es) run from $oldRoot" -Code 3
                }
            }
            # 2. local NTFS
            $summary.volume = Assert-LocalNtfs $newRoot
            if (-not (Test-Path -LiteralPath $newRoot)) {
                New-Item -ItemType Directory -Force -Path $newRoot | Out-Null
                [void]$undo.Add([ordered]@{ kind = 'rmdir-if-empty'; path = $newRoot })
            }
            $oldCurrent = Join-Path $oldRoot 'current'
            $newCurrent = Join-Path $newRoot 'current'
            $label = $null
            if (Test-Path -LiteralPath $oldCurrent) {
                $t = Get-JunctionTarget $oldCurrent
                if (-not $t) { throw "$oldCurrent is not a junction" }
                $label = Split-Path -Leaf $t
                $summary.currentLabel = $label
            }
            if (-not $NoMove) {
                $names = @('versions', 'history.txt', 'backups')
                foreach ($n in $names) {
                    if (Test-Path -LiteralPath (Join-Path $newRoot $n)) { throw "the new place already has $n ; refusing to merge: $newRoot" }
                }
                if (Test-Path -LiteralPath $newCurrent) { throw "the new place already has current: $newCurrent" }
                # 3. move
                foreach ($n in $names) {
                    $from = Join-Path $oldRoot $n
                    if (-not (Test-Path -LiteralPath $from)) { continue }
                    $to = Join-Path $newRoot $n
                    Move-Entry -From $from -To $to
                    [void]$undo.Add([ordered]@{ kind = 'move'; from = $to; to = $from })
                    $summary.actions += "moved $from -> $to"
                }
                # 4. junction
                if ($label) {
                    $target = Join-Path (Join-Path $newRoot 'versions') $label
                    if (-not (Test-Path -LiteralPath $target)) { throw "the current version folder was not moved: $target" }
                    [IO.Directory]::Delete($oldCurrent, $false)
                    # Invoke-Undo re-creates junctions last, after the versions folder is moved back
                    [void]$undo.Add([ordered]@{ kind = 'junction'; path = $oldCurrent; target = (Join-Path (Join-Path $oldRoot 'versions') $label) })
                    New-Item -ItemType Junction -Path $newCurrent -Target $target | Out-Null
                    [void]$undo.Add([ordered]@{ kind = 'unjunction'; path = $newCurrent })
                    $summary.actions += "junction $newCurrent -> $target (old junction removed)"
                }
            } else {
                $summary.actions += "NoMove: nothing moved; $oldRoot is left as it is; $newRoot is used as it is"
            }
            # 5. shortcuts and PATH
            if ($NoShellIntegration) {
                $summary.actions += 'NoShellIntegration: Start menu and PATH not touched'
            } else {
                $oldCur = (Join-Path $oldRoot 'current')
                $newCur = (Join-Path $newRoot 'current')
                $programs = [Environment]::GetFolderPath('Programs')
                if ($programs -and (Test-Path -LiteralPath $programs)) {
                    $shell = New-Object -ComObject WScript.Shell
                    foreach ($lnk in @(Get-ChildItem -LiteralPath $programs -Filter '*.lnk' -File)) {
                        $s = $shell.CreateShortcut($lnk.FullName)
                        if ($s.TargetPath -and (Test-UnderPath $s.TargetPath $oldCur)) {
                            $oldTarget = $s.TargetPath; $oldWd = $s.WorkingDirectory
                            $s.TargetPath = $newCur + $s.TargetPath.Substring($oldCur.Length)
                            if ($s.WorkingDirectory -and (Test-UnderPath $s.WorkingDirectory $oldCur)) { $s.WorkingDirectory = $newCur + $s.WorkingDirectory.Substring($oldCur.Length) }
                            $s.Save()
                            [void]$undo.Add([ordered]@{ kind = 'shortcut'; path = $lnk.FullName; target = $oldTarget; workdir = $oldWd })
                            $summary.actions += "shortcut $($lnk.Name) -> $($s.TargetPath)"
                        }
                    }
                }
                # Raw value (REG_EXPAND_SZ keeps %USERPROFILE% etc. unexpanded); written back with the same kind.
                $raw = Get-UserPathRaw
                $summary.userPath = [ordered]@{ found = ($null -ne $raw); kind = $(if ($raw) { "$($raw.kind)" } else { $null }); changed = $false }
                if ($raw) {
                    $oldBin = Join-Path $oldCur 'bin'
                    $newBin = Join-Path $newCur 'bin'
                    $updated = Update-PathEntries -Raw $raw.value -OldBin $oldBin -NewBin $newBin
                    if ($null -ne $updated) {
                        Set-UserPathRaw -Value $updated -Kind $raw.kind
                        [void]$undo.Add([ordered]@{ kind = 'userpath'; value = $raw.value; valueKind = "$($raw.kind)" })
                        $summary.userPath.changed = $true
                        $summary.actions += "user PATH: $oldBin -> $newBin (kept as $($raw.kind))"
                    }
                }
            }
            $new['installRoot'] = $InstallRoot
        }
    } catch {
        $err = $_.Exception.Message
        $summary.undo = Invoke-Undo $undo
        Out-Summary -Result 'error' -Message "$err (local.json is unchanged)" -Code 1
    }
}

# 6. local.json last
try {
    Write-ShukoLocalConfig -Path $ConfigPath -Values $new
} catch {
    $err = $_.Exception.Message
    $summary.undo = Invoke-Undo $undo
    Out-Summary -Result 'error' -Message "writing local.json failed: $err" -Code 1
}
$summary.actions += 'wrote local.json'
$summary.values = $new
try { $summary.resolved = Resolve-ShukoLocalConfig -ConfigPath $ConfigPath } catch { $summary.resolveError = $_.Exception.Message }
Out-Summary -Result 'ok' -Code 0
