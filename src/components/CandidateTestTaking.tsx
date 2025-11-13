import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Progress } from './ui/progress';
import { mockTests } from '../data/mockData';
import { Screen } from '../App';
import { Question, Answer } from '../types';
import { AlertCircle, Check } from 'lucide-react';

interface CandidateTestTakingProps {
  testPublicId: string;
  attemptId: string;
  candidateName: string;
  onNavigate: (screen: Screen) => void;
}

export function CandidateTestTaking({
  testPublicId,
  attemptId,
  candidateName,
  onNavigate
}: CandidateTestTakingProps) {
  const test = Object.values(mockTests).find((t) => t.public_id === testPublicId);
  
  // Flatten all questions
  const allQuestions: Question[] = test?.sections.flatMap((s) => s.questions) || [];
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [questionId: string]: string | number }>({});
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  if (!test) {
    return <div className="p-8">Test not found</div>;
  }

  const currentQuestion = allQuestions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / allQuestions.length) * 100;
  const allAnswered = allQuestions.every((q) => answers[q.id] !== undefined && answers[q.id] !== '');

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswer = (questionId: string, value: string | number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value
    }));
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
    setShowSubmitConfirm(true);
  };

  const confirmSubmit = () => {
    // In real app, would submit to backend
    console.log('Submitting test:', {
      attemptId,
      candidateName,
      testId: test.id,
      answers,
      elapsedTime
    });
    onNavigate({ type: 'thank-you' });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-gray-600">
              Question {currentQuestionIndex + 1} of {allQuestions.length}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-gray-600">
              Time: <span className="text-gray-900">{formatTime(elapsedTime)}</span>
            </div>
            <div className="text-gray-600">
              {candidateName}
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-2">
        <div className="max-w-4xl mx-auto">
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Question Content */}
      <main className="flex-1 px-4 md:px-8 py-8 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 p-6 md:p-8">
            <div className="mb-6">
              <div className="text-gray-500 mb-2">Question {currentQuestionIndex + 1}</div>
              <h3 className="text-gray-900 mb-4">{currentQuestion.prompt}</h3>
            </div>

            {/* Multiple Choice */}
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
                      onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                      className="mt-1 w-4 h-4 flex-shrink-0"
                    />
                    <span className="flex-1 text-gray-900">{option}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Numeric Input */}
            {currentQuestion.type === 'numeric' && (
              <div className="space-y-2">
                <Input
                  type="number"
                  placeholder="Enter your answer"
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                  className="text-lg"
                  autoFocus
                />
                <p className="text-gray-500">Enter only the number, without units</p>
              </div>
            )}

            {/* Text Input */}
            {currentQuestion.type === 'text' && (
              <div className="space-y-2">
                <Textarea
                  placeholder="Enter your answer here..."
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                  rows={6}
                  className="resize-none"
                  autoFocus
                />
                <p className="text-gray-500">Provide a clear, concise answer (2-3 sentences)</p>
              </div>
            )}

            {/* Answer Status */}
            <div className="mt-6 flex items-center gap-2">
              {answers[currentQuestion.id] !== undefined && answers[currentQuestion.id] !== '' ? (
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

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
            >
              Previous
            </Button>

            <div className="text-gray-600">
              {allQuestions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== '').length} of{' '}
              {allQuestions.length} answered
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

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-gray-900 mb-4">Submit Test?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to submit your test? You won't be able to make changes after submission.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowSubmitConfirm(false)}>
                Go Back
              </Button>
              <Button onClick={confirmSubmit}>
                Yes, Submit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
