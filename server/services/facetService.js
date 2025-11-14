const { z } = require('zod');
const { generateFacets } = require('./llmClient');

const JDFacetsSchema = z.object({
  role_title: z.string(),
  seniority: z.string(),
  department: z.string(),
  location: z.string(),
  work_type: z.string(),
  must_have_skills: z.array(z.string()),
  nice_to_have_skills: z.array(z.string()),
  tools_and_tech: z.array(z.string()),
  domain_industry: z.string(),
  region_context: z.string(),
  language_requirements: z.array(z.string()),
  typical_tasks: z.array(z.string()),
  data_intensity: z.string(),
  communication_intensity: z.string(),
  math_data_intensity: z.string()
});

const JDFacetsJsonSchema = {
  type: 'object',
  required: [
    'role_title',
    'seniority',
    'department',
    'location',
    'work_type',
    'must_have_skills',
    'nice_to_have_skills',
    'tools_and_tech',
    'domain_industry',
    'region_context',
    'language_requirements',
    'typical_tasks',
    'data_intensity',
    'communication_intensity',
    'math_data_intensity'
  ],
  properties: {
    role_title: { type: 'string' },
    seniority: { type: 'string' },
    department: { type: 'string' },
    location: { type: 'string' },
    work_type: { type: 'string' },
    must_have_skills: {
      type: 'array',
      items: { type: 'string' }
    },
    nice_to_have_skills: {
      type: 'array',
      items: { type: 'string' }
    },
    tools_and_tech: {
      type: 'array',
      items: { type: 'string' }
    },
    domain_industry: { type: 'string' },
    region_context: { type: 'string' },
    language_requirements: {
      type: 'array',
      items: { type: 'string' }
    },
    typical_tasks: {
      type: 'array',
      items: { type: 'string' }
    },
    data_intensity: { type: 'string' },
    communication_intensity: { type: 'string' },
    math_data_intensity: { type: 'string' }
  }
};

async function generateAndValidateFacets(jobDescriptionRaw, context = {}) {
  const response = await generateFacets(jobDescriptionRaw, {
    schema: JDFacetsJsonSchema,
    context
  });

  const facets = JDFacetsSchema.parse(response.facets);
  return {
    facets,
    model: response.model,
    responseId: response.response_id
  };
}

module.exports = {
  JDFacetsSchema,
  JDFacetsJsonSchema,
  generateAndValidateFacets
};
