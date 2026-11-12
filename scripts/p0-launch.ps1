<#
.SYNOPSIS
  Starts the editor of a Phase 0 environment made by scripts\p0-env.ps1, opening the
  measurement workspace <repo>\tmp\ws (for the checks the user does by hand).

.DESCRIPTION
  Reads C:\b\p0\data\<name>\p0-env.json and starts
    <exe> --user-data-dir <data>\user\user-data --extensions-dir <data>\ext
          [--extensionDevelopmentPath=<repo>\extensions-src\mydist] <workspace>
  The child gets ELECTRON_RUN_AS_NODE, ELECTRON_NO_ATTACH_CONSOLE and every VSCODE_* removed and
  only VSCODE_PORTABLE=<data>\user set (argv.json is read from the environment, not from
  %USERPROFILE%\.vscode or .vscode-oss). Same idea as Start-EditorProcess in scripts\measure.ps1.

  After starting, it waits -CheckSeconds and checks that the process is still alive. If it has
  ended, the script fails (exit 1), unless the start was handed over to an editor of the same
  environment that was already running (then it says so and exits 0).

  -SmokeSeconds <n>: start, check alive, wait n seconds, report the process tree, then stop exactly
  the started process and its descendants (for an agent to test the launcher; nothing else is stopped).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-launch.ps1 -Name upstream-ai-disabled
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-launch.ps1 -Name mydist -NoWorkspace
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-launch.ps1 -Name testbed -PrintOnly
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-launch.ps1 -Name testbed -SmokeSeconds 20
  (stop an environment's editor: scripts/p0-stop.ps1 -Name <name>)

  NOTE: this file is ASCII only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Name,
    [string]$Workspace,
    [switch]$NoWorkspace,
    [string[]]$ExtraArgs = @(),
    [switch]$PrintOnly,
    [int]$CheckSeconds = 8,
    [int]$SmokeSeconds = 0
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\p0-common.ps1')

if (-not $Workspace) { $Workspace = $script:P0Workspace }
[void](Get-P0EnvDefinition $Name)
$paths = Get-P0EnvPaths $Name
if (-not (Test-Path -LiteralPath $paths.Info)) {
    throw "environment '$Name' is not built yet; run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-env.ps1 -Name $Name"
}
$info = Read-P0Json $paths.Info
if (-not (Test-Path -LiteralPath $info.editor.exe)) { throw "editor exe is gone: $($info.editor.exe); rebuild the environment" }

function Format-Arg {
    param([string]$A)
    if ($A -match '[\s"]') { return '"' + ($A -replace '"', '\"') + '"' }
    return $A
}

$argList = @('--user-data-dir', $info.data.userData, '--extensions-dir', $info.data.ext)
if ($info.extensionDevelopmentPath) { $argList += ('--extensionDevelopmentPath=' + $info.extensionDevelopmentPath) }
$argList += $ExtraArgs
if (-not $NoWorkspace) {
    if (Test-Path -LiteralPath $Workspace) {
        $argList += $Workspace
    } else {
        Write-Warning "workspace not found: $Workspace (clone it first; see scripts\p0-ws.ps1). Starting without a folder."
    }
}
$argLine = ($argList | ForEach-Object { Format-Arg $_ }) -join ' '

Write-Host "VSCODE_PORTABLE=$($info.data.portable) (ELECTRON_RUN_AS_NODE, ELECTRON_NO_ATTACH_CONSOLE, other VSCODE_* removed for the child)"
Write-Host "$($info.editor.exe) $argLine"
if ($PrintOnly) { return }

$before = @(Get-P0MainProcesses -ExePath $info.editor.exe -UserData $info.data.userData | ForEach-Object { [int]$_.ProcessId })
$exe = $info.editor.exe
$p = Invoke-P0WithEditorEnv -Portable $info.data.portable -Body { Start-Process -FilePath $exe -ArgumentList $argLine -PassThru }
$null = $p.Handle   # keep a handle so ExitCode is readable after the process ends
Write-Host "started pid $($p.Id) ($Name); checking it is alive for $CheckSeconds s"

$deadline = (Get-Date).AddSeconds($CheckSeconds)
while ((Get-Date) -lt $deadline -and -not $p.HasExited) { Start-Sleep -Milliseconds 500 }
if ($p.HasExited) {
    $code = $p.ExitCode
    if ($before.Count -gt 0) {
        Write-Host "pid $($p.Id) ended (exit $code): handed over to the editor of '$Name' that was already running (pid $($before -join ', '))."
        exit 0
    }
    $msg = "FAILED: the editor ended within {0} s (exit code {1}). Nothing is running for '{2}'. See the logs under {3}\logs\ (newest folder, main.log)." -f $CheckSeconds, $code, $Name, $info.data.userData
    [Console]::Error.WriteLine($msg)
    exit 1
}
$tree = @(Get-P0ProcessTree -RootId $p.Id)
Write-Host ("OK: pid {0} is alive with {1} process(es) in its tree." -f $p.Id, $tree.Count)

if ($SmokeSeconds -gt 0) {
    Start-Sleep -Seconds $SmokeSeconds
    if ($p.HasExited) {
        [Console]::Error.WriteLine(("FAILED: pid {0} ended during the smoke wait (exit code {1})." -f $p.Id, $p.ExitCode))
        exit 1
    }
    $tree = @(Get-P0ProcessTree -RootId $p.Id)
    $names = @($tree | Group-Object Name | ForEach-Object { '{0} x{1}' -f $_.Name, $_.Count }) -join ', '
    Write-Host ("smoke: after {0} s pid {1} is alive; tree {2} process(es): {3}" -f $SmokeSeconds, $p.Id, $tree.Count, $names)
    $n = Stop-P0ProcessTree -RootId $p.Id
    Start-Sleep -Seconds 2
    $left = @(Get-P0MainProcesses -ExePath $info.editor.exe -UserData $info.data.userData)
    Write-Host ("smoke: stopped {0} process(es) (pid {1} and its descendants only); main processes of '{2}' left: {3}" -f $n, $p.Id, $Name, $left.Count)
}
