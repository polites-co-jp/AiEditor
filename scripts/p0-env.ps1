<#
.SYNOPSIS
  (Re)creates a Phase 0 test environment under C:\b\p0\data\<name>\ (docs/07 2.1).

.DESCRIPTION
  For the named environment:
    1. resolves the editor (upstream 1.146.0, or the testbed = VSCodium copy minus the
       stage A built-in extensions; the testbed copy is made or reused, see lib\p0-common.ps1),
    2. resolves every VSIX first (fails before touching anything),
    3. deletes C:\b\p0\data\<name>\ (refuses while an editor uses it) and makes user\, user\user-data\ and ext\,
    4. writes user\argv.json (VSCODE_PORTABLE points at user\, so the editor reads it there;
       in portable mode the user data dir is user\user-data, see lib\p0-common.ps1),
    5. installs the extensions with the editor CLI: --install-extension <vsix> --force,
    6. writes user\user-data\User\settings.json (after the installs, so 0-8 case (c) sees an extension
       that was installed before extensions.allowed existed),
    7. records --list-extensions --show-versions and writes p0-env.json.
  Running it again gives the same state.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-env.ps1 -List
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-env.ps1 -Name upstream-ai-disabled
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-env.ps1 -All
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-env.ps1 -Name testbed -RebuildTestbed

  NOTE: this file is ASCII only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
#>
[CmdletBinding()]
param(
    [string]$Name,
    [switch]$All,
    [switch]$List,
    [switch]$RebuildTestbed,
    [switch]$PlanTestbed,
    [string]$VscodiumRoot,
    [string]$UpstreamRoot
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\p0-common.ps1')

if ($List) {
    foreach ($d in Get-P0EnvDefinitions) {
        '{0,-22} {1,-9} measure={2,-5} {3}' -f $d.Name, $d.Base, $d.Measure, $d.Purpose
    }
    return
}
if ($PlanTestbed) {
    # Prints which stage A folders the testbed would remove from VSCodium (copies nothing).
    $src = Resolve-P0Editor (Get-P0VscodiumRoot $VscodiumRoot)
    $names = @(Get-ChildItem -LiteralPath $src.BuiltinExtDir -Directory | ForEach-Object { $_.Name })
    $plan = Get-P0StageAPlan -FolderNames $names
    Write-Host "source: $($src.Root) ($($src.Version)); built-in folders: $($names.Count)"
    foreach ($r in $plan.Remove) { Write-Host ("remove  {0,-26} {1}" -f $r.Unit, $r.Name) }
    foreach ($r in $plan.Skipped) { Write-Host ("skip    {0,-26} {1} (not in VSCodium)" -f $r.Unit, $r.Name) }
    Write-Host ("remove {0}, skip {1}, keep {2}" -f @($plan.Remove).Count, @($plan.Skipped).Count, ($names.Count - @($plan.Remove).Count))
    return
}
if (-not $Name -and -not $All) { throw 'give -Name <environment>, -All, -List or -PlanTestbed' }

$script:TestbedReady = $null

function Get-EditorFor {
    param($Def)
    if ($Def.Base -eq 'upstream') {
        $root = $UpstreamRoot
        if (-not $root) { $root = Get-P0UpstreamRoot }
        return [pscustomobject]@{ Editor = (Resolve-P0Editor $root); Testbed = $null }
    }
    if ($null -eq $script:TestbedReady) {
        $script:TestbedReady = Initialize-P0Testbed -VscodiumRoot $VscodiumRoot -Rebuild:$RebuildTestbed
    }
    return [pscustomobject]@{ Editor = (Resolve-P0Editor (Get-P0TestbedRoot)); Testbed = $script:TestbedReady }
}

function New-P0Env {
    param($Def)
    Write-Host "== $($Def.Name): $($Def.Purpose)"
    $paths = Get-P0EnvPaths $Def.Name
    [void](Assert-P0Path $paths.Root)
    $e = Get-EditorFor $Def
    $editor = $e.Editor
    if (-not $editor.PortableOk) { throw "product.json of $($editor.Root) has 'target'; VSCODE_PORTABLE would be ignored" }

    $devFull = $null
    if ($Def.DevPath) {
        $devFull = Join-Path $script:P0RepoRoot $Def.DevPath
        if (-not (Test-Path -LiteralPath (Join-Path $devFull 'package.json'))) { throw "extension development path has no package.json: $devFull" }
    }

    $vsix = @()
    foreach ($id in $Def.Extensions) {
        $v = Find-P0Vsix $id
        $hash = (Get-FileHash -LiteralPath $v.Path -Algorithm SHA256).Hash.ToLowerInvariant()
        $vsix += [pscustomobject]@{ Id = $id; Path = $v.Path; Version = $v.Version; Sha256 = $hash }
    }

    $busy = @(Get-P0EditorProcesses $paths.Root)
    if ($busy.Count -gt 0) { throw "$($busy.Count) process(es) use $($paths.Root); close that editor first" }
    if (Test-Path -LiteralPath $paths.Root) { Remove-Item -LiteralPath $paths.Root -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $paths.User, $paths.UserData, $paths.Ext | Out-Null

    Write-P0Argv -Path $paths.Argv -Value $Def.Argv

    $log = @("# p0-env $($Def.Name) $((Get-Date).ToString('o'))", "editor: $($editor.Exe) $($editor.Version) $($editor.Commit)", "VSCODE_PORTABLE=$($paths.Portable)", '')
    $installed = @()
    $failed = @()
    foreach ($v in $vsix) {
        $r = Invoke-P0Cli -Editor $editor -Paths $paths -Arguments @('--install-extension', $v.Path, '--force')
        $log += "> --install-extension $($v.Path) --force   (exit $($r.ExitCode))"
        $log += $r.Output
        $log += ''
        $row = [ordered]@{ id = $v.Id; version = $v.Version; vsix = $v.Path; sha256 = $v.Sha256; exitCode = $r.ExitCode; output = @($r.Output) }
        $installed += $row
        if ($r.ExitCode -ne 0) { $failed += $v.Id }
    }

    Write-P0Json -Path $paths.Settings -Value $Def.Settings

    $list = Invoke-P0Cli -Editor $editor -Paths $paths -Arguments @('--list-extensions', '--show-versions')
    $log += "> --list-extensions --show-versions   (exit $($list.ExitCode))"
    $log += $list.Output
    Write-P0Text -Path $paths.Log -Text (($log -join "`r`n") + "`r`n")

    $info = [ordered]@{
        name       = $Def.Name
        purpose    = $Def.Purpose
        base       = $Def.Base
        measure    = $Def.Measure
        createdAt  = (Get-Date).ToString('o')
        editor     = [ordered]@{ root = $editor.Root; exe = $editor.Exe; cli = $editor.Cli; version = $editor.Version; commit = $editor.Commit; productJson = $editor.ProductJson; builtinExtensions = $editor.BuiltinExtDir }
        data       = [ordered]@{ root = $paths.Root; user = $paths.User; userData = $paths.UserData; ext = $paths.Ext; portable = $paths.Portable; argv = $paths.Argv; settings = $paths.Settings }
        env        = [ordered]@{ VSCODE_PORTABLE = $paths.Portable }
        argv       = $Def.Argv
        settings   = $Def.Settings
        extensionDevelopmentPath = $devFull
        extensions = $installed
        listed     = @($list.Output | Where-Object { $_ -match '@' })
        failed     = $failed
        testbed    = $e.Testbed
    }
    Write-P0Json -Path $paths.Info -Value $info

    Write-Host ("   editor   : {0} ({1})" -f $editor.Exe, $editor.Version)
    Write-Host ("   data     : {0}" -f $paths.Root)
    Write-Host ("   installed: {0}" -f (@($list.Output | Where-Object { $_ -match '@' }) -join ', '))
    if ($failed.Count -gt 0) { Write-Warning ("   install failed: {0} (see {1})" -f ($failed -join ', '), $paths.Log) }
    return $failed.Count
}

$targets = @()
if ($All) { $targets = @(Get-P0EnvDefinitions) } else { $targets = @(Get-P0EnvDefinition $Name) }
$bad = 0
foreach ($t in $targets) {
    $n = @(New-P0Env $t)
    $bad += [int]$n[-1]
}
if ($bad -gt 0) { exit 1 }
