const https = require('https');
const { URL } = require('url');

function callOpenAI(jobDescriptionRaw, metadata = {}) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    if (!apiKey) {
      return reject(new Error('OPENAI_API_KEY is not configured'));
    }

    const url = new URL('/responses', baseUrl);
    const payload = JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content:
            'You are a system that extracts structured hiring facets from job descriptions. Return a JSON object that conforms to the provided schema.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract JD facets for the following job description. Return JSON only.\n${jobDescriptionRaw}`
            }
          ]
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'jd_facets',
          schema: metadata.schema
        }
      }
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          return reject(new Error(`OpenAI API error: ${res.statusCode} ${data}`));
        }
        try {
          const parsed = JSON.parse(data);
          const content = parsed?.output?.[0]?.content?.[0]?.text;
          if (!content) {
            return reject(new Error('OpenAI API returned an unexpected response'));
          }
          resolve({
            model: parsed.model,
            response_id: parsed.id,
            facets: JSON.parse(content)
          });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
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
      role_title: title || lines[0] || 'Unknown role',
      seniority,
      department,
      location: location || 'Not specified',
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
      throw new Error('Schema metadata is required for LLM call');
    }
    return await callOpenAI(jobDescriptionRaw, metadata);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      return fallbackFacets(jobDescriptionRaw, metadata.context);
    }
    throw error;
  }
}

module.exports = {
  generateFacets,
  fallbackFacets
};
