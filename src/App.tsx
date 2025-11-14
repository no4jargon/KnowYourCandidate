import { useCallback, useEffect, useState } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { EmployerDashboard } from './components/EmployerDashboard';
import { CreateHiringTaskScreen } from './components/CreateHiringTaskScreen';
import { HiringTaskDetailScreen } from './components/HiringTaskDetailScreen';
import { TestEditorScreen } from './components/TestEditorScreen';
import { CandidateTestEntry } from './components/CandidateTestEntry';
import { CandidateTestTaking } from './components/CandidateTestTaking';
import { ThankYouScreen } from './components/ThankYouScreen';
import { EmployerSession, fetchSession, logout as apiLogout } from './api/auth';

export type Screen =
  | { type: 'login' }
  | { type: 'dashboard' }
  | { type: 'create-task' }
  | { type: 'task-detail'; taskId: string }
  | { type: 'test-editor'; testId: string; testType: 'aptitude' | 'domain' }
  | { type: 'candidate-entry'; testPublicId: string }
  | { type: 'candidate-test'; testPublicId: string; attemptId: string; candidateName: string }
  | { type: 'thank-you' };

const employerScreens = new Set<Screen['type']>(['dashboard', 'create-task', 'task-detail', 'test-editor']);
const candidateScreens = new Set<Screen['type']>(['candidate-entry', 'candidate-test', 'thank-you']);

function screenRequiresAuth(screen: Screen) {
  return employerScreens.has(screen.type);
}

function isCandidateScreen(screen: Screen) {
  return candidateScreens.has(screen.type);
}

export default function App() {
  // Check if URL contains candidate test route
  const hash = window.location.hash;
  const candidateMatch = hash.match(/#\/t\/([^\/]+)/);

  const [currentScreen, setCurrentScreen] = useState<Screen>(
    candidateMatch
      ? { type: 'candidate-entry', testPublicId: candidateMatch[1] }
      : { type: 'login' }
  );
  const [session, setSession] = useState<EmployerSession | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const navigate = useCallback(
    (screen: Screen) => {
      if (screenRequiresAuth(screen) && !session) {
        setCurrentScreen({ type: 'login' });
        return;
      }
      setCurrentScreen(screen);
    },
    [session]
  );

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const refreshed = await fetchSession();
        if (cancelled) {
          return;
        }
        setSession(refreshed);
        if (refreshed) {
          setCurrentScreen((prev) => (prev.type === 'login' ? { type: 'dashboard' } : prev));
        } else {
          setCurrentScreen((prev) => (screenRequiresAuth(prev) ? { type: 'login' } : prev));
        }
      } catch (error) {
        console.error('Failed to refresh employer session', error);
        if (!cancelled) {
          setSession(null);
          setCurrentScreen((prev) => (screenRequiresAuth(prev) ? { type: 'login' } : prev));
        }
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setCurrentScreen((prev) => (screenRequiresAuth(prev) ? { type: 'login' } : prev));
    }
  }, [session]);

  const handleLogin = (newSession: EmployerSession) => {
    setSession(newSession);
    setCurrentScreen({ type: 'dashboard' });
  };

  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error('Failed to end employer session', error);
    } finally {
      setSession(null);
      setCurrentScreen({ type: 'login' });
    }
  };

  if (isInitializing && !isCandidateScreen(currentScreen)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
        Checking session…
      </div>
    );
  }

  if (currentScreen.type === 'login') {
    return <LoginScreen onAuthenticated={handleLogin} />;
  }

  if (currentScreen.type === 'candidate-entry') {
    return <CandidateTestEntry testPublicId={currentScreen.testPublicId} onNavigate={navigate} />;
  }

  if (currentScreen.type === 'candidate-test') {
    return (
      <CandidateTestTaking
        testPublicId={currentScreen.testPublicId}
        attemptId={currentScreen.attemptId}
        candidateName={currentScreen.candidateName}
        onNavigate={navigate}
      />
    );
  }

  if (currentScreen.type === 'thank-you') {
    return <ThankYouScreen />;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Side Navigation */}
      <aside className="hidden md:flex md:w-64 bg-white border-r border-gray-200 flex-col">
        <div className="p-6">
          <h1 className="tracking-tight">assess</h1>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <button
            onClick={() => navigate({ type: 'dashboard' })}
            className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
              currentScreen.type === 'dashboard'
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Hiring Tasks
          </button>
          <button
            className="w-full text-left px-4 py-2 rounded-lg text-gray-400 cursor-not-allowed"
            disabled
          >
            Settings
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="md:hidden tracking-tight">assess</h1>
            <span className="text-gray-500 hidden md:inline">{session?.name ?? 'Employer'}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-600">AC</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Screen Content */}
        <main className="flex-1 overflow-auto">
          {currentScreen.type === 'dashboard' && (
            <EmployerDashboard onNavigate={navigate} />
          )}
          {currentScreen.type === 'create-task' && (
            <CreateHiringTaskScreen onNavigate={navigate} />
          )}
          {currentScreen.type === 'task-detail' && (
            <HiringTaskDetailScreen taskId={currentScreen.taskId} onNavigate={navigate} />
          )}
          {currentScreen.type === 'test-editor' && (
            <TestEditorScreen
              testId={currentScreen.testId}
              testType={currentScreen.testType}
              onNavigate={navigate}
            />
          )}
        </main>
      </div>
    </div>
  );
}