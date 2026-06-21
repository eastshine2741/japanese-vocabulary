import * as React from "react"
import { adminApi } from "@/api/client"

const STORAGE_KEY = "kotonoha.admin.token"

type AuthContextValue = {
  token: string | null
  login(password: string): Promise<void>
  logout(): void
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = React.useState<string | null>(() => sessionStorage.getItem(STORAGE_KEY))

  const login = React.useCallback(async (password: string) => {
    const response = await adminApi.login(password)
    sessionStorage.setItem(STORAGE_KEY, response.token)
    setToken(response.token)
  }, [])

  const logout = React.useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    setToken(null)
  }, [])

  const value = React.useMemo(() => ({ token, login, logout }), [login, logout, token])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = React.useContext(AuthContext)
  if (!value) throw new Error("useAuth must be used inside AuthProvider")
  return value
}
