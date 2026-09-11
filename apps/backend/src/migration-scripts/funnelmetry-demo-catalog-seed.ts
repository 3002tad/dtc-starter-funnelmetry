import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createProductOptionsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"

const productCount = 100
const handlePrefix = "funnelmetry-demo-"
const imageUrl =
  "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-front.png"

const categoryNames = ["Shirts", "Sweatshirts", "Pants", "Merch"]

export default async function funnelmetryDemoCatalogSeed({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

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

  const { data: productOptions } = await query.graph({
    entity: "product_option",
    fields: ["id", "title"],
  })
  let demoEditionOption = productOptions.find(
    (productOption) => productOption.title === "Funnelmetry Demo Edition"
  )

  if (!demoEditionOption) {
    const { result: createdOptions } = await createProductOptionsWorkflow(
      container
    ).run({
      input: {
        product_options: [
          {
            title: "Funnelmetry Demo Edition",
            values: ["Standard"],
          },
        ],
      },
    })
    demoEditionOption = createdOptions[0]
  }

  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name"],
  })
  const categoryByName = new Map(
    categories.map((category) => [category.name, category.id])
  )

  if (!defaultSalesChannel || !shippingProfile) {
    throw new Error(
      "Demo catalog seed requires an existing sales channel and shipping profile"
    )
  }

  const missingCategoryNames = categoryNames.filter(
    (categoryName) => !categoryByName.has(categoryName)
  )
  if (missingCategoryNames.length > 0) {
    throw new Error(
      `Demo catalog seed requires categories: ${missingCategoryNames.join(", ")}`
    )
  }

  const handles = Array.from(
    { length: productCount },
    (_, index) => `${handlePrefix}${String(index + 1).padStart(3, "0")}`
  )
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["handle"],
    filters: {
      handle: handles,
    },
  })
  const existingHandles = new Set(
    existingProducts.map((product) => product.handle)
  )

  const products = handles.flatMap((handle, index) => {
    if (existingHandles.has(handle)) {
      return []
    }

    const itemNumber = index + 1
    const categoryName = categoryNames[index % categoryNames.length]
    const categoryId = categoryByName.get(categoryName)!
    const priceInEur = 12 + (index % 10) * 3

    return [
      {
        title: `Funnelmetry Demo ${categoryName.slice(0, -1)} ${String(
          itemNumber
        ).padStart(3, "0")}`,
        handle,
        description:
          "Synthetic catalog item for Funnelmetry integration, dashboard, and workload demonstrations.",
        status: ProductStatus.PUBLISHED,
        shipping_profile_id: shippingProfile.id,
        category_ids: [categoryId],
        images: [{ url: imageUrl }],
        sales_channels: [{ id: defaultSalesChannel.id }],
        options: [{ id: demoEditionOption.id }],
        variants: [
          {
            title: "Default",
            sku: `FUNNELMETRY-DEMO-${String(itemNumber).padStart(3, "0")}`,
            manage_inventory: false,
            options: {
              "Funnelmetry Demo Edition": "Standard",
            },
            prices: [
              {
                amount: priceInEur,
                currency_code: "eur",
              },
            ],
          },
        ],
        metadata: {
          catalog_origin: "funnelmetry_demo_seed",
          seed_version: "v1",
        },
      },
    ]
  })

  if (products.length === 0) {
    logger.info("Funnelmetry demo catalog already contains 100 products.")
    return
  }

  logger.info(
    `Creating ${products.length} missing Funnelmetry demo catalog products...`
  )
  await createProductsWorkflow(container).run({
    input: {
      products,
    },
  })
  logger.info(
    `Finished Funnelmetry demo catalog seed: created ${products.length}, skipped ${productCount - products.length}.`
  )
}
