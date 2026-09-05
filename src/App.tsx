import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Calendar } from './pages/Calendar'
import { Syllabus } from './pages/Syllabus'
import { Log } from './pages/Log'
import { Exams } from './pages/Exams'
import { Dashboard } from './pages/Dashboard'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/syllabus" element={<Syllabus />} />
          <Route path="/log" element={<Log />} />
          <Route path="/exams" element={<Exams />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>

        <Route path="/" element={<Navigate to="/calendar" replace />} />
        <Route path="*" element={<Navigate to="/calendar" replace />} />
      </Routes>
    </AuthProvider>
  )
}
