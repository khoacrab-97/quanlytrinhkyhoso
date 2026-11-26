# Phương án 1: Chạy app trên Oracle Cloud Free

App giữ nguyên toàn bộ tính năng. Máy chủ online của Oracle **miễn phí vĩnh viễn**, gói *Always Free*. Truy cập được từ mọi nơi qua HTTPS.

| Hạng mục | Chi phí |
|---|---|
| Máy chủ (Ampere A1: tối đa 4 CPU, 24 GB RAM) | 0 đồng |
| Ổ đĩa 50–200 GB, dữ liệu ra vào 10 TB/tháng | 0 đồng |
| HTTPS (chứng chỉ Let's Encrypt) | 0 đồng |
| Tên miền riêng (không bắt buộc) | khoảng 250 nghìn/năm |

Tổng thời gian làm lần đầu: khoảng 45–60 phút.

---

## Bước 1. Tạo tài khoản Oracle Cloud

1. Vào <https://www.oracle.com/cloud/free/> và bấm **Start for free**.
2. Điền email, tên và quốc gia **Vietnam**.
3. **Home Region**: chọn **Singapore (ap-singapore-1)** để truy cập nhanh. Lưu ý: **không đổi được về sau**.
4. Nhập thẻ Visa hoặc Mastercard. Oracle chỉ tạm giữ khoảng 1 USD để xác minh rồi hoàn lại. **Không bị trừ tiền** nếu chỉ dùng tài nguyên *Always Free*.
5. Chờ email báo tài khoản sẵn sàng, thường vài phút.

## Bước 2. Tạo máy chủ (Instance)

1. Đăng nhập <https://cloud.oracle.com>. Vào menu ☰ → **Compute** → **Instances** → **Create instance**.
2. **Name**: `trinhky`.
3. **Image and shape** → **Edit**:
   - **Image**: *Change image* → **Ubuntu** → chọn **Canonical Ubuntu 24.04**.
   - **Shape**: *Change shape* → **Ampere** → **VM.Standard.A1.Flex**. Chọn **2 OCPU** và **12 GB** memory. Có nhãn *Always Free-eligible* là đúng.
4. **Networking**: giữ mặc định và đảm bảo bật **Assign a public IPv4 address**.
5. **Add SSH keys**: chọn **Generate a key pair for me**, rồi bấm **Save private key**. File có dạng `ssh-key-xxxx.key`; cất kỹ, mất là không vào được máy chủ.
6. Bấm **Create**. Chờ trạng thái chuyển sang **Running**, rồi ghi lại **Public IP address** (ví dụ `152.69.x.x`).

> Nếu báo **"Out of capacity"**: Oracle tạm hết máy Ampere ở vùng đó. Thử lại sau vài giờ, hoặc đổi *Availability domain* (AD-1/2/3) nếu có.

## Bước 3. Mở cổng web 80 và 443

1. Ở trang Instance, mục **Primary VNIC**, bấm vào tên **Subnet**.
2. Bấm vào **Security List** (ví dụ *Default Security List for vcn-...*), rồi chọn **Add Ingress Rules**.
3. Thêm 2 quy tắc:

   | Source CIDR | IP Protocol | Destination Port Range |
   |---|---|---|
   | `0.0.0.0/0` | TCP | `80` |
   | `0.0.0.0/0` | TCP | `443` |

4. Bấm **Add Ingress Rules**.

## Bước 4. Kết nối vào máy chủ

Trên máy Windows của bạn, mở **PowerShell** và chạy (đổi đường dẫn file key và IP cho đúng):

```powershell
ssh -i "$HOME\Downloads\ssh-key-xxxx.key" ubuntu@152.69.x.x
```

Lần đầu máy hỏi `Are you sure you want to continue connecting`: gõ `yes`.

> Nếu báo lỗi *UNPROTECTED PRIVATE KEY FILE*, chạy lệnh sau một lần rồi thử lại:
> `icacls "$HOME\Downloads\ssh-key-xxxx.key" /inheritance:r /grant:r "$($env:USERNAME):(R)"`

## Bước 5. Cài app (một lệnh)

Trong cửa sổ đang kết nối máy chủ, chạy:

```bash
git clone https://github.com/khoacrab-97/quanlytrinhkyhoso.git
cd quanlytrinhkyhoso
bash deploy/oracle/setup.sh
```

Script tự làm các việc sau:
- cài Docker;
- mở tường lửa của máy chủ;
- tạo mật khẩu CSDL và khóa bảo mật ngẫu nhiên (lưu trong file `.env`);
- build và chạy app, CSDL và HTTPS;
- đặt lịch **sao lưu tự động lúc 2 giờ sáng**.

Lần đầu mất khoảng 5–15 phút. Cuối cùng màn hình in ra:

```
XONG! Mở trình duyệt:  https://152.69.x.x.sslip.io
Đăng nhập:  admin
Mật khẩu:   ...
```

> **Repo GitHub để chế độ Private?** Khi `git clone` hỏi mật khẩu, nhập *Personal access token* của GitHub (GitHub → Settings → Developer settings → Tokens), không phải mật khẩu GitHub.

> **Có tên miền riêng?** Trỏ bản ghi **A** của tên miền (ví dụ `trinhky.tencongty.vn`) về IP máy chủ, rồi chạy `DOMAIN=trinhky.tencongty.vn bash deploy/oracle/setup.sh`.

## Bước 6. Bắt đầu sử dụng

1. Mở địa chỉ web vừa in ra, đăng nhập `admin` bằng mật khẩu ở trên, rồi **đổi mật khẩu ngay**.
2. **Danh mục**: sửa phòng ban và khối, nhập dự án kèm CĐT/NCC/thầu phụ, loại hồ sơ, nhóm lỗi.
3. **Quản trị → Người dùng**: tạo tài khoản cho khoảng 30 người, chọn phòng ban, khối và vai trò.
4. **Cấu hình**: đặt tiền tố mã hồ sơ và thời gian được in lại phiếu.
5. In thử một phiếu trên máy in thật để kiểm tra khổ A4.

---

## Vận hành hằng ngày

| Việc | Lệnh (chạy trong thư mục `quanlytrinhkyhoso` trên máy chủ) |
|---|---|
| Xem app có đang chạy | `sudo docker compose --profile prod --profile https ps` |
| Xem log lỗi | `sudo docker compose --profile prod --profile https logs --tail 100 app` |
| Khởi động lại | `sudo docker compose --profile prod --profile https restart app` |
| Cập nhật lên bản mới trên GitHub (tự sao lưu trước) | `bash deploy/oracle/update.sh` |
| Sao lưu ngay | `sudo bash deploy/oracle/backup.sh` |

### Sao lưu và khôi phục

- Bản sao lưu nằm ở `/var/backups/qltk` trên máy chủ, giữ 14 ngày:
  - `db-*.dump`: CSDL;
  - `uploads-*.tar.gz`: file đính kèm.
- **Nên chép về máy công ty hằng tuần.** Chạy trên máy Windows:

  ```powershell
  scp -i "$HOME\Downloads\ssh-key-xxxx.key" "ubuntu@152.69.x.x:/var/backups/qltk/db-*.dump" D:\SaoLuuTrinhKy\
  ```

- **Khôi phục CSDL** từ một bản sao lưu (chạy trên máy chủ):

  ```bash
  sudo docker compose --profile prod --profile https exec -T db pg_restore -U qltk -d qltk --clean --if-exists < /var/backups/qltk/db-2026-12-01_0200.dump
  ```

### Lưu ý về gói miễn phí

- Oracle có thể **thu hồi máy Always Free nếu máy rảnh liên tục 7 ngày**, tức CPU, mạng và RAM đều dùng rất thấp. App có 30 người dùng hằng ngày thường không bị coi là rảnh.
- Muốn chắc chắn không bị thu hồi: nâng tài khoản lên **Pay As You Go** (Billing → Upgrade). Máy *Always Free* **vẫn miễn phí**, nhưng không còn bị thu hồi. Chỉ phát sinh phí nếu tạo thêm tài nguyên vượt hạn mức miễn phí.
- Vì vẫn có rủi ro, luôn **chép bản sao lưu về máy công ty** định kỳ.
