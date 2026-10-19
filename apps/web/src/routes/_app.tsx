import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { AppSidebar } from '@/components/app-sidebar'
import { CommandPalette } from '@/components/command-palette'
import { PasswordSetup } from '@/components/password-dialog'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { preloadAll } from '@/data/collections'
import { getSession } from '@/lib/auth'

// Everything signed-in lives under this layout. The guard is navigation UX;
// row-level security in Postgres is what actually protects the data.
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    if (!(await getSession())) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  loader: () => preloadAll(),
  pendingComponent: () => null,
  component: AppLayout,
})

function AppLayout() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <Outlet />
        </SidebarInset>
        <CommandPalette />
        <PasswordSetup />
      </SidebarProvider>
    </TooltipProvider>
  )
}
