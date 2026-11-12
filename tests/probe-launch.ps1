# Diagnostic (not a test): start the real editor from an env template like measure.ps1 does and show
# what is running 15 s later. Usage: -File tests/probe-launch.ps1 <EnvDir> <Workspace>
param([string]$EnvDir = 'C:\b\p0\data\upstream-default', [string]$Workspace = '')
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
# measure.ps1 has parameters of the same names; keep ours before dot-sourcing it
$keepEnv = $EnvDir
$keepWs = $Workspace
. (Join-Path (Split-Path -Parent $here) 'scripts\measure.ps1')
$EnvDir = $keepEnv
$Workspace = $keepWs
$rec = Read-P0EnvRecord $EnvDir
$exe = $rec.editor.exe
Write-Host "exe: $exe"
$data = New-RunDataDir -EnvDir $EnvDir -WorkRoot 'C:\b\p0\run' -Name 'probe'
Write-Host "user: $($data.User)"
$ws = $Workspace
if (-not $ws) { $ws = Join-Path (Split-Path -Parent $here) 'tmp\ws' }
$p = Start-Editor -Exe $exe -User $data.User -Ext $data.Ext -Workspace $ws
Write-Host "started pid $($p.Id)"
Start-Sleep -Seconds 15
Write-Host "launcher exited: $($p.HasExited)"
if ($p.HasExited) { Write-Host "exit code: $($p.ExitCode)" }
Write-Host ("command line: " + (Get-EditorArguments -User $data.User -Ext $data.Ext -Workspace $ws))
$logs = @(Get-ChildItem -LiteralPath $data.User -Recurse -Filter '*.log' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime | Select-Object -Last 3)
foreach ($l in $logs) { Write-Host "log: $($l.FullName)"; Get-Content -LiteralPath $l.FullName -TotalCount 15 | ForEach-Object { Write-Host "    $_" } }
$all = @(Get-ProcessSnapshot)
$name = [IO.Path]::GetFileName($exe)
$mine = @($all | Where-Object { $_.Name -ieq $name })
Write-Host "processes named ${name}: $($mine.Count)"
foreach ($m in ($mine | Select-Object -First 6)) {
    $c = "$($m.CommandLine)"
    if ($c.Length -gt 260) { $c = $c.Substring(0, 260) }
    Write-Host ("  pid {0} ppid {1} : {2}" -f $m.ProcessId, $m.ParentProcessId, $c)
}
$main = @(Find-MainProcesses -Processes $all -ExeName $name -UserDir $data.User)
Write-Host "main found: $($main.Count)"
$ids = @($main | ForEach-Object { [int]$_.ProcessId })
if ($ids.Count -eq 0 -and -not $p.HasExited) { $ids = @([int]$p.Id) }
if ($ids.Count -gt 0) { Stop-EditorTree -Tree (Get-Descendants -Processes $all -RootIds $ids) }
Start-Sleep -Seconds 3
Remove-Item -LiteralPath $data.Root -Recurse -Force -ErrorAction SilentlyContinue
