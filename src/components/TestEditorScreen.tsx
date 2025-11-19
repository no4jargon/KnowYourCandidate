import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Screen } from '../App';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { ApiError, editTestWithPrompt, getTest, updateTest } from '../api/tests';
import { Question, Test, TestSection } from '../types';

interface TestEditorScreenProps {
  testId: string;
  testType: 'aptitude' | 'domain';
  onNavigate: (screen: Screen) => void;
}

export function TestEditorScreen({ testId, testType, onNavigate }: TestEditorScreenProps) {
  const [test, setTest] = useState<Test | null>(null);
  const [showEditPrompt, setShowEditPrompt] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplyingPrompt, setIsApplyingPrompt] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetActionFeedback = () => {
    setSuccessMessage(null);
    setActionError(null);
    setValidationErrors([]);
  };

  const mutateTest = (mutator: (current: Test) => Test) => {
    setTest((current) => {
      if (!current) {
        return current;
      }
      return mutator(current);
    });
    resetActionFeedback();
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getTest(testId)
      .then((fetched) => {
        if (!cancelled) {
          setTest(fetched);
          resetActionFeedback();
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load test');
          setTest(null);
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
  }, [testId]);

  if (isLoading) {
    return <div className="p-8">Loading test editor…</div>;
  }

  if (error || !test) {
    return <div className="p-8 text-red-600">{error ?? 'Test not found'}</div>;
  }

  const handleSave = async () => {
    if (!test) {
      return;
    }
    setIsSaving(true);
    resetActionFeedback();
    try {
      const normalizedSections = normalizeSectionsForSave(test.sections);
      const updated = await updateTest(test.id, {
        title: test.title,
        description: test.description ?? null,
        difficulty: test.difficulty,
        sections: normalizedSections
      });
      setTest(updated);
      setSuccessMessage('Test saved successfully.');
    } catch (err) {
      handleActionError(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleActionError = (err: unknown) => {
    if (err instanceof ApiError) {
      setActionError(err.message);
      if (Array.isArray(err.details)) {
        setValidationErrors(
          err.details.map((detail: any, index: number) => {
            if (typeof detail?.message === 'string') {
              return detail.message;
            }
            return `Validation issue ${index + 1}`;
          })
        );
      }
    } else {
      setActionError(err instanceof Error ? err.message : 'Unable to save test');
    }
  };

  const handleEditWithPrompt = async () => {
    if (!test || !editPrompt.trim()) {
      return;
    }
    setIsApplyingPrompt(true);
    resetActionFeedback();
    try {
      const updated = await editTestWithPrompt(test.id, editPrompt.trim());
      setTest(updated);
      setShowEditPrompt(false);
      setEditPrompt('');
      setSuccessMessage('AI edit applied successfully.');
    } catch (err) {
      handleActionError(err);
    } finally {
      setIsApplyingPrompt(false);
    }
  };

  const updateQuestion = (
    sectionId: string,
    questionId: string,
    updater: (question: Question) => Question,
  ) => {
    mutateTest((current) => ({
      ...current,
      sections: current.sections.map((section) => {
        if (section.id !== sectionId) {
          return section;
        }
        return {
          ...section,
          questions: section.questions.map((question) => {
            if (question.id !== questionId) {
              return question;
            }
            return updater(question);
          })
        };
      })
    }));
  };

  const handleQuestionTypeChange = (sectionId: string, question: Question, type: Question['type']) => {
    updateQuestion(sectionId, question.id, (current) => {
      if (current.type === type) {
        return current;
      }
      if (type === 'multiple_choice') {
        const options = current.options && current.options.length >= 2 ? current.options : ['', ''];
        return {
          ...current,
          type,
          options,
          correct_answer: { kind: 'exact', value: options[0] ?? '' }
        };
      }
      if (type === 'numeric') {
        return {
          ...current,
          type,
          options: undefined,
          correct_answer:
            current.correct_answer.kind === 'exact' || current.correct_answer.kind === 'numeric_range'
              ? current.correct_answer
              : { kind: 'exact', value: 0 }
        };
      }
      return {
        ...current,
        type,
        options: undefined,
        correct_answer:
          current.correct_answer.kind === 'llm_rubric'
            ? current.correct_answer
            : { kind: 'llm_rubric', value: { rubric: '', ideal_answer: '' } }
      };
    });
  };

  const handleOptionChange = (
    sectionId: string,
    questionId: string,
    optionIndex: number,
    value: string,
  ) => {
    updateQuestion(sectionId, questionId, (current) => {
      const options = [...(current.options || [])];
      options[optionIndex] = value;
      return {
        ...current,
        options
      };
    });
  };

  const handleAddOption = (sectionId: string, questionId: string) => {
    updateQuestion(sectionId, questionId, (current) => ({
      ...current,
      options: [...(current.options || []), '']
    }));
  };

  const handleRemoveOption = (sectionId: string, question: Question, optionIndex: number) => {
    if (!question.options || question.options.length <= 2) {
      return;
    }
    updateQuestion(sectionId, question.id, (current) => {
      const options = [...(current.options || [])];
      const [removed] = options.splice(optionIndex, 1);
      let correctAnswer = current.correct_answer;
      const currentValue = Array.isArray(correctAnswer.value)
        ? correctAnswer.value[0]
        : correctAnswer.value;
      if (removed === currentValue) {
        correctAnswer = { kind: 'exact', value: options[0] ?? '' };
      }
      return {
        ...current,
        options,
        correct_answer: correctAnswer
      };
    });
  };

  const handleSelectCorrectOption = (sectionId: string, questionId: string, option: string) => {
    updateQuestion(sectionId, questionId, (current) => ({
      ...current,
      correct_answer: { kind: 'exact', value: option }
    }));
  };

  const handleNumericModeChange = (sectionId: string, questionId: string, mode: 'exact' | 'range') => {
    updateQuestion(sectionId, questionId, (current) => {
      if (mode === 'range') {
        const existing = current.correct_answer.kind === 'numeric_range' ? current.correct_answer.value : {};
        return {
          ...current,
          correct_answer: {
            kind: 'numeric_range',
            value: {
              min: existing?.min ?? '',
              max: existing?.max ?? ''
            }
          }
        };
      }
      const value =
        current.correct_answer.kind === 'exact' && current.correct_answer.value != null
          ? current.correct_answer.value
          : '';
      return {
        ...current,
        correct_answer: { kind: 'exact', value }
      };
    });
  };

  const handleNumericExactChange = (sectionId: string, questionId: string, value: string) => {
    const parsed = parseNumericInput(value);
    updateQuestion(sectionId, questionId, (current) => ({
      ...current,
      correct_answer: {
        kind: 'exact',
        value: parsed
      }
    }));
  };

  const handleNumericRangeChange = (
    sectionId: string,
    questionId: string,
    field: 'min' | 'max',
    value: string,
  ) => {
    const parsed = parseNumericInput(value);
    updateQuestion(sectionId, questionId, (current) => {
      const existing =
        current.correct_answer.kind === 'numeric_range' && current.correct_answer.value
          ? current.correct_answer.value
          : { min: '', max: '' };
      return {
        ...current,
        correct_answer: {
          kind: 'numeric_range',
          value: {
            ...existing,
            [field]: parsed
          }
        }
      };
    });
  };

  const handleTextRubricChange = (
    sectionId: string,
    questionId: string,
    field: 'rubric' | 'ideal_answer',
    value: string,
  ) => {
    updateQuestion(sectionId, questionId, (current) => {
      const existingValue =
        current.correct_answer.kind === 'llm_rubric' && typeof current.correct_answer.value === 'object'
          ? current.correct_answer.value
          : { rubric: '', ideal_answer: '' };
      return {
        ...current,
        correct_answer: {
          kind: 'llm_rubric',
          value: {
            ...existingValue,
            [field]: value
          }
        }
      };
    });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <button
        onClick={() => onNavigate({ type: 'task-detail', taskId: test.hiring_task_id })}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
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
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setShowEditPrompt(!showEditPrompt)} disabled={isApplyingPrompt}>
            Edit with Prompt
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isApplyingPrompt}>
            {isSaving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {actionError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {validationErrors.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-800">Validation issues</p>
          <ul className="mt-2 list-disc list-inside text-red-700 space-y-1">
            {validationErrors.map((issue, index) => (
              <li key={`${issue}-${index}`}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
          {successMessage}
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
            disabled={isApplyingPrompt}
          />
          <div className="flex gap-2">
            <Button onClick={handleEditWithPrompt} disabled={isApplyingPrompt || !editPrompt.trim()}>
              {isApplyingPrompt ? 'Applying…' : 'Apply Changes'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditPrompt(false);
                setEditPrompt('');
              }}
              disabled={isApplyingPrompt}
            >
              Cancel
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
        {/* Sections List */}
        <div className="col-span-3">
          <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-4">
            <h4 className="text-gray-900 mb-3">Sections</h4>
            <div className="space-y-2">
              {test.sections.map((section) => (
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

        {/* Questions Editor */}
        <div className="col-span-9 space-y-6">
          {test.sections.map((section) => (
            <div key={section.id} id={section.id} className="bg-white rounded-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-gray-900">{section.name.replace(/_/g, ' ')}</h3>
                <p className="text-gray-600">
                  Weight: {(section.weight * 100).toFixed(0)}% • {section.questions.length} questions
                </p>
              </div>

              <Accordion type="single" collapsible className="px-6">
                {section.questions.map((question, qIndex) => (
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
                              updateQuestion(section.id, question.id, (current) => ({
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
                            <Select value={question.type} onValueChange={(value) => handleQuestionTypeChange(section.id, question, value as Question['type'])}>
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
                            <Input type="number" value={question.max_score} disabled />
                          </div>
                        </div>

                        {question.type === 'multiple_choice' && question.options && (
                          <div className="space-y-2">
                            <Label>Answer Options</Label>
                            {question.options.map((option, oIndex) => (
                              <div key={oIndex} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`${question.id}-correct`}
                                  checked={option === question.correct_answer.value}
                                  className="w-4 h-4"
                                  onChange={() => handleSelectCorrectOption(section.id, question.id, option)}
                                />
                                <Input
                                  value={option}
                                  onChange={(e) => handleOptionChange(section.id, question.id, oIndex, e.target.value)}
                                  className="flex-1"
                                />
                                {question.options.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOption(section.id, question, oIndex)}
                                    className="text-sm text-red-600 hover:text-red-800"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddOption(section.id, question.id)}
                            >
                              Add Option
                            </Button>
                          </div>
                        )}

                        {question.type === 'numeric' && (
                          <div className="space-y-2">
                            <Label>Correct Answer</Label>
                            <Select
                              value={question.correct_answer.kind === 'numeric_range' ? 'range' : 'exact'}
                              onValueChange={(value) =>
                                handleNumericModeChange(section.id, question.id, value as 'exact' | 'range')
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="exact">Exact Value</SelectItem>
                                <SelectItem value="range">Range</SelectItem>
                              </SelectContent>
                            </Select>
                            {question.correct_answer.kind === 'numeric_range' ? (
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-sm text-gray-600">Min</Label>
                                  <Input
                                    type="number"
                                    value={numericInputValue(question.correct_answer.value?.min)}
                                    onChange={(e) =>
                                      handleNumericRangeChange(section.id, question.id, 'min', e.target.value)
                                    }
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm text-gray-600">Max</Label>
                                  <Input
                                    type="number"
                                    value={numericInputValue(question.correct_answer.value?.max)}
                                    onChange={(e) =>
                                      handleNumericRangeChange(section.id, question.id, 'max', e.target.value)
                                    }
                                  />
                                </div>
                              </div>
                            ) : (
                              <Input
                                type="number"
                                value={numericInputValue(question.correct_answer.value)}
                                onChange={(e) => handleNumericExactChange(section.id, question.id, e.target.value)}
                                placeholder="Enter exact numeric value"
                              />
                            )}
                          </div>
                        )}

                        {question.type === 'text' && (
                          <div className="space-y-2">
                            <Label>Grading Method</Label>
                            <div className="bg-gray-50 rounded border border-gray-200 p-3">
                              <p className="text-gray-700">LLM Rubric-based grading</p>
                              <Label className="mt-3 block text-sm text-gray-600">Rubric</Label>
                              <Textarea
                                value={
                                  question.correct_answer.kind === 'llm_rubric'
                                    ? (question.correct_answer.value?.rubric ?? '')
                                    : ''
                                }
                                onChange={(e) =>
                                  handleTextRubricChange(section.id, question.id, 'rubric', e.target.value)
                                }
                                rows={3}
                              />
                              <Label className="mt-3 block text-sm text-gray-600">Ideal Answer (optional)</Label>
                              <Textarea
                                value={
                                  question.correct_answer.kind === 'llm_rubric'
                                    ? (question.correct_answer.value?.ideal_answer ?? '')
                                    : ''
                                }
                                onChange={(e) =>
                                  handleTextRubricChange(section.id, question.id, 'ideal_answer', e.target.value)
                                }
                                rows={2}
                              />
                            </div>
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

function normalizeSectionsForSave(sections: TestSection[]): TestSection[] {
  return sections.map((section) => ({
    ...section,
    questions: section.questions.map((question) => {
      if (question.type === 'numeric') {
        if (question.correct_answer.kind === 'exact') {
          const raw = question.correct_answer.value;
          const numericValue = typeof raw === 'string' && raw !== '' ? Number(raw) : raw;
          return {
            ...question,
            correct_answer: {
              kind: 'exact',
              value:
                typeof numericValue === 'number' && !Number.isNaN(numericValue)
                  ? numericValue
                  : raw
            }
          };
        }
        if (question.correct_answer.kind === 'numeric_range') {
          const { min, max } = question.correct_answer.value || {};
          const parsedMin = typeof min === 'string' && min !== '' ? Number(min) : min;
          const parsedMax = typeof max === 'string' && max !== '' ? Number(max) : max;
          return {
            ...question,
            correct_answer: {
              kind: 'numeric_range',
              value: {
                min:
                  typeof parsedMin === 'number' && !Number.isNaN(parsedMin)
                    ? parsedMin
                    : min,
                max:
                  typeof parsedMax === 'number' && !Number.isNaN(parsedMax)
                    ? parsedMax
                    : max
              }
            }
          };
        }
      }
      return question;
    })
  }));
}

function parseNumericInput(value: string): number | string {
  if (value === '') {
    return '';
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function numericInputValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toString() : '';
  }
  return String(value);
}
