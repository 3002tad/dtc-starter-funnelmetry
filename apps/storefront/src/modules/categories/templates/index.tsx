import { notFound } from "next/navigation"
import { Suspense } from "react"

import InteractiveLink from "@modules/common/components/interactive-link"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import { OptionValueIds } from "@lib/util/product-option-filters"

export default function CategoryTemplate({
  category,
  sortBy,
  page,
  countryCode,
  optionValueIds,
}: {
  category: HttpTypes.StoreProductCategory
  sortBy?: SortOptions
  page?: string
  countryCode: string
  optionValueIds?: OptionValueIds
}) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  if (!category || !countryCode) notFound()

  const parents = [] as HttpTypes.StoreProductCategory[]

  const getParents = (category: HttpTypes.StoreProductCategory) => {
    if (category.parent_category) {
      parents.push(category.parent_category)
      getParents(category.parent_category)
    }
  }

  getParents(category)

  return (
    <div
      className="content-container flex flex-col gap-8 py-10 small:flex-row small:items-start small:gap-12 small:py-16"
      data-testid="category-container"
    >
      <RefinementList
        sortBy={sort}
        data-testid="sort-by-container"
        hideOptionsPicker
      />
      <div className="w-full">
        <div className="mb-10 border-b border-ui-border-base pb-8">
          {parents.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-x-2 text-sm text-ui-fg-subtle">
              {parents.map((parent) => (
                <span key={parent.id}>
                  <LocalizedClientLink className="hover:text-ui-fg-base" href={`/categories/${parent.handle}`} data-testid="sort-by-link">
                    {parent.name}
                  </LocalizedClientLink>
                  <span className="ml-2">/</span>
                </span>
              ))}
            </div>
          )}
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ui-fg-subtle">Collection</p>
          <h1 className="mt-3 text-4xl font-medium tracking-[-0.03em] text-ui-fg-base" data-testid="category-page-title">{category.name}</h1>
          {category.description && (
            <p className="mt-3 max-w-xl text-sm leading-6 text-ui-fg-subtle">{category.description}</p>
          )}
        </div>
        {category.category_children && (
          <div className="mb-10">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ui-fg-subtle">Explore within {category.name}</p>
            <ul className="flex flex-wrap gap-2">
              {category.category_children?.map((c) => (
                <li key={c.id}>
                  <InteractiveLink href={`/categories/${c.handle}`}>
                    {c.name}
                  </InteractiveLink>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Suspense
          fallback={
            <SkeletonProductGrid
              numberOfProducts={category.products?.length ?? 8}
            />
          }
        >
          <PaginatedProducts
            sortBy={sort}
            page={pageNumber}
            categoryId={category.id}
            countryCode={countryCode}
            optionValueIds={optionValueIds}
          />
        </Suspense>
      </div>
    </div>
  )
}
