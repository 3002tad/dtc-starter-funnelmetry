# Chạy Funnelmetry API Bot trên Source host

## Mục đích

Bot tạo journey nhanh ở phía Source mà không cần trình duyệt hoặc Pipeline đang
online:

```text
Source Ingress smoke: behavior.product_viewed → cart.add_clicked → checkout.started
Medusa: create cart → add real variant → address → shipping → payment → complete cart
Backend subscriber: order.placed → medusa.order_placed → Source Ingress
```

Behavior event dùng cùng `anonymous_id`, `session_id` và `correlation_id`, tuân
theo `IngressEvent v1`. Full mode tạo order bằng Store API của Medusa, vì vậy
business fact vẫn do native `order.placed` subscriber phát; bot không tự dựng
`medusa.order_placed`.

Bot chỉ chứng minh **Source durable acceptance**: mỗi receipt có
`accepted|duplicate`, `event_feed_id` từ readiness và `ingress_seq`. Nó không
chứng minh Pipeline đã pull, Kafka đã durable-publish hay canonical analytics
đã cập nhật. Những bước đó thuộc acceptance của Pipeline Source Connector.

## Chạy bằng container trên server

Bot thuộc Compose profile `funnelmetry-test`, là one-shot container và tự bị
xóa sau mỗi lượt. Container gọi Medusa qua `http://backend:9000`, behavior
event đi qua public Source Ingress/Cloudflare theo đúng đường browser reference.

`runtime/server.env` phải có các credential/configuration cần thiết nhưng không
được in giá trị thật:

```bash
cd /home/ntd/dtc-starter-funnelmetry
grep -E '^(NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY|NEXT_PUBLIC_FUNNELMETRY_BROWSER_WRITE_KEY|FUNNELMETRY_SOURCE_INGRESS_URL)=' runtime/server.env \
  | sed 's/=.*/=<configured>/'
```

Build bot:

```bash
docker compose --env-file runtime/server.env \
  -f runtime/docker-compose.yml \
  --profile funnelmetry-test \
  build funnelmetry-api-bot
```

Chạy 10 journey đầy đủ:

```bash
docker compose --env-file runtime/server.env \
  -f runtime/docker-compose.yml \
  --profile funnelmetry-test \
  run --rm --no-deps funnelmetry-api-bot \
  --mode full --journeys 10 --concurrency 2 --step-delay-ms 20
```

`--no-deps` không recreate Medusa. Nếu cần giới hạn product, truyền product ID
hoặc handle bằng `--product-ids`.

Chỉ kiểm tra Source Ingress behavior, không tạo order:

```bash
docker compose --env-file runtime/server.env \
  -f runtime/docker-compose.yml \
  --profile funnelmetry-test \
  run --rm --no-deps funnelmetry-api-bot \
  --mode behavior --journeys 100 --concurrency 10
```

Trong mode `behavior`, event có `source_metadata.synthetic=true` để không lẫn
với traffic thật.

## Đọc kết quả

Summary trả số journey, `events_source_accepted`, event feed lineage tại thời
điểm bắt đầu, số Medusa order, retry, throughput và latency. Thành công ở đây
không cho phép claim end-to-end analytics; Pipeline phải pull `/v1/events` với
Bearer credential riêng và chứng minh Kafka/canonical downstream theo contract.

Chạy unit test local không cần server:

```bash
node --test tools/funnelmetry-api-bot.test.mjs
```
