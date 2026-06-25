import * as React from "react"
import { KeyRound } from "lucide-react"
import { Navigate, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/features/auth"

export function LoginPage() {
  const { token, login } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  if (token) return <Navigate to="/songs" replace />

  return (
    <div className="grid min-h-screen place-items-center bg-[#f6f7f9] px-4">
      <form
        className="w-full max-w-sm border border-[#d9e1ea] bg-white p-6 shadow-sm"
        onSubmit={async (event) => {
          event.preventDefault()
          setSubmitting(true)
          setError(false)
          try {
            await login(password)
            navigate("/songs")
          } catch {
            setError(true)
          } finally {
            setSubmitting(false)
          }
        }}
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#18212f] text-white">
            <KeyRound className="h-4 w-4" />
          </div>
          <h1 className="text-xl font-semibold tracking-normal text-[#18212f]">Kotonoha Admin</h1>
        </div>
        <label className="mb-2 block text-sm font-medium text-[#42526b]" htmlFor="password">
          Password
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error ? <p className="mt-3 text-sm text-[#991b1b]">Authentication failed.</p> : null}
        <Button className="mt-5 w-full" type="submit" disabled={submitting || !password}>
          {submitting ? "Signing in" : "Sign in"}
        </Button>
      </form>
    </div>
  )
}
