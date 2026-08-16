import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import CheckoutProgress from "@modules/checkout/components/checkout-progress"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "Checkout | Northstar Goods",
}

type CheckoutPageProps = {
  searchParams: Promise<{ step?: string }>
}

export default async function Checkout({ searchParams }: CheckoutPageProps) {
  const { step } = await searchParams
  const currentStep =
    step === "delivery" || step === "payment" || step === "review"
      ? step
      : "address"
  const cart = await retrieveCart()

  if (!cart) {
    return notFound()
  }

  const customer = await retrieveCustomer()

  return (
    <div className="content-container py-10 small:py-14">
      <div className="mb-10 max-w-2xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ui-fg-muted">
          Checkout
        </p>
        <CheckoutProgress currentStep={currentStep} />
      </div>
      <div className="grid grid-cols-1 gap-y-10 small:grid-cols-[1fr_416px] small:gap-x-20">
        <PaymentWrapper cart={cart}>
          <CheckoutForm cart={cart} customer={customer} />
        </PaymentWrapper>
        <CheckoutSummary cart={cart} />
      </div>
    </div>
  )
}
