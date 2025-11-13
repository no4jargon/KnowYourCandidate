import { useState } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { EmployerDashboard } from './components/EmployerDashboard';
import { CreateHiringTaskScreen } from './components/CreateHiringTaskScreen';
import { HiringTaskDetailScreen } from './components/HiringTaskDetailScreen';
import { TestEditorScreen } from './components/TestEditorScreen';
import { CandidateTestEntry } from './components/CandidateTestEntry';
import { CandidateTestTaking } from './components/CandidateTestTaking';
import { ThankYouScreen } from './components/ThankYouScreen';

export type Screen = 
  | { type: 'login' }
  | { type: 'dashboard' }
  | { type: 'create-task' }
  | { type: 'task-detail'; taskId: string }
  | { type: 'test-editor'; testId: string; testType: 'aptitude' | 'domain' }
  | { type: 'candidate-entry'; testPublicId: string }
  | { type: 'candidate-test'; testPublicId: string; attemptId: string; candidateName: string }
  | { type: 'thank-you' };

export default function App() {
  // Check if URL contains candidate test route
  const hash = window.location.hash;
  const candidateMatch = hash.match(/#\/t\/([^\/]+)/);
  
  const [currentScreen, setCurrentScreen] = useState<Screen>(
    candidateMatch 
      ? { type: 'candidate-entry', testPublicId: candidateMatch[1] }
      : { type: 'login' }
  );
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const navigate = (screen: Screen) => {
    setCurrentScreen(screen);
  };

  const handleLogin = () => {
    setIsLoggedIn(true);
    navigate({ type: 'dashboard' });
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    navigate({ type: 'login' });
  };

  if (currentScreen.type === 'login') {
    return <LoginScreen onLogin={handleLogin} />;
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
            <span className="text-gray-500 hidden md:inline">Acme Corp</span>
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