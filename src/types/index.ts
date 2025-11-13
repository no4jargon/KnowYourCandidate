export interface HiringTask {
  id: string;
  employer_id: string;
  title: string;
  location: string;
  created_at: string;
  job_description_raw: string;
  job_description_facets: JDFacets;
  has_aptitude_test: boolean;
  has_domain_test: boolean;
  has_interview_script: boolean;
  aptitude_test_id?: string;
  domain_test_id?: string;
  stats: {
    aptitude_candidates: number;
    aptitude_avg_score: number;
    domain_candidates: number;
    domain_avg_score: number;
  };
}

export interface JDFacets {
  role_title: string;
  seniority: string;
  department: string;
  location: string;
  work_type: string;
  must_have_skills: string[];
  nice_to_have_skills: string[];
  tools_and_tech: string[];
  domain_industry: string;
  region_context: string;
  language_requirements: string[];
  typical_tasks: string[];
  data_intensity: string;
  communication_intensity: string;
  math_data_intensity: string;
}

export interface Test {
  id: string;
  public_id: string;
  hiring_task_id: string;
  type: 'aptitude' | 'domain';
  difficulty: 'easy' | 'medium' | 'hard';
  sections: TestSection[];
  metadata: {
    version: number;
    generated_at: string;
    source_model: string;
  };
}

export interface TestSection {
  id: string;
  name: string;
  weight: number;
  questions: Question[];
}

export interface Question {
  id: string;
  type: 'multiple_choice' | 'numeric' | 'text';
  prompt: string;
  options?: string[];
  correct_answer: {
    kind: 'exact' | 'one_of' | 'numeric_range' | 'llm_rubric';
    value: any;
  };
  max_score: number;
}

export interface CandidateAttempt {
  attempt_id: string;
  test_id: string;
  hiring_task_id: string;
  candidate_name: string;
  started_at: string;
  submitted_at: string | null;
  answers: Answer[];
  total_score: number;
  max_score: number;
}

export interface Answer {
  question_id: string;
  raw_answer: string | number;
  normalized_answer: string | number;
  score: number;
}

export interface CandidateResult {
  candidate_name: string;
  aptitude_taken_at: string | null;
  aptitude_score: number;
  domain_taken_at: string | null;
  domain_score: number;
  interview_score: number;
  overall_score: number;
}

export interface InterviewScript {
  id: string;
  hiring_task_id: string;
  script: InterviewQuestion[];
  created_at: string;
}

export interface InterviewQuestion {
  id: string;
  type: 'opening' | 'background' | 'technical' | 'behavioral' | 'domain_scenario' | 'wrap_up';
  prompt: string;
}

export interface LiveFeedItem {
  timestamp: string;
  message: string;
}
