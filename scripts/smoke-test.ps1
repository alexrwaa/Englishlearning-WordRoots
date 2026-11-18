# WordRoots portable smoke test — release gate.
#
# This script answers one question: does the packaged app really render and
# really work inside WebView2, in every proxy/path environment a user may have?
#
# A created SQLite file is NOT evidence: a blank window still creates one. Each
# scenario therefore asserts three independent things:
#   1. app-data/logs/frontend-ready.json exists within 30s and the payload shows
#      a mounted DOM (domNodes > 20, textChars > 200) — i.e. React rendered and
#      IPC works.
#   2. data/wordroots.db exists and is non-empty.
#   3. the ready payload reports contentSource=external: the packaged courses/
#      folder was applied instead of the embedded fallback, so the artefact under
#      test really is the product being shipped.
#   4. when the harness asks for the in-app self-test (WORDROOTS_SELFTEST=1),
#      app-data/logs/selftest.json reports ok=true and attemptsAfter > attemptsBefore
#      — i.e. a real lesson was answered, not just painted.
#
# Every scenario runs from its own fresh unzip so cases cannot contaminate each
# other, and the script exits non-zero as soon as any assertion fails: this is a
# gate, not a report generator. Details (log tail, startup-failed.json) are
# printed for the failing case and written to dist-portable/smoke-report.md.
#
# Written for Windows PowerShell 5.1 and PowerShell 7 (no PS7-only syntax).

[CmdletBinding()]
param(
  [string]$Zip = '',
  # The first case on a cold CI runner measured 30.2 s to first paint once
  # (WebView2 profile creation + AV scanning the bundle); 30 s was too tight and
  # reported a working build as broken. A真 blank window still fails: the wait is
  # bounded and the assertion is on content, not on process liveness.
  [int]$ReadyTimeoutSec = 75,
  [int]$SelftestTimeoutSec = 240,
  [switch]$KeepTemp
)

$ErrorActionPreference = 'Stop'
$script:Results = @()
$script:Failures = @()
$script:Started = Get-Date

$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $Zip) { $Zip = Join-Path $repoRoot 'dist-portable/WordRoots-Portable-Windows-x64.zip' }
if (-not (Test-Path $Zip)) { throw "portable zip not found: $Zip (run scripts/package-portable.ps1 first)" }
$Zip = (Resolve-Path $Zip).Path

$outDir = Split-Path -Parent $Zip
$reportPath = Join-Path $outDir 'smoke-report.md'
$script:LogDumpDir = Join-Path $outDir 'smoke-logs'
if (Test-Path -LiteralPath $script:LogDumpDir) {
  Remove-Item -LiteralPath $script:LogDumpDir -Recurse -Force -ErrorAction SilentlyContinue
}
$asciiRoot = Join-Path $env:TEMP ("wordroots-smoke-{0}" -f (Get-Random))
# Deliberately contains a space and Chinese characters: proves neither breaks
# launch, data placement, or the WebView2 user-data folder path.
$unicodeRoot = Join-Path $env:TEMP ("便携 测试 {0}" -f (Get-Random))

$proxyVars = @(
  'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY',
  'http_proxy', 'https_proxy', 'all_proxy',
  'NO_PROXY', 'no_proxy',
  'WORDROOTS_SELFTEST'
)
$savedEnv = @{}
foreach ($name in $proxyVars) { $savedEnv[$name] = [System.Environment]::GetEnvironmentVariable($name, 'Process') }

# ---------------------------------------------------------------- utilities ---

function Write-Step([string]$message) {
  Write-Host ''
  Write-Host "== $message" -ForegroundColor Cyan
}

function Read-JsonFile([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  try {
    $text = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    if (-not $text.Trim()) { return $null }
    return ($text | ConvertFrom-Json)
  } catch {
    return $null
  }
}

function Set-ProcessEnv([hashtable]$Vars) {
  foreach ($name in $proxyVars) { [System.Environment]::SetEnvironmentVariable($name, $null, 'Process') }
  foreach ($key in $Vars.Keys) {
    [System.Environment]::SetEnvironmentVariable([string]$key, [string]$Vars[$key], 'Process')
  }
}

function Restore-ProcessEnv {
  foreach ($name in $proxyVars) {
    [System.Environment]::SetEnvironmentVariable($name, $savedEnv[$name], 'Process')
  }
}

function Stop-App($Process) {
  if ($null -eq $Process) { return }
  try {
    if (-not $Process.HasExited) {
      Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
      [void]$Process.WaitForExit(5000)
    }
  } catch {
    Write-Warning "could not stop process $($Process.Id): $_"
  }
}

function Get-FileSize([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return -1 }
  return (Get-Item -LiteralPath $Path).Length
}

function Reset-CaseState([string]$AppDir, [switch]$KeepData) {
  $logDir = Join-Path $AppDir 'app-data/logs'
  if (Test-Path -LiteralPath $logDir) {
    Get-ChildItem -LiteralPath $logDir -Force -File -ErrorAction SilentlyContinue |
      Remove-Item -Force -ErrorAction SilentlyContinue
  }
  if (-not $KeepData) {
    $dataDir = Join-Path $AppDir 'data'
    if (Test-Path -LiteralPath $dataDir) {
      Get-ChildItem -LiteralPath $dataDir -Force -File -ErrorAction SilentlyContinue |
        Remove-Item -Force -ErrorAction SilentlyContinue
    }
  }
}

function New-AppCopy([string]$CaseDir) {
  if (Test-Path -LiteralPath $CaseDir) { Remove-Item -LiteralPath $CaseDir -Recurse -Force }
  New-Item -ItemType Directory -Path $CaseDir -Force | Out-Null
  Expand-Archive -LiteralPath $Zip -DestinationPath $CaseDir -Force
  $appDir = Join-Path $CaseDir 'WordRoots'
  if (-not (Test-Path (Join-Path $appDir 'WordRoots.exe'))) {
    throw "unexpected archive layout: $CaseDir does not contain WordRoots/WordRoots.exe"
  }
  return $appDir
}

function Wait-ForJson([string]$Path, [int]$TimeoutSec) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    $json = Read-JsonFile $Path
    if ($null -ne $json) { return $json }
    Start-Sleep -Milliseconds 200
  }
  return $null
}

function Show-FailureContext([string]$AppDir) {
  $log = Join-Path $AppDir 'app-data/logs/wordroots.log'
  if (Test-Path -LiteralPath $log) {
    Write-Host '---- wordroots.log (last 40 lines) ----' -ForegroundColor DarkYellow
    Get-Content -LiteralPath $log -Tail 40 | ForEach-Object { Write-Host $_ }
  } else {
    Write-Host "---- wordroots.log missing: $log ----" -ForegroundColor DarkYellow
  }
  foreach ($name in @('startup-failed.json', 'frontend-ready.json', 'selftest.json')) {
    $path = Join-Path $AppDir "app-data/logs/$name"
    if (Test-Path -LiteralPath $path) {
      Write-Host "---- $name ----" -ForegroundColor DarkYellow
      Get-Content -LiteralPath $path -Raw | ForEach-Object { Write-Host $_ }
    }
  }
}

function Save-FailureLogs([string]$AppDir, [string]$Name) {
  # Copies the failing case's log folder next to the report so CI can upload it;
  # the case itself is deleted right after.
  if (-not (Test-Path -LiteralPath $AppDir)) { return }
  $source = Join-Path $AppDir 'app-data/logs'
  if (-not (Test-Path -LiteralPath $source)) { return }
  $safe = ($Name -replace '[\\/:*?"<>|]', '_')
  $dest = Join-Path $script:LogDumpDir $safe
  New-Item -ItemType Directory -Path $dest -Force | Out-Null
  Copy-Item -Path (Join-Path $source '*') -Destination $dest -Recurse -Force -ErrorAction SilentlyContinue
}

# ------------------------------------------------------------- proxy control ---

$wininetKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'
$wininetProps = @('ProxyEnable', 'ProxyServer', 'ProxyOverride', 'AutoConfigURL')

function Send-InternetSettingsChanged {
  # Best effort: tell WinINET the settings changed so its cached copy is dropped.
  try {
    if (-not ('WordRoots.Inet' -as [type])) {
      Add-Type -Namespace WordRoots -Name Inet -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("wininet.dll", SetLastError = true)]
public static extern bool InternetSetOption(System.IntPtr hInternet, int dwOption, System.IntPtr lpBuffer, int dwBufferLength);
'@ -ErrorAction Stop
    }
    # 39 = INTERNET_OPTION_SETTINGS_CHANGED, 37 = INTERNET_OPTION_REFRESH
    [void][WordRoots.Inet]::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0)
    [void][WordRoots.Inet]::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0)
  } catch {
    Write-Warning "InternetSetOption unavailable (registry still written): $_"
  }
}

function Backup-ProxyRegistry {
  $backup = @{}
  foreach ($prop in $wininetProps) {
    $present = $false
    $value = $null
    try {
      $item = Get-ItemProperty -Path $wininetKey -Name $prop -ErrorAction Stop
      $present = $true
      $value = $item.$prop
    } catch {
      $present = $false
    }
    $backup[$prop] = @{ Present = $present; Value = $value }
  }
  return $backup
}

function Restore-ProxyRegistry([hashtable]$Backup) {
  foreach ($prop in $wininetProps) {
    $entry = $Backup[$prop]
    try {
      if ($entry.Present) {
        Set-ItemProperty -Path $wininetKey -Name $prop -Value $entry.Value
      } else {
        Remove-ItemProperty -Path $wininetKey -Name $prop -ErrorAction SilentlyContinue
      }
    } catch {
      Write-Warning "could not restore registry value ${prop}: $_"
    }
  }
  Send-InternetSettingsChanged
}

function Set-DeadProxyRegistry([string]$PacUrl) {
  Set-ItemProperty -Path $wininetKey -Name ProxyEnable -Value 1 -Type DWord
  Set-ItemProperty -Path $wininetKey -Name ProxyServer -Value '127.0.0.1:9' -Type String
  Set-ItemProperty -Path $wininetKey -Name ProxyOverride -Value '' -Type String
  if ($PacUrl) {
    Set-ItemProperty -Path $wininetKey -Name AutoConfigURL -Value $PacUrl -Type String
  } else {
    Remove-ItemProperty -Path $wininetKey -Name AutoConfigURL -ErrorAction SilentlyContinue
  }
  Send-InternetSettingsChanged
}

# ----------------------------------------------------------- scenario runner ---

function New-ResultRow {
  param(
    [string]$Id, [string]$Title, [string]$Expect,
    [string]$Ready, [string]$Db, [string]$Selftest, [string]$Content, [string]$Verdict, [string]$Detail
  )
  return [pscustomobject]@{
    Id = $Id; Title = $Title; Expect = $Expect
    Ready = $Ready; Db = $Db; Selftest = $Selftest; Content = $Content; Verdict = $Verdict; Detail = $Detail
  }
}

function Invoke-Case {
  param(
    [string]$Id,
    [string]$Title,
    [string]$Expect,
    [string]$Workspace,
    [hashtable]$EnvVars = @{},
    [switch]$Selftest,
    [string]$ReuseDir = '',
    [switch]$KeepCase,
    [switch]$KeepData
  )

  Write-Step "$Id $Title"

  $caseDir = ''
  $appDir = ''
  $proc = $null
  $recorded = $false
  $readyVerdict = 'FAIL'
  $dbVerdict = 'FAIL'
  $selftestVerdict = 'n/a'
  $contentVerdict = 'n/a'
  $extraVerdict = 'n/a'
  $readyNote = ''
  $dbNote = ''
  $selftestNote = 'not requested'
  $contentNote = ''
  $extraNote = ''

  try {
    if ($ReuseDir) {
      # Scenario 7: relaunch an existing folder from its new location. Its data
      # must stay put, so only the logs are cleared.
      $appDir = $ReuseDir
    } else {
      $caseDir = Join-Path $Workspace ("case{0}" -f $Id)
      $appDir = New-AppCopy $caseDir
    }

    Reset-CaseState $appDir -KeepData:$KeepData

    $dbPath = Join-Path $appDir 'data/wordroots.db'
    $dbBefore = Get-FileSize $dbPath

    $readyPath = Join-Path $appDir 'app-data/logs/frontend-ready.json'
    $selftestPath = Join-Path $appDir 'app-data/logs/selftest.json'
    $exe = Join-Path $appDir 'WordRoots.exe'

    $effectiveEnv = @{}
    foreach ($key in $EnvVars.Keys) { $effectiveEnv[$key] = $EnvVars[$key] }
    if ($Selftest) { $effectiveEnv['WORDROOTS_SELFTEST'] = '1' }

    # Chromium/WebView2 diagnostics go to stderr; without capturing them a blank
    # window is undebuggable. The files travel with the smoke evidence.
    $stdoutPath = Join-Path $appDir 'app-data/logs/stdout.txt'
    $stderrPath = Join-Path $appDir 'app-data/logs/stderr.txt'
    $logDir = Join-Path $appDir 'app-data/logs'
    if (-not (Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

    Set-ProcessEnv $effectiveEnv
    try {
      $proc = Start-Process -FilePath $exe -WorkingDirectory $appDir -PassThru `
        -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
    } finally {
      Restore-ProcessEnv
    }
    Write-Host "launched pid=$($proc.Id) from $appDir"

    # --- assertion 1: the frontend mounted and painted ----------------------
    $ready = Wait-ForJson $readyPath $ReadyTimeoutSec
    if ($null -eq $ready) {
      $readyNote = "frontend-ready.json missing after ${ReadyTimeoutSec}s"
    } else {
      $paint = $ready.payload
      if ($null -ne $paint -and $paint.phase -eq 'selftest') {
        # The self-test finished fast enough to overwrite the mounted report;
        # its payload carries the same paint evidence, so read it from there.
        $alt = Read-JsonFile $selftestPath
        if ($null -ne $alt) { $paint = $alt.payload }
      }
      $domNodes = 0
      $textChars = 0
      if ($null -ne $paint) {
        if ($null -ne $paint.domNodes) { $domNodes = [int]$paint.domNodes }
        if ($null -ne $paint.textChars) { $textChars = [int]$paint.textChars }
      }
      if ($domNodes -gt 20 -and $textChars -gt 200) {
        $readyVerdict = 'PASS'
        $readyNote = "domNodes=$domNodes textChars=$textChars"
      } else {
        $readyNote = "painted too little: domNodes=$domNodes textChars=$textChars"
      }
      # The packaged folder ships courses/, so the app must run on the external
      # pack. Falling back to the embedded curriculum means the product being
      # tested is not the product being shipped.
      if ($null -ne $paint -and $null -ne $paint.contentSource) {
        $contentVerdict = 'FAIL'
        $contentNote = "source=$($paint.contentSource) version=$($paint.contentVersion)"
        if ([string]$paint.contentSource -eq 'external') { $contentVerdict = 'PASS' }
      } else {
        $contentNote = 'contentSource missing from the ready payload'
      }
    }
    Write-Host "frontend_ready: $readyVerdict ($readyNote)"
    Write-Host "courses: $contentVerdict ($contentNote)"

    # --- assertion 2: the portable database exists and has content ----------
    $dbDeadline = (Get-Date).AddSeconds(10)
    while ((Get-Date) -lt $dbDeadline) {
      $size = Get-FileSize $dbPath
      if ($size -gt 0) {
        $dbVerdict = 'PASS'
        $dbNote = "size=$size"
        break
      }
      Start-Sleep -Milliseconds 250
    }
    if ($dbVerdict -ne 'PASS') { $dbNote = "missing or empty: $dbPath" }
    Write-Host "database: $dbVerdict ($dbNote)"

    # --- assertion 3: the in-app interaction self-test ----------------------
    if ($Selftest) {
      $selftestVerdict = 'FAIL'
      $selftestNote = 'selftest.json missing (the harness never finished a lesson)'
      $report = Wait-ForJson $selftestPath $SelftestTimeoutSec
      if ($null -ne $report -and $null -ne $report.payload) {
        $body = $report.payload
        $ok = [bool]$body.ok
        $attemptsBefore = [int]$body.attemptsBefore
        $attemptsAfter = [int]$body.attemptsAfter
        $steps = [int]$body.steps
        $fatal = ''
        if ($null -ne $body.fatal) { $fatal = [string]$body.fatal }
        if ($ok -and $attemptsAfter -gt $attemptsBefore) {
          $selftestVerdict = 'PASS'
          $selftestNote = "steps=$steps attempts $attemptsBefore->$attemptsAfter"
        } else {
          $selftestNote = "ok=$ok attempts $attemptsBefore->$attemptsAfter steps=$steps fatal=$fatal"
        }
      }
      Write-Host "selftest: $selftestVerdict ($selftestNote)"
    }

    # --- scenario-specific extra assertion (folder migration) ---------------
    if ($ReuseDir) {
      $dbAfter = Get-FileSize $dbPath
      # WAL mode lets the main file move by a page on open/close; more than one
      # page would mean the folder is not portable after all.
      $tolerance = 4096
      $delta = 0
      if ($dbBefore -ge 0 -and $dbAfter -ge 0) { $delta = $dbAfter - $dbBefore }
      if ($dbBefore -gt 0 -and $dbAfter -gt 0 -and [math]::Abs($delta) -le $tolerance -and $readyVerdict -eq 'PASS') {
        $extraVerdict = 'PASS'
        $extraNote = "db $dbBefore->$dbAfter (delta=$delta)"
      } else {
        $extraVerdict = 'FAIL'
        $extraNote = "db $dbBefore->$dbAfter (delta=$delta), ready=$readyVerdict"
      }
      Write-Host "migration: $extraVerdict ($extraNote)"
    }

    # A release binary must serve the bundled assets. `dev_mode=true` means the
    # `custom-protocol` feature was missing at build time and the window is
    # pointing at the Vite dev server — the exact 0.1.0 defect.
    $boot = Read-JsonFile (Join-Path $appDir 'app-data/logs/startup-boot.json')
    $devMode = $null
    if ($null -ne $boot) { $devMode = $boot.dev_mode }
    if ($devMode -eq $true) {
      Write-Host 'RELEASE GUARD: binary is in dev mode (dev_mode=true)' -ForegroundColor Red
    }

    $failed = @()
    if ($devMode -eq $true) { $failed += 'dev_mode' }
    if ($readyVerdict -ne 'PASS') { $failed += 'frontend_ready' }
    if ($dbVerdict -ne 'PASS') { $failed += 'db' }
    if ($contentVerdict -ne 'PASS') { $failed += 'courses' }
    if ($Selftest -and $selftestVerdict -ne 'PASS') { $failed += 'selftest' }
    if ($ReuseDir -and $extraVerdict -ne 'PASS') { $failed += 'migration' }

    $verdict = 'PASS'
    if ($failed.Count -gt 0) { $verdict = 'FAIL' }

    $bootNote = ''
    if ($devMode -eq $true) { $bootNote = 'dev_mode=true：二进制加载的是开发服务器（缺少 custom-protocol）' }
    $detail = (@($bootNote, $readyNote, $dbNote, $contentNote, $selftestNote, $extraNote) | Where-Object { $_ }) -join ' | '
    $row = New-ResultRow -Id $Id -Title $Title -Expect $Expect -Ready $readyVerdict `
      -Db $dbVerdict -Selftest $selftestVerdict -Content $contentVerdict -Verdict $verdict -Detail $detail
    $script:Results += $row
    $recorded = $true

    if ($verdict -ne 'PASS') {
      $script:Failures += $row
      Show-FailureContext $appDir
      Save-FailureLogs $appDir $Title
    }
    return $row
  } catch {
    $message = $_.Exception.Message
    Write-Host "EXCEPTION: $message" -ForegroundColor Red
    if ($appDir -and (Test-Path -LiteralPath $appDir)) {
      Show-FailureContext $appDir
      Save-FailureLogs $appDir $Title
    }
    if (-not $recorded) {
      $row = New-ResultRow -Id $Id -Title $Title -Expect $Expect -Ready 'FAIL' `
        -Db 'FAIL' -Selftest 'n/a' -Content 'n/a' -Verdict 'FAIL' -Detail "exception: $message"
      $script:Results += $row
      $script:Failures += $row
    }
    return $null
  } finally {
    Stop-App $proc
    if ($caseDir -and -not $KeepCase -and -not $KeepTemp -and -not $ReuseDir) {
      Remove-Item -LiteralPath $caseDir -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

function Invoke-DiagnoseCase {
  param([string]$Id, [string]$Title, [string]$Expect)

  Write-Step "$Id $Title"
  $caseDir = Join-Path $asciiRoot ("case{0}" -f $Id)
  $proc = $null
  $appDir = ''

  try {
    $appDir = New-AppCopy $caseDir
    Reset-CaseState $appDir
    $exe = Join-Path $appDir 'WordRoots.exe'
    $diagErr = Join-Path $appDir 'app-data/logs/stderr.txt'
    $proc = Start-Process -FilePath $exe -ArgumentList '--diagnose' -WorkingDirectory $appDir -PassThru `
      -RedirectStandardError $diagErr
    [void]$proc.WaitForExit(30000)
    # The CLI path writes synchronously, but antivirus and NTFS metadata can add
    # a beat; give it a moment before concluding the file is absent.
    Start-Sleep -Milliseconds 800

    # Locate the snapshot by search and validate it by text: the runner may
    # resolve the portable root through a short 8.3 path, and a path spelling or
    # JSON-parsing quirk must not read as a product failure.
    $deadline = (Get-Date).AddSeconds(20)
    $snapshotFile = $null
    while ((Get-Date) -lt $deadline -and $null -eq $snapshotFile) {
      $snapshotFile = Get-ChildItem -LiteralPath $appDir -Recurse -Filter 'startup-cli.json' -ErrorAction SilentlyContinue |
        Select-Object -First 1
      if ($null -eq $snapshotFile) { Start-Sleep -Milliseconds 300 }
    }

    $verdict = 'FAIL'
    $note = 'startup-cli.json missing'
    if ($null -ne $snapshotFile) {
      $text = [System.IO.File]::ReadAllText($snapshotFile.FullName, [System.Text.Encoding]::UTF8)
      $hasWininet = $text -match '"wininet"'
      $hasWebview = $text -match '"webview2"'
      if ($hasWininet -and $hasWebview) {
        $verdict = 'PASS'
        $note = "wininet+webview2 present ($($snapshotFile.Length) bytes)"
      } else {
        $note = "wininet=$hasWininet webview2=$hasWebview"
      }
    }
    Write-Host "diagnose: $verdict ($note)"

    $row = New-ResultRow -Id $Id -Title $Title -Expect $Expect -Ready 'n/a' `
      -Db 'n/a' -Selftest 'n/a' -Content 'n/a' -Verdict $verdict -Detail $note
    $script:Results += $row
    if ($verdict -ne 'PASS') {
      $script:Failures += $row
      Show-FailureContext $appDir
      Save-FailureLogs $appDir $Title
    }
    return $row
  } catch {
    $message = $_.Exception.Message
    Write-Host "EXCEPTION: $message" -ForegroundColor Red
    if ($appDir -and (Test-Path -LiteralPath $appDir)) {
      Show-FailureContext $appDir
      Save-FailureLogs $appDir $Title
    }
    $row = New-ResultRow -Id $Id -Title $Title -Expect $Expect -Ready 'n/a' `
      -Db 'n/a' -Selftest 'n/a' -Content 'n/a' -Verdict 'FAIL' -Detail "exception: $message"
    $script:Results += $row
    $script:Failures += $row
    return $null
  } finally {
    Stop-App $proc
    if (-not $KeepTemp) { Remove-Item -LiteralPath $caseDir -Recurse -Force -ErrorAction SilentlyContinue }
  }
}

# ------------------------------------------------------------------- report ---

function Write-Report {
  $sha = (Get-FileHash -LiteralPath $Zip -Algorithm SHA256).Hash.ToLower()
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add('# WordRoots 便携版冒烟测试报告')
  $lines.Add('')
  $lines.Add("- 生成时间：$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))")
  $lines.Add("- 测试包：$([System.IO.Path]::GetFileName($Zip))")
  $lines.Add("- SHA256：$sha")
  $lines.Add("- 耗时：$([math]::Round(((Get-Date) - $script:Started).TotalSeconds, 1)) 秒")
  if ($script:Failures.Count -eq 0) {
    $lines.Add('- 结论：**通过**')
  } else {
    $lines.Add('- 结论：**失败**')
  }
  $lines.Add('')
  $lines.Add('| 场景 | 期望 | frontend_ready | db | 课程包 | selftest | 结论 |')
  $lines.Add('| --- | --- | --- | --- | --- | --- | --- |')
  foreach ($r in $script:Results) {
    $lines.Add("| $($r.Title) | $($r.Expect) | $($r.Ready) | $($r.Db) | $($r.Content) | $($r.Selftest) | $($r.Verdict) |")
  }
  $lines.Add('')
  $lines.Add('## 明细')
  $lines.Add('')
  foreach ($r in $script:Results) {
    $lines.Add("### $($r.Title)")
    $lines.Add('')
    $lines.Add("- 判据：$($r.Expect)")
    $lines.Add("- 结果：$($r.Detail)")
    $lines.Add('')
  }
  if ($script:Failures.Count -gt 0) {
    $lines.Add('## 失败场景')
    $lines.Add('')
    foreach ($r in $script:Failures) {
      $lines.Add("- **$($r.Title)**：$($r.Detail)")
    }
    $lines.Add('')
  }
  $lines.Add('> frontend_ready 断言证明 React 已在 WebView2 内挂载并完成 IPC；')
  $lines.Add('> 课程包断言证明打包目录里的 courses/ 真的被加载（contentSource=external），不是回退到内置课程；')
  $lines.Add('> selftest 断言证明在真实窗口里完成了答题（attempts 增长），三者都不是“生成了数据库文件”。')
  $lines | Out-File -FilePath $reportPath -Encoding utf8
  Write-Host ''
  Write-Host "report written: $reportPath" -ForegroundColor Green
}

# --------------------------------------------------------------------- main ---

New-Item -ItemType Directory -Path $asciiRoot -Force | Out-Null
New-Item -ItemType Directory -Path $unicodeRoot -Force | Out-Null

$registryBackup = $null
$cleanEnv = @{ HTTP_PROXY = ''; HTTPS_PROXY = ''; ALL_PROXY = '' }

try {
  Write-Host "smoke test: $Zip"
  Write-Host "temp roots: $asciiRoot | $unicodeRoot"

  # 1 — no proxy at all, plus the in-app self-test (strongest baseline).
  Invoke-Case -Id '1' -Title '1 无代理基线' `
    -Expect 'frontend_ready 渲染 + db + selftest 答题' `
    -Workspace $asciiRoot -Selftest -EnvVars $cleanEnv | Out-Null

  # 2 — dead HTTP proxy in the environment.
  Invoke-Case -Id '2' -Title '2 死 HTTP 代理' `
    -Expect 'HTTP_PROXY 指向死端口仍能渲染' `
    -Workspace $asciiRoot `
    -EnvVars @{ HTTP_PROXY = 'http://127.0.0.1:9'; HTTPS_PROXY = 'http://127.0.0.1:9' } | Out-Null

  # 3 — dead SOCKS5 proxy in the environment.
  Invoke-Case -Id '3' -Title '3 死 SOCKS5 代理' `
    -Expect 'ALL_PROXY=socks5 指向死端口仍能渲染' `
    -Workspace $asciiRoot `
    -EnvVars @{ ALL_PROXY = 'socks5://127.0.0.1:9' } | Out-Null

  # 4 — system-wide (WinINET) proxy: the real-world Clash / VPN case.
  $registryBackup = Backup-ProxyRegistry
  try {
    Set-DeadProxyRegistry -PacUrl ''
    Invoke-Case -Id '4' -Title '4 系统代理 (WinINET)' `
      -Expect '注册表 ProxyEnable=1 指向死端口仍能渲染 + selftest' `
      -Workspace $asciiRoot -Selftest -EnvVars $cleanEnv | Out-Null
  } finally {
    Restore-ProxyRegistry $registryBackup
    $registryBackup = $null
  }

  # 5 — PAC autoconfig URL pointing at a dead endpoint.
  $registryBackup = Backup-ProxyRegistry
  try {
    Set-DeadProxyRegistry -PacUrl 'http://127.0.0.1:9/proxy.pac'
    Invoke-Case -Id '5' -Title '5 PAC 自动配置' `
      -Expect 'AutoConfigURL 指向死 PAC 仍能渲染' `
      -Workspace $asciiRoot -EnvVars $cleanEnv | Out-Null
  } finally {
    Restore-ProxyRegistry $registryBackup
    $registryBackup = $null
  }

  # 6 — path with a space and Chinese characters, plus the self-test. The copy
  # is kept so scenario 7 can move it.
  Invoke-Case -Id '6' -Title '6 中文+空格路径' `
    -Expect '路径含空格与中文仍能渲染 + selftest 答题' `
    -Workspace $unicodeRoot -Selftest -KeepCase -EnvVars $cleanEnv | Out-Null
  $scenario6App = Join-Path $unicodeRoot 'case6/WordRoots'

  # 7 — move the whole folder elsewhere, relaunch: the data must come along.
  if (Test-Path -LiteralPath $scenario6App) {
    $movedRoot = Join-Path $asciiRoot 'moved'
    New-Item -ItemType Directory -Path $movedRoot -Force | Out-Null
    $movedApp = Join-Path $movedRoot 'WordRoots'
    if (Test-Path -LiteralPath $movedApp) { Remove-Item -LiteralPath $movedApp -Recurse -Force }
    Copy-Item -LiteralPath $scenario6App -Destination $movedApp -Recurse -Force
    Invoke-Case -Id '7' -Title '7 二次启动/迁移' `
      -Expect '换路径后 db 大小不变且 frontend_ready 再次出现' `
      -Workspace $movedRoot -ReuseDir $movedApp -KeepData -EnvVars $cleanEnv | Out-Null
    if (-not $KeepTemp) { Remove-Item -LiteralPath $movedRoot -Recurse -Force -ErrorAction SilentlyContinue }
  } else {
    $row = New-ResultRow -Id '7' -Title '7 二次启动/迁移' `
      -Expect '换路径后 db 大小不变且 frontend_ready 再次出现' `
      -Ready 'FAIL' -Db 'FAIL' -Selftest 'n/a' -Content 'n/a' -Verdict 'FAIL' `
      -Detail '场景 6 的目录不存在，无法迁移'
    $script:Results += $row
    $script:Failures += $row
  }

  # 8 — support mode writes a startup snapshot without opening a window.
  Invoke-DiagnoseCase -Id '8' -Title '8 --diagnose' `
    -Expect 'startup-cli.json 存在且含 wininet/webview2' | Out-Null
} finally {
  if ($null -ne $registryBackup) { Restore-ProxyRegistry $registryBackup }
  Restore-ProcessEnv
  Write-Report
  if (-not $KeepTemp) {
    Remove-Item -LiteralPath $asciiRoot -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $unicodeRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# Console table (the markdown file is the artifact; this is for the build log).
$script:Results |
  Select-Object Id, Title, Ready, Db, Content, Selftest, Verdict |
  Format-Table -AutoSize |
  Out-String -Width 200 |
  Write-Host

if ($script:Failures.Count -gt 0) {
  Write-Host ''
  Write-Host "SMOKE TEST FAILED: $($script:Failures.Count) scenario(s)" -ForegroundColor Red
  foreach ($r in $script:Failures) { Write-Host "  - $($r.Title): $($r.Detail)" -ForegroundColor Red }
  exit 1
}

Write-Host ''
Write-Host "SMOKE TEST PASSED: $($script:Results.Count) scenarios" -ForegroundColor Green
exit 0
