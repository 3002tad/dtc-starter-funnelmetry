import { clx } from "@modules/common/components/ui"

const steps = [
  { id: "address", label: "Address" },
  { id: "delivery", label: "Delivery" },
  { id: "payment", label: "Payment" },
  { id: "review", label: "Review" },
] as const

type CheckoutStep = (typeof steps)[number]["id"]

type CheckoutProgressProps = {
  currentStep: CheckoutStep
}

const CheckoutProgress = ({ currentStep }: CheckoutProgressProps) => {
  const activeIndex = steps.findIndex((step) => step.id === currentStep)

  return (
    <ol
      className="grid grid-cols-4 gap-x-2"
      aria-label="Checkout progress"
      data-testid="checkout-progress"
    >
      {steps.map((step, index) => {
        const isCurrent = step.id === currentStep
        const isComplete = index < activeIndex

        return (
          <li key={step.id} className="flex min-w-0 flex-col gap-y-2">
            <span
              className={clx("h-1 w-full rounded-full bg-ui-border-base", {
                "bg-ui-fg-base": isCurrent || isComplete,
              })}
            />
            <span
              className={clx("truncate text-xs font-medium text-ui-fg-muted", {
                "text-ui-fg-base": isCurrent,
              })}
              aria-current={isCurrent ? "step" : undefined}
            >
              {index + 1}. {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default CheckoutProgress
