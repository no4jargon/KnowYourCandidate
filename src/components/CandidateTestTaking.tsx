import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { Screen } from '../App';
import { CandidateAttempt, Question, Test } from '../types';
import { autosaveAttemptResponses, getTestByPublicId, startOrResumeAttempt, submitAttempt } from '../api/tests';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { Textarea } from './ui/textarea';

interface CandidateTestTakingProps {
  testPublicId: string;
  attemptId: string;
  candidateName: string;
  onNavigate: (screen: Screen) => void;
}

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function getMetadataTimestamp(metadata: CandidateAttempt['metadata'], key: string) {
  if (metadata && typeof metadata === 'object') {
    const value = (metadata as Record<string, unknown>)[key];
    if (typeof value === 'string') {
      return value;
    }
  }
  return null;
}

export function CandidateTestTaking({
  testPublicId,
  attemptId,
  candidateName,
  onNavigate
}: CandidateTestTakingProps) {
  const [test, setTest] = useState<Test | null>(null);
  const [attempt, setAttempt] = useState<CandidateAttempt | null>(null);
  const [participantName, setParticipantName] = useState(candidateName);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTimestamp, setStartTimestamp] = useState(() => Date.now());
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{ totalScore: number | null; maxScore: number | null } | null>(null);

  const pendingResponsesRef = useRef(new Map<string, string | number | null>());
  const autosaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        const [session, fetchedTest] = await Promise.all([
          startOrResumeAttempt(testPublicId, { candidateName, attemptId }),
          getTestByPublicId(testPublicId)
        ]);

        if (cancelled) {
          return;
        }

        setAttempt(session.attempt);
        setParticipantName(session.attempt.candidate_name);
        setLastSavedAt(getMetadataTimestamp(session.attempt.metadata, 'last_autosave_at'));

        const restoredAnswers: Record<string, string> = {};
        for (const response of session.responses) {
          if (response.raw_answer !== null && response.raw_answer !== undefined) {
            restoredAnswers[response.question_id] = String(response.raw_answer);
          }
        }

        setAnswers(restoredAnswers);
        setTest(fetchedTest);
        setCurrentQuestionIndex(0);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load test attempt');
          setTest(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [attemptId, candidateName, testPublicId]);

  useEffect(() => {
    if (attempt?.started_at) {
      const parsed = Date.parse(attempt.started_at);
      if (!Number.isNaN(parsed)) {
        setStartTimestamp(parsed);
      }
    }
  }, [attempt?.started_at]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.max(0, Math.floor((Date.now() - startTimestamp) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTimestamp]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  const getRawAnswerForQuestion = useCallback((question: Question, value?: string): string | number | null => {
    if (!value) {
      return null;
    }
    if (question.type === 'numeric') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return value;
  }, []);

  const flushAutosave = useCallback(async () => {
    if (!attempt || pendingResponsesRef.current.size === 0) {
      return;
    }

    const pendingEntries = Array.from<[string, string | number | null]>(
    pendingResponsesRef.current.entries()
    );

    const payload = pendingEntries.map(([questionId, rawAnswer]) => ({
      questionId,
      rawAnswer
    }));
    pendingResponsesRef.current.clear();
    setAutosaveStatus('saving');
    setAutosaveError(null);

    try {
      const result = await autosaveAttemptResponses(attempt.id, payload);
      setAttempt(result.attempt);
      const savedAt = getMetadataTimestamp(result.attempt.metadata, 'last_autosave_at') ?? new Date().toISOString();
      setLastSavedAt(savedAt);
      setAutosaveStatus('saved');
    } catch (err) {
      // restore pending responses so they can be retried on the next flush
      for (const [questionId, rawAnswer] of pendingEntries) {
        if (!pendingResponsesRef.current.has(questionId)) {
          pendingResponsesRef.current.set(questionId, rawAnswer);
        }
      }
      setAutosaveStatus('error');
      setAutosaveError(err instanceof Error ? err.message : 'Failed to save progress');
    }
  }, [attempt]);

  const queueAutosave = useCallback(
    (question: Question, value: string) => {
      if (!attempt) {
        return;
      }
      const rawAnswer = getRawAnswerForQuestion(question, value);
      pendingResponsesRef.current.set(question.id, rawAnswer);
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
      autosaveTimerRef.current = window.setTimeout(() => {
        void flushAutosave();
      }, 800);
    },
    [attempt, flushAutosave, getRawAnswerForQuestion]
  );

  const allQuestions: Question[] = useMemo(() => {
    if (!test) {
      return [];
    }
    return test.sections.flatMap((section) => section.questions || []);
  }, [test]);

  const currentQuestion = allQuestions[currentQuestionIndex];
  const progress = allQuestions.length ? ((currentQuestionIndex + 1) / allQuestions.length) * 100 : 0;

  const isQuestionAnswered = useCallback(
    (question: Question) => {
      const value = answers[question.id];
      if (value === undefined) {
        return false;
      }
      if (question.type === 'text' || question.type === 'numeric') {
        return value.trim().length > 0;
      }
      return value !== '';
    },
    [answers]
  );

  const allAnswered = allQuestions.length > 0 && allQuestions.every((question) => isQuestionAnswered(question));
  const answeredCount = allQuestions.filter((question) => isQuestionAnswered(question)).length;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswer = (question: Question, value: string) => {
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === '') {
        delete next[question.id];
      } else {
        next[question.id] = value;
      }
      return next;
    });
    queueAutosave(question, value);
  };

  const handleNext = () => {
    if (currentQuestionIndex < allQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = () => {
    if (!allAnswered) {
      alert('Please answer all questions before submitting');
      return;
    }
    setSubmitError(null);
    setSubmissionResult(null);
    setShowSubmitConfirm(true);
  };

  const confirmSubmit = async () => {
    if (!attempt || !test) {
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    try {
      await flushAutosave();
      const responses = allQuestions.map((question) => ({
        questionId: question.id,
        rawAnswer: getRawAnswerForQuestion(question, answers[question.id])
      }));
      const submission = await submitAttempt(attempt.id, responses);
      setAttempt(submission.attempt);
      setSubmissionResult({
        totalScore: submission.attempt.total_score,
        maxScore: submission.attempt.max_score
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to submit test');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-8">Loading test…</div>;
  }

  if (error || !test || !currentQuestion) {
    return <div className="p-8 text-red-600">{error ?? 'Test not found'}</div>;
  }

  const autosaveStatusLabel = () => {
    if (autosaveStatus === 'saving') {
      return 'Saving…';
    }
    if (autosaveStatus === 'saved' && lastSavedAt) {
      const formatted = new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `Saved ${formatted}`;
    }
    if (autosaveStatus === 'error') {
      return autosaveError ?? 'Autosave failed';
    }
    return null;
  };

  const statusLabel = autosaveStatusLabel();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <div className="text-gray-600">
              Question {currentQuestionIndex + 1} of {allQuestions.length}
            </div>
            <div className="text-sm text-gray-500">
              Time: <span className="text-gray-900">{formatTime(elapsedTime)}</span>
            </div>
          </div>
          <div className="flex flex-col items-start md:items-end gap-1 text-gray-600">
            <div>{participantName}</div>
            {statusLabel && (
              <div className={`text-sm ${autosaveStatus === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
                {statusLabel}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-2">
        <div className="max-w-4xl mx-auto">
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      <main className="flex-1 px-4 md:px-8 py-8 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
              <div className="text-gray-500 mb-2">Question {currentQuestionIndex + 1}</div>
              <h3 className="text-gray-900 mb-4">{currentQuestion.prompt}</h3>
            </div>

            {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => (
                  <label
                    key={index}
                    className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      answers[currentQuestion.id] === option
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name={currentQuestion.id}
                      value={option}
                      checked={answers[currentQuestion.id] === option}
                      onChange={(e) => handleAnswer(currentQuestion, e.target.value)}
                      className="mt-1 w-4 h-4 flex-shrink-0"
                    />
                    <span className="flex-1 text-gray-900">{option}</span>
                  </label>
                ))}
              </div>
            )}

            {currentQuestion.type === 'numeric' && (
              <div className="space-y-2">
                <Input
                  type="number"
                  placeholder="Enter your answer"
                  value={answers[currentQuestion.id] ?? ''}
                  onChange={(e) => handleAnswer(currentQuestion, e.target.value)}
                  className="text-lg"
                  autoFocus
                />
                <p className="text-gray-500">Enter only the number, without units</p>
              </div>
            )}

            {currentQuestion.type === 'text' && (
              <div className="space-y-2">
                <Textarea
                  placeholder="Enter your answer here..."
                  value={answers[currentQuestion.id] ?? ''}
                  onChange={(e) => handleAnswer(currentQuestion, e.target.value)}
                  rows={6}
                  className="resize-none"
                  autoFocus
                />
                <p className="text-gray-500">Provide a clear, concise answer (2-3 sentences)</p>
              </div>
            )}

            <div className="mt-6 flex items-center gap-2">
              {isQuestionAnswered(currentQuestion) ? (
                <>
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="text-green-600">Answer saved</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-500">Not answered</span>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-4">
            <Button variant="outline" onClick={handlePrevious} disabled={currentQuestionIndex === 0}>
              Previous
            </Button>

            <div className="text-gray-600">
              {answeredCount} of {allQuestions.length} answered
            </div>

            {currentQuestionIndex < allQuestions.length - 1 ? (
              <Button onClick={handleNext}>Next</Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!allAnswered}>
                Submit Test
              </Button>
            )}
          </div>
        </div>
      </main>

      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            {submissionResult ? (
              <div className="space-y-4">
                <h3 className="text-gray-900">Test Submitted</h3>
                <p className="text-gray-600">Thank you, {participantName}! Your responses have been received.</p>
                {submissionResult.totalScore !== null && submissionResult.maxScore !== null && (
                  <p className="text-gray-900">
                    Provisional score: {submissionResult.totalScore}/{submissionResult.maxScore}
                  </p>
                )}
                <Button className="w-full" onClick={() => onNavigate({ type: 'thank-you' })}>
                  Continue
                </Button>
              </div>
            ) : (
              <div>
                <h3 className="text-gray-900 mb-4">Submit Test?</h3>
                <p className="text-gray-600 mb-4">
                  Are you sure you want to submit your test? You won't be able to make changes after submission.
                </p>
                {submitError && <p className="text-sm text-red-600 mb-4">{submitError}</p>}
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setShowSubmitConfirm(false)} disabled={isSubmitting}>
                    Go Back
                  </Button>
                  <Button onClick={confirmSubmit} disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting…' : 'Yes, Submit'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
