import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { mockHiringTasks, mockLiveFeed } from '../data/mockData';
import { Screen } from '../App';
import { CheckCircle2, XCircle } from 'lucide-react';

interface EmployerDashboardProps {
  onNavigate: (screen: Screen) => void;
}

export function EmployerDashboard({ onNavigate }: EmployerDashboardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="max-w-7xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
              <h2 className="mb-1">Hiring Tasks</h2>
              <p className="text-gray-600">Manage your hiring assessments and track candidate progress</p>
            </div>
            <Button onClick={() => onNavigate({ type: 'create-task' })}>
              New Hiring Task
            </Button>
          </div>

          {/* Hiring Tasks Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-gray-600">Title</th>
                    <th className="px-6 py-3 text-left text-gray-600">Created</th>
                    <th className="px-6 py-3 text-left text-gray-600">Artifacts</th>
                    <th className="px-6 py-3 text-left text-gray-600">Aptitude Test</th>
                    <th className="px-6 py-3 text-left text-gray-600">Domain Test</th>
                    <th className="px-6 py-3 text-left text-gray-600">Interview Script</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {mockHiringTasks.map((task) => (
                    <tr
                      key={task.id}
                      onClick={() => onNavigate({ type: 'task-detail', taskId: task.id })}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-gray-900">{task.title}</div>
                          <div className="text-gray-500">{task.location}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {formatDate(task.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Badge
                            variant={task.has_aptitude_test ? 'default' : 'secondary'}
                            className="gap-1"
                          >
                            {task.has_aptitude_test ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                            Aptitude
                          </Badge>
                          <Badge
                            variant={task.has_domain_test ? 'default' : 'secondary'}
                            className="gap-1"
                          >
                            {task.has_domain_test ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                            Domain
                          </Badge>
                          <Badge
                            variant={task.has_interview_script ? 'default' : 'secondary'}
                            className="gap-1"
                          >
                            {task.has_interview_script ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                            Interview
                          </Badge>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {task.has_aptitude_test ? (
                          <div>
                            <div className="text-gray-900">
                              {task.stats.aptitude_candidates} candidates
                            </div>
                            <div className="text-gray-500">
                              Avg: {task.stats.aptitude_avg_score.toFixed(1)}/20
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
                              {task.stats.domain_candidates} candidates
                            </div>
                            <div className="text-gray-500">
                              Avg: {task.stats.domain_avg_score.toFixed(1)}/20
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Live Feed Panel */}
      <div className="lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-gray-200 flex flex-col max-h-96 lg:max-h-none">
        <div className="p-4 md:p-6 border-b border-gray-200">
          <h3 className="text-gray-900">Live Activity Feed</h3>
          <p className="text-gray-500">Recent candidate actions</p>
        </div>
        <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
          {mockLiveFeed.map((item, index) => (
            <div key={index} className="pb-4 border-b border-gray-100 last:border-0">
              <div className="text-gray-500 mb-1">
                {formatTime(item.timestamp)}
              </div>
              <div className="text-gray-900">{item.message}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}