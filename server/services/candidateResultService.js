const { getTaskById } = require('../repositories/hiringTaskRepository');
const { listAttemptsByTest } = require('../repositories/candidateAttemptRepository');

function ensureEntry(map, candidateName) {
  if (!map.has(candidateName)) {
    map.set(candidateName, {
      candidate_name: candidateName,
      aptitude_attempt_id: null,
      aptitude_taken_at: null,
      aptitude_score: 0,
      domain_attempt_id: null,
      domain_taken_at: null,
      domain_score: 0,
      interview_score: 0,
      overall_score: 0
    });
  }
  return map.get(candidateName);
}

function summarizeAttempts(task, map) {
  if (task.aptitude_test_id) {
    const attempts = listAttemptsByTest(task.aptitude_test_id);
    for (const attempt of attempts) {
      const entry = ensureEntry(map, attempt.candidate_name);
      if (!entry.aptitude_attempt_id) {
        entry.aptitude_attempt_id = attempt.id;
        entry.aptitude_taken_at = attempt.submitted_at || attempt.started_at || null;
        entry.aptitude_score = Number(attempt.total_score ?? 0);
      }
    }
  }

  if (task.domain_test_id) {
    const attempts = listAttemptsByTest(task.domain_test_id);
    for (const attempt of attempts) {
      const entry = ensureEntry(map, attempt.candidate_name);
      if (!entry.domain_attempt_id) {
        entry.domain_attempt_id = attempt.id;
        entry.domain_taken_at = attempt.submitted_at || attempt.started_at || null;
        entry.domain_score = Number(attempt.total_score ?? 0);
      }
    }
  }
}

function addInterviewScores(task, map) {
  const interviewScores = task.metadata?.interview_scores || {};
  for (const [candidateName, score] of Object.entries(interviewScores)) {
    const entry = ensureEntry(map, candidateName);
    entry.interview_score = Number(score) || 0;
  }
}

function buildCandidateResults(task) {
  const map = new Map();
  summarizeAttempts(task, map);
  addInterviewScores(task, map);

  for (const entry of map.values()) {
    entry.overall_score = entry.aptitude_score + entry.domain_score + entry.interview_score;
  }

  return Array.from(map.values()).sort((a, b) => a.candidate_name.localeCompare(b.candidate_name));
}

function listCandidateResultsForTask(taskId) {
  const task = getTaskById(taskId);
  if (!task) {
    return [];
  }
  return buildCandidateResults(task);
}

function getCandidateResultForTask(taskId, candidateName) {
  const task = getTaskById(taskId);
  if (!task) {
    return null;
  }
  const results = buildCandidateResults(task);
  return results.find((candidate) => candidate.candidate_name === candidateName) || null;
}

module.exports = {
  listCandidateResultsForTask,
  getCandidateResultForTask
};
