const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function normalizeContent(content) {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  if (Array.isArray(content)) {
    return content.map((item) => {
      if (typeof item === 'string') {
        return { type: 'text', text: item };
      }

      if (item && typeof item === 'object') {
        if (item.type === 'text') {
          return item;
        }
        if (item.text) {
          return { type: 'text', text: item.text };
        }
        return { type: 'text', text: JSON.stringify(item) };
      }

      return { type: 'text', text: String(item) };
    });
  }

  if (content && typeof content === 'object') {
    if (content.type === 'text') {
      return [content];
    }
    if (content.text) {
      return [{ type: 'text', text: content.text }];
    }
    return [{ type: 'text', text: JSON.stringify(content) }];
  }

  return [{ type: 'text', text: String(content) }];
}

function buildResponseInput(messages = []) {
  return messages.map((message) => {
    const { role, content } = message || {};
    return {
      role: role || 'user',
      content: normalizeContent(content)
    };
  });
}

async function callOpenAIWithSchema({ messages, schema }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const payload = {
    model: process.env.OPENAI_MODEL || 'gpt-5.1',
    input: buildResponseInput(messages),
    text: {
      format: {
        type: 'json_schema',
        name: schema.name || 'structured_output',
        schema: schema.schema || schema,
        strict: true
      }
    }
  };

  const res = await client.responses.create(payload);

  const contentItems = [];
  for (const message of res.output || []) {
    if (Array.isArray(message?.content)) {
      contentItems.push(...message.content);
    }
  }

  const jsonItem = contentItems.find((item) => item?.type === 'output_json' && item.json);
  let parsedPayload = jsonItem?.json;

  if (!parsedPayload) {
    const textItem = contentItems.find((item) => typeof item?.text === 'string');
    if (textItem) {
      try {
        parsedPayload = JSON.parse(textItem.text);
      } catch (err) {
        console.error('Failed to parse text content as JSON:', err);
      }
    }
  }

  if (!parsedPayload && typeof res.output_text === 'string' && res.output_text.trim()) {
    try {
      parsedPayload = JSON.parse(res.output_text);
    } catch (err) {
      console.error('Failed to parse output_text as JSON:', err);
    }
  }

  if (!parsedPayload) {
    throw new Error('OpenAI API returned an unexpected response shape');
  }

  return {
    model: res.model,
    response_id: res.id,
    payload: parsedPayload
  };
}

function callOpenAI(jobDescriptionRaw, metadata = {}) {
  return callOpenAIWithSchema({
    messages: [
      {
        role: 'system',
        content:
          'you are a system that extracts structured hiring facets from job descriptions. return a json object that conforms to the provided schema.'
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `fill in various values releated to facets of the job requirements using information from the following job description. return json only.\n${jobDescriptionRaw}`
          }
        ]
      }
    ],
    schema: metadata.schema
  });
}

function fallbackFacets(jobDescriptionRaw, { title, location } = {}) {
  const normalized = jobDescriptionRaw.toLowerCase();
  const lines = jobDescriptionRaw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const seniority = normalized.includes('senior')
    ? 'senior'
    : normalized.includes('lead')
    ? 'lead'
    : normalized.includes('junior')
    ? 'junior'
    : 'mid-level';

  const department = normalized.includes('data')
    ? 'analytics'
    : normalized.includes('design')
    ? 'design'
    : normalized.includes('product')
    ? 'product'
    : 'engineering';

  const workType = normalized.includes('remote')
    ? 'remote'
    : normalized.includes('hybrid')
    ? 'hybrid'
    : normalized.includes('onsite')
    ? 'onsite'
    : 'hybrid';

  const extractListAfter = (keyword) => {
    const regex = new RegExp(`${keyword}[:\n]`, 'i');
    const index = jobDescriptionRaw.search(regex);
    if (index === -1) return [];
    const after = jobDescriptionRaw.slice(index).split('\n');
    const bullets = [];
    for (const line of after.slice(1)) {
      const trimmed = line.trim().replace(/^[-•*]+\s*/, '');
      if (!trimmed) continue;
      if (/^[A-Z].*:/.test(trimmed)) break;
      bullets.push(trimmed.toLowerCase());
    }
    return bullets;
  };

  const mustHave = extractListAfter('requirements');
  const niceToHave = extractListAfter('nice to have');
  const tools = extractListAfter('tools');
  const typicalTasks = extractListAfter('responsibilities');

  return {
    model: 'fallback-facets-v1',
    response_id: 'local-fallback',
    facets: {
      role_title: title || lines[0] || 'unknown role',
      seniority,
      department,
      location: location || 'not specified',
      work_type: workType,
      must_have_skills: mustHave.length ? mustHave : ['communication'],
      nice_to_have_skills: niceToHave,
      tools_and_tech: tools.length ? tools : ['not specified'],
      domain_industry: normalized.includes('fintech')
        ? 'fintech'
        : normalized.includes('e-commerce')
        ? 'e-commerce'
        : normalized.includes('health')
        ? 'healthcare'
        : 'general',
      region_context: location ? location.toLowerCase() : 'global',
      language_requirements: normalized.includes('hindi')
        ? ['english', 'hindi']
        : ['english'],
      typical_tasks: typicalTasks.length ? typicalTasks : ['unspecified responsibilities'],
      data_intensity: normalized.includes('data') ? 'high' : 'medium',
      communication_intensity: normalized.includes('stakeholder') ? 'high' : 'medium',
      math_data_intensity: normalized.includes('statistics') ? 'high' : 'medium'
    }
  };
}

async function generateFacets(jobDescriptionRaw, metadata = {}) {
  try {
    const schema = metadata.schema;
    if (!schema) {
      throw new Error('schema metadata is required for llm call');
    }
    const response = await callOpenAI(jobDescriptionRaw, metadata);
    return {
      model: response.model,
      response_id: response.response_id,
      facets: response.payload
    };
  } catch (error) {
    console.error('error generating facets via openai:', error);
    if (process.env.NODE_ENV !== 'production') {
      return fallbackFacets(jobDescriptionRaw, metadata.context);
    }
    throw error;
  }
}

module.exports = {
  generateFacets,
  fallbackFacets,
  callOpenAIWithSchema
};