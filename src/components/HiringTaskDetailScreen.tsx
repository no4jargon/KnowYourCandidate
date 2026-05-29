import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Screen } from '../App';
import { ArrowLeft, Copy, FileText, Check } from 'lucide-react';
import { CandidateResult, HiringTask, InterviewScript, Test } from '../types';
import {
  getHiringTask,
  getCandidateResults,
  updateCandidateResult
} from '../api/hiringTasks';
import { getInterviewScript, generateInterviewScriptArtifact } from '../api/interviewScripts';
import { generateTestArtifact, getTest } from '../api/tests';

interface HiringTaskDetailScreenProps {
  taskId: string;
  onNavigate: (screen: Screen) => void;
}

export function HiringTaskDetailScreen({ taskId, onNavigate }: HiringTaskDetailScreenProps) {
  const [task, setTask] = useState<HiringTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidateResults, setCandidateResults] = useState<CandidateResult[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(true);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [editingScores, setEditingScores] = useState<{ [key: string]: CandidateResult }>({});
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [tests, setTests] = useState<{ aptitude?: Test; domain?: Test }>({});
  const [testsLoading, setTestsLoading] = useState(false);
  const [testsError, setTestsError] = useState<string | null>(null);
  const [generatingTest, setGeneratingTest] = useState<'aptitude' | 'domain' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [interviewScript, setInterviewScript] = useState<InterviewScript | null>(null);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [generatingInterviewScript, setGeneratingInterviewScript] = useState(false);

  useEffect(() => {
    setEditingScores(
      Object.fromEntries(candidateResults.map((c) => [c.candidate_name, { ...c }]))
    );
  }, [candidateResults]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getHiringTask(taskId)
      .then((response) => {
        if (!cancelled) {
          setTask(response);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load task');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  useEffect(() => {
    let cancelled = false;
    setCandidateLoading(true);
    setCandidateError(null);
    getCandidateResults(taskId)
      .then((results) => {
        if (!cancelled) {
          setCandidateResults(results);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCandidateError(err instanceof Error ? err.message : 'Unable to load results');
          setCandidateResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCandidateLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  useEffect(() => {
    if (!task) {
      setTests({});
      return;
    }

    const shouldFetch = Boolean(task.aptitude_test_id || task.domain_test_id);
    if (!shouldFetch) {
      setTests({});
      return;
    }

    let cancelled = false;
    setTestsLoading(true);
    setTestsError(null);

    const requests: Promise<{ kind: 'aptitude' | 'domain'; test: Test }>[] = [];
    if (task.aptitude_test_id) {
      requests.push(
        getTest(task.aptitude_test_id).then((fetched) => ({ kind: 'aptitude' as const, test: fetched }))
      );
    }
    if (task.domain_test_id) {
      requests.push(
        getTest(task.domain_test_id).then((fetched) => ({ kind: 'domain' as const, test: fetched }))
      );
    }

    Promise.all(requests)
      .then((fetched) => {
        if (cancelled) {
          return;
        }
        const next: { aptitude?: Test; domain?: Test } = {};
        for (const item of fetched) {
          next[item.kind] = item.test;
        }
        setTests(next);
      })
      .catch((err) => {
        if (!cancelled) {
          setTestsError(err instanceof Error ? err.message : 'Unable to load tests');
          setTests({});
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTestsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [task?.aptitude_test_id, task?.domain_test_id]);

  if (isLoading) {
    return <div className="p-8">Loading task details…</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-red-600">
        <button
          onClick={() => onNavigate({ type: 'dashboard' })}
          className="mb-4 underline"
        >
          Back to Dashboard
        </button>
        {error}
      </div>
    );
  }

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
    const clampedValue = Number.isFinite(value) ? Math.max(0, Math.min(20, value)) : 0;
    setEditingScores((prev) => ({
      ...prev,
      [candidateName]: {
        ...prev[candidateName],
        [field]: clampedValue
      }
    }));
  };

  const handleCopyLink = (testType: 'aptitude' | 'domain') => {
    const selectedTest = testType === 'aptitude' ? tests.aptitude : tests.domain;
    if (!selectedTest) {
      setActionError('Generate the test to create a shareable link.');
      return;
    }
    const link = `${window.location.origin}/#/t/${selectedTest.public_id}`;
    navigator.clipboard.writeText(link);
    setActionError(null);
    setCopiedLink(testType);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleGenerateTest = async (testType: 'aptitude' | 'domain') => {
    if (!task) return;
    setGeneratingTest(testType);
    setActionError(null);
    try {
      const response = await generateTestArtifact(task.id, testType);
      setTests((prev) => ({ ...prev, [testType]: response.test }));
      setTask((prev) => {
        if (response.task) {
          return response.task;
        }
        if (!prev) {
          return prev;
        }
        const next: HiringTask = {
          ...prev,
          ...(testType === 'aptitude'
            ? { has_aptitude_test: true, aptitude_test_id: response.test.id }
            : { has_domain_test: true, domain_test_id: response.test.id })
        };
        return next;
      });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : `Unable to generate ${testType} test right now.`
      );
    } finally {
      setGeneratingTest(null);
    }
  };

  const handleViewInterviewScript = async () => {
    if (!task?.interview_script_id) {
      setActionError('Generate the interview script first.');
      return;
    }

    setInterviewDialogOpen(true);
    setInterviewLoading(true);
    setActionError(null);
    try {
      const script = await getInterviewScript(task.interview_script_id);
      setInterviewScript(script);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to load interview script.');
      setInterviewScript(null);
    } finally {
      setInterviewLoading(false);
    }
  };

  const handleGenerateInterviewScript = async () => {
    if (!task) {
      return;
    }

    setGeneratingInterviewScript(true);
    setActionError(null);
    try {
      const script = await generateInterviewScriptArtifact(task.id);
      setInterviewScript(script);
      setTask((prev) =>
        prev
          ? {
              ...prev,
              has_interview_script: true,
              interview_script_id: script.id,
              stats: {
                ...prev.stats,
                interview: {
                  ...(prev.stats?.interview || {}),
                  script_id: script.id
                }
              }
            }
          : prev
      );
      setInterviewDialogOpen(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to generate interview script.');
    } finally {
      setGeneratingInterviewScript(false);
    }
  };

  const handleScoreSave = async (
    candidateName: string,
    field: 'aptitude_score' | 'domain_score' | 'interview_score'
  ) => {
    if (!task) {
      return;
    }
    const entry = editingScores[candidateName];
    if (!entry) {
      return;
    }

    const payload: {
      candidateName: string;
      aptitudeAttemptId?: string;
      aptitudeScore?: number;
      domainAttemptId?: string;
      domainScore?: number;
      interviewScore?: number;
    } = { candidateName };

    if (field === 'aptitude_score') {
      if (!entry.aptitude_attempt_id) {
        setScoreError('No aptitude attempt found to update.');
        return;
      }
      payload.aptitudeAttemptId = entry.aptitude_attempt_id;
      payload.aptitudeScore = entry.aptitude_score;
    } else if (field === 'domain_score') {
      if (!entry.domain_attempt_id) {
        setScoreError('No domain attempt found to update.');
        return;
      }
      payload.domainAttemptId = entry.domain_attempt_id;
      payload.domainScore = entry.domain_score;
    } else {
      payload.interviewScore = entry.interview_score;
    }

    setScoreError(null);
    const fieldKey = `${candidateName}:${field}`;
    setSavingField(fieldKey);
    try {
      const response = await updateCandidateResult(task.id, payload);
      const updated = response.candidate;
      setCandidateResults((prev) => {
        const exists = prev.some((c) => c.candidate_name === updated.candidate_name);
        if (exists) {
          return prev.map((c) => (c.candidate_name === updated.candidate_name ? updated : c));
        }
        return [...prev, updated];
      });
      setEditingScores((prev) => ({
        ...prev,
        [updated.candidate_name]: updated
      }));
      if (response.task) {
        setTask((prev) => (prev ? { ...prev, stats: response.task.stats } : prev));
      }
    } catch (err) {
      setScoreError(err instanceof Error ? err.message : 'Unable to save score right now.');
    } finally {
      setSavingField(null);
    }
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
            <div className="mb-2 flex items-center gap-2">
              <h2>{task.title}</h2>
              {task.metadata?.workflow_status === 'closed' && (
                <Badge variant="outline" className="border-yellow-200 text-yellow-900">
                  Closed · Hire completed
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <span>{formatDate(task.created_at)}</span>
              <span>•</span>
              <Badge variant="secondary">
                {task.job_description_facets.location} · {task.job_description_facets.work_type}
              </Badge>
              {typeof task.metadata?.hired_candidate_name === 'string' && (
                <>
                  <span>•</span>
                  <span>Hired: {task.metadata.hired_candidate_name}</span>
                </>
              )}
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
      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}
      {testsError && !actionError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {testsError}
        </div>
      )}
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
                    task.aptitude_test_id &&
                    onNavigate({
                      type: 'test-editor',
                      testId: task.aptitude_test_id,
                      testType: 'aptitude'
                    })
                  }
                  disabled={!task.aptitude_test_id}
                >
                  View and Edit
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => handleCopyLink('aptitude')}
                  disabled={!tests.aptitude || testsLoading}
                >
                  {copiedLink === 'aptitude' ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      {testsLoading ? 'Preparing Link…' : 'Copy Candidate Link'}
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button
                className="w-full"
                onClick={() => handleGenerateTest('aptitude')}
                disabled={generatingTest === 'aptitude'}
              >
                {generatingTest === 'aptitude' ? 'Generating…' : 'Generate Aptitude Test'}
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
                    task.domain_test_id &&
                    onNavigate({
                      type: 'test-editor',
                      testId: task.domain_test_id,
                      testType: 'domain'
                    })
                  }
                  disabled={!task.domain_test_id}
                >
                  View and Edit
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => handleCopyLink('domain')}
                  disabled={!tests.domain || testsLoading}
                >
                  {copiedLink === 'domain' ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      {testsLoading ? 'Preparing Link…' : 'Copy Candidate Link'}
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button
                className="w-full"
                onClick={() => handleGenerateTest('domain')}
                disabled={generatingTest === 'domain'}
              >
                {generatingTest === 'domain' ? 'Generating…' : 'Generate Domain Test'}
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
              <Button className="w-full" onClick={handleViewInterviewScript} disabled={interviewLoading}>
                {interviewLoading ? 'Loading…' : 'View Interview Script'}
              </Button>
            ) : (
              <Button
                className="w-full"
                onClick={handleGenerateInterviewScript}
                disabled={generatingInterviewScript}
              >
                {generatingInterviewScript ? 'Generating…' : 'Generate Interview Script'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={interviewDialogOpen} onOpenChange={setInterviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{interviewScript?.title || 'Interview Script'}</DialogTitle>
            <DialogDescription>
              {interviewScript?.description || 'Structured 10–15 minute conversation guide.'}
            </DialogDescription>
          </DialogHeader>

          {interviewLoading ? (
            <div className="text-gray-500">Loading interview script…</div>
          ) : interviewScript ? (
            <div className="space-y-4">
              {interviewScript.script.map((question, index) => (
                <div key={question.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="mb-2 text-sm text-gray-500">
                    {index + 1}. {question.type.replace(/_/g, ' ')}
                  </div>
                  <div className="text-gray-900">{question.prompt}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500">No interview script available yet.</div>
          )}
        </DialogContent>
      </Dialog>

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
              {scoreError && (
                <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                  {scoreError}
                </div>
              )}
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
                  {candidateLoading ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-gray-500" colSpan={7}>
                        Loading candidate results…
                      </td>
                    </tr>
                  ) : candidateError ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-red-600" colSpan={7}>
                        {candidateError}
                      </td>
                    </tr>
                  ) : candidateResults.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-gray-500" colSpan={7}>
                        No candidate attempts yet.
                      </td>
                    </tr>
                  ) : (
                    candidateResults.map((candidate) => {
                      const editing = editingScores[candidate.candidate_name] ?? candidate;
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
                                  parseInt(e.target.value, 10) || 0
                                )
                              }
                              onBlur={() => handleScoreSave(candidate.candidate_name, 'aptitude_score')}
                              className="w-20"
                              disabled={savingField === `${candidate.candidate_name}:aptitude_score`}
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
                                  parseInt(e.target.value, 10) || 0
                                )
                              }
                              onBlur={() => handleScoreSave(candidate.candidate_name, 'domain_score')}
                              className="w-20"
                              disabled={savingField === `${candidate.candidate_name}:domain_score`}
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
                                  parseInt(e.target.value, 10) || 0
                                )
                              }
                              onBlur={() => handleScoreSave(candidate.candidate_name, 'interview_score')}
                              className="w-20"
                              disabled={savingField === `${candidate.candidate_name}:interview_score`}
                            />
                          </td>
                          <td className="px-4 py-3 text-gray-900">
                            {editing.aptitude_score + editing.domain_score + editing.interview_score}
                          </td>
                        </tr>
                      );
                    })
                  )}
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
