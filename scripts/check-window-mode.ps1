# Reads the PE subsystem of a Windows executable and, optionally, watches for
# console windows while it runs.
#
# Two facts make this script necessary:
#   * a CONSOLE-subsystem exe (2 is GUI, 3 is console) gets a console window from
#     Windows itself, before any of our code runs — no API call can prevent it;
#   * `conhost.exe` being alive proves nothing, because a console is created for
#     every console-subsystem process whether or not a window is shown.
# So we check the header of the shipped binary, then sample *visible* windows.
param(
  [Parameter(Mandatory = $true)][string]$Exe,
  [int]$Seconds = 6,
  [switch]$Json,
  # Header-only mode for the build job: fail in seconds rather than after a
  # 20-minute package-and-smoke cycle when the binary is a console program.
  [switch]$SubsystemOnly
)

$ErrorActionPreference = 'Stop'

function Get-PeSubsystem([string]$Path) {
  $stream = [System.IO.File]::Open($Path, 'Open', 'Read', 'ReadWrite')
  try {
    $reader = New-Object System.IO.BinaryReader($stream)
    $stream.Position = 0x3C
    $peOffset = $reader.ReadInt32()
    # PE signature (4) + COFF header (20) + Subsystem at 0x44 of the optional header.
    $stream.Position = $peOffset + 4 + 20 + 68
    return [int]$reader.ReadUInt16()
  } finally {
    $stream.Dispose()
  }
}

if (-not ('Win32.ConsoleProbe' -as [type])) {
  Add-Type -Namespace Win32 -Name ConsoleProbe -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
[DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder lpClassName, int nMaxCount);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
'@
}

function Get-VisibleConsoleWindows {
  $found = New-Object System.Collections.Generic.List[object]
  $callback = [Win32.ConsoleProbe+EnumWindowsProc] {
    param($handle, $param)
    if ([Win32.ConsoleProbe]::IsWindowVisible($handle)) {
      $buffer = New-Object System.Text.StringBuilder 256
      [void][Win32.ConsoleProbe]::GetClassName($handle, $buffer, 256)
      $className = $buffer.ToString()
      # ConsoleWindowClass: conhost's window. PseudoConsoleWindow: ConPTY.
      # CASCADIA_HOSTING_WINDOW_CLASS: Windows Terminal.
      if ($className -eq 'ConsoleWindowClass' -or $className -eq 'PseudoConsoleWindow' -or $className -eq 'CASCADIA_HOSTING_WINDOW_CLASS') {
        $owner = 0
        [void][Win32.ConsoleProbe]::GetWindowThreadProcessId($handle, [ref]$owner)
        $found.Add([pscustomobject]@{ Handle = $handle; Class = $className; ProcessId = $owner })
      }
    }
    return $true
  }
  [void][Win32.ConsoleProbe]::EnumWindows($callback, [IntPtr]::Zero)
  return $found
}

# Which process opened this console? On modern Windows the console *window* is
# owned by conhost.exe, so the client is its parent. Walk up a few levels and ask
# whether our app is anywhere in that chain; anything else (a runner, a build
# step, another tool) is reported but not blamed.
function Resolve-ConsoleOwner {
  param([int]$ConsolePid, [int]$AppPid)

  $app = Get-Process -Id $AppPid -ErrorAction SilentlyContinue
  if ($null -eq $app) { return [pscustomobject]@{ ours = $false; chain = 'app already exited' } }

  $chain = New-Object System.Collections.Generic.List[string]
  $current = $ConsolePid
  $ours = $false
  for ($depth = 0; $depth -lt 6 -and $current -gt 0; $depth++) {
    $process = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId=$current" -ErrorAction SilentlyContinue
    if ($null -eq $process) { break }
    $chain.Add("$($process.Name)($current)")
    if ($current -eq $AppPid) { $ours = $true; break }
    $current = [int]$process.ParentProcessId
  }
  return [pscustomobject]@{ ours = $ours; chain = ($chain -join ' <- ') }
}

$subsystem = Get-PeSubsystem $Exe
$subsystemName = switch ($subsystem) {
  2 { 'WINDOWS_GUI' }
  3 { 'WINDOWS_CUI' }
  default { "unknown($subsystem)" }
}

if ($SubsystemOnly) {
  Write-Host "subsystem: $subsystem ($subsystemName)"
  if ($subsystem -eq 2) { exit 0 }
  Write-Host 'the shipped exe would open a console before any app code runs' -ForegroundColor Red
  exit 1
}

# Two launches: a first start and a restart. A console that only flashes on the
# second start (leftover handle, single-instance path) would otherwise be missed.
$appeared = @()
$rounds = @()
for ($round = 1; $round -le 2; $round++) {
  $before = @(Get-VisibleConsoleWindows)
  $beforeIds = @($before | ForEach-Object { $_.Handle })

  $proc = Start-Process -FilePath $Exe -WorkingDirectory (Split-Path -Parent $Exe) -PassThru
  $roundNew = 0
  try {
    $deadline = (Get-Date).AddSeconds($Seconds)
    # 100 ms: a console that opens and closes with a short-lived child is only a
    # flash on screen, and a 250 ms sample would step over it.
    while ((Get-Date) -lt $deadline) {
      foreach ($window in @(Get-VisibleConsoleWindows)) {
        if ($beforeIds -notcontains $window.Handle) {
          if (-not ($appeared | Where-Object { $_.Handle -eq $window.Handle })) {
            $window | Add-Member -NotePropertyName SeenAt -NotePropertyValue ((Get-Date).ToString('HH:mm:ss.fff'))
            $window | Add-Member -NotePropertyName Round -NotePropertyValue $round
            # Attribute before blaming: a CI runner starts console programs all
            # the time, and "a console appeared" is not "our app made one".
            $owner = Resolve-ConsoleOwner -ConsolePid $window.ProcessId -AppPid $proc.Id
            $window | Add-Member -NotePropertyName Owner -NotePropertyValue $owner
            $appeared += $window
            $roundNew++
          }
        }
      }
      Start-Sleep -Milliseconds 100
    }
  } finally {
    if ($null -ne $proc -and -not $proc.HasExited) {
      Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
      [void]$proc.WaitForExit(5000)
    }
  }
  $rounds += [pscustomobject]@{ round = $round; consoleWindows = $roundNew }
}

$result = [pscustomobject]@{
  exe = $Exe
  subsystem = $subsystem
  subsystemName = $subsystemName
  guiSubsystem = ($subsystem -eq 2)
  launches = $rounds
  consoleWindowsAppeared = @($appeared).Count
  oursAppeared = @($appeared | Where-Object { $_.Owner.ours }).Count
  consoleWindows = @($appeared | ForEach-Object {
    [pscustomobject]@{ class = $_.Class; pid = $_.ProcessId; round = $_.Round; seenAt = $_.SeenAt; ours = $_.Owner.ours; chain = $_.Owner.chain }
  })
}

if ($Json) {
  $result | ConvertTo-Json -Depth 5 -Compress
} else {
  Write-Host "subsystem: $subsystem ($subsystemName)"
  if ($result.consoleWindowsAppeared -eq 0) {
    Write-Host 'visible console windows during launch: none'
  } else {
    Write-Host "visible console windows during launch: $($result.consoleWindowsAppeared) (ours: $($result.oursAppeared))"
    foreach ($window in $result.consoleWindows) {
      $tag = 'other'
      if ($window.ours) { $tag = 'OURS' }
      Write-Host "  [$tag] class=$($window.class) round=$($window.round) at $($window.seenAt) chain=$($window.chain)"
    }
  }
  foreach ($round in $result.launches) {
    Write-Host "launch $($round.round): $($round.consoleWindows) console window(s)"
  }
}

# Only a console window that traces back to our own process tree fails the run;
# conhost.exe existing, or another tool opening a console, does not.
if (-not $result.guiSubsystem -or $result.oursAppeared -ne 0) { exit 1 }
exit 0
