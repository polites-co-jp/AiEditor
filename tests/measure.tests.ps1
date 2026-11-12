# Unit tests for the calculations in scripts\measure.ps1 (no editor, no machine access).
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File tests/measure.tests.ps1
# Exit code = number of failed tests. ASCII only (Windows PowerShell 5.1).
$ErrorActionPreference = 'Stop'
$script:Pass = 0
$script:Fail = 0
function Test-Case {
    param([string]$Name, [scriptblock]$Body)
    try { & $Body; $script:Pass++; Write-Host "ok   $Name" }
    catch { $script:Fail++; Write-Host "FAIL $Name : $_" }
}
function Assert-True { param($Cond, [string]$Msg) if (-not $Cond) { throw "expected true: $Msg" } }
function Assert-Equal { param($Actual, $Expected, [string]$Msg) if ("$Actual" -ne "$Expected") { throw "expected '$Expected' but got '$Actual' : $Msg" } }
function Assert-Throws { param([scriptblock]$Body, [string]$Msg) $threw = $false; try { & $Body } catch { $threw = $true }; if (-not $threw) { throw "expected an error: $Msg" } }
function New-Proc {
    param([int]$Id, [int]$ParentId, [string]$Name, [string]$Cmd = '', [double]$Priv = 0, [double]$Ws = 0, $Created = $null)
    [pscustomobject]@{ ProcessId = $Id; ParentProcessId = $ParentId; Name = $Name; CommandLine = $Cmd; PrivatePageCount = $Priv; WorkingSetSize = $Ws; CreationDate = $Created }
}
function Ids { param($Procs) (@($Procs | ForEach-Object { [int]$_.ProcessId } | Sort-Object)) -join ',' }

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent $here
. (Join-Path $repo 'scripts\measure.ps1')

# ---- the script itself ------------------------------------------------------
foreach ($s in @('scripts\measure.ps1', 'scripts\netaudit.ps1')) {
    Test-Case "syntax: $s has no parse errors" {
        $errs = $null; $tokens = $null
        [void][System.Management.Automation.Language.Parser]::ParseFile((Join-Path $repo $s), [ref]$tokens, [ref]$errs)
        Assert-Equal @($errs).Count 0 (($errs | ForEach-Object { $_.Message }) -join '; ')
    }
    Test-Case "encoding: $s is ASCII only" {
        $bytes = [IO.File]::ReadAllBytes((Join-Path $repo $s))
        $bad = @($bytes | Where-Object { $_ -gt 127 }).Count
        Assert-Equal $bad 0 'non-ASCII bytes (PS 5.1 would read them as ANSI)'
    }
}
Test-Case 'dot-source loads functions without running' {
    Assert-True (Get-Command Get-ProcessRole -ErrorAction SilentlyContinue) 'Get-ProcessRole'
    Assert-True (Get-Command Get-Descendants -ErrorAction SilentlyContinue) 'Get-Descendants'
}

# ---- roles (docs/07 3.2 step 6) --------------------------------------------
$exe = '"C:\b\p0\vscode-1.146.0\Code.exe"'
$roleCases = @(
    @('Code.exe', "$exe --user-data-dir C:\x --extensions-dir C:\y C:\ws", 'main'),
    @('Code.exe', "$exe --type=renderer --user-data-dir=C:\x", 'renderer'),
    @('Code.exe', "$exe --type=gpu-process --user-data-dir=C:\x", 'gpu'),
    @('Code.exe', "$exe --type=crashpad-handler --user-data-dir=C:\x", 'crashpad'),
    @('Code.exe', "$exe --type=utility --utility-sub-type=network.mojom.NetworkService", 'utility-network'),
    @('Code.exe', "$exe --type=utility --utility-sub-type=audio.mojom.AudioService", 'utility-audio'),
    @('Code.exe', "$exe --type=utility --utility-sub-type=node.mojom.NodeService", 'utility-node'),
    @('Code.exe', "$exe --type=utility --utility-sub-type=something.else", 'utility-other'),
    @('Code.exe', "$exe --type=extensionHost --skipWorkspaceStorageLock", 'extension-host'),
    @('Code.exe', "$exe --type=utility --utility-sub-type=node.mojom.NodeService --vscode-utility-kind=extensionHost", 'extension-host'),
    @('Code.exe', "$exe --type=ptyHost --logsPath C:\l", 'pty-host'),
    @('Code.exe', "$exe --type=fileWatcher", 'file-watcher'),
    @('Code.exe', "$exe --type=shared-process", 'shared-process'),
    @('Code.exe', "$exe --type=somethingNew", 'type-somethingnew'),
    @('node.exe', '"C:\x\node.exe" C:\ext\typescript-language-features\node_modules\typescript\lib\tsserver.js', 'ts-server'),
    @('node.exe', '"node.exe" C:\ext\typescript\lib\typingsInstaller.js', 'ts-server'),
    @('node.exe', '"node.exe" C:\app\extensions\json-language-features\server\dist\node\jsonServerMain.js', 'language-server'),
    @('node.exe', '"node.exe" C:\ext\detachhead.basedpyright\node_modules\basedpyright\langserver.index.js', 'language-server'),
    @('node.exe', '"node.exe" C:\ext\x\out\languageServer.js --stdio', 'language-server'),
    @('claude.exe', '"C:\ext\anthropic.claude-code\resources\native-binary\claude.exe" --output-format stream-json', 'claude-cli'),
    @('CLAUDE.EXE', '', 'claude-cli'),
    @('powershell.exe', '"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -noexit', 'shell'),
    @('cmd.exe', 'C:\Windows\system32\cmd.exe /c x', 'shell'),
    @('conhost.exe', '\??\C:\Windows\system32\conhost.exe 0x4', 'console-host'),
    @('OpenConsole.exe', 'OpenConsole.exe', 'console-host'),
    @('node.exe', '"node.exe" C:\other.js', 'node-other'),
    @('copilot-runtime.exe', 'c:\b\p0\vscode-1.146.0\x\copilot-runtime.exe --headless --stdio', 'copilot-runtime'),
    @('PING.EXE', 'ping  -n 300 127.0.0.1 ', 'other'),
    @('Something.exe', '', 'other')
)
foreach ($rc in $roleCases) {
    Test-Case ("role: {0} -> {1}" -f $rc[0], $rc[2]) {
        Assert-Equal (Get-ProcessRole -Name $rc[0] -CommandLine $rc[1]) $rc[2] $rc[1]
    }
}
Test-Case 'role: null command line does not throw' {
    Assert-Equal (Get-ProcessRole -Name 'claude.exe' -CommandLine $null) 'claude-cli' ''
    Assert-Equal (Get-ProcessRole -Name 'powershell.exe' -CommandLine $null) 'shell' ''
}

# ---- descendants (step 5) ---------------------------------------------------
$t0 = [datetime]'2026-11-13T10:00:00'
$procs = @(
    (New-Proc 1 900 'Code.exe' "$exe --user-data-dir C:\x" 100 200 $t0),
    (New-Proc 2 1 'Code.exe' "$exe --type=renderer" 300 500 $t0.AddSeconds(1)),
    (New-Proc 3 1 'Code.exe' "$exe --type=ptyHost" 50 80 $t0.AddSeconds(1)),
    (New-Proc 4 3 'powershell.exe' 'powershell.exe' 40 70 $t0.AddSeconds(2)),
    (New-Proc 5 4 'claude.exe' 'claude.exe' 1000 2000 $t0.AddSeconds(3)),
    (New-Proc 6 5 'node.exe' 'node.exe x' 10 20 $t0.AddSeconds(4)),
    (New-Proc 7 6 'bash.exe' 'bash.exe' 5 6 $t0.AddSeconds(5)),
    (New-Proc 100 1000 'Code.exe' "$exe --user-data-dir C:\daily" 9999 9999 $t0),
    (New-Proc 101 100 'Code.exe' "$exe --type=renderer" 9999 9999 $t0),
    (New-Proc 50 51 'a.exe' '' 1 1 $t0),
    (New-Proc 51 50 'b.exe' '' 1 1 $t0)
)
Test-Case 'descendants: root plus all children, grandchildren; other trees excluded' {
    Assert-Equal (Ids (Get-Descendants -Processes $procs -RootIds @(1))) '1,2,3,4,5,6,7' ''
}
Test-Case 'descendants: a subtree root only gets its own subtree' {
    Assert-Equal (Ids (Get-Descendants -Processes $procs -RootIds @(4))) '4,5,6,7' ''
}
Test-Case 'descendants: unknown root gives nothing' {
    Assert-Equal (@(Get-Descendants -Processes $procs -RootIds @(12345)).Count) 0 ''
}
Test-Case 'descendants: multiple roots' {
    Assert-Equal (Ids (Get-Descendants -Processes $procs -RootIds @(1, 100))) '1,2,3,4,5,6,7,100,101' ''
}
Test-Case 'descendants: a cycle does not loop forever' {
    Assert-Equal (Ids (Get-Descendants -Processes $procs -RootIds @(50))) '50,51' ''
}
Test-Case 'descendants: PID reuse - a child older than its parent is not a child' {
    $p2 = @(
        (New-Proc 1 900 'Code.exe' '' 1 1 $t0),
        (New-Proc 2 1 'old.exe' '' 1 1 $t0.AddHours(-5)),
        (New-Proc 3 1 'new.exe' '' 1 1 $t0.AddSeconds(2))
    )
    Assert-Equal (Ids (Get-Descendants -Processes $p2 -RootIds @(1))) '1,3' ''
}
Test-Case 'descendants: works without CreationDate' {
    $p3 = @((New-Proc 1 0 'a.exe'), (New-Proc 2 1 'b.exe'))
    Assert-Equal (Ids (Get-Descendants -Processes $p3 -RootIds @(1))) '1,2' ''
}

# ---- claude split and totals (step 6, 7) ------------------------------------
$tree = @(Get-Descendants -Processes $procs -RootIds @(1))
Test-Case 'claude split: claude.exe and its descendants are separated' {
    $s = Split-ClaudeSubtree -Tree $tree
    Assert-Equal (Ids $s.Claude) '5,6,7' 'claude'
    Assert-Equal (Ids $s.Editor) '1,2,3,4' 'editor'
}
Test-Case 'claude split: no claude.exe -> everything is editor' {
    $s = Split-ClaudeSubtree -Tree @($procs[0], $procs[1])
    Assert-Equal @($s.Claude).Count 0 ''
    Assert-Equal @($s.Editor).Count 2 ''
}
Test-Case 'claude split: nested claude.exe stays in the claude side' {
    $p = @((New-Proc 1 0 'Code.exe'), (New-Proc 2 1 'claude.exe'), (New-Proc 3 2 'claude.exe'), (New-Proc 4 3 'node.exe'))
    $s = Split-ClaudeSubtree -Tree $p
    Assert-Equal (Ids $s.Claude) '2,3,4' ''
}
Test-Case 'totals: private bytes and working set, with and without claude' {
    $t = Get-ProcessTotals -Tree $tree
    # editor: 100+300+50+40 = 490 ; claude: 1000+10+5 = 1015
    Assert-Equal $t.PrivateExclClaude 490 'private excl'
    Assert-Equal $t.PrivateInclClaude 1505 'private incl'
    # editor ws: 200+500+80+70 = 850 ; claude ws: 2000+20+6 = 2026
    Assert-Equal $t.WorkingSetExclClaude 850 'ws excl'
    Assert-Equal $t.WorkingSetInclClaude 2876 'ws incl'
    Assert-Equal $t.ProcessCount 7 'count'
    Assert-Equal $t.ClaudeProcessCount 3 'claude count'
}
Test-Case 'totals: empty tree gives zeros' {
    $t = Get-ProcessTotals -Tree @()
    Assert-Equal $t.PrivateExclClaude 0 ''
    Assert-Equal $t.ProcessCount 0 ''
}
Test-Case 'totals: large values (above 4 GiB) are not truncated' {
    $big = @((New-Proc 1 0 'Code.exe' '' 5000000000 6000000000))
    $t = Get-ProcessTotals -Tree $big
    Assert-Equal $t.PrivateExclClaude 5000000000 ''
}
Test-Case 'rows: role, claude flag and bytes per process' {
    $rows = New-ProcessRows -Tree $tree -RunName 'run-1'
    Assert-Equal $rows.Count 7 ''
    $r5 = $rows | Where-Object { $_.ProcessId -eq 5 }
    Assert-Equal $r5.Role 'claude-cli' ''
    Assert-True $r5.InClaudeSubtree 'claude flagged'
    $r7 = $rows | Where-Object { $_.ProcessId -eq 7 }
    Assert-True $r7.InClaudeSubtree 'grandchild of claude flagged'
    $r2 = $rows | Where-Object { $_.ProcessId -eq 2 }
    Assert-Equal $r2.Role 'renderer' ''
    Assert-True (-not $r2.InClaudeSubtree) 'renderer not flagged'
    Assert-Equal $r2.PrivateBytes 300 ''
    Assert-Equal $r2.Run 'run-1' ''
}

# ---- median and range (docs/07 3.2) -----------------------------------------
Test-Case 'median: odd count' { Assert-Equal (Get-Median @(5, 1, 3, 2, 4)) 3 '' }
Test-Case 'median: even count averages the middle two' { Assert-Equal (Get-Median @(4, 1, 3, 2)) 2.5 '' }
Test-Case 'median: one value' { Assert-Equal (Get-Median @(7)) 7 '' }
Test-Case 'median: empty gives null' { Assert-True ($null -eq (Get-Median @())) '' }
Test-Case 'median: does not need sorted input, handles duplicates' { Assert-Equal (Get-Median @(9, 1, 9, 1, 5)) 5 '' }
Test-Case 'range: max minus min, with min/max/median/count' {
    $r = Get-RangeInfo @(100, 104, 98, 101, 99)
    Assert-Equal $r.Range 6 ''
    Assert-Equal $r.Min 98 ''
    Assert-Equal $r.Max 104 ''
    Assert-Equal $r.Median 100 ''
    Assert-Equal $r.Count 5 ''
}
Test-Case 'range: one value has range 0' { Assert-Equal (Get-RangeInfo @(5)).Range 0 '' }
Test-Case 'range: empty gives null' { Assert-True ($null -eq (Get-RangeInfo @())) '' }

# ---- verdict (docs/07 3.4) ---------------------------------------------------
$base = @(1000, 1010, 990, 1005, 995)   # median 1000, range 20
Test-Case 'verdict: clearly smaller -> pass, not within range' {
    $v = Get-MeasureVerdict -BaselineValues $base -CandidateValues @(800, 810, 790, 805, 795)
    Assert-True $v.Pass 'pass'
    Assert-True (-not $v.WithinRange) 'not within range'
    Assert-Equal $v.Reduction 200 ''
    Assert-Equal $v.ReductionPct 20 ''
}
Test-Case 'verdict: slightly smaller than the range -> pass, recorded as within range' {
    $v = Get-MeasureVerdict -BaselineValues $base -CandidateValues @(995, 1005, 985, 1000, 990)  # median 995, diff 5 < 20
    Assert-True $v.Pass 'pass'
    Assert-True $v.WithinRange 'within range'
    Assert-True ($v.Note -match 'range') 'note mentions the range'
}
Test-Case 'verdict: one byte smaller still passes (strictly smaller)' {
    $v = Get-MeasureVerdict -BaselineValues @(1000, 1000, 1000) -CandidateValues @(999, 999, 999)
    Assert-True $v.Pass 'pass'
}
Test-Case 'verdict: equal medians -> fail' {
    $v = Get-MeasureVerdict -BaselineValues $base -CandidateValues @(1000, 1000, 1000)
    Assert-True (-not $v.Pass) 'fail'
}
Test-Case 'verdict: larger -> fail' {
    $v = Get-MeasureVerdict -BaselineValues $base -CandidateValues @(1100, 1110, 1090)
    Assert-True (-not $v.Pass) 'fail'
    Assert-True (-not $v.WithinRange) 'WithinRange is only for passes'
}
Test-Case 'verdict: the median decides, not the best run' {
    # candidate best run is far below, but the median is above baseline
    $v = Get-MeasureVerdict -BaselineValues @(1000, 1000, 1000) -CandidateValues @(500, 1100, 1200)
    Assert-True (-not $v.Pass) 'median 1100 > 1000'
}
Test-Case 'verdict: empty input throws' {
    Assert-Throws { Get-MeasureVerdict -BaselineValues @() -CandidateValues @(1) } 'empty baseline'
    Assert-Throws { Get-MeasureVerdict -BaselineValues @(1) -CandidateValues @() } 'empty candidate'
}

# ---- main process finder, safety guard --------------------------------------
Test-Case 'main finder: picks only the main process of this data dir' {
    $u = 'C:\b\p0\run\a-run-1\user'
    $ps = @(
        (New-Proc 1 0 'Code.exe' "`"C:\Code.exe`" --user-data-dir `"$u`" --extensions-dir x C:\ws"),
        (New-Proc 2 1 'Code.exe' "`"C:\Code.exe`" --type=renderer --user-data-dir=`"$u`""),
        (New-Proc 3 0 'Code.exe' "`"C:\Code.exe`" --user-data-dir `"C:\Users\x\AppData\Roaming\Code`""),
        (New-Proc 4 0 'notepad.exe' "notepad --user-data-dir `"$u`""),
        (New-Proc 5 0 'Code.exe' $null)
    )
    Assert-Equal (Ids (Find-MainProcesses -Processes $ps -ExeName 'Code.exe' -UserDir $u)) '1' ''
    Assert-Equal (Ids (Find-MainProcesses -Processes $ps -ExeName 'code.exe' -UserDir $u.ToUpper())) '1' 'case-insensitive'
}
Test-Case 'safe path: daily editor data is refused' {
    if ($env:APPDATA) {
        Assert-Throws { Assert-SafeDataPath (Join-Path $env:APPDATA 'Code') } 'APPDATA\Code'
        Assert-Throws { Assert-SafeDataPath (Join-Path $env:APPDATA 'Code\User') } 'APPDATA\Code\User'
    }
    if ($env:USERPROFILE) {
        Assert-Throws { Assert-SafeDataPath (Join-Path $env:USERPROFILE '.vscode\extensions') } '.vscode\extensions'
    }
}
Test-Case 'safe path: the p0 work dir is accepted' {
    Assert-Equal (Assert-SafeDataPath 'C:\b\p0\run') 'C:\b\p0\run' ''
}

# ---- folderOpen task check, run values, compare mode -------------------------
$tmp = Join-Path ([IO.Path]::GetTempPath()) ("measure-tests-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
    Test-Case 'task check: tasks.json with folderOpen' {
        $ws = Join-Path $tmp 'ws1'; New-Item -ItemType Directory -Path (Join-Path $ws '.vscode') | Out-Null
        Set-Content -LiteralPath (Join-Path $ws '.vscode\tasks.json') -Value '{"version":"2.0.0","tasks":[{"label":"t","type":"shell","command":"x","runOptions":{"runOn":"folderOpen"}}]}'
        Assert-True (Test-FolderOpenTask $ws) 'has folderOpen'
    }
    Test-Case 'task check: missing or without folderOpen' {
        $ws = Join-Path $tmp 'ws2'; New-Item -ItemType Directory -Path (Join-Path $ws '.vscode') | Out-Null
        Assert-True (-not (Test-FolderOpenTask $ws)) 'no tasks.json'
        Set-Content -LiteralPath (Join-Path $ws '.vscode\tasks.json') -Value '{"version":"2.0.0","tasks":[]}'
        Assert-True (-not (Test-FolderOpenTask $ws)) 'no folderOpen'
    }

    function New-RunsCsv {
        param([string]$Dir, [double[]]$Counted, [double[]]$Warm = @())
        New-Item -ItemType Directory -Force -Path $Dir | Out-Null
        $rows = @()
        $i = 0
        foreach ($w in $Warm) { $i++; $rows += [pscustomobject]@{ Run = "warmup-$i"; Kind = 'warmup'; PrivateExclClaude = $w } }
        $i = 0
        foreach ($c in $Counted) { $i++; $rows += [pscustomobject]@{ Run = "run-$i"; Kind = 'measured'; PrivateExclClaude = $c } }
        $rows | Export-Csv -LiteralPath (Join-Path $Dir 'runs.csv') -NoTypeInformation
    }
    $dUp = Join-Path $tmp 'upstream'; $dMy = Join-Path $tmp 'mine'; $dBad = Join-Path $tmp 'worse'
    New-RunsCsv $dUp @(1000, 1010, 990, 1005, 995) @(5000)
    New-RunsCsv $dMy @(800, 810, 790, 805, 795) @(9999)
    New-RunsCsv $dBad @(1100, 1110, 1090, 1105, 1095)

    Test-Case 'run values: warm-up rows are not counted' {
        $v = Read-RunValues -Dir $dUp -Metric 'PrivateExclClaude'
        Assert-Equal $v.Count 5 ''
        Assert-Equal (Get-Median $v) 1000 ''
    }
    Test-Case 'run values: unknown column throws' {
        Assert-Throws { Read-RunValues -Dir $dUp -Metric 'Nope' } 'bad column'
    }
    Test-Case 'run values: missing runs.csv throws' {
        Assert-Throws { Read-RunValues -Dir (Join-Path $tmp 'nowhere') -Metric 'PrivateExclClaude' } 'missing'
    }
    Test-Case 'compare: pass writes verdict.md and verdict.json' {
        $out = Join-Path $tmp 'out1'
        $v = Invoke-Compare -Baseline $dUp -Candidate $dMy -Metric 'PrivateExclClaude' -OutDir $out 6>$null
        Assert-True $v.Pass 'pass'
        Assert-True (Test-Path (Join-Path $out 'verdict.md')) 'md'
        $j = Get-Content -LiteralPath (Join-Path $out 'verdict.json') -Raw | ConvertFrom-Json
        Assert-True $j.Verdict.Pass 'json pass'
        Assert-True ((Get-Content -LiteralPath (Join-Path $out 'verdict.md') -Raw) -match 'PASS') 'md says PASS'
    }
    Test-Case 'compare: fail' {
        $out = Join-Path $tmp 'out2'
        $v = Invoke-Compare -Baseline $dUp -Candidate $dBad -Metric 'PrivateExclClaude' -OutDir $out 6>$null
        Assert-True (-not $v.Pass) 'fail'
        Assert-True ((Get-Content -LiteralPath (Join-Path $out 'verdict.md') -Raw) -match 'FAIL') 'md says FAIL'
    }

    # started the way the docs say (-File, a fresh powershell.exe), without -Workspace (B-1)
    $script1 = Join-Path $repo 'scripts\measure.ps1'
    Test-Case 'default workspace: Get-DefaultWorkspace is <repo>\tmp\ws' {
        Assert-Equal (Get-DefaultWorkspace) (Join-Path $repo 'tmp\ws') ''
    }
    Test-Case '-File start without -Workspace: compare mode gives PASS, exit code 0, verdict.md' {
        $out = Join-Path $tmp 'file-pass'
        $o = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script1 -Baseline $dUp -Candidate $dMy -OutDir $out 2>&1
        Assert-Equal $LASTEXITCODE 0 (($o | Out-String))
        Assert-True ((Get-Content -LiteralPath (Join-Path $out 'verdict.md') -Raw) -match 'PASS') 'verdict.md says PASS'
    }
    Test-Case '-File start without -Workspace: compare mode gives FAIL, exit code 1, verdict.md' {
        $out = Join-Path $tmp 'file-fail'
        $o = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script1 -Baseline $dUp -Candidate $dBad -OutDir $out 2>&1
        Assert-Equal $LASTEXITCODE 1 (($o | Out-String))
        Assert-True ((Get-Content -LiteralPath (Join-Path $out 'verdict.md') -Raw) -match 'FAIL') 'verdict.md says FAIL'
    }
    Test-Case '-File start without -Workspace: measure mode reaches its own checks (no parameter-binding crash)' {
        $ErrorActionPreference = 'Continue'   # stderr of the child must not throw here
        $o = (& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script1 -Exe $env:ComSpec -EnvDir $tmp -Label x -OpenFiles a.ts -Runs 0 2>&1 | Out-String)
        Assert-True ($LASTEXITCODE -ne 0) 'must fail'
        Assert-True ($o -match 'Runs must be 1 or more') $o
        Assert-True (-not ($o -match 'Join-Path')) $o
    }
    Test-Case '-File start without -Workspace: netaudit.ps1 also reaches its own checks' {
        $ErrorActionPreference = 'Continue'
        $o = (& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'scripts\netaudit.ps1') -Exe $env:ComSpec -EnvDir $tmp -Label x -IntervalSeconds 0 2>&1 | Out-String)
        Assert-True ($LASTEXITCODE -ne 0) 'must fail'
        Assert-True (($o -match 'IntervalSeconds must be 1 or more') -or ($o -match 'Workspace not found')) $o
        Assert-True (-not ($o -match 'Join-Path')) $o
    }
}
finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

# ---- VSCODE_PORTABLE layout (env-setup.md of p0-envs-mydist-keys) -------------
Test-Case 'arguments: start - user data is <User>\user-data, workspace last' {
    $a = Get-EditorArguments -User 'C:\r\a\user' -Ext 'C:\r\a\ext' -Workspace 'C:\ws'
    Assert-Equal $a '--user-data-dir "C:\r\a\user\user-data" --extensions-dir "C:\r\a\ext" "C:\ws"' ''
}
Test-Case 'arguments: open files - -r, relative paths resolved against the workspace' {
    $a = Get-EditorArguments -User 'C:\r\a\user' -Ext 'C:\r\a\ext' -Workspace 'C:\ws' -Files @('src\a.ts', 'D:\x\b.py')
    Assert-Equal $a '--user-data-dir "C:\r\a\user\user-data" --extensions-dir "C:\r\a\ext" -r "C:\ws\src\a.ts" "D:\x\b.py"' ''
}
Test-Case 'main finder: works with the portable layout (user-data-dir is under the portable dir)' {
    $u = 'C:\b\p0\run\a-run-1\user'
    $cl = (Get-EditorArguments -User $u -Ext 'C:\b\p0\run\a-run-1\ext' -Workspace 'C:\ws')
    $ps = @(
        (New-Proc 1 0 'Code.exe' ('"C:\Code.exe" ' + $cl)),
        (New-Proc 2 0 'Code.exe' ('"C:\Code.exe" ' + (Get-EditorArguments -User 'C:\b\p0\run\a-run-2\user' -Ext 'x' -Workspace 'w')))
    )
    Assert-Equal (Ids (Find-MainProcesses -Processes $ps -ExeName 'Code.exe' -UserDir $u)) '1' 'only this run'
}
Test-Case 'portable env: the child sees VSCODE_PORTABLE, our own environment is restored (was unset)' {
    $saved = $env:VSCODE_PORTABLE
    Remove-Item Env:\VSCODE_PORTABLE -ErrorAction SilentlyContinue
    try {
        $p = Start-EditorProcess -Exe 'cmd.exe' -Arguments '/c if "%VSCODE_PORTABLE%"=="C:\p0test\user" (exit 7) else (exit 3)' -Portable 'C:\p0test\user'
        [void]$p.WaitForExit(20000)
        Assert-Equal $p.ExitCode 7 'child saw the value'
        Assert-True (-not (Test-Path Env:\VSCODE_PORTABLE)) 'parent unchanged (unset)'
    }
    finally { if ($null -ne $saved) { $env:VSCODE_PORTABLE = $saved } }
}
Test-Case 'portable env: ELECTRON_RUN_AS_NODE and VSCODE_* of the parent are hidden from the child and restored' {
    $s1 = $env:ELECTRON_RUN_AS_NODE; $s2 = $env:VSCODE_PID
    $env:ELECTRON_RUN_AS_NODE = '1'; $env:VSCODE_PID = '123'
    try {
        $p = Start-EditorProcess -Exe 'cmd.exe' -Arguments '/c if defined ELECTRON_RUN_AS_NODE (exit 5) else if defined VSCODE_PID (exit 6) else (exit 0)' -Portable 'C:\p0test\user'
        [void]$p.WaitForExit(20000)
        Assert-Equal $p.ExitCode 0 'child must not see them'
        Assert-Equal $env:ELECTRON_RUN_AS_NODE '1' 'restored'
        Assert-Equal $env:VSCODE_PID '123' 'restored'
    }
    finally {
        if ($null -ne $s1) { $env:ELECTRON_RUN_AS_NODE = $s1 } else { Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue }
        if ($null -ne $s2) { $env:VSCODE_PID = $s2 } else { Remove-Item Env:\VSCODE_PID -ErrorAction SilentlyContinue }
    }
}
Test-Case 'portable env: our own value is restored when it was already set' {
    $saved = $env:VSCODE_PORTABLE
    $env:VSCODE_PORTABLE = 'C:\mine'
    try {
        $p = Start-EditorProcess -Exe 'cmd.exe' -Arguments '/c exit 0' -Portable 'C:\p0test\user'
        [void]$p.WaitForExit(20000)
        Assert-Equal $env:VSCODE_PORTABLE 'C:\mine' ''
    }
    finally { if ($null -ne $saved) { $env:VSCODE_PORTABLE = $saved } else { Remove-Item Env:\VSCODE_PORTABLE -ErrorAction SilentlyContinue } }
}
$tmp2 = Join-Path ([IO.Path]::GetTempPath()) ("measure-tests2-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp2 | Out-Null
try {
    Test-Case 'daily argv: nothing created -> no change reported' {
        $before = @(Get-DailyArgvState -ProfileRoot $tmp2)
        Assert-Equal @($before | Where-Object { $_.Exists }).Count 0 'none exist in the empty profile'
        $after = @(Get-DailyArgvState -ProfileRoot $tmp2)
        Assert-Equal @(Compare-DailyArgvState -Before $before -After $after).Count 0 ''
    }
    Test-Case 'daily argv: a created or a rewritten argv.json is reported' {
        $before = @(Get-DailyArgvState -ProfileRoot $tmp2)
        New-Item -ItemType Directory -Force -Path (Join-Path $tmp2 '.vscode') | Out-Null
        Set-Content -LiteralPath (Join-Path $tmp2 '.vscode\argv.json') -Value '{}'
        $after = @(Get-DailyArgvState -ProfileRoot $tmp2)
        $bad = @(Compare-DailyArgvState -Before $before -After $after)
        Assert-Equal $bad.Count 1 'created'
        Assert-True ($bad[0] -like '*.vscode\argv.json') ''
        (Get-Item -LiteralPath (Join-Path $tmp2 '.vscode\argv.json')).LastWriteTimeUtc = (Get-Date).AddMinutes(5).ToUniversalTime()
        $after2 = @(Get-DailyArgvState -ProfileRoot $tmp2)
        Assert-Equal @(Compare-DailyArgvState -Before $after -After $after2).Count 1 'rewritten'
    }
    Test-Case 'env record: p0-env.json is read (editor.exe, data.*); absent gives null' {
        Assert-True ($null -eq (Read-P0EnvRecord (Join-Path $tmp2 'nowhere'))) ''
        $d = Join-Path $tmp2 'envx'
        New-Item -ItemType Directory -Path $d | Out-Null
        Set-Content -LiteralPath (Join-Path $d 'p0-env.json') -Value '{"name":"x","editor":{"exe":"C:\\b\\p0\\vscode-1.146.0\\Code.exe"},"data":{"portable":"C:\\d\\user"}}'
        $r = Read-P0EnvRecord $d
        Assert-Equal $r.editor.exe 'C:\b\p0\vscode-1.146.0\Code.exe' ''
        Assert-Equal $r.data.portable 'C:\d\user' ''
    }
}
finally { Remove-Item -LiteralPath $tmp2 -Recurse -Force -ErrorAction SilentlyContinue }

# ---- B-6: server scripts given without an extension ---------------------------
Test-Case 'role: jsonServerMain without .js (1.146.0 form) is a language server' {
    $cl = 'C:\b\p0\vscode-1.146.0\Code.exe c:\b\p0\vscode-1.146.0\69047191fc\resources\app\extensions\json-language-features\server\dist\node\jsonServerMain --node-ipc --clientProcessId=10488'
    Assert-Equal (Get-ProcessRole -Name 'Code.exe' -CommandLine $cl) 'language-server' ''
}
Test-Case 'role: the editor main process is still "main" (the server pattern does not catch it)' {
    $cl = '"C:\b\p0\vscode-1.146.0\Code.exe" --user-data-dir "C:\b\p0\run\a-run-1\user\user-data" --extensions-dir "C:\b\p0\run\a-run-1\ext" "E:\ws"'
    Assert-Equal (Get-ProcessRole -Name 'Code.exe' -CommandLine $cl) 'main' ''
}

# ---- role map: what the command line cannot tell (1.146.0 utility-node) --------
$nodeCl = '"C:\Code.exe" --type=utility --utility-sub-type=node.mojom.NodeService --lang=ja --user-data-dir="C:\u"'
$rtree = @(
    (New-Proc 1 0 'Code.exe' '"C:\Code.exe" --user-data-dir "C:\u\user-data" --extensions-dir "C:\e" "E:\ws"'),
    (New-Proc 10 1 'Code.exe' ($nodeCl + ' --inspect-port=0 --dns-result-order=ipv4first')),                     # extension host
    (New-Proc 13 10 'Code.exe' 'C:\Code.exe c:\x\json-language-features\server\dist\node\jsonServerMain --node-ipc'),
    (New-Proc 20 1 'Code.exe' $nodeCl),                                                                          # agent host (child copilot-runtime)
    (New-Proc 21 20 'copilot-runtime.exe' 'c:\x\copilot-runtime.exe --headless --stdio'),
    (New-Proc 22 21 'conhost.exe' '\??\C:\Windows\system32\conhost.exe 0x4'),
    (New-Proc 23 20 'Code.exe' '"C:\Code.exe" --type=utility --utility-sub-type=node.mojom.NodeService fileWatcher'),
    (New-Proc 30 1 'Code.exe' $nodeCl),                                                                          # ptyHost (children console host + shell)
    (New-Proc 31 30 'OpenConsole.exe' 'OpenConsole.exe'),
    (New-Proc 32 30 'powershell.exe' 'powershell.exe -NoLogo -NoProfile'),
    (New-Proc 40 1 'Code.exe' $nodeCl),                                                                          # no clue
    (New-Proc 41 1 'Code.exe' $nodeCl)                                                                           # no clue
)
$rm = Get-RoleMap -Tree $rtree
Test-Case 'role map: --inspect-port=0 marks the extension host' { Assert-Equal $rm[10] 'extension-host' '' }
Test-Case 'role map: a child copilot-runtime marks the agent host (even with a file-watcher child)' { Assert-Equal $rm[20] 'agent-host' '' }
Test-Case 'role map: children OpenConsole and a shell mark the ptyHost' { Assert-Equal $rm[30] 'pty-host' '' }
Test-Case 'role map: the other utility-node processes stay utility-node' {
    Assert-Equal $rm[40] 'utility-node' ''
    Assert-Equal $rm[41] 'utility-node' ''
}
Test-Case 'role map: processes that already have a role keep it' {
    Assert-Equal $rm[1] 'main' ''
    Assert-Equal $rm[13] 'language-server' ''
    Assert-Equal $rm[21] 'copilot-runtime' ''
    Assert-Equal $rm[22] 'console-host' ''
    Assert-Equal $rm[23] 'file-watcher' ''
    Assert-Equal $rm[32] 'shell' ''
}
Test-Case 'role map: a utility-node whose only clue is a file-watcher child is the shared process (inferred)' {
    $t = @((New-Proc 1 0 'Code.exe' $nodeCl), (New-Proc 2 1 'Code.exe' '"C:\Code.exe" --type=utility fileWatcher'))
    Assert-Equal (Get-RoleMap -Tree $t)[1] 'shared-process' ''
}
Test-Case 'role map: --inspect-port=0 wins over the child clues' {
    $t = @((New-Proc 1 0 'Code.exe' ($nodeCl + ' --inspect-port=0')), (New-Proc 2 1 'powershell.exe' 'powershell.exe'))
    Assert-Equal (Get-RoleMap -Tree $t)[1] 'extension-host' ''
}
Test-Case 'role map: --inspect-port=1234 (not 0) is not the extension host marker' {
    $t = @((New-Proc 1 0 'Code.exe' ($nodeCl + ' --inspect-port=1234')))
    Assert-Equal (Get-RoleMap -Tree $t)[1] 'utility-node' ''
}
Test-Case 'role map: the CSV rows use the refined roles and the roles table sums per role' {
    $rows = New-ProcessRows -Tree $rtree -RunName 'run-1'
    $r10 = $rows | Where-Object { $_.ProcessId -eq 10 }
    Assert-Equal $r10.Role 'extension-host' ''
    Assert-Equal (@($rows | Where-Object { $_.Role -eq 'utility-node' }).Count) 2 'only the two unexplained ones are left'
}
Test-Case 'role map: empty tree gives an empty map' { Assert-Equal (Get-RoleMap -Tree @()).Count 0 '' }

# ---- C-1: RoleSource (a guessed role must stay recognisable as a guess) ----------
$src = @{}
$rm2 = Get-RoleMap -Tree $rtree -Sources $src
Test-Case 'role source: roles read from the command line say "commandline"' {
    Assert-Equal $src[1] 'commandline' 'main'
    Assert-Equal $src[13] 'commandline' 'language server'
    Assert-Equal $src[40] 'commandline' 'unexplained utility-node (first pass)'
}
Test-Case 'role source: --inspect-port=0 is "commandline"; agent-host and pty-host are "child"' {
    Assert-Equal $src[10] 'commandline' 'extension host'
    Assert-Equal $src[20] 'child' 'agent host'
    Assert-Equal $src[30] 'child' 'pty host'
}
Test-Case 'role source: shared-process (a file-watcher child only) is "inferred"' {
    $s2 = @{}
    $t = @((New-Proc 1 0 'Code.exe' $nodeCl), (New-Proc 2 1 'Code.exe' '"C:\Code.exe" --type=utility fileWatcher'))
    $m = Get-RoleMap -Tree $t -Sources $s2
    Assert-Equal $m[1] 'shared-process' ''
    Assert-Equal $s2[1] 'inferred' ''
    Assert-Equal $s2[2] 'commandline' ''
}
Test-Case 'role source: Get-RoleMap still works without -Sources' {
    Assert-Equal (Get-RoleMap -Tree $rtree)[20] 'agent-host' ''
}
Test-Case 'role source: every row of the CSV carries RoleSource; inferred rows are findable' {
    $t = @((New-Proc 1 0 'Code.exe' $nodeCl), (New-Proc 2 1 'Code.exe' '"C:\Code.exe" --type=utility fileWatcher'), (New-Proc 3 0 'Code.exe' $nodeCl))
    $rows = New-ProcessRows -Tree $t -RunName 'run-1'
    foreach ($r in $rows) { Assert-True (@('commandline', 'child', 'inferred') -contains $r.RoleSource) "row $($r.ProcessId)" }
    $inf = @($rows | Where-Object { $_.RoleSource -eq 'inferred' })
    Assert-Equal $inf.Count 1 ''
    Assert-Equal $inf[0].Role 'shared-process' ''
}

# ---- extension of a language server (basedpyright vs json both are language-server) ----
Test-Case 'extension folder: builtin and installed extensions, node_modules and empty input' {
    Assert-Equal (Get-ExtensionFolder 'C:\Code.exe c:\x\69047191fc\resources\app\extensions\json-language-features\server\dist\node\jsonServerMain --node-ipc') 'json-language-features' 'builtin json'
    Assert-Equal (Get-ExtensionFolder '"node.exe" c:\b\p0\run\a-run-1\ext\detachhead.basedpyright-1.40.2\dist\server.js --stdio') 'detachhead.basedpyright-1.40.2' 'installed'
    Assert-Equal (Get-ExtensionFolder 'node.exe C:\x\resources\app\extensions\node_modules\typescript\lib\tsserver.js') '' 'node_modules is not an extension'
    Assert-Equal (Get-ExtensionFolder '') '' ''
    Assert-Equal (Get-ExtensionFolder $null) '' ''
}
Test-Case 'extension folder: the CSV rows tell the two language servers apart' {
    $t = @(
        (New-Proc 1 0 'Code.exe' '"C:\Code.exe" --user-data-dir "C:\u\user-data" --extensions-dir "C:\e" "E:\ws"'),
        (New-Proc 2 1 'Code.exe' 'C:\Code.exe c:\x\resources\app\extensions\json-language-features\server\dist\node\jsonServerMain --node-ipc'),
        (New-Proc 3 1 'node.exe' '"node.exe" c:\e\detachhead.basedpyright-1.40.2\ext\server.js'),
        (New-Proc 4 1 'node.exe' '"node.exe" c:\b\ext\detachhead.basedpyright-1.40.2\dist\languageserver.js --stdio')
    )
    $rows = New-ProcessRows -Tree $t -RunName 'run-1'
    $json = $rows | Where-Object { $_.ProcessId -eq 2 }
    $py = $rows | Where-Object { $_.ProcessId -eq 4 }
    Assert-Equal $json.Role 'language-server' ''
    Assert-Equal $json.Extension 'json-language-features' ''
    Assert-Equal $py.Role 'language-server' ''
    Assert-Equal $py.Extension 'detachhead.basedpyright-1.40.2' ''
    $main = $rows | Where-Object { $_.ProcessId -eq 1 }
    Assert-Equal $main.Extension '' 'only language servers get an extension'
}

# ---- stale run data (-KeepData, half-stopped runs) -----------------------------
$tmp4 = Join-Path ([IO.Path]::GetTempPath()) ("measure-tests4-" + [guid]::NewGuid().ToString('N'))
$root4 = Join-Path $tmp4 'run'
# run dirs (name <label>-run-<n> and user\ + ext\) and things that must never be touched
foreach ($n in @('trial-a-run-1', 'trial-b-run-1', 'live-run-1')) { New-Item -ItemType Directory -Path (Join-Path $root4 "$n\user"), (Join-Path $root4 "$n\ext") -Force | Out-Null }
New-Item -ItemType Directory -Path (Join-Path $root4 'other-1\user'), (Join-Path $root4 'other-1\ext') -Force | Out-Null      # wrong name
New-Item -ItemType Directory -Path (Join-Path $root4 'data\user'), (Join-Path $root4 'data\ext') -Force | Out-Null            # wrong name
New-Item -ItemType Directory -Path (Join-Path $root4 'noext-run-1\user') -Force | Out-Null                                    # wrong shape
Set-Content -LiteralPath (Join-Path $root4 'trial-a-run-1\user\f.txt') -Value 'x'
try {
    Test-Case 'stale dirs: only dirs with a run dir name AND shape are found (D-1)' {
        $f = @(Find-StaleRunDirs -WorkRoot $root4 -Processes @())
        Assert-Equal $f.Count 3 (($f | Out-String))
        Assert-True (-not (@($f | Where-Object { $_ -like '*other-1' -or $_ -like '*\data' -or $_ -like '*noext-run-1' }).Count)) 'wrong name / shape are not listed'
    }
    Test-Case 'run dir name: the three forms are accepted, others are not' {
        foreach ($ok in @('x-run-1', 'x-warmup-2', 'x-netaudit', 'a-b-run-10')) { Assert-True (Test-RunDirName $ok) $ok }
        foreach ($bad in @('data', 'vsix', 'vscode-1.146.0', 'x-run', 'x-run-', 'run-1', 'x-runs-1', 'x-netaudit2', '')) { Assert-True (-not (Test-RunDirName $bad)) "bad: $bad" }
    }
    Test-Case 'stale dirs: a dir whose path is in a running command line is NOT stale' {
        $live = Join-Path $root4 'live-run-1'
        $ps = @((New-Proc 9 0 'Code.exe' ('"C:\Code.exe" --user-data-dir "' + $live + '\user\user-data"')))
        $f = @(Find-StaleRunDirs -WorkRoot $root4 -Processes $ps)
        Assert-Equal $f.Count 2 ''
        Assert-True (-not (@($f | Where-Object { $_ -like '*live-run-1' }).Count)) 'live dir not listed'
    }
    Test-Case 'stale dirs: the name filter limits the list' {
        $f = @(Find-StaleRunDirs -WorkRoot $root4 -Processes @() -Filter 'trial-*')
        Assert-Equal $f.Count 2 ''
    }
    Test-Case 'stale dirs: a missing work root gives an empty list; the daily editor data is refused' {
        Assert-Equal @(Find-StaleRunDirs -WorkRoot (Join-Path $tmp4 'nowhere') -Processes @()).Count 0 ''
        if ($env:APPDATA) { Assert-Throws { Find-StaleRunDirs -WorkRoot (Join-Path $env:APPDATA 'Code') -Processes @() } 'APPDATA' }
    }
    Test-Case 'remove run dir: removes a dir with files and returns true' {
        $d = Join-Path $tmp4 'scratch-dir'
        New-Item -ItemType Directory -Path (Join-Path $d 'sub') -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $d 'sub\f.txt') -Value 'x'
        Assert-True (Remove-RunDataDir -Path $d -Tries 2) ''
        Assert-True (-not (Test-Path -LiteralPath $d)) ''
    }
    $ms4 = Join-Path $repo 'scripts\measure.ps1'
    # D-1: where -CleanStale may delete
    Test-Case 'cleanable root: C:\b\p0\run and below are allowed; C:\b\p0, C:\b, C:\, a look-alike are not' {
        Assert-True (Test-CleanableRoot 'C:\b\p0\run') 'run'
        Assert-True (Test-CleanableRoot 'C:\b\p0\run\sub') 'below run'
        Assert-True (Test-CleanableRoot 'c:\B\P0\RUN') 'case'
        Assert-True (-not (Test-CleanableRoot 'C:\b\p0')) 'C:\b\p0'
        Assert-True (-not (Test-CleanableRoot 'C:\b\p0\')) 'C:\b\p0\'
        Assert-True (-not (Test-CleanableRoot 'C:\b')) 'C:\b'
        Assert-True (-not (Test-CleanableRoot 'C:\')) 'C:\'
        Assert-True (-not (Test-CleanableRoot 'C:\b\p0\runner')) 'look-alike prefix'
        Assert-True (-not (Test-CleanableRoot 'C:\b\p0\data')) 'data'
    }
    Test-Case 'cleanable root: an unmarked folder outside C:\b\p0\run is refused, the marker allows it' {
        Assert-True (-not (Test-CleanableRoot $root4)) 'no marker'
        Assert-Throws { Clear-StaleRunDirs -WorkRoot $root4 -Filter 'trial-*' -Delete $true } 'delete refused'
        Assert-True (Test-Path -LiteralPath (Join-Path $root4 'trial-a-run-1')) 'nothing was deleted'
        Assert-Equal @(Clear-StaleRunDirs -WorkRoot $root4 -Filter 'trial-*' -Delete $false).Count 2 'listing is allowed'
    }
    Test-Case 'cleanable root: -WorkRoot C:\b\p0 stops -CleanStale (a mistyped path), exit code non-zero' {
        $ErrorActionPreference = 'Continue'
        $o = (& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ms4 -CleanStale -WorkRoot 'C:\b\p0' 2>&1 | Out-String)
        Assert-True ($LASTEXITCODE -ne 0) 'must fail'
        Assert-True ($o -match 'refusing') $o
        if (Test-Path 'C:\b\p0\data') { Assert-True $true 'data still there' }
    }
    Test-Case '-File start: -CleanStale on an unmarked folder stops with exit code non-zero and deletes nothing' {
        $ErrorActionPreference = 'Continue'
        $o = (& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ms4 -CleanStale -WorkRoot $root4 -StaleFilter 'trial-*' 2>&1 | Out-String)
        Assert-True ($LASTEXITCODE -ne 0) 'must fail'
        Assert-True (Test-Path -LiteralPath (Join-Path $root4 'trial-a-run-1')) 'still there'
    }
    Set-Content -LiteralPath (Join-Path $root4 $script:P0RunRootMarker) -Value 'marker' -Encoding ASCII
    Test-Case '-File start: with the marker, -CleanStale removes only matching run dirs; other folders stay (no editor started)' {
        $ErrorActionPreference = 'Continue'
        $o = (& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ms4 -CleanStale -WorkRoot $root4 -StaleFilter '*' 2>&1 | Out-String)
        Assert-Equal $LASTEXITCODE 0 $o
        foreach ($gone in @('trial-a-run-1', 'trial-b-run-1', 'live-run-1')) { Assert-True (-not (Test-Path -LiteralPath (Join-Path $root4 $gone))) "$gone removed" }
        foreach ($stay in @('other-1', 'data', 'noext-run-1')) { Assert-True (Test-Path -LiteralPath (Join-Path $root4 $stay)) "$stay stays (wrong name or shape)" }
        Assert-True (Test-Path -LiteralPath (Join-Path $root4 $script:P0RunRootMarker)) 'marker stays'
    }
    Test-Case 'work root marker: written into a new or empty work root, never into a non-empty folder' {
        $envx = Join-Path $tmp4 'envx'
        New-Item -ItemType Directory -Path (Join-Path $envx 'user'), (Join-Path $envx 'ext') -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $envx 'user\a.txt') -Value 'a'
        $newRoot = Join-Path $tmp4 'newroot'
        $d = New-RunDataDir -EnvDir $envx -WorkRoot $newRoot -Name 'x-run-1'
        Assert-True (Test-Path -LiteralPath (Join-Path $newRoot $script:P0RunRootMarker)) 'marker in a new root'
        Assert-True (Test-Path -LiteralPath (Join-Path $d.User 'a.txt')) 'template copied'
        $busy = Join-Path $tmp4 'busyroot'
        New-Item -ItemType Directory -Path (Join-Path $busy 'precious') -Force | Out-Null
        [void](New-RunDataDir -EnvDir $envx -WorkRoot $busy -Name 'x-run-1')
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $busy $script:P0RunRootMarker))) 'no marker in a non-empty folder'
        Assert-True (-not (Test-CleanableRoot $busy)) 'so it can not be cleaned'
    }
    Test-Case 'run dir name check: New-RunDataDir refuses other names' {
        $envx = Join-Path $tmp4 'envx'
        Assert-Throws { New-RunDataDir -EnvDir $envx -WorkRoot (Join-Path $tmp4 'r2') -Name 'data' } 'name data'
    }
}
finally { Remove-Item -LiteralPath $tmp4 -Recurse -Force -ErrorAction SilentlyContinue }

# ---- B-5: -OpenFiles (5.1 -File passes "a,b" as one string) --------------------
$tmp3 = Join-Path ([IO.Path]::GetTempPath()) ("measure-tests3-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path (Join-Path $tmp3 'ws\src') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tmp3 'envx\user'), (Join-Path $tmp3 'envx\ext') | Out-Null
$wsd = Join-Path $tmp3 'ws'
$fts = Join-Path $wsd 'src\a b.ts'      # a space in the name on purpose
$fpy = Join-Path $wsd 'src\b.py'
Set-Content -LiteralPath $fts -Value 'export const a = 1;'
Set-Content -LiteralPath $fpy -Value 'b = 2'
try {
    Test-Case 'open files: one string "a,b" (what -File gives) is split into two' {
        $r = Resolve-OpenFiles -Files ("$fts,$fpy") -Workspace $wsd
        Assert-Equal $r.Errors.Count 0 ($r.Errors -join '; ')
        Assert-Equal $r.Files.Count 2 ''
        Assert-Equal $r.Files[0] $fts ''
        Assert-Equal $r.Files[1] $fpy ''
    }
    Test-Case 'open files: a real array of two works too' {
        $r = Resolve-OpenFiles -Files @($fts, $fpy) -Workspace $wsd
        Assert-Equal $r.Errors.Count 0 ''
        Assert-Equal $r.Files.Count 2 ''
    }
    Test-Case 'open files: relative paths are taken from the workspace; spaces and quotes around entries are trimmed' {
        $r = Resolve-OpenFiles -Files ('src\a b.ts , "src\b.py"') -Workspace $wsd
        Assert-Equal $r.Errors.Count 0 ($r.Errors -join '; ')
        Assert-Equal $r.Files[0] $fts ''
        Assert-Equal $r.Files[1] $fpy ''
    }
    Test-Case 'open files: a missing file is an error, each missing path is named' {
        $r = Resolve-OpenFiles -Files ("$fts,$wsd\src\nope.py") -Workspace $wsd
        Assert-Equal $r.Errors.Count 1 ''
        Assert-True ($r.Errors[0] -like '*nope.py*') ''
    }
    Test-Case 'open files: not exactly two is an error (1, 3, none)' {
        Assert-True ((Resolve-OpenFiles -Files $fts -Workspace $wsd).Errors.Count -ge 1) 'one'
        Assert-True ((Resolve-OpenFiles -Files ("$fts,$fpy,$fpy") -Workspace $wsd).Errors.Count -ge 1) 'three'
        Assert-True ((Resolve-OpenFiles -Files @() -Workspace $wsd).Errors.Count -ge 1) 'none'
        Assert-True ((Resolve-OpenFiles -Files $null -Workspace $wsd).Errors.Count -ge 1) 'null'
    }
    Test-Case 'open files: a directory is not a file' {
        $r = Resolve-OpenFiles -Files ("$fts,$wsd\src") -Workspace $wsd
        Assert-True ($r.Errors.Count -ge 1) ''
    }
    Test-Case 'open files: two TS files give a warning (not one TS and one Python), no error' {
        $r = Resolve-OpenFiles -Files ("$fts,$fts") -Workspace $wsd
        Assert-Equal $r.Errors.Count 0 ''
        Assert-Equal $r.Warnings.Count 1 ''
    }
    Test-Case 'open files: one TS and one Python give no warning' {
        Assert-Equal (Resolve-OpenFiles -Files ("$fts,$fpy") -Workspace $wsd).Warnings.Count 0 ''
    }
    Test-Case 'open files: the editor argument line carries both files as separate quoted arguments' {
        $r = Resolve-OpenFiles -Files ("$fts,$fpy") -Workspace $wsd
        $a = Get-EditorArguments -User 'C:\r\user' -Ext 'C:\r\ext' -Workspace $wsd -Files $r.Files
        Assert-True ($a.EndsWith(('-r "{0}" "{1}"' -f $fts, $fpy))) $a
    }
    Test-Case 'open files: default comes from ws-info.json (openFilesFull); missing file gives an empty array' {
        $info = Join-Path $tmp3 'ws-info.json'
        (@{ openFilesFull = @($fts, $fpy) } | ConvertTo-Json) | Set-Content -LiteralPath $info -Encoding UTF8
        $d = @(Get-DefaultOpenFiles -InfoPath $info)
        Assert-Equal $d.Count 2 ''
        Assert-Equal $d[1] $fpy ''
        Assert-Equal @(Get-DefaultOpenFiles -InfoPath (Join-Path $tmp3 'none.json')).Count 0 ''
    }

    # started with -File, as in the docs: the 5.1 comma string must reach the script as two files
    $ms = Join-Path $repo 'scripts\measure.ps1'
    Test-Case '-File start: -OpenFiles "a,b" is accepted as two files (the run stops later, at the tasks.json check)' {
        $ErrorActionPreference = 'Continue'
        $o = (& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ms -Exe $env:ComSpec -EnvDir (Join-Path $tmp3 'envx') -Workspace $wsd -Label x -OpenFiles "$fts,$fpy" 2>&1 | Out-String)
        Assert-True ($LASTEXITCODE -ne 0) 'must stop'
        Assert-True ($o -match 'tasks.json') $o
        Assert-True (-not ($o -match '-OpenFiles')) $o
    }
    Test-Case '-File start: a missing second file is reported as its own path (so the string was split)' {
        $ErrorActionPreference = 'Continue'
        $o = (& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ms -Exe $env:ComSpec -EnvDir (Join-Path $tmp3 'envx') -Workspace $wsd -Label x -OpenFiles "$fts,$wsd\src\gone.py" 2>&1 | Out-String)
        Assert-True ($LASTEXITCODE -ne 0) 'must stop'
        Assert-True ($o -match 'gone\.py') $o
        Assert-True (-not ($o -match 'a b\.ts,')) 'the first file is fine and must not be reported'
    }
    Test-Case '-File start: three files stop the run' {
        $ErrorActionPreference = 'Continue'
        $o = (& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ms -Exe $env:ComSpec -EnvDir (Join-Path $tmp3 'envx') -Workspace $wsd -Label x -OpenFiles "$fts,$fpy,$fpy" 2>&1 | Out-String)
        Assert-True ($LASTEXITCODE -ne 0) 'must stop'
        Assert-True ($o -match 'exactly 2') $o
    }
    Test-Case '-File start: netaudit.ps1 splits and checks -OpenFiles the same way' {
        $ErrorActionPreference = 'Continue'
        $o = (& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'scripts\netaudit.ps1') -Exe $env:ComSpec -EnvDir (Join-Path $tmp3 'envx') -Workspace $wsd -Label x -OpenFiles "$fts,$wsd\src\gone.py" 2>&1 | Out-String)
        Assert-True ($LASTEXITCODE -ne 0) 'must stop'
        Assert-True ($o -match 'gone\.py') $o
    }
}
finally { Remove-Item -LiteralPath $tmp3 -Recurse -Force -ErrorAction SilentlyContinue }

Write-Host ''
Write-Host ("passed: {0}  failed: {1}" -f $script:Pass, $script:Fail)
exit $script:Fail
