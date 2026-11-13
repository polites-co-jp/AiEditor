<#
.SYNOPSIS
  Registers the update watcher (tools/watch/watch.mjs) in Windows Task Scheduler (docs/06 section 2.1).

.DESCRIPTION
  - Runs daily at -At (default 06:00). -StartWhenAvailable: if the PC was off at that time, the task
    starts as soon as possible afterwards.
  - Runs only while the user is logged on (LogonType Interactive, RunLevel Limited), because the Notion
    token is protected with DPAPI of that user (docs/06 section 2.4).
  - The path of watch.mjs comes from builderRepo in local.json (docs/02 section 6.1) via
    scripts/lib/local-config.ps1; -BuilderRepo overrides it. node.exe is resolved now and written as an
    absolute path (Task Scheduler does not see a PATH change made later).
  - Also allowed on battery, one instance at a time, stopped after 30 minutes.
  - -DryRun prints what would be registered and registers nothing.
  - -Unregister removes the task.

.PARAMETER ConfigPath   another local.json (trials)
.PARAMETER BuilderRepo  overrides builderRepo of local.json
.PARAMETER At           daily start time, "HH:mm" (default 06:00)
.PARAMETER TaskName     default "watch"
.PARAMETER TaskPath     default "\Shuko\"
.PARAMETER NodePath     node.exe to use (default: the one found on PATH now)
.PARAMETER DryRun       print only
.PARAMETER Unregister   remove the task

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\watch\register-task.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\watch\register-task.ps1 -DryRun
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\watch\register-task.ps1 -Unregister

  NOTE: this file is ASCII only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
#>
[CmdletBinding()]
param(
    [string]$ConfigPath,
    [string]$BuilderRepo,
    [string]$At = '06:00',
    [string]$TaskName = 'watch',
    [string]$TaskPath = '\Shuko\',
    [string]$NodePath,
    [switch]$DryRun,
    [switch]$Unregister
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot '..\..\scripts\lib\local-config.ps1')

if ($Unregister) {
    $existing = Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue
    if (-not $existing) { Write-Host "register-task: no task $TaskPath$TaskName"; exit 0 }
    if ($DryRun) { Write-Host "register-task: (dry run) would unregister $TaskPath$TaskName"; exit 0 }
    Unregister-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Confirm:$false
    Write-Host "register-task: unregistered $TaskPath$TaskName"
    exit 0
}

if ($At -notmatch '^([01]\d|2[0-3]):[0-5]\d$') { throw "-At must be HH:mm (got '$At')" }

$overrides = @{}
if ($BuilderRepo) { $overrides['builderRepo'] = $BuilderRepo }
$cfg = Resolve-ShukoLocalConfig -ConfigPath $ConfigPath -Overrides $overrides
if (-not $cfg.builderRepo) {
    throw 'builderRepo is not set in local.json. Run scripts\configure.ps1 in the build repository first, or pass -BuilderRepo.'
}
$watch = Join-Path $cfg.builderRepo 'tools\watch\watch.mjs'
if (-not (Test-Path -LiteralPath $watch -PathType Leaf)) { throw "watch.mjs not found: $watch" }

if (-not $NodePath) {
    $cmd = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $cmd) { throw 'node.exe not found on PATH; pass -NodePath' }
    $NodePath = $cmd.Source
}
if (-not (Test-Path -LiteralPath $NodePath -PathType Leaf)) { throw "node.exe not found: $NodePath" }

$userId = if ($env:USERDOMAIN) { "$env:USERDOMAIN\$env:USERNAME" } else { $env:USERNAME }
$argument = '"' + $watch + '"'

$time = [datetime]::ParseExact($At, 'HH:mm', [Globalization.CultureInfo]::InvariantCulture)
$action = New-ScheduledTaskAction -Execute $NodePath -Argument $argument -WorkingDirectory $cfg.builderRepo
$trigger = New-ScheduledTaskTrigger -Daily -At $time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$description = 'Shuko update watcher (docs/06 section 2). Writes Notion ToDo items for new VS Code / extension versions.'

Write-Host "register-task: task      $TaskPath$TaskName"
Write-Host "register-task: run       $NodePath $argument"
Write-Host "register-task: in        $($cfg.builderRepo)  (builderRepo from $($cfg.sources.builderRepo))"
Write-Host "register-task: daily at  $At  (StartWhenAvailable, only while $userId is logged on)"

if ($DryRun) {
    Write-Host 'register-task: (dry run) nothing registered.'
    exit 0
}

Register-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal -Description $description -Force | Out-Null
Write-Host "register-task: registered. Check with: Get-ScheduledTask -TaskPath '$TaskPath' | Get-ScheduledTaskInfo"
exit 0
