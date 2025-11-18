const { randomUUID } = require('crypto');
const { z } = require('zod');
const { callOpenAIWithSchema } = require('./llmClient');

const InterviewQuestionSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(['opening', 'background', 'technical', 'behavioral', 'domain_scenario', 'wrap_up']),
  prompt: z.string().min(1),
  follow_ups: z.array(z.string().min(1)).optional()
});

const InterviewScriptSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  script: z.array(InterviewQuestionSchema).min(6).max(15)
});

const InterviewScriptJsonSchema = {
  type: 'object',
  required: ['title', 'script'],
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    script: {
      type: 'array',
      minItems: 6,
      maxItems: 15,
      items: {
        type: 'object',
        required: ['type', 'prompt'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          type: {
            type: 'string',
            enum: ['opening', 'background', 'technical', 'behavioral', 'domain_scenario', 'wrap_up']
          },
          prompt: { type: 'string' },
          follow_ups: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        additionalProperties: false
      }
    }
  },
  additionalProperties: false
};

function ensureQuestionIds(script) {
  return script.map((question) => ({
    ...question,
    id: question.id || randomUUID()
  }));
}

function fallbackInterviewScript(facets) {
  const role = facets?.role_title || 'candidate';
  const industry = facets?.domain_industry || 'the industry';
  const tasks = facets?.typical_tasks?.slice(0, 3) || ['deliver projects', 'collaborate cross-functionally', 'measure impact'];
  const tools = facets?.tools_and_tech?.slice(0, 2) || ['core platform'];

  const script = [
    {
      type: 'opening',
      prompt: `Thanks for joining today. To start, what excited you about this ${role} role focused on ${industry}?`
    },
    {
      type: 'background',
      prompt: 'Walk me through a recent project where you had to align multiple stakeholders with different priorities.'
    },
    {
      type: 'technical',
      prompt: `Describe how you have used ${tools[0]} (or a similar tool) to drive measurable outcomes.`,
      follow_ups: ['What was the baseline metric and how did it change?', 'How did you validate the improvement?']
    },
    {
      type: 'domain_scenario',
      prompt: `Imagine ${tasks[0]} is behind schedule due to a dependency outside your control. How would you respond?`,
      follow_ups: ['Who needs to be looped in immediately?', 'How would you adjust the plan?']
    },
    {
      type: 'behavioral',
      prompt: 'Tell me about a time you received difficult feedback from a teammate or stakeholder. What did you do with it?'
    },
    {
      type: 'technical',
      prompt: `Share how you would evaluate the success of ${tasks[1] || 'a core initiative'} within the first 90 days.`,
      follow_ups: ['Which leading indicators matter most?', 'How would you instrument those signals?']
    },
    {
      type: 'domain_scenario',
      prompt: `A regulatory change impacts ${industry}. How would you assess the impact on our roadmap?`,
      follow_ups: ['What additional data would you gather?', 'Who are the critical partners in this analysis?']
    },
    {
      type: 'wrap_up',
      prompt: 'What questions do you have for us about the role, team, or expectations?'
    }
  ];

  return {
    title: `${role} Interview Script`,
    description: 'Structured conversation guide covering motivations, execution, collaboration, and closing.',
    script
  };
}

async function generateInterviewScript({ facets, jobDescription, instructions = '' }) {
  try {
    const { model, response_id, payload } = await callOpenAIWithSchema({
      messages: [
        {
          role: 'system',
          content:
            'You draft structured interview scripts. Output JSON with 6-12 questions spanning opening, background, technical, behavioral, and wrap_up topics.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                `Create an interview script tailored to this role. Ensure varied question types and actionable follow-ups when helpful.\n` +
                `Job facets: ${JSON.stringify(facets, null, 2)}\n` +
                (instructions ? `Employer instructions: ${instructions}\n` : '') +
                (jobDescription ? `Job description:\n${jobDescription}` : '')
            }
          ]
        }
      ],
      schema: { name: 'interview_script', schema: InterviewScriptJsonSchema }
    });

    const parsed = InterviewScriptSchema.parse({
      ...payload,
      script: ensureQuestionIds(payload.script || [])
    });

    return {
      model,
      responseId: response_id,
      script: parsed,
      metadata: {
        version: 1,
        generated_at: new Date().toISOString(),
        source_model: model,
        instructions: instructions || null
      }
    };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      const fallback = fallbackInterviewScript(facets);
      const parsed = InterviewScriptSchema.parse({
        ...fallback,
        script: ensureQuestionIds(fallback.script)
      });
      return {
        model: 'fallback-interview-script-v1',
        responseId: 'local-fallback',
        script: parsed,
        metadata: {
          version: 1,
          generated_at: new Date().toISOString(),
          source_model: 'fallback-interview-script-v1',
          instructions: instructions || null
        }
      };
    }
    throw error;
  }
}

const InterviewScriptUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  script: z.array(InterviewQuestionSchema).min(6).max(15).optional()
});

function validateInterviewScriptUpdate(update) {
  if (!update) return {};
  const parsed = InterviewScriptUpdateSchema.parse(update);
  if (parsed.script) {
    parsed.script = ensureQuestionIds(parsed.script);
  }
  return parsed;
}

module.exports = {
  generateInterviewScript,
  InterviewScriptSchema,
  validateInterviewScriptUpdate
};
