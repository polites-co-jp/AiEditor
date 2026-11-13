<#
  Shared reader of the per-PC settings file local.json (docs/02 section 6.1).
  The defaults and the expansion rules live here and in scripts/lib/local-config.mjs; keep both the same.

  Rules:
    - The file is %LOCALAPPDATA%\Shuko\local.json. Functions accept another path (trials, tests).
    - No file / no key -> default value.
    - Not JSON, top level not an object, unknown key, wrong type -> throw (never fall back to a default).
    - Key names are case-sensitive ("InstallRoot" is an unknown key).
    - installRoot, buildRoot, builderRepo: strings. %NAME% is expanded from the environment; after
      expansion the value must be an absolute path (drive letter or UNC). An unknown %NAME% is an error.
      builderRepo alone may be null (= not set).
    - keepVersions: integer >= 1.
    - Precedence: option -> local.json -> default.

  Dot-source it:   . (Join-Path $PSScriptRoot 'lib\local-config.ps1')
  Functions (test entry points; see tasks/2026-11-13-p2-build-switch/build-switch-design.md section 2):
    Get-ShukoLocalConfigPath
    Expand-ShukoEnv -Value <string>
    Test-ShukoLocalConfig -Config <object>          -> string[] of errors (empty when valid)
    Read-ShukoLocalConfig -Path <file>              -> ordered hashtable of the raw values ({} when the file is missing)
    Resolve-ShukoLocalConfig [-ConfigPath] [-Overrides @{}]
                                                    -> object: installRoot keepVersions builderRepo buildRoot sources configPath configExists
    Write-ShukoLocalConfig -Path <file> -Values <IDictionary>   (validates, writes UTF-8 without BOM via a temp file)
    ConvertTo-ShukoLocalConfigJson -Values <IDictionary>        -> the JSON text that Write- writes

  Run directly to print the resolved values (trials):
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/lib/local-config.ps1 [-ConfigPath <file>]

  NOTE: this file is ASCII only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
  NOTE: no param() block on purpose: dot-sourcing a script with param() would overwrite the caller's
        variables of the same names.
#>

$script:ShukoLocalKeys = @('installRoot', 'keepVersions', 'builderRepo', 'buildRoot')
$script:ShukoLocalPathKeys = @('installRoot', 'buildRoot', 'builderRepo')
$script:ShukoLocalDefaults = [ordered]@{
    installRoot  = '%LOCALAPPDATA%\Programs\Shuko'
    keepVersions = 3
    builderRepo  = $null
    buildRoot    = 'C:\b'
}

function Get-ShukoLocalConfigPath {
    if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA is not set; cannot locate local.json' }
    return (Join-Path $env:LOCALAPPDATA 'Shuko\local.json')
}

function Expand-ShukoEnv {
    param([Parameter(Mandatory)][AllowEmptyString()][string]$Value)
    $ms = [regex]::Matches($Value, '%([^%]+)%')
    $out = $Value
    foreach ($m in $ms) {
        $name = $m.Groups[1].Value
        $v = [Environment]::GetEnvironmentVariable($name)
        if ($null -eq $v) { throw "environment variable $name not found ($Value)" }
        $out = $out.Replace($m.Value, $v)
    }
    return $out
}

function Test-ShukoAbsolutePath {
    param([string]$Path)
    return ($Path -match '^[A-Za-z]:[\\/]') -or ($Path -match '^[\\/]{2}[^\\/]+[\\/][^\\/]+')
}

function Test-ShukoLocalConfig {
    <# Returns the list of errors (empty when valid). Accepts a PSCustomObject (ConvertFrom-Json) or an IDictionary. #>
    param($Config)
    $errors = @()
    $names = @()
    $get = $null
    if ($Config -is [System.Collections.IDictionary]) {
        $names = @($Config.Keys | ForEach-Object { [string]$_ })
        $get = { param($k) $Config[$k] }
    } elseif ($Config -is [System.Management.Automation.PSCustomObject]) {
        $names = @($Config.PSObject.Properties | ForEach-Object { $_.Name })
        $get = { param($k) ($Config.PSObject.Properties | Where-Object { $_.Name -ceq $k } | Select-Object -First 1).Value }
    } else {
        return @('top level is not a JSON object')
    }
    foreach ($n in $names) {
        if ($script:ShukoLocalKeys -cnotcontains $n) {
            $errors += "${n}: unknown key (allowed: $($script:ShukoLocalKeys -join ', '); case-sensitive)"
        }
    }
    foreach ($k in $script:ShukoLocalPathKeys) {
        if ($names -cnotcontains $k) { continue }
        $v = & $get $k
        if ($k -eq 'builderRepo' -and $null -eq $v) { continue }
        if (-not ($v -is [string]) -or $v.Trim() -eq '') { $errors += "${k}: not a non-empty string" }
    }
    if ($names -ccontains 'keepVersions') {
        $v = & $get 'keepVersions'
        $isInt = ($v -is [int]) -or ($v -is [long])
        if (-not $isInt -or $v -lt 1) { $errors += "keepVersions: not an integer >= 1 ($v)" }
    }
    return , $errors
}

function Read-ShukoLocalConfig {
    <# Raw values of the file (no defaults, no expansion), validated. Empty ordered hashtable when missing. #>
    param([Parameter(Mandatory)][string]$Path)
    $out = [ordered]@{}
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $out }
    $raw = [IO.File]::ReadAllText($Path)
    if ($raw.Length -gt 0 -and $raw[0] -eq [char]0xFEFF) { $raw = $raw.Substring(1) }
    try {
        $obj = ConvertFrom-Json -InputObject $raw -ErrorAction Stop
    } catch {
        throw "$Path is not valid JSON: $($_.Exception.Message)"
    }
    $errors = Test-ShukoLocalConfig -Config $obj
    if ($errors.Count -gt 0) { throw "$Path has errors: $($errors -join ' / ')" }
    foreach ($p in $obj.PSObject.Properties) { $out[$p.Name] = $p.Value }
    return $out
}

function ConvertTo-ShukoLocalPath {
    param([string]$Key, [string]$Raw)
    $e = Expand-ShukoEnv -Value $Raw
    if (-not (Test-ShukoAbsolutePath $e)) { throw "${Key}: the expanded value is not an absolute path: $e" }
    $n = [IO.Path]::GetFullPath($e)
    if ($n -match '^[A-Za-z]:\\$') { return $n }
    return $n.TrimEnd('\', '/')
}

function Resolve-ShukoLocalConfig {
    param([string]$ConfigPath, [System.Collections.IDictionary]$Overrides = @{})
    if (-not $ConfigPath) { $ConfigPath = Get-ShukoLocalConfigPath }
    $exists = Test-Path -LiteralPath $ConfigPath -PathType Leaf
    $data = Read-ShukoLocalConfig -Path $ConfigPath
    $ov = [ordered]@{}
    foreach ($k in $Overrides.Keys) { if ($null -ne $Overrides[$k] -and '' -ne $Overrides[$k]) { $ov[$k] = $Overrides[$k] } }
    $ovErrors = Test-ShukoLocalConfig -Config $ov
    if ($ovErrors.Count -gt 0) { throw "option errors: $($ovErrors -join ' / ')" }

    $res = [ordered]@{}
    $sources = [ordered]@{}
    foreach ($k in $script:ShukoLocalKeys) {
        if ($ov.Contains($k)) { $v = $ov[$k]; $sources[$k] = 'option' }
        elseif ($data.Contains($k) -and $null -ne $data[$k]) { $v = $data[$k]; $sources[$k] = 'local.json' }
        else { $v = $script:ShukoLocalDefaults[$k]; $sources[$k] = 'default' }
        if ($script:ShukoLocalPathKeys -contains $k) {
            if ($null -eq $v) { $res[$k] = $null } else { $res[$k] = ConvertTo-ShukoLocalPath -Key $k -Raw ([string]$v) }
        } else {
            $res[$k] = [int]$v
        }
    }
    $res['sources'] = [pscustomobject]$sources
    $res['configPath'] = $ConfigPath
    $res['configExists'] = [bool]$exists
    return [pscustomobject]$res
}

function ConvertTo-ShukoJsonString {
    param([AllowNull()][string]$Value)
    if ($null -eq $Value) { return 'null' }
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('"')
    foreach ($ch in $Value.ToCharArray()) {
        $c = [int]$ch
        if ($ch -eq '"') { [void]$sb.Append('\"') }
        elseif ($ch -eq '\') { [void]$sb.Append('\\') }
        elseif ($c -lt 0x20) { [void]$sb.Append(('\u{0:x4}' -f $c)) }
        else { [void]$sb.Append($ch) }
    }
    [void]$sb.Append('"')
    return $sb.ToString()
}

function ConvertTo-ShukoLocalConfigJson {
    <# Keys in the documented order; 2-space indent; LF line ends; ends with a newline. #>
    param([Parameter(Mandatory)][System.Collections.IDictionary]$Values)
    $lines = @()
    foreach ($k in $script:ShukoLocalKeys) {
        if (-not $Values.Contains($k)) { continue }
        $v = $Values[$k]
        if ($k -eq 'keepVersions') { $txt = ([int]$v).ToString([Globalization.CultureInfo]::InvariantCulture) }
        else { $txt = ConvertTo-ShukoJsonString $v }
        $lines += ('  ' + (ConvertTo-ShukoJsonString $k) + ': ' + $txt)
    }
    if ($lines.Count -eq 0) { return "{}`n" }
    return "{`n" + ($lines -join ",`n") + "`n}`n"
}

function Write-ShukoLocalConfig {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][System.Collections.IDictionary]$Values)
    $errors = Test-ShukoLocalConfig -Config $Values
    if ($errors.Count -gt 0) { throw "refusing to write $Path : $($errors -join ' / ')" }
    $text = ConvertTo-ShukoLocalConfigJson -Values $Values
    $dir = Split-Path -Parent $Path
    if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $tmp = $Path + '.tmp'
    [IO.File]::WriteAllText($tmp, $text, (New-Object System.Text.UTF8Encoding($false)))
    try {
        # [NullString]::Value: a plain $null becomes "" for a string parameter, and Replace rejects "" as a path
        if (Test-Path -LiteralPath $Path) { [IO.File]::Replace($tmp, $Path, [NullString]::Value) } else { [IO.File]::Move($tmp, $Path) }
    } finally {
        if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
    }
}

# Run directly (not dot-sourced): print the resolved values as JSON.
if ($MyInvocation.InvocationName -ne '.') {
    $cfgPath = $null
    for ($i = 0; $i -lt $args.Count; $i++) {
        if ($args[$i] -eq '-ConfigPath') { $cfgPath = $args[$i + 1]; $i++ }
        else { Write-Error "unknown argument: $($args[$i])"; exit 1 }
    }
    try {
        Resolve-ShukoLocalConfig -ConfigPath $cfgPath | ConvertTo-Json -Depth 5
    } catch {
        Write-Host "[local-config] $($_.Exception.Message)"
        exit 1
    }
}
