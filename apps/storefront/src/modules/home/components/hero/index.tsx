import LocalizedClientLink from "@modules/common/components/localized-client-link"

const Hero = () => {
  return (
    <section className="relative overflow-hidden border-b border-ui-border-base bg-[#10231d] text-white">
      <div className="absolute -right-24 -top-32 h-[32rem] w-[32rem] rounded-full bg-[#d8e5bc]/20 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full border border-white/10" />
      <div className="content-container relative grid min-h-[620px] items-center gap-16 py-20 small:grid-cols-[1.15fr_0.85fr] small:py-28">
        <div className="max-w-2xl">
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.24em] text-[#d8e5bc]">
            Northstar Goods / Spring edit
          </p>
          <h1 className="max-w-xl text-5xl font-medium leading-[1.02] tracking-[-0.04em] small:text-7xl">
            Everyday goods, chosen with intent.
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-white/70 small:text-lg">
            A considered selection of wardrobe essentials for the moments that
            make up your day.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <LocalizedClientLink href="/categories/shirts" className="rounded-full bg-[#d8e5bc] px-6 py-3 text-sm font-semibold text-[#10231d] transition hover:bg-white">
              Shop the edit
            </LocalizedClientLink>
            <LocalizedClientLink href="/store" className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10">
              Explore all products
            </LocalizedClientLink>
          </div>
        </div>

        <div className="justify-self-end rounded-[2rem] border border-white/15 bg-white/10 p-6 backdrop-blur small:p-8">
          <div className="flex aspect-[4/5] w-full max-w-sm flex-col justify-between rounded-[1.35rem] bg-[#d8e5bc] p-6 text-[#10231d] small:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">The everyday edit</p>
            <div>
              <p className="text-4xl font-medium leading-none tracking-[-0.05em]">Built for the<br />in-between.</p>
              <p className="mt-5 max-w-[16rem] text-sm leading-6 text-[#10231d]/70">Simple layers, useful details and a little more room to live.</p>
            </div>
            <div className="flex items-center justify-between border-t border-[#10231d]/15 pt-4 text-xs font-semibold uppercase tracking-[0.14em]">
              <span>New arrivals</span>
              <span>01 / 04</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero
