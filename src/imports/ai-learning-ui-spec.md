Design a clean, minimal, academic web application UI for an AI-powered student learning analytics system.

This is NOT a flashy startup AI tool.
It should feel calm, intelligent, and serious — built for high-performing university students.

⚠️ Design Constraints

Do NOT put everything on one page.

Must include:

Onboarding

Dashboard

Modules (overview + individual module view)

Topic view

Insights

Exam Readiness overview

Study Session is NOT a separate page.

Avoid purple and blue completely.

Background color: #C1D0B5 (light sage green)

Main surfaces: White or soft cream (#F7F5EF)

No gradients.

No glassmorphism.

No neon glow effects.

Larger fonts.

Reduced margins.

Dense but clean layout.

Inspired by:

Notion (clarity + structure)

Linear (tight spacing, precision)

Duolingo (progress visibility, mascot usage)

ChatGPT (clean panels, strong whitespace discipline)

🌿 COLOR SYSTEM

Background: #C1D0B5
Primary surfaces: White or soft cream (#F7F5EF)
Primary accent: Muted forest green (#3A5A40)
Secondary accent: Olive tone (#6B8E23)
Burnout risk colors:

Low: Soft green

Medium: Amber

High: Soft red

Text: Dark charcoal (#1A1A1A)

🧭 PAGE STRUCTURE
1️⃣ SIGN UP PAGE (SIMPLIFIED)

Minimal.
Few words.
Large typography.

Headline:
“Understand How You Learn.”

Subtext:
Short single sentence explaining AI learning model.

Fields:

Email

Password

University

Course

Year of study

NO module selection here.
NO exam dates.

Button:
“Create My Learning System”

After signup → Privacy tracking popup appears.

🔐 Privacy Popup (After Signup)

Clean modal.

Explain briefly:
“We track study sessions and inactivity to improve your learning insights.”

Toggles:

Track study sessions

Detect inactivity (25-minute idle detection)

Classify help/distraction

Accept button:
“Continue”

2️⃣ ONBOARDING – LEARNING STYLE SETUP

Short, guided.

Page 1:
“When do you typically study?”
Multi-select:
☐ Morning
☐ Afternoon
☐ Evening
☐ After 12AM

Page 2:
Learning preference questions:

I prefer diagrams over text

I remember things by writing

I learn best by solving problems

I like short focused bursts

I study for long stretches

These should feel like thoughtful guiding questions.
Not a quiz.
Minimal words.

Finish → Go to Dashboard.

3️⃣ DASHBOARD

Layout:
Left sidebar navigation.
Main content center.
Compact spacing.
Larger fonts.

Sidebar:

Dashboard

Modules

Insights

Exam Readiness

Settings

Dashboard Content

Top Section:
Greeting + Quick Summary

Burnout Risk Indicator (Color-coded clearly)
Include small info icon explaining:

Burnout risk

Focus efficiency

Mastery stability

Remove excessive whitespace.

Second Section:
Study Streak
Replace calendar heatmap with:

Clean streak counter

Small mascot illustration (minimal, not cartoonish)
Mascot should be subtle academic character (owl or fox in muted tones).

Third Section:
Overall Spaced Repetition Overview

Example:
EC2101 – 2 tasks due
MA2001 – 1 task due

Clickable → Goes to that module’s spaced repetition queue.

Fourth Section:
Topics At Risk

This must NOT go to Insights page.
Clicking should go to a Topic Risk page specific to that topic.

Fifth Section:
Overall Calendar

Module-based.
Shows:

Exam dates

Spaced repetition tasks

Study sessions logged
Compact month view.

Remove:

Start spaced recommendation review button.

Confidence vs performance.

Study consistency score.

4️⃣ MODULES PAGE (Overview)

Grid of modules.
Each card shows:

Module name

Mastery average

Days until exam

Exam readiness score

Tasks due

Button:
“+ Add Module”

Click module → Individual Module Page.

5️⃣ INDIVIDUAL MODULE PAGE

Top Section:
Module name
Days remaining to exam
Exam readiness score
Add exam/midterm button
(Add time + select topics included)

Below:
Spaced Repetition Queue (AT TOP)

Then:
Topics List

Each topic card:

Mastery level (1–10)

Retention decay indicator

Button: Upload Notes

Button: Add Quiz

Button: Add Topic

Click topic → Topic Detail Page.

6️⃣ TOPIC DETAIL PAGE

Shows:

Mastery breakdown
Specific weakness insights based on quiz results.

Examples:
“You frequently miss conceptual definition questions.”
“You struggle with time-based calculations.”

No option to retake quiz here.

Quiz performance history displayed here (moved from global insights).

Individual topic calendar:
Shows:

Quizzes taken

Reviews scheduled

Study sessions logged

7️⃣ STUDY SESSION (WITHIN MODULE)

Not a standalone tab.

On Module Page:
Button: “Start Study Session”

When clicked:
Dropdown:
Select Topic

Add new topic option

Timer starts automatically.

Live minimal panel:

Timer

Current topic

Focus state

If cursor idle for 25 minutes:
Popup:
“Are you still studying?”

If user tries to end early:
Popup:
“Are you sure you want to end this session?”

When ending:
Ask:
“Would you like to take a quiz now?”

Important logic:
Failing quiz reduces mastery score.

8️⃣ INSIGHTS PAGE

Clean and analytical.

Include:

Peak Performance Time (as a RANGE)
Example:
“You perform best between 2PM–5PM.”

Study Length vs Retention graph

Burnout Trend graph

Remove:

Confidence vs performance

Tab switching

Study consistency score

Include info icon explaining the 3 indicators clearly.

9️⃣ EXAM READINESS PAGE (OVERVIEW)

Overview of all exams.

Each module shows:

Days remaining

Readiness score

Topics needing urgent review

Keep module-card format.

📐 UI STYLE RULES

Tighter margins.

Bigger typography.

Minimal icons.

No gradients.

No purple or blue.

Background #C1D0B5.

White/cream cards.

Calm.

Structured.

Academic SaaS, not startup AI.

Avoid:

Crypto dashboards

Neon AI look

Floating blobs

Startup pitch aesthetic