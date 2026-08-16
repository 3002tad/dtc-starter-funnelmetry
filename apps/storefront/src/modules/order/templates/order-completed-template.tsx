import { Button, Heading } from "@modules/common/components/ui"

import CartTotals from "@modules/common/components/cart-totals"
import Help from "@modules/order/components/help"
import Items from "@modules/order/components/items"
import OrderDetails from "@modules/order/components/order-details"
import ShippingDetails from "@modules/order/components/shipping-details"
import PaymentDetails from "@modules/order/components/payment-details"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type OrderCompletedTemplateProps = {
  order: HttpTypes.StoreOrder
}

export default async function OrderCompletedTemplate({
  order,
}: OrderCompletedTemplateProps) {
  return (
    <div className="min-h-[calc(100vh-64px)] py-10 small:py-16">
      <div className="content-container flex h-full w-full max-w-4xl flex-col items-center justify-center gap-y-10">
        <div
          className="flex h-full w-full max-w-4xl flex-col gap-6 rounded-lg border border-ui-border-base bg-ui-bg-base p-6 small:p-10"
          data-testid="order-complete-container"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ui-fg-muted">
            Order confirmed
          </p>
          <Heading
            level="h1"
            className="mb-2 flex flex-col gap-y-3 text-3xl text-ui-fg-base"
          >
            <span>Thank you for your order.</span>
            <span>Your reference order has been placed successfully.</span>
          </Heading>
          <OrderDetails order={order} />
          <LocalizedClientLink href="/store" className="w-full small:w-fit">
            <Button className="h-12 w-full small:w-auto">Continue shopping</Button>
          </LocalizedClientLink>
          <Heading level="h2" className="flex flex-row text-3xl-regular">
            Order summary
          </Heading>
          <Items order={order} />
          <CartTotals totals={order} />
          <ShippingDetails order={order} />
          <PaymentDetails order={order} />
          <Help />
        </div>
      </div>
    </div>
  )
}
