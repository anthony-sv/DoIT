import { useMemo } from 'react'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { boardMembersCollection, profilesCollection } from '@/data/collections'
import type { Board, BoardMember } from '@/data/schemas'
import { currentUserId } from '@/lib/auth'

/** Every email this user may see (their own, and everyone on a shared board), by user id. */
export function useEmails(): Map<string, string> {
  const { data: profiles } = useLiveQuery((q) => q.from({ profile: profilesCollection }))
  return useMemo(() => new Map(profiles.map((p) => [p.id, p.email])), [profiles])
}

export interface BoardPerson {
  userId: string
  email: string
  isOwner: boolean
  isYou: boolean
  /** The membership row; null for the owner. */
  member: BoardMember | null
}

/** The owner first, then members in the order they were added. */
export function useBoardPeople(board: Board): BoardPerson[] {
  const emails = useEmails()
  const { data: members } = useLiveQuery(
    (q) =>
      q
        .from({ member: boardMembersCollection })
        .where(({ member }) => eq(member.board_id, board.id))
        .orderBy(({ member }) => member.created_at),
    [board.id],
  )
  const you = currentUserId()
  return useMemo(() => {
    const person = (userId: string, member: BoardMember | null): BoardPerson => ({
      userId,
      email: emails.get(userId) ?? 'Unknown account',
      isOwner: member === null,
      isYou: userId === you,
      member,
    })
    return [person(board.owner_id, null), ...members.map((m) => person(m.user_id, m))]
  }, [board.owner_id, members, emails, you])
}
