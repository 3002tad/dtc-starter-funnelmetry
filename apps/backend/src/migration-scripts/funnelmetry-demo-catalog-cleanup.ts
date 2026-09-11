import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { deleteProductsWorkflow } from "@medusajs/medusa/core-flows"

const productCount = 100
const handlePrefix = "funnelmetry-demo-"

export default async function funnelmetryDemoCatalogCleanup({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const handles = Array.from(
    { length: productCount },
    (_, index) => `${handlePrefix}${String(index + 1).padStart(3, "0")}`
  )

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: {
      handle: handles,
    },
  })

  if (products.length === 0) {
    logger.info("No Funnelmetry demo catalog products found to remove.")
    return
  }

  await deleteProductsWorkflow(container).run({
    input: {
      ids: products.map((product) => product.id),
    },
  })
  logger.info(`Removed ${products.length} Funnelmetry demo catalog products.`)
}
