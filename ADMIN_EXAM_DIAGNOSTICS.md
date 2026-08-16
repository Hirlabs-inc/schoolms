# Admin Exam Diagnostics 🔍

To help you solve the "Teacher can't select exam" issue, I've upgraded the **Admin > Exams** page.

## What's New?

I added two critical columns to the Exams table:

1.  **Assigned Teacher**:
    *   **Green Name**: Teacher is correctly assigned.
    *   **Amber "Unassigned"**: No teacher is linked to this course. The teacher won't see the exam.

2.  **Students**:
    *   **Number**: How many students are in the class for this exam.
    *   **Red "0"**: The class is empty. The teacher can select the exam, but **no students will appear** (which looks like it's not working).

## How to Diagnose

1.  Go to **Admin > Exams**.
2.  Find the exam the teacher is complaining about.
3.  **Check "Assigned Teacher"**: Is it the correct teacher?
4.  **Check "Students"**: Is it **0**?
    *   If **0**, go to **Admin > Users** and assign students to that class (e.g., "Grade 1").

## Why this happens
Even if you assign a teacher *after* generating exams, it works fine. The most common issues are:
*   The teacher is assigned to "Maths (Grade 1)" but the exam is for "Maths (Grade 2)".
*   The class "Grade 1" has no students yet.

Use this new view to spot the gap instantly! 🚀
