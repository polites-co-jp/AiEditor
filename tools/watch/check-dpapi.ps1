<#
.SYNOPSIS
  Checks that DPAPI saving and reading work on this PC for this user, without a real token.

.DESCRIPTION
  Makes a random dummy value in memory, protects it the same way as tools/watch/set-token.ps1
  (ConvertFrom-SecureString without a key = DPAPI of the current user), writes "<Dir>\selfcheck.dpapi",
  reads it back with scripts/lib/read-secret.ps1 in a separate process (the same way the watcher does)
  and compares. Prints OK or NG; the dummy value itself is never printed.

  -Keep leaves the file. Use it for the Phase 4 check "another user cannot decrypt it" (docs/06 2.4):
  run this as user A with -Keep, then as user B run
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\lib\read-secret.ps1 -Path <Dir>\selfcheck.dpapi
  and expect exit code 4. The kept file also serves as a dummy token file for trials of watch.mjs
  (--token-file).

.PARAMETER Dir
  Where to write selfcheck.dpapi (required; not the secret place).
.PARAMETER Keep
  Do not delete the file afterwards.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/watch/check-dpapi.ps1 -Dir C:\b\p4-watch\trial
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/watch/check-dpapi.ps1 -Dir C:\b\p4-watch\trial -Keep

  NOTE: this file is ASCII only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Dir,
    [switch]$Keep
)

$ErrorActionPreference = 'Stop'

$Dir = [IO.Path]::GetFullPath($Dir)
if (-not (Test-Path -LiteralPath $Dir)) { New-Item -ItemType Directory -Force -Path $Dir | Out-Null }
$file = Join-Path $Dir 'selfcheck.dpapi'

# Dummy value: shaped like a Notion token (prefix + 43 random letters/digits), never printed.
$chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
$bytes = New-Object byte[] 43
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$sb = New-Object System.Text.StringBuilder
[void]$sb.Append('ntn_selfcheck_')
foreach ($b in $bytes) { [void]$sb.Append($chars[$b % $chars.Length]) }
$dummy = $sb.ToString()

$secure = ConvertTo-SecureString -String $dummy -AsPlainText -Force
$secure | ConvertFrom-SecureString | Set-Content -LiteralPath $file -Encoding Ascii
$secure.Dispose()

$reader = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\scripts\lib\read-secret.ps1'))
$back = & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $reader -Path $file
$code = $LASTEXITCODE

$fileText = [IO.File]::ReadAllText($file)
$plainInFile = $fileText.Contains($dummy)

$ok = ($code -eq 0) -and ([string]$back -ceq $dummy) -and (-not $plainInFile)
Write-Host ("check-dpapi: file={0} bytes={1} read-secret exit={2} same={3} plainTextInFile={4}" -f $file, $fileText.Length, $code, ([string]$back -ceq $dummy), $plainInFile)
$dummy = $null; $back = $null

if (-not $Keep) { Remove-Item -LiteralPath $file -Force }
if ($ok) { Write-Host 'check-dpapi: OK'; exit 0 }
Write-Host 'check-dpapi: NG'
exit 1
