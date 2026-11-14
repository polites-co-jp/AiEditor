# Test probe: runs the shortcut-repointing block of scripts/configure.ps1 (step 5) on a temporary "Programs" folder.
# The block is taken out of the script by syntax tree (the if-statement that tests $programs), so the real code is
# what runs; only $programs is replaced by -ProgramsDir. It never touches the real Start menu, PATH or registry.
# Creates shortcuts from -SpecPath: [ { rel, target, workdir } ] under -ProgramsDir, runs the block, prints
# [ { rel, target, workdir } ] read back, plus the summary actions and undo entries.
# ASCII only (Windows PowerShell 5.1 reads a BOM-less script as ANSI).
param(
    [Parameter(Mandatory = $true)][string]$ScriptPath,
    [Parameter(Mandatory = $true)][string]$ProgramsDir,
    [Parameter(Mandatory = $true)][string]$SpecPath,
    [Parameter(Mandatory = $true)][string]$OldRoot,
    [Parameter(Mandatory = $true)][string]$NewRoot
)
$ErrorActionPreference = 'Stop'
if ($ProgramsDir -notlike '*tests-*' -and $ProgramsDir -notlike '*trial*') { throw 'ProgramsDir must be a temporary test folder' }
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($ScriptPath, [ref]$tokens, [ref]$errors)
if ($errors.Count -gt 0) { throw "parse errors in $ScriptPath" }
$fn = $ast.Find({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Test-UnderPath' }, $true)
if ($null -eq $fn) { throw 'Test-UnderPath not found' }
Invoke-Expression $fn.Extent.Text
$blk = $ast.Find({ param($n) $n -is [System.Management.Automation.Language.IfStatementAst] -and $n.Clauses[0].Item1.Extent.Text -like '$programs -and*' }, $true)
if ($null -eq $blk) { throw 'shortcut block not found' }
$shell0 = New-Object -ComObject WScript.Shell
$spec = Get-Content -LiteralPath $SpecPath -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($e in @($spec)) {
    $f = Join-Path $ProgramsDir $e.rel
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $f) | Out-Null
    $s = $shell0.CreateShortcut($f)
    $s.TargetPath = [string]$e.target
    if ($e.workdir) { $s.WorkingDirectory = [string]$e.workdir }
    $s.Save()
}
$programs = $ProgramsDir
$oldCur = Join-Path $OldRoot 'current'
$newCur = Join-Path $NewRoot 'current'
$undo = New-Object System.Collections.ArrayList
$summary = [ordered]@{ actions = @() }
Invoke-Expression $blk.Extent.Text
$back = @()
foreach ($e in @($spec)) {
    $s = $shell0.CreateShortcut((Join-Path $ProgramsDir $e.rel))
    $back += [pscustomobject]@{ rel = $e.rel; target = $s.TargetPath; workdir = $s.WorkingDirectory }
}
Write-Output (ConvertTo-Json -InputObject ([pscustomobject]@{ shortcuts = @($back); actions = @($summary.actions); undo = @($undo) }) -Depth 5 -Compress)
