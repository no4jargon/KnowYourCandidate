import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Screen } from '../App';
import { ArrowLeft, Mic } from 'lucide-react';
import { createHiringTask, formatFacets } from '../api/hiringTasks';
import { HiringTask, JDFacets } from '../types';

interface CreateHiringTaskScreenProps {
  onNavigate: (screen: Screen) => void;
}

export function CreateHiringTaskScreen({ onNavigate }: CreateHiringTaskScreenProps) {
  const [jobTitle, setJobTitle] = useState('');
  const [location, setLocation] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedFacets, setGeneratedFacets] = useState<JDFacets | null>(null);
  const [createdTask, setCreatedTask] = useState<HiringTask | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setGeneratedFacets(null);

    try {
      const task = await createHiringTask({
        title: jobTitle,
        location,
        jobDescriptionRaw: jobDescription
      });
      setCreatedTask(task);
      setGeneratedFacets(task.job_description_facets);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to create hiring task';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <button
        onClick={() => onNavigate({ type: 'dashboard' })}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      <div className="mb-8">
        <h2 className="mb-2">Create New Hiring Task</h2>
        <p className="text-gray-600">Enter job details to generate tailored assessments</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          {error && (
            <div className="border border-red-200 bg-red-50 text-red-700 rounded p-3">
              {error}
            </div>
          )}
          {createdTask && !error && (
            <div className="border border-green-200 bg-green-50 text-green-700 rounded p-3">
              Hiring task created successfully.
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="jobTitle">Job Title</Label>
            <Input
              id="jobTitle"
              placeholder="e.g. Backend Engineer, Mumbai"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="e.g. Mumbai, India"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jobDescription">Job Description</Label>
            <Textarea
              id="jobDescription"
              placeholder="Paste or type the full job description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={12}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Generating...' : 'Generate JD Facets and Save Task'}
            </Button>
            <Button type="button" variant="outline" className="gap-2" disabled>
              <Mic className="w-4 h-4" />
              Help me fill these fields (voice)
            </Button>
          </div>

          {createdTask && (
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => onNavigate({ type: 'task-detail', taskId: createdTask.id })}>
                View Task Details
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onNavigate({ type: 'dashboard' })}
              >
                Back to Dashboard
              </Button>
            </div>
          )}

          <div className="pt-4 border-t border-gray-200">
            <p className="text-gray-500 mb-2">
              Voice assistant will help fill JD fields in future versions
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-4">
            <h3 className="text-gray-900">JD Facets Preview</h3>
            <p className="text-gray-500">Structured data extracted from job description</p>
          </div>
          <div className="bg-gray-50 rounded border border-gray-200 p-4 overflow-x-auto">
            <pre className="text-gray-700" style={{ fontFamily: 'monospace' }}>
              {generatedFacets
                ? formatFacets(generatedFacets)
                : 'Submit the job description to generate structured facets.'}
            </pre>
          </div>
        </div>
      </form>
    </div>
  );
}
