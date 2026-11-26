# Hệ thống Quản lý Trình ký Hồ sơ

Web app quản lý, theo dõi và kiểm soát hồ sơ trình ký trong doanh nghiệp xây dựng, dành cho Phòng Dự án, Ban Chỉ huy công trình, Phòng Kỹ thuật, Phòng Kế toán và các bộ phận liên quan.

Mục đích chính: **quản lý hồ sơ trình ký theo từng lần in phiếu trình ký (mẫu công ty) và số lần bị lỗi**. Đây không phải hệ thống ký điện tử: việc ký vẫn làm trên giấy, người lập ghi nhận lên hệ thống từng mốc.

Vòng đời hồ sơ: **soạn phiếu → in phiếu (nộp) → Trình Phụ trách liên quan → Quản lý phòng ban ký duyệt → Ban kiểm soát → Chờ TGĐ ký → TGĐ đã ký**. Mỗi mốc được người lập xác nhận và hiển thị: *Phụ trách liên quan - Đã kiểm tra*, *Quản lý phòng ban - Đã phê duyệt*, *Tổng Giám Đốc - Đã ký*. Ở Ban kiểm soát: không bị trả thì bấm Xác nhận là *Ban kiểm soát - Đã kiểm duyệt* (hồ sơ chuyển sang Chờ TGĐ ký); khi TGĐ ký xong mới bấm xác nhận *Tổng Giám Đốc - Đã ký*; bị trả thì bấm **Trình ký lại**, chọn **nhóm lỗi (bắt buộc)** và nhập nội dung, hồ sơ được in ký lại và quay về giai đoạn đầu. Trang chi tiết hồ sơ (thẻ giai đoạn và timeline) hiển thị chức danh kèm trạng thái màu: In phiếu & nộp trình ký • Đã trình (xanh dương); Phụ trách liên quan • Đang chờ kiểm tra (vàng) / Đã kiểm tra (xanh lá); Quản lý phòng ban • Đang chờ phê duyệt / Đã phê duyệt; Ban kiểm soát • Đang chờ kiểm duyệt / Đã kiểm duyệt, hoặc Trả về - chờ in ký lại (đỏ); Tổng Giám Đốc • Đang chờ ký (vàng) / Đã ký (xanh lá). Lịch sử được lưu đầy đủ. Dashboard và báo cáo tính trực tiếp từ dữ liệu thực tế. Không có hạn xử lý và không cảnh báo quá hạn.

---

## 1. Chức năng

| Module | Nội dung chính |
|---|---|
| **Phiếu trình ký** | Lập phiếu theo **mẫu công ty "Phiếu phê duyệt và kiểm tra"** (Mẫu trình ký 12.05.2026), xem trước bản in khổ A4 đúng bố cục mẫu. Chọn **Dự án/Công trình** thì phiếu tự điền tên dự án và **Chủ đầu tư**; ô CĐT/NCC/thầu phụ chỉ cho chọn các đối tác đã gắn với dự án. **Phòng ban trình ký** lấy theo phòng ban của người lập (chỉ Quản trị viên được đổi). Khi người dùng xác nhận **"Đã in xong"**: nội dung phiếu được khóa và lưu, hồ sơ được ghi nhận một lần nộp và vào giai đoạn Trình Phụ trách liên quan. Phiếu được **in lại trong 60 phút** (có đồng hồ đếm ngược, đổi được trong Cấu hình). Quá thời hạn thì chỉ còn nút **Trình ký lại**: bắt buộc nhập lý do, số lần trình lại do hệ thống tự tính và in lên phiếu. Khi hồ sơ đang ở **Ban kiểm soát**, Trình ký lại chính là *BKS trả về*: bắt buộc chọn nhóm lỗi, nội dung tự nhập được lưu làm nội dung lỗi và in lên phiếu. Trang thống kê cho biết số phiếu đã in, lần đầu, trình lại, lượt in lại **theo phòng ban trình ký và theo người thực hiện**, xuất được Excel. |
| **01 · Tổng quan** | 8 KPI (tổng hồ sơ, số lần in nộp, đang trình, TGĐ đã ký, BKS trả - chờ in ký lại, đang soạn phiếu, tỷ lệ bị BKS trả, thời gian nộp → TGĐ ký), biểu đồ theo tháng/trạng thái/loại/công trình/nhóm lỗi, **bảng theo phòng ban trình ký** và danh sách hồ sơ chờ in ký lại. Lọc theo thời gian, công trình, phòng ban, người phụ trách, loại, trạng thái và dữ liệu mẫu/chính thức. Bấm vào KPI để mở danh sách hồ sơ tương ứng. |
| **02 · Quản lý hồ sơ** | Thêm, sửa, xem, sao chép và xóa (xóa mềm, cần ghi lý do). Tìm theo mã, số hiệu, tên. Lọc theo hơn 12 tiêu chí, sắp xếp và phân trang phía server. Bảng cho phép **kéo độ rộng cột, ẩn/hiện cột, ghim cột** và tự lưu cấu hình hiển thị cho từng người dùng vào CSDL. Import Excel (có bước kiểm tra trước), xuất Excel/PDF theo bộ lọc. Đính kèm file. Hỗ trợ **trường dữ liệu mở rộng** do quản trị cấu hình. |
| **03 · Giai đoạn / trạng thái** | 8 trạng thái hệ thống: Đang soạn phiếu, **Trình Phụ trách liên quan, Quản lý phòng ban ký duyệt, Ban kiểm soát, Chờ TGĐ ký, TGĐ đã ký**, BKS trả về - chờ in ký lại, Đã hủy. Mỗi lần đổi trạng thái được ghi lịch sử gồm thời điểm, người thực hiện, nội dung và thời gian ở trạng thái trước. |
| **04 · BKS trả về & lỗi** | **Chỉ tính lỗi khi Ban kiểm soát trả về**, ghi nhận lúc người lập bấm Trình ký lại ở giai đoạn BKS (nhóm lỗi bắt buộc + nội dung tự nhập). Trình ký lại ở giai đoạn khác (ví dụ quá 60 phút) chỉ cần lý do, không tính lỗi. Mỗi lần trả là một bản ghi riêng, kèm người chịu trách nhiệm và file minh chứng. Lần trả tự đóng khi hồ sơ được in ký lại. Có 6 nhóm lỗi với 25 nguyên nhân mặc định, và cho phép tự nhập. Trang phân tích có top 10 lỗi, thống kê theo nhóm/người lập/người chịu trách nhiệm/phòng ban/công trình/kỳ, và phát hiện **lỗi tái diễn**. |
| **05 · Theo dõi trình ký** | Bảng hồ sơ với **mốc thời gian của từng giai đoạn** trong lần nộp hiện tại. Người lập bấm **Xác nhận** để chọn mốc đã đạt (*Phụ trách liên quan - Đã kiểm tra*, *Quản lý phòng ban - Đã phê duyệt*, *Tổng Giám Đốc - Đã ký*); thời điểm ghi nhận là giờ máy chủ lúc bấm (không chọn lùi được). Xác nhận vượt nhiều giai đoạn thì các giai đoạn bỏ qua được ghi cùng thời điểm. Ở giai đoạn Ban kiểm soát có thêm nút **Trình ký lại** (khi bị trả). Lọc theo phòng ban, dự án, giai đoạn, "hồ sơ tôi lập". Không tính hạn, không cảnh báo quá hạn. |
| **06 · Danh mục** | Công trình/dự án (kèm **Chủ đầu tư và danh sách NCC/thầu phụ của dự án**), loại hồ sơ, bộ phận, **khối** (thuộc phòng ban), CĐT/NCC/thầu phụ, nhóm lỗi, nguyên nhân trả, trạng thái, trường mở rộng. Mỗi mục có thể thêm, sửa, vô hiệu hóa. Chỉ xóa được khi chưa phát sinh dữ liệu. |
| **07 · Báo cáo** | (1) Tổng hợp theo ngày/tháng/quý/năm, theo công trình và **theo phòng ban trình ký**. (2) **Thời gian theo giai đoạn** (thời gian thực tế ở mỗi giai đoạn, nộp → TGĐ ký theo loại và phòng ban). (3) Phân tích lỗi. (4) Hiệu suất nhân sự. Mọi báo cáo đều lọc được và **xuất được Excel và PDF** (font hỗ trợ tiếng Việt), có ghi công thức tính. |
| **Quản trị** | Tab **Người dùng**: thêm, sửa, khóa và **xóa người dùng khỏi hệ thống** (xóa mềm: không đăng nhập được, ẩn khỏi mọi danh sách, lịch sử hồ sơ giữ nguyên tên). Khi tạo tài khoản bắt buộc chọn **phòng ban** và **vai trò**: Nhân viên / Phụ trách liên quan / Quản lý phòng ban. Nếu phòng ban có **khối** (vd Phòng Dự án: Khối Phát triển dự án, Khối Thi công dự án) thì Nhân viên và Phụ trách liên quan phải chọn khối; một khối có thể có nhiều Phụ trách liên quan. Quản lý phòng ban đứng trên các khối, không thuộc khối, **mỗi phòng ban chỉ 1 người** (chuẩn bị cho luồng Quản lý duyệt, hiện chỉ lưu, chưa đổi nghiệp vụ). Tab **Phân quyền**: chỉnh quyền sử dụng hệ thống, danh sách xếp theo phòng ban → khối; phòng ban, khối, Phụ trách liên quan, Quản lý phòng ban chỉ hiển thị theo thiết lập ở tab Người dùng. Cấu hình thời hạn in lại phiếu và tiền tố mã. Sao lưu, xóa dữ liệu mẫu, nhật ký hoạt động. |

### Phân quyền

| Vai trò | Quyền |
|---|---|
| Administrator | Toàn quyền: người dùng, danh mục, cấu hình, sao lưu, nhật ký và mọi dữ liệu |
| Manager | Dashboard, báo cáo (gồm hiệu suất nhân sự), giám sát và xử lý hồ sơ trong phạm vi, đổi trạng thái ngoài luồng chuẩn, import |
| Staff | Lập và in phiếu, xác nhận giai đoạn, ghi nhận BKS trả về và in ký lại cho hồ sơ của mình hoặc của bộ phận. Chỉ xóa được hồ sơ do mình lập và chưa trình |
| Viewer | Chỉ xem dữ liệu trong phạm vi được cấp |

**Phạm vi dữ liệu**: không còn chỉnh trên giao diện. Tài khoản mới mặc định vai trò Nhân viên, phạm vi *Theo bộ phận*; tài khoản cũ giữ phạm vi đã có (Quản trị viên luôn thấy toàn bộ). Ở phạm vi nào, người dùng cũng luôn thấy hồ sơ mà mình trực tiếp liên quan. Quyền được kiểm tra ở **server** cho mọi API, kể cả khi tải file.

### Giả định nghiệp vụ đã áp dụng (có thể điều chỉnh)

- **Không có hạn xử lý, không cảnh báo quá hạn.** Hệ thống chỉ ghi nhận hồ sơ đã nộp từ lúc nào và tới giai đoạn nào lúc nào.
- **Mốc giai đoạn** do người lập (hoặc quản lý/admin) bấm xác nhận; thời điểm luôn lấy giờ máy chủ.
- **Thời gian xử lý** tính từ lần in nộp đầu tiên đến lúc xác nhận *TGĐ đã ký*.
- Chỉ **Ban kiểm soát** được trả hồ sơ, và việc trả được ghi nhận qua Trình ký lại (nhóm lỗi bắt buộc). Khi in ký lại, các lần trả chưa đóng sẽ tự đóng và các lỗi được coi là đã khắc phục. Hồ sơ đã bị BKS trả thì không được in lại phiếu cũ, phải *Trình ký lại*.
- Nhóm lỗi có cờ **"Tính trách nhiệm cá nhân"**. Lỗi khách quan (ví dụ CĐT thay đổi yêu cầu) không bị tính vào hiệu suất cá nhân. Lỗi được gán cho *người chịu trách nhiệm*, không mặc nhiên quy cho người lập.
- Người dùng nhập được **thời điểm thực hiện** của mỗi thao tác (không được ở tương lai và không trước ngày lập) để ghi lại các sự kiện đã xảy ra trước đó.
- Hồ sơ bị xóa sẽ được **xóa mềm**. Lịch sử và nhật ký vẫn còn, nhưng hồ sơ không còn xuất hiện trong danh sách và thống kê.

---

## 2. Công nghệ

| Thành phần | Lựa chọn |
|---|---|
| Frontend + Backend | **Next.js 15** (App Router), React 19, **TypeScript**, REST API dạng Route Handlers |
| UI | **Tailwind CSS v4**, component tự xây dựng, lucide-react, **TanStack Table** (resize/ẩn/ghim cột) |
| Biểu đồ | **Recharts** |
| CSDL / ORM | **PostgreSQL 16** + **Prisma 6** (migrations) |
| Xác thực | Mật khẩu băm **bcrypt**, phiên **JWT HS256** lưu trong cookie httpOnly (jose), chống dò mật khẩu |
| Kiểm tra dữ liệu | **Zod** (server) |
| Excel / PDF | **ExcelJS** (import/export), **pdfmake** (PDF, font Roboto có tiếng Việt) |
| Lưu file | Đĩa server (`UPLOAD_DIR`, nằm ngoài `public`). File chỉ tải được qua API có kiểm tra quyền, có giới hạn định dạng và dung lượng |

---

## 3. Cấu trúc thư mục

```
├── prisma/
│   ├── schema.prisma          # 24 bảng: Users, Departments, Projects, Documents, DocumentStatusHistory,
│   │                          # DocumentSubmissions, DocumentReturns, DocumentErrors, DocumentActivity, ...
│   ├── migrations/            # Migration SQL
│   └── seed.ts                # Danh mục nền + admin; --sample: dữ liệu mẫu mô phỏng qua engine nghiệp vụ
├── src/
│   ├── app/
│   │   ├── (app)/             # Các trang sau đăng nhập: dashboard, documents, tracking, returns,
│   │   │                      # errors, reports, catalogs, admin, notifications
│   │   ├── api/               # REST API (auth, documents, actions, returns, reports, catalogs, users, ...)
│   │   └── login/
│   ├── components/            # AppShell, DataTable, ActionDialog, DocumentForm, charts, ui...
│   ├── lib/                   # Dùng chung client/server: hằng số, phân quyền, ngày tháng, gọi API
│   ├── server/                # Tầng nghiệp vụ:
│   │   ├── workflow.ts        #   ENGINE 4 giai đoạn (mọi thay đổi trạng thái đi qua đây)
│   │   ├── documents.ts       #   CRUD hồ sơ, truy vấn danh sách
│   │   ├── analytics.ts       #   Thống kê, KPI, công thức
│   │   ├── reports.ts         #   4 báo cáo + cấu trúc xuất file
│   │   ├── scope.ts           #   Phạm vi dữ liệu theo người dùng
│   │   ├── importExport.ts, exporters.ts, storage.ts, backup.ts, catalogs.ts, ...
│   └── middleware.ts          # Chặn truy cập khi chưa đăng nhập
├── scripts/                   # dev-db (PostgreSQL nhúng), backup, restore, purge-sample
├── tests/                     # workflow.test.ts (4 giai đoạn), signingForms.test.ts (phiếu), api.smoke.ts (HTTP)
├── Dockerfile, docker-compose.yml
```

---

## 4. Cài đặt & chạy local

Yêu cầu: **Node.js ≥ 20** (đã kiểm thử với Node 24) và npm.

```bash
npm install          # npm ≥ 11 sẽ hỏi duyệt install-scripts: các gói đã được khai báo sẵn trong "allowScripts"
cp .env.example .env # rồi đặt AUTH_SECRET là một chuỗi ngẫu nhiên dài ít nhất 32 ký tự
```

### Cấu hình database: chọn MỘT trong ba cách

**Cách A: PostgreSQL bằng Docker**
```bash
npm run db:up        # docker compose up -d db  (cổng 5433)
```

**Cách B: PostgreSQL nhúng, không cần Docker hay cài đặt** (phù hợp cho máy dev Windows)
```bash
npm run db:local     # giữ cửa sổ này chạy; dữ liệu nằm ở ./storage/pgdata, cổng 5433
```

**Cách C: PostgreSQL có sẵn.** Sửa `DATABASE_URL` trong `.env`:
```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?schema=public"
```

### Khởi tạo dữ liệu & chạy

```bash
npx prisma migrate deploy   # tạo bảng
npm run db:seed:sample      # danh mục nền + admin + ~170 hồ sơ MẪU (hoặc: npm run db:seed để chỉ có danh mục nền)
npm run dev                 # http://localhost:3000
```

Các lệnh khác:

| Lệnh | Tác dụng |
|---|---|
| `npm test` | Kiểm thử luồng 4 giai đoạn và quy tắc phiếu trình ký (21 test) |
| `npm run test:api` | Kiểm thử API qua HTTP (30 kiểm tra: phân quyền, khối/vai trò, luồng 4 giai đoạn, theo dõi, xuất Excel/PDF). Cần server đang chạy |
| `npm run db:reset` | Xóa hồ sơ mẫu rồi tạo lại bộ mẫu mới |
| `npm run db:purge-sample` | Xóa toàn bộ hồ sơ mẫu, giữ nguyên dữ liệu chính thức |
| `npm run db:backup` | Tạo bản sao lưu vào `storage/backups` |
| `npm run typecheck` / `npm run build` | Kiểm tra kiểu / build production |

### Tài khoản mẫu để kiểm thử

| Tài khoản | Mật khẩu | Vai trò · phạm vi |
|---|---|---|
| `admin` | `Admin@123` | Quản trị viên |
| `giamdoc` | `Matkhau@123` | Manager · toàn hệ thống |
| `truongpda` | `Matkhau@123` | Manager · toàn hệ thống (Phòng Dự án) |
| `truongpkt` | `Matkhau@123` | Manager · theo bộ phận (Phòng Kỹ thuật) |
| `chihuy1` | `Matkhau@123` | Manager · theo công trình được giao (3 công trình) |
| `ketoantruong` | `Matkhau@123` | Manager · theo bộ phận (Kế toán) |
| `nv.an`, `nv.binh`, `nv.chi`, `nv.dung`, `nv.ha`, `nv.khoa` | `Matkhau@123` | Staff · theo bộ phận |
| `nv.linh` | `Matkhau@123` | Staff · chỉ hồ sơ cá nhân |
| `xem` | `Matkhau@123` | Viewer · theo công trình |

> ⚠️ Các tài khoản trên chỉ dùng để kiểm thử. Khi đưa vào sử dụng thật, hãy đổi mật khẩu admin, xóa dữ liệu mẫu (Quản trị → Sao lưu & dữ liệu mẫu) và vô hiệu hóa các tài khoản/công trình mẫu.

**Phân biệt dữ liệu mẫu:** hồ sơ mẫu có cờ `isSample` và nhãn "Mẫu" trên giao diện. Mọi màn hình thống kê đều có bộ lọc *"Chỉ dữ liệu chính thức"*.

---

## 5. Triển khai production

> **Hai phương án miễn phí để trình phê duyệt:** xem bảng so sánh tại [docs/SO-SANH-PHUONG-AN.md](docs/SO-SANH-PHUONG-AN.md).
> - **Phương án 1:** app này trên **Oracle Cloud Free**. Cài bằng một lệnh, có HTTPS và sao lưu tự động: [deploy/oracle/HUONG-DAN.md](deploy/oracle/HUONG-DAN.md).
> - **Máy chủ Windows Server của công ty** (dùng trong mạng nội bộ, không cần Docker): [deploy/windows/HUONG-DAN.md](deploy/windows/HUONG-DAN.md).
> - **Phương án 2:** bản gọn chạy trên **Google Sheets + Apps Script**, làm mới dữ liệu mỗi năm: [google-apps-script/HUONG-DAN.md](google-apps-script/HUONG-DAN.md).

### Cách 1: Docker Compose (khuyến nghị)

```bash
export POSTGRES_PASSWORD='<mật khẩu DB mạnh>'
export AUTH_SECRET="$(openssl rand -hex 32)"
export SEED_ADMIN_PASSWORD='<mật khẩu admin ban đầu>'
docker compose --profile prod up -d --build
# Có HTTPS (Caddy tự lấy chứng chỉ): thêm DOMAIN=<tên miền> và --profile https
```

- Service `init` chạy `prisma migrate deploy` và seed danh mục nền (không có dữ liệu mẫu) một lần.
- Service `app` chạy bản Next.js *standalone* tại cổng 3000. File đính kèm và bản sao lưu được lưu trong volume `qltk_storage`.
- Đặt reverse proxy (Nginx/Caddy) có **HTTPS** phía trước. Cookie phiên dùng cờ `Secure` khi `NODE_ENV=production`. Nếu chạy HTTP nội bộ không có TLS, đặt `COOKIE_SECURE=false`.

### Cách 2: Node trực tiếp

```bash
npm ci && npx prisma migrate deploy && npm run db:seed && npm run build
NODE_ENV=production node .next/standalone/server.js   # cần copy .next/static vào .next/standalone/.next/static
```
Có thể dùng PM2/systemd để giữ tiến trình chạy.

### Biến môi trường

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `DATABASE_URL` | ✔ | Chuỗi kết nối PostgreSQL |
| `AUTH_SECRET` | ✔ | Khóa ký phiên, tối thiểu 32 ký tự ngẫu nhiên |
| `UPLOAD_DIR` | | Thư mục lưu file đính kèm (mặc định `./storage/uploads`) |
| `BACKUP_DIR` | | Thư mục sao lưu (mặc định `./storage/backups`) |
| `MAX_UPLOAD_MB` | | Dung lượng tối đa mỗi file (mặc định 25) |
| `SEED_ADMIN_PASSWORD` | | Mật khẩu admin khi seed lần đầu (mặc định `Admin@123`) |

### Sao lưu & khôi phục

- **Trong ứng dụng:** vào Quản trị → Sao lưu, hoặc chạy `npm run db:backup`. Lệnh xuất toàn bộ CSDL ra file `.json.gz`.
- **Khôi phục** vào một CSDL mới đã chạy `prisma migrate deploy`: `npx tsx scripts/restore.ts storage/backups/backup-xxxx.json.gz`
- **Khuyến nghị production:** chạy thêm `pg_dump` định kỳ bằng cron, ví dụ `pg_dump -Fc $DATABASE_URL > qltk-$(date +%F).dump`, và sao lưu thư mục `UPLOAD_DIR`.

### Bảo mật đã áp dụng

- Mật khẩu băm bcrypt và chính sách mật khẩu tối thiểu. Đăng nhập sai quá 8 lần trong 15 phút sẽ bị khóa tạm.
- Cookie phiên httpOnly, SameSite=Lax. Mỗi request đều kiểm tra lại người dùng còn hoạt động hay không.
- Phân quyền theo vai trò và phạm vi dữ liệu được kiểm tra ở server cho mọi API và cả khi tải file.
- Dữ liệu đầu vào được kiểm tra bằng Zod. Prisma tham số hóa truy vấn nên không bị SQL injection.
- Upload chỉ nhận danh sách định dạng cho phép và có giới hạn dung lượng. Tên file lưu do hệ thống sinh. File không truy cập trực tiếp được.
- Header bảo mật: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`.
- **Nhật ký hoạt động** ghi lại đăng nhập (kể cả thất bại), tạo/sửa/xóa, thao tác nghiệp vụ, xuất dữ liệu, thay đổi cấu hình và danh mục.

---

## 6. Công thức chỉ số chính

| Chỉ số | Công thức |
|---|---|
| Tỷ lệ TGĐ đã ký | Hồ sơ *TGĐ đã ký* ÷ (Tổng hồ sơ − Hồ sơ đã hủy) |
| Tỷ lệ bị BKS trả | Số **hồ sơ** bị Ban kiểm soát trả ≥ 1 lần ÷ Số hồ sơ đã in nộp (đếm hồ sơ, không đếm số lần trả) |
| Số lần in nộp | Lần đầu + các lần in ký lại (không tính lượt in lại trong 60 phút) |
| Tổng số lần trả / tổng số lỗi | Đếm bản ghi trả / bản ghi lỗi. Một hồ sơ có thể bị trả nhiều lần, mỗi lần có thể nhiều lỗi |
| Thời gian xử lý | Thời điểm *TGĐ đã ký* − Thời điểm in nộp lần đầu (trung bình trên các hồ sơ TGĐ đã ký) |
| Thời gian ở giai đoạn | Mốc xác nhận giai đoạn kế tiếp − mốc xác nhận giai đoạn đó (cùng một lần nộp) |
| Hiệu suất nhân sự | Tách riêng: số hồ sơ đã lập/đã xử lý, % hồ sơ bị trả, *lần trả có trách nhiệm* (chỉ lỗi thuộc nhóm có tính trách nhiệm và gán đúng người chịu trách nhiệm), lần trả do khách quan, thời gian lập→nộp, thời gian từ lúc bị trả đến lúc in ký lại |

Các công thức cũng được hiển thị ngay trên Dashboard (rê chuột vào KPI) và ở cuối mỗi báo cáo.

---

## 7. Hướng mở rộng

- Gửi thông báo qua email hoặc Zalo OA khi Ban kiểm soát trả hồ sơ.
- Lưu file trên S3/MinIO bằng cách thay `src/server/storage.ts`.
- Khi dữ liệu rất lớn (hàng trăm nghìn hồ sơ), chuyển các hàm tổng hợp trong `analytics.ts` sang truy vấn SQL hoặc materialized view.
- Ký số và tích hợp hệ thống văn bản điện tử.
