<#
  Shared parts of the Phase 0 test environments (docs/07 2.1, 2.3-2.4, 2.8-2.11, 3.1).
  Dot-sourced by scripts\p0-env.ps1, scripts\p0-launch.ps1, scripts\p0-ext-allowed.ps1.

  The measurement workspace is <repo>\tmp\ws (cloned by the user from E:\develop\kuebiko).

  Layout (all under C:\b\p0, the build work area; never the daily editor data):
    vscode-1.146.0\            upstream zip (versioned layout: <commit10>\resources\app)
    vscodium-<ver>\            VSCodium zip (flat layout)
    testbed\                   copy of VSCodium with the stage A built-in extensions removed
    vsix\                      ledger VSIX files (fetched by scripts\lock-fetch.mjs)
    sublime\                   ms-vscode.sublime-keybindings VSIX (scripts\convert-sublime-keys.mjs)
    data\<name>\user\              VSCODE_PORTABLE (argv.json is user\argv.json)
    data\<name>\user\user-data\    the user data dir (settings: user-data\User\settings.json)
    data\<name>\ext\               --extensions-dir
    data\<name>\p0-env.json        what was built (read by p0-launch.ps1)

  Why VSCODE_PORTABLE: argv.json is NOT read from --user-data-dir. The editor reads
  <VSCODE_PORTABLE>\argv.json, else %USERPROFILE%\<dataFolderName>\argv.json
  (.vscode for upstream, .vscode-oss for VSCodium) and creates it when missing
  (src/mainImpl.ts getArgvConfigPath). Setting VSCODE_PORTABLE to an existing folder keeps
  argv.json inside the env. Portable needs a product.json without "target" (true for both zips).
  In portable mode the user data dir is ALWAYS <VSCODE_PORTABLE>\user-data: VSCODE_PORTABLE
  wins over --user-data-dir (src/vs/platform/environment/node/userDataPath.ts). We still pass
  --user-data-dir with that same path so the command line shows it. --extensions-dir wins over
  the portable default (environmentService.ts extensionsPath), so ext\ is used as given.

  NOTE: this file is ASCII only on purpose. Windows PowerShell 5.1 reads a BOM-less
  script as the ANSI code page.
#>

$script:P0Root = 'C:\b\p0'
$script:P0RepoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
# Measurement workspace: <repo>\tmp\ws (decision 2026-11-13; first C:\b\p0\ws). tmp/ is git-ignored.
$script:P0Workspace = Join-Path $script:P0RepoRoot 'tmp\ws'

# Ledger of docs/04 section 2 (language pack first, as docs/04 5.3). Both .env candidates until 0-3 decides.
$script:P0LedgerIds = @(
    'ms-ceintl.vscode-language-pack-ja',
    'anthropic.claude-code',
    'detachhead.basedpyright',
    'ms-vscode.powershell',
    'mads-hartmann.bash-ide-vscode',
    'mechatroner.rainbow-csv',
    'dotenv.dotenv-vscode',
    'weixu.wx-vsce-dotenv',
    'tomoki1207.pdf'
)
$script:P0DotenvA = 'dotenv.dotenv-vscode'
$script:P0DotenvB = 'weixu.wx-vsce-dotenv'
$script:P0SublimeId = 'ms-vscode.sublime-keybindings'
$script:P0LangPackVersion = '1.131.0'

# Settings the measurement script needs (docs/07 3.1: only what the script needs).
#  - task.allowAutomaticTasks: the folderOpen task runs without asking.
#  - security.workspace.trust.enabled=false: tasks do not run in restricted mode, and the trust
#    dialog would block an unattended run.
#  - basedpyright.importStrategy=useBundled: decision 2026-11-13 (docs/user-decisions.md, the
#    basedpyright section). mydist sets it as a default in the own build; the upstream baseline gets
#    the same value in the user settings so both measure with the Python language server running.
$script:P0MeasureSettings = [ordered]@{
    'task.allowAutomaticTasks'         = 'on'
    'security.workspace.trust.enabled' = $false
    'basedpyright.importStrategy'       = 'useBundled'
}

function Get-P0LedgerIds {
    param([string[]]$Exclude = @())
    $ex = @($Exclude | ForEach-Object { $_.ToLowerInvariant() })
    return @($script:P0LedgerIds | Where-Object { $ex -notcontains $_ })
}

function Get-P0EnvDefinitions {
    <# All environments. Keys: Name, Base (upstream|testbed), Extensions (ids, in install order),
       Settings (ordered), Argv (ordered), DevPath (repo-relative or $null), Measure, Purpose. #>
    $defs = @()
    $defs += [pscustomobject]@{
        Name = 'upstream-default'; Base = 'upstream'; Purpose = '0-4 baseline: upstream 1.146.0, AI as shipped, whole ledger (docs/07 2.5)'
        Extensions = (Get-P0LedgerIds); Settings = $script:P0MeasureSettings; Argv = [ordered]@{ locale = 'ja' }
        DevPath = $null; Measure = $true
    }
    $defs += [pscustomobject]@{
        Name = 'upstream-ai-disabled'; Base = 'upstream'; Purpose = '0-2: upstream with chat.disableAIFeatures and Claude Code (docs/07 2.3)'
        Extensions = @('anthropic.claude-code'); Settings = [ordered]@{ 'chat.disableAIFeatures' = $true }; Argv = [ordered]@{}
        DevPath = $null; Measure = $false
    }
    $defs += [pscustomobject]@{
        Name = 'testbed'; Base = 'testbed'; Purpose = '0-3: VSCodium minus stage A built-ins, ledger without the .env extensions (docs/07 2.4)'
        Extensions = (Get-P0LedgerIds -Exclude @($script:P0DotenvA, $script:P0DotenvB)); Settings = [ordered]@{}; Argv = [ordered]@{ locale = 'ja' }
        DevPath = $null; Measure = $false
    }
    $defs += [pscustomobject]@{
        Name = 'testbed-dotenv-a'; Base = 'testbed'; Purpose = '0-3 .env check A: testbed + dotenv.dotenv-vscode only'
        Extensions = (Get-P0LedgerIds -Exclude @($script:P0DotenvB)); Settings = [ordered]@{}; Argv = [ordered]@{ locale = 'ja' }
        DevPath = $null; Measure = $false
    }
    $defs += [pscustomobject]@{
        Name = 'testbed-dotenv-b'; Base = 'testbed'; Purpose = '0-3 .env check B: testbed + weixu.wx-vsce-dotenv only'
        Extensions = (Get-P0LedgerIds -Exclude @($script:P0DotenvA)); Settings = [ordered]@{}; Argv = [ordered]@{ locale = 'ja' }
        DevPath = $null; Measure = $false
    }
    $defs += [pscustomobject]@{
        Name = 'testbed-measure'; Base = 'testbed'; Purpose = '0-4 reference: testbed with the whole ledger and the measurement settings (not used for pass/fail)'
        Extensions = (Get-P0LedgerIds); Settings = $script:P0MeasureSettings; Argv = [ordered]@{ locale = 'ja' }
        DevPath = $null; Measure = $true
    }
    $defs += [pscustomobject]@{
        Name = 'langpack-upstream'; Base = 'upstream'; Purpose = '0-7: upstream + language pack 1.131.0 + Claude Code, locale ja (docs/07 2.8)'
        Extensions = @('ms-ceintl.vscode-language-pack-ja', 'anthropic.claude-code'); Settings = [ordered]@{}; Argv = [ordered]@{ locale = 'ja' }
        DevPath = $null; Measure = $false
    }
    $defs += [pscustomobject]@{
        Name = 'langpack-testbed'; Base = 'testbed'; Purpose = '0-7: testbed + language pack 1.131.0 + Claude Code, locale ja (docs/07 2.8)'
        Extensions = @('ms-ceintl.vscode-language-pack-ja', 'anthropic.claude-code'); Settings = [ordered]@{}; Argv = [ordered]@{ locale = 'ja' }
        DevPath = $null; Measure = $false
    }
    $defs += [pscustomobject]@{
        Name = 'ext-allowed'; Base = 'upstream'; Purpose = '0-8: extensions.allowed = {"*": false, "anthropic.claude-code": true}; rainbow-csv installed BEFORE the setting is written (case c) (docs/07 2.9)'
        Extensions = @('anthropic.claude-code', 'mechatroner.rainbow-csv')
        Settings = [ordered]@{ 'extensions.allowed' = [ordered]@{ '*' = $false; 'anthropic.claude-code' = $true } }
        Argv = [ordered]@{}; DevPath = $null; Measure = $false
    }
    $defs += [pscustomobject]@{
        Name = 'mydist'; Base = 'upstream'; Purpose = '0-9: upstream + --extensionDevelopmentPath=extensions-src\mydist; empty user settings; sublime-keybindings installed as a non-ledger extension to see the extensions.allowed default (docs/07 2.10)'
        Extensions = @('anthropic.claude-code', $script:P0SublimeId); Settings = [ordered]@{}; Argv = [ordered]@{}
        DevPath = 'extensions-src\mydist'; Measure = $false
    }
    # basedpyright probe (2026-11-13): does basedpyright 1.40.2 start without ms-python.python?
    # Same extensions and measurement settings as upstream-default, git off (do not touch the opened
    # folder's .git), LSP trace on so the diagnostics land in the output log files.
    # These are kept as the record of the probe (logs under C:\b\p0\data\bp-probe-*). They are NOT in
    # p0-env.ps1 -All (InAll = $false); rebuild one only with -Name. Their base is the measurement
    # settings as they were at the probe, i.e. WITHOUT basedpyright.importStrategy.
    $bpBase = [ordered]@{}
    foreach ($k in $script:P0MeasureSettings.Keys) {
        if ($k -ne 'basedpyright.importStrategy') { $bpBase[$k] = $script:P0MeasureSettings[$k] }
    }
    $bpBase['git.enabled'] = $false
    $bpBase['basedpyright.analysis.logLevel'] = 'Trace'
    $bpBase['basedpyright.trace.server'] = 'verbose'
    $bpBase['python.trace.server'] = 'verbose'
    $py = 'C:\Python314\python.exe'
    $variants = @(
        @{ Suffix = 'a'; Note = 'as shipped (importStrategy fromEnvironment)'; Extra = [ordered]@{} },
        @{ Suffix = 'b'; Note = 'python.defaultInterpreterPath and python.pythonPath = ' + $py; Extra = [ordered]@{ 'python.defaultInterpreterPath' = $py; 'python.pythonPath' = $py } },
        @{ Suffix = 'c'; Note = 'basedpyright.importStrategy = useBundled'; Extra = [ordered]@{ 'basedpyright.importStrategy' = 'useBundled' } },
        @{ Suffix = 'd'; Note = 'useBundled and python.pythonPath = ' + $py; Extra = [ordered]@{ 'basedpyright.importStrategy' = 'useBundled'; 'python.defaultInterpreterPath' = $py; 'python.pythonPath' = $py } }
    )
    foreach ($v in $variants) {
        $s = [ordered]@{}
        foreach ($k in $bpBase.Keys) { $s[$k] = $bpBase[$k] }
        foreach ($k in $v.Extra.Keys) { $s[$k] = $v.Extra[$k] }
        $defs += [pscustomobject]@{
            Name = 'bp-probe-' + $v.Suffix; Base = 'upstream'; Purpose = 'basedpyright probe: upstream-default + ' + $v.Note
            Extensions = (Get-P0LedgerIds); Settings = $s; Argv = [ordered]@{ locale = 'ja' }
            DevPath = $null; Measure = $false; InAll = $false
        }
    }
    return $defs
}

function Get-P0EnvDefinition {
    param([Parameter(Mandatory)][string]$Name)
    $d = @(Get-P0EnvDefinitions | Where-Object { $_.Name -ieq $Name })
    if ($d.Count -ne 1) {
        $names = (Get-P0EnvDefinitions | ForEach-Object { $_.Name }) -join ', '
        throw "unknown environment '$Name'. Known: $names"
    }
    return $d[0]
}

function Get-P0EnvPaths {
    param([Parameter(Mandatory)][string]$Name)
    $root = Join-Path (Join-Path $script:P0Root 'data') $Name
    $user = Join-Path $root 'user'
    $userData = Join-Path $user 'user-data'
    return [pscustomobject]@{
        Root     = $root
        User     = $user
        UserData = $userData
        Ext      = Join-Path $root 'ext'
        Portable = $user
        Argv     = Join-Path $user 'argv.json'
        Settings = Join-Path $userData 'User\settings.json'
        Info     = Join-Path $root 'p0-env.json'
        Log      = Join-Path $root 'p0-install.log'
    }
}

function Assert-P0Path {
    <# Throws unless the path is inside C:\b\p0 and not the daily editor data. #>
    param([Parameter(Mandatory)][string]$Path)
    $full = [IO.Path]::GetFullPath($Path).TrimEnd('\')
    $root = [IO.Path]::GetFullPath($script:P0Root).TrimEnd('\')
    if (-not $full.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw "refusing a path outside $root : $full"
    }
    $bad = @()
    if ($env:APPDATA) { $bad += $env:APPDATA }
    if ($env:USERPROFILE) { $bad += (Join-Path $env:USERPROFILE '.vscode'); $bad += (Join-Path $env:USERPROFILE '.vscode-oss') }
    foreach ($b in $bad) {
        $bb = $b.TrimEnd('\')
        if ($full -ieq $bb -or $full.StartsWith($bb + '\', [StringComparison]::OrdinalIgnoreCase)) {
            throw "refusing a path under the daily editor data: $full"
        }
    }
    return $full
}

function Write-P0Text {
    <# UTF-8 without BOM (argv.json is parsed without BOM handling). #>
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][AllowEmptyString()][string]$Text)
    $dir = Split-Path -Parent $Path
    if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    [IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding($false)))
}

function ConvertTo-P0Json {
    param($Value)
    if ($null -eq $Value) { return 'null' }
    if (($Value -is [System.Collections.IDictionary]) -and $Value.Count -eq 0) { return '{}' }
    return (ConvertTo-Json -InputObject $Value -Depth 20)
}

function Write-P0Json {
    param([Parameter(Mandatory)][string]$Path, $Value)
    Write-P0Text -Path $Path -Text ((ConvertTo-P0Json $Value) + "`r`n")
}

function Write-P0Argv {
    <# argv.json must END WITH "\n}" and nothing after it: on first start the editor adds
       "enable-crash-reporter" / "crash-reporter-id" by cutting the last 2 characters and appending
       ",\n...\n}" (1.146.0 out/mainImpl.js: t.substring(0,t.length-2).concat(",\n", ...)).
       A trailing newline after "}" produced broken JSON (seen on the testbed, 2026-11-13).
       An empty object is written with a comment line, so the appended comma lands in the comment. #>
    param([Parameter(Mandatory)][string]$Path, $Value)
    $isEmpty = ($null -eq $Value) -or (($Value -is [System.Collections.IDictionary]) -and $Value.Count -eq 0)
    if ($isEmpty) {
        $text = "{`n`t// written by scripts/p0-env.ps1: no argv settings in this environment`n}"
    } else {
        $text = ((ConvertTo-P0Json $Value) -replace "`r`n", "`n").TrimEnd()
        if (-not $text.EndsWith("`n}")) { throw "argv.json text does not end with a newline and '}'" }
    }
    Write-P0Text -Path $Path -Text $text
}

function Read-P0Json {
    param([Parameter(Mandatory)][string]$Path)
    $raw = [IO.File]::ReadAllText($Path)
    if ($raw.Length -gt 0 -and $raw[0] -eq [char]0xFEFF) { $raw = $raw.Substring(1) }
    return ($raw | ConvertFrom-Json)
}

function Invoke-P0Native {
    <# Runs a native command; returns @{ ExitCode; Output (string[]) }. Never throws on stderr. #>
    param([Parameter(Mandatory)][string]$FilePath, [string[]]$Arguments = @())
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $out = & $FilePath @Arguments 2>&1 | ForEach-Object { "$_" }
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $old
    }
    return [pscustomobject]@{ ExitCode = $code; Output = @($out) }
}

function Resolve-P0Editor {
    <# Finds exe, CLI, product.json and the built-in extensions folder of an unpacked zip. #>
    param([Parameter(Mandatory)][string]$Root)
    if (-not (Test-Path -LiteralPath $Root)) { throw "editor folder not found: $Root" }
    $pj = Join-Path $Root 'resources\app\product.json'
    if (-not (Test-Path -LiteralPath $pj)) {
        # versioned layout: <Root>\<commit10>\resources\app\product.json
        $cand = @(Get-ChildItem -LiteralPath $Root -Directory | ForEach-Object { Join-Path $_.FullName 'resources\app\product.json' } | Where-Object { Test-Path -LiteralPath $_ })
        if ($cand.Count -ne 1) { throw "product.json not found (or ambiguous) under $Root" }
        $pj = $cand[0]
    }
    $product = Read-P0Json $pj
    $exe = Join-Path $Root ($product.nameShort + '.exe')
    if (-not (Test-Path -LiteralPath $exe)) { throw "editor exe not found: $exe" }
    $cli = Join-Path $Root ('bin\' + $product.applicationName + '.cmd')
    if (-not (Test-Path -LiteralPath $cli)) { throw "editor CLI not found: $cli" }
    $hasTarget = $null -ne ($product.PSObject.Properties | Where-Object { $_.Name -eq 'target' })
    return [pscustomobject]@{
        Root           = $Root
        Exe            = $exe
        Cli            = $cli
        ProductJson    = $pj
        BuiltinExtDir  = Join-Path (Split-Path -Parent $pj) 'extensions'
        NameShort      = $product.nameShort
        Version        = $product.version
        Commit         = $product.commit
        DataFolderName = $product.dataFolderName
        PortableOk     = (-not $hasTarget)
    }
}

function Get-P0UpstreamRoot {
    return (Join-Path $script:P0Root 'vscode-1.146.0')
}

function Get-P0VscodiumRoot {
    param([string]$Override)
    if ($Override) { return $Override }
    $dirs = @(Get-ChildItem -LiteralPath $script:P0Root -Directory -Filter 'vscodium-*' -ErrorAction SilentlyContinue)
    if ($dirs.Count -eq 0) { throw "no VSCodium folder (vscodium-<version>) under $script:P0Root" }
    $best = $dirs | Sort-Object -Descending -Property @{ Expression = {
            $v = $_.Name.Substring('vscodium-'.Length)
            try { [version]$v } catch { [version]'0.0' }
        } } | Select-Object -First 1
    return $best.FullName
}

function Get-P0LockVersion {
    param([Parameter(Mandatory)][string]$Id)
    $p = Join-Path $script:P0RepoRoot 'extensions.lock.json'
    if (-not (Test-Path -LiteralPath $p)) { return $null }
    try {
        $lock = Read-P0Json $p
        $arr = $lock
        if ($lock.PSObject.Properties.Name -contains 'extensions') { $arr = $lock.extensions }
        foreach ($e in @($arr)) {
            if ($e.id -and ($e.id -ieq $Id)) { return [string]$e.version }
        }
    } catch { }
    return $null
}

function Find-P0Vsix {
    <# Finds the VSIX of an extension id in C:\b\p0\vsix (or sublime\). Prefers the ledger version. #>
    param([Parameter(Mandatory)][string]$Id)
    $dirs = @((Join-Path $script:P0Root 'vsix'), (Join-Path $script:P0Root 'sublime'))
    $rx = '^' + [regex]::Escape($Id) + '-(?<ver>\d+(\.\d+)*)(@(?<plat>[A-Za-z0-9-]+))?\.vsix$'
    $hits = @()
    foreach ($d in $dirs) {
        if (-not (Test-Path -LiteralPath $d)) { continue }
        # lock-fetch.mjs puts each VSIX in vsix\<id>-<version>[@<target>]\ ; also accept files directly in the folder
        $files = @(Get-ChildItem -LiteralPath $d -File -Filter '*.vsix')
        foreach ($sd in Get-ChildItem -LiteralPath $d -Directory) { $files += @(Get-ChildItem -LiteralPath $sd.FullName -File -Filter '*.vsix') }
        foreach ($f in $files) {
            $m = [regex]::Match($f.Name, $rx, 'IgnoreCase')
            if (-not $m.Success) { continue }
            $plat = $m.Groups['plat'].Value
            if ($plat -and $plat -ne 'win32-x64') { continue }
            $hits += [pscustomobject]@{ Path = $f.FullName; Version = $m.Groups['ver'].Value; Platform = $plat }
        }
    }
    if ($hits.Count -eq 0) { throw "VSIX not found for $Id in $($dirs -join ', ')" }
    $want = Get-P0LockVersion $Id
    if ($Id -ieq 'ms-ceintl.vscode-language-pack-ja' -and -not $want) { $want = $script:P0LangPackVersion }
    if ($want) {
        $w = @($hits | Where-Object { $_.Version -eq $want })
        if ($w.Count -ge 1) { return $w[0] }
        throw "VSIX for $Id version $want (ledger) not found; found: $(($hits | ForEach-Object { $_.Version }) -join ', ')"
    }
    return ($hits | Sort-Object -Descending -Property @{ Expression = { try { [version]$_.Version } catch { [version]'0.0' } } } | Select-Object -First 1)
}

function Get-P0EditorProcesses {
    <# Processes whose command line mentions the given folder (a data dir or an install dir). #>
    param([Parameter(Mandatory)][string]$Folder)
    $f = [IO.Path]::GetFullPath($Folder).TrimEnd('\')
    return @(Get-CimInstance Win32_Process | Where-Object {
            ($_.CommandLine -and $_.CommandLine.IndexOf($f, [StringComparison]::OrdinalIgnoreCase) -ge 0) -or
            ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($f + '\', [StringComparison]::OrdinalIgnoreCase))
        })
}

$script:P0ChildEnvPattern = '^(ELECTRON_RUN_AS_NODE|ELECTRON_NO_ATTACH_CONSOLE|VSCODE_.*)$'

function Invoke-P0WithEditorEnv {
    <# Runs $Body with ELECTRON_RUN_AS_NODE, ELECTRON_NO_ATTACH_CONSOLE and VSCODE_* removed and only
       VSCODE_PORTABLE set, then restores our own environment (same idea as Start-EditorProcess in
       scripts\measure.ps1). A parent editor or Electron app (VS Code's terminal, Claude Code) may have
       set these; ELECTRON_RUN_AS_NODE=1 makes Code.exe run as plain node and exit with code 9. #>
    param([Parameter(Mandatory)][string]$Portable, [Parameter(Mandatory)][scriptblock]$Body)
    $saved = @{}
    foreach ($item in @(Get-ChildItem Env:)) {
        if ($item.Name -match $script:P0ChildEnvPattern) { $saved[$item.Name] = $item.Value }
    }
    foreach ($k in $saved.Keys) { Remove-Item -LiteralPath ('Env:\' + $k) -ErrorAction SilentlyContinue }
    $env:VSCODE_PORTABLE = $Portable
    try {
        return (& $Body)
    } finally {
        Remove-Item Env:\VSCODE_PORTABLE -ErrorAction SilentlyContinue
        foreach ($k in $saved.Keys) { Set-Item -LiteralPath ('Env:\' + $k) -Value $saved[$k] }
    }
}

function Invoke-P0Cli {
    <# Runs the editor CLI with the env's data dirs and VSCODE_PORTABLE (other VSCODE_* removed;
       the CLI's own .cmd sets ELECTRON_RUN_AS_NODE=1 itself). #>
    param([Parameter(Mandatory)]$Editor, [Parameter(Mandatory)]$Paths, [string[]]$Arguments = @())
    $all = @('--user-data-dir', $Paths.UserData, '--extensions-dir', $Paths.Ext) + $Arguments
    $cli = $Editor.Cli
    return (Invoke-P0WithEditorEnv -Portable $Paths.Portable -Body { Invoke-P0Native -FilePath $cli -Arguments $all })
}

function Get-P0ProcessTree {
    <# The process with id $RootId and all its descendants (Win32_Process rows). Pure over $Processes when given. #>
    param([Parameter(Mandatory)][int]$RootId, $Processes)
    if ($null -eq $Processes) { $Processes = @(Get-CimInstance Win32_Process) }
    $byParent = @{}
    foreach ($p in $Processes) {
        $k = [int]$p.ParentProcessId
        if (-not $byParent.ContainsKey($k)) { $byParent[$k] = @() }
        $byParent[$k] += $p
    }
    $out = @()
    $root = @($Processes | Where-Object { [int]$_.ProcessId -eq $RootId })
    if ($root.Count -eq 0) { return @() }
    $queue = New-Object System.Collections.Queue
    $queue.Enqueue($root[0])
    $seen = @{}
    while ($queue.Count -gt 0) {
        $p = $queue.Dequeue()
        $id = [int]$p.ProcessId
        if ($seen.ContainsKey($id)) { continue }
        $seen[$id] = $true
        $out += $p
        if ($byParent.ContainsKey($id)) { foreach ($c in $byParent[$id]) { $queue.Enqueue($c) } }
    }
    return $out
}

function Stop-P0ProcessTree {
    <# Stops exactly the given root process and its descendants (never anything else). Returns the count. #>
    param([Parameter(Mandatory)][int]$RootId)
    # The tree is collected first, then the root is stopped first: if the children went first, the
    # still-running main process would log them as "crashed" (seen in main.log, 2026-11-13).
    $tree = @(Get-P0ProcessTree -RootId $RootId)
    foreach ($p in $tree) {
        try { Stop-Process -Id ([int]$p.ProcessId) -Force -ErrorAction Stop } catch { }
    }
    return $tree.Count
}

function Get-P0MainProcesses {
    <# Main editor processes of an environment: ExecutablePath equal to the env's exe, the env's user
       data dir on the command line, and no --type= (renderers, utility processes and the like have --type=). #>
    param([Parameter(Mandatory)][string]$ExePath, [Parameter(Mandatory)][string]$UserData)
    $exeName = Split-Path -Leaf $ExePath
    $exeFull = [IO.Path]::GetFullPath($ExePath)
    return @(Get-CimInstance Win32_Process | Where-Object {
            $_.Name -ieq $exeName -and
            $_.ExecutablePath -and ([IO.Path]::GetFullPath($_.ExecutablePath) -ieq $exeFull) -and
            $_.CommandLine -and
            $_.CommandLine.IndexOf($UserData, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and
            $_.CommandLine.IndexOf('--type=', [StringComparison]::OrdinalIgnoreCase) -lt 0
        })
}

# ---------------------------------------------------------------------------
# Testbed (docs/07 2.4, docs/03 section 4 stage A)
# ---------------------------------------------------------------------------

function Get-P0StageARemovals {
    <# Built-in extension folders removed in the testbed, with the unit they belong to.
       Pattern entries ('theme-*') are expanded against the folder list, keeping theme-defaults and theme-seti. #>
    return @(
        @{ Unit = 'A-1-copilot-extension'; Names = @('copilot') },
        @{ Unit = 'A-2-accounts-extensions'; Names = @('github', 'github-authentication', 'microsoft-authentication') },
        @{ Unit = 'A-3-debug-extensions'; Names = @('ms-vscode.js-debug', 'ms-vscode.js-debug-companion', 'ms-vscode.vscode-js-profile-table', 'debug-auto-launch', 'debug-server-ready') },
        @{ Unit = 'A-4-notebook-extensions'; Names = @('ipynb', 'notebook-renderers') },
        @{ Unit = 'A-5-remote-extensions'; Names = @('tunnel-forwarding') },
        @{ Unit = 'A-6-themes'; Names = @('theme-*') },
        @{ Unit = 'A-7-unused-extensions'; Names = @('grunt', 'gulp', 'jake', 'simple-browser', 'mermaid-markdown-features', 'extension-editing', 'terminal-suggest', 'php-language-features') }
    )
}

function Get-P0StageAPlan {
    <# Pure: given the folder names, returns @{ Remove = [@{Unit;Name}]; Skipped = [@{Unit;Name}] }. #>
    param([string[]]$FolderNames)
    $remove = @(); $skipped = @()
    $keepThemes = @('theme-defaults', 'theme-seti')
    foreach ($u in Get-P0StageARemovals) {
        foreach ($n in $u.Names) {
            if ($n -eq 'theme-*') {
                foreach ($f in ($FolderNames | Where-Object { $_ -like 'theme-*' -and $keepThemes -notcontains $_ } | Sort-Object)) {
                    $remove += [pscustomobject]@{ Unit = $u.Unit; Name = $f }
                }
            } elseif ($FolderNames -contains $n) {
                $remove += [pscustomobject]@{ Unit = $u.Unit; Name = $n }
            } else {
                $skipped += [pscustomobject]@{ Unit = $u.Unit; Name = $n }
            }
        }
    }
    return [pscustomobject]@{ Remove = $remove; Skipped = $skipped }
}

function Get-P0TestbedRoot { return (Join-Path $script:P0Root 'testbed') }

function Initialize-P0Testbed {
    <# Copies VSCodium to C:\b\p0\testbed and removes the stage A folders. Reuses the copy when its
       marker matches the source and the folder list is as expected, unless -Rebuild. Returns the marker. #>
    param([string]$VscodiumRoot, [switch]$Rebuild)
    $src = Get-P0VscodiumRoot $VscodiumRoot
    $dst = Assert-P0Path (Get-P0TestbedRoot)
    $srcEditor = Resolve-P0Editor $src
    $marker = Join-Path $dst 'p0-testbed.json'
    if (-not $Rebuild -and (Test-Path -LiteralPath $marker)) {
        $m = Read-P0Json $marker
        $dstExt = Join-Path $dst ($srcEditor.BuiltinExtDir.Substring($src.TrimEnd('\').Length + 1))
        $now = @(Get-ChildItem -LiteralPath $dstExt -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.Name } | Sort-Object)
        $want = @($m.remaining | Sort-Object)
        if ($m.source -ieq $src -and $m.sourceVersion -eq $srcEditor.Version -and (($now -join '|') -eq ($want -join '|'))) {
            Write-Host "testbed: reusing $dst (marker matches $src)"
            return $m
        }
        Write-Host 'testbed: marker or folder list differs; rebuilding'
    }
    $busy = @(Get-P0EditorProcesses $dst)
    if ($busy.Count -gt 0) { throw "testbed is in use by $($busy.Count) process(es); close the editors started from $dst first" }
    Write-Host "testbed: copying $src -> $dst"
    $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    & robocopy $src $dst /MIR /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
    $rc = $LASTEXITCODE
    $ErrorActionPreference = $old
    if ($rc -ge 8) { throw "robocopy failed ($rc)" }
    $global:LASTEXITCODE = 0
    $ed = Resolve-P0Editor $dst
    $names = @(Get-ChildItem -LiteralPath $ed.BuiltinExtDir -Directory | ForEach-Object { $_.Name })
    $plan = Get-P0StageAPlan -FolderNames $names
    foreach ($r in $plan.Remove) {
        $p = Assert-P0Path (Join-Path $ed.BuiltinExtDir $r.Name)
        Remove-Item -LiteralPath $p -Recurse -Force
    }
    $remaining = @(Get-ChildItem -LiteralPath $ed.BuiltinExtDir -Directory | ForEach-Object { $_.Name } | Sort-Object)
    $m = [ordered]@{
        source        = $src
        sourceVersion = $srcEditor.Version
        sourceCommit  = $srcEditor.Commit
        createdAt     = (Get-Date).ToString('o')
        removed       = @($plan.Remove | ForEach-Object { [ordered]@{ unit = $_.Unit; name = $_.Name } })
        skipped       = @($plan.Skipped | ForEach-Object { [ordered]@{ unit = $_.Unit; name = $_.Name; reason = 'not in VSCodium' } })
        remaining     = $remaining
        note          = 'product.json (builtInExtensions etc.) is left as shipped; only folders were removed (docs/07 2.4)'
    }
    Write-P0Json -Path $marker -Value $m
    Write-Host ("testbed: removed {0} folder(s), skipped {1} name(s) not in VSCodium" -f @($plan.Remove).Count, @($plan.Skipped).Count)
    return (Read-P0Json $marker)
}
