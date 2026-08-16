import { Metadata } from "next"

import Hero from "@modules/home/components/hero"
import { listCategories } from "@lib/data/categories"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductPreview from "@modules/products/components/product-preview"

export const metadata: Metadata = {
  title: "Northstar Goods",
  description: "A curated demo storefront for conversion journeys.",
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params

  const { countryCode } = params

  const [region, categories] = await Promise.all([
    getRegion(countryCode),
    listCategories({ limit: 4 }),
  ])

  if (!region) {
    return null
  }

  const {
    response: { products },
  } = await listProducts({
    regionId: region.id,
    queryParams: { limit: 4, fields: "*variants.calculated_price" },
  })

  const categoryAccents = [
    "from-[#dbe8df] to-[#9cb8a5]",
    "from-[#e8dfd3] to-[#c9a67e]",
    "from-[#d9e1ec] to-[#94a8bf]",
    "from-[#e7dce8] to-[#bf98c2]",
  ]

  return (
    <>
      <Hero />
      <section className="content-container py-16 small:py-24">
        <div className="grid gap-5 border-y border-ui-border-base py-8 small:grid-cols-3">
          {[
            ["Curated drops", "Small, considered collections."],
            ["Clear choices", "Useful details before checkout."],
            ["Built to explore", "A storefront made for discovery."],
          ].map(([title, description], index) => (
            <div key={title} className="flex gap-4 border-ui-border-base small:border-r small:pr-6 last:border-0">
              <span className="text-sm font-semibold text-ui-fg-subtle">0{index + 1}</span>
              <div>
                <h2 className="text-base font-semibold text-ui-fg-base">{title}</h2>
                <p className="mt-1 text-sm leading-6 text-ui-fg-subtle">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {categories && categories.length > 0 && (
        <section className="content-container pb-16 small:pb-24">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ui-fg-subtle">Shop by mood</p>
              <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] text-ui-fg-base">Find your everyday layer</h2>
            </div>
            <LocalizedClientLink href="/store" className="hidden text-sm font-semibold text-ui-fg-base underline underline-offset-4 small:block">View all products</LocalizedClientLink>
          </div>
          <ul className="grid gap-4 small:grid-cols-4">
            {categories.slice(0, 4).map((category, index) => (
              <li key={category.id}>
                <LocalizedClientLink href={`/categories/${category.handle}`} className="group block overflow-hidden rounded-2xl border border-ui-border-base bg-ui-bg-subtle">
                  <div className={`aspect-[4/5] bg-gradient-to-br ${categoryAccents[index % categoryAccents.length]} p-5 transition duration-500 group-hover:scale-[1.03]`}>
                    <div className="flex h-full flex-col justify-between rounded-xl border border-white/30 p-4 text-[#15241e]">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em]">Collection</span>
                      <span className="text-2xl font-medium tracking-[-0.03em]">{category.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-5 py-4 text-sm font-semibold text-ui-fg-base">
                    <span>Explore {category.name}</span>
                    <span aria-hidden="true">↗</span>
                  </div>
                </LocalizedClientLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="content-container pb-20 small:pb-32">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ui-fg-subtle">New to the edit</p>
            <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] text-ui-fg-base">Pieces worth revisiting</h2>
          </div>
          <LocalizedClientLink href="/store" className="hidden text-sm font-semibold text-ui-fg-base underline underline-offset-4 small:block">Browse the store</LocalizedClientLink>
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 small:grid-cols-4 small:gap-x-6">
          {products.map((product) => (
            <li key={product.id}>
              <ProductPreview product={product} region={region} isFeatured />
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
