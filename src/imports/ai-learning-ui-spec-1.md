Design a clean, structured, academic web application UI for an AI-powered student learning analytics system.

This is NOT a flashy startup AI product.
It should feel intelligent, calm, data-driven, and trustworthy.

⚠️ Core Design Constraints

Do NOT put everything on one page.

Must include:

Sign Up / Login

Onboarding Questionnaire

Dashboard

Modules (Overview + Individual Module)

Topic View

Insights

Exam Readiness

My Profile (new tab)

Settings

Study Session remains inside Module page (not standalone tab).

Avoid purple and blue completely.

Background color: #C1D0B5

Main surfaces: white or soft cream (#F7F5EF)

No gradients.

No glassmorphism.

No neon effects.

Tighter margins than default SaaS layouts.

Larger fonts.

Clean typography.

Calm, academic tone.

Inspired by:

Notion (structured layout clarity)

Linear (tight spacing precision)

Apple Calendar (calendar format reference)

ChatGPT (clean panels)

Duolingo (progress clarity, subtle mascot usage)

🌿 COLOR SYSTEM

Background: #C1D0B5
Card surfaces: White or soft cream (#F7F5EF)
Primary accent: Forest green (#3A5A40)
Warning: Orange
Critical: Red

Burnout Risk Color Rules:

≤ 40% → Forest green

40–70% → Orange

70% → Red

Retention / Exam Readiness Bar Rules:

≥ 80% → Forest green

50–80% → Yellow

≤ 50% → Red

1️⃣ SIGN UP / LOGIN PAGE

Margins slightly smaller than default.

Fields:

Email

Password

School (NOT university)

Course

Year of study

Minimal wording.
Large clean typography.

After sign up → Privacy popup appears.

🔐 PRIVACY POPUP

Short explanation:
“We track study sessions and inactivity to improve your insights.”

Toggles:

Track study sessions

Detect inactivity

Classify help/distraction

Accept → Continue.

2️⃣ ONBOARDING QUESTIONNAIRE (Rounded, Gentle Design)

Design should feel softer, more rounded, more human.
Cards slightly rounded edges.
Gentle spacing.

Questions:

When do you feel most mentally sharp?
A) 6am–10am
B) 10am–2pm
C) 2pm–6pm
D) 6pm–10pm
E) After 10pm

How long can you focus deeply before mental fatigue?
A) <20 min
B) 20–40 min
C) 40–60 min
D) 60–90 min
E) 90+ min

After a 2-hour study session, you usually feel:
A) Energised
B) Neutral
C) Slightly drained
D) Mentally exhausted

When you study, you mostly:
A) Reread notes
B) Do practice questions
C) Summarise content
D) Teach/explain concepts
E) Mix methods

When performance drops during a session, you:
A) Push through
B) Take a short break
C) Switch topic
D) Stop studying

How often do you check your phone?
A) Never
B) Occasionally
C) Every 20–30 min
D) Very frequently

In past 2 weeks, study hours:
A) Decreased
B) Stable
C) Increased moderately
D) Increased drastically

In past 2 weeks, performance:
A) Improved
B) Stable
C) Slightly declined
D) Dropped significantly

You feel guilty when not studying.
Rate 1–5

You feel mentally tired before studying.
Rate 1–5

Ideal daily study limit?
Dropdown hours

Average sleep?
Dropdown hours

After completion:
AI classifies preliminary learning style and recommends a study pattern.

Display:

“Preliminary Study Persona: Analytical Burst Learner” (example)

Short recommendation summary.

Disclaimer at bottom:
“This is not your finalised study persona. It may still be updated after observing your study patterns over time.”

3️⃣ DASHBOARD

Left sidebar navigation:

Dashboard

Modules

Insights

Exam Readiness

My Profile

Settings

IMPORTANT:
The “Dashboard” tab should ONLY remain highlighted when user is on Dashboard page.

Dashboard Content

Top:
Greeting

Burnout Risk Progress Circle
Colour-coded as specified:
≤40% green
40–70% orange

70% red

Remove mastery stability from dashboard.

Remove:

Upcoming schedule

Spaced repetition tasks section

Module mastery overview

Replace with:

Single Apple-style calendar for current month.

Calendar shows:

Spaced repetition tasks (one colour)

Exams (different colour)

Clean Apple Calendar grid format.
No clutter.

Data analysis cards:
When clicked → navigate to respective detailed tab.
Example:
Click burnout → Insights tab burnout section.

4️⃣ MODULES PAGE (Overview)

Grid layout.

Each module card shows:

Module name

Days remaining to exam

Tasks due

Exam readiness metric removed from module overview.

Add:
“+ Add Module” button.

5️⃣ INDIVIDUAL MODULE PAGE

Top:
Module name
Days remaining to exam
Add exam/midterm button

Spaced Repetition Queue at top.

Topics List:

Each topic card shows:

Mastery level in percentage

Retention metric with colour-coded bar:
≥80% green
50–80% yellow
≤50% red

Remove “Add Quiz” button.

Buttons:

Upload Notes

Add Topic

Topic Detail Page:

Shows:

Mastery breakdown

Specific weaknesses from quiz results

Quiz performance history (moved here)

No retake quiz option.

6️⃣ INSIGHTS PAGE

Burnout Trend:
Line chart with dots connected.

Include:

Peak performance time as range.

Study length vs retention graph.

Add section:
“Recommended Study Techniques”

Clicking this → navigates to My Profile tab, scrolls to study techniques section.

Remove:

Confidence vs performance

Tab switching

Study consistency score

7️⃣ EXAM READINESS PAGE

Overview of all modules.

Each module shows:

Days remaining

Colour-coded readiness bar
≥80% green
50–80% yellow
≤50% red

Instead of “topics needing urgent review”:

Section:
“Topics Tested”

List all topics user selected when creating exam.

If mastery ≤50%:
Label “Needs Urgent Review”

Topics needing urgent review appear first.

8️⃣ MY PROFILE (NEW TAB)

Sections:

Profile Information

Information NOT editable by default.
Button: “Edit”
After clicking → fields become editable.
Button changes to “Save Changes”.

Learning Style & Study Persona

Shows:

AI-classified learning style

Detailed study technique suggestions

Structured actionable suggestions

Text explains:
“These recommendations evolve over time based on your study behaviour and insights.”

9️⃣ SETTINGS

Remove:

AI personalisation level

Profile information section

Keep:

Data permissions

Account controls

UI STYLE RULES

Larger fonts

Reduced margins

Dense but clean

Rounded onboarding cards only

Structured analytical dashboard

Apple Calendar-style monthly view

Background #C1D0B5

White / cream cards

No purple

No blue

No neon AI look

Not vibecoded

Professional academic SaaS aesthetic.