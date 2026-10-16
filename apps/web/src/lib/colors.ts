import type { LabelColor } from '@/data/schemas'

// Static class names so Tailwind can see them. The tokens live in styles.css
// and have light and dark values.
export const colorClasses: Record<LabelColor, { chip: string; dot: string }> = {
  blue: { chip: 'bg-label-blue text-label-blue-foreground', dot: 'bg-label-blue-foreground' },
  purple: {
    chip: 'bg-label-purple text-label-purple-foreground',
    dot: 'bg-label-purple-foreground',
  },
  teal: { chip: 'bg-label-teal text-label-teal-foreground', dot: 'bg-label-teal-foreground' },
  red: { chip: 'bg-label-red text-label-red-foreground', dot: 'bg-label-red-foreground' },
  amber: {
    chip: 'bg-label-amber text-label-amber-foreground',
    dot: 'bg-label-amber-foreground',
  },
  green: {
    chip: 'bg-label-green text-label-green-foreground',
    dot: 'bg-label-green-foreground',
  },
  gray: { chip: 'bg-label-gray text-label-gray-foreground', dot: 'bg-label-gray-foreground' },
}

export const colorNames: Record<LabelColor, string> = {
  blue: 'Blue',
  purple: 'Purple',
  teal: 'Teal',
  red: 'Red',
  amber: 'Amber',
  green: 'Green',
  gray: 'Gray',
}
