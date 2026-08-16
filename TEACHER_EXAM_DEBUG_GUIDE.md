# Teacher Exam Selection Debug Guide 🔍

## Problem
Teacher reports they cannot see exams even after deleting and regenerating them.

## What We've Added

### 1. **Admin Exams Page Enhancement**
The Admin > Exams page now shows:
- **Assigned Teacher** column (green = assigned, amber = unassigned)
- **Students** column (red "0" = no students in class)

### 2. **Teacher Exams Page Debug Panel**
The Teacher > Exams page now displays a debug panel showing:
- **User ID**: The teacher's unique identifier
- **User Name**: The teacher's full name
- **Total Courses Fetched**: How many courses exist in the system
- **My Assigned Courses**: How many courses are assigned to this teacher
- **Assigned Course IDs**: The specific course IDs assigned to the teacher
- **Total Exams Fetched**: How many exams the teacher can see

## How to Diagnose the Issue

### Step 1: Teacher Checks Debug Panel
1. Log in as the teacher
2. Go to **Teacher > Exams**
3. Scroll down to see the **Debug Info** panel
4. Take a screenshot and share with admin

### Step 2: Admin Checks Exam Table
1. Log in as admin
2. Go to **Admin > Exams**
3. Look for the exam the teacher should see
4. Check:
   - Is the **Assigned Teacher** correct?
   - Is the **Students** count > 0?

### Step 3: Cross-Reference
Compare the teacher's **Assigned Course IDs** with the **Course** column in the Admin Exams table.

## Common Issues & Solutions

### Issue 1: "My Assigned Courses: 0"
**Problem**: The teacher has no courses assigned to them.
**Solution**: Go to **Admin > Courses** and assign courses to the teacher.

### Issue 2: "Total Exams Fetched: 0" but courses are assigned
**Problem**: No exams exist for the teacher's courses.
**Solution**: Go to **Admin > Exams** and generate exams.

### Issue 3: Course IDs don't match
**Problem**: The teacher is assigned to "Mathematics (Grade 2)" but the exam is for "Mathematics (Grade 1)".
**Solution**: Either:
- Reassign the teacher to the correct course, OR
- Generate exams for the teacher's actual courses

### Issue 4: Students count is 0
**Problem**: The class has no students enrolled.
**Solution**: Go to **Admin > Users** and assign students to that class.
**Note**: This doesn't prevent the teacher from seeing the exam, but they won't see any students to enter results for.

## Next Steps
1. Have the teacher share their debug info
2. Admin checks the exams table
3. Identify the mismatch
4. Fix the data accordingly

The debug panel will remain visible until we resolve the issue, then we can remove it.
