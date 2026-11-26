# Hàm dùng chung cho các script cài đặt / vận hành trên Windows Server
$ErrorActionPreference = 'Stop'
$AppDir = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$EnvFile = Join-Path $AppDir '.env'
$TaskApp = 'QLTK - Ung dung'
$TaskBackup = 'QLTK - Sao luu'

function Assert-Admin {
  $p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Hãy mở PowerShell bằng "Run as administrator" (chuột phải -> Run as administrator) rồi chạy lại.'
  }
}

# Chạy lệnh ngoài (npm, psql...) và dừng nếu lỗi
function Invoke-Step([string]$Title, [scriptblock]$Block) {
  Write-Host "    $Title" -ForegroundColor Gray
  & $Block
  if ($LASTEXITCODE) { throw "Lỗi khi: $Title (mã lỗi $LASTEXITCODE)" }
}

function Read-EnvFile {
  $h = @{}
  if (Test-Path $EnvFile) {
    foreach ($line in [IO.File]::ReadAllLines($EnvFile)) {
      if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') { $h[$Matches[1]] = $Matches[2].Trim('"') }
    }
  }
  return $h
}

# Ghi file UTF-8 không BOM (để Node đọc đúng tên biến đầu tiên)
function Write-Utf8File([string]$Path, [string]$Text) {
  [IO.File]::WriteAllText($Path, $Text, (New-Object Text.UTF8Encoding($false)))
}

function Find-PgBin {
  $exe = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\pg_dump.exe' -ErrorAction SilentlyContinue |
    Sort-Object { [int]($_.Directory.Parent.Name -replace '\D', '') } -Descending | Select-Object -First 1
  if (-not $exe) { throw 'Không tìm thấy PostgreSQL trong C:\Program Files\PostgreSQL. Hãy cài PostgreSQL trước (xem HUONG-DAN.md, Bước 2).' }
  return $exe.DirectoryName
}

# postgresql://user:pass@host:port/db?schema=public
function Get-DbParts([string]$Url) {
  if ($Url -notmatch '^postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+):(\d+)/([^?]+)') { throw 'DATABASE_URL trong .env không hợp lệ' }
  return @{ User = $Matches[1]; Password = [Uri]::UnescapeDataString($Matches[2]); Host = $Matches[3]; Port = $Matches[4]; Db = $Matches[5] }
}

function New-Secret([int]$Bytes) {
  $b = New-Object byte[] $Bytes
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return -join ($b | ForEach-Object { $_.ToString('x2') })
}

# Dừng app: dừng tác vụ + tắt tiến trình node đang chạy từ thư mục app
function Stop-App {
  Stop-ScheduledTask -TaskName $TaskApp -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine.Contains($AppDir) } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 2
}

function Wait-App([int]$Port) {
  for ($i = 0; $i -lt 60; $i++) {
    try {
      $r = Invoke-WebRequest -Uri "http://localhost:$Port/login" -UseBasicParsing -TimeoutSec 5
      if ($r.StatusCode -eq 200) { return $true }
    } catch { Start-Sleep -Seconds 2 }
  }
  return $false
}
