# =====================================================================
#  CÀI APP "QUẢN LÝ TRÌNH KÝ HỒ SƠ" TRÊN WINDOWS SERVER (dùng trong mạng công ty)
#  Yêu cầu: đã cài Node.js 22 LTS và PostgreSQL (xem HUONG-DAN.md).
#  Chạy trong PowerShell "Run as administrator", tại thư mục code:
#     powershell -ExecutionPolicy Bypass -File deploy\windows\cai-dat.ps1
#  Tuỳ chọn: -Port 80 (địa chỉ gọn hơn, nếu máy không chạy IIS)  -DataDir D:\QLTK-DuLieu
# =====================================================================
param(
  [int]$Port = 3000,
  [string]$DataDir = 'C:\QLTK-DuLieu'
)
. "$PSScriptRoot\_chung.ps1"
Assert-Admin
Set-Location $AppDir

Write-Host '==> 1/6 Kiểm tra phần mềm nền' -ForegroundColor Cyan
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'Chưa cài Node.js. Tải bản LTS tại https://nodejs.org rồi chạy lại (mở cửa sổ PowerShell mới sau khi cài).' }
$nodeMajor = [int]((& $node -v).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 20) { throw "Node.js $(& $node -v) quá cũ, cần bản 20 trở lên (khuyên dùng 22 LTS)." }
$pgBin = Find-PgBin
Write-Host "    Node.js $(& $node -v), PostgreSQL: $pgBin"

Write-Host '==> 2/6 Tạo CSDL và cấu hình bí mật (.env)' -ForegroundColor Cyan
$adminPw = $null
if (Test-Path $EnvFile) {
  Write-Host '    Đã có .env - giữ nguyên cấu hình và CSDL hiện tại'
} else {
  $sec = Read-Host 'Nhập mật khẩu tài khoản "postgres" (đặt lúc cài PostgreSQL)' -AsSecureString
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
  $psql = Join-Path $pgBin 'psql.exe'
  $dbPw = New-Secret 24
  $hasRole = & $psql -h localhost -U postgres -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='qltk'"
  if ($LASTEXITCODE) { throw 'Không kết nối được PostgreSQL. Kiểm tra mật khẩu "postgres" và dịch vụ postgresql đang chạy.' }
  if ($hasRole -match '1') {
    Invoke-Step 'Đặt lại mật khẩu tài khoản CSDL qltk' { & $psql -h localhost -U postgres -d postgres -qc "ALTER ROLE qltk WITH LOGIN PASSWORD '$dbPw'" }
  } else {
    Invoke-Step 'Tạo tài khoản CSDL qltk' { & $psql -h localhost -U postgres -d postgres -qc "CREATE ROLE qltk LOGIN PASSWORD '$dbPw'" }
  }
  $hasDb = & $psql -h localhost -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='qltk'"
  if ($hasDb -notmatch '1') {
    Invoke-Step 'Tạo CSDL qltk' { & $psql -h localhost -U postgres -d postgres -qc "CREATE DATABASE qltk OWNER qltk ENCODING 'UTF8' TEMPLATE template0" }
  }
  Remove-Item Env:PGPASSWORD

  $adminPw = (New-Secret 6) + 'Qa1'
  New-Item -ItemType Directory -Force (Join-Path $DataDir 'uploads'), (Join-Path $DataDir 'backups') | Out-Null
  $dataFwd = $DataDir -replace '\\', '/'  # dùng dấu / để .env không hiểu nhầm \n, \u...
  Write-Utf8File $EnvFile @"
# Cấu hình app trên máy chủ (KHÔNG chia sẻ file này)
DATABASE_URL="postgresql://qltk:$dbPw@localhost:5432/qltk?schema=public"
AUTH_SECRET="$(New-Secret 32)"
UPLOAD_DIR="$dataFwd/uploads"
BACKUP_DIR="$dataFwd/backups"
MAX_UPLOAD_MB=25
# Chỉ dùng trong mạng nội bộ qua http (không có HTTPS)
COOKIE_SECURE=false
# Thư mục chép thêm bản sao lưu (ổ khác / NAS), để trống nếu không dùng. Ví dụ: \\NAS\SaoLuu\QLTK
BACKUP_COPY_TO=
"@
  Write-Host "    Đã tạo .env, dữ liệu file lưu tại $DataDir"
}

Write-Host '==> 3/6 Cài thư viện, cập nhật CSDL, build app (5-10 phút)' -ForegroundColor Cyan
Stop-App
Invoke-Step 'npm ci' { npm.cmd ci --no-audit --no-fund }
Invoke-Step 'prisma generate' { npx.cmd prisma generate }
Invoke-Step 'prisma migrate deploy' { npx.cmd prisma migrate deploy }
if ($adminPw) { $env:SEED_ADMIN_PASSWORD = $adminPw }
Invoke-Step 'Danh mục nền + tài khoản admin' { npm.cmd run db:seed }
Remove-Item Env:SEED_ADMIN_PASSWORD -ErrorAction SilentlyContinue
Invoke-Step 'npm run build' { npm.cmd run build }

Write-Host "==> 4/6 Mở cổng $Port trên tường lửa Windows" -ForegroundColor Cyan
Get-NetFirewallRule -DisplayName 'QLTK - Web' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName 'QLTK - Web' -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any | Out-Null

Write-Host '==> 5/6 Tự chạy app khi máy khởi động + sao lưu 2 giờ sáng' -ForegroundColor Cyan
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
$appAction = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"`"$PSScriptRoot\chay-app.cmd`" $Port `"$node`"`"" -WorkingDirectory $AppDir
Register-ScheduledTask -TaskName $TaskApp -Action $appAction -Trigger (New-ScheduledTaskTrigger -AtStartup) -Settings $settings -User 'NT AUTHORITY\SYSTEM' -RunLevel Highest -Force | Out-Null
$bkAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\sao-luu.ps1`"" -WorkingDirectory $AppDir
Register-ScheduledTask -TaskName $TaskBackup -Action $bkAction -Trigger (New-ScheduledTaskTrigger -Daily -At '02:00') -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable) -User 'NT AUTHORITY\SYSTEM' -RunLevel Highest -Force | Out-Null

Write-Host '==> 6/6 Khởi động app' -ForegroundColor Cyan
Start-ScheduledTask -TaskName $TaskApp
if (-not (Wait-App $Port)) { throw "App chưa chạy được. Xem nhật ký: $AppDir\logs\app.log" }

$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -ExpandProperty IPAddress
$suffix = if ($Port -eq 80) { '' } else { ":$Port" }
Write-Host ''
Write-Host '=====================================================================' -ForegroundColor Green
Write-Host ' XONG! Trên các máy trong mạng công ty, mở trình duyệt vào:' -ForegroundColor Green
foreach ($ip in $ips) { Write-Host "     http://$ip$suffix" -ForegroundColor Green }
if ($adminPw) {
  Write-Host ''
  Write-Host " Đăng nhập: admin    Mật khẩu: $adminPw" -ForegroundColor Yellow
  Write-Host ' -> Ghi lại mật khẩu này, đăng nhập xong hãy đổi ngay.' -ForegroundColor Yellow
}
Write-Host ''
Write-Host " Sao lưu tự động: $((Read-EnvFile)['BACKUP_DIR']) (2 giờ sáng, giữ 14 ngày)"
Write-Host ' Cập nhật bản mới:  powershell -ExecutionPolicy Bypass -File deploy\windows\cap-nhat.ps1'
Write-Host '=====================================================================' -ForegroundColor Green
