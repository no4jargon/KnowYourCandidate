import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Screen } from '../App';
import { CheckCircle2, XCircle } from 'lucide-react';
import { listHiringTasks } from '../api/hiringTasks';
import { HiringTask } from '../types';

interface EmployerDashboardProps {
  onNavigate: (screen: Screen) => void;
}

export function EmployerDashboard({ onNavigate }: EmployerDashboardProps) {
  const [tasks, setTasks] = useState<HiringTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listHiringTasks({ page, pageSize })
      .then((response) => {
        if (cancelled) return;
        setTasks(response.data);
        setTotalPages(response.pagination.totalPages || 1);
        setTotalCount(response.pagination.total);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to load hiring tasks');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStringMetadata = (task: HiringTask, key: string) => {
    const value = task.metadata?.[key];
    return typeof value === 'string' ? value : null;
  };

  const isTaskClosed = (task: HiringTask) => getStringMetadata(task, 'workflow_status') === 'closed';

  return (
    <div className="h-full">
      <div className="h-full overflow-auto p-4 md:p-8">
        <div className="max-w-7xl">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="mb-1">Your Hiring Command Center</h2>
              <p className="text-gray-600">Manage your hiring assessments and track candidate progress</p>
            </div>
            <Button onClick={() => onNavigate({ type: 'create-task' })}>
              New Hiring Task
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-gray-600">Title</th>
                    <th className="px-6 py-3 text-left text-gray-600">Created</th>
                    <th className="px-6 py-3 text-left text-gray-600">Status</th>
                    <th className="px-6 py-3 text-left text-gray-600">Artifacts</th>
                    <th className="px-6 py-3 text-left text-gray-600">Aptitude Test</th>
                    <th className="px-6 py-3 text-left text-gray-600">Domain Test</th>
                    <th className="px-6 py-3 text-left text-gray-600">Interview Script</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td className="px-6 py-6 text-center text-gray-500" colSpan={7}>
                        Loading tasks...
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td className="px-6 py-6 text-center text-red-600" colSpan={7}>
                        {error}
                      </td>
                    </tr>
                  ) : tasks.length === 0 ? (
                    <tr>
                      <td className="px-6 py-6 text-center text-gray-500" colSpan={7}>
                        No hiring tasks yet. Create one to get started.
                      </td>
                    </tr>
                  ) : (
                    tasks.map((task) => (
                      <tr
                        key={task.id}
                        onClick={() => onNavigate({ type: 'task-detail', taskId: task.id })}
                        className="cursor-pointer transition-colors hover:bg-gray-50"
                      >
                        <td className="px-6 py-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="text-gray-900">{task.title}</div>
                              {isTaskClosed(task) && (
                                <Badge variant="outline" className="border-yellow-200 text-yellow-900">
                                  Closed
                                </Badge>
                              )}
                            </div>
                            <div className="text-gray-500">{task.location}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{formatDate(task.created_at)}</td>
                        <td className="px-6 py-4">
                          {isTaskClosed(task) ? (
                            <div>
                              <div className="text-gray-900">Closed</div>
                              <div className="text-gray-500">
                                {getStringMetadata(task, 'hired_candidate_name')
                                  ? `Hired: ${getStringMetadata(task, 'hired_candidate_name')}`
                                  : getStringMetadata(task, 'status_reason') ?? 'Hire completed'}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-gray-900">Active</div>
                              <div className="text-gray-500">Open pipeline</div>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <Badge
                              variant={task.has_aptitude_test ? 'default' : 'secondary'}
                              className="gap-1"
                            >
                              {task.has_aptitude_test ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <XCircle className="h-3 w-3" />
                              )}
                              Aptitude
                            </Badge>
                            <Badge
                              variant={task.has_domain_test ? 'default' : 'secondary'}
                              className="gap-1"
                            >
                              {task.has_domain_test ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <XCircle className="h-3 w-3" />
                              )}
                              Domain
                            </Badge>
                            <Badge
                              variant={task.has_interview_script ? 'default' : 'secondary'}
                              className="gap-1"
                            >
                              {task.has_interview_script ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <XCircle className="h-3 w-3" />
                              )}
                              Interview
                            </Badge>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {task.has_aptitude_test ? (
                            <div>
                              <div className="text-gray-900">
                                {(task.stats.aptitude?.attempts ?? 0)} candidates
                              </div>
                              <div className="text-gray-500">
                                Avg: {Number(task.stats.aptitude?.average_score ?? 0).toFixed(1)}/20
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {task.has_domain_test ? (
                            <div>
                              <div className="text-gray-900">
                                {(task.stats.domain?.attempts ?? 0)} candidates
                              </div>
                              <div className="text-gray-500">
                                Avg: {Number(task.stats.domain?.average_score ?? 0).toFixed(1)}/20
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {task.has_interview_script ? (
                            <span className="text-gray-600">Available</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 text-sm text-gray-600">
              <div>
                Showing page {page} of {totalPages} · {totalCount} tasks
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1 || loading}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages || loading}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
