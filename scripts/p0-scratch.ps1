<#
.SYNOPSIS
  (Re)creates the throw-away folder C:\b\p0\scratch for the hand checks of Phase 0
  (edit, save, git stage/commit, language checks), so that the measurement workspace
  <repo>\tmp\ws is never changed.

.DESCRIPTION
  Deletes C:\b\p0\scratch (refuses while an editor has it open), makes a new git repository there
  with a local user name/e-mail (only in this repository's .git\config), writes small sample files
  that should make the language tools report something, and commits them once.

    sample.ts    TypeScript: a type error (string assigned to number)
    sample.py    Python (basedpyright): adding int and str
    sample.csv   CSV (rainbow-csv): a row with a different number of columns
    .env         .env: a valid line and a line without '='
    sample.sh    sh (bash-ide + ShellCheck): unquoted $1 (SC2086)
    sample.ps1   PowerShell (PSScriptAnalyzer): an alias (gci) and an unused variable
    sample.json  JSON: a trailing comma
    sample.html, sample.css, README.md (Markdown preview), notes.txt (to edit, diff and commit)
    .vscode\tasks.json  one task "p0-scratch-echo" (echo p0-scratch-task-ok), run by hand only
    image.png    copied from the editor's own resources (for the image preview), when found

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-scratch.ps1

  NOTE: this file is ASCII only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
#>
[CmdletBinding()]
param([string]$Path = 'C:\b\p0\scratch')

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\p0-common.ps1')

$dir = Assert-P0Path $Path
$busy = @(Get-P0EditorProcesses $dir)
if ($busy.Count -gt 0) { throw "$($busy.Count) process(es) use $dir; close that editor window first" }
if (Test-Path -LiteralPath $dir) { Remove-Item -LiteralPath $dir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$files = [ordered]@{
    'sample.ts'   = "const count: number = `"three`";`nexport function twice(x: number): number {`n  return x * 2;`n}`nconsole.log(twice(count));`n"
    'sample.py'   = "def add(x: int) -> int:`n    return x + `"one`"`n`n`nprint(add(1))`n"
    'sample.csv'  = "id,name,score`n1,alice,90`n2,bob`n3,carol,75`n"
    '.env'        = "API_URL=https://example.invalid`nTHIS LINE HAS NO EQUALS SIGN`nDEBUG=true`n"
    'sample.sh'   = "#!/bin/bash`necho `$1`nls `$HOME/*.txt`n"
    'sample.ps1'  = "`$unused = 1`ngci . | ForEach-Object { Write-Host `$_.Name }`n"
    'sample.json' = "{`n  `"name`": `"p0`",`n  `"items`": [1, 2, 3],`n}`n"
    'sample.html' = "<!DOCTYPE html>`n<html>`n<head><title>p0</title><link rel=`"stylesheet`" href=`"sample.css`"></head>`n<body>`n  <p class=`"note`">hello</p>`n</body>`n</html>`n"
    'sample.css'  = ".note {`n  color: #333;`n  margin: 4px`n}`n"
    'README.md'   = "# p0 scratch`n`nThrow-away folder for the Phase 0 hand checks. Recreate it with scripts/p0-scratch.ps1.`n`n- item one`n- item two`n`n![image](image.png)`n"
    'notes.txt'   = "line 1`nline 2`nline 3`n"
    # a task to run by hand (Terminal > Run Task...). No runOn: it must not start by itself.
    '.vscode\tasks.json' = "{`n  `"version`": `"2.0.0`",`n  `"tasks`": [`n    {`n      `"label`": `"p0-scratch-echo`",`n      `"type`": `"shell`",`n      `"command`": `"echo p0-scratch-task-ok`",`n      `"problemMatcher`": []`n    }`n  ]`n}`n"
}
foreach ($k in $files.Keys) { Write-P0Text -Path (Join-Path $dir $k) -Text $files[$k] }

$png = $null
foreach ($root in @((Get-P0UpstreamRoot), (Get-P0TestbedRoot))) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    $png = Get-ChildItem -LiteralPath $root -Recurse -File -Filter '*.png' -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match '\\resources\\app\\resources\\' -and $_.Length -gt 1000 } | Select-Object -First 1
    if ($png) { break }
}
if ($png) { Copy-Item -LiteralPath $png.FullName -Destination (Join-Path $dir 'image.png') }

$git = @(
    @('init', '-q'),
    @('config', 'user.name', 'p0-scratch'),
    @('config', 'user.email', 'p0-scratch@example.invalid'),
    @('add', '-A'),
    @('commit', '-q', '-m', 'p0 scratch: initial sample files')
)
foreach ($g in $git) {
    $r = Invoke-P0Native -FilePath 'git' -Arguments (@('-C', $dir) + $g)
    if ($r.ExitCode -ne 0) { throw "git $($g -join ' ') failed: $($r.Output -join ' ')" }
}
$head = (Invoke-P0Native -FilePath 'git' -Arguments @('-C', $dir, 'rev-parse', '--short', 'HEAD')).Output | Select-Object -First 1
Write-Host "scratch: $dir (git commit $head); files: $(@(Get-ChildItem -LiteralPath $dir -Force -File | ForEach-Object { $_.Name }) -join ', ')"
if (-not $png) { Write-Warning 'no PNG found to copy; put any image as image.png by hand' }
