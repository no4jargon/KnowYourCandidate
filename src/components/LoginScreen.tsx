import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { login, EmployerSession } from '../api/auth';

interface LoginScreenProps {
  onAuthenticated: (session: EmployerSession) => void;
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const session = await login(email, password);
      onAuthenticated(session);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to log in right now.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="mb-8 text-center">
            <h1 className="mb-2">Assess</h1>
            <p className="text-gray-600">AI-assisted hiring assessment tool</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Login'}
            </Button>
          </form>

          <div className="mt-6 space-y-2 text-center">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <p className="text-gray-500">v0 · single employer account · built for quick hiring reviews</p>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              Demo login: <span className="text-gray-900">employer@acme.com</span> / <span className="text-gray-900">password123</span>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center space-y-2">
          <div>
            <a href="#" className="text-gray-500 hover:text-gray-700">
              Privacy
            </a>
          </div>
          <div className="text-gray-400">
            <p>Want the public flow? <a href="#/t/pub-apt-1" className="text-blue-600 hover:underline">Open the seeded aptitude test</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}