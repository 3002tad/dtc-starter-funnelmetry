# Chạy demo Medusa v2 (reference host)

Tài liệu này chạy Medusa DTC Starter làm reference host cho Funnelmetry. Docker
chạy PostgreSQL, Medusa backend và Next.js storefront. `pnpm` chỉ được cài
trong runtime image; source upstream dưới `apps/` không cần patch.

## Điều kiện trước khi chạy

- Docker Desktop đang chạy
- Cổng `5432`, `8000` và `9000` chưa bị chiếm

Thực hiện các lệnh dưới đây tại thư mục `Medusa_Reference`.

## 1. Khởi động runtime

```powershell
docker compose -f runtime/docker-compose.yml up -d --build
docker compose -f runtime/docker-compose.yml ps
```

`postgres` phải là `healthy`; `backend` và `storefront` phải là `Up`. Lần build
image đầu tiên có thể mất vài phút. Database nằm trong named volume, vì vậy dữ
liệu được giữ khi dừng dịch vụ thông thường.

## 2. Khởi tạo dữ liệu và tài khoản quản trị

Migration tự chạy khi backend khởi động. Với database mới, nạp catalog mẫu và
tạo admin trong container:

```powershell
docker compose -f runtime/docker-compose.yml exec backend pnpm run backend:seed
docker compose -f runtime/docker-compose.yml exec backend sh -c "cd apps/backend && pnpm medusa user -e admin@example.local -p <mat-khau-local>"
```

Mở `http://localhost:9000/app`, đăng nhập, rồi vào **Settings → Publishable
API Keys** để lấy hoặc tạo publishable key. Đây là khóa public cho Store API;
không dùng token quản trị trong storefront.

## 3. Khai báo storefront

Nếu `apps/storefront/.env.local` chưa tồn tại, tạo từ mẫu:

```powershell
Copy-Item runtime/storefront.env.example apps/storefront/.env.local
```

Điền publishable key vào `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`. Compose dùng
`api.localhost` để cùng URL hoạt động ở browser và Next.js Edge runtime, mà
không cần thay đổi source Medusa.

Mở storefront tại `http://localhost:8000/dk`. Luồng demo tối thiểu là: category
→ product detail → add-to-cart → cart → checkout.

## Dừng và chạy lại

```powershell
docker compose -f runtime/docker-compose.yml down
```

Lệnh trên **không xóa dữ liệu**. Chỉ khi chủ động reset toàn bộ database local
mới dùng:

```powershell
docker compose -f runtime/docker-compose.yml down -v
```

Sau reset, chạy lại catalog seed và tạo admin user từ bước 2.

## Xử lý nhanh lỗi thường gặp

| Hiện tượng | Kiểm tra/cách xử lý |
| --- | --- |
| Storefront báo `Failed to fetch` | Kiểm tra `docker compose -f runtime/docker-compose.yml ps`; backend phải `Up` và `.env.local` cần publishable key hợp lệ. |
| Không có sản phẩm | Chạy `docker compose -f runtime/docker-compose.yml exec backend pnpm run backend:seed`. |
| Cổng đã được dùng | Dừng process đang chiếm cổng hoặc đổi mapping trong Compose cùng URL tương ứng. |
