# Test probe: dot-sources scripts/lib/local-config.ps1 and resolves a local.json.
# Prints one JSON object: { ok = $true, value = <resolved> } or { ok = $false, error = <message> }.
# ASCII only (Windows PowerShell 5.1 reads a BOM-less script as ANSI).
param(
    [Parameter(Mandatory = $true)][string]$LibPath,
    [Parameter(Mandatory = $true)][string]$ConfigPath,
    [string]$OverridesJson = ''
)
$ErrorActionPreference = 'Stop'
. $LibPath
try {
    $ov = @{}
    if ($OverridesJson) {
        $o = $OverridesJson | ConvertFrom-Json
        foreach ($p in $o.PSObject.Properties) { $ov[$p.Name] = $p.Value }
    }
    $r = Resolve-ShukoLocalConfig -ConfigPath $ConfigPath -Overrides $ov
    $out = [ordered]@{ ok = $true; value = $r }
    Write-Output ($out | ConvertTo-Json -Depth 6 -Compress)
    exit 0
} catch {
    $out = [ordered]@{ ok = $false; error = $_.Exception.Message }
    Write-Output ($out | ConvertTo-Json -Depth 3 -Compress)
    exit 1
}
