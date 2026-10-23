import type { LabelColor } from '@/data/schemas'

// Static class names so Tailwind can see them. The tokens live in styles.css
// and have light and dark values. `card` tints a whole card (or sticky note):
// body and muted text keep at least 4.5:1 on every tint, in both themes.
export const colorClasses: Record<LabelColor, { chip: string; dot: string; card: string }> = {
  blue: {
    chip: 'bg-label-blue text-label-blue-foreground',
    dot: 'bg-label-blue-foreground',
    card: 'border-label-blue-foreground/25 bg-label-blue',
  },
  purple: {
    chip: 'bg-label-purple text-label-purple-foreground',
    dot: 'bg-label-purple-foreground',
    card: 'border-label-purple-foreground/25 bg-label-purple',
  },
  teal: {
    chip: 'bg-label-teal text-label-teal-foreground',
    dot: 'bg-label-teal-foreground',
    card: 'border-label-teal-foreground/25 bg-label-teal',
  },
  red: {
    chip: 'bg-label-red text-label-red-foreground',
    dot: 'bg-label-red-foreground',
    card: 'border-label-red-foreground/25 bg-label-red',
  },
  amber: {
    chip: 'bg-label-amber text-label-amber-foreground',
    dot: 'bg-label-amber-foreground',
    card: 'border-label-amber-foreground/25 bg-label-amber',
  },
  green: {
    chip: 'bg-label-green text-label-green-foreground',
    dot: 'bg-label-green-foreground',
    card: 'border-label-green-foreground/25 bg-label-green',
  },
  gray: {
    chip: 'bg-label-gray text-label-gray-foreground',
    dot: 'bg-label-gray-foreground',
    card: 'border-label-gray-foreground/25 bg-label-gray',
  },
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
