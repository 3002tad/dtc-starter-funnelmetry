# Chạy Funnelmetry API Bot trên Ubuntu

## Mục đích

Bot phát nhanh journey hoàn chỉnh ở phía source mà không cần mở trình duyệt hoặc chờ Laptop 2 chạy Pipeline:

```text
Relay:  behavior.product_viewed → cart.add_clicked → checkout.started
Medusa: create cart → add real variant → address → shipping → payment → complete cart
Backend subscriber: order.placed → medusa.order_placed
```

Các behavior event dùng cùng `anonymous_id`, `session_id` và `correlation_id`, tuân theo `IngressEvent v1`. Bot chọn product variant thật từ catalog rồi dùng Store API chính thức của Medusa để tạo đơn. Vì vậy `medusa.order_placed` được native subscriber phát từ đơn thật; bot không tự dựng business event.

`relay_queued` chỉ chứng minh Relay đã lưu behavior event bền vững. Khi Laptop 2 chưa kết nối, behavior event tiếp tục nằm trong spool của Relay; đây chưa phải receipt `accepted` từ Pipeline. Tương tự, việc tạo được order chứng minh native `order.placed` đã được kích hoạt ở Medusa, nhưng chưa chứng minh Pipeline đã nhận business event. Báo cáo đánh dấu phần này là `deferred_until_pipeline_private_ingress_is_available`.

## Chạy bằng container trên server

Bot là one-shot container thuộc Compose profile `funnelmetry-test`; nó không chạy cùng runtime thông thường và tự bị xoá sau mỗi lượt test. Container gọi Medusa qua Docker network bằng `http://backend:9000`, còn behavior event đi qua public Relay để kiểm tra đúng đường Cloudflare đang triển khai.

File `runtime/server.env` hiện dùng để build storefront phải có hai public credential sau:

```bash
cd /home/ntd/dtc-starter-funnelmetry

grep -E '^(NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY|NEXT_PUBLIC_FUNNELMETRY_BROWSER_WRITE_KEY)=' runtime/server.env \
  | sed 's/=.*/=<configured>/'
```

Không in giá trị thật của write key vào log. Build image bot không cần GitHub Packages token vì image chỉ copy script Node thuần:

```bash
docker compose --env-file runtime/server.env \
  -f runtime/docker-compose.yml \
  --profile funnelmetry-test \
  build funnelmetry-api-bot
```

Chạy 10 journey hoàn chỉnh rồi tự xoá container:

```bash
docker compose --env-file runtime/server.env \
  -f runtime/docker-compose.yml \
  --profile funnelmetry-test \
  run --rm --no-deps funnelmetry-api-bot \
  --mode full --journeys 10 --concurrency 2 --step-delay-ms 20
```

`--no-deps` giữ nguyên các container Medusa đang chạy và không recreate backend. Bot mặc định tự chọn product variant thật. Nếu muốn giới hạn product được sử dụng, truyền product ID hoặc handle:

```bash
docker compose --env-file runtime/server.env \
  -f runtime/docker-compose.yml \
  --profile funnelmetry-test \
  run --rm --no-deps funnelmetry-api-bot \
  --mode full --journeys 10 --concurrency 2 \
  --product-ids "prod_01,medusa-sweatshirt"
```

Chỉ kiểm tra Relay và không tạo order thật:

```bash
docker compose --env-file runtime/server.env \
  -f runtime/docker-compose.yml \
  --profile funnelmetry-test \
  run --rm --no-deps funnelmetry-api-bot \
  --mode behavior --journeys 100 --concurrency 10
```

Trong mode `behavior`, nếu không có `--product-ids`, bot dùng ID tổng hợp `api-bot-product-1`. Mọi behavior event do bot tạo đều có `source_metadata.synthetic=true` để không lẫn với traffic người dùng thật.

## Đọc kết quả

Kết quả cuối gồm số journey thành công/thất bại, tổng event được Relay queue, số Medusa order thực sự được tạo, retry, throughput và latency p50/p95/max. Trong trạng thái hiện tại, `upstream_state_at_start` có thể là `waiting_for_upstream`; đây là trạng thái mong đợi khi Laptop 2 chưa sẵn sàng.

Muốn xem từng receipt:

```bash
node tools/funnelmetry-api-bot.mjs --journeys 3 --concurrency 1 --verbose
```

Chạy test cục bộ của bot, không cần Relay thật:

```bash
node --test tools/funnelmetry-api-bot.test.mjs
```

Lệnh Node trực tiếp chỉ dành cho phát triển. Luồng demo/triển khai chuẩn trên Ubuntu dùng container ở trên, nên host không cần cài Node hoặc pnpm.
