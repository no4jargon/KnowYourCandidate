const { randomUUID } = require('crypto');
const { z } = require('zod');
const { callOpenAIWithSchema } = require('./llmClient');

const CorrectAnswerSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('exact'),
    value: z.union([z.string(), z.number()])
  }),
  z.object({
    kind: z.literal('one_of'),
    value: z.array(z.string()).min(1)
  }),
  z
    .object({
      kind: z.literal('numeric_range'),
      value: z.object({
        min: z.number(),
        max: z.number()
      })
    })
    .refine((data) => data.value.min <= data.value.max, {
      message: 'numeric_range values must have min <= max',
      path: ['value']
    }),
  z.object({
    kind: z.literal('llm_rubric'),
    value: z.object({
      rubric: z.string().min(1),
      ideal_answer: z.string().optional()
    })
  })
]);

const QuestionSchema = z
  .object({
    id: z.string().uuid().optional(),
    type: z.enum(['multiple_choice', 'numeric', 'text']),
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).optional(),
    correct_answer: CorrectAnswerSchema,
    max_score: z.number().positive().max(1)
  })
  .superRefine((question, ctx) => {
    if (question.max_score !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Each question must have a max_score of 1',
        path: ['max_score']
      });
    }

    if (question.type === 'multiple_choice') {
      if (!question.options || question.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Multiple choice questions require at least two options',
          path: ['options']
        });
      }
      if (question.correct_answer.kind === 'llm_rubric') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Multiple choice questions cannot use llm_rubric grading',
          path: ['correct_answer']
        });
      }
    } else if (question.options && question.options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Only multiple choice questions can provide options',
        path: ['options']
      });
    }

    if (question.type !== 'text' && question.correct_answer.kind === 'llm_rubric') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Only text questions may use llm_rubric answers',
        path: ['correct_answer']
      });
    }
  });

const TestSectionSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().min(1),
    weight: z.number().min(0),
    questions: z.array(QuestionSchema).min(1)
  })
  .superRefine((section, ctx) => {
    if (section.weight <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Section weights must be positive',
        path: ['weight']
      });
    }
  });

const SectionsSchema = z
  .array(TestSectionSchema)
  .min(1)
  .superRefine((sections, ctx) => {
    const totalQuestions = sections.reduce((sum, section) => sum + section.questions.length, 0);
    if (totalQuestions !== 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tests must include exactly 20 questions',
        path: []
      });
    }

    const totalWeight = sections.reduce((sum, section) => sum + section.weight, 0);
    if (Math.abs(totalWeight - 1) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Section weights must sum to 1',
        path: []
      });
    }
  });

const TestContentSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  sections: SectionsSchema
});

const TestGenerationJsonSchema = {
  type: 'object',
  required: ['title', 'difficulty', 'sections'],
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
    sections: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['name', 'weight', 'questions'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          weight: { type: 'number' },
          questions: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['type', 'prompt', 'correct_answer', 'max_score'],
              properties: {
                id: { type: 'string', format: 'uuid' },
                type: { type: 'string', enum: ['multiple_choice', 'numeric', 'text'] },
                prompt: { type: 'string' },
                options: {
                  type: 'array',
                  items: { type: 'string' }
                },
                correct_answer: {
                  type: 'object',
                  required: ['kind', 'value'],
                  properties: {
                    kind: {
                      type: 'string',
                      enum: ['exact', 'one_of', 'numeric_range', 'llm_rubric']
                    },
                    value: {
                      anyOf: [
                        { type: 'string' },
                        { type: 'number' },
                        {
                          type: 'array',
                          items: { type: 'string' }
                        },
                        {
                          type: 'object',
                          required: ['min', 'max'],
                          properties: {
                            min: { type: 'number' },
                            max: { type: 'number' }
                          }
                        },
                        {
                          type: 'object',
                          required: ['rubric'],
                          properties: {
                            rubric: { type: 'string' }
                          },
                          additionalProperties: true
                        }
                      ]
                    }
                  },
                  additionalProperties: true
                },
                max_score: { type: 'number' }
              },
              additionalProperties: false
            }
          }
        },
        additionalProperties: false
      }
    }
  },
  additionalProperties: false
};

function ensureIdentifiers(test) {
  return {
    ...test,
    sections: test.sections.map((section) => ({
      ...section,
      id: section.id || randomUUID(),
      questions: section.questions.map((question) => ({
        ...question,
        id: question.id || randomUUID()
      }))
    }))
  };
}

function normalizeTest(test) {
  const withIds = ensureIdentifiers(test);

  return {
    ...withIds,
    sections: withIds.sections.map((section) => ({
      ...section,
      questions: section.questions.map((question) => ({
        ...question,
        max_score: 1
      }))
    }))
  };
}

function fallbackAptitudeTest(facets, difficulty = 'medium') {
  const role = facets?.role_title || 'candidate';
  const industry = facets?.domain_industry || 'business';
  const sections = [
    {
      name: 'General Reasoning',
      weight: 0.34,
      questions: [
        {
          type: 'multiple_choice',
          prompt: `You are reviewing two proposals for a ${role} project. Proposal A is fast but risky; Proposal B is slower but aligns with long-term goals. What should you do first?`,
          options: [
            'Pick Proposal A to show urgency',
            'Collect more information about success criteria and risk tolerance',
            'Choose Proposal B because it is safer',
            'Ask the team to vote anonymously'
          ],
          correct_answer: { kind: 'exact', value: 'Collect more information about success criteria and risk tolerance' },
          max_score: 1
        },
        {
          type: 'multiple_choice',
          prompt: 'A sequence of deliverables follows the pattern 2, 4, 8, 16. What is the next value?',
          options: ['24', '30', '32', '36'],
          correct_answer: { kind: 'exact', value: '32' },
          max_score: 1
        },
        {
          type: 'multiple_choice',
          prompt: `While planning a ${industry} initiative, you encounter conflicting stakeholder priorities. Which approach best resolves the conflict?`,
          options: [
            'Ask leadership to decide without data',
            'Delay the project until priorities align on their own',
            'Facilitate a session to clarify objectives, constraints, and success metrics',
            'Choose the stakeholder with the highest seniority'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Facilitate a session to clarify objectives, constraints, and success metrics'
          },
          max_score: 1
        },
        {
          type: 'multiple_choice',
          prompt: 'Which statement is an assumption that should be validated?',
          options: [
            'The project will deliver value if the target metrics move in the right direction.',
            'Stakeholders agree the pilot will finish in four weeks.',
            'Team velocity has increased for three consecutive sprints.',
            'The latest release reduced customer support tickets by 12%.'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Stakeholders agree the pilot will finish in four weeks.'
          },
          max_score: 1
        },
        {
          type: 'multiple_choice',
          prompt: 'A root-cause analysis reveals the same issue appearing in three separate workflows. What should you prioritize?',
          options: [
            'Implement three distinct fixes for each workflow',
            'Address the shared root cause with a single coordinated change',
            'Wait to see if the issue resolves itself next quarter',
            'Escalate immediately without further analysis'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Address the shared root cause with a single coordinated change'
          },
          max_score: 1
        },
        {
          type: 'multiple_choice',
          prompt: 'You inherit a project brief with vague acceptance criteria. What is the best action?',
          options: [
            'Start development and clarify later',
            'Ask for examples, metrics, and test cases before work begins',
            'Duplicate the last successful project plan',
            'Assign blame to the previous owner'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Ask for examples, metrics, and test cases before work begins'
          },
          max_score: 1
        },
        {
          type: 'multiple_choice',
          prompt: 'A dashboard shows an unexpected drop in conversions. What is your first step?',
          options: [
            'Alert the sales team immediately',
            'Verify the data quality and instrumented metrics',
            'Ignore it because one data point is insignificant',
            'Release a hotfix without analysis'
          ],
          correct_answer: { kind: 'exact', value: 'Verify the data quality and instrumented metrics' },
          max_score: 1
        }
      ]
    },
    {
      name: 'Math & Data',
      weight: 0.33,
      questions: [
        {
          type: 'numeric',
          prompt: 'A dataset contains 1200 records. 15% are incomplete. How many records are incomplete?',
          correct_answer: { kind: 'exact', value: 180 },
          max_score: 1
        },
        {
          type: 'numeric',
          prompt: 'A conversion funnel drops from 2,400 visitors to 720 sign-ups. What is the conversion rate?',
          correct_answer: { kind: 'numeric_range', value: { min: 29, max: 31 } },
          max_score: 1
        },
        {
          type: 'numeric',
          prompt: 'You run an experiment and measure an average uplift of 4.8% with a margin of error of ±0.6%. What is the plausible range?',
          correct_answer: { kind: 'numeric_range', value: { min: 4.2, max: 5.4 } },
          max_score: 1
        },
        {
          type: 'numeric',
          prompt: 'A backlog burndown shows 45 story points remaining. The team completes 9 points per sprint. How many sprints remain?',
          correct_answer: { kind: 'exact', value: 5 },
          max_score: 1
        },
        {
          type: 'numeric',
          prompt: 'You need to allocate a $60,000 quarterly budget evenly across 5 initiatives. How much does each receive?',
          correct_answer: { kind: 'exact', value: 12000 },
          max_score: 1
        },
        {
          type: 'numeric',
          prompt: 'Two analysts produce estimates of 40 hours and 52 hours. What is the average?',
          correct_answer: { kind: 'exact', value: 46 },
          max_score: 1
        },
        {
          type: 'numeric',
          prompt: 'A success metric must increase by at least 12% to justify investment. The baseline is 250 units. What is the minimum target?',
          correct_answer: { kind: 'exact', value: 280 },
          max_score: 1
        }
      ]
    },
    {
      name: 'Communication',
      weight: 0.33,
      questions: [
        {
          type: 'text',
          prompt: `Draft a short update explaining a slipped deadline to cross-functional partners for the ${role} project. Focus on next steps.`,
          correct_answer: {
            kind: 'llm_rubric',
            value: {
              rubric:
                'Score 1 if the response acknowledges the slip, explains the reason without blame, outlines remediation steps, and provides a new timeline. Otherwise score 0.'
            }
          },
          max_score: 1
        },
        {
          type: 'text',
          prompt: `Explain how you would translate a complex ${industry} metric to a non-technical executive in two sentences.`,
          correct_answer: {
            kind: 'llm_rubric',
            value: {
              rubric: 'Score 1 if the answer removes jargon, connects the metric to business impact, and remains concise (<= 3 sentences).'
            }
          },
          max_score: 1
        },
        {
          type: 'text',
          prompt: 'Write a quick agenda (three bullet points) for a stakeholder kickoff meeting.',
          correct_answer: {
            kind: 'llm_rubric',
            value: {
              rubric: 'Score 1 if the agenda includes objectives, key discussion topics, and next steps or responsibilities.'
            }
          },
          max_score: 1
        },
        {
          type: 'text',
          prompt: 'Summarize a one-page research memo into two actionable recommendations.',
          correct_answer: {
            kind: 'llm_rubric',
            value: {
              rubric: 'Score 1 if the answer condenses to two numbered recommendations that clearly link to business outcomes.'
            }
          },
          max_score: 1
        },
        {
          type: 'text',
          prompt: 'Provide a concise feedback message for a teammate whose presentation overran and skipped the Q&A.',
          correct_answer: {
            kind: 'llm_rubric',
            value: {
              rubric: 'Score 1 if feedback is specific, actionable, and balances impact with encouragement.'
            }
          },
          max_score: 1
        },
        {
          type: 'text',
          prompt: 'Compose two clarifying questions you would email after receiving unclear acceptance criteria.',
          correct_answer: {
            kind: 'llm_rubric',
            value: {
              rubric: 'Score 1 if the answer provides exactly two questions that clarify outcomes and constraints.'
            }
          },
          max_score: 1
        }
      ]
    }
  ];

  return {
    title: `${role} Aptitude Assessment`,
    description: 'Foundational reasoning, math/data, and communication skills tailored to the role.',
    difficulty,
    sections
  };
}

function fallbackDomainTest(facets, difficulty = 'medium') {
  const role = facets?.role_title || 'candidate';
  const industry = facets?.domain_industry || 'your industry';
  const tools = facets?.tools_and_tech?.length ? facets.tools_and_tech : ['core platform'];
  const tasks = facets?.typical_tasks?.length ? facets.typical_tasks : ['deliver critical work'];

  const sections = [
    {
      name: 'Domain Concepts',
      weight: 0.45,
      questions: [
        {
          type: 'multiple_choice',
          prompt: `Which statement best captures a key principle in ${industry}?`,
          options: [
            `Compliance is optional if ${industry} growth is rapid`,
            `User trust and regulatory alignment are foundational to sustainable ${industry} products`,
            `Only brand awareness matters in ${industry}`,
            `Operational resilience is unrelated to ${industry}`
          ],
          correct_answer: {
            kind: 'exact',
            value: `User trust and regulatory alignment are foundational to sustainable ${industry} products`
          },
          max_score: 1
        },
        {
          type: 'multiple_choice',
          prompt: `Which ${role} deliverable demonstrates market understanding?`,
          options: [
            'A backlog of unprioritized tasks',
            'A roadmap that links user problems, solutions, and measurable outcomes',
            'A list of personal preferences',
            'A set of unresolved bug reports'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'A roadmap that links user problems, solutions, and measurable outcomes'
          },
          max_score: 1
        },
        {
          type: 'multiple_choice',
          prompt: `What is a leading indicator for success in ${industry}?`,
          options: [
            'Lagging revenue after two years',
            'Customer activation metrics tied to the value proposition',
            'Employee lunch satisfaction surveys',
            'Office seating density'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Customer activation metrics tied to the value proposition'
          },
          max_score: 1
        },
        {
          type: 'multiple_choice',
          prompt: `Which practice best mitigates risk in ${industry}?`,
          options: [
            'Skipping retrospectives to move faster',
            'Running impact assessments and contingency planning',
            'Locking requirements for a year',
            'Ignoring partner dependencies'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Running impact assessments and contingency planning'
          },
          max_score: 1
        },
        {
          type: 'multiple_choice',
          prompt: `Which artifact demonstrates empathy for ${industry} users?`,
          options: [
            'A generic feature list',
            'Journey maps showing pain points and opportunities',
            'A staffing plan',
            'A status email'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Journey maps showing pain points and opportunities'
          },
          max_score: 1
        },
        {
          type: 'text',
          prompt: `Describe a key regulatory or compliance consideration unique to ${industry}.`,
          correct_answer: {
            kind: 'llm_rubric',
            value: {
              rubric: `Score 1 if the answer cites a concrete regulation, standard, or policy relevant to ${industry} and explains why it matters.`
            }
          },
          max_score: 1
        },
        {
          type: 'text',
          prompt: `Outline one measurable KPI that signals success for ${role} work in ${industry}.`,
          correct_answer: {
            kind: 'llm_rubric',
            value: {
              rubric: 'Score 1 if the KPI is specific, quantifiable, and clearly tied to business outcomes.'
            }
          },
          max_score: 1
        },
        {
          type: 'multiple_choice',
          prompt: `Which tool is most appropriate for analyzing ${industry} performance?`,
          options: [
            tools[0],
            'A whiteboard',
            'Personal calendar software',
            'Team chat emojis'
          ],
          correct_answer: { kind: 'exact', value: tools[0] },
          max_score: 1
        }
      ]
    },
    {
      name: 'Domain Scenarios',
      weight: 0.35,
      questions: [
        {
          type: 'multiple_choice',
          prompt: `A pilot launch reveals that ${industry} customers abandon the flow halfway. What should you do first?`,
          options: [
            'Shut down the pilot immediately',
            'Analyze qualitative feedback and instrumentation to pinpoint the drop-off cause',
            'Add more marketing spend',
            'Ignore it because the pilot is small'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Analyze qualitative feedback and instrumentation to pinpoint the drop-off cause'
          },
          max_score: 1
        },
        {
          type: 'multiple_choice',
          prompt: `Your team must deliver ${tasks[0]} while a dependency slips. What is your response?`,
          options: [
            'Declare success anyway',
            'Escalate early, replan around the dependency, and communicate impact to stakeholders',
            'Do nothing and hope it resolves',
            'Cancel the project entirely'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Escalate early, replan around the dependency, and communicate impact to stakeholders'
          },
          max_score: 1
        },
        {
          type: 'text',
          prompt: `Explain how you would validate a hypothesis about ${industry} user behavior before a full build.`,
          correct_answer: {
            kind: 'llm_rubric',
            value: {
              rubric: 'Score 1 if the plan references experiments or research with measurable success criteria.'
            }
          },
          max_score: 1
        },
        {
          type: 'numeric',
          prompt: 'A monthly active user target is 48,000. Current is 36,000. What percent growth is required to hit target?',
          correct_answer: { kind: 'numeric_range', value: { min: 32, max: 35 } },
          max_score: 1
        },
        {
          type: 'multiple_choice',
          prompt: 'A cross-functional team disagrees on the problem framing. What facilitation technique should you use?',
          options: [
            'Move straight to solutions',
            'Run a structured discovery workshop capturing user evidence and success criteria',
            'Assign the loudest voice to decide',
            'Delay the project indefinitely'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Run a structured discovery workshop capturing user evidence and success criteria'
          },
          max_score: 1
        },
        {
          type: 'multiple_choice',
          prompt: `Your leadership requests a forecast for ${industry} demand with little data. What is the best response?`,
          options: [
            'Provide an optimistic guess',
            'Explain the uncertainty, propose confidence ranges, and outline data needed to improve accuracy',
            'Refuse to answer',
            'Change the topic'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Explain the uncertainty, propose confidence ranges, and outline data needed to improve accuracy'
          },
          max_score: 1
        },
        {
          type: 'text',
          prompt: `Describe a mitigation plan if a key ${tools[0]} integration fails during peak usage.`,
          correct_answer: {
            kind: 'llm_rubric',
            value: {
              rubric: 'Score 1 if the answer covers immediate containment, communication, and a long-term fix.'
            }
          },
          max_score: 1
        },
        {
          type: 'multiple_choice',
          prompt: `Which metric best reflects the success of ${tasks[0]}?`,
          options: [
            'Hours worked',
            'Feature count delivered',
            'A leading indicator tied to user or business value',
            'Number of meetings scheduled'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'A leading indicator tied to user or business value'
          },
          max_score: 1
        }
      ]
    },
    {
      name: 'Regulatory & Regional Context',
      weight: 0.2,
      questions: [
        {
          type: 'multiple_choice',
          prompt: `Which action demonstrates compliance mindfulness for ${industry}?`,
          options: [
            'Launching without legal review',
            'Partnering with legal early to review data usage and consent flows',
            'Saving audits for the end of the year',
            'Allowing each engineer to interpret regulations independently'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Partnering with legal early to review data usage and consent flows'
          },
          max_score: 1
        },
        {
          type: 'text',
          prompt: `Name one region-specific consideration the ${role} must respect in ${facets?.region_context || 'target markets'}.`,
          correct_answer: {
            kind: 'llm_rubric',
            value: {
              rubric: 'Score 1 if the answer references a regulation, cultural norm, or localization need tied to the region.'
            }
          },
          max_score: 1
        },
        {
          type: 'multiple_choice',
          prompt: 'What is the best practice for storing personally identifiable information?',
          options: [
            'Keep everything in plain text',
            'Apply encryption at rest and in transit with strict access controls',
            'Share files via public links',
            'Email spreadsheets to the team'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Apply encryption at rest and in transit with strict access controls'
          },
          max_score: 1
        },
        {
          type: 'multiple_choice',
          prompt: 'When a regulation changes mid-project, how should the team respond?',
          options: [
            'Ignore it until launch',
            'Pause to assess impact, update requirements, and communicate adjustments to stakeholders',
            'Hope auditors do not notice',
            'Remove security reviews from scope'
          ],
          correct_answer: {
            kind: 'exact',
            value: 'Pause to assess impact, update requirements, and communicate adjustments to stakeholders'
          },
          max_score: 1
        }
      ]
    }
  ];

  return {
    title: `${role} Domain Mastery Assessment`,
    description: `Practical scenarios and knowledge checks tailored to ${industry}.`,
    difficulty,
    sections
  };
}

function fallbackTest(kind, facets, difficulty) {
  return kind === 'aptitude'
    ? fallbackAptitudeTest(facets, difficulty)
    : fallbackDomainTest(facets, difficulty);
}

function buildMetadata({ model, instructions }) {
  return {
    version: 1,
    generated_at: new Date().toISOString(),
    source_model: model,
    instructions: instructions || null
  };
}

async function generateTest({ kind, facets, jobDescription, instructions = '', difficulty = 'medium' }) {
  if (!['aptitude', 'domain'].includes(kind)) {
    throw new Error('Unsupported test kind');
  }

  try {
    const { model, response_id, payload } = await callOpenAIWithSchema({
      messages: [
        {
          role: 'system',
          content:
            'You design hiring assessments. Always output JSON that matches the provided schema. Include exactly 20 questions split into sections with weights summing to 1.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Create a ${kind} test for the following role. Enforce 20 questions, binary scoring, and schema compliance.\n` +
                `Difficulty: ${difficulty}.\n` +
                `Job facets: ${JSON.stringify(facets, null, 2)}\n` +
                (instructions ? `Employer instructions: ${instructions}\n` : '') +
                (jobDescription ? `Job description:\n${jobDescription}` : '')
            }
          ]
        }
      ],
      schema: { name: `${kind}_assessment`, schema: TestGenerationJsonSchema }
    });

    const parsed = TestContentSchema.parse(payload);
    const normalized = normalizeTest(parsed);
    return {
      model,
      responseId: response_id,
      test: normalized,
      metadata: buildMetadata({ model, instructions })
    };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      const fallback = fallbackTest(kind, facets, difficulty);
      const parsed = TestContentSchema.parse(fallback);
      const normalized = normalizeTest(parsed);
      return {
        model: 'fallback-test-generator-v1',
        responseId: 'local-fallback',
        test: normalized,
        metadata: buildMetadata({ model: 'fallback-test-generator-v1', instructions })
      };
    }
    throw error;
  }
}

async function editTestWithPrompt(existingTest, instructions) {
  if (!instructions || !instructions.trim()) {
    throw new Error('Instructions are required');
  }

  const currentContent = {
    title: existingTest.title,
    description: existingTest.description || '',
    difficulty: existingTest.difficulty || 'medium',
    sections: existingTest.sections || []
  };

  try {
    const { model, response_id, payload } = await callOpenAIWithSchema({
      messages: [
        {
          role: 'system',
          content:
            'You are updating an existing hiring assessment. Always return JSON matching the schema with exactly 20 questions and binary scoring.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                `Existing test (JSON):\n${JSON.stringify(currentContent, null, 2)}\n\n` +
                `Apply the employer instructions below while preserving schema validity, question count, and falsifiable answers.\n` +
                `Instructions: ${instructions}`
            }
          ]
        }
      ],
      schema: { name: 'test_edit', schema: TestGenerationJsonSchema }
    });

    const parsed = TestContentSchema.parse(payload);
    const normalized = normalizeTest(parsed);
    return {
      model,
      responseId: response_id,
      test: normalized
    };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      const parsed = TestContentSchema.parse(currentContent);
      const normalized = normalizeTest(parsed);
      return {
        model: 'fallback-test-editor-v1',
        responseId: 'local-fallback',
        test: normalized
      };
    }
    throw error;
  }
}

function validateTestUpdate({ sections, ...rest }) {
  let validatedSections;
  if (sections) {
    const parsed = SectionsSchema.parse(sections);
    validatedSections = normalizeTest({
      title: 'placeholder',
      difficulty: 'medium',
      sections: parsed
    }).sections;
  }

  return {
    ...rest,
    ...(validatedSections ? { sections: validatedSections } : {})
  };
}

module.exports = {
  generateTest,
  TestContentSchema,
  SectionsSchema,
  validateTestUpdate,
  editTestWithPrompt
};
