import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginScreen } from './pages/LoginScreen';
import { HomeScreen } from './pages/HomeScreen';
import { FinanceScreen } from './pages/FinanceScreen';
import { PeriodScreen } from './pages/PeriodScreen';
import { GymScreen } from './pages/GymScreen';
import { FoodScreen } from './pages/FoodScreen';
import { WellnessScreen } from './pages/WellnessScreen';
import { GoalsScreen } from './pages/GoalsScreen';
import { DebtsScreen } from './pages/DebtsScreen';
import { ProfileScreen } from './pages/ProfileScreen';
import { TravelScreen } from './pages/TravelScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { UserPreferencesProvider } from './context/UserPreferencesContext';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-pink-50 text-pink-500 font-bold animate-pulse">Cargando App Nia... 🌸</div>;
  if (!user) return <Navigate to="/" />;
  return <>{children}</>;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <UserPreferencesProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LoginScreen />} />
              <Route element={<Layout />}>
                <Route path="/home" element={<ProtectedRoute><HomeScreen /></ProtectedRoute>} />
                <Route path="/finance" element={<ProtectedRoute><FinanceScreen /></ProtectedRoute>} />
                <Route path="/period" element={<ProtectedRoute><PeriodScreen /></ProtectedRoute>} />
                <Route path="/gym" element={<ProtectedRoute><GymScreen /></ProtectedRoute>} />
                <Route path="/food" element={<ProtectedRoute><FoodScreen /></ProtectedRoute>} />
                <Route path="/wellness" element={<ProtectedRoute><WellnessScreen /></ProtectedRoute>} />
                <Route path="/goals" element={<ProtectedRoute><GoalsScreen /></ProtectedRoute>} />
                <Route path="/debts" element={<ProtectedRoute><DebtsScreen /></ProtectedRoute>} />
                <Route path="/travel" element={<ProtectedRoute><TravelScreen /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfileScreen /></ProtectedRoute>} />
              </Route>
              <Route path="*" element={
                <div className="flex flex-col items-center justify-center min-h-screen text-center bg-slate-50 dark:bg-[#1a0d10] dark:text-slate-200">
                  <h1 className="text-6xl mb-4">😿</h1>
                  <h2 className="text-xl font-bold">Página no encontrada</h2>
                  <a href="/home" className="text-pink-500 font-bold mt-4 underline">Volver al inicio</a>
                </div>
              } />
            </Routes>
          </BrowserRouter>
        </UserPreferencesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
