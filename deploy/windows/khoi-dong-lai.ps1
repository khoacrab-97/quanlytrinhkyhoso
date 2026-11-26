# Khởi động lại app (khi app treo hoặc sau khi sửa .env).
# Chạy trong PowerShell "Run as administrator":
#   powershell -ExecutionPolicy Bypass -File deploy\windows\khoi-dong-lai.ps1
. "$PSScriptRoot\_chung.ps1"
Assert-Admin
Stop-App
Start-ScheduledTask -TaskName $TaskApp
Write-Host 'Đã khởi động lại app. Chờ khoảng 10 giây rồi mở lại trình duyệt.' -ForegroundColor Green
