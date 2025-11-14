export type TestType = 'aptitude' | 'domain';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuestionType = 'multiple_choice' | 'numeric' | 'text';
export type CorrectAnswerKind = 'exact' | 'one_of' | 'numeric_range' | 'llm_rubric';

export interface NumericRange {
  min: number;
  max: number;
}

export type CorrectAnswer =
  | { kind: 'exact'; value: string | number }
  | { kind: 'one_of'; value: string[] }
  | { kind: 'numeric_range'; value: NumericRange }
  | { kind: 'llm_rubric'; value: string };

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  correct_answer: CorrectAnswer;
  max_score: number;
}

export interface TestSection {
  id: string;
  name: string;
  weight: number;
  questions: Question[];
}

export interface TestMetadata {
  version: number;
  generated_at: string;
  source_model: string;
}

export interface Test {
  id: string;
  public_id: string;
  hiring_task_id: string;
  type: TestType;
  difficulty: Difficulty;
  sections: TestSection[];
  metadata: TestMetadata;
}

export interface ValidationError {
  path: string;
  message: string;
}

interface ValidationSuccess {
  success: true;
  data: Test;
}

interface ValidationFailure {
  success: false;
  errors: ValidationError[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function validateNumericRange(value: unknown, path: string, errors: ValidationError[]): value is NumericRange {
  if (!isObject(value)) {
    errors.push({ path, message: 'numeric_range must be an object' });
    return false;
  }
  const { min, max } = value as { min?: unknown; max?: unknown };
  if (!isNumber(min) || !isNumber(max)) {
    errors.push({ path, message: 'numeric_range.min and numeric_range.max must be numbers' });
    return false;
  }
  if (max <= min) {
    errors.push({ path, message: 'numeric_range.max must be greater than min' });
    return false;
  }
  return true;
}

function validateCorrectAnswer(
  value: unknown,
  question: Partial<Question> & { type?: QuestionType },
  path: string,
  errors: ValidationError[]
): value is CorrectAnswer {
  if (!isObject(value)) {
    errors.push({ path, message: 'correct_answer must be an object' });
    return false;
  }

  const { kind, value: inner } = value as { kind?: unknown; value?: unknown };
  if (!isString(kind)) {
    errors.push({ path: `${path}.kind`, message: 'correct_answer.kind must be a string' });
    return false;
  }

  if (!['exact', 'one_of', 'numeric_range', 'llm_rubric'].includes(kind)) {
    errors.push({ path: `${path}.kind`, message: `Unsupported correct_answer kind: ${String(kind)}` });
    return false;
  }

  switch (kind as CorrectAnswerKind) {
    case 'exact': {
      if (typeof inner !== 'string' && typeof inner !== 'number') {
        errors.push({ path: `${path}.value`, message: 'exact answers must be a string or number' });
        return false;
      }
      if (question.type === 'multiple_choice') {
        if (!Array.isArray(question.options) || question.options.length < 2) {
          errors.push({ path, message: 'multiple_choice questions require at least two options' });
        } else if (typeof inner === 'string' && !question.options.includes(inner)) {
          errors.push({ path: `${path}.value`, message: 'exact answer must match one of the provided options' });
        } else if (typeof inner !== 'string') {
          errors.push({ path: `${path}.value`, message: 'exact answer for multiple choice must be a string option' });
        }
      }
      if (question.type === 'numeric' && typeof inner !== 'number') {
        errors.push({ path: `${path}.value`, message: 'exact numeric answers must be numbers' });
      }
      return true;
    }
    case 'one_of': {
      if (!isStringArray(inner)) {
        errors.push({ path: `${path}.value`, message: 'one_of answers must be an array of strings' });
        return false;
      }
      if (!Array.isArray(question.options) || question.options.length < 2) {
        errors.push({ path, message: 'multiple_choice questions require at least two options' });
      } else {
        const invalid = inner.filter((option) => !question.options?.includes(option));
        if (invalid.length > 0) {
          errors.push({
            path: `${path}.value`,
            message: `one_of answer contains invalid options: ${invalid.join(', ')}`
          });
        }
      }
      if (question.type !== 'multiple_choice') {
        errors.push({ path, message: 'one_of answers are only valid for multiple_choice questions' });
      }
      return true;
    }
    case 'numeric_range':
      if (!validateNumericRange(inner, `${path}.value`, errors)) {
        return false;
      }
      if (question.type !== 'numeric') {
        errors.push({ path, message: 'numeric_range answers are only valid for numeric questions' });
      }
      return true;
    case 'llm_rubric':
      if (!isString(inner)) {
        errors.push({ path: `${path}.value`, message: 'llm_rubric answers must be strings' });
        return false;
      }
      if (question.type !== 'text') {
        errors.push({ path, message: 'llm_rubric answers are only valid for text questions' });
      }
      return true;
    default:
      return false;
  }
}

function validateQuestion(value: unknown, path: string, errors: ValidationError[]): value is Question {
  if (!isObject(value)) {
    errors.push({ path, message: 'Each question must be an object' });
    return false;
  }
  const question = value as Partial<Question>;

  if (!isString(question.id) || question.id.length === 0) {
    errors.push({ path: `${path}.id`, message: 'Question id must be a non-empty string' });
  }
  if (!isString(question.prompt) || question.prompt.length === 0) {
    errors.push({ path: `${path}.prompt`, message: 'Question prompt must be a non-empty string' });
  }
  if (!isString(question.type) || !['multiple_choice', 'numeric', 'text'].includes(question.type)) {
    errors.push({ path: `${path}.type`, message: 'Question type must be multiple_choice, numeric, or text' });
  }
  if (!isNumber(question.max_score)) {
    errors.push({ path: `${path}.max_score`, message: 'Question max_score must be a number' });
  } else if (question.max_score !== 1) {
    errors.push({ path: `${path}.max_score`, message: 'Question max_score must be exactly 1' });
  }

  if (question.type === 'multiple_choice') {
    if (!Array.isArray(question.options) || question.options.length < 2 || !question.options.every(isString)) {
      errors.push({ path: `${path}.options`, message: 'Multiple choice questions require at least two string options' });
    }
  }

  if (!validateCorrectAnswer(question.correct_answer as CorrectAnswer, question, `${path}.correct_answer`, errors)) {
    return false;
  }

  return true;
}

function validateSection(value: unknown, path: string, errors: ValidationError[]): value is TestSection {
  if (!isObject(value)) {
    errors.push({ path, message: 'Each section must be an object' });
    return false;
  }
  const section = value as Partial<TestSection>;
  if (!isString(section.id) || section.id.length === 0) {
    errors.push({ path: `${path}.id`, message: 'Section id must be a non-empty string' });
  }
  if (!isString(section.name) || section.name.length === 0) {
    errors.push({ path: `${path}.name`, message: 'Section name must be a non-empty string' });
  }
  if (!isNumber(section.weight) || section.weight < 0) {
    errors.push({ path: `${path}.weight`, message: 'Section weight must be a positive number' });
  }
  if (!Array.isArray(section.questions) || section.questions.length === 0) {
    errors.push({ path: `${path}.questions`, message: 'Section must contain at least one question' });
    return false;
  }

  let allValid = true;
  section.questions.forEach((question, index) => {
    if (!validateQuestion(question, `${path}.questions[${index}]`, errors)) {
      allValid = false;
    }
  });

  return allValid;
}

function validateMetadata(value: unknown, path: string, errors: ValidationError[]): value is TestMetadata {
  if (!isObject(value)) {
    errors.push({ path, message: 'metadata must be an object' });
    return false;
  }
  const metadata = value as Partial<TestMetadata>;
  if (!isNumber(metadata.version) || !Number.isInteger(metadata.version) || metadata.version < 1) {
    errors.push({ path: `${path}.version`, message: 'metadata.version must be a positive integer' });
  }
  if (!isString(metadata.generated_at) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(metadata.generated_at)) {
    errors.push({
      path: `${path}.generated_at`,
      message: 'metadata.generated_at must be an ISO timestamp ending with Z'
    });
  }
  if (!isString(metadata.source_model) || metadata.source_model.length === 0) {
    errors.push({ path: `${path}.source_model`, message: 'metadata.source_model must be a non-empty string' });
  }
  return true;
}

export function validateTest(value: unknown): ValidationSuccess | ValidationFailure {
  const errors: ValidationError[] = [];
  if (!isObject(value)) {
    return { success: false, errors: [{ path: '(root)', message: 'Test payload must be an object' }] };
  }

  const test = value as Partial<Test>;
  if (!isString(test.id) || test.id.length === 0) {
    errors.push({ path: 'id', message: 'Test id must be a non-empty string' });
  }
  if (!isString(test.public_id) || test.public_id.length === 0) {
    errors.push({ path: 'public_id', message: 'Test public_id must be a non-empty string' });
  }
  if (!isString(test.hiring_task_id) || test.hiring_task_id.length === 0) {
    errors.push({ path: 'hiring_task_id', message: 'Test hiring_task_id must be a non-empty string' });
  }
  if (!isString(test.type) || !['aptitude', 'domain'].includes(test.type)) {
    errors.push({ path: 'type', message: 'Test type must be aptitude or domain' });
  }
  if (!isString(test.difficulty) || !['easy', 'medium', 'hard'].includes(test.difficulty)) {
    errors.push({ path: 'difficulty', message: 'Test difficulty must be easy, medium, or hard' });
  }
  if (!Array.isArray(test.sections) || test.sections.length === 0) {
    errors.push({ path: 'sections', message: 'Test must include at least one section' });
  }

  let sectionsValid = true;
  test.sections?.forEach((section, index) => {
    if (!validateSection(section, `sections[${index}]`, errors)) {
      sectionsValid = false;
    }
  });

  if (!validateMetadata(test.metadata, 'metadata', errors)) {
    // continue collecting errors
  }

  if (Array.isArray(test.sections) && sectionsValid) {
    const weights = test.sections.reduce((sum, section) => sum + section.weight, 0);
    if (Math.abs(weights - 1) > 0.001) {
      errors.push({ path: 'sections', message: `Section weights must sum to 1.0 (found ${weights.toFixed(2)})` });
    }

    const allQuestions = test.sections.flatMap((section) => section.questions);
    if (allQuestions.length !== 20) {
      errors.push({
        path: 'sections',
        message: `Test must contain exactly 20 questions (found ${allQuestions.length})`
      });
    }

    const seenIds = new Set<string>();
    for (const question of allQuestions) {
      if (seenIds.has(question.id)) {
        errors.push({ path: 'sections', message: `Duplicate question id detected: ${question.id}` });
        break;
      }
      seenIds.add(question.id);
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: test as Test };
}
