import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Screen } from '../App';
import { getTestByPublicId, startOrResumeAttempt } from '../api/tests';
import { getHiringTask } from '../api/hiringTasks';
import { HiringTask, Test } from '../types';

interface CandidateTestEntryProps {
  testPublicId: string;
  onNavigate: (screen: Screen) => void;
}

export function CandidateTestEntry({ testPublicId, onNavigate }: CandidateTestEntryProps) {
  const [candidateName, setCandidateName] = useState('');
  const [test, setTest] = useState<Test | null>(null);
  const [task, setTask] = useState<HiringTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getTestByPublicId(testPublicId)
      .then((fetchedTest) => {
        if (cancelled) return;
        setTest(fetchedTest);
        return getHiringTask(fetchedTest.hiring_task_id);
      })
      .then((fetchedTask) => {
        if (cancelled) return;
        setTask(fetchedTask ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to load test details');
        setTest(null);
        setTask(null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [testPublicId]);

  useEffect(() => {
    if (startError) {
      setStartError(null);
    }
  }, [candidateName, startError]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <h2 className="mb-4">Loading Test…</h2>
          <p className="text-gray-600">Please wait while we prepare your assessment.</p>
        </div>
      </div>
    );
  }

  if (error || !test || !task) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <h2 className="mb-4">Test Not Found</h2>
          <p className="text-gray-600">{error ?? 'This test link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim()) {
      alert('Please enter your name');
      return;
    }
    if (!test) {
      setStartError('Test is unavailable. Please refresh and try again.');
      return;
    }

    setStartError(null);
    setIsStarting(true);
    try {
      const session = await startOrResumeAttempt(testPublicId, {
        candidateName: candidateName.trim()
      });
      onNavigate({
        type: 'candidate-test',
        testPublicId,
        attemptId: session.attempt.id,
        candidateName: session.attempt.candidate_name
      });
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Unable to start test');
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-lg w-full">
        <div className="mb-6">
          <div className="inline-block px-3 py-1 bg-gray-100 rounded text-gray-600 mb-4">
            assess
          </div>
          <h2 className="mb-2">{test.kind === 'aptitude' ? 'Aptitude' : 'Domain'} Test</h2>
          <p className="text-gray-600">{task.title}</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-blue-900 mb-2">About This Test</h3>
          <ul className="text-blue-800 space-y-1">
            <li>• 20 questions</li>
            <li>• {test.kind === 'aptitude' ? 'General reasoning, math, and communication' : 'Domain and region-specific knowledge'}</li>
            <li>• AI-assisted but evaluated objectively</li>
            <li>• Your answers are autosaved as you progress</li>
          </ul>
        </div>

        <form onSubmit={handleStart} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter your full name"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              required
              autoFocus
            />
            <p className="text-gray-500">
              This will be used to identify your test results
            </p>
          </div>

          {startError && <p className="text-sm text-red-600">{startError}</p>}

          <Button type="submit" className="w-full" disabled={isStarting}>
            {isStarting ? 'Preparing…' : 'Start Test'}
          </Button>
        </form>

        <div className="mt-6 text-center text-gray-500">
          <p>Make sure you have a stable internet connection</p>
        </div>
      </div>
    </div>
  );
}
