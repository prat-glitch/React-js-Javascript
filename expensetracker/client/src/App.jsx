import { useState, useEffect } from "react";
import Navbar from "./components/Navbar.jsx";
import Dashboard from "./components/Dashboard.jsx";
import AllTransactions from "./components/AllTransactions.jsx";
import Profile from "./components/Profile.jsx";
import ProfileOverview from "./components/ProfileOverview.jsx";
import Budget from "./components/Budget.jsx";
import Auth from "./components/Auth.jsx";
import Sidebar, { MobileHeader, MobileOverlay } from "./components/Sidebar.jsx";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useTheme } from "./context/ThemeContext.jsx";
import { useAuth } from "./context/AuthContext.jsx";

// Splash Screen Component
const SplashScreen = ({ onComplete }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onComplete, 400);
    }, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-100 flex items-center justify-center bg-white transition-opacity duration-400 ${isExiting ? 'animate-fade-out' : ''}`}>
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-slate-100 rounded-full blur-3xl opacity-60" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-slate-50 rounded-full blur-3xl opacity-80" />
      </div>

      {/* Content */}
      <div className="relative flex flex-col items-center">
        {/* Logo */}
        <div className="relative animate-scale-in">
          {/* Pulse rings */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-2xl bg-slate-900/5 animate-pulse-ring" style={{ animationDelay: '0s' }} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-2xl bg-slate-900/5 animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
          </div>
          
          {/* Main logo */}
          <div className="w-20 h-20 rounded-2xl bg-slate-900 flex items-center justify-center shadow-2xl shadow-slate-900/20 animate-float">
            <span className="text-white text-3xl font-black">₹</span>
          </div>
        </div>

        {/* App Name */}
        <div className="mt-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            ExpenseTrack
          </h1>
        </div>

        {/* Tagline */}
        <div className="mt-2 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <p className="text-sm text-slate-400 font-medium">
            Smart money management
          </p>
        </div>

        {/* Loading indicator */}
        <div className="mt-8 animate-slide-up" style={{ animationDelay: '0.6s' }}>
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0.15s' }} />
            <div className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  const { isDarkMode } = useTheme();
  const { isAuthenticated, loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [appReady, setAppReady] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSplashComplete = () => {
    setShowSplash(false);
    setTimeout(() => setAppReady(true), 100);
  };
 
  // Show splash screen while checking auth
  if (loading || showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-slate-900' : 'bg-[#fafafa]'}`}>
      <BrowserRouter>
        {isAuthenticated && (
          <>
            <MobileHeader 
              isMobileMenuOpen={isMobileMenuOpen} 
              setIsMobileMenuOpen={setIsMobileMenuOpen} 
            />
            <MobileOverlay 
              isMobileMenuOpen={isMobileMenuOpen} 
              setIsMobileMenuOpen={setIsMobileMenuOpen} 
            />
            <Sidebar 
              isMobileMenuOpen={isMobileMenuOpen} 
              setIsMobileMenuOpen={setIsMobileMenuOpen} 
            />
          </>
        )}
        <Routes>
          {/* Public route */}
          <Route 
            path="/login" 
            element={isAuthenticated ? <Navigate to="/" replace /> : <Auth isDarkMode={isDarkMode} />} 
          />
          
          {/* Protected routes */}
          <Route 
            path="/" 
            element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />} 
          />
          <Route 
            path="/all-transactions" 
            element={isAuthenticated ? <AllTransactions /> : <Navigate to="/login" replace />} 
          />
          <Route 
            path="/budget" 
            element={isAuthenticated ? <Budget /> : <Navigate to="/login" replace />} 
          />
          <Route 
            path="/profile" 
            element={isAuthenticated ? <ProfileOverview /> : <Navigate to="/login" replace />} 
          />
          <Route 
            path="/settings" 
            element={isAuthenticated ? <Profile /> : <Navigate to="/login" replace />} 
          />
          
          {/* Catch all - redirect to login or home based on auth */}
          <Route 
            path="*" 
            element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />} 
          />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
