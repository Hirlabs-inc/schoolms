export type UserRole = "ADMIN" | "TEACHER" | "STUDENT" | "SECRETARY" | "MANAGER"

export interface User {
  id: string
  email: string
  password: string
  role: UserRole
  firstName: string
  lastName: string
}

export interface Student extends User {
  studentNumber: string
  enrollmentYear: number
  classId: string
  academicYear: number
  parentPhone?: string
  phone?: string
  gender?: string
  courseId?: string
  admissionDate?: string
  expectedCompletionDate?: string
  status?: "ACTIVE" | "COMPLETED" | "DROPPED"
  profileId?: string
}

export interface Teacher extends User {
  staffId: string
  department: string
  specialization: string
}

export interface Class {
  id: string
  name: string
  gradeLevel: number
}

export interface Course {
  id: string
  name: string
  code: string
  classId: string
  teacherId: string
  fee?: number
  duration?: string
  commissionRate?: number
}

export interface Exam {
  id: string
  courseId: string
  term: string
  date: string
  totalMarks: number
}

export interface ExamResult {
  id: string
  examId: string
  studentId: string
  marksObtained: number
  grade: string
  remarks: string
}

export interface Attendance {
  id: string
  type: "STUDENT" | "TEACHER"
  studentId?: string
  teacherId?: string
  classId?: string
  date: string
  status: "PRESENT" | "ABSENT" | "LATE" | "SICK"
  excuse?: string
}

export interface Payment {
  id: string
  studentId: string
  feeId: string
  amount: number
  paymentDate: string
  paymentMethod: "CASH" | "M_PESA" | "BANK"
  receiptNumber: string
  notes?: string
  createdAt?: string
  firstName?: string
  lastName?: string
  email?: string
}

export interface Fee {
  id: string
  studentId: string
  courseId: string
  totalFee: number
  balance: number
  dueDate?: string
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE"
  createdAt?: string
  updatedAt?: string
  firstName?: string
  lastName?: string
  email?: string
  courseName?: string
}

export type ExpenseCategory = "RENT" | "SALARIES" | "INTERNET" | "ELECTRICITY" | "MARKETING" | "OFFICE_SUPPLIES" | "TRANSPORT" | "MISCELLANEOUS"

export interface Expense {
  id: string
  category: ExpenseCategory
  amount: number
  description: string
  expenseDate: string
  receiptNumber?: string
  createdBy?: string
  createdAt?: string
}

export type IncomeCategory = "FEES" | "GRANTS" | "DONATIONS" | "OTHER"

export interface Income {
  id: string
  category: IncomeCategory
  amount: number
  description: string
  incomeDate: string
  receiptNumber?: string
  createdBy?: string
  createdAt?: string
}

export type CompensationType = "SALARY" | "COMMISSION"

export interface TeacherContract {
  id: string
  teacherId: string
  compensationType: CompensationType
  salaryAmount?: number
  commissionRate?: number
  commissionPerStudent?: number
  bankName?: string
  bankAccount?: string
  bankCode?: string
  taxId?: string
  startDate?: string
  endDate?: string
  status: "ACTIVE" | "INACTIVE"
  createdAt?: string
  teacherName?: string
}

export interface PayrollRecord {
  id: string
  teacherId: string
  contractId?: string
  amount: number
  periodStart: string
  periodEnd: string
  payDate: string
  payType: "SALARY" | "COMMISSION"
  notes?: string
  status: "PAID" | "PENDING" | "CANCELLED"
  createdAt?: string
  teacherName?: string
}

export type ProgressStatus = "ENROLLED" | "IN_PROGRESS" | "COMPLETED" | "DROPPED"

export interface EnrollmentProgress {
  id: string
  studentId: string
  courseId: string
  progressPercent: number
  status: ProgressStatus
  startDate?: string
  completionDate?: string
  notes?: string
  updatedAt?: string
  createdAt?: string
  studentName?: string
  courseName?: string
}

export interface InstitutionSettings {
  id: string
  name: string
  logo?: string
  receiptHeader?: string
  contactEmail?: string
  contactPhone?: string
  address?: string
  currency: string
  createdAt?: string
  updatedAt?: string
}

export type CommissionStatus = "EARNED" | "PARTIAL" | "PAID"

export interface TeacherCommission {
  id: string
  teacherId: string
  studentId?: string
  courseId?: string
  commissionRate: number
  commissionAmount: number
  paidAmount: number
  status: CommissionStatus
  createdAt?: string
  teacherName?: string
  studentName?: string
  courseName?: string
}

export interface FeeSummary {
  totalFee: number
  amountPaid: number
  balance: number
  nextDueDate?: string
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "NONE"
  payments: Payment[]
}

export interface TeacherCommissionSummary {
  teacherId: string
  teacherName: string
  totalStudentsAssigned: number
  totalCommissionEarned: number
  amountPaid: number
  remainingBalance: number
  currencyNote?: string
}
