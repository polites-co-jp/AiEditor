<#
  Where child processes of a PowerShell script write their temp files and caches (decision 2026-11-15,
  "nothing on C:"; tasks/2026-11-16-small-fixes/). The PowerShell twin of cacheEnvVars() in
  scripts/lib/build-env.mjs: same variables, same folders under <buildRoot>. Keep both the same.

    TEMP, TMP                 <buildRoot>\tmp
    pnpm_config_store_dir     <buildRoot>\cache\pnpm-store
    pnpm_config_cache_dir     <buildRoot>\cache\pnpm-cache
    npm_config_cache          <buildRoot>\cache\npm-cache
    and, only when already set in the base environment (any letter case):
    ELECTRON_CACHE, electron_config_cache   <buildRoot>\cache\localappdata\electron\Cache
    ELECTRON_BUILDER_CACHE                  <buildRoot>\cache\electron-builder
    npm_config_devdir                       <buildRoot>\cache\localappdata\node-gyp\Cache
    PLAYWRIGHT_BROWSERS_PATH                <buildRoot>\cache\localappdata\ms-playwright
    COREPACK_HOME                           <buildRoot>\cache\localappdata\node\corepack

  LOCALAPPDATA is not changed (build-env.mjs changes it only for the toolchain steps of build.mjs).
  The user's global settings (~/.npmrc, user/machine environment, registry) are not changed. Set- changes
  only the environment of the current process, which its children inherit.

  Dot-source it:   . (Join-Path $PSScriptRoot 'lib\child-cache-env.ps1')
  Functions (test entry points):
    Get-ShukoChildCacheEnv -BuildRoot <dir> [-BaseNames <string[]>]
        -> ordered hashtable { name = folder }. -BaseNames: the names of the base environment (default: the
           names in the current process). Throws when -BuildRoot is not an absolute path (drive letter or UNC).
    Set-ShukoChildCacheEnv -BuildRoot <dir> [-CreateTemp]
        -> ordered hashtable { vars = <the hashtable above>; replaced = <names that already existed, sorted>;
           createdTemp = <folder or $null> }. Sets the variables in the current process. -CreateTemp creates
           <buildRoot>\tmp when it is missing (no other folder is created; pnpm and npm create their own).

  NOTE: ASCII only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
#>

$script:ShukoIfPresentVars = [ordered]@{
    'ELECTRON_CACHE'           = 'cache\localappdata\electron\Cache'
    'electron_config_cache'    = 'cache\localappdata\electron\Cache'
    'ELECTRON_BUILDER_CACHE'   = 'cache\electron-builder'
    'npm_config_devdir'        = 'cache\localappdata\node-gyp\Cache'
    'PLAYWRIGHT_BROWSERS_PATH' = 'cache\localappdata\ms-playwright'
    'COREPACK_HOME'            = 'cache\localappdata\node\corepack'
}

function Get-ShukoChildCacheEnv {
    param(
        [Parameter(Mandatory = $true)][string]$BuildRoot,
        [string[]]$BaseNames
    )
    if (-not ($BuildRoot -match '^[A-Za-z]:[\\/]' -or $BuildRoot -match '^[\\/]{2}[^\\/]+[\\/][^\\/]+')) {
        throw "buildRoot is not an absolute path: $BuildRoot"
    }
    $root = $BuildRoot -replace '/', '\'
    if ($root -notmatch '^[A-Za-z]:\\$') { $root = $root.TrimEnd('\') }
    if ($null -eq $BaseNames) { $BaseNames = @(Get-ChildItem Env: | ForEach-Object { $_.Name }) }
    $j = { param($sub) if ($root.EndsWith('\')) { "$root$sub" } else { "$root\$sub" } }
    $temp = & $j 'tmp'
    $out = [ordered]@{
        TEMP                  = $temp
        TMP                   = $temp
        pnpm_config_store_dir = (& $j 'cache\pnpm-store')
        pnpm_config_cache_dir = (& $j 'cache\pnpm-cache')
        npm_config_cache      = (& $j 'cache\npm-cache')
    }
    foreach ($k in $script:ShukoIfPresentVars.Keys) {
        $hit = @($BaseNames | Where-Object { $_ -ieq $k })
        if ($hit.Count -gt 0) { $out[$k] = (& $j $script:ShukoIfPresentVars[$k]) }
    }
    return $out
}

function Set-ShukoChildCacheEnv {
    param(
        [Parameter(Mandatory = $true)][string]$BuildRoot,
        [switch]$CreateTemp
    )
    $vars = Get-ShukoChildCacheEnv -BuildRoot $BuildRoot
    $names = @(Get-ChildItem Env: | ForEach-Object { $_.Name })
    $replaced = @()
    foreach ($k in $vars.Keys) {
        $hit = @($names | Where-Object { $_ -ieq $k })
        if ($hit.Count -gt 0) { $replaced += $hit[0] }
        # Windows environment names are case-insensitive: this replaces Temp, PNPM_CONFIG_STORE_DIR, ...
        [Environment]::SetEnvironmentVariable($k, $vars[$k], 'Process')
    }
    $created = $null
    if ($CreateTemp -and -not (Test-Path -LiteralPath $vars.TEMP)) {
        New-Item -ItemType Directory -Path $vars.TEMP -Force | Out-Null
        $created = $vars.TEMP
    }
    return [ordered]@{ vars = $vars; replaced = @($replaced | Sort-Object -Unique); createdTemp = $created }
}
