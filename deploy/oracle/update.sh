#!/usr/bin/env bash
# Cập nhật app lên bản mới nhất trên GitHub. Thay đổi CSDL (migration) được áp dụng tự động.
#   bash deploy/oracle/update.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
echo "==> Sao lưu trước khi cập nhật"
sudo bash deploy/oracle/backup.sh
echo "==> Lấy code mới"
git pull --ff-only
echo "==> Build và chạy lại"
sudo docker compose --profile prod --profile https up -d --build
sudo docker image prune -f >/dev/null
echo "Đã cập nhật xong."
