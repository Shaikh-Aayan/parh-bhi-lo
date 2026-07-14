import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { ToastProvider } from './lib/ToastContext';
import { Loader2 } from 'lucide-react';

import Layout from './components/Layout';
import Login from './pages/Login';
import Feed from './pages/Feed';
import Stats from './pages/Stats';
import Settings from './pages/Settings';
import PostArticle from './pages/PostArticle';
import Wall from './pages/Wall';
import Chat from './pages/Chat';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Feed />} />
              <Route path="post" element={<PostArticle />} />
              <Route path="stats" element={<Stats />} />
              <Route path="settings" element={<Settings />} />
              <Route path="wall" element={<Wall />} />
              <Route path="chat" element={<Chat />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
