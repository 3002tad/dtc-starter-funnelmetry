"use client"

import { FormEvent, useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { trackSearchSubmitted } from "@funnelmetry/client"

type StoreSearchProps = {
  initialQuery?: string
}

const StoreSearch = ({ initialQuery = "" }: StoreSearchProps) => {
  const [query, setQuery] = useState(initialQuery)
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => setQuery(initialQuery), [initialQuery])

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedQuery = query.trim()
    void trackSearchSubmitted(normalizedQuery.length)

    const params = new URLSearchParams(searchParams.toString())
    params.delete("page")
    if (normalizedQuery) params.set("q", normalizedQuery)
    else params.delete("q")

    const queryString = params.toString()
    router.push(queryString ? `${pathname}?${queryString}` : pathname)
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-xl gap-2" role="search">
      <label className="sr-only" htmlFor="store-search">Search products</label>
      <input
        id="store-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search the collection"
        className="min-w-0 flex-1 rounded-full border border-ui-border-base bg-white px-4 py-2 text-sm text-ui-fg-base outline-none transition focus:border-ui-fg-base"
      />
      <button
        type="submit"
        className="rounded-full bg-ui-fg-base px-5 py-2 text-sm font-semibold text-ui-bg-base transition hover:opacity-90"
      >
        Search
      </button>
    </form>
  )
}

export default StoreSearch
