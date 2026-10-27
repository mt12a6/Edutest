import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { Footer } from './components/layout/Footer';
import { HomeLanding } from './components/home/HomeLanding';
import { WordExamUploadModal } from './components/teacher/WordExamUploadModal';
import { ExamManager } from './components/teacher/ExamManager';
import { ExamResultsViewer } from './components/teacher/ExamResultsViewer';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard';
import { LiveExamMonitor } from './components/teacher/LiveExamMonitor';

import { StudentExamList } from './components/student/StudentExamList';
import { StudentHistory } from './components/student/StudentHistory';
import { ExamLobbyModal } from './components/student/ExamLobbyModal';
import { ExamTakingRoom } from './components/student/ExamTakingRoom';
import { ExamResultView } from './components/student/ExamResultView';
import { UserManager } from './components/admin/UserManager';
import { ClassSubjectManager } from './components/admin/ClassSubjectManager';
import { SystemAuditLogs } from './components/admin/SystemAuditLogs';
import { BackupRestoreManager } from './components/admin/BackupRestoreManager';
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
  getExamQuestions,
  deleteExam
} from './services/db';

import { AlertTriangle, Lock, ShieldAlert } from 'lucide-react';

function MainApp() {
  const { user, profile, activeRole, isAdmin, isLoading: authLoading } = useAuth();

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

  // Listen for direct exam links or scanned QR codes (?examId=...)
  useEffect(() => {
    if (exams.length === 0) return;
    const urlParams = new URLSearchParams(window.location.search);
    const targetExamId = urlParams.get('examId');
    if (targetExamId && !activeTakingSession && !lobbyExam) {
      const foundExam = exams.find(e => e.id === targetExamId);
      if (foundExam) {
        getExamQuestions(targetExamId).then(qList => {
          setLobbyExam({ exam: foundExam, questions: qList });
        }).catch(e => console.warn('Lỗi khi mở đề thi từ QR link:', e));
      }
    }
  }, [exams, activeTakingSession, lobbyExam]);

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
        onFinishExam={(result, finalAttempt) => {
          setActiveTakingSession(null);
          setViewingResultSession({
            exam: activeTakingSession.exam,
            result,
            questions: activeTakingSession.questions,
            attempt: finalAttempt || {
              ...activeTakingSession.attempt,
              answers: result.answers || {}
            }
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
                setCurrentTab('home');
              }}
              onRetakeExam={(exam, questions) => {
                setViewingResultSession(null);
                setLobbyExam({ exam, questions });
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
              onOpenWordUpload={() => {
                setEditingExamSession(null);
                setShowWordUpload(true);
              }}
              onSelectExamToTake={(exam, questions) => {
                setLobbyExam({ exam, questions });
              }}
              onEditExam={handleStartEditExam}
              onDeleteExam={async (exam) => {
                await deleteExam(exam.id);
                reloadData();
              }}
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
          ) : (currentTab === 'teacher-live' || currentTab === 'admin-live') ? (
            isAdmin ? (
              <LiveExamMonitor
                exams={exams}
                classes={classes}
                subjects={subjects}
              />
            ) : (
              <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center max-w-md mx-auto my-12 space-y-4 shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Giới hạn quyền truy cập</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Chức năng <strong>Giám sát trực tiếp (LIVE)</strong> chỉ được phép truy cập bởi tài khoản <strong>Quản trị viên (Admin)</strong>.
                  </p>
                </div>
                <button
                  onClick={() => setCurrentTab('home')}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  Quay lại Trang chủ
                </button>
              </div>
            )
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
          ) : currentTab === 'admin-backup' ? (
            <BackupRestoreManager />
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
              onSelectExamToTake={(exam, questions) => {
                setLobbyExam({ exam, questions });
              }}
              onDirectStartExam={(exam, questions, attempt) => {
                setActiveTakingSession({ exam, questions, attempt });
              }}
              onEditExam={handleStartEditExam}
              onDeleteExam={async (exam) => {
                await deleteExam(exam.id);
                reloadData();
              }}
              onRefreshExams={reloadData}
            />

          )}
        </main>
      </div>

      {/* Persistent EduTest PRO Footer */}
      <Footer />

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
