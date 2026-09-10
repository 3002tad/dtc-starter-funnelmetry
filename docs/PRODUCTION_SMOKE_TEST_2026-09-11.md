# Production Storefront Smoke Test — 2026-09-11

## Mục tiêu và phạm vi

Xác nhận Storefront Medusa đã chuyển sang image production (`next build` + `next start`) vẫn hoạt động qua Cloudflare, theo luồng mua hàng cơ bản. Test chạy bằng Microsoft Edge thông qua Playwright tại `https://shop-test.simplething.id.vn/dk`.

Không thực hiện bước đặt đơn. Dữ liệu địa chỉ ở checkout là dữ liệu QA giả, chỉ nằm trong cart session của lượt test.

## Kết quả

| Bước | Thao tác và bằng chứng | Kết quả |
| --- | --- | --- |
| 1 | Mở homepage public; title `Northstar Goods`, catalog và điều hướng hiển thị. | Pass |
| 2 | Mở `Medusa T-Shirt`; trang chi tiết, biến thể và ảnh tải được. | Pass |
| 3 | Chọn `S` và `Black`; trạng thái chuyển sang `Available`, nút Add to cart được bật. | Pass |
| 4 | Thêm sản phẩm vào giỏ; badge đổi thành `Cart (1)`, request POST trang sản phẩm trả 200. | Pass |
| 5 | Mở cart; đúng biến thể, số lượng 1, subtotal €10.00. | Pass |
| 6 | Vào checkout, điền địa chỉ QA giả; POST address trả 303 và chuyển sang Delivery. | Pass |
| 7 | Chọn Standard Shipping; tổng tiền đổi thành €20.00 và nút sang Payment được bật. | Pass |
| 8 | Mở Payment; Manual Payment hiển thị. Dừng tại đây, không chọn payment và không tạo order. | Pass trong phạm vi smoke test |

## Quan sát

- Không có console error. Có một warning đã biết: Browser SDK của Funnelmetry chưa có write key nên tracking browser đang inactive. Warning này không cản trở storefront/cart/checkout; cần xử lý trong phase cấu hình Funnelmetry, không phải lỗi Medusa production.
- Trước khi chọn shipping method, nút đi tiếp bị disabled là đúng. Sau khi chọn Standard Shipping, nút được bật và chuyển sang Payment thành công.
- Snapshot accessibility tại Delivery hiển thị một radio con của Express vẫn có thuộc tính `checked` dù outer radio Standard là lựa chọn thực tế. Luồng chức năng không bị chặn, nhưng nên rà soát lại markup/ARIA của component chọn shipping để tránh trạng thái gây nhiễu cho screen reader.

## Artifacts

Playwright đã tạo screenshot, snapshot, console log và trace trong thư mục workspace `.playwright-cli/`. Trace của lượt test: `trace-1789061823847.trace`.

Các mốc screenshot chính:

- Homepage: `page-2026-09-10T17-37-25-515Z.png`
- Product/variant: `page-2026-09-10T17-38-11-874Z.png`
- Cart: `page-2026-09-10T17-39-24-475Z.png`
- Checkout Address: `page-2026-09-10T17-39-47-886Z.png`
- Delivery: `page-2026-09-10T17-41-06-932Z.png`
- Payment: `page-2026-09-10T17-41-31-416Z.png`

