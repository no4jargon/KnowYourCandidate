# KnowYourCandidate Engineering Design Canon

This document is the authoritative reference for the "Assess" product design. Every PR that introduces, modifies, or removes a design choice **must** update this file so future contributors inherit the same context. The guidance below captures V0 requirements and guardrails extracted from the latest product spec.

## 1. Product Overview
- **Product name:** Assess.
- **Objective:** Help employers evaluate candidates faster and more consistently by generating three AI-assisted artifacts (tailored aptitude test, domain-specific test, interview script) from a job description.
- **Guiding principles:**
  - V0 targets a single employer account with one login; avoid multi-tenant role complexity.
  - Candidates require only a link and name to participate—no authentication.
  - Tests must be mobile-friendly and optimized for low bandwidth.
  - All AI-generated content remains editable by employers.

## 2. User Roles & High-Level Flows
- **Employer:** logs in, creates/manages hiring tasks, generates tests and interview scripts, shares links, reviews/edit scores, views leaderboards.
- **Candidate:** receives link, enters name, completes tests on mobile/desktop without logging in.
- **Primary flow:** employer login → dashboard → create hiring task (text JD or voice helper) → generate artifacts → share candidate links → candidate completes tests → backend scores → employer reviews results and leaderboards.

## 3. Hiring Task Lifecycle
- **Hiring Task Object:** stores JD text & facets, booleans for generated artifacts, timestamps, employer ownership.
- **Dashboard List View:** shows title, created date, artifact badges (on/off), candidate counts, average scores, and a live activity feed (e.g., completion events with timestamps and scores).
- **Task Detail View:**
  - Top: title, created date, full JD text.
  - Middle: cards for aptitude test, domain test, interview script with status and actions (generate, view/edit, copy/share link).
  - Bottom: candidate table (editable scores, time taken per test, timestamps, optional overall score) and leaderboards per test.
- **Leaderboard Sorting:** primary by test score desc, tie-breaker by sum of other test scores desc, final tiebreaker by earlier completion timestamp.

## 4. Job Description Capture & Facets
- **JD Entry:** fields for job title, location, free-text JD.
- **Voice Assistant (optional module):** push-to-talk panel that streams STT output, prompts for missing info, and live-updates JD text/facets.
- **JD Facets Schema:** see Section 4.3 spec; includes role_title, seniority, department, location, work_type, must/nice-to-have skills, tools & tech, domain industry, region context, language requirements, typical tasks, intensity levels, etc. This structured object is the primary input for downstream generation prompts.

## 5. Test Design
- **Shared Constraints:** exactly 20 questions per test; each question scores 0/1; supported types: multiple choice, numeric, text; each answer must be falsifiable; follow shared test schema (Section 5.4) with sections, weights, questions, metadata.
- **Aptitude Test:** categories = general_reasoning, math_data, communication. Determine distribution from JD facets (e.g., high data intensity ⇒ more math_data). Content stays domain-agnostic while flavored by context.
- **Domain Test:** categories = domain_concepts, domain_scenarios, optional regulatory_or_regional. Questions anchored in domain_industry, region_context, tools_and_tech, typical_tasks. All answers must be objectively gradable.
- **Candidate Attempt Schema:** see Section 5.5; track raw/normalized answers, per-question scores, total/max score.

## 6. LLM Usage
- **JD → Facets:** feed raw JD, enforce structured JSON output.
- **Test Generation:** use JD facets plus difficulty; prompts must enforce schema, maintain 20 questions, respect content rules (aptitude vs domain).
- **Interview Script Generation:** produce structured list of questions (10–15 minute interview) following provided schema.
- **Text Answer Grading:** for `correct_answer.kind = "llm_rubric"`, call LLM with prompt + candidate answer + hidden rubric; expect `{ "score": number, "reason": string }`.

## 7. Candidate Test Experience
- **Entry:** shareable link format `/t/{test_public_id}`. Landing shows task/test title, description, AI-assisted disclaimer, name input.
- **UI Requirements:** lightweight HTML/CSS/JS, one question per view (or very small group), mobile-first layout, large tap targets, minimal assets, autosave progress locally, explicit submit flow with confirmation and timer display.
- **Scoring:** on submit, backend computes scores (direct comparison for MCQ/numeric range; optional LLM grading for text). Unscored text answers default to 0 until graded. Candidate receives thank-you screen; optional total score reveal.

## 8. Employer Test Editing
- **Editor:** section/question list with editable prompt, type, options, correct answer, sample formats. Must validate schema before save; reject invalid changes with clear messages.
- **Prompt-Based Editing:** optional feature letting employer provide instructions; backend re-invokes LLM with original test + instructions, validates new schema, displays diff before saving. Must preserve constraints (20 questions, valid types, falsifiable answers, binary scoring).

## 9. Data Model & APIs
- **Primary Tables:** employers, hiring_tasks, tests, test_attempts, (optional) test_responses, interview_scripts. Columns align with Section 9.1.
- **Core APIs:** login; CRUD for hiring tasks; generation endpoints for each artifact; employer test fetch/edit; public test retrieval & attempt lifecycle; candidate aggregation & score editing endpoints. See Section 9.2 for route sketches.

## 10. Architecture & Modularization
- **Recommended Stack:**
  - Backend: Node+TypeScript (Next.js API/Express/Fastify) *or* Python+FastAPI.
  - Database: Postgres (managed acceptable).
  - Frontend: Next.js + React + Tailwind CSS.
  - LLM: OpenAI API for facets, test generation, interview scripts, grading.
  - Voice Capture: separate module for STT + conversational follow-up.
- **Modules:** auth, hiring-tasks, tests, test-runner (public candidate flow), interviews, jd-voice-capture. Each module owns its routes, services, validation to isolate errors.

## 11. Priorities
1. auth, hiring task creation (text JD), JD facets extraction, aptitude test generation, public candidate flow & scoring for aptitude test, dashboard stats.
2. domain test generation & candidate flow, text answer LLM grading, interview script generation UI.
3. JD voice capture module, leaderboards, advanced filtering, UX polish.

---

### Maintenance Rule
Whenever new product decisions, architectural constraints, or cross-cutting policies are introduced or changed, update this file in the same PR so that it remains the single source of truth for engineers and designers.
