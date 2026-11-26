# Sao lưu CSDL + file đính kèm, giữ 14 ngày. Tự chạy 2 giờ sáng (tác vụ "QLTK - Sao luu").
# Chạy tay:  powershell -ExecutionPolicy Bypass -File deploy\windows\sao-luu.ps1
param([int]$KeepDays = 14)
. "$PSScriptRoot\_chung.ps1"

$cfg = Read-EnvFile
$dest = if ($cfg['BACKUP_DIR']) { $cfg['BACKUP_DIR'] -replace '/', '\' } else { Join-Path $AppDir 'storage\backups' }
New-Item -ItemType Directory -Force $dest | Out-Null
$ts = Get-Date -Format 'yyyy-MM-dd_HHmm'
$db = Get-DbParts $cfg['DATABASE_URL']
$pgBin = Find-PgBin

$dump = Join-Path $dest "db-$ts.dump"
$env:PGPASSWORD = $db.Password
& (Join-Path $pgBin 'pg_dump.exe') -h $db.Host -p $db.Port -U $db.User -Fc -f $dump $db.Db
$code = $LASTEXITCODE
Remove-Item Env:PGPASSWORD
if ($code) { throw "pg_dump lỗi (mã $code)" }
$files = @($dump)

$up = if ($cfg['UPLOAD_DIR']) { $cfg['UPLOAD_DIR'] -replace '/', '\' } else { Join-Path $AppDir 'storage\uploads' }
if ((Test-Path $up) -and (Get-ChildItem $up -Recurse -File | Select-Object -First 1)) {
  $zip = Join-Path $dest "uploads-$ts.zip"
  Compress-Archive -Path (Join-Path $up '*') -DestinationPath $zip -Force
  $files += $zip
}

# Chép thêm ra ổ khác / NAS nếu có cấu hình BACKUP_COPY_TO trong .env
if ($cfg['BACKUP_COPY_TO']) {
  New-Item -ItemType Directory -Force $cfg['BACKUP_COPY_TO'] | Out-Null
  Copy-Item $files -Destination $cfg['BACKUP_COPY_TO'] -Force
}

$limit = (Get-Date).AddDays(-$KeepDays)
Get-ChildItem $dest -File | Where-Object { $_.Name -match '^(db|uploads)-' -and $_.LastWriteTime -lt $limit } | Remove-Item -Force
$line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') Đã sao lưu: $($files -join ', ')"
Add-Content -Path (Join-Path $dest 'sao-luu.log') -Value $line -Encoding UTF8
Write-Host $line
