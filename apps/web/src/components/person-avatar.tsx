import { Avatar, AvatarFallback } from '@/components/ui/avatar'

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
  size?: 'sm' | 'default'
  className?: string
}) {
  return (
    <Avatar
      size={size}
      className={className}
      title={label ?? email}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <AvatarFallback className="uppercase">{email.slice(0, 2)}</AvatarFallback>
    </Avatar>
  )
}
