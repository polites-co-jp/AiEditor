<#
.SYNOPSIS
  Stops the editor of one Phase 0 environment: its main process(es) and their descendants only.

.DESCRIPTION
  Main processes are found by the environment's exe AND its user data dir on the command line
  (C:\b\p0\data\<name>\user\user-data), without --type=. The daily editor never has that path on
  its command line, so it is never touched. Prefer closing the window; use this when a window hangs
  or before p0-env.ps1 rebuilds the environment.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-stop.ps1 -Name testbed
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-stop.ps1 -Name testbed -WhatIfOnly

  NOTE: this file is ASCII only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Name,
    [switch]$WhatIfOnly
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\p0-common.ps1')

[void](Get-P0EnvDefinition $Name)
$paths = Get-P0EnvPaths $Name
if (-not (Test-Path -LiteralPath $paths.Info)) { throw "environment '$Name' is not built" }
$info = Read-P0Json $paths.Info
$mains = @(Get-P0MainProcesses -ExePath $info.editor.exe -UserData $info.data.userData)
if ($mains.Count -eq 0) { Write-Host "no editor of '$Name' is running"; return }
foreach ($m in $mains) {
    $tree = @(Get-P0ProcessTree -RootId ([int]$m.ProcessId))
    Write-Host ("'{0}': main pid {1}, {2} process(es) in its tree" -f $Name, $m.ProcessId, $tree.Count)
    if (-not $WhatIfOnly) {
        $n = Stop-P0ProcessTree -RootId ([int]$m.ProcessId)
        Write-Host "  stopped $n"
    }
}
