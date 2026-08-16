import { Heading, Text } from "@modules/common/components/ui"

import InteractiveLink from "@modules/common/components/interactive-link"

const EmptyCartMessage = () => {
  return (
    <div className="flex flex-col items-start justify-center px-2 py-32" data-testid="empty-cart-message">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ui-fg-muted">
        Your shopping bag
      </p>
      <Heading
        level="h1"
        className="flex flex-row text-3xl-regular gap-x-2 items-baseline"
      >
        Your cart is ready when you are
      </Heading>
      <Text className="text-base-regular mt-4 mb-6 max-w-[32rem]">
        Browse the Northstar Goods edit, choose a product, and return here when
        you are ready to continue to checkout.
      </Text>
      <div>
        <InteractiveLink href="/store">Explore products</InteractiveLink>
      </div>
    </div>
  )
}

export default EmptyCartMessage
