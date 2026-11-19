# Parses every PowerShell script in the repo and fails on syntax errors.
#
# A single unbalanced here-string (`@"` opened, `'@` closed) took down the whole
# portable build on 0.5.0: the script never ran, so no ZIP existed and the smoke
# test was skipped — the log only said "exit code 1". Parsing is free; running
# the packager on Windows is not. This gate runs on Linux CI in a second.
[CmdletBinding()]
param([string]$Root = '')

$ErrorActionPreference = 'Stop'
if (-not $Root) { $Root = Split-Path -Parent $PSScriptRoot }

$files = Get-ChildItem -Path (Join-Path $Root 'scripts') -Filter '*.ps1' -File
$failed = 0

foreach ($file in $files) {
  $errors = $null
  $null = [System.Management.Automation.Language.Parser]::ParseFile(
    $file.FullName,
    [ref]$null,
    [ref]$errors
  )
  if ($errors -and $errors.Count -gt 0) {
    $failed += 1
    foreach ($e in $errors) {
      $line = $e.Extent.StartLineNumber
      Write-Host "::error file=scripts/$($file.Name),line=$line::$($e.Message)"
    }
    Write-Host "FAIL $($file.Name): $($errors.Count) syntax error(s)"
  } else {
    Write-Host "ok   $($file.Name)"
  }
}

if ($failed -gt 0) {
  Write-Host "$failed script(s) failed to parse"
  exit 1
}

Write-Host "all $($files.Count) script(s) parse"
exit 0
