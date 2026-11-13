# Test probe: takes the function Update-PathEntries out of scripts/configure.ps1 (by syntax tree, without running the
# script) and runs it on the cases in a JSON file. It never reads or writes the real PATH or the registry.
# Cases: [ { raw, old, new, env: { NAME: value } } ]. Prints a JSON array with one { result } per case.
# ASCII only (Windows PowerShell 5.1 reads a BOM-less script as ANSI).
param(
    [Parameter(Mandatory = $true)][string]$ScriptPath,
    [Parameter(Mandatory = $true)][string]$CasesPath
)
$ErrorActionPreference = 'Stop'
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($ScriptPath, [ref]$tokens, [ref]$errors)
if ($errors.Count -gt 0) { throw "parse errors in $ScriptPath" }
$fn = $ast.Find({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Update-PathEntries' }, $true)
if ($null -eq $fn) { throw 'Update-PathEntries not found' }
Invoke-Expression $fn.Extent.Text
$cases = Get-Content -LiteralPath $CasesPath -Raw -Encoding UTF8 | ConvertFrom-Json
$out = @()
foreach ($c in @($cases)) {
    $saved = @{}
    if ($c.env) {
        foreach ($p in $c.env.PSObject.Properties) {
            $saved[$p.Name] = [Environment]::GetEnvironmentVariable($p.Name, 'Process')
            [Environment]::SetEnvironmentVariable($p.Name, [string]$p.Value, 'Process')
        }
    }
    try {
        $raw = if ($null -eq $c.raw) { '' } else { [string]$c.raw }
        $r = Update-PathEntries -Raw $raw -OldBin ([string]$c.old) -NewBin ([string]$c.new)
        $out += [pscustomobject]@{ result = $r }
    } finally {
        foreach ($k in $saved.Keys) { [Environment]::SetEnvironmentVariable($k, $saved[$k], 'Process') }
    }
}
Write-Output (ConvertTo-Json -InputObject @($out) -Depth 4 -Compress)
