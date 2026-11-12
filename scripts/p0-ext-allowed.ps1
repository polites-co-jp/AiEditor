<#
.SYNOPSIS
  0-8 automatic part (docs/07 2.9): how extensions.allowed acts on the CLI.

.DESCRIPTION
  1. Rebuilds the ext-allowed environment with scripts\p0-env.ps1 (Claude Code and rainbow-csv are
     installed first, then settings.json gets extensions.allowed = {"*": false, "anthropic.claude-code": true}).
  2. (c) --list-extensions --show-versions: is the already-installed, non-allowed rainbow-csv listed?
  3. (a) --install-extension <vsix> --force for non-allowed VSIX (tomoki1207.pdf, ms-vscode.sublime-keybindings):
     exit code and output; is it listed / on disk afterwards?
  4. control: --install-extension of the allowed Claude Code VSIX.
  5. --list-extensions again, and the folders + extensions.json under the ext dir.
  Writes everything to C:\b\p0\logs\ext-allowed-<timestamp>\ (result.json + one .txt per step).
  (b) "Install from VSIX..." in the UI is done by the user by hand.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-ext-allowed.ps1

  NOTE: this file is ASCII only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
#>
[CmdletBinding()]
param([switch]$NoRebuild)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\p0-common.ps1')

if (-not $NoRebuild) {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'p0-env.ps1') -Name ext-allowed
    if ($LASTEXITCODE -ne 0) { throw "p0-env.ps1 -Name ext-allowed failed ($LASTEXITCODE)" }
}
$paths = Get-P0EnvPaths 'ext-allowed'
$info = Read-P0Json $paths.Info
$editor = Resolve-P0Editor $info.editor.root

$out = Assert-P0Path (Join-Path $script:P0Root ('logs\ext-allowed-' + (Get-Date -Format 'yyyyMMdd-HHmmss')))
New-Item -ItemType Directory -Force -Path $out | Out-Null
Copy-Item -LiteralPath $paths.Settings -Destination (Join-Path $out 'settings.json')

function Step {
    param([string]$Label, [string[]]$CliArgs)
    $r = Invoke-P0Cli -Editor $editor -Paths $paths -Arguments $CliArgs
    $text = @("> $($CliArgs -join ' ')", "exit $($r.ExitCode)", '') + $r.Output
    Write-P0Text -Path (Join-Path $out ($Label + '.txt')) -Text (($text -join "`r`n") + "`r`n")
    Write-Host ("[{0}] exit {1}: {2}" -f $Label, $r.ExitCode, (($r.Output | Select-Object -First 3) -join ' | '))
    return [ordered]@{ step = $Label; args = $CliArgs; exitCode = $r.ExitCode; output = @($r.Output) }
}

function Get-Listed {
    param($StepResult)
    return @($StepResult.output | Where-Object { $_ -match '^[A-Za-z0-9-]+\.[A-Za-z0-9-]+@' })
}

$steps = @()
$s1 = Step 'c-list-before' @('--list-extensions', '--show-versions'); $steps += $s1
$pdf = Find-P0Vsix 'tomoki1207.pdf'
$sub = Find-P0Vsix $script:P0SublimeId
$cc = Find-P0Vsix 'anthropic.claude-code'
$s2 = Step 'a-install-pdf' @('--install-extension', $pdf.Path, '--force'); $steps += $s2
$s3 = Step 'a-install-sublime' @('--install-extension', $sub.Path, '--force'); $steps += $s3
$s4 = Step 'control-install-claude-code' @('--install-extension', $cc.Path, '--force'); $steps += $s4
$s5 = Step 'list-after' @('--list-extensions', '--show-versions'); $steps += $s5

$folders = @(Get-ChildItem -LiteralPath $paths.Ext -Directory | ForEach-Object { $_.Name } | Sort-Object)
$extJson = Join-Path $paths.Ext 'extensions.json'
$extJsonIds = @()
if (Test-Path -LiteralPath $extJson) {
    Copy-Item -LiteralPath $extJson -Destination (Join-Path $out 'extensions.json')
    $extJsonIds = @((Read-P0Json $extJson) | ForEach-Object { "$($_.identifier.id)@$($_.version)" })
}

$before = Get-Listed $s1
$after = Get-Listed $s5
$result = [ordered]@{
    createdAt = (Get-Date).ToString('o')
    editor = [ordered]@{ exe = $editor.Exe; version = $editor.Version }
    setting = (Read-P0Json $paths.Settings).'extensions.allowed'
    c_listedBefore = $before
    c_rainbowCsvListed = [bool]($before | Where-Object { $_ -like 'mechatroner.rainbow-csv@*' })
    a_pdf = [ordered]@{ exitCode = $s2.exitCode; listedAfter = [bool]($after | Where-Object { $_ -like 'tomoki1207.pdf@*' }); folder = [bool]($folders | Where-Object { $_ -like 'tomoki1207.pdf-*' }) }
    a_sublime = [ordered]@{ exitCode = $s3.exitCode; listedAfter = [bool]($after | Where-Object { $_ -like 'ms-vscode.sublime-keybindings@*' }); folder = [bool]($folders | Where-Object { $_ -like 'ms-vscode.sublime-keybindings-*' }) }
    control_claudeCode = [ordered]@{ exitCode = $s4.exitCode }
    listedAfter = $after
    extFolders = $folders
    extensionsJson = $extJsonIds
    steps = $steps
}
Write-P0Json -Path (Join-Path $out 'result.json') -Value $result
Write-Host "result: $(Join-Path $out 'result.json')"
