import type { Test as SharedTest, TestSection as SharedTestSection, Question as SharedQuestion } from '../../shared/testSchema';

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

export type Test = SharedTest;
export type TestSection = SharedTestSection;
export type Question = SharedQuestion;

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
