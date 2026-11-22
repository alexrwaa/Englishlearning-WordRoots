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

# -Encoding UTF8 matters on Windows PowerShell 5.1: without it the Chinese theme
# text inside course-index.json is read as ANSI and ConvertFrom-Json throws.
$pkg = Get-Content (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$outRoot = Join-Path $root 'dist-portable'
$app = Join-Path $outRoot 'WordRoots'

if (Test-Path $app) { Remove-Item $app -Recurse -Force }
New-Item -ItemType Directory -Path $app | Out-Null

Copy-Item $exe (Join-Path $app 'WordRoots.exe')

foreach ($dir in @('data', 'app-data/cache', 'app-data/config', 'app-data/logs', 'backups', 'courses/weeks', 'courses/lexicon', 'courses/families', 'courses/assessment', 'courses/textbook')) {
  New-Item -ItemType Directory -Path (Join-Path $app $dir) -Force | Out-Null
}

# --- course content: weeks live in weekNN/ subdirectories, so recurse ---------
# The committed index is the contract: it is generated from src/content/weeks and
# lists every week and every lesson id. Packaging refuses to run when the index is
# stale, which catches "added a lesson, forgot to regenerate" before it ships.
Push-Location $root
try {
  & node scripts/build-course-index.mjs --check
  if ($LASTEXITCODE -ne 0) { throw 'course index is stale or the course content is inconsistent' }
} finally { Pop-Location }

$weeks = Join-Path $root 'src/content/weeks'
if (-not (Test-Path $weeks)) { throw "course source missing: $weeks" }
Copy-Item (Join-Path $weeks '*') (Join-Path $app 'courses/weeks') -Recurse -Force

$lex = Join-Path $root 'src/content/lexicon'
if (-not (Test-Path $lex)) { throw "lexicon source missing: $lex" }
Copy-Item (Join-Path $lex '*.json') (Join-Path $app 'courses/lexicon') -Force

# Family dossiers and the assessment item bank are compiled into the app bundle,
# so they already work offline. They are also copied here so an inspector can
# read the shipped text without unpacking the JS — the same reason courses/weeks
# is present even though the runtime reads the bundle.
foreach ($extra in @(@{ from = 'src/content/families'; to = 'courses/families' },
                     @{ from = 'src/content/assessment'; to = 'courses/assessment' },
                     # Evidence records + source registry: a reader holding only the
                     # zip should be able to check a citation without a clone.
                     @{ from = 'src/content/textbook'; to = 'courses/textbook' })) {
  $srcDir = Join-Path $root $extra.from
  if (Test-Path $srcDir) {
    $destDir = Join-Path $app $extra.to
    # The destination must exist first: copying onto a non-existent path makes
    # Copy-Item treat the folder name as a file name and fail.
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    Copy-Item (Join-Path $srcDir '*.json') $destDir -Force
  }
}

# --- manifest: lets the app decide whether this folder's content is usable ----
$dayFiles = Get-ChildItem (Join-Path $app 'courses/weeks') -Recurse -Filter 'day*.json'
$weekDirs = Get-ChildItem (Join-Path $app 'courses/weeks') -Directory
$index = Get-Content (Join-Path $root 'src/content/course-index.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($weekDirs.Count -ne $index.weekCount) {
  throw "packaged $($weekDirs.Count) week folders, index says $($index.weekCount)"
}
if ($dayFiles.Count -ne $index.lessonCount) {
  throw "packaged $($dayFiles.Count) lessons, index says $($index.lessonCount)"
}

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
# Out-File -Encoding utf8 emits a BOM on Windows PowerShell 5.1, and JSON.parse
# (and most JSON readers) reject a BOM. Write UTF-8 without one.
function Write-Utf8NoBom {
  param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][string]$Text)
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $encoding)
}

$manifest | ConvertTo-Json -Depth 5 | ForEach-Object { Write-Utf8NoBom -Path (Join-Path $app 'courses/manifest.json') -Text $_ }

$buildInfo = [ordered]@{
  app            = 'WordRoots'
  version        = $pkg.version
  gitCommit      = $env:GITHUB_SHA
  contentVersion = $manifest.contentVersion
  builtAt        = $manifest.generatedAt
  days           = $dayFiles.Count
}
$buildInfo | ConvertTo-Json -Depth 5 | ForEach-Object { Write-Utf8NoBom -Path (Join-Path $app 'BUILD-INFO.json') -Text $_ }

$readme = @"
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
courses\           本版本内置课程内容（$($dayFiles.Count) 天，JSON，仅供查看/比对）
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

courses 目录是只读副本，不是可热更新的内容包
--------------------------------------------
courses\ 下的课程、词库、词族档案与测评题库，是构建时打进 EXE 里那一份的
可读副本，供你核对版本、比对内容、检查哈希（见 courses\CONTENT-HASHES.json）。
直接修改这些 JSON 不会改变软件运行时的行为——程式读的是编译进包内的数据。
要改内容请改源码并重新构建。
"@
Write-Utf8NoBom -Path (Join-Path $app 'README.txt') -Text $readme

# Fail loudly if anything the app needs at runtime is missing.
$required = @('WordRoots.exe', 'README.txt', 'BUILD-INFO.json', 'data', 'courses', 'courses/manifest.json',
  'courses/lexicon/forms.json', 'courses/lexicon/morphemes.json', 'courses/lexicon/words.json',
  'courses/lexicon/concepts.json', 'courses/families', 'courses/assessment/items.json',
  'courses/textbook/sources.json', 'courses/textbook/reviews.json',
  'app-data', 'backups')
foreach ($item in $required) {
  if (-not (Test-Path (Join-Path $app $item))) { throw "portable layout missing: $item" }
}

# The dossier and item-bank copies are inspection artifacts: the app runs the
# versions compiled into its bundle. They are still required, because a release
# whose readable content is incomplete is a release nobody can audit.
# Counts, ids and schemas are checked here; hashes are written alongside so a
# reviewer can tell whether the copy they read is the one that shipped.
$familyFiles = @(Get-ChildItem -LiteralPath (Join-Path $app 'courses/families') -Filter '*.json' -File)
if ($familyFiles.Count -lt 12) { throw "courses/families has $($familyFiles.Count) dossiers, expected at least 12" }
$familyIds = @{}
foreach ($file in $familyFiles) {
  $dossier = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
  if (-not $dossier.id) { throw "family dossier without id: $($file.Name)" }
  if ($familyIds.ContainsKey($dossier.id)) { throw "duplicate family id: $($dossier.id)" }
  $familyIds[$dossier.id] = $true
  $members = @($dossier.members)
  if ($members.Count -lt 5) { throw "family $($dossier.id) has $($members.Count) members, expected >= 5" }
  if (-not $dossier.root -or -not $dossier.root.form) { throw "family $($dossier.id) has no root form" }
}

$bankPath = Join-Path $app 'courses/assessment/items.json'
$bank = Get-Content -LiteralPath $bankPath -Raw -Encoding UTF8 | ConvertFrom-Json
$items = @($bank.items)
if ($items.Count -lt 60) { throw "assessment bank has $($items.Count) items, expected at least 60" }
$itemIds = @{}
$dims = @{}
foreach ($item in $items) {
  if (-not $item.id) { throw 'assessment item without id' }
  if ($itemIds.ContainsKey($item.id)) { throw "duplicate assessment id: $($item.id)" }
  $itemIds[$item.id] = $true
  if ($null -eq $item.answer) { throw "assessment item $($item.id) has no answer key" }
  if (-not $item.explain) { throw "assessment item $($item.id) has no explain" }
  $dims[$item.dimension] = $true
}
if ($dims.Count -lt 5) { throw "assessment bank covers $($dims.Count) dimensions, expected 5" }

$hashes = [ordered]@{}
foreach ($file in @(Get-ChildItem -LiteralPath (Join-Path $app 'courses/families') -Filter '*.json' -File | Sort-Object Name)) {
  $hashes["families/$($file.Name)"] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLower()
}
$hashes['assessment/items.json'] = (Get-FileHash -LiteralPath $bankPath -Algorithm SHA256).Hash.ToLower()
foreach ($file in @(Get-ChildItem -LiteralPath (Join-Path $app 'courses/textbook') -Filter '*.json' -File | Sort-Object Name)) {
  $hashes["textbook/$($file.Name)"] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLower()
}

# Evidence records must survive packaging: a release whose citations cannot be
# followed is a release nobody can audit.
$reviewsPath = Join-Path $app 'courses/textbook/reviews.json'
$reviewDoc = Get-Content -LiteralPath $reviewsPath -Raw -Encoding UTF8 | ConvertFrom-Json
$reviewCount = @($reviewDoc.entries).Count
if ($reviewCount -lt 200) { throw "courses/textbook/reviews.json has $reviewCount entries, expected at least 200" }
$withClaims = @($reviewDoc.entries | Where-Object { $_.verification }).Count
if ($withClaims -lt 10) { throw "only $withClaims review entries carry verification records" }
$hashFile = [ordered]@{ generatedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'); files = $hashes }
Write-Utf8NoBom -Path (Join-Path $app 'courses/CONTENT-HASHES.json') -Text ($hashFile | ConvertTo-Json -Depth 4)
Write-Host "families: $($familyFiles.Count), assessment items: $($items.Count), dimensions: $($dims.Count)"

# Exact structural check against the index: week folders, lesson ids, lexicon
# integrity (every morpheme reachable from forms.json and vice versa).
Push-Location $root
try {
  & node scripts/build-course-index.mjs --root $app
  if ($LASTEXITCODE -ne 0) { throw 'packaged course tree does not match the index' }
} finally { Pop-Location }

$zip = Join-Path $outRoot 'WordRoots-Portable-Windows-x64.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path $app -DestinationPath $zip -CompressionLevel Optimal

$sizeMb = [math]::Round((Get-Item $zip).Length / 1MB, 2)
Write-Host "packaged: $zip ($sizeMb MB, version $($pkg.version), $($dayFiles.Count) days)"

# Verify the archive really contains the executable and every lesson.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
try {
  # Compress-Archive on Windows records backslashes; normalise so the entry list
  # can be compared against the forward-slash paths the index uses.
  $names = $archive.Entries | ForEach-Object { $_.FullName -replace '\\', '/' }
  if (-not ($names -contains 'WordRoots/WordRoots.exe')) {
    throw 'ZIP does not contain WordRoots/WordRoots.exe'
  }
  $zipDays = @($names | Where-Object { $_ -match 'WordRoots/courses/weeks/week\d+/day\d+\.json$' })
  if ($zipDays.Count -ne $index.lessonCount) {
    throw "ZIP contains $($zipDays.Count) lesson files, index says $($index.lessonCount)"
  }
  # Every lesson id from the index must exist by name, and no stray week may ride along.
  foreach ($week in $index.weeks) {
    foreach ($id in $week.days) {
      $weekNo = $week.week.ToString('00')
      $dayNo = $id.Substring($id.Length - 1)
      $entry = "WordRoots/courses/weeks/week$weekNo/day$dayNo.json"
      if (-not ($names -contains $entry)) { throw "ZIP missing lesson $entry" }
    }
  }
  $zipWeeks = @($names | ForEach-Object {
    if ($_ -match 'WordRoots/courses/weeks/(week\d+)/') { $Matches[1] }
  } | Sort-Object -Unique)
  if ($zipWeeks.Count -ne $index.weekCount) {
    throw "ZIP contains $($zipWeeks.Count) week folders, index says $($index.weekCount)"
  }
  foreach ($f in @('forms.json', 'morphemes.json', 'words.json', 'concepts.json')) {
    $entry = "WordRoots/courses/lexicon/$f"
    if (-not ($names -contains $entry)) { throw "ZIP missing $entry" }
  }
  if (-not ($names -contains 'WordRoots/courses/manifest.json')) {
    throw 'ZIP missing WordRoots/courses/manifest.json'
  }
  if ($names | Where-Object { $_ -match '\.(epub|pdf)$' }) {
    throw 'ZIP contains copyrighted source material'
  }
  Write-Host "zip verified: $($names.Count) entries, $($zipDays.Count) lessons"
} finally {
  $archive.Dispose()
}
