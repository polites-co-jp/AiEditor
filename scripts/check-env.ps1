<#
.SYNOPSIS
  Read-only check of the Windows build environment for an upstream VS Code tag (docs/02 section 5).
  Installs nothing and changes nothing. Prints one JSON object to stdout.

.DESCRIPTION
  Checks: Git, Node.js (version and arch against the tag's .nvmrc), pnpm (against the tag's
  packageManager), corepack, Python and setuptools, Visual Studio (the folders that the tag's
  build/npm/preinstall.ts looks at, and the components the How-to-Contribute wiki lists, via vswhere),
  tar.exe, signtool.exe (PATH, else the newest Windows Kits\10\bin\<version>\x64), free disk space of the
  build root, LongPathsEnabled, git core.longpaths.

  The required versions come from -WorkTree (a checked-out tag) when given; otherwise from
  -NodeRequired / -PnpmRequired (defaults: the values of 1.146.0, read from the tag on GitHub
  on 2026-11-13: .nvmrc 24.22.1, packageManager pnpm@12.16.0).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-env.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-env.ps1 -WorkTree C:\b\wt\1.146.0
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-env.ps1 -OutFile tasks\<dir>\env-check.json

  Exit code: 0 when nothing is missing, 2 when "missing" is not empty.
#>
[CmdletBinding()]
param(
    [string]$WorkTree,
    [string]$NodeRequired = '24.22.1',
    [string]$PnpmRequired = '12.16.0',
    [string]$BuildRoot = 'C:\b',
    [string]$OutFile
)

$ErrorActionPreference = 'Continue'

function Invoke-Capture([string]$exe, [string[]]$argv) {
    # Runs a command and returns @{ ok; exit; out }. Never throws.
    try {
        $cmd = Get-Command $exe -ErrorAction Stop | Select-Object -First 1
    } catch {
        return @{ ok = $false; exit = $null; out = $null; path = $null; error = 'not found' }
    }
    try {
        $out = & $cmd.Source @argv 2>&1 | ForEach-Object { "$_" }
        $code = $LASTEXITCODE
        return @{ ok = ($code -eq 0); exit = $code; out = (($out -join "`n").Trim()); path = $cmd.Source }
    } catch {
        return @{ ok = $false; exit = $null; out = $null; path = $cmd.Source; error = "$_" }
    }
}

function Compare-SemVer([string]$have, [string]$need) {
    # Same rule as the tag's preinstall.ts / build/lib/pnpm.ts: same major, and >= need.
    $h = [version]($have.TrimStart('v'))
    $n = [version]($need.TrimStart('v'))
    return (($h.Major -eq $n.Major) -and ($h -ge $n))
}

function All-Commands([string]$name) {
    @(Get-Command $name -All -ErrorAction SilentlyContinue | ForEach-Object { $_.Source })
}

$result = [ordered]@{}
$result.checkedAt = (Get-Date).ToString('o')
$result.os = [ordered]@{
    caption = (Get-CimInstance Win32_OperatingSystem).Caption
    version = [Environment]::OSVersion.Version.ToString()
    is64 = [Environment]::Is64BitOperatingSystem
    processorArch = $env:PROCESSOR_ARCHITECTURE
}

# Required versions
if ($WorkTree) {
    $nvmrc = Join-Path $WorkTree '.nvmrc'
    if (Test-Path -LiteralPath $nvmrc) { $NodeRequired = (Get-Content -LiteralPath $nvmrc -Raw).Trim() }
    $pkg = Join-Path $WorkTree 'package.json'
    if (Test-Path -LiteralPath $pkg) {
        $pm = (Get-Content -LiteralPath $pkg -Raw | ConvertFrom-Json).packageManager
        if ($pm -match '^pnpm@(\d+\.\d+\.\d+)') { $PnpmRequired = $Matches[1] }
    }
}
$result.required = [ordered]@{ node = $NodeRequired; pnpm = $PnpmRequired; source = $(if ($WorkTree) { $WorkTree } else { 'defaults (1.146.0)' }) }

# Git
$g = Invoke-Capture 'git' @('--version')
$ll = Invoke-Capture 'git' @('config', '--global', '--get', 'core.longpaths')
$result.git = [ordered]@{ found = $g.ok; version = $g.out; path = $g.path; coreLongpathsGlobal = $ll.out }

# Node.js
$n = Invoke-Capture 'node' @('-p', 'process.version')
$na = Invoke-Capture 'node' @('-p', 'process.arch')
$nodeVer = $null; $nodeArch = $null
if ($n.ok) { $nodeVer = $n.out }
if ($na.ok) { $nodeArch = $na.out }
$result.node = [ordered]@{
    found = $n.ok; version = $nodeVer; arch = $nodeArch; path = $n.path
    allOnPath = (All-Commands 'node')
    satisfies = $(if ($nodeVer) { Compare-SemVer $nodeVer $NodeRequired } else { $false })
}
$nvm = Invoke-Capture 'nvm' @('version')
$fnm = Invoke-Capture 'fnm' @('--version')
$volta = Invoke-Capture 'volta' @('--version')
$result.nodeVersionManagers = [ordered]@{
    nvm = $(if ($nvm.ok) { $nvm.out } else { $null })
    fnm = $(if ($fnm.ok) { $fnm.out } else { $null })
    volta = $(if ($volta.ok) { $volta.out } else { $null })
}

# pnpm / corepack / npm
$p = Invoke-Capture 'pnpm' @('--version')
$result.pnpm = [ordered]@{
    found = $p.ok; version = $p.out; path = $p.path; allOnPath = (All-Commands 'pnpm')
    satisfies = $(if ($p.ok -and $p.out -match '^\d+\.\d+\.\d+') { Compare-SemVer $p.out $PnpmRequired } else { $false })
}
$c = Invoke-Capture 'corepack' @('--version')
$result.corepack = [ordered]@{ found = $c.ok; version = $c.out; path = $c.path }
$npmv = Invoke-Capture 'npm' @('--version')
$result.npm = [ordered]@{ found = $npmv.ok; version = $npmv.out; path = $npmv.path }

# Python and setuptools (node-gyp)
$py = Invoke-Capture 'python' @('--version')
$pyExe = Invoke-Capture 'python' @('-c', 'import sys; print(sys.executable)')
$st = Invoke-Capture 'python' @('-c', 'import setuptools; print(setuptools.__version__)')
$pyl = Invoke-Capture 'py' @('-0p')
$result.python = [ordered]@{
    found = $py.ok; version = $py.out; executable = $pyExe.out; commandPath = $py.path
    allOnPath = (All-Commands 'python')
    setuptools = $(if ($st.ok) { $st.out } else { $null })
    setuptoolsError = $(if (-not $st.ok) { $st.out } else { $null })
    pyLauncher = $(if ($pyl.ok) { $pyl.out } else { $null })
}

# Visual Studio: same folders as preinstall.ts hasSupportedVisualStudioVersion()
$vsFolders = @()
foreach ($year in @(@{ y = '2026'; f = '18' }, @{ y = '2022'; f = '2022' }, @{ y = '2019'; f = '2019' })) {
    $envName = "vs$($year.y)_install"
    $envVal = [Environment]::GetEnvironmentVariable($envName)
    foreach ($base in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
        if (-not $base) { continue }
        foreach ($ed in @('Enterprise', 'Professional', 'Community', 'Preview', 'BuildTools', 'IntPreview')) {
            $pth = Join-Path $base (Join-Path 'Microsoft Visual Studio' (Join-Path $year.f $ed))
            if (Test-Path -LiteralPath $pth) { $vsFolders += [ordered]@{ year = $year.y; path = $pth } }
        }
    }
    if ($envVal) { $vsFolders += [ordered]@{ year = $year.y; env = $envName; path = $envVal; exists = (Test-Path -LiteralPath $envVal) } }
}
$wanted = @(
    'Microsoft.VisualStudio.Workload.VCTools',
    'Microsoft.VisualStudio.Component.Windows11SDK.26100',
    'Microsoft.VisualStudio.Component.VC.Runtimes.x86.x64.Spectre',
    'Microsoft.VisualStudio.Component.VC.ATL.Spectre',
    'Microsoft.VisualStudio.Component.VC.ATLMFC.Spectre',
    'Microsoft.VisualStudio.Component.VC.Tools.x86.x64'
)
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$instances = @()
if (Test-Path -LiteralPath $vswhere) {
    $raw = & $vswhere -products '*' -all -prerelease -include packages -format json 2>$null
    if ($LASTEXITCODE -eq 0 -and $raw) {
        $list = ($raw -join "`n") | ConvertFrom-Json
        foreach ($i in @($list)) {
            $ids = @($i.packages | ForEach-Object { $_.id })
            $comp = [ordered]@{}
            foreach ($w in $wanted) { $comp[$w] = ($ids -contains $w) }
            $sdks = @($ids | Where-Object { $_ -match '^Microsoft\.VisualStudio\.Component\.Windows1[01]SDK\.\d+$' } | Sort-Object -Unique)
            $instances += [ordered]@{
                displayName = $i.displayName; productId = $i.productId; version = $i.installationVersion
                path = $i.installationPath; isComplete = $i.isComplete; components = $comp; windowsSdkComponents = $sdks
            }
        }
    }
}
# preinstall.ts passes on vs<year>_install only when the path exists (fs.existsSync). The folder
# entries above are added only when they exist; the env entries carry exists = true/false.
$vsPassing = @($vsFolders | Where-Object { (-not $_.Contains('exists')) -or $_['exists'] })
$result.visualStudio = [ordered]@{
    vswhere = (Test-Path -LiteralPath $vswhere)
    preinstallFolders = $vsFolders
    preinstallCheckPasses = ($vsPassing.Count -gt 0)
    instances = $instances
}
$sdkRoot = 'C:\Program Files (x86)\Windows Kits\10\Include'
$result.windowsKits = $(if (Test-Path -LiteralPath $sdkRoot) { @(Get-ChildItem -LiteralPath $sdkRoot -Directory | ForEach-Object { $_.Name }) } else { @() })

# tar.exe (zip)
# The Windows tar.exe (bsdtar, System32) can write zip with -a; GNU tar (e.g. Git's usr\bin) cannot.
$t = Invoke-Capture 'tar' @('--version')
$sysTar = Join-Path $env:SystemRoot 'System32\tar.exe'
$st32 = $null
if (Test-Path -LiteralPath $sysTar) { $st32 = Invoke-Capture $sysTar @('--version') }
$result.tar = [ordered]@{
    onPath = $t.path; onPathVersion = $(if ($t.out) { ($t.out -split "`n")[0] } else { $null })
    system32 = $(if ($st32) { $sysTar } else { $null })
    system32Version = $(if ($st32 -and $st32.out) { ($st32.out -split "`n")[0] } else { $null })
    found = ($null -ne $st32 -and $st32.ok)
}

# signtool.exe (Windows SDK)
# 1.146.0 patchWin32DependenciesTask (build/gulpfile.vscode.ts) spawns 'signtool.exe verify /pa' from PATH and
# fails the packaging when it cannot start. The upstream CI prepends
# 'C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64' to PATH for that step
# (build/azure-pipelines/win32/steps/product-build-win32-compile.yml). Here: PATH first, else the newest
# Windows Kits\10\bin\<version>\x64\signtool.exe (scripts/build.mjs adds that folder to its children's PATH).
$stPath = $null
$stCmd = Get-Command 'signtool.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($stCmd) { $stPath = $stCmd.Source }
$pf86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
if (-not $pf86) { $pf86 = 'C:\Program Files (x86)' }
$kitsBin = Join-Path $pf86 'Windows Kits\10\bin'
$kitsCands = @()
if (Test-Path -LiteralPath $kitsBin) {
    $kitsCands = @(Get-ChildItem -LiteralPath $kitsBin -Directory | Where-Object { $_.Name -match '^\d+\.\d+\.\d+\.\d+$' } |
            Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'x64\signtool.exe') } |
            Sort-Object -Property @{ Expression = { [version]$_.Name } } -Descending |
            ForEach-Object { Join-Path $_.FullName 'x64\signtool.exe' })
}
$stChosen = $null; $stSource = $null
if ($stPath) { $stChosen = $stPath; $stSource = 'PATH' }
elseif ($kitsCands.Count -gt 0) { $stChosen = $kitsCands[0]; $stSource = 'WindowsKits' }
$result.signtool = [ordered]@{
    onPath = $stPath
    kitsBin = $kitsBin
    kitsCandidates = $kitsCands
    chosen = $stChosen
    source = $stSource
    found = ($null -ne $stChosen)
}

# Disk and long paths
$drive = (Split-Path -Qualifier $BuildRoot).TrimEnd(':')
$d = Get-PSDrive -Name $drive -ErrorAction SilentlyContinue
$result.disk = [ordered]@{ buildRoot = $BuildRoot; drive = $drive; freeGB = $(if ($d) { [math]::Round($d.Free / 1GB, 1) } else { $null }); buildRootExists = (Test-Path -LiteralPath $BuildRoot) }
$lp = $null
try { $lp = (Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name LongPathsEnabled -ErrorAction Stop).LongPathsEnabled } catch { }
$result.longPathsEnabled = $lp

# Environment variables that change how Electron/VS Code start in children
$result.envVars = [ordered]@{
    ELECTRON_RUN_AS_NODE = $env:ELECTRON_RUN_AS_NODE
    VSCODE_SKIP_NODE_VERSION_CHECK = $env:VSCODE_SKIP_NODE_VERSION_CHECK
    npm_config_node_gyp = $env:npm_config_node_gyp
}

$missing = @()
if (-not $result.git.found) { $missing += 'git' }
if (-not $result.node.satisfies) { $missing += "node (need $NodeRequired x64, same major and >=)" }
if ($result.node.arch -and $result.node.arch -ne 'x64') { $missing += 'node x64' }
if (-not $result.pnpm.satisfies) { $missing += "pnpm (need $PnpmRequired, same major and >=)" }
if (-not $result.python.found) { $missing += 'python' }
elseif (-not $result.python.setuptools) { $missing += 'python setuptools' }
if (-not $result.visualStudio.preinstallCheckPasses) { $missing += 'Visual Studio / Build Tools (folder that preinstall.ts looks for)' }
$okInst = @($instances | Where-Object { $c2 = $_.components; ($wanted[0..4] | Where-Object { -not $c2[$_] }).Count -eq 0 })
if ($okInst.Count -eq 0) { $missing += 'Visual Studio components listed by the wiki (VCTools, Windows11SDK.26100, Spectre x86.x64, ATL.Spectre, ATLMFC.Spectre)' }
if (-not $result.tar.found) { $missing += 'tar.exe (System32, bsdtar)' }
if (-not $result.signtool.found) { $missing += 'signtool.exe (Windows SDK: PATH or Windows Kits\10\bin\<version>\x64)' }
$result.missing = $missing

$json = $result | ConvertTo-Json -Depth 8
if ($OutFile) { [IO.File]::WriteAllText($OutFile, $json + "`n", (New-Object Text.UTF8Encoding($false))) }
$json
if ($missing.Count -gt 0) { exit 2 }
