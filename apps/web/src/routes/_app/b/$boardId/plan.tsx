import { createFileRoute } from '@tanstack/react-router'
import { PlanView } from '@/components/plan/plan-view'

export const Route = createFileRoute('/_app/b/$boardId/plan')({
  head: () => ({ meta: [{ title: 'Backlog & sprints · DoIT' }] }),
  component: PlanPage,
})

function PlanPage() {
  const { boardId } = Route.useParams()
  return <PlanView boardId={boardId} />
}
