# Assembles the portable Windows distribution folder.
# Everything the app writes at runtime lives inside this folder, so the whole
# directory can be copied to another disk or machine as-is.
#
# Fails loudly if the course content or the lexicon is not complete: an earlier
# version shipped an empty courses/weeks because the copy pattern did not recurse
# into weekNN/ subdirectories. That is now asserted, not assumed.
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root 'src-tauri/target/release/wordroots.exe'
if (-not (Test-Path $exe)) { throw "release binary not found: $exe" }

$pkg = Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$outRoot = Join-Path $root 'dist-portable'
$app = Join-Path $outRoot 'WordRoots'

if (Test-Path $app) { Remove-Item $app -Recurse -Force }
New-Item -ItemType Directory -Path $app | Out-Null

Copy-Item $exe (Join-Path $app 'WordRoots.exe')

foreach ($dir in @('data', 'app-data/cache', 'app-data/config', 'app-data/logs', 'backups', 'courses/weeks', 'courses/lexicon')) {
  New-Item -ItemType Directory -Path (Join-Path $app $dir) -Force | Out-Null
}

# --- course content: weeks live in weekNN/ subdirectories, so recurse ---------
$weeks = Join-Path $root 'src/content/weeks'
if (-not (Test-Path $weeks)) { throw "course source missing: $weeks" }
Copy-Item (Join-Path $weeks '*') (Join-Path $app 'courses/weeks') -Recurse -Force

$dayFiles = Get-ChildItem (Join-Path $app 'courses/weeks') -Recurse -Filter 'day*.json'
$weekDirs = Get-ChildItem (Join-Path $app 'courses/weeks') -Directory
if ($weekDirs.Count -lt 12) { throw "portable build has $($weekDirs.Count) week folders, expected at least 12" }
if ($dayFiles.Count -lt 84) { throw "portable build has $($dayFiles.Count) day files, expected at least 84" }
# A week is 5-7 lessons: the original 12 weeks use 7, and the textbook units added
# in 0.4.0 (C9/C11) split a chapter over two 6-day weeks. Anything shorter than 5
# means a copy or authoring mistake, not a curriculum choice.
foreach ($w in $weekDirs) {
  $days = Get-ChildItem $w.FullName -Filter 'day*.json'
  if ($days.Count -lt 5 -or $days.Count -gt 7) {
    throw "week $($w.Name) has $($days.Count) day files, expected 5-7"
  }
}

$lex = Join-Path $root 'src/content/lexicon'
if (-not (Test-Path $lex)) { throw "lexicon source missing: $lex" }
Copy-Item (Join-Path $lex '*.json') (Join-Path $app 'courses/lexicon') -Force
# forms.json is the spelling -> identity index; without it the app cannot tell
# two homographs apart, so shipping it is not optional.
foreach ($f in @('concepts.json', 'forms.json', 'morphemes.json', 'words.json')) {
  $p = Join-Path $app "courses/lexicon/$f"
  if (-not (Test-Path $p)) { throw "lexicon file missing from package: $f" }
  $null = Get-Content $p -Raw | ConvertFrom-Json   # must parse
}

# --- manifest: lets the app decide whether this folder's content is usable ----
$hash = Get-ChildItem (Join-Path $app 'courses') -Recurse -File |
  Sort-Object FullName |
  Get-FileHash -Algorithm SHA256
$contentHash = [System.BitConverter]::ToString(
  [System.Security.Cryptography.SHA256]::Create().ComputeHash(
    [System.Text.Encoding]::UTF8.GetBytes(($hash.Hash -join '|'))
  )
).Replace('-', '').ToLower()
$contentHash = $contentHash.Substring(0, 16)

$manifest = [ordered]@{
  appVersion     = $pkg.version
  contentVersion = "$($pkg.version)+$contentHash"
  schemaVersion  = 1          # course JSON schema, see docs/CONTENT_SCHEMA.md
  weekCount      = $weekDirs.Count
  dayCount       = $dayFiles.Count
  generatedAt    = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  gitCommit      = $env:GITHUB_SHA
}
$manifest | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 (Join-Path $app 'courses/manifest.json')

$buildInfo = [ordered]@{
  app            = 'WordRoots'
  version        = $pkg.version
  gitCommit      = $env:GITHUB_SHA
  contentVersion = $manifest.contentVersion
  builtAt        = $manifest.generatedAt
  days           = $dayFiles.Count
}
$buildInfo | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 (Join-Path $app 'BUILD-INFO.json')

$readme = @'
WordRoots - 英语构词学交互学习系统
==================================

启动方式
--------
双击 WordRoots.exe 即可。首次启动会自动在 data\ 目录建立学习数据库。
不需要联网，也不需要关闭 VPN / 代理：程序内的浏览器控件被强制直连，
不读取系统代理设置。

目录说明
--------
WordRoots.exe      主程序（前端资源已内置，无需联网）
data\              学习数据库 wordroots.db（请备份此文件）
courses\           本版本内置课程内容（84 天，JSON，仅供查看/比对）
  manifest.json    内容版本；程序只在版本匹配时使用外部课程
app-data\logs\     运行日志（启动异常时请提供此目录）
app-data\cache\    缓存（含 WebView2 配置，可安全删除）
backups\           自动备份与导出的学习数据
BUILD-INFO.json    构建信息（版本、提交、内容哈希）

便携性
------
所有由本程序写入的数据都在本文件夹内。把整个 WordRoots 文件夹复制到
其他磁盘或电脑，学习记录会一起迁移。

升级
----
用新版 WordRoots.exe 覆盖旧文件即可，data\wordroots.db 会被保留并自动
迁移数据库结构；迁移前会自动在 backups\ 生成备份。

启动异常排查
------------
1. 程序目录 app-data\logs\wordroots.log 最后几行；
2. app-data\logs\startup-failed.json（代理与 WebView2 环境快照）；
3. 命令行运行 WordRoots.exe --diagnose，会在同一目录生成诊断文件。

卸载
----
删除整个文件夹。程序不会在 C 盘写入自己的学习数据（WebView2 运行时由
Windows 自行安装与维护）。

课程与版权
----------
本软件为开源项目（MIT）。课程内容为基于公开语言学资料的原创中文讲解，
不包含任何受版权保护的教材原文。
'@
$readme | Out-File -Encoding utf8 (Join-Path $app 'README.txt')

# Fail loudly if anything the app needs at runtime is missing.
$required = @('WordRoots.exe', 'README.txt', 'BUILD-INFO.json', 'data', 'courses', 'courses/manifest.json', 'app-data', 'backups')
foreach ($item in $required) {
  if (-not (Test-Path (Join-Path $app $item))) { throw "portable layout missing: $item" }
}

$zip = Join-Path $outRoot 'WordRoots-Portable-Windows-x64.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path $app -DestinationPath $zip -CompressionLevel Optimal

$sizeMb = [math]::Round((Get-Item $zip).Length / 1MB, 2)
Write-Host "packaged: $zip ($sizeMb MB, version $($pkg.version), $($dayFiles.Count) days)"

# Verify the archive really contains the executable and every lesson.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
try {
  $names = $archive.Entries | ForEach-Object { $_.FullName }
  if (-not ($names -contains 'WordRoots/WordRoots.exe')) {
    throw 'ZIP does not contain WordRoots/WordRoots.exe'
  }
  $zipDays = @($names | Where-Object { $_ -match 'WordRoots/courses/weeks/week\d+/day\d+\.json$' })
  if ($zipDays.Count -lt 84) { throw "ZIP contains $($zipDays.Count) lesson files, expected 84" }
  if ($names | Where-Object { $_ -match '\.(epub|pdf)$' }) {
    throw 'ZIP contains copyrighted source material'
  }
  Write-Host "zip verified: $($names.Count) entries, $($zipDays.Count) lessons"
} finally {
  $archive.Dispose()
}
