<#
.SYNOPSIS
  Creates the Start menu shortcut of Shuko with the AppUserModelID (decision 2026-11-18,
  "New Window" in the taskbar right-click menu).

.DESCRIPTION
  Windows shows the jump list (the upstream "New Window" task) of a window that names an explicit
  AppUserModelID only when a Start menu shortcut carries the same ID. The zip install of Shuko has no
  such shortcut; this script makes one. Run it once by hand (the user does the first Start menu set-up).

  Writes one shortcut (-ShortcutPath; an old file of the same name is replaced; no other .lnk is touched):
    target            <InstallRoot>\current\Shuko.exe   (through the "current" junction, never versions\<label>)
    working directory <InstallRoot>\current
    System.AppUserModel.ID (PKEY {9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3}, 5) = -AppUserModelId
  Then reads the file back and prints three lines to stdout:
    TargetPath=<...>
    WorkingDirectory=<...>
    AppUserModelId=<...>
  Stops without writing when <InstallRoot>\current\Shuko.exe does not exist.

  -Read : writes nothing; prints the same three lines of the shortcut at -ShortcutPath
          (AppUserModelId= is empty when the shortcut has no ID).

  Defaults:
    -InstallRoot     installRoot of local.json (-ConfigPath, default %LOCALAPPDATA%\Shuko\local.json),
                     else %LOCALAPPDATA%\Programs\Shuko
    -ShortcutPath    <[Environment]::GetFolderPath('Programs')>\Shuko.lnk
    -AppUserModelId  win32AppUserModelId of <InstallRoot>\current\resources\app\product.json,
                     else set.win32AppUserModelId of product.overlay.json (this repository)

  No network. Messages go to stderr.
  Exit codes: 0 ok, 1 error (nothing written, or -Read could not read), 2 written but the read-back
  values differ from the expected ones.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-menu-shortcut.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-menu-shortcut.ps1 -Read
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-menu-shortcut.ps1 -InstallRoot <root> -ShortcutPath <tmp>\Shuko.lnk

  NOTE: this file is ASCII only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
#>
[CmdletBinding()]
param(
    [string]$InstallRoot,
    [string]$ShortcutPath,
    [string]$AppUserModelId,
    [switch]$Read,
    [string]$ConfigPath
)

$ErrorActionPreference = 'Stop'
if ([Console]::IsOutputRedirected) { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) }

function Write-Msg { param([string]$Text) [Console]::Error.WriteLine("[start-menu-shortcut] $Text") }
function Stop-With { param([string]$Text, [int]$Code) Write-Msg $Text; exit $Code }

function Write-Values {
    param($Lnk)
    [Console]::Out.WriteLine("TargetPath=$($Lnk.targetPath)")
    [Console]::Out.WriteLine("WorkingDirectory=$($Lnk.workingDirectory)")
    [Console]::Out.WriteLine("AppUserModelId=$($Lnk.appUserModelId)")
}

function Get-JsonValue {
    <# win32AppUserModelId of a JSON file (at the top level, or under "set" for the overlay), or $null. #>
    param([string]$File, [string]$Under)
    if (-not (Test-Path -LiteralPath $File -PathType Leaf)) { return $null }
    try {
        $raw = [IO.File]::ReadAllText($File)
        if ($raw.Length -gt 0 -and $raw[0] -eq [char]0xFEFF) { $raw = $raw.Substring(1) }
        $o = ConvertFrom-Json -InputObject $raw -ErrorAction Stop
        if ($Under) { $o = $o.$Under }
        if ($null -eq $o) { return $null }
        $v = $o.win32AppUserModelId
        if ($v -is [string] -and $v.Trim() -ne '') { return $v }
    } catch {
        Write-Msg "cannot read ${File}: $($_.Exception.Message)"
    }
    return $null
}

try {
    . (Join-Path $PSScriptRoot 'lib\shell-link.ps1')

    # --- shortcut path ---
    if (-not $ShortcutPath) {
        $programs = [Environment]::GetFolderPath('Programs')
        if (-not $programs) { throw 'the Programs folder of the Start menu is unknown' }
        $ShortcutPath = Join-Path $programs 'Shuko.lnk'
    }
    $ShortcutPath = [IO.Path]::GetFullPath($ShortcutPath)
    if ([IO.Path]::GetExtension($ShortcutPath) -ine '.lnk') { throw "ShortcutPath must end with .lnk: $ShortcutPath" }

    # --- -Read: print and stop ---
    if ($Read) {
        if (-not (Test-Path -LiteralPath $ShortcutPath -PathType Leaf)) { Stop-With "no shortcut: $ShortcutPath" 1 }
        Write-Values (Read-ShukoShortcut -Path $ShortcutPath)
        exit 0
    }

    # --- install root ---
    if (-not $InstallRoot) {
        . (Join-Path $PSScriptRoot 'lib\local-config.ps1')
        $resolved = Resolve-ShukoLocalConfig -ConfigPath $ConfigPath
        $InstallRoot = $resolved.installRoot
        Write-Msg "installRoot ($($resolved.sources.installRoot)): $InstallRoot"
    }
    $InstallRoot = [IO.Path]::GetFullPath($InstallRoot)
    if ($InstallRoot -notmatch '^[A-Za-z]:\\$') { $InstallRoot = $InstallRoot.TrimEnd('\', '/') }
    $current = Join-Path $InstallRoot 'current'
    $exe = Join-Path $current 'Shuko.exe'
    if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) { Stop-With "not found: $exe (nothing written)" 1 }

    # --- ID ---
    if (-not $AppUserModelId) {
        $AppUserModelId = Get-JsonValue -File (Join-Path $current 'resources\app\product.json')
        if ($AppUserModelId) {
            Write-Msg "AppUserModelId from product.json: $AppUserModelId"
        } else {
            $AppUserModelId = Get-JsonValue -File (Join-Path $PSScriptRoot '..\product.overlay.json') -Under 'set'
            if (-not $AppUserModelId) { Stop-With 'no AppUserModelId (product.json and product.overlay.json have none; give -AppUserModelId)' 1 }
            Write-Msg "AppUserModelId from product.overlay.json: $AppUserModelId"
        }
    }

    # --- write ---
    $dir = Split-Path -Parent $ShortcutPath
    if (-not (Test-Path -LiteralPath $dir -PathType Container)) { Stop-With "the folder does not exist: $dir (nothing written)" 1 }
    Write-ShukoShortcut -Path $ShortcutPath -TargetPath $exe -WorkingDirectory $current -AppUserModelId $AppUserModelId
    Write-Msg "wrote $ShortcutPath"

    # --- read back ---
    $got = Read-ShukoShortcut -Path $ShortcutPath
    Write-Values $got
    $bad = @()
    if ($got.targetPath.TrimEnd('\') -ine $exe) { $bad += "TargetPath is $($got.targetPath), expected $exe" }
    if ($got.workingDirectory.TrimEnd('\') -ine $current) { $bad += "WorkingDirectory is $($got.workingDirectory), expected $current" }
    if ($got.appUserModelId -cne $AppUserModelId) { $bad += "AppUserModelId is '$($got.appUserModelId)', expected '$AppUserModelId'" }
    if ($bad.Count -gt 0) { Stop-With ("read-back differs: " + ($bad -join ' / ')) 2 }
    Write-Msg 'ok. Restart Shuko, then right-click its taskbar button to see "New Window".'
    exit 0
} catch {
    Stop-With $_.Exception.Message 1
}
