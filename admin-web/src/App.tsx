import { Navigate, Route, Routes } from "react-router-dom"
import { AppShell } from "@/components/AppShell"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { AuthProvider } from "@/features/auth"
import { LoginPage } from "@/pages/LoginPage"
import { SongDetailPage } from "@/pages/songs/SongDetailPage"
import { SongsPage } from "@/pages/songs/SongsPage"
import { LyricDetailPage } from "@/pages/lyrics/LyricDetailPage"
import { LyricsPage } from "@/pages/lyrics/LyricsPage"
import { SongAnalysisWorkDetailPage } from "@/pages/song-analysis-works/SongAnalysisWorkDetailPage"
import { SongAnalysisWorksPage } from "@/pages/song-analysis-works/SongAnalysisWorksPage"
import { UserDetailPage } from "@/pages/users/UserDetailPage"
import { UsersPage } from "@/pages/users/UsersPage"

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/songs" element={<SongsPage />} />
            <Route path="/songs/:songId" element={<SongDetailPage />} />
            <Route path="/lyrics" element={<LyricsPage />} />
            <Route path="/lyrics/:lyricId" element={<LyricDetailPage />} />
            <Route path="/song-analysis-works" element={<SongAnalysisWorksPage />} />
            <Route path="/song-analysis-works/:workId" element={<SongAnalysisWorkDetailPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/users/:userId" element={<UserDetailPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/songs" replace />} />
      </Routes>
    </AuthProvider>
  )
}
