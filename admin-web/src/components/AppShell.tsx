import { Activity, Disc3, FileText, LogOut, Users } from "lucide-react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/songs", label: "Songs", icon: Disc3 },
  { to: "/lyrics", label: "Lyrics", icon: FileText },
  { to: "/song-analysis-works", label: "Analysis Work", icon: Activity },
  { to: "/users", label: "Users", icon: Users },
]

export function AppShell() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <header className="sticky top-0 z-20 border-b border-[#d9e1ea] bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#18212f] text-sm font-semibold text-white">
              K
            </div>
            <div className="text-sm font-semibold text-[#18212f]">Kotonoha Admin</div>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              logout()
              navigate("/login")
            }}
            aria-label="Log out"
            title="Log out"
            size="icon"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 md:grid-cols-[192px_1fr]">
        <nav className="border-b border-[#d9e1ea] bg-white px-2 py-2 md:min-h-[calc(100vh-56px)] md:border-b-0 md:border-r">
          <div className="flex gap-1 md:flex-col">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "focus-ring flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-[#42526b]",
                    isActive ? "bg-[#e6fffb] text-[#0f766e]" : "hover:bg-[#eef2f6]",
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
        <main className="min-w-0 px-4 py-5 md:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
