# Cài app trên máy chủ Windows Server của công ty (dùng trong mạng nội bộ)

App chạy trên máy chủ của công ty. Mọi máy trong **cùng mạng công ty** (dây LAN hoặc Wi-Fi) mở trình duyệt vào địa chỉ máy chủ, ví dụ `http://192.168.1.10:3000`. **Không tốn chi phí**, dữ liệu nằm tại công ty.

Sau khi cài:
- app **tự chạy khi máy chủ khởi động**, và tự chạy lại nếu bị tắt đột ngột;
- **tự sao lưu lúc 2 giờ sáng** hằng ngày, giữ 14 ngày.

Thời gian cài lần đầu: khoảng 45 phút.

## Yêu cầu máy chủ

| Hạng mục | Tối thiểu |
|---|---|
| Hệ điều hành | Windows Server 2016 / 2019 / 2022 / 2025 |
| RAM | 4 GB (khuyên dùng 8 GB) |
| Ổ trống | 20 GB |
| Mạng | **IP cố định** trong mạng công ty |
| Tài khoản | Đăng nhập bằng tài khoản **Administrator** |

---

## Bước 1. Đặt IP cố định cho máy chủ

Để địa chỉ app không bị đổi. Nhờ người phụ trách mạng/IT làm theo **một trong hai cách**:

- **Trên router/modem:** đặt *DHCP reservation* (giữ cố định IP) cho máy chủ.
- **Trên máy chủ:**
  1. Mở **Control Panel** → **Network and Sharing Center** → **Change adapter settings**.
  2. Chuột phải card mạng → **Properties** → **Internet Protocol Version 4** → **Use the following IP address**.
  3. Điền IP, Subnet mask, Gateway và DNS giống cấu hình mạng hiện tại.

Ghi lại IP của máy chủ, ví dụ `192.168.1.10`.

## Bước 2. Cài 3 phần mềm nền (miễn phí, chỉ cần bấm Next)

Tải và cài **trên máy chủ**:

1. **Node.js 22 LTS**: <https://nodejs.org> → bấm nút **LTS** (Windows Installer `.msi`) → cài với các tùy chọn mặc định.
2. **PostgreSQL 17**: <https://www.enterprisedb.com/downloads/postgres-postgresql-downloads> → chọn **Windows x86-64**, phiên bản **17**. Khi cài:
   - **Password** cho tài khoản `postgres`: đặt mật khẩu mạnh và **ghi lại**, bước 3 cần đến;
   - **Port**: giữ `5432`;
   - các mục khác giữ mặc định;
   - màn hình cuối **bỏ tick "Stack Builder"** rồi bấm Finish.
3. **Git for Windows**: <https://git-scm.com/download/win> → cài với các tùy chọn mặc định. Git dùng để tải code và cập nhật về sau.

## Bước 3. Tải code và cài app (một lệnh)

1. Bấm **Start**, gõ `PowerShell`, **chuột phải** Windows PowerShell → **Run as administrator**.
2. Chạy lần lượt từng lệnh:

```powershell
git clone https://github.com/khoacrab-97/quanlytrinhkyhoso.git C:\QLTK
```

```powershell
cd C:\QLTK
```

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\cai-dat.ps1
```

3. Khi được hỏi, nhập **mật khẩu tài khoản `postgres`** đã đặt ở Bước 2. Lúc gõ, màn hình không hiện ký tự; đó là bình thường.
4. Chờ khoảng 5–15 phút. Script tự làm các việc sau:
   - tạo CSDL riêng cho app với mật khẩu ngẫu nhiên;
   - tạo file cấu hình `C:\QLTK\.env`;
   - cài thư viện, tạo bảng dữ liệu và danh mục nền, build app;
   - mở cổng 3000 trên tường lửa Windows;
   - đặt tác vụ **tự chạy app khi khởi động** và **sao lưu 2 giờ sáng** (trong *Task Scheduler*);
   - khởi động app.
5. Cuối cùng màn hình in ra:

```
XONG! Trên các máy trong mạng công ty, mở trình duyệt vào:
     http://192.168.1.10:3000
Đăng nhập: admin    Mật khẩu: 1a2b3c4d5e6fQa1
```

**Ghi lại mật khẩu admin này.** Nó chỉ hiện một lần.

> **Muốn địa chỉ gọn hơn** (`http://192.168.1.10`, không có `:3000`): ở lệnh cài, thêm `-Port 80`. Chỉ dùng được khi máy chủ không chạy IIS hoặc web khác ở cổng 80.
> **Muốn lưu file đính kèm và bản sao lưu ở ổ D:** thêm `-DataDir D:\QLTK-DuLieu`. Mặc định là `C:\QLTK-DuLieu`.

## Bước 4. Bắt đầu sử dụng

1. Từ **một máy khác** trong mạng công ty, mở trình duyệt vào địa chỉ ở trên.
2. Đăng nhập `admin`, rồi **đổi mật khẩu ngay** (menu góc phải trên).
3. Vào **Danh mục**:
   - sửa phòng ban và khối;
   - nhập dự án kèm CĐT/NCC/thầu phụ, loại hồ sơ, nhóm lỗi.
4. Vào **Quản trị → Người dùng**: tạo tài khoản cho từng người, chọn phòng ban, khối và vai trò.
5. **In thử một phiếu** trên máy in thật để kiểm tra khổ A4.
6. Gửi địa chỉ cho mọi người. Có thể tạo lối tắt trên màn hình: mở trang, bấm ⋮ → *Lưu và chia sẻ* → *Tạo lối tắt*.

---

## Vận hành

Các lệnh dưới đây chạy trong **PowerShell (Run as administrator)**, sau khi `cd C:\QLTK`.

| Việc | Cách làm |
|---|---|
| App không vào được / bị treo | `powershell -ExecutionPolicy Bypass -File deploy\windows\khoi-dong-lai.ps1` |
| Xem nhật ký lỗi | Mở file `C:\QLTK\logs\app.log` |
| Sao lưu ngay | `powershell -ExecutionPolicy Bypass -File deploy\windows\sao-luu.ps1` |
| Cập nhật lên bản mới (tự sao lưu trước) | `powershell -ExecutionPolicy Bypass -File deploy\windows\cap-nhat.ps1` |
| Xem tác vụ tự chạy | *Task Scheduler* → *Task Scheduler Library* → `QLTK - Ung dung`, `QLTK - Sao luu` |

### Sao lưu

- Bản sao lưu nằm trong `C:\QLTK-DuLieu\backups`, giữ 14 ngày:
  - `db-*.dump`: CSDL;
  - `uploads-*.zip`: file đính kèm.
- **Nên chép thêm ra ổ khác hoặc NAS**, phòng khi máy chủ hỏng ổ cứng. Mở file `C:\QLTK\.env` bằng Notepad và điền dòng:
  ```
  BACKUP_COPY_TO=\\TEN-NAS\SaoLuu\QLTK
  ```
  hoặc `BACKUP_COPY_TO=E:\SaoLuuQLTK`. Từ đêm đó, mỗi bản sao lưu được chép thêm sang chỗ này.
  > Nếu dùng NAS, cần cấp quyền ghi thư mục NAS cho **tài khoản máy** của máy chủ, vì tác vụ chạy bằng tài khoản SYSTEM. Không làm được thì dùng ổ cứng gắn ngoài.
- **Khôi phục CSDL** từ một bản sao lưu (đổi tên file cho đúng):
  ```powershell
  cd C:\QLTK
  & "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" -h localhost -U qltk -d qltk --clean --if-exists "C:\QLTK-DuLieu\backups\db-2026-12-01_0200.dump"
  powershell -ExecutionPolicy Bypass -File deploy\windows\khoi-dong-lai.ps1
  ```
  Lệnh hỏi mật khẩu: là đoạn sau `qltk:` và trước `@localhost` trong dòng `DATABASE_URL` của file `.env`. Khôi phục xong thì khởi động lại app (lệnh thứ ba).

### Lưu ý

- Máy chủ phải **luôn bật**. Nên cắm qua **UPS** (bộ lưu điện) để không mất điện đột ngột.
- **Không xóa** file `C:\QLTK\.env`. Trong đó có mật khẩu CSDL và khóa bảo mật; mất file này thì app không kết nối được dữ liệu.
- Windows Update có thể khởi động lại máy. App tự chạy lại, không cần làm gì.
- Sau này muốn dùng từ bên ngoài công ty (công trường, ở nhà): có thể thêm **Cloudflare Tunnel** miễn phí mà không phải cài lại app.
