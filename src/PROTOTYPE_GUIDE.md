# Assess - Prototype Navigation Guide

This is a fully functional prototype of the Assess AI-assisted hiring assessment tool.

## How to Navigate the Prototype

### Employer Flow

1. **Login Screen**
   - Enter any email and password
   - Click "Login" to access the employer dashboard

2. **Dashboard**
   - View all hiring tasks with their stats
   - Click on any task row to view details
   - Use "New Hiring Task" button to create a task
   - Check the live feed panel on the right for recent activity

3. **Task Detail View**
   - View job description and facets
   - Generate or edit aptitude/domain tests
   - Copy candidate test links
   - View candidate results and leaderboards
   - Edit candidate scores inline

4. **Test Editor**
   - View all 20 questions organized by sections
   - Edit question prompts, types, and answers
   - Use "Edit with Prompt" for AI-assisted editing (UI only)
   - Save changes with validation

5. **Create Hiring Task**
   - Fill in job title, location, and description
   - Preview JD facets structure
   - Voice assistant button (prototype, not functional)

### Candidate Flow

To test the candidate experience:

1. Click the "Aptitude Test Link" on the login screen, or manually navigate to `#/t/pub-apt-1`
2. Enter your name
3. Take the test:
   - Answer 20 questions (MCQ, numeric, text)
   - Navigate with Previous/Next
   - Answers auto-save
   - Submit when all answered
4. View thank you screen

Alternative test links:
- Aptitude test: `#/t/pub-apt-1`
- Domain test: `#/t/pub-dom-1`

## Mock Data

The prototype includes:
- 3 hiring tasks with different completion states
- 2 fully defined tests (aptitude and domain) with 20 questions each
- 10 candidate results for the first task
- Live feed with recent activity
- Leaderboards with proper sorting logic

## Features Demonstrated

### Employer Side
✓ Hiring task management
✓ Test generation workflow (UI)
✓ Test editing with schema validation
✓ Candidate results table with editable scores
✓ Leaderboards with tie-breaking rules
✓ Live activity feed
✓ Responsive design (desktop → mobile)

### Candidate Side
✓ Mobile-first test taking experience
✓ Multiple question types (MCQ, numeric, text)
✓ Progress tracking
✓ Timer display
✓ Answer auto-save simulation
✓ Submit confirmation
✓ Low-bandwidth friendly design

## Design Notes

- Clean B2B SaaS aesthetic
- High contrast, legible typography
- Responsive layout (desktop first, mobile optimized)
- Left sidebar navigation (employer)
- Top bar for account actions
- Cards, tables, badges for information hierarchy
- Real-looking mock data throughout
