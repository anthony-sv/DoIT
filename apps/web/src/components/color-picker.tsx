import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { type LabelColor, labelColors } from '@/data/schemas'
import { colorClasses, colorNames } from '@/lib/colors'
import { cn } from '@/lib/utils'

export function ColorPicker({
  value,
  onChange,
}: {
  value: LabelColor
  onChange: (color: LabelColor) => void
}) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(next) => {
        // Single choice: ignore clicks that would clear it.
        const color = labelColors.find((c) => c === next[0])
        if (color) onChange(color)
      }}
      spacing={1}
    >
      {labelColors.map((color) => (
        <ToggleGroupItem
          key={color}
          value={color}
          size="sm"
          aria-label={colorNames[color]}
          title={colorNames[color]}
          className="data-pressed:ring-2 data-pressed:ring-ring"
        >
          <span className={cn('size-3.5 rounded-full', colorClasses[color].dot)} />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
