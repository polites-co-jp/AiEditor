<#
.SYNOPSIS
  Reads a DPAPI-protected secret file and writes the plain value to standard output (docs/06 section 2.4).

.DESCRIPTION
  The file holds the output of ConvertFrom-SecureString without a key, which uses the Windows Data
  Protection API (DPAPI) of the current user. This script turns it back with ConvertTo-SecureString and
  prints the value with no trailing newline. Nothing else is printed to standard output.

  Callers (tools/watch/watch.mjs, scripts/take-in.mjs through scripts/lib/notion-client.mjs) run it as:
    powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts\lib\read-secret.ps1 -Path <file>
  and keep the value in memory only. Agents never open the secret files themselves; only this script does.

  Exit codes (messages go to standard error and never contain the value):
    0  ok
    2  the file does not exist
    3  the file is empty
    4  cannot decrypt (written by another user or on another PC, or not DPAPI output)
    5  the decrypted value is empty

  The file is written by tools/watch/set-token.ps1 (Read-Host -AsSecureString | ConvertFrom-SecureString).

.EXAMPLE
  powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/lib/read-secret.ps1 -Path C:\b\p4-watch\trial\selfcheck.dpapi

  NOTE: this file is ASCII only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Path
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    [Console]::Error.WriteLine("read-secret: the secret file does not exist: $Path")
    exit 2
}

$encrypted = ([IO.File]::ReadAllText($Path)).Trim()
if ($encrypted.Length -gt 0 -and $encrypted[0] -eq [char]0xFEFF) { $encrypted = $encrypted.Substring(1).Trim() }
if (-not $encrypted) {
    [Console]::Error.WriteLine("read-secret: the secret file is empty: $Path")
    exit 3
}

try {
    $secure = ConvertTo-SecureString -String $encrypted
} catch {
    [Console]::Error.WriteLine("read-secret: cannot decrypt $Path (DPAPI: written by another user or on another PC?): $($_.Exception.GetType().Name)")
    exit 4
}

$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
if (-not $plain) {
    [Console]::Error.WriteLine("read-secret: the decrypted value is empty: $Path")
    exit 5
}

[Console]::Out.Write($plain)
exit 0
