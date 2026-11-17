import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { WorklistPage } from './pages/WorklistPage';
import { ViewerPage } from './pages/ViewerPage';
import { UploadPage } from './pages/UploadPage';
import { PerformancePage } from './pages/PerformancePage';
import { SimulationPage } from './pages/SimulationPage';
import { AuditPage } from './pages/AuditPage';
import { LoginPage } from './pages/LoginPage';
import { PersistentFooter } from './components/PersistentFooter';
import { ShortcutModal } from './components/ShortcutModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getAuthToken, clearAuthToken, api } from './services/api';

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<{ name: string; role: string } | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      api.getCurrentUser()
        .then(u => setCurrentUser(u))
        .catch(() => {
          clearAuthToken();
          navigate('/login');
        });
    } else if (location.pathname !== '/login') {
      navigate('/login');
    }
  }, [location.pathname]);

  // Global '?' key listener for shortcuts modal
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '?') {
        setShowShortcuts(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  if (location.pathname === '/login') {
    return <>{children}</>;
  }

  const navItems = [
    { path: '/', label: 'WORKLIST', badge: null },
    { path: '/upload', label: 'UPLOAD', badge: 'DICOM' },
    { path: '/performance', label: 'METRICS', badge: 'AUROC' },
    { path: '/simulation', label: 'SIMULATION', badge: 'FIFO' },
    { path: '/audit', label: 'AUDIT LOG', badge: null },
  ];

  const handleSignOut = () => {
    clearAuthToken();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0B0E11] text-[#E6EBEF]">
      {/* Top Main Work Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar (PRD Section 12.6 Slim Nav) */}
        <aside className="w-48 bg-[#12171B] border-r border-[#26303A] flex flex-col justify-between p-3 select-none flex-shrink-0 z-40">
          <div className="space-y-5">
            {/* Wordmark (PRD Section 12.5 Signature Element 8) */}
            <div className="px-2 pt-1">
              <div className="flex items-center gap-1.5 font-mono-num font-bold tracking-tight text-[15px] text-[#E6EBEF]">
                <span>CXR</span>
                <span className="text-[#8E9AF0]">·</span>
                <span>TRIAGE</span>
              </div>
              <div className="text-[9px] font-mono-num text-[#66727D] tracking-wider uppercase mt-0.5">
                READING ROOM WORKSTATION
              </div>
            </div>

            {/* Navigation links */}
            <nav className="space-y-1">
              {navItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-[2px] font-mono-num text-[11px] font-medium transition-colors ${
                      isActive
                        ? 'bg-[#1A2127] text-[#8E9AF0] border-l-2 border-[#8E9AF0]'
                        : 'text-[#9AA7B2] hover:bg-[#1A2127] hover:text-[#E6EBEF]'
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="text-[8px] px-1 py-0.2 bg-[#0B0E11] text-[#66727D] rounded-[1px] border border-[#26303A]">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Bottom Session Info & Actions */}
          <div className="space-y-2 border-t border-[#26303A] pt-3 font-mono-num text-[10px]">
            {/* Active User Pill */}
            <div className="px-2 py-1.5 bg-[#1A2127] rounded-[2px] border border-[#26303A] space-y-0.5">
              <div className="text-[#66727D] flex justify-between">
                <span>ROLE:</span>
                <span className="text-[#4FB3A5] font-semibold">{currentUser?.role || 'Radiologist'}</span>
              </div>
              <div className="text-[#E6EBEF] truncate">{currentUser?.name || 'Dr. Alex Rivera'}</div>
            </div>

            <div className="flex items-center justify-between px-1 text-[#66727D]">
              <button
                onClick={() => setShowShortcuts(true)}
                className="hover:text-[#E6EBEF] flex items-center gap-1"
                title="Keyboard Shortcuts"
              >
                <kbd className="px-1 bg-[#0B0E11] border border-[#26303A] rounded-[2px] text-[#9AA7B2]">?</kbd>
                <span>KEYS</span>
              </button>

              <button
                onClick={handleSignOut}
                className="hover:text-[#FF4D4F] transition-colors"
                title="Sign out of current role"
              >
                LOGOUT
              </button>
            </div>
          </div>
        </aside>

        {/* Content Outlet */}
        <main className="flex-1 flex overflow-hidden min-w-0">
          {children}
        </main>
      </div>

      {/* Mandatory Persistent Clinical Footer (PRD Section 10) */}
      <PersistentFooter />

      {/* Keyboard Shortcut Modal Sheet */}
      <ShortcutModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<WorklistPage />} />
            <Route path="/study/:id" element={<ViewerPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/performance" element={<PerformancePage />} />
            <Route path="/simulation" element={<SimulationPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
