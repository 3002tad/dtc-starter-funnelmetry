import { HttpTypes } from "@medusajs/types"
import { clx } from "@modules/common/components/ui"
import React from "react"

type OptionSelectProps = {
  option: HttpTypes.StoreProductOption
  current: string | undefined
  updateOption: (title: string, value: string) => void
  title: string
  disabled: boolean
  "data-testid"?: string
}

const OptionSelect: React.FC<OptionSelectProps> = ({
  option,
  current,
  updateOption,
  title,
  "data-testid": dataTestId,
  disabled,
}) => {
  const filteredOptions = (option.values ?? []).map((v) => v.value)

  return (
    <div className="flex flex-col gap-y-3">
      <span className="text-sm font-medium text-ui-fg-base">Select {title}</span>
      <div
        className="flex flex-wrap gap-2"
        data-testid={dataTestId}
      >
        {filteredOptions.map((v) => {
          return (
            <button
              onClick={() => updateOption(option.id, v)}
              key={v}
              className={clx(
                "min-w-16 border border-ui-border-base bg-ui-bg-base px-4 py-2 text-small-regular transition-colors duration-150",
                {
                  "border-ui-fg-base bg-ui-fg-base text-ui-bg-base": v === current,
                  "hover:border-ui-fg-base hover:shadow-elevation-card-rest":
                    v !== current,
                }
              )}
              disabled={disabled}
              data-testid="option-button"
              aria-pressed={v === current}
            >
              {v}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default OptionSelect
