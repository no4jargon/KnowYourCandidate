const { callOpenAIWithSchema } = require('./llmClient');

const TextGradingSchema = {
  name: 'binary_text_grading',
  schema: {
    type: 'object',
    required: ['score', 'reason'],
    properties: {
      score: {
        type: 'number',
        minimum: 0,
        maximum: 1
      },
      reason: {
        type: 'string'
      }
    }
  }
};

function normalizeAnswer(question, rawAnswer) {
  if (rawAnswer === undefined || rawAnswer === null) {
    return null;
  }

  if (question.type === 'numeric') {
    if (typeof rawAnswer === 'number') {
      return Number.isFinite(rawAnswer) ? rawAnswer : null;
    }
    const parsed = Number(String(rawAnswer).trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (Array.isArray(rawAnswer)) {
    if (!rawAnswer.length) return null;
    return rawAnswer
      .map((value) => String(value).trim())
      .filter(Boolean)
      .join(', ');
  }

  const text = String(rawAnswer).trim();
  return text.length ? text : null;
}

async function gradeWithLLM({ question, candidateAnswer, rubric, idealAnswer, testTitle, taskTitle }) {
  if (!candidateAnswer) {
    return {
      score: 0,
      reason: 'No answer provided',
      model: null,
      responseId: null
    };
  }

  try {
    const messages = [
      {
        role: 'system',
        content:
          'You are an impartial hiring evaluator. Assign a binary score (0 or 1) to the candidate answer using the rubric. Return valid JSON.'
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              `Hiring task: ${taskTitle}`,
              `Test: ${testTitle}`,
              `Question prompt: ${question.prompt}`,
              rubric ? `Rubric: ${rubric}` : null,
              idealAnswer ? `Ideal answer (for reference only): ${idealAnswer}` : null,
              `Candidate answer: ${candidateAnswer}`,
              'Return JSON with `score` (0 or 1 only) and a short `reason`. Score 1 only if the answer fully satisfies the rubric.'
            ]
              .filter(Boolean)
              .join('\n\n')
          }
        ]
      }
    ];

    const { payload, model, response_id: responseId } = await callOpenAIWithSchema({
      messages,
      schema: TextGradingSchema
    });

    const numericScore = Number(payload?.score);
    const bounded = Number.isFinite(numericScore) ? Math.max(0, Math.min(1, numericScore)) : 0;
    const score = bounded >= 0.5 ? 1 : 0;

    return {
      score,
      reason: typeof payload?.reason === 'string' ? payload.reason : 'LLM provided no reason',
      model,
      responseId
    };
  } catch (error) {
    return {
      score: 0,
      reason: error instanceof Error ? error.message : 'LLM grading failed',
      model: null,
      responseId: null
    };
  }
}

async function scoreAttempt({ test, attempt, responses }) {
  const sections = Array.isArray(test.sections) ? test.sections : [];
  const questionMap = new Map();
  for (const section of sections) {
    for (const question of section.questions || []) {
      const id = question.id || question.prompt;
      questionMap.set(id, { ...question, id });
    }
  }

  const responseMap = new Map();
  for (const response of responses || []) {
    responseMap.set(response.question_id, {
      ...response,
      score: response.score != null ? Number(response.score) : null
    });
  }

  const scoredResponses = [];
  let totalScore = 0;
  let maxScore = 0;
  const llmEvents = [];

  for (const [questionId, question] of questionMap.entries()) {
    maxScore += Number(question.max_score || 1);
    const existing = responseMap.get(questionId) || {};
    const rawAnswer = existing.raw_answer ?? existing.normalized_answer ?? null;
    const normalizedAnswer = normalizeAnswer(question, rawAnswer);
    let score = 0;
    let metadata = { ...(existing.metadata || {}) };

    if (question.correct_answer?.kind === 'llm_rubric') {
      const llmResult = await gradeWithLLM({
        question,
        candidateAnswer: normalizedAnswer,
        rubric: question.correct_answer.value?.rubric,
        idealAnswer: question.correct_answer.value?.ideal_answer,
        testTitle: test.title,
        taskTitle: attempt.task_title || ''
      });
      score = llmResult.score * Number(question.max_score || 1);
      metadata = {
        ...metadata,
        llm: {
          model: llmResult.model,
          response_id: llmResult.responseId,
          reason: llmResult.reason
        }
      };
      llmEvents.push({
        question_id: questionId,
        model: llmResult.model,
        response_id: llmResult.responseId
      });
    } else if (normalizedAnswer !== null) {
      switch (question.correct_answer?.kind) {
        case 'exact': {
          const expected = question.correct_answer.value;
          if (typeof expected === 'number') {
            const candidateValue = typeof normalizedAnswer === 'number'
              ? normalizedAnswer
              : Number(normalizedAnswer);
            if (Number.isFinite(candidateValue) && candidateValue === expected) {
              score = Number(question.max_score || 1);
            }
          } else {
            const candidate = String(normalizedAnswer).trim().toLowerCase();
            if (candidate === String(expected).trim().toLowerCase()) {
              score = Number(question.max_score || 1);
            }
          }
          break;
        }
        case 'one_of': {
          const expectedValues = Array.isArray(question.correct_answer.value)
            ? question.correct_answer.value.map((value) => String(value).trim().toLowerCase())
            : [];
          const candidate = String(normalizedAnswer).trim().toLowerCase();
          if (expectedValues.includes(candidate)) {
            score = Number(question.max_score || 1);
          }
          break;
        }
        case 'numeric_range': {
          const range = question.correct_answer.value || {};
          const candidateValue = typeof normalizedAnswer === 'number'
            ? normalizedAnswer
            : Number(normalizedAnswer);
          if (
            Number.isFinite(candidateValue) &&
            typeof range.min === 'number' &&
            typeof range.max === 'number' &&
            candidateValue >= range.min &&
            candidateValue <= range.max
          ) {
            score = Number(question.max_score || 1);
          }
          break;
        }
        default: {
          const expected = question.correct_answer?.value;
          if (expected != null) {
            if (String(normalizedAnswer).trim().toLowerCase() === String(expected).trim().toLowerCase()) {
              score = Number(question.max_score || 1);
            }
          }
        }
      }
    }

    totalScore += score;

    scoredResponses.push({
      attempt_id: attempt.id,
      question_id: questionId,
      raw_answer: rawAnswer,
      normalized_answer: normalizedAnswer,
      score,
      metadata
    });
  }

  return {
    totalScore,
    maxScore,
    responses: scoredResponses,
    llm: llmEvents
  };
}

module.exports = {
  normalizeAnswer,
  scoreAttempt
};
