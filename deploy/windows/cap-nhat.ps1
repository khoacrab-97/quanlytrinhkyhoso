# Cập nhật app lên bản mới nhất trên GitHub (tự sao lưu trước). Thay đổi CSDL được áp dụng tự động.
# Chạy trong PowerShell "Run as administrator":
#   powershell -ExecutionPolicy Bypass -File deploy\windows\cap-nhat.ps1
. "$PSScriptRoot\_chung.ps1"
Assert-Admin
Set-Location $AppDir

Write-Host '==> Sao lưu trước khi cập nhật' -ForegroundColor Cyan
& "$PSScriptRoot\sao-luu.ps1"

Write-Host '==> Lấy code mới' -ForegroundColor Cyan
Invoke-Step 'git pull' { git pull --ff-only }

Write-Host '==> Dừng app, cài thư viện, cập nhật CSDL, build' -ForegroundColor Cyan
Stop-App
Invoke-Step 'npm ci' { npm.cmd ci --no-audit --no-fund }
Invoke-Step 'prisma generate' { npx.cmd prisma generate }
Invoke-Step 'prisma migrate deploy' { npx.cmd prisma migrate deploy }
Invoke-Step 'Danh mục nền' { npm.cmd run db:seed }
Invoke-Step 'npm run build' { npm.cmd run build }

Write-Host '==> Khởi động lại app' -ForegroundColor Cyan
Start-ScheduledTask -TaskName $TaskApp
$port = ((Get-ScheduledTask -TaskName $TaskApp).Actions[0].Arguments -replace '^.*chay-app\.cmd"\s+(\d+).*$', '$1')
if (Wait-App ([int]$port)) { Write-Host 'Đã cập nhật xong.' -ForegroundColor Green }
else { throw "App chưa chạy lại được. Xem nhật ký: $AppDir\logs\app.log" }
