# Chạy Medusa Reference ở local

Tài liệu này hướng dẫn chạy Medusa DTC Starter làm website thương mại điện tử
tham chiếu cho Funnelmetry. Môi trường Docker gồm PostgreSQL, Medusa Backend/Admin
và Next.js Storefront. Pipeline Funnelmetry không cần hoạt động để website chạy.

## 1. Điều kiện

- Docker Desktop đang chạy.
- Các cổng `5432`, `8000`, `9000` còn trống.
- Có GitHub Packages token chỉ với quyền `read:packages` để Docker tải các package
  Funnelmetry private. Không đưa token vào Git, `.env.local` hay tài liệu.

Tại PowerShell ở thư mục gốc `Medusa_Reference`:

```powershell
$env:FUNNELMETRY_PACKAGE_READ_TOKEN = "<read-only-package-token>"
```

Token chỉ được Docker BuildKit sử dụng khi cài dependency và không được lưu vào
image cuối cùng.

## 2. Khởi động lần đầu

```powershell
docker compose --env-file apps/storefront/.env.local -f runtime/docker-compose.yml up -d --build
docker compose -f runtime/docker-compose.yml ps
```

Chờ `postgres` ở trạng thái `healthy`, còn `backend` và `storefront` là `Up`.
Build đầu tiên có thể mất vài phút. Xem log khi một service không lên:

```powershell
docker compose -f runtime/docker-compose.yml logs -f backend
docker compose -f runtime/docker-compose.yml logs -f storefront
```

Các địa chỉ local:

- Storefront: `http://localhost:8000/dk`
- Medusa Admin: `http://localhost:9000/app`
- Backend API: `http://localhost:9000`

## 3. Nạp dữ liệu và tạo tài khoản Admin

Migration chạy khi backend khởi động. Với database mới, nạp catalog mẫu:

```powershell
docker compose -f runtime/docker-compose.yml exec backend pnpm run backend:seed
```

Tạo tài khoản quản trị local, thay email và mật khẩu mẫu trước khi dùng:

```powershell
docker compose -f runtime/docker-compose.yml exec backend sh -c "cd apps/backend && pnpm medusa user -e admin@example.local -p <mat-khau-local>"
```

Đăng nhập tại `/app`. Trong **Settings → Publishable API Keys**, tạo hoặc lấy
publishable key cho Store API.

## 4. Cấu hình Storefront

Nếu chưa có `apps/storefront/.env.local`, tạo từ mẫu:

```powershell
Copy-Item runtime/storefront.env.example apps/storefront/.env.local
```

Điền publishable key vào biến sau. Giá trị `NEXT_PUBLIC_*` được Next.js đóng gói
vào browser bundle tại `next build`, vì vậy mỗi thay đổi cần build lại storefront:

```env
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_...
```

```powershell
docker compose --env-file apps/storefront/.env.local -f runtime/docker-compose.yml up -d --build --force-recreate storefront
```

`NEXT_PUBLIC_MEDUSA_BACKEND_URL` đã được Compose đặt thành
`http://api.localhost:9000`; không cần sửa source Next.js để chạy local.

## 5. Kiểm tra nhanh

1. Mở storefront, chọn sản phẩm, thêm vào giỏ và đi đến checkout.
2. Mở Admin, kiểm tra catalog và order sau khi đặt hàng.
3. Nếu storefront báo `Failed to fetch` hoặc `Backend returned 400`, xác nhận
   backend đang `Up` và publishable key trong `.env.local` hợp lệ, sau đó recreate
   storefront như bước 4.

Lưu ý: cấu hình Compose local đặt `MEDUSA_COOKIE_SECURE=false` để đăng nhập Admin
qua `http://localhost`. Production phải dùng HTTPS và không dùng override này.

## 6. Dừng hoặc reset

```powershell
# Dừng services, vẫn giữ dữ liệu PostgreSQL.
docker compose -f runtime/docker-compose.yml down

# Chỉ dùng khi chủ động xóa toàn bộ dữ liệu local.
docker compose -f runtime/docker-compose.yml down -v
```

Sau reset cần seed lại catalog và tạo lại admin. Khi không cần build package nữa,
xóa token khỏi terminal hiện tại:

```powershell
Remove-Item Env:FUNNELMETRY_PACKAGE_READ_TOKEN
```
