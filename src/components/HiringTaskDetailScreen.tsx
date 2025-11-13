import { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { mockHiringTasks, mockCandidateResults, mockTests, mockInterviewScript } from '../data/mockData';
import { Screen } from '../App';
import { ArrowLeft, Copy, FileText, Check } from 'lucide-react';
import { CandidateResult } from '../types';

interface HiringTaskDetailScreenProps {
  taskId: string;
  onNavigate: (screen: Screen) => void;
}

export function HiringTaskDetailScreen({ taskId, onNavigate }: HiringTaskDetailScreenProps) {
  const task = mockHiringTasks.find((t) => t.id === taskId);
  const candidateResults = mockCandidateResults[taskId] || [];
  const [editingScores, setEditingScores] = useState<{ [key: string]: CandidateResult }>(
    Object.fromEntries(candidateResults.map((c) => [c.candidate_name, { ...c }]))
  );
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  if (!task) {
    return <div className="p-8">Task not found</div>;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTimestamp = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleScoreChange = (candidateName: string, field: keyof CandidateResult, value: number) => {
    setEditingScores((prev) => ({
      ...prev,
      [candidateName]: {
        ...prev[candidateName],
        [field]: value
      }
    }));
  };

  const handleCopyLink = (testType: 'aptitude' | 'domain') => {
    const publicId = testType === 'aptitude' ? 'pub-apt-1' : 'pub-dom-1';
    const link = `${window.location.origin}/t/${publicId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(testType);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const generateTest = (testType: 'aptitude' | 'domain') => {
    alert(`Generating ${testType} test... This would call the AI service.`);
    onNavigate({ type: 'dashboard' });
  };

  // Calculate leaderboards
  const aptitudeLeaderboard = [...candidateResults]
    .filter((c) => c.aptitude_taken_at)
    .sort((a, b) => {
      if (b.aptitude_score !== a.aptitude_score) {
        return b.aptitude_score - a.aptitude_score;
      }
      const aOtherScores = a.domain_score + a.interview_score;
      const bOtherScores = b.domain_score + b.interview_score;
      if (bOtherScores !== aOtherScores) {
        return bOtherScores - aOtherScores;
      }
      return new Date(a.aptitude_taken_at!).getTime() - new Date(b.aptitude_taken_at!).getTime();
    });

  const domainLeaderboard = [...candidateResults]
    .filter((c) => c.domain_taken_at)
    .sort((a, b) => {
      if (b.domain_score !== a.domain_score) {
        return b.domain_score - a.domain_score;
      }
      const aOtherScores = a.aptitude_score + a.interview_score;
      const bOtherScores = b.aptitude_score + b.interview_score;
      if (bOtherScores !== aOtherScores) {
        return bOtherScores - aOtherScores;
      }
      return new Date(a.domain_taken_at!).getTime() - new Date(b.domain_taken_at!).getTime();
    });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <button
        onClick={() => onNavigate({ type: 'dashboard' })}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      {/* Task Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="mb-2">{task.title}</h2>
            <div className="flex items-center gap-3 text-gray-600">
              <span>{formatDate(task.created_at)}</span>
              <span>•</span>
              <Badge variant="secondary">
                {task.job_description_facets.location} · {task.job_description_facets.work_type}
              </Badge>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-gray-900 mb-2">Job Description</h4>
            <div className="bg-gray-50 rounded border border-gray-200 p-4 max-h-48 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-gray-700">{task.job_description_raw}</pre>
            </div>
          </div>

          <details className="group">
            <summary className="cursor-pointer text-gray-700 hover:text-gray-900 list-none flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>View JD Facets</span>
            </summary>
            <div className="mt-2 bg-gray-50 rounded border border-gray-200 p-4 overflow-x-auto">
              <pre className="text-gray-700" style={{ fontFamily: 'monospace' }}>
                {JSON.stringify(task.job_description_facets, null, 2)}
              </pre>
            </div>
          </details>
        </div>
      </div>

      {/* Test Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Aptitude Test Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-900">Aptitude Test</h3>
            <Badge variant={task.has_aptitude_test ? 'default' : 'secondary'}>
              {task.has_aptitude_test ? 'Generated' : 'Not Created'}
            </Badge>
          </div>
          <p className="text-gray-600 mb-6">
            20 questions: general reasoning, math/data, communication
          </p>
          <div className="space-y-2">
            {task.has_aptitude_test ? (
              <>
                <Button
                  className="w-full"
                  onClick={() =>
                    onNavigate({ type: 'test-editor', testId: 'test-apt-1', testType: 'aptitude' })
                  }
                >
                  View and Edit
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => handleCopyLink('aptitude')}
                >
                  {copiedLink === 'aptitude' ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Candidate Link
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button className="w-full" onClick={() => generateTest('aptitude')}>
                Generate Aptitude Test
              </Button>
            )}
          </div>
        </div>

        {/* Domain Test Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-900">Domain Test</h3>
            <Badge variant={task.has_domain_test ? 'default' : 'secondary'}>
              {task.has_domain_test ? 'Generated' : 'Not Created'}
            </Badge>
          </div>
          <p className="text-gray-600 mb-6">
            20 questions: domain and region specific knowledge
          </p>
          <div className="space-y-2">
            {task.has_domain_test ? (
              <>
                <Button
                  className="w-full"
                  onClick={() =>
                    onNavigate({ type: 'test-editor', testId: 'test-dom-1', testType: 'domain' })
                  }
                >
                  View and Edit
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => handleCopyLink('domain')}
                >
                  {copiedLink === 'domain' ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Candidate Link
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button className="w-full" onClick={() => generateTest('domain')}>
                Generate Domain Test
              </Button>
            )}
          </div>
        </div>

        {/* Interview Script Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-900">Interview Script</h3>
            <Badge variant={task.has_interview_script ? 'default' : 'secondary'}>
              {task.has_interview_script ? 'Generated' : 'Not Created'}
            </Badge>
          </div>
          <p className="text-gray-600 mb-6">
            10-15 minute structured interview questions
          </p>
          <div className="space-y-2">
            {task.has_interview_script ? (
              <Button className="w-full" onClick={() => alert('Interview script viewer would open')}>
                View Interview Script
              </Button>
            ) : (
              <Button className="w-full" onClick={() => alert('Generating interview script...')}>
                Generate Interview Script
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Candidate Results */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Tabs defaultValue="candidates" className="w-full">
          <div className="border-b border-gray-200 px-6">
            <TabsList className="bg-transparent">
              <TabsTrigger value="candidates">Candidate Table</TabsTrigger>
              <TabsTrigger value="leaderboards">Leaderboards</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="candidates" className="p-6 m-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-600">Candidate Name</th>
                    <th className="px-4 py-3 text-left text-gray-600">Aptitude Taken</th>
                    <th className="px-4 py-3 text-left text-gray-600">Aptitude Score</th>
                    <th className="px-4 py-3 text-left text-gray-600">Domain Taken</th>
                    <th className="px-4 py-3 text-left text-gray-600">Domain Score</th>
                    <th className="px-4 py-3 text-left text-gray-600">Interview Score</th>
                    <th className="px-4 py-3 text-left text-gray-600">Overall</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {candidateResults.map((candidate) => {
                    const editing = editingScores[candidate.candidate_name];
                    return (
                      <tr key={candidate.candidate_name}>
                        <td className="px-4 py-3 text-gray-900">{candidate.candidate_name}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {formatTimestamp(candidate.aptitude_taken_at)}
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min="0"
                            max="20"
                            value={editing.aptitude_score}
                            onChange={(e) =>
                              handleScoreChange(
                                candidate.candidate_name,
                                'aptitude_score',
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-20"
                          />
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {formatTimestamp(candidate.domain_taken_at)}
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min="0"
                            max="20"
                            value={editing.domain_score}
                            onChange={(e) =>
                              handleScoreChange(
                                candidate.candidate_name,
                                'domain_score',
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-20"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min="0"
                            max="20"
                            value={editing.interview_score}
                            onChange={(e) =>
                              handleScoreChange(
                                candidate.candidate_name,
                                'interview_score',
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-20"
                          />
                        </td>
                        <td className="px-4 py-3 text-gray-900">
                          {editing.aptitude_score + editing.domain_score + editing.interview_score}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="leaderboards" className="p-6 m-0">
            <Tabs defaultValue="aptitude" className="w-full">
              <TabsList>
                <TabsTrigger value="aptitude">Aptitude Leaderboard</TabsTrigger>
                <TabsTrigger value="domain">Domain Leaderboard</TabsTrigger>
                <TabsTrigger value="interview">Interview Leaderboard</TabsTrigger>
              </TabsList>

              <TabsContent value="aptitude" className="mt-4">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-gray-600">Rank</th>
                        <th className="px-4 py-3 text-left text-gray-600">Candidate</th>
                        <th className="px-4 py-3 text-left text-gray-600">Aptitude Score</th>
                        <th className="px-4 py-3 text-left text-gray-600">Domain Score</th>
                        <th className="px-4 py-3 text-left text-gray-600">Interview Score</th>
                        <th className="px-4 py-3 text-left text-gray-600">Completed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {aptitudeLeaderboard.map((candidate, index) => (
                        <tr key={candidate.candidate_name}>
                          <td className="px-4 py-3 text-gray-900">#{index + 1}</td>
                          <td className="px-4 py-3 text-gray-900">{candidate.candidate_name}</td>
                          <td className="px-4 py-3 text-gray-900">{candidate.aptitude_score}/20</td>
                          <td className="px-4 py-3 text-gray-600">{candidate.domain_score}/20</td>
                          <td className="px-4 py-3 text-gray-600">{candidate.interview_score}/20</td>
                          <td className="px-4 py-3 text-gray-600">
                            {formatTimestamp(candidate.aptitude_taken_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="domain" className="mt-4">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-gray-600">Rank</th>
                        <th className="px-4 py-3 text-left text-gray-600">Candidate</th>
                        <th className="px-4 py-3 text-left text-gray-600">Domain Score</th>
                        <th className="px-4 py-3 text-left text-gray-600">Aptitude Score</th>
                        <th className="px-4 py-3 text-left text-gray-600">Interview Score</th>
                        <th className="px-4 py-3 text-left text-gray-600">Completed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {domainLeaderboard.map((candidate, index) => (
                        <tr key={candidate.candidate_name}>
                          <td className="px-4 py-3 text-gray-900">#{index + 1}</td>
                          <td className="px-4 py-3 text-gray-900">{candidate.candidate_name}</td>
                          <td className="px-4 py-3 text-gray-900">{candidate.domain_score}/20</td>
                          <td className="px-4 py-3 text-gray-600">{candidate.aptitude_score}/20</td>
                          <td className="px-4 py-3 text-gray-600">{candidate.interview_score}/20</td>
                          <td className="px-4 py-3 text-gray-600">
                            {formatTimestamp(candidate.domain_taken_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="interview" className="mt-4">
                <div className="text-center py-8 text-gray-500">
                  No interview scores recorded yet
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
