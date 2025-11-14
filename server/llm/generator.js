const { createHash } = require('crypto');
const { validateTest } = require('../validation');

const APTITUDE_TEMPLATE = {
  difficulty: 'medium',
  sections: [
    {
      id: 'general_reasoning',
      name: 'general_reasoning',
      weight: 0.35,
      questions: [
        {
          type: 'multiple_choice',
          prompt: 'Which number completes the series 3, 6, 11, 18, ?',
          options: ['25', '26', '27', '28'],
          correct_answer: { kind: 'exact', value: '27' }
        },
        {
          type: 'multiple_choice',
          prompt: 'If all project leads are engineers and some engineers are designers, which statement must be true?',
          options: [
            'All designers are project leads',
            'Some designers are project leads',
            'Some project leads may be designers',
            'No engineers are project leads'
          ],
          correct_answer: { kind: 'exact', value: 'Some project leads may be designers' }
        },
        {
          type: 'multiple_choice',
          prompt: 'A release checklist has 5 steps that must stay in order. If one step is delayed, what is the safest mitigation?',
          options: [
            'Skip the delayed step',
            'Run the delayed step in parallel without checks',
            'Re-plan downstream tasks while keeping the original order',
            'Move the delayed step to the end'
          ],
          correct_answer: { kind: 'exact', value: 'Re-plan downstream tasks while keeping the original order' }
        },
        {
          type: 'multiple_choice',
          prompt: 'During a code review you notice a risky optimization. What is the most effective next step?',
          options: [
            'Approve and monitor later',
            'Flag the risk and request clarification with suggestions',
            'Reject without comments',
            'Escalate to senior leadership immediately'
          ],
          correct_answer: { kind: 'exact', value: 'Flag the risk and request clarification with suggestions' }
        },
        {
          type: 'multiple_choice',
          prompt: 'A stand-up runs over time because everyone reports in detail. What is the best facilitator action?',
          options: [
            'Shorten future meetings regardless',
            'Ask members to share status asynchronously and keep live updates focused',
            'Stop collecting updates',
            'Add more agenda items'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Ask members to share status asynchronously and keep live updates focused'
          }
        },
        {
          type: 'multiple_choice',
          prompt: 'A QA specialist finds an unclear acceptance criterion. What is the most collaborative action?',
          options: [
            'Log a bug after release',
            'Clarify expectations with the product owner before continuing',
            'Continue testing based on assumptions',
            'Remove the criterion'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Clarify expectations with the product owner before continuing'
          }
        },
        {
          type: 'multiple_choice',
          prompt: 'Two teammates present conflicting interpretations of a metric. What should you do first?',
          options: [
            'Choose the interpretation that fits your intuition',
            'Pause the discussion and agree on a shared definition',
            'Escalate to leadership',
            'Abandon the metric'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Pause the discussion and agree on a shared definition'
          }
        }
      ]
    },
    {
      id: 'math_data',
      name: 'math_data',
      weight: 0.35,
      questions: [
        {
          type: 'numeric',
          prompt: 'A dashboard shows 1,280 active users today versus 960 yesterday. What percent growth is that? (enter number only)',
          correct_answer: { kind: 'exact', value: 33 }
        },
        {
          type: 'numeric',
          prompt: 'Your team runs a batch job every 12 minutes. How many runs occur in a 6 hour maintenance window? (number only)',
          correct_answer: { kind: 'exact', value: 30 }
        },
        {
          type: 'multiple_choice',
          prompt: 'Error logs show 54 failures out of 18,000 requests. What is the error rate?',
          options: ['0.2%', '0.3%', '0.4%', '0.5%'],
          correct_answer: { kind: 'exact', value: '0.3%' }
        },
        {
          type: 'numeric',
          prompt: 'A query improves from 750ms to 420ms. How many milliseconds faster is it now?',
          correct_answer: { kind: 'exact', value: 330 }
        },
        {
          type: 'multiple_choice',
          prompt: 'A system processes 9,000 events per minute. How many in 45 minutes?',
          options: ['180,000', '315,000', '405,000', '450,000'],
          correct_answer: { kind: 'exact', value: '405,000' }
        },
        {
          type: 'numeric',
          prompt: 'The 90th percentile response time is 220ms. The median is 120ms. What is the difference in milliseconds?',
          correct_answer: { kind: 'exact', value: 100 }
        },
        {
          type: 'multiple_choice',
          prompt: 'Storage usage is 420 GB with 12% free space remaining. What is total capacity?',
          options: ['470 GB', '477 GB', '490 GB', '520 GB'],
          correct_answer: { kind: 'exact', value: '477 GB' }
        }
      ]
    },
    {
      id: 'communication',
      name: 'communication',
      weight: 0.3,
      questions: [
        {
          type: 'multiple_choice',
          prompt: 'A stakeholder emails asking for an immediate update outside business hours. What is the best reply?',
          options: [
            'Ignore the request',
            'Promise a solution without context',
            'Acknowledge receipt, set expectations for the next update, and outline the plan',
            'Forward the request without comment'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Acknowledge receipt, set expectations for the next update, and outline the plan'
          }
        },
        {
          type: 'text',
          prompt: 'Write two sentences explaining a production incident to a non-technical executive.',
          correct_answer: {
            kind: 'llm_rubric',
            value: 'Should state impact, mention customer effect, and describe mitigation steps in plain language'
          }
        },
        {
          type: 'multiple_choice',
          prompt: "During a retrospective someone dominates the conversation. What is the facilitator's best action?",
          options: [
            'End the meeting',
            'Ask the person to send thoughts later',
            'Invite quieter voices with structured prompts',
            'Ignore the imbalance'
          ],
          correct_answer: { kind: 'exact', value: 'Invite quieter voices with structured prompts' }
        },
        {
          type: 'text',
          prompt: 'Provide guidance to a junior engineer who keeps merging code without tests.',
          correct_answer: {
            kind: 'llm_rubric',
            value: 'Mentions quality risk, requests tests before merge, offers help or pairing'
          }
        },
        {
          type: 'multiple_choice',
          prompt: 'A customer asks about an ETA you cannot guarantee. How should you respond?',
          options: [
            'Give the earliest possible date',
            'Share current progress, dependencies, and follow up with a committed range',
            'Decline to answer',
            'Refer them to documentation only'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Share current progress, dependencies, and follow up with a committed range'
          }
        },
        {
          type: 'text',
          prompt: 'Draft a short message requesting clarification on ambiguous acceptance criteria.',
          correct_answer: {
            kind: 'llm_rubric',
            value: 'Politely identifies ambiguity, asks for specific detail, and references the user story'
          }
        }
      ]
    }
  ]
};

const DOMAIN_TEMPLATE = {
  difficulty: 'medium',
  sections: [
    {
      id: 'domain_concepts',
      name: 'domain_concepts',
      weight: 0.4,
      questions: [
        {
          type: 'multiple_choice',
          prompt: 'In a Django REST API, which HTTP status code best represents a validation error?',
          options: ['200', '201', '400', '409'],
          correct_answer: { kind: 'exact', value: '400' }
        },
        {
          type: 'multiple_choice',
          prompt: 'Which PostgreSQL index type is preferred for case-insensitive search on text columns?',
          options: ['B-tree', 'GIN', 'GiST', 'BRIN'],
          correct_answer: { kind: 'exact', value: 'GIN' }
        },
        {
          type: 'multiple_choice',
          prompt: 'UPI payments in India require which regulatory compliance when storing credentials?',
          options: [
            'No special compliance',
            'RBI circular on data localization',
            'GDPR only',
            'PCI DSS is optional'
          ],
          correct_answer: { kind: 'exact', value: 'RBI circular on data localization' }
        },
        {
          type: 'multiple_choice',
          prompt: 'Which design ensures idempotent retry for a funds transfer API?',
          options: [
            'Use auto-increment primary keys',
            'Accept a client generated transaction reference and check before processing',
            'Disable retries at the client',
            'Use only GET requests'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Accept a client generated transaction reference and check before processing'
          }
        },
        {
          type: 'multiple_choice',
          prompt: 'Which Django feature helps avoid N+1 queries when serializing related models?',
          options: ['select_related', 'auto_now_add', 'unique_together', 'signals'],
          correct_answer: { kind: 'exact', value: 'select_related' }
        },
        {
          type: 'multiple_choice',
          prompt: 'What is the safest way to store per-user API keys in the database?',
          options: [
            'Store plain text keys',
            'Hash with bcrypt and salt',
            'Encrypt with reversible key stored in code',
            'Store in session only'
          ],
          correct_answer: { kind: 'exact', value: 'Hash with bcrypt and salt' }
        },
        {
          type: 'multiple_choice',
          prompt: 'Which queue guarantees message ordering for a single partition?',
          options: ['RabbitMQ fanout', 'Kafka partition', 'SQS standard', 'Google Pub/Sub'],
          correct_answer: { kind: 'exact', value: 'Kafka partition' }
        },
        {
          type: 'multiple_choice',
          prompt: 'Which tool helps profile slow ORM queries in production safely?',
          options: ['print statements', 'Django debug toolbar', 'Sampling APM agent', 'Manual SQL logging'],
          correct_answer: { kind: 'exact', value: 'Sampling APM agent' }
        }
      ]
    },
    {
      id: 'architecture_scaling',
      name: 'architecture_scaling',
      weight: 0.35,
      questions: [
        {
          type: 'multiple_choice',
          prompt: 'A service must handle 5x traffic spikes during Indian market open. What is the best scaling approach?',
          options: [
            'Manual scaling after incidents',
            'Horizontal auto-scaling with warm pools',
            'Vertical scaling only',
            'Disable new logins'
          ],
          correct_answer: { kind: 'exact', value: 'Horizontal auto-scaling with warm pools' }
        },
        {
          type: 'multiple_choice',
          prompt: 'Which caching strategy protects consistency for account balances?',
          options: ['Write-behind cache', 'Read-through with short TTL', 'Cache-only', 'No cache'],
          correct_answer: { kind: 'exact', value: 'Read-through with short TTL' }
        },
        {
          type: 'multiple_choice',
          prompt: 'Payments service must log every change immutably. Which storage design fits?',
          options: ['Overwrite records', 'Event sourcing with append-only log', 'Use CSV exports', 'Store in cache'],
          correct_answer: { kind: 'exact', value: 'Event sourcing with append-only log' }
        },
        {
          type: 'multiple_choice',
          prompt: 'A nightly job reads 40 million rows. What optimization helps most?',
          options: ['Add pagination', 'Use COPY into warehouse', 'Increase CPU only', 'Randomize ordering'],
          correct_answer: { kind: 'exact', value: 'Use COPY into warehouse' }
        },
        {
          type: 'numeric',
          prompt: 'A Kafka topic has 6 partitions and each handles 1,500 messages per second. How many per second overall?',
          correct_answer: { kind: 'exact', value: 9000 }
        },
        {
          type: 'multiple_choice',
          prompt: 'Which metric best indicates backpressure on a Celery worker pool?',
          options: ['CPU usage', 'Queue wait time', 'Number of hosts', 'Disk usage'],
          correct_answer: { kind: 'exact', value: 'Queue wait time' }
        },
        {
          type: 'multiple_choice',
          prompt: 'How do you prevent double processing when a worker restarts mid-task?',
          options: [
            'Disable retries',
            'Use distributed locks or task leasing with heartbeats',
            'Rely on timestamps',
            'Ignore the issue'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Use distributed locks or task leasing with heartbeats'
          }
        }
      ]
    },
    {
      id: 'regulation_scenarios',
      name: 'regulation_scenarios',
      weight: 0.25,
      questions: [
        {
          type: 'multiple_choice',
          prompt: 'What should you do before shipping a feature that stores Aadhaar numbers?',
          options: [
            'Store as plain text',
            'Ensure masking, encryption, and consent per UIDAI guidelines',
            'Keep only in logs',
            'Send to third party'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Ensure masking, encryption, and consent per UIDAI guidelines'
          }
        },
        {
          type: 'text',
          prompt: 'Outline how you would respond to an RBI audit request for transaction logs within 48 hours.',
          correct_answer: {
            kind: 'llm_rubric',
            value: 'Mentions secure archive, access controls, extraction process, and audit trail delivery'
          }
        },
        {
          type: 'multiple_choice',
          prompt: 'An incident caused double debits for 12 customers. What is the correct first action?',
          options: [
            'Hide the issue',
            'Notify compliance, credit customers, and publish RCA',
            'Wait for customers to raise tickets',
            'Restore from backup immediately'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Notify compliance, credit customers, and publish RCA'
          }
        },
        {
          type: 'text',
          prompt: 'Draft a short explanation for operations on why settlement latency increased during a bank holiday.',
          correct_answer: {
            kind: 'llm_rubric',
            value: 'References bank cut-off times, queue backlogs, and expected catch-up plan'
          }
        },
        {
          type: 'multiple_choice',
          prompt: 'Which report must be filed to RBI after a significant payment outage?',
          options: [
            'No report is needed',
            'System downtime notification within 24 hours',
            'Quarterly marketing summary',
            'GST reconciliation'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'System downtime notification within 24 hours'
          }
        }
      ]
    }
  ]
};

function cloneTemplate(template) {
  return JSON.parse(JSON.stringify(template));
}

function buildPrompt({ taskSummary, type }) {
  const sectionsDescription = type === 'aptitude'
    ? '• 20 questions split across general reasoning, math/data, and communication judgment with weights 35/35/30'
    : '• 20 questions covering backend/domain concepts, architecture & scaling, and regulatory scenarios with weights 40/35/25';

  const jobDetails = [
    `Role: ${taskSummary.role_title || taskSummary.title || 'N/A'}`,
    taskSummary.domain_industry ? `Industry: ${taskSummary.domain_industry}` : null,
    taskSummary.location ? `Location: ${taskSummary.location}` : null,
    taskSummary.must_have_skills ? `Core skills: ${taskSummary.must_have_skills.join(', ')}` : null
  ]
    .filter(Boolean)
    .join('\n');

  return [
    `You are an assessment design model that must emit strict JSON following the provided schema.`,
    sectionsDescription,
    `Ensure exactly 20 questions, each scoring 1 point, with falsifiable answers.`,
    `Incorporate job context:`,
    jobDetails,
    `Respond with JSON only.`
  ].join('\n');
}

function assignQuestionIds(sections, testId) {
  return sections.map((section, sectionIndex) => {
    const prefix = `${section.id}_${sectionIndex + 1}`;
    return {
      ...section,
      questions: section.questions.map((question, questionIndex) => ({
        ...question,
        id: `${prefix}_${questionIndex + 1}`,
        max_score: 1
      }))
    };
  });
}

function applyTaskContextToSections(sections, taskSummary) {
  const summaryPieces = [];
  if (taskSummary.role_title) summaryPieces.push(taskSummary.role_title);
  if (taskSummary.domain_industry) summaryPieces.push(taskSummary.domain_industry);
  if (taskSummary.location) summaryPieces.push(taskSummary.location);
  const summary = summaryPieces.join(' • ');

  return sections.map((section) => {
    if (section.id === 'communication' || section.id === 'regulation_scenarios') {
      return {
        ...section,
        questions: section.questions.map((question) => {
          if (question.type === 'text') {
            return {
              ...question,
              prompt: `${question.prompt}\nContext: ${summary}`
            };
          }
          return question;
        })
      };
    }
    return section;
  });
}

function generateTest({ taskId, type, difficulty = 'medium', taskSummary }) {
  const template = type === 'aptitude' ? cloneTemplate(APTITUDE_TEMPLATE) : cloneTemplate(DOMAIN_TEMPLATE);
  const baseId = `${type}-${createHash('sha1').update(taskId + Date.now().toString()).digest('hex').slice(0, 8)}`;
  const testId = `test-${baseId}`;
  const publicId = `pub-${baseId}`;
  const sectionsWithIds = assignQuestionIds(template.sections, testId);
  const sectionsWithContext = applyTaskContextToSections(sectionsWithIds, taskSummary || {});

  const test = {
    id: testId,
    public_id: publicId,
    hiring_task_id: taskId,
    type,
    difficulty,
    sections: sectionsWithContext,
    metadata: {
      version: 1,
      generated_at: new Date().toISOString(),
      source_model: 'mock-llm-generator'
    }
  };

  const validation = validateTest(test);
  if (!validation.success) {
    const error = new Error('Generated test failed validation');
    error.details = validation.errors;
    throw error;
  }

  return {
    test,
    prompt: buildPrompt({ taskSummary: taskSummary || {}, type })
  };
}

function applyAiEdit({ test, instructions }) {
  const updated = JSON.parse(JSON.stringify(test));
  const summary = instructions.trim().slice(0, 160);
  updated.sections = updated.sections.map((section, sectionIndex) => ({
    ...section,
    questions: section.questions.map((question, questionIndex) => {
      if (questionIndex === 0) {
        return {
          ...question,
          prompt: `${question.prompt}\n\n(Updated per instructions: ${summary})`
        };
      }
      return question;
    })
  }));

  updated.metadata = {
    ...updated.metadata,
    generated_at: new Date().toISOString(),
    source_model: 'mock-llm-editor'
  };

  const validation = validateTest(updated);
  if (!validation.success) {
    const error = new Error('Edited test failed validation');
    error.details = validation.errors;
    throw error;
  }

  return {
    test: updated,
    prompt: `You are editing an existing assessment. Apply these instructions while keeping schema fidelity: ${instructions}`
  };
}

module.exports = {
  generateTest,
  applyAiEdit,
  buildPrompt
};
