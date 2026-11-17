# Assembles the portable Windows distribution folder.
# Everything the app writes at runtime lives inside this folder, so the whole
# directory can be copied to another disk or machine as-is.
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

# Ship the course JSON next to the executable: it documents exactly which
# lessons this build contains and lets a user diff content between versions.
$weeks = Join-Path $root 'src/content/weeks'
if (Test-Path $weeks) {
  Copy-Item (Join-Path $weeks '*.json') (Join-Path $app 'courses/weeks') -Force
}
$lex = Join-Path $root 'src/content/lexicon'
if (Test-Path $lex) {
  Copy-Item (Join-Path $lex '*.json') (Join-Path $app 'courses/lexicon') -Force
}

$readme = @'
WordRoots - 英语构词学交互学习系统
==================================

启动方式
--------
双击 WordRoots.exe 即可。首次启动会自动在 data\ 目录建立学习数据库。

目录说明
--------
WordRoots.exe      主程序（前端资源已内置，无需联网）
data\              学习数据库 wordroots.db（请备份此文件）
courses\           本版本内置课程内容（JSON，仅供查看/比对）
app-data\cache\    缓存（含 WebView2 配置，可安全删除）
app-data\logs\     运行日志
backups\           自动备份与导出的学习数据

便携性
------
所有由本程序写入的数据都在本文件夹内。把整个 WordRoots 文件夹复制到
其他磁盘或电脑，学习记录会一起迁移。

升级
----
用新版 WordRoots.exe 覆盖旧文件即可，data\wordroots.db 会被保留并自动
迁移数据库结构；迁移前会自动在 backups\ 生成备份。

卸载
----
删除整个文件夹。程序不会在 C 盘写入自己的数据（WebView2 运行时由
Windows 自行安装与维护）。

课程与版权
----------
本软件为开源项目（MIT）。课程内容为基于公开语言学资料的原创中文讲解，
不包含任何受版权保护的教材原文。
'@
$readme | Out-File -Encoding utf8 (Join-Path $app 'README.txt')

# Fail loudly if anything the app needs at runtime is missing.
$required = @('WordRoots.exe', 'README.txt', 'data', 'courses', 'app-data', 'backups')
foreach ($item in $required) {
  if (-not (Test-Path (Join-Path $app $item))) { throw "portable layout missing: $item" }
}

$zip = Join-Path $outRoot 'WordRoots-Portable-Windows-x64.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path $app -DestinationPath $zip -CompressionLevel Optimal

$sizeMb = [math]::Round((Get-Item $zip).Length / 1MB, 2)
Write-Host "packaged: $zip ($sizeMb MB, version $($pkg.version))"

# Verify the archive really contains the executable at the expected depth.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
try {
  $names = $archive.Entries | ForEach-Object { $_.FullName }
  if (-not ($names -contains 'WordRoots/WordRoots.exe')) {
    throw 'ZIP does not contain WordRoots/WordRoots.exe'
  }
  if ($names | Where-Object { $_ -match '\.(epub|pdf)$' }) {
    throw 'ZIP contains copyrighted source material'
  }
  Write-Host "zip verified: $($names.Count) entries"
} finally {
  $archive.Dispose()
}
