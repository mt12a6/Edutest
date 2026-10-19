import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { HomeLanding } from './components/home/HomeLanding';
import { WordExamUploadModal } from './components/teacher/WordExamUploadModal';
import { ExamManager } from './components/teacher/ExamManager';
import { ExamResultsViewer } from './components/teacher/ExamResultsViewer';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard';
import { StudentExamList } from './components/student/StudentExamList';
import { StudentHistory } from './components/student/StudentHistory';
import { ExamLobbyModal } from './components/student/ExamLobbyModal';
import { ExamTakingRoom } from './components/student/ExamTakingRoom';
import { ExamResultView } from './components/student/ExamResultView';
import { UserManager } from './components/admin/UserManager';
import { ClassSubjectManager } from './components/admin/ClassSubjectManager';
import { SystemAuditLogs } from './components/admin/SystemAuditLogs';
import { 
  Exam, 
  SchoolClass, 
  Subject, 
  Question, 
  ExamAttempt, 
  ExamResult 
} from './types';
import { 
  getExams, 
  getClasses, 
  getSubjects, 
  checkAndSeedInitialData, 
  getExamById,
  getExamQuestions 
} from './services/db';
import { AlertTriangle, Lock, ShieldAlert } from 'lucide-react';

function MainApp() {
  const { user, profile, activeRole, isLoading: authLoading } = useAuth();

  // Navigation tab
  const [currentTab, setCurrentTab] = useState<string>('home');

  // Database collections state
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);

  // Modals and Active Workflows
  const [showWordUpload, setShowWordUpload] = useState<boolean>(false);
  const [editingExamSession, setEditingExamSession] = useState<{ exam: Exam; questions: Question[] } | null>(null);
  const [viewingResultsExam, setViewingResultsExam] = useState<Exam | null>(null);

  const handleStartEditExam = async (exam: Exam) => {
    try {
      const qList = await getExamQuestions(exam.id);
      setEditingExamSession({ exam, questions: qList });
      setShowWordUpload(true);
    } catch (err) {
      console.error('Không thể tải câu hỏi để chỉnh sửa:', err);
    }
  };

  // Student Exam Taking Workflow
  const [lobbyExam, setLobbyExam] = useState<{ exam: Exam; questions: Question[] } | null>(null);
  const [activeTakingSession, setActiveTakingSession] = useState<{
    exam: Exam;
    questions: Question[];
    attempt: ExamAttempt;
  } | null>(null);

  // Exam Result Screen
  const [viewingResultSession, setViewingResultSession] = useState<{
    exam: Exam;
    result: ExamResult;
    questions: Question[];
    attempt?: ExamAttempt;
  } | null>(null);

  // Initial data loader
  const reloadData = async () => {
    setIsDataLoading(true);
    try {
      await checkAndSeedInitialData();
      const [examList, classList, subjectList] = await Promise.all([
        getExams(),
        getClasses(),
        getSubjects()
      ]);
      setExams(examList);
      setClasses(classList);
      setSubjects(subjectList);
    } catch (err) {
      console.warn('Initial data note:', err);
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Account disabled barrier
  if (profile?.status === 'disabled') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-rose-200 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Tài khoản đã bị tạm khóa
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Tài khoản {profile.email} đã bị quản trị viên tạm khóa. Vui lòng liên hệ ban giám hiệu hoặc quản trị viên nhà trường để được hỗ trợ mở khóa.
          </p>
        </div>
      </div>
    );
  }

  // Active exam taking room (full screen takeover)
  if (activeTakingSession) {
    return (
      <ExamTakingRoom
        exam={activeTakingSession.exam}
        questions={activeTakingSession.questions}
        initialAttempt={activeTakingSession.attempt}
        onFinishExam={(result) => {
          setActiveTakingSession(null);
          setViewingResultSession({
            exam: activeTakingSession.exam,
            result,
            questions: activeTakingSession.questions,
            attempt: activeTakingSession.attempt
          });
        }}
        onExit={() => setActiveTakingSession(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      
      {/* Navbar */}
      <Navbar
        currentTab={currentTab}
        onTabChange={(tab) => {
          setViewingResultsExam(null);
          setViewingResultSession(null);
          setCurrentTab(tab);
        }}
      />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 flex gap-8">
        
        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onTabChange={(tab) => {
            setViewingResultsExam(null);
            setViewingResultSession(null);
            setCurrentTab(tab);
          }}
          onOpenWordUpload={() => setShowWordUpload(true)}
        />

        {/* Content Area */}
        <main className="flex-1 min-w-0">
          
          {/* Active Result View Screen */}
          {viewingResultSession ? (
            <ExamResultView
              exam={viewingResultSession.exam}
              result={viewingResultSession.result}
              questions={viewingResultSession.questions}
              attempt={viewingResultSession.attempt}
              onBackToDashboard={() => {
                setViewingResultSession(null);
                setCurrentTab('student-exams');
              }}
            />
          ) : viewingResultsExam ? (
            <ExamResultsViewer
              exam={viewingResultsExam}
              classes={classes}
              onBack={() => {
                setViewingResultsExam(null);
                setCurrentTab('teacher-exams');
              }}
            />
          ) : currentTab === 'home' ? (
            <HomeLanding
              exams={exams}
              classes={classes}
              subjects={subjects}
              onNavigateTab={setCurrentTab}
              onOpenWordUpload={() => setShowWordUpload(true)}
            />
          ) : currentTab === 'teacher-exams' ? (
            <ExamManager
              exams={exams}
              classes={classes}
              subjects={subjects}
              onOpenWordUpload={() => {
                setEditingExamSession(null);
                setShowWordUpload(true);
              }}
              onEditExam={handleStartEditExam}
              onViewResults={(exam) => {
                setViewingResultsExam(exam);
                setCurrentTab('teacher-results');
              }}
              onRefreshExams={reloadData}
            />
          ) : currentTab === 'teacher-results' ? (
            <AnalyticsDashboard
              exams={exams}
              classes={classes}
              subjects={subjects}
              initialExam={viewingResultsExam}
            />
          ) : currentTab === 'student-exams' ? (
            <StudentExamList
              exams={exams}
              onSelectExamToTake={(exam, questions) => {
                setLobbyExam({ exam, questions });
              }}
              onResumeAttempt={(exam, questions, attempt) => {
                setActiveTakingSession({ exam, questions, attempt });
              }}
              onViewResult={(exam, result, questions, attempt) => {
                setViewingResultSession({ exam, result, questions, attempt });
              }}
            />
          ) : currentTab === 'student-history' ? (
            <StudentHistory
              exams={exams}
              onViewResult={(exam, result, questions) => {
                setViewingResultSession({ exam, result, questions });
              }}
            />
          ) : currentTab === 'admin-users' ? (
            <UserManager />
          ) : currentTab === 'admin-classes' ? (
            <ClassSubjectManager
              classes={classes}
              subjects={subjects}
              onRefresh={reloadData}
            />
          ) : currentTab === 'admin-logs' ? (
            <SystemAuditLogs />
          ) : (
            <HomeLanding
              exams={exams}
              classes={classes}
              subjects={subjects}
              onNavigateTab={setCurrentTab}
              onOpenWordUpload={() => {
                setEditingExamSession(null);
                setShowWordUpload(true);
              }}
            />
          )}
        </main>
      </div>

      {/* Word / PDF / JSON Upload & Edit Modal */}
      {showWordUpload && (
        <WordExamUploadModal
          isOpen={showWordUpload}
          onClose={() => {
            setShowWordUpload(false);
            setEditingExamSession(null);
          }}
          initialExam={editingExamSession?.exam}
          initialQuestions={editingExamSession?.questions}
          onExamCreated={(newExamId) => {
            setShowWordUpload(false);
            setEditingExamSession(null);
            reloadData();
            setCurrentTab('teacher-exams');
          }}
          classes={classes}
          subjects={subjects}
        />
      )}

      {/* Student Exam Lobby Modal */}
      {lobbyExam && (
        <ExamLobbyModal
          isOpen={!!lobbyExam}
          onClose={() => setLobbyExam(null)}
          exam={lobbyExam.exam}
          questions={lobbyExam.questions}
          onStartExam={(attempt) => {
            setActiveTakingSession({
              exam: lobbyExam.exam,
              questions: lobbyExam.questions,
              attempt
            });
            setLobbyExam(null);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
