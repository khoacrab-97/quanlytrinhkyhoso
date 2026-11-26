#!/usr/bin/env bash
# =====================================================================
#  CÀI ĐẶT APP "QUẢN LÝ TRÌNH KÝ HỒ SƠ" TRÊN MÁY CHỦ ORACLE CLOUD FREE
#  Máy chủ: Ubuntu 22.04 / 24.04. Chạy 1 lần trong thư mục code:
#     bash deploy/oracle/setup.sh
#  Dùng tên miền riêng (đã trỏ về IP máy chủ):
#     DOMAIN=trinhky.tencongty.vn bash deploy/oracle/setup.sh
#  Không có tên miền: tự dùng <IP>.sslip.io (miễn phí, vẫn có HTTPS).
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")/../.."
APP_DIR="$(pwd)"
DC="sudo docker compose --profile prod --profile https"

echo "==> 1/6 Cài Docker"
if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y docker.io docker-compose-v2 cron openssl curl
  sudo systemctl enable --now docker
fi

echo "==> 2/6 Bộ nhớ swap (máy dưới 4 GB RAM cần để build)"
MEM_MB=$(free -m | awk '/Mem:/{print $2}')
if [ "$MEM_MB" -lt 4000 ] && [ ! -f /swapfile ]; then
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> 3/6 Mở cổng 80, 443 trên tường lửa của máy chủ"
for PORT in 80 443; do
  if ! sudo iptables -C INPUT -p tcp -m state --state NEW --dport "$PORT" -j ACCEPT 2>/dev/null; then
    sudo iptables -I INPUT 1 -p tcp -m state --state NEW --dport "$PORT" -j ACCEPT
  fi
done
if command -v netfilter-persistent >/dev/null 2>&1; then sudo netfilter-persistent save >/dev/null; fi

echo "==> 4/6 Tạo cấu hình bí mật (.env)"
if [ ! -f .env ]; then
  PUBLIC_IP=$(curl -fsS https://api.ipify.org || true)
  DOMAIN="${DOMAIN:-${PUBLIC_IP}.sslip.io}"
  # Mật khẩu admin ban đầu: chữ + số, 14 ký tự
  ADMIN_PW="${SEED_ADMIN_PASSWORD:-$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 12)a1}"
  cat > .env <<EOF
POSTGRES_PASSWORD=$(openssl rand -hex 24)
AUTH_SECRET=$(openssl rand -hex 32)
SEED_ADMIN_PASSWORD=$ADMIN_PW
DOMAIN=$DOMAIN
EOF
  chmod 600 .env
else
  echo "    Đã có .env - giữ nguyên"
fi
set -a; . ./.env; set +a

echo "==> 5/6 Build và chạy app (lần đầu mất khoảng 5-15 phút)"
$DC up -d --build

echo "==> 6/6 Sao lưu tự động lúc 2 giờ sáng hằng ngày"
chmod +x deploy/oracle/backup.sh deploy/oracle/update.sh
( sudo crontab -l 2>/dev/null | grep -v 'deploy/oracle/backup.sh' || true
  echo "0 2 * * * bash $APP_DIR/deploy/oracle/backup.sh >> /var/log/qltk-backup.log 2>&1" ) | sudo crontab -

cat <<EOF

=====================================================================
 XONG! Mở trình duyệt:  https://$DOMAIN
 (lần đầu có thể mất 1-2 phút để cấp chứng chỉ HTTPS)

 Đăng nhập:  admin
 Mật khẩu:   $SEED_ADMIN_PASSWORD
 -> Đăng nhập xong hãy đổi mật khẩu ngay. Mật khẩu này cũng nằm trong file .env

 Sao lưu:    /var/backups/qltk (giữ 14 ngày)
 Cập nhật:   bash deploy/oracle/update.sh
=====================================================================
EOF
