require('dotenv').config();

const { callOpenAIWithSchema } = require('../services/llmClient');

async function runHealthCheck() {
  const schema = {
    name: 'openai_health_check',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        status: { type: 'string', enum: ['ok'] },
        timestamp: { type: 'string' }
      },
      required: ['status']
    }
  };

  try {
    const response = await callOpenAIWithSchema({
      messages: [
        {
          role: 'system',
          content: 'You are a health check endpoint. Respond with JSON that matches the provided schema.'
        },
        {
          role: 'user',
          content: [{ type: 'text', text: 'Confirm the API is reachable.' }]
        }
      ],
      schema
    });

    if (response?.payload?.status === 'ok') {
      console.log('OpenAI health check passed:', response.payload);
      process.exit(0);
    }

    console.error('OpenAI health check failed: unexpected payload', response);
    process.exit(1);
  } catch (error) {
    console.error('OpenAI health check error:', error);
    process.exit(1);
  }
}

runHealthCheck();
