// SQLite-backed Drop-in replacement for lib/api.ts
import type { User, Student, Teacher, Class, Course, Exam, ExamResult, Attendance } from "./types"

// Helper to call the SQLite Bridge API
async function dbCall(action: string, payload: any = {}) {
    const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload })
    });
    const result = await res.json();
    if (result.error) throw new Error(result.error);
    return result.data;
}

// Map storage keys to table names
const TABLE_MAP: Record<string, string> = {
    users: 'profiles',
    students: 'students',
    teachers: 'teachers',
    classes: 'classes',
    courses: 'courses',
    exams: 'exams',
    examResults: 'exam_results',
    attendance: 'attendance',
}

// --- Auth (Mocked via SQLite) ---

export async function login(email: string, password: string) {
    // 1. Verify credentials in SQLite (Note: This assumes passwords were migrated or handled)
    const query = `WHERE email = ?`;
    const users = await dbCall('select', { table: 'auth_users', query, params: [email] });
    
    if (users.length === 0) throw new Error('Invalid credentials');
    const authUser = users[0];

    // 2. Fetch profile
    const profileQuery = `WHERE id = ?`;
    const profiles = await dbCall('select', { table: 'profiles', query: profileQuery, params: [authUser.id] });
    
    if (profiles.length === 0) throw new Error('Profile not found');
    return { ...authUser, ...profiles[0] };
}

export async function logout() {
    // Simply clear local state if any
    return true;
}

export async function getCurrentUser() {
    // In a real app, you'd check a cookie/session here
    return null; 
}

// --- Generic CRUD (hitting the Bridge) ---

export async function getItems<T>(key: string): Promise<T[]> {
    const table = TABLE_MAP[key];
    if (!table) throw new Error(`Unknown key: ${key}`);

    // Replicate relationship joins manually or via specific SQL
    if (key === 'students') {
        const query = `
            JOIN auth_users ON students.id = auth_users.id 
            JOIN classes ON students.classId = classes.id
        `;
        // Note: The bridge needs to support joins. For now, we'll do simple select.
        return dbCall('select', { table });
    }

    return dbCall('select', { table });
}

export async function addItem<T extends { id?: string }>(key: string, item: T): Promise<T> {
    const table = TABLE_MAP[key];
    return dbCall('insert', { table, data: item });
}

export async function updateItem<T>(key: string, id: string, updates: Partial<T>): Promise<T> {
    const table = TABLE_MAP[key];
    return dbCall('update', { table, id, data: updates });
}

export async function deleteItem(key: string, id: string): Promise<void> {
    const table = TABLE_MAP[key];
    return dbCall('delete', { table, id });
}

// --- Specific Logic ---

export async function getStudentsInClass(classId: string) {
    const query = `WHERE "classId" = ?`;
    return dbCall('select', { table: 'students', query, params: [classId] });
}

export async function createUser(userData: any) {
    // 1. Create Auth User
    const authUser = await dbCall('insert', { 
        table: 'auth_users', 
        data: { id: crypto.randomUUID(), email: userData.email } 
    });

    // 2. Create Profile
    await dbCall('insert', {
        table: 'profiles',
        data: {
            id: authUser.id,
            email: userData.email,
            role: userData.role,
            firstName: userData.firstName,
            lastName: userData.lastName
        }
    });

    // ... similar for students/teachers
    return { success: true, userId: authUser.id };
}

export function generateStudentNumber(): string {
    const year = new Date().getFullYear().toString().slice(-2);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `STU${year}${random}`;
}
