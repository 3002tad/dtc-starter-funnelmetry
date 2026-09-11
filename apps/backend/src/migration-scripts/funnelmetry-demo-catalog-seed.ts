import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  MedusaError,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createProductOptionsWorkflow,
  createProductsWorkflow,
  updateProductVariantsWorkflow,
} from "@medusajs/medusa/core-flows"

const productCount = 100
const handlePrefix = "funnelmetry-catalog-"
const catalogSourceUrl =
  "https://dummyjson.com/products?limit=100&select=id,title,description,category,price,thumbnail,images,brand"
const catalogSourceName = "DummyJSON Products API"
const sourcePriceToEurRate = 0.92

type CatalogSourceProduct = {
  id: number
  title: string
  description: string
  category: string
  price: number
  thumbnail: string
  images: string[]
  brand?: string
}

type CatalogSourceResponse = {
  products: CatalogSourceProduct[]
}

const priceInEur = (sourcePrice: number) =>
  Number((sourcePrice * sourcePriceToEurRate).toFixed(2))

async function loadCatalogSource(): Promise<CatalogSourceProduct[]> {
  const response = await fetch(catalogSourceUrl)

  if (!response.ok) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Could not load catalog source: ${response.status}`
    )
  }

  const catalog = (await response.json()) as CatalogSourceResponse
  const products = catalog.products.filter(
    (product) =>
      Number.isInteger(product.id) &&
      product.title &&
      product.description &&
      product.price > 0 &&
      (product.images?.length > 0 || product.thumbnail)
  )

  if (products.length !== productCount) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Catalog source must provide exactly ${productCount} usable products, received ${products.length}`
    )
  }

  return products
}

export default async function funnelmetryDemoCatalogSeed({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const catalogSourceProducts = await loadCatalogSource()

  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })
  const defaultSalesChannel = salesChannels.find(
    (salesChannel) => salesChannel.name === "Default Sales Channel"
  )

  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "name"],
  })
  const shippingProfile = shippingProfiles[0]

  if (!defaultSalesChannel || !shippingProfile) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Catalog seed requires an existing sales channel and shipping profile"
    )
  }

  const { data: productOptions } = await query.graph({
    entity: "product_option",
    fields: ["id", "title"],
  })
  let catalogEditionOptionId = productOptions.find(
    (productOption) => productOption.title === "Funnelmetry Catalog Edition"
  )?.id

  if (!catalogEditionOptionId) {
    const { result: createdOptions } = await createProductOptionsWorkflow(
      container
    ).run({
      input: {
        product_options: [
          {
            title: "Funnelmetry Catalog Edition",
            values: ["Standard"],
          },
        ],
      },
    })
    catalogEditionOptionId = createdOptions[0]?.id
  }

  if (!catalogEditionOptionId) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Could not resolve the Funnelmetry catalog product option"
    )
  }

  const handles = catalogSourceProducts.map(
    (product) => `${handlePrefix}${product.id}`
  )
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["handle", "variants.id"],
    filters: {
      handle: handles,
    },
  })
  const existingHandles = new Set(
    existingProducts.map((product) => product.handle)
  )

  const sourceProductByHandle = new Map(
    catalogSourceProducts.map((product) => [
      `${handlePrefix}${product.id}`,
      product,
    ])
  )
  const existingVariantUpdates = existingProducts.flatMap((product) => {
    const sourceProduct = sourceProductByHandle.get(product.handle)

    if (!sourceProduct) {
      return []
    }

    return (product.variants ?? []).map((variant) => ({
      id: variant.id,
      prices: [
        {
          amount: priceInEur(sourceProduct.price),
          currency_code: "eur",
        },
      ],
    }))
  })

  if (existingVariantUpdates.length > 0) {
    logger.info(
      `Updating prices for ${existingVariantUpdates.length} existing catalog variants...`
    )
    await updateProductVariantsWorkflow(container).run({
      input: {
        product_variants: existingVariantUpdates,
      },
    })
  }

  const products = catalogSourceProducts.flatMap((sourceProduct) => {
    const handle = `${handlePrefix}${sourceProduct.id}`

    if (existingHandles.has(handle)) {
      return []
    }

    const imageUrls = sourceProduct.images.length
      ? sourceProduct.images
      : [sourceProduct.thumbnail]
    return [
      {
        title: sourceProduct.title,
        handle,
        description: sourceProduct.description,
        status: ProductStatus.PUBLISHED,
        shipping_profile_id: shippingProfile.id,
        images: imageUrls.map((url) => ({ url })),
        sales_channels: [{ id: defaultSalesChannel.id }],
        options: [{ id: catalogEditionOptionId }],
        variants: [
          {
            title: "Standard",
            sku: `FMC-${String(sourceProduct.id).padStart(3, "0")}`,
            manage_inventory: false,
            options: {
              "Funnelmetry Catalog Edition": "Standard",
            },
            prices: [
              {
                amount: priceInEur(sourceProduct.price),
                currency_code: "eur",
              },
            ],
          },
        ],
        metadata: {
          catalog_origin: "funnelmetry_demo_seed",
          seed_version: "v2",
          source_name: catalogSourceName,
          source_product_id: sourceProduct.id,
          source_category: sourceProduct.category,
          source_brand: sourceProduct.brand ?? null,
          source_price_amount: sourceProduct.price,
          source_price_currency: "USD",
          seed_price_currency: "EUR",
          seed_price_conversion_rate: sourcePriceToEurRate,
        },
      },
    ]
  })

  if (products.length === 0) {
    logger.info("Funnelmetry catalog already contains all 100 source products.")
    return
  }

  logger.info(
    `Creating ${products.length} missing products from ${catalogSourceName}...`
  )
  await createProductsWorkflow(container).run({
    input: {
      products,
    },
  })
  logger.info(
    `Finished catalog seed: created ${products.length}, skipped ${productCount - products.length}.`
  )
}
