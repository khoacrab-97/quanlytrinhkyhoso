#!/usr/bin/env bash
# Sao lưu CSDL + file đính kèm, giữ lại 14 ngày gần nhất.
# Tự chạy lúc 2 giờ sáng (cron do setup.sh cài). Chạy tay: sudo bash deploy/oracle/backup.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DC="docker compose --profile prod --profile https"
DEST="${BACKUP_DEST:-/var/backups/qltk}"
KEEP_DAYS="${KEEP_DAYS:-14}"
TS="$(date +%Y-%m-%d_%H%M)"

mkdir -p "$DEST"
$DC exec -T db pg_dump -U qltk -Fc qltk > "$DEST/db-$TS.dump"
$DC exec -T app tar czf - -C /app storage/uploads > "$DEST/uploads-$TS.tar.gz"
find "$DEST" -name 'db-*.dump' -mtime +"$KEEP_DAYS" -delete
find "$DEST" -name 'uploads-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date '+%F %T') Đã sao lưu: $DEST/db-$TS.dump, $DEST/uploads-$TS.tar.gz"
