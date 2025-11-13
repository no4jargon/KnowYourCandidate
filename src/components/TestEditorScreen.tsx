import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { mockTests } from '../data/mockData';
import { Screen } from '../App';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

interface TestEditorScreenProps {
  testId: string;
  testType: 'aptitude' | 'domain';
  onNavigate: (screen: Screen) => void;
}

export function TestEditorScreen({ testId, testType, onNavigate }: TestEditorScreenProps) {
  const test = mockTests[testId];
  const [showEditPrompt, setShowEditPrompt] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');

  if (!test) {
    return <div className="p-8">Test not found</div>;
  }

  const handleSave = () => {
    alert('Test changes would be validated and saved here');
  };

  const handleEditWithPrompt = () => {
    alert(`Would send test and instructions to LLM:\n\n"${editPrompt}"\n\nAnd return updated test.`);
    setShowEditPrompt(false);
    setEditPrompt('');
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
          <Button variant="outline" onClick={() => setShowEditPrompt(!showEditPrompt)}>
            Edit with Prompt
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </div>

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
            <Button onClick={handleEditWithPrompt}>Apply Changes</Button>
            <Button variant="outline" onClick={() => setShowEditPrompt(false)}>
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
                            defaultValue={question.prompt}
                            rows={3}
                            className="font-sans"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Question Type</Label>
                            <Select defaultValue={question.type}>
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
                            <Input type="number" defaultValue={question.max_score} disabled />
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
                                  defaultChecked={option === question.correct_answer.value}
                                  className="w-4 h-4"
                                />
                                <Input defaultValue={option} className="flex-1" />
                              </div>
                            ))}
                          </div>
                        )}

                        {question.type === 'numeric' && (
                          <div className="space-y-2">
                            <Label>Correct Answer</Label>
                            <Input
                              type="number"
                              defaultValue={question.correct_answer.value}
                              placeholder="Enter exact value or range"
                            />
                            <p className="text-gray-500">
                              For ranges, use schema: {`{ "min": 3.5, "max": 4.0 }`}
                            </p>
                          </div>
                        )}

                        {question.type === 'text' && (
                          <div className="space-y-2">
                            <Label>Grading Method</Label>
                            <div className="bg-gray-50 rounded border border-gray-200 p-3">
                              <p className="text-gray-700">
                                LLM Rubric-based grading
                              </p>
                              <p className="text-gray-500">
                                Expected keywords: {question.correct_answer.value}
                              </p>
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
