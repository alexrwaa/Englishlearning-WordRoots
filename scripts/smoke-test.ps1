# Launches the packaged app from a non-system path and verifies that it creates
# its database inside its own folder (portable storage proof).
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'dist-portable/WordRoots'
if (-not (Test-Path $source)) { throw 'run package-portable.ps1 first' }

# Path intentionally contains a space and Chinese characters to prove that
# neither breaks startup or data placement.
$target = Join-Path $env:TEMP ("WordRoots 便携测试 {0}" -f (Get-Random))
New-Item -ItemType Directory -Path $target -Force | Out-Null
Copy-Item (Join-Path $source '*') $target -Recurse -Force

$exe = Join-Path $target 'WordRoots.exe'
Write-Host "launching $exe"

$proc = Start-Process -FilePath $exe -PassThru -WindowStyle Minimized
Start-Sleep -Seconds 18

$db = Join-Path $target 'data/wordroots.db'
$log = Join-Path $target 'app-data/logs/wordroots.log'
$ok = $true

if (Test-Path $db) {
  Write-Host "PASS portable database created: $db ($((Get-Item $db).Length) bytes)"
} else {
  Write-Host "FAIL portable database missing"; $ok = $false
}

if (Test-Path $log) {
  Write-Host "PASS log written:"; Get-Content $log -Tail 10
} else {
  Write-Host "FAIL log missing"; $ok = $false
}

if (-not $proc.HasExited) { $proc.Kill(); $proc.WaitForExit(5000) }

# Restart on the copied folder: this is the "moved the folder" scenario.
$proc2 = Start-Process -FilePath $exe -PassThru -WindowStyle Minimized
Start-Sleep -Seconds 12
if (-not $proc2.HasExited) { $proc2.Kill(); $proc2.WaitForExit(5000) }
if (Test-Path $db) { Write-Host 'PASS database survives restart' } else { Write-Host 'FAIL restart lost database'; $ok = $false }

# Nothing may escape to AppData.
$escaped = Get-ChildItem "$env:LOCALAPPDATA\com.wordroots.learning" -ErrorAction SilentlyContinue
if ($escaped) { Write-Host "WARN WebView2/app data found in LOCALAPPDATA: $($escaped.FullName)" }

Remove-Item $target -Recurse -Force -ErrorAction SilentlyContinue
if (-not $ok) { throw 'smoke test failed' }
Write-Host 'smoke test complete'
