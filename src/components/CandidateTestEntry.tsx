import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { mockTests, mockHiringTasks } from '../data/mockData';
import { Screen } from '../App';

interface CandidateTestEntryProps {
  testPublicId: string;
  onNavigate: (screen: Screen) => void;
}

export function CandidateTestEntry({ testPublicId, onNavigate }: CandidateTestEntryProps) {
  const [candidateName, setCandidateName] = useState('');

  // Find test by public_id
  const test = Object.values(mockTests).find((t) => t.public_id === testPublicId);
  const task = test ? mockHiringTasks.find((t) => t.id === test.hiring_task_id) : null;

  if (!test || !task) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <h2 className="mb-4">Test Not Found</h2>
          <p className="text-gray-600">This test link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim()) {
      alert('Please enter your name');
      return;
    }
    // Generate attempt ID
    const attemptId = `attempt-${Date.now()}`;
    onNavigate({
      type: 'candidate-test',
      testPublicId,
      attemptId,
      candidateName: candidateName.trim()
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-lg w-full">
        <div className="mb-6">
          <div className="inline-block px-3 py-1 bg-gray-100 rounded text-gray-600 mb-4">
            assess
          </div>
          <h2 className="mb-2">
            {test.type === 'aptitude' ? 'Aptitude' : 'Domain'} Test
          </h2>
          <p className="text-gray-600">{task.title}</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-blue-900 mb-2">About This Test</h3>
          <ul className="text-blue-800 space-y-1">
            <li>• 20 questions</li>
            <li>• {test.type === 'aptitude' ? 'General reasoning, math, and communication' : 'Domain and region-specific knowledge'}</li>
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

          <Button type="submit" className="w-full">
            Start Test
          </Button>
        </form>

        <div className="mt-6 text-center text-gray-500">
          <p>Make sure you have a stable internet connection</p>
        </div>
      </div>
    </div>
  );
}
