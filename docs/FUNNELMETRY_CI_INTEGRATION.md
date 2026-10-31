# Funnelmetry CI integration

Medusa `main` giữ source gốc. Hai workflow trong `.github/workflows/` là bộ khởi tạo cho **nhánh tích hợp đã được tạo trước** (`funnelmetry/integration/<name>`; nhánh CDC hiện tại `feature/cdc-medusa-v1` cũng được chấp nhận). Workflow không chạy khi push vào `main`, không tạo nhánh, merge hay deploy. `funnelmetry.integration.yaml` trên nhánh tích hợp là cấu hình đầu vào cho installer được ghim bằng repository variable `FUNNELMETRY_PLANNER_REF` (SHA 40 ký tự).

## Luồng CI

1. Source owner tạo nhánh tích hợp từ revision Medusa muốn dùng và commit manifest `funnelmetry.io/v2` trên **nhánh đó**. Manifest V1 mẫu còn trên `main` không phải cấu hình CDC để chạy installer mới.
2. [Plan](../.github/workflows/funnelmetry-integration-plan.yml) đọc manifest, gọi planner ở chế độ read-only, kiểm tra contract CDC/Browser SDK và patch, rồi tải artifact/bản tóm tắt thay đổi. Plan chỉ giúp theo dõi, không phải bước duyệt trước khi sinh code.
3. [Propose](../.github/workflows/funnelmetry-integration-propose.yml) tạo patch từ cùng manifest, giới hạn các file installer được phép quản lý, áp patch trên đúng nhánh tích hợp, cập nhật lockfile bằng pnpm, build backend/type-check storefront và commit/push lại nhánh đó. Build từ nhánh tích hợp đã ghim là đầu vào của quy trình deploy Medusa riêng.

Guard [validate-funnelmetry-plan.mjs](../.github/scripts/validate-funnelmetry-plan.mjs) yêu cầu ba profile CDC order v2/catalog/inventory-price, `medusa_backend: []`, `orderPlaced=DISABLED` và behavioral bindings Browser SDK/storefront. Nó từ chối planner cũ hoặc plan không còn đúng contract. Trạng thái kỹ thuật `shadow_only` trong tên/cấu hình CDC hiện hữu được giữ để tương thích slot/topic/epoch; authority phân tích là CDC current-state v2 theo Backbone DEC-142. Browser SDK và storefront search/cart tiếp tục dùng Source Ingress/Event Feed cho đến khi Gateway có cutover riêng.

## Quyền và phạm vi

- Planner checkout dùng `FUNNELMETRY_PLANNER_READ_TOKEN` với quyền đọc repo Pipeline. Package install dùng `FUNNELMETRY_PACKAGE_READ_TOKEN` nếu cần, nếu không dùng `GITHUB_TOKEN` với quyền package phù hợp. Secret không đặt trong manifest hoặc artifact.
- Propose chỉ có `contents: write` trong job cần commit; branch guard chặn `main`. Branch protection và quyền chỉnh sửa workflow cần được quản lý ở GitHub.
- CI không thiết lập PostgreSQL logical replication, publication/slot, Kafka Connect, CDC quality lease hoặc runtime secrets. Operator quản lý các phần đó theo [CDC integration](FUNNELMETRY_CDC_DEVELOPMENT.md) và tài liệu Pipeline.

Để tích hợp một source checkout mới, kiểm tra Medusa/Next version, pin installer đã duyệt, cấu hình manifest V2 và chạy Plan/Propose trên nhánh riêng. **Checkout `main` hiện thiếu `apps/storefront/src/modules/store/components/store-search/index.tsx`**, một trong năm file semantic-hook mà installer V2 yêu cầu; planner sẽ từ chối patch nếu nhánh mới chỉ lấy source từ `main`. Nhánh tích hợp hiện hành có đủ file này và đã qua kiểm tra planner. Cho lần tạo nhánh mới, dùng một base storefront tương thích hoặc mở rộng installer để sinh hook trên đúng layout của `main` trước khi chạy CI. Không copy code Funnelmetry đã sinh vào Medusa `main`.
