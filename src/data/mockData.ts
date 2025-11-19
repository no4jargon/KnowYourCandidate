import { HiringTask, Test, CandidateAttempt, CandidateResult, LiveFeedItem, InterviewScript } from '../types';

export const mockHiringTasks: HiringTask[] = [
  {
    id: 'task-1',
    employer_id: 'emp-1',
    title: 'Backend Engineer, Mumbai',
    location: 'Mumbai, India',
    created_at: '2025-11-01T10:00:00Z',
    job_description_raw: `We are looking for a Backend Engineer to join our fintech team in Mumbai. 

Key Responsibilities:
- Design and implement scalable APIs
- Optimize database queries and data models
- Work with distributed systems
- Collaborate with frontend and product teams

Requirements:
- 3-5 years of experience in backend development
- Strong Python and SQL skills
- Experience with Django, PostgreSQL
- Knowledge of distributed systems
- Good communication skills`,
    job_description_facets: {
      role_title: 'Backend Engineer',
      seniority: 'mid-level',
      department: 'engineering',
      location: 'Mumbai, India',
      work_type: 'hybrid',
      must_have_skills: ['python', 'sql', 'distributed systems'],
      nice_to_have_skills: ['aws', 'kubernetes'],
      tools_and_tech: ['django', 'postgresql'],
      domain_industry: 'fintech',
      region_context: 'india',
      language_requirements: ['english'],
      typical_tasks: ['design and implement apis', 'optimize database queries'],
      data_intensity: 'high',
      communication_intensity: 'high',
      math_data_intensity: 'medium'
    },
    has_aptitude_test: true,
    has_domain_test: true,
    has_interview_script: true,
    aptitude_test_id: 'test-apt-1',
    domain_test_id: 'test-dom-1',
    stats: {
      aptitude_candidates: 12,
      aptitude_avg_score: 15.8,
      domain_candidates: 10,
      domain_avg_score: 14.2
    }
  },
  {
    id: 'task-2',
    employer_id: 'emp-1',
    title: 'Frontend Developer, Bangalore',
    location: 'Bangalore, India',
    created_at: '2025-11-05T14:30:00Z',
    job_description_raw: `Seeking a Frontend Developer to build modern web applications.

Requirements:
- React, TypeScript experience
- UI/UX sensibility
- 2-4 years experience`,
    job_description_facets: {
      role_title: 'Frontend Developer',
      seniority: 'mid-level',
      department: 'engineering',
      location: 'Bangalore, India',
      work_type: 'remote',
      must_have_skills: ['react', 'typescript', 'css'],
      nice_to_have_skills: ['figma', 'tailwind'],
      tools_and_tech: ['react', 'next.js'],
      domain_industry: 'saas',
      region_context: 'india',
      language_requirements: ['english'],
      typical_tasks: ['build ui components', 'implement designs'],
      data_intensity: 'low',
      communication_intensity: 'high',
      math_data_intensity: 'low'
    },
    has_aptitude_test: true,
    has_domain_test: false,
    has_interview_script: false,
    aptitude_test_id: 'test-apt-2',
    stats: {
      aptitude_candidates: 8,
      aptitude_avg_score: 16.5,
      domain_candidates: 0,
      domain_avg_score: 0
    }
  },
  {
    id: 'task-3',
    employer_id: 'emp-1',
    title: 'Data Analyst, Delhi',
    location: 'Delhi, India',
    created_at: '2025-11-08T09:15:00Z',
    job_description_raw: `Data Analyst position for e-commerce analytics team.`,
    job_description_facets: {
      role_title: 'Data Analyst',
      seniority: 'junior',
      department: 'analytics',
      location: 'Delhi, India',
      work_type: 'hybrid',
      must_have_skills: ['sql', 'excel', 'python'],
      nice_to_have_skills: ['tableau', 'power bi'],
      tools_and_tech: ['sql', 'python', 'excel'],
      domain_industry: 'e-commerce',
      region_context: 'india',
      language_requirements: ['english', 'hindi'],
      typical_tasks: ['analyze data', 'create reports'],
      data_intensity: 'high',
      communication_intensity: 'medium',
      math_data_intensity: 'high'
    },
    has_aptitude_test: false,
    has_domain_test: false,
    has_interview_script: false,
    stats: {
      aptitude_candidates: 0,
      aptitude_avg_score: 0,
      domain_candidates: 0,
      domain_avg_score: 0
    }
  }
];

export const mockTests: { [key: string]: Test } = {
  'test-apt-1': {
    id: 'test-apt-1',
    public_id: 'pub-apt-1',
    hiring_task_id: 'task-1',
    kind: 'aptitude',
    title: 'Backend Engineer Aptitude Test',
    description: 'Sample aptitude questions',
    difficulty: 'medium',
    sections: [
      {
        id: 'general_reasoning',
        name: 'general_reasoning',
        weight: 0.3,
        questions: [
          {
            id: 'q1',
            type: 'multiple_choice',
            prompt: 'If all Bloops are Razzies and all Razzies are Lazzies, then all Bloops are definitely Lazzies. Is this statement true?',
            options: ['True', 'False', 'Cannot be determined', 'Depends on context'],
            correct_answer: { kind: 'exact', value: 'True' },
            max_score: 1
          },
          {
            id: 'q2',
            type: 'multiple_choice',
            prompt: 'A team needs to deploy a critical update. The update requires 3 hours of testing and 1 hour of deployment. If testing can only happen after 2 PM and deployment must finish by 7 PM, what is the latest time testing can start?',
            options: ['2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM'],
            correct_answer: { kind: 'exact', value: '3:00 PM' },
            max_score: 1
          },
          {
            id: 'q3',
            type: 'multiple_choice',
            prompt: 'Which of the following best describes the relationship between correlation and causation?',
            options: [
              'Correlation always implies causation',
              'Causation always implies correlation',
              'Correlation and causation are unrelated',
              'Correlation never implies causation'
            ],
            correct_answer: { kind: 'exact', value: 'Causation always implies correlation' },
            max_score: 1
          },
          {
            id: 'q4',
            type: 'multiple_choice',
            prompt: 'In a sequence: 2, 6, 12, 20, 30, ... What is the next number?',
            options: ['40', '42', '44', '48'],
            correct_answer: { kind: 'exact', value: '42' },
            max_score: 1
          },
          {
            id: 'q5',
            type: 'multiple_choice',
            prompt: 'A project manager needs to allocate tasks to 4 developers. Each task takes different time. To minimize total completion time, which strategy is best?',
            options: [
              'Assign tasks randomly',
              'Assign longest tasks to fastest developers',
              'Assign all tasks to one developer',
              'Assign equal number of tasks to each'
            ],
            correct_answer: { kind: 'exact', value: 'Assign longest tasks to fastest developers' },
            max_score: 1
          },
          {
            id: 'q6',
            type: 'multiple_choice',
            prompt: 'If a system has high latency but high throughput, what does this mean?',
            options: [
              'Each request is fast but few requests are processed',
              'Each request is slow but many requests are processed',
              'All requests are fast and many are processed',
              'All requests are slow and few are processed'
            ],
            correct_answer: { kind: 'exact', value: 'Each request is slow but many requests are processed' },
            max_score: 1
          }
        ]
      },
      {
        id: 'math_data',
        name: 'math_data',
        weight: 0.5,
        questions: [
          {
            id: 'q7',
            type: 'numeric',
            prompt: 'A database query returns 450 records. If you need to display 25 records per page, how many pages will you need? (Enter only the number)',
            correct_answer: { kind: 'exact', value: '18' },
            max_score: 1
          },
          {
            id: 'q8',
            type: 'numeric',
            prompt: 'An API has a rate limit of 100 requests per minute. If your application makes requests every 0.5 seconds, how many seconds until you hit the rate limit? (Round to nearest integer)',
            correct_answer: { kind: 'exact', value: '50' },
            max_score: 1
          },
          {
            id: 'q9',
            type: 'multiple_choice',
            prompt: 'A table shows user signups by day: Mon(120), Tue(150), Wed(180), Thu(210), Fri(240). What is the average daily growth?',
            options: ['30 users', '60 users', '90 users', '120 users'],
            correct_answer: { kind: 'exact', value: '30 users' },
            max_score: 1
          },
          {
            id: 'q10',
            type: 'multiple_choice',
            prompt: 'If a server processes 1000 requests per second and each request uses 2MB of memory, how much memory is needed per second?',
            options: ['500 MB', '1 GB', '2 GB', '2000 MB'],
            correct_answer: { kind: 'exact', value: '2 GB' },
            max_score: 1
          },
          {
            id: 'q11',
            type: 'numeric',
            prompt: 'A cache has a hit rate of 85%. If there are 200 requests, how many requests hit the cache? (Enter only the number)',
            correct_answer: { kind: 'exact', value: '170' },
            max_score: 1
          },
          {
            id: 'q12',
            type: 'multiple_choice',
            prompt: 'Database storage: 500GB used, 20% free space. What is the total capacity?',
            options: ['600 GB', '625 GB', '650 GB', '700 GB'],
            correct_answer: { kind: 'exact', value: '625 GB' },
            max_score: 1
          },
          {
            id: 'q13',
            type: 'numeric',
            prompt: 'If response time decreases from 500ms to 300ms, what is the percentage improvement? (Round to nearest integer, enter only the number)',
            correct_answer: { kind: 'exact', value: '40' },
            max_score: 1
          },
          {
            id: 'q14',
            type: 'multiple_choice',
            prompt: 'A system has 99.9% uptime. How many minutes of downtime per month is acceptable? (Assume 30 days)',
            options: ['43 minutes', '72 minutes', '44 minutes', '30 minutes'],
            correct_answer: { kind: 'exact', value: '43 minutes' },
            max_score: 1
          },
          {
            id: 'q15',
            type: 'numeric',
            prompt: 'An array has elements [2, 4, 6, 8, 10]. What is the median? (Enter only the number)',
            correct_answer: { kind: 'exact', value: '6' },
            max_score: 1
          },
          {
            id: 'q16',
            type: 'multiple_choice',
            prompt: 'Error rate is 2 errors per 1000 requests. If you have 50,000 requests, how many errors would you expect?',
            options: ['50', '75', '100', '125'],
            correct_answer: { kind: 'exact', value: '100' },
            max_score: 1
          }
        ]
      },
      {
        id: 'communication',
        name: 'communication',
        weight: 0.2,
        questions: [
          {
            id: 'q17',
            type: 'multiple_choice',
            prompt: 'A stakeholder asks for a feature that would take 3 weeks but they need it in 1 week. What is the best response?',
            options: [
              'Commit to 1 week without explanation',
              'Explain the time needed and discuss priorities or reduced scope',
              'Refuse the request',
              'Ask another team to do it'
            ],
            correct_answer: { kind: 'exact', value: 'Explain the time needed and discuss priorities or reduced scope' },
            max_score: 1
          },
          {
            id: 'q18',
            type: 'multiple_choice',
            prompt: 'When documenting an API, what is the most important information to include?',
            options: [
              'Your personal opinions about the API',
              'Endpoints, parameters, response formats, and examples',
              'Only the code implementation',
              'Historical context of why it was built'
            ],
            correct_answer: { kind: 'exact', value: 'Endpoints, parameters, response formats, and examples' },
            max_score: 1
          },
          {
            id: 'q19',
            type: 'multiple_choice',
            prompt: 'You found a critical bug in production. What should you do first?',
            options: [
              'Fix it immediately without telling anyone',
              'Alert the team and stakeholders, then investigate and fix',
              'Wait for someone else to notice',
              'Document it for later'
            ],
            correct_answer: { kind: 'exact', value: 'Alert the team and stakeholders, then investigate and fix' },
            max_score: 1
          },
          {
            id: 'q20',
            type: 'multiple_choice',
            prompt: 'In a code review, you disagree with an approach. What is the best way to communicate this?',
            options: [
              'Approve the code to avoid conflict',
              'Ask questions to understand their reasoning and suggest alternatives with rationale',
              'Reject the code without explanation',
              'Escalate to management immediately'
            ],
            correct_answer: { kind: 'exact', value: 'Ask questions to understand their reasoning and suggest alternatives with rationale' },
            max_score: 1
          }
        ]
      }
    ],
    metadata: {
      version: 1,
      generated_at: '2025-11-01T10:30:00Z',
      source_model: 'gpt-4'
    }
  },
  'test-dom-1': {
    id: 'test-dom-1',
    public_id: 'pub-dom-1',
    hiring_task_id: 'task-1',
    kind: 'domain',
    title: 'Backend Engineer Domain Test',
    description: 'Sample domain questions',
    difficulty: 'medium',
    sections: [
      {
        id: 'domain_concepts',
        name: 'domain_concepts',
        weight: 0.5,
        questions: [
          {
            id: 'q1',
            type: 'multiple_choice',
            prompt: 'In the context of Indian fintech, what does UPI stand for?',
            options: [
              'Unified Payment Interface',
              'Universal Payment Integration',
              'Unique Payment Identifier',
              'United Payment Infrastructure'
            ],
            correct_answer: { kind: 'exact', value: 'Unified Payment Interface' },
            max_score: 1
          },
          {
            id: 'q2',
            type: 'multiple_choice',
            prompt: 'Which Python ORM is Django built on?',
            options: ['SQLAlchemy', 'Django ORM (built-in)', 'Peewee', 'Pony ORM'],
            correct_answer: { kind: 'exact', value: 'Django ORM (built-in)' },
            max_score: 1
          },
          {
            id: 'q3',
            type: 'multiple_choice',
            prompt: 'What is the ACID property that ensures all operations in a transaction succeed or fail together?',
            options: ['Atomicity', 'Consistency', 'Isolation', 'Durability'],
            correct_answer: { kind: 'exact', value: 'Atomicity' },
            max_score: 1
          },
          {
            id: 'q4',
            type: 'multiple_choice',
            prompt: 'In PostgreSQL, which index type is best for exact match queries on text columns?',
            options: ['B-tree', 'Hash', 'GiST', 'GIN'],
            correct_answer: { kind: 'exact', value: 'Hash' },
            max_score: 1
          },
          {
            id: 'q5',
            type: 'multiple_choice',
            prompt: 'What is the CAP theorem trade-off that most distributed systems must make?',
            options: [
              'Choose 2 of: Consistency, Availability, Partition tolerance',
              'Choose all 3: Consistency, Availability, Partition tolerance',
              'Must always choose Consistency',
              'Must always choose Availability'
            ],
            correct_answer: { kind: 'exact', value: 'Choose 2 of: Consistency, Availability, Partition tolerance' },
            max_score: 1
          },
          {
            id: 'q6',
            type: 'multiple_choice',
            prompt: 'In Indian banking regulations, what is the RBI\'s role?',
            options: [
              'Retail banking only',
              'Central banking and monetary policy',
              'Investment banking',
              'Insurance regulation'
            ],
            correct_answer: { kind: 'exact', value: 'Central banking and monetary policy' },
            max_score: 1
          },
          {
            id: 'q7',
            type: 'multiple_choice',
            prompt: 'Which HTTP status code indicates a successful POST request that created a resource?',
            options: ['200 OK', '201 Created', '202 Accepted', '204 No Content'],
            correct_answer: { kind: 'exact', value: '201 Created' },
            max_score: 1
          },
          {
            id: 'q8',
            type: 'multiple_choice',
            prompt: 'What does eventual consistency mean in distributed systems?',
            options: [
              'Data is always consistent',
              'Data will become consistent after some time',
              'Data is never consistent',
              'Consistency is not guaranteed'
            ],
            correct_answer: { kind: 'exact', value: 'Data will become consistent after some time' },
            max_score: 1
          },
          {
            id: 'q9',
            type: 'multiple_choice',
            prompt: 'Which Python library is commonly used for async database operations with PostgreSQL?',
            options: ['psycopg2', 'asyncpg', 'PyMySQL', 'mysql-connector'],
            correct_answer: { kind: 'exact', value: 'asyncpg' },
            max_score: 1
          },
          {
            id: 'q10',
            type: 'multiple_choice',
            prompt: 'What is the purpose of database connection pooling?',
            options: [
              'To create new connections for each request',
              'To reuse existing connections and improve performance',
              'To close connections after each query',
              'To backup database connections'
            ],
            correct_answer: { kind: 'exact', value: 'To reuse existing connections and improve performance' },
            max_score: 1
          }
        ]
      },
      {
        id: 'domain_scenarios',
        name: 'domain_scenarios',
        weight: 0.5,
        questions: [
          {
            id: 'q11',
            type: 'text',
            prompt: 'You need to design an API for money transfers in a fintech app. Describe the key steps to ensure the transaction is atomic and secure. (2-3 sentences)',
            correct_answer: { kind: 'llm_rubric', value: 'Should mention: database transactions, validation, idempotency, error handling' },
            max_score: 1
          },
          {
            id: 'q12',
            type: 'multiple_choice',
            prompt: 'A query is taking 5 seconds on a table with 10 million rows. What should you check first?',
            options: [
              'Add more servers',
              'Check if indexes exist on filtered columns',
              'Increase database memory',
              'Rewrite the application'
            ],
            correct_answer: { kind: 'exact', value: 'Check if indexes exist on filtered columns' },
            max_score: 1
          },
          {
            id: 'q13',
            type: 'text',
            prompt: 'How would you handle a scenario where two users try to book the last available slot simultaneously? Explain your approach briefly.',
            correct_answer: { kind: 'llm_rubric', value: 'Should mention: locks, transactions, race conditions, optimistic/pessimistic locking' },
            max_score: 1
          },
          {
            id: 'q14',
            type: 'multiple_choice',
            prompt: 'Your API needs to process 10,000 transactions per second. What architecture pattern helps?',
            options: [
              'Synchronous processing only',
              'Message queue with async workers',
              'Single threaded processing',
              'Polling database every second'
            ],
            correct_answer: { kind: 'exact', value: 'Message queue with async workers' },
            max_score: 1
          },
          {
            id: 'q15',
            type: 'multiple_choice',
            prompt: 'In a microservices architecture for fintech, how should services communicate for critical transactions?',
            options: [
              'Direct HTTP calls only',
              'Shared database',
              'Combination of synchronous calls and event-driven patterns',
              'Email notifications'
            ],
            correct_answer: { kind: 'exact', value: 'Combination of synchronous calls and event-driven patterns' },
            max_score: 1
          },
          {
            id: 'q16',
            type: 'text',
            prompt: 'A customer reports that their transaction shows as "pending" for 2 hours. What steps would you take to debug this? List 2-3 steps.',
            correct_answer: { kind: 'llm_rubric', value: 'Should mention: check logs, database state, transaction status, external service status' },
            max_score: 1
          },
          {
            id: 'q17',
            type: 'multiple_choice',
            prompt: 'For PCI DSS compliance in payment systems, what must you never store?',
            options: [
              'Card number',
              'Cardholder name',
              'CVV/CVC code',
              'Expiry date'
            ],
            correct_answer: { kind: 'exact', value: 'CVV/CVC code' },
            max_score: 1
          },
          {
            id: 'q18',
            type: 'multiple_choice',
            prompt: 'Your Django app needs to handle file uploads. Which setting controls maximum upload size?',
            options: [
              'MAX_UPLOAD_SIZE',
              'FILE_UPLOAD_MAX_MEMORY_SIZE',
              'UPLOAD_LIMIT',
              'MAX_FILE_SIZE'
            ],
            correct_answer: { kind: 'exact', value: 'FILE_UPLOAD_MAX_MEMORY_SIZE' },
            max_score: 1
          },
          {
            id: 'q19',
            type: 'multiple_choice',
            prompt: 'What is the best way to store sensitive API keys in a Django production environment?',
            options: [
              'In settings.py committed to git',
              'Environment variables or secret management service',
              'In database',
              'Hardcoded in views'
            ],
            correct_answer: { kind: 'exact', value: 'Environment variables or secret management service' },
            max_score: 1
          },
          {
            id: 'q20',
            type: 'text',
            prompt: 'Explain briefly why you would use Redis in a Django fintech application. Give 1-2 specific use cases.',
            correct_answer: { kind: 'llm_rubric', value: 'Should mention: caching, session storage, rate limiting, real-time features, message broker' },
            max_score: 1
          }
        ]
      }
    ],
    metadata: {
      version: 1,
      generated_at: '2025-11-01T10:45:00Z',
      source_model: 'gpt-4'
    }
  }
};

export const mockCandidateResults: { [taskId: string]: CandidateResult[] } = {
  'task-1': [
    {
      candidate_name: 'Priya Sharma',
      aptitude_taken_at: '2025-11-10T09:30:00Z',
      aptitude_score: 18,
      domain_taken_at: '2025-11-10T10:15:00Z',
      domain_score: 17,
      interview_score: 0,
      overall_score: 35
    },
    {
      candidate_name: 'Rahul Verma',
      aptitude_taken_at: '2025-11-10T11:00:00Z',
      aptitude_score: 17,
      domain_taken_at: '2025-11-10T11:45:00Z',
      domain_score: 16,
      interview_score: 0,
      overall_score: 33
    },
    {
      candidate_name: 'Anjali Patel',
      aptitude_taken_at: '2025-11-10T14:20:00Z',
      aptitude_score: 16,
      domain_taken_at: '2025-11-10T15:10:00Z',
      domain_score: 18,
      interview_score: 0,
      overall_score: 34
    },
    {
      candidate_name: 'Vikram Singh',
      aptitude_taken_at: '2025-11-11T08:45:00Z',
      aptitude_score: 15,
      domain_taken_at: '2025-11-11T09:30:00Z',
      domain_score: 15,
      interview_score: 0,
      overall_score: 30
    },
    {
      candidate_name: 'Sneha Reddy',
      aptitude_taken_at: '2025-11-11T10:15:00Z',
      aptitude_score: 17,
      domain_taken_at: '2025-11-11T11:00:00Z',
      domain_score: 14,
      interview_score: 0,
      overall_score: 31
    },
    {
      candidate_name: 'Arjun Malhotra',
      aptitude_taken_at: '2025-11-11T13:30:00Z',
      aptitude_score: 14,
      domain_taken_at: '2025-11-11T14:20:00Z',
      domain_score: 13,
      interview_score: 0,
      overall_score: 27
    },
    {
      candidate_name: 'Kavya Iyer',
      aptitude_taken_at: '2025-11-12T09:00:00Z',
      aptitude_score: 16,
      domain_taken_at: '2025-11-12T09:50:00Z',
      domain_score: 15,
      interview_score: 0,
      overall_score: 31
    },
    {
      candidate_name: 'Rohan Gupta',
      aptitude_taken_at: '2025-11-12T11:30:00Z',
      aptitude_score: 18,
      domain_taken_at: '2025-11-12T12:20:00Z',
      domain_score: 15,
      interview_score: 0,
      overall_score: 33
    },
    {
      candidate_name: 'Meera Nair',
      aptitude_taken_at: '2025-11-12T14:00:00Z',
      aptitude_score: 13,
      domain_taken_at: null,
      domain_score: 0,
      interview_score: 0,
      overall_score: 13
    },
    {
      candidate_name: 'Karthik Krishnan',
      aptitude_taken_at: '2025-11-13T08:30:00Z',
      aptitude_score: 15,
      domain_taken_at: '2025-11-13T09:15:00Z',
      domain_score: 16,
      interview_score: 0,
      overall_score: 31
    }
  ]
};

export const mockLiveFeed: LiveFeedItem[] = [
  {
    timestamp: '2025-11-13T12:03:00Z',
    message: 'Karthik Krishnan completed domain test for Backend Engineer, Mumbai with score 16/20'
  },
  {
    timestamp: '2025-11-13T11:47:00Z',
    message: 'Karthik Krishnan completed aptitude test for Backend Engineer, Mumbai with score 15/20'
  },
  {
    timestamp: '2025-11-13T10:22:00Z',
    message: 'New candidate started aptitude test for Backend Engineer, Mumbai'
  },
  {
    timestamp: '2025-11-12T16:35:00Z',
    message: 'Meera Nair completed aptitude test for Backend Engineer, Mumbai with score 13/20'
  },
  {
    timestamp: '2025-11-12T14:58:00Z',
    message: 'Rohan Gupta completed domain test for Backend Engineer, Mumbai with score 15/20'
  },
  {
    timestamp: '2025-11-12T13:41:00Z',
    message: 'Rohan Gupta completed aptitude test for Backend Engineer, Mumbai with score 18/20'
  },
  {
    timestamp: '2025-11-12T11:28:00Z',
    message: 'Kavya Iyer completed domain test for Backend Engineer, Mumbai with score 15/20'
  },
  {
    timestamp: '2025-11-12T10:45:00Z',
    message: 'Kavya Iyer completed aptitude test for Backend Engineer, Mumbai with score 16/20'
  }
];

export const mockInterviewScript: InterviewScript = {
  id: 'interview-1',
  hiring_task_id: 'task-1',
  created_at: '2025-11-01T11:00:00Z',
  script: [
    {
      id: 'q1',
      type: 'opening',
      prompt: 'Welcome! Thank you for taking the time to interview with us today. Can you start by telling me a bit about yourself and your background in backend engineering?'
    },
    {
      id: 'q2',
      type: 'background',
      prompt: 'I see you have experience with Python and Django. Can you walk me through a recent project where you used these technologies?'
    },
    {
      id: 'q3',
      type: 'technical',
      prompt: 'How do you approach database query optimization? Can you give me an example of a time when you had to optimize a slow query?'
    },
    {
      id: 'q4',
      type: 'technical',
      prompt: 'Explain how you would design a distributed system for processing financial transactions. What are the key considerations?'
    },
    {
      id: 'q5',
      type: 'domain_scenario',
      prompt: 'In a fintech context, how would you ensure data consistency across multiple services during a money transfer operation?'
    },
    {
      id: 'q6',
      type: 'domain_scenario',
      prompt: 'Have you worked with any Indian payment systems like UPI? If so, can you describe your experience? If not, how would you approach learning about it?'
    },
    {
      id: 'q7',
      type: 'behavioral',
      prompt: 'Tell me about a time when you had to debug a critical production issue. How did you approach it and what was the outcome?'
    },
    {
      id: 'q8',
      type: 'behavioral',
      prompt: 'Describe a situation where you had to work with a difficult stakeholder or team member. How did you handle it?'
    },
    {
      id: 'q9',
      type: 'technical',
      prompt: 'What is your experience with containerization and orchestration tools like Docker and Kubernetes?'
    },
    {
      id: 'q10',
      type: 'wrap_up',
      prompt: 'Do you have any questions for me about the role, team, or company?'
    }
  ]
};
