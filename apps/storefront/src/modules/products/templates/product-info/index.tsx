import { HttpTypes } from "@medusajs/types"
import { Heading, Text } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
}

const ProductInfo = ({ product }: ProductInfoProps) => {
  return (
    <section id="product-info" aria-labelledby="product-title">
      <div className="flex flex-col gap-y-5 lg:max-w-[500px] mx-auto">
        {product.collection && (
          <LocalizedClientLink
            href={`/collections/${product.collection.handle}`}
            className="text-xs font-semibold uppercase tracking-[0.16em] text-ui-fg-muted hover:text-ui-fg-base"
          >
            {product.collection.title}
          </LocalizedClientLink>
        )}
        <Heading
          level="h2"
          className="text-3xl leading-tight text-ui-fg-base small:text-4xl"
          data-testid="product-title"
        >
          {product.title}
        </Heading>

        {product.description && (
          <Text
            className="text-medium leading-7 text-ui-fg-subtle whitespace-pre-line"
            data-testid="product-description"
          >
            {product.description}
          </Text>
        )}
      </div>
    </section>
  )
}

export default ProductInfo
