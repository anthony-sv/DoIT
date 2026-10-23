import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

/**
 * Someone on a board, as the first two letters of their email. `label` names
 * it for screen readers ("Assigned to …"); without one it's decoration next
 * to text that already says who.
 */
export function PersonAvatar({
  email,
  label,
  size = 'sm',
  className,
}: {
  email: string
  label?: string
  /** xs (20px) fits a small select, a table cell or a sticky note's footer. */
  size?: 'xs' | 'sm' | 'default'
  className?: string
}) {
  return (
    <Avatar
      size={size === 'xs' ? 'sm' : size}
      // The sm size comes from a data-size rule, which a plain size-5 loses to.
      className={cn(size === 'xs' && 'data-[size=sm]:size-5', className)}
      title={label ?? email}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <AvatarFallback className="uppercase">{email.slice(0, 2)}</AvatarFallback>
    </Avatar>
  )
}
