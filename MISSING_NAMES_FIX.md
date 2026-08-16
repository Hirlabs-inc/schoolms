# Fix: Missing Names in Attendance ✅

## The Problem

In the attendance pages, student and teacher names were not showing up (or showing as undefined/blank).

### Root Cause

The `students` and `teachers` tables in the database **do not store names**. Names are stored in the `profiles` table.

When fetching data:
```typescript
getItems<Student>("students")
```
It was only fetching fields from the `students` table (`studentNumber`, `classId`, etc.), so `firstName` and `lastName` were missing.

---

## The Fix ✅

Updated `getItems` in `lib/api.ts` to:

### 1. **Join with Profiles Table**
Modified the query to fetch profile data:
```typescript
// For students
supabase.from('students').select('*, profiles(firstName, lastName, email), classes(name)')

// For teachers
supabase.from('teachers').select('*, profiles(firstName, lastName, email)')
```

### 2. **Flatten the Data**
The database returns nested data:
```json
{
  "id": "123",
  "profiles": { "firstName": "John", "lastName": "Doe" }
}
```

I added logic to flatten this so the app can use it as expected:
```json
{
  "id": "123",
  "firstName": "John",
  "lastName": "Doe"
}
```

---

## What You'll See Now

- ✅ **Admin Attendance**: Student and teacher names will appear
- ✅ **Teacher Attendance**: Student names will appear
- ✅ **Sorting**: The alphabetical sorting I added earlier will now work correctly (since it relies on names)

---

## Technical Note

This fix applies globally to `getItems`, so any page fetching students or teachers will now correctly receive their names and email addresses.

---

## Test It

1. Go to **Admin → Attendance**
2. Select a class
3. ✅ You should see student names (e.g., "Ahmed Hassan") instead of blank/undefined

