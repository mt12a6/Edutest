# Security Specification for EduTest

## 1. Data Invariants
1. A user cannot elevate their own role from `student` or `teacher` to `admin`.
2. Initial administrator access is securely bootstrapped to `mt12a6@gmail.com`.
3. Question correct answers must NOT be exposed to students during an active examination session.
4. Students can only read and write their own exam attempts and answers (`resource.data.studentId == request.auth.uid`).
5. Students cannot alter answers after an attempt has reached a terminal status (`submitted` or `timed_out`).
6. Only teachers who created the exam or administrators can edit or delete an exam and its question repository.
7. Only administrators can change user roles and activate/deactivate accounts.
8. System logs are append-only by authenticated actors and read-only by administrators.
9. All IDs must be alphanumeric strings bounded to 128 characters without injection vectors.
10. All document timestamps must adhere to server validation.

## 2. The "Dirty Dozen" Threat Payloads
1. **Privilege Escalation**: Student modifies `/users/{studentId}` setting `role: "admin"`. (Result: Denied)
2. **Ghost Admin Write**: Unauthenticated user creates a record in `/systemLogs`. (Result: Denied)
3. **Cheat Read**: Student queries `/exams/{examId}/questions` looking for `correctOption` during an exam. (Result: Secured / strip from student query or restrict)
4. **Answer Tampering**: Student A updates `/attempts/{attemptId}/answers/{ansId}` belonging to Student B. (Result: Denied)
5. **Post-Deadline Submission**: Student submits answer changes after attempt deadline or status is set to `submitted`. (Result: Denied)
6. **ID Injection Attack**: Client creates doc with 2KB junk unicode characters as doc ID. (Result: Denied by `isValidId`)
7. **Exam Hijack**: Teacher A deletes an exam belonging to Teacher B without admin rights. (Result: Denied)
8. **Results Forgery**: Student attempts to write their own final score in `/results/{resultId}` directly. (Result: Denied)
9. **Fake Email Impersonation**: Attacker signs in with unverified email matching admin address. (Result: Denied by `request.auth.token.email_verified == true`)
10. **Class Roster Injection**: Student adds themselves to arbitrary class without authorization. (Result: Denied)
11. **Denial of Wallet Payload**: Attacker attempts to upload a 20MB string into question prompt. (Result: Denied by size bounds)
12. **Orphan Attempt Creation**: User creates an attempt referencing a non-existent `examId`. (Result: Denied by relational check)
