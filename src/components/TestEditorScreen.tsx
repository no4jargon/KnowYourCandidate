import { Fragment, useEffect, useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Screen } from '../App';
import { mockHiringTasks } from '../data/mockData';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import type { Question, Test } from '../types';
import { fetchTestById, requestAiEdit, updateTest } from '../api/tests';
import { validateTest, type ValidationError } from '../../shared/testSchema';

const deepCloneTest = (test: Test): Test => JSON.parse(JSON.stringify(test));

const buildDiffRows = (current: Test, proposed: Test) => {
  const currentLines = JSON.stringify(current, null, 2).split('\n');
  const proposedLines = JSON.stringify(proposed, null, 2).split('\n');
  const length = Math.max(currentLines.length, proposedLines.length);
  return Array.from({ length }, (_, index) => ({
    left: currentLines[index] ?? '',
    right: proposedLines[index] ?? '',
    changed: (currentLines[index] ?? '') !== (proposedLines[index] ?? '')
  }));
};

interface TestEditorScreenProps {
  testId: string;
  testType: 'aptitude' | 'domain';
  onNavigate: (screen: Screen) => void;
}

export function TestEditorScreen({ testId, testType, onNavigate }: TestEditorScreenProps) {
  const fallbackTaskId = useMemo(() => {
    const match = mockHiringTasks.find(
      (task) => task.aptitude_test_id === testId || task.domain_test_id === testId
    );
    return match?.id ?? null;
  }, [testId]);

  const [test, setTest] = useState<Test | null>(null);
  const [draftTest, setDraftTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showEditPrompt, setShowEditPrompt] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [aiPreview, setAiPreview] = useState<{ proposedTest: Test; prompt: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      setValidationErrors([]);
      setSuccessMessage(null);
      setAiPreview(null);
      try {
        const fetched = await fetchTestById(testId);
        if (cancelled) {
          return;
        }
        if (!fetched) {
          setTest(null);
          setDraftTest(null);
          setLoadError('Test not found');
          return;
        }
        setTest(fetched);
        setDraftTest(deepCloneTest(fetched));
      } catch (err) {
        console.error('Failed to load test', err);
        if (!cancelled) {
          setLoadError('Failed to load test. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [testId]);

  const updateQuestion = (
    sectionIndex: number,
    questionIndex: number,
    updater: (question: Question) => Question
  ) => {
    setDraftTest((prev) => {
      if (!prev) return prev;
      const nextSections = prev.sections.map((section, sIndex) => {
        if (sIndex !== sectionIndex) return section;
        return {
          ...section,
          questions: section.questions.map((question, qIndex) => {
            if (qIndex !== questionIndex) return question;
            return updater(question);
          })
        };
      });
      setSuccessMessage(null);
      return { ...prev, sections: nextSections };
    });
  };

  const handleOptionChange = (
    sectionIndex: number,
    questionIndex: number,
    optionIndex: number,
    value: string
  ) => {
    updateQuestion(sectionIndex, questionIndex, (question) => {
      if (question.type !== 'multiple_choice' || !question.options) return question;
      const previousOption = question.options[optionIndex];
      const nextOptions = question.options.map((option, index) =>
        index === optionIndex ? value : option
      );
      let nextAnswer = question.correct_answer;
      if (question.correct_answer.kind === 'exact' && question.correct_answer.value === previousOption) {
        nextAnswer = { ...question.correct_answer, value };
      } else if (
        question.correct_answer.kind === 'one_of' &&
        Array.isArray(question.correct_answer.value)
      ) {
        nextAnswer = {
          ...question.correct_answer,
          value: question.correct_answer.value.map((item) => (item === previousOption ? value : item))
        };
      }
      return { ...question, options: nextOptions, correct_answer: nextAnswer };
    });
  };

  const handleSelectCorrectOption = (
    sectionIndex: number,
    questionIndex: number,
    value: string
  ) => {
    updateQuestion(sectionIndex, questionIndex, (question) => {
      if (question.type !== 'multiple_choice') return question;
      return { ...question, correct_answer: { kind: 'exact', value } };
    });
  };

  const handleNumericAnswerChange = (
    sectionIndex: number,
    questionIndex: number,
    value: string
  ) => {
    updateQuestion(sectionIndex, questionIndex, (question) => {
      if (question.type !== 'numeric') return question;
      const parsed = Number(value);
      if (Number.isNaN(parsed)) {
        return question;
      }
      return { ...question, correct_answer: { kind: 'exact', value: parsed } };
    });
  };

  const handleTextRubricChange = (
    sectionIndex: number,
    questionIndex: number,
    value: string
  ) => {
    updateQuestion(sectionIndex, questionIndex, (question) => {
      if (question.type !== 'text') return question;
      return { ...question, correct_answer: { kind: 'llm_rubric', value } };
    });
  };

  const handleSave = async () => {
    if (!draftTest) return;
    setSaving(true);
    setValidationErrors([]);
    setSuccessMessage(null);
    try {
      const validation = validateTest(draftTest);
      if (!validation.success) {
        setValidationErrors(validation.errors);
        return;
      }
      const updated = await updateTest(testId, validation.data, { updatedBy: 'human' });
      setTest(updated);
      setDraftTest(deepCloneTest(updated));
      setSuccessMessage('Changes saved successfully.');
    } catch (err) {
      console.error('Failed to save test', err);
      const message = err instanceof Error ? err.message : 'Failed to save test';
      setValidationErrors([{ path: '(server)', message }]);
    } finally {
      setSaving(false);
    }
  };

  const handleEditWithPrompt = async () => {
    if (!editPrompt.trim()) {
      setValidationErrors([{ path: '(ai)', message: 'Please provide instructions for the AI edit.' }]);
      return;
    }
    setAiLoading(true);
    setValidationErrors([]);
    setSuccessMessage(null);
    try {
      const result = await requestAiEdit(testId, editPrompt);
      setAiPreview(result);
      setShowEditPrompt(false);
      setEditPrompt('');
    } catch (err) {
      console.error('Failed to request AI edit', err);
      const message = err instanceof Error ? err.message : 'Failed to request AI edit';
      setValidationErrors([{ path: '(ai)', message }]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAcceptAiEdit = async () => {
    if (!aiPreview) return;
    setSaving(true);
    setValidationErrors([]);
    setSuccessMessage(null);
    try {
      const validation = validateTest(aiPreview.proposedTest);
      if (!validation.success) {
        setValidationErrors(validation.errors);
        return;
      }
      const updated = await updateTest(testId, validation.data, { updatedBy: 'ai-edit' });
      setTest(updated);
      setDraftTest(deepCloneTest(updated));
      setAiPreview(null);
      setSuccessMessage('AI changes applied and saved.');
    } catch (err) {
      console.error('Failed to apply AI edit', err);
      const message = err instanceof Error ? err.message : 'Failed to apply AI edit';
      setValidationErrors([{ path: '(ai)', message }]);
    } finally {
      setSaving(false);
    }
  };

  const handleRejectAiEdit = () => {
    setAiPreview(null);
  };

  const diffRows = useMemo(() => {
    if (!test || !aiPreview) return [];
    return buildDiffRows(test, aiPreview.proposedTest);
  }, [test, aiPreview]);

  const targetTaskId = test?.hiring_task_id ?? fallbackTaskId ?? '';

  if (loading) {
    return <div className="p-8">Loading test…</div>;
  }

  if (loadError) {
    return <div className="p-8 text-red-600">{loadError}</div>;
  }

  if (!draftTest) {
    return <div className="p-8">Test not found</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <button
        onClick={() => targetTaskId && onNavigate({ type: 'task-detail', taskId: targetTaskId })}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors disabled:opacity-50"
        disabled={!targetTaskId}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Task
      </button>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="mb-2">
            {testType === 'aptitude' ? 'Aptitude' : 'Domain'} Test Editor
          </h2>
          <p className="text-gray-600">
            Edit questions, answers, and scoring rules. Each question scores 0 or 1.
          </p>
          <p className="text-sm text-gray-500">
            Version {draftTest.metadata.version} • Last updated {new Date(draftTest.metadata.generated_at).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setShowEditPrompt(!showEditPrompt)}>
            Edit with Prompt
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {successMessage && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
          {successMessage}
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <h3 className="font-semibold mb-2">Validation issues</h3>
          <ul className="list-disc list-inside space-y-1">
            {validationErrors.map((error, index) => (
              <li key={`${error.path}-${index}`}>
                <span className="font-mono text-xs text-red-600">{error.path}:</span> {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showEditPrompt && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 className="text-gray-900 mb-2">Edit with AI Prompt</h3>
          <p className="text-gray-600 mb-4">
            Provide instructions to modify the test. The AI will update the test while preserving the
            schema and constraints.
          </p>
          <Textarea
            placeholder="e.g., Make math questions slightly easier but keep structure..."
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            rows={4}
            className="mb-3"
          />
          <div className="flex gap-2">
            <Button onClick={handleEditWithPrompt} disabled={aiLoading}>
              {aiLoading ? 'Requesting…' : 'Apply Changes'}
            </Button>
            <Button variant="outline" onClick={() => setShowEditPrompt(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {aiPreview && test && (
        <div className="bg-white rounded-lg border border-blue-200 p-6 mb-6">
          <h3 className="text-blue-900 mb-2">AI Suggested Update</h3>
          <p className="text-blue-700 mb-4">
            Prompt used: <span className="font-mono text-xs">{aiPreview.prompt}</span>
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-gray-700 mb-2">Current Test</h4>
              <pre className="bg-gray-900 text-gray-100 p-3 rounded overflow-auto text-xs max-h-64">
                {JSON.stringify(test, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="text-gray-700 mb-2">Proposed Test</h4>
              <pre className="bg-gray-900 text-gray-100 p-3 rounded overflow-auto text-xs max-h-64">
                {JSON.stringify(aiPreview.proposedTest, null, 2)}
              </pre>
            </div>
          </div>
          <div className="mt-4">
            <h5 className="text-gray-700 mb-2">Line-by-line diff</h5>
            <div className="grid grid-cols-2 text-xs font-mono border border-gray-200 rounded overflow-hidden">
              <div className="bg-gray-50 p-2 font-semibold">Current</div>
              <div className="bg-gray-50 p-2 font-semibold">Proposed</div>
              {diffRows.map((row, index) => (
                <Fragment key={index}>
                  <div className={`p-2 whitespace-pre ${row.changed ? 'bg-yellow-100' : ''}`}>
                    {row.left}
                  </div>
                  <div className={`p-2 whitespace-pre ${row.changed ? 'bg-yellow-100' : ''}`}>
                    {row.right}
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleAcceptAiEdit} disabled={saving}>
              {saving ? 'Saving…' : 'Accept and Save'}
            </Button>
            <Button variant="outline" onClick={handleRejectAiEdit}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Each question must have a falsifiable answer. Total of 20 questions with 1 point each.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-3">
          <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-4">
            <h4 className="text-gray-900 mb-3">Sections</h4>
            <div className="space-y-2">
              {draftTest.sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block px-3 py-2 rounded text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {section.name.replace(/_/g, ' ')}
                  <span className="text-gray-500 ml-2">({section.questions.length})</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-9 space-y-6">
          {draftTest.sections.map((section, sectionIndex) => (
            <div key={section.id} id={section.id} className="bg-white rounded-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-gray-900">{section.name.replace(/_/g, ' ')}</h3>
                <p className="text-gray-600">
                  Weight: {(section.weight * 100).toFixed(0)}% • {section.questions.length} questions
                </p>
              </div>

              <Accordion type="single" collapsible className="px-6">
                {section.questions.map((question, questionIndex) => (
                  <AccordionItem key={question.id} value={question.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <span className="text-gray-500">{question.id}</span>
                        <span className="text-gray-900">
                          {question.prompt.substring(0, 80)}
                          {question.prompt.length > 80 ? '...' : ''}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Question Prompt</Label>
                          <Textarea
                            value={question.prompt}
                            onChange={(e) =>
                              updateQuestion(sectionIndex, questionIndex, (current) => ({
                                ...current,
                                prompt: e.target.value
                              }))
                            }
                            rows={3}
                            className="font-sans"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Question Type</Label>
                            <Select value={question.type} disabled>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                                <SelectItem value="numeric">Numeric</SelectItem>
                                <SelectItem value="text">Text Answer</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Max Score</Label>
                            <Input type="number" value={question.max_score} readOnly disabled />
                          </div>
                        </div>

                        {question.type === 'multiple_choice' && question.options && (
                          <div className="space-y-2">
                            <Label>Answer Options</Label>
                            {question.options.map((option, optionIndex) => (
                              <div key={optionIndex} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`${question.id}-correct`}
                                  checked={question.correct_answer.kind === 'exact' && question.correct_answer.value === option}
                                  onChange={() =>
                                    handleSelectCorrectOption(sectionIndex, questionIndex, option)
                                  }
                                  className="w-4 h-4"
                                />
                                <Input
                                  value={option}
                                  onChange={(e) =>
                                    handleOptionChange(sectionIndex, questionIndex, optionIndex, e.target.value)
                                  }
                                  className="flex-1"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {question.type === 'numeric' && (
                          <div className="space-y-2">
                            <Label>Correct Answer</Label>
                            <Input
                              type="number"
                              value={
                                question.correct_answer.kind === 'exact'
                                  ? Number(question.correct_answer.value)
                                  : ''
                              }
                              onChange={(e) =>
                                handleNumericAnswerChange(sectionIndex, questionIndex, e.target.value)
                              }
                              placeholder="Enter exact value"
                            />
                            <p className="text-gray-500">
                              For ranges, use schema: {`{ "min": 3.5, "max": 4.0 }`}
                            </p>
                          </div>
                        )}

                        {question.type === 'text' && (
                          <div className="space-y-2">
                            <Label>Grading Rubric</Label>
                            <Textarea
                              value={
                                question.correct_answer.kind === 'llm_rubric'
                                  ? String(question.correct_answer.value)
                                  : ''
                              }
                              onChange={(e) =>
                                handleTextRubricChange(sectionIndex, questionIndex, e.target.value)
                              }
                              rows={3}
                            />
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="text-yellow-900 mb-2">Schema Validation</h4>
            <p className="text-yellow-800">
              On save, the test will be validated to ensure:
            </p>
            <ul className="list-disc list-inside text-yellow-800 mt-2 space-y-1">
              <li>Exactly 20 questions</li>
              <li>All questions have valid types and answers</li>
              <li>Each question scores 0 or 1</li>
              <li>All answers are falsifiable</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
