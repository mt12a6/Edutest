import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { Footer } from './components/layout/Footer';
import { HomeLanding } from './components/home/HomeLanding';
import { WordExamUploadModal } from './components/teacher/WordExamUploadModal';
import { ExamManager } from './components/teacher/ExamManager';
import { ExamResultsViewer } from './components/teacher/ExamResultsViewer';
import { StudentSubmissionsManager } from './components/teacher/StudentSubmissionsManager';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard';
import { LiveExamMonitor } from './components/teacher/LiveExamMonitor';

import { StudentExamList } from './components/student/StudentExamList';
import { StudentHistory } from './components/student/StudentHistory';
import { ExamLobbyModal } from './components/student/ExamLobbyModal';
import { ExamTakingRoom } from './components/student/ExamTakingRoom';
import { ExamResultView } from './components/student/ExamResultView';
import { UserManager } from './components/admin/UserManager';
import { ClassSubjectManager } from './components/admin/ClassSubjectManager';
import { ClassStudentManager } from './components/admin/ClassStudentManager';
import { PlickersScannerView } from './components/qr-exam/PlickersScannerView';
import { PlickersPresentationView } from './components/qr-exam/PlickersPresentationView';
import { CameraDiagnosticModal } from './components/qr-exam/CameraDiagnosticModal';
import { QRCardPrintModal } from './components/qr-exam/QRCardPrintModal';
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
import { SecureExamStudentSelectModal } from './components/common/SecureExamStudentSelectModal';
import { FolderView } from './components/folder/FolderView';
import { NotFoundView } from './components/common/NotFoundView';
import { VanNgheScoringManager } from './components/vannghe/VanNgheScoringManager';
import { 
  getExams, 
  getClasses, 
  getSubjects, 
  checkAndSeedInitialData, 
  getExamById,
  getExamQuestions,
  deleteExam,
  startOrCreateAttempt,
  findExamBySlug,
  findSubjectBySlug,
  getPlickersSessionById
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
  const [viewingResultsTab, setViewingResultsTab] = useState<'by_class' | 'students' | 'questions' | 'essay_grading'>('by_class');

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
  const [secretExamTarget, setSecretExamTarget] = useState<Exam | null>(null);
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

  // Dynamic Routing & Folder states
  const [activeFolderSubject, setActiveFolderSubject] = useState<Subject | null>(null);
  const [notFoundRoute, setNotFoundRoute] = useState<{ path: string; type: 'bai-thi' | 'thu-muc' | 'page' } | null>(null);

  // Plickers testing states
  const [activePlickersExam, setActivePlickersExam] = useState<Exam | null>(null);
  const [activePlickersQuestions, setActivePlickersQuestions] = useState<Question[]>([]);
  const [activePlickersClassId, setActivePlickersClassId] = useState<string>('');
  const [showPrintCardsModal, setShowPrintCardsModal] = useState<boolean>(false);
  const [selectedPrintClassId, setSelectedPrintClassId] = useState<string>('');

  // Dynamic Route Resolver for /bai-thi/:slug and /thu-muc/:slug and aliases
  const resolveCurrentRoute = async (examList: Exam[], subjectList: Subject[]) => {
    if (typeof window === 'undefined') return;
    const pathname = window.location.pathname;

    // 1. Direct Exam Route: /bai-thi/:slug
    if (pathname.startsWith('/bai-thi/')) {
      const rawSlug = pathname.replace(/^\/bai-thi\//, '').replace(/\/+$/, '');
      const slug = decodeURIComponent(rawSlug).trim();
      if (!slug) {
        setNotFoundRoute({ path: pathname, type: 'bai-thi' });
        return;
      }

      const res = await findExamBySlug(slug);
      if (res.exam) {
        // Automatic Redirect if matched an older slug
        if (res.isRedirect && res.canonicalSlug) {
          window.history.replaceState(null, '', `/bai-thi/${res.canonicalSlug}`);
        }
        setNotFoundRoute(null);
        setActiveFolderSubject(null);
        try {
          const qList = await getExamQuestions(res.exam.id);
          setLobbyExam({ exam: res.exam, questions: qList });
        } catch (err) {
          console.warn('Lỗi tải câu hỏi theo đường dẫn:', err);
        }
      } else {
        setNotFoundRoute({ path: pathname, type: 'bai-thi' });
      }
      return;
    }

    // 2. Direct Folder Route: /thu-muc/:slug
    if (pathname.startsWith('/thu-muc/')) {
      const rawSlug = pathname.replace(/^\/thu-muc\//, '').replace(/\/+$/, '');
      const slug = decodeURIComponent(rawSlug).trim();
      if (!slug) {
        setNotFoundRoute({ path: pathname, type: 'thu-muc' });
        return;
      }

      const res = await findSubjectBySlug(slug);
      if (res.subject) {
        // Automatic Redirect if matched an older slug
        if (res.isRedirect && res.canonicalSlug) {
          window.history.replaceState(null, '', `/thu-muc/${res.canonicalSlug}`);
        }
        setNotFoundRoute(null);
        setActiveFolderSubject(res.subject);
      } else {
        setNotFoundRoute({ path: pathname, type: 'thu-muc' });
      }
      return;
    }

    // 3. Known static tabs (/home, /teacher-exams, etc.) or URL Search Params (?tab=...&session=...)
    const urlParams = new URLSearchParams(window.location.search);
    const searchTab = urlParams.get('tab');
    const sessionParam = urlParams.get('session');
    const classIdParam = urlParams.get('classId');

    const cleanTab = searchTab || pathname.replace(/^\//, '').replace(/\/+$/, '');
    const validTabs = [
      'home', 'teacher-exams', 'teacher-submissions', 'teacher-results', 'teacher-live', 
      'plickers-live', 'plickers-present', 'plickers-cards', 'plickers-test',
      'student-exams', 'student-history', 
      'admin-users', 'admin-classes', 'admin-students', 'admin-logs', 'admin-backup',
      'vannghe-scoring'
    ];

    if (validTabs.includes(cleanTab)) {
      setNotFoundRoute(null);
      setActiveFolderSubject(null);
      setCurrentTab(cleanTab);

      // Auto-bind session for mobile scanner connected via QR Code
      if (sessionParam) {
        try {
          const sessionData = await getPlickersSessionById(sessionParam);
          if (sessionData) {
            const matchedExam = examList.find(e => e.id === sessionData.examId) || await getExamById(sessionData.examId);
            if (matchedExam) {
              setActivePlickersExam(matchedExam);
              setActivePlickersClassId(sessionData.classId || classIdParam || '');
              const qList = await getExamQuestions(matchedExam.id);
              setActivePlickersQuestions(qList);
            }
          }
        } catch (err) {
          console.warn('Auto bind session note:', err);
        }
      }
      return;
    }

    if (pathname === '/' || pathname === '') {
      setNotFoundRoute(null);
      setActiveFolderSubject(null);
      return;
    }

    // 4. Unknown route -> 404
    if (!pathname.startsWith('/api') && !pathname.startsWith('/assets') && !pathname.startsWith('/@')) {
      setNotFoundRoute({ path: pathname, type: 'page' });
    }
  };

  const navigateTo = (path: string, tabName: string = 'home') => {
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', path);
    }
    setNotFoundRoute(null);
    setActiveFolderSubject(null);
    setViewingResultsExam(null);
    setViewingResultSession(null);
    setCurrentTab(tabName);
  };

  // Initial data loader - optimized for instant sub-200ms page load
  const reloadData = async () => {
    setIsDataLoading(true);
    try {
      // Run background seed check asynchronously without blocking UI data retrieval
      checkAndSeedInitialData().catch(() => {});

      const [examList, classList, subjectList] = await Promise.all([
        getExams(),
        getClasses(),
        getSubjects()
      ]);
      setExams(examList);
      setClasses(classList);
      setSubjects(subjectList);

      // Resolve current URL routing after data is ready
      resolveCurrentRoute(examList, subjectList);
    } catch (err) {
      console.warn('Initial data note:', err);
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Browser Back/Forward navigation listener
  useEffect(() => {
    const handlePopState = () => {
      if (exams.length > 0) {
        resolveCurrentRoute(exams, subjects);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [exams, subjects]);

  // Listen for direct exam links, secret links, or scanned QR codes (?secretToken=... or ?examId=...)
  useEffect(() => {
    if (exams.length === 0) return;
    const urlParams = new URLSearchParams(window.location.search);
    const targetSecretToken = urlParams.get('secretToken');
    const targetExamId = urlParams.get('examId');

    if (targetSecretToken && !activeTakingSession && !secretExamTarget && !lobbyExam) {
      const foundExam = exams.find(e => e.secretToken === targetSecretToken);
      if (foundExam) {
        setSecretExamTarget(foundExam);
      }
    } else if (targetExamId && !activeTakingSession && !lobbyExam) {
      const foundExam = exams.find(e => e.id === targetExamId);
      if (foundExam) {
        getExamQuestions(targetExamId).then(qList => {
          setLobbyExam({ exam: foundExam, questions: qList });
        }).catch(e => console.warn('Lỗi khi mở đề thi từ QR link:', e));
      }
    }
  }, [exams, activeTakingSession, lobbyExam, secretExamTarget]);


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
          navigateTo(tab === 'home' ? '/' : `/${tab}`, tab);
        }}
      />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 flex gap-8">
        
        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onTabChange={(tab) => {
            navigateTo(tab === 'home' ? '/' : `/${tab}`, tab);
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
                navigateTo('/', 'home');
              }}
              onRetakeExam={(exam, questions) => {
                setViewingResultSession(null);
                setLobbyExam({ exam, questions });
              }}
            />

          ) : notFoundRoute ? (
            <NotFoundView
              attemptedPath={notFoundRoute.path}
              type={notFoundRoute.type}
              onBackToHome={() => navigateTo('/', 'home')}
            />

          ) : activeFolderSubject ? (
            <FolderView
              subject={activeFolderSubject}
              exams={exams}
              classes={classes}
              onBackToHome={() => navigateTo('/', 'home')}
              onSelectExamToTake={(exam, questions) => {
                setLobbyExam({ exam, questions: questions || [] });
              }}
              onViewResults={(exam, targetTab) => {
                setViewingResultsExam(exam);
                setViewingResultsTab(targetTab || 'students');
                navigateTo('/teacher-results', 'teacher-results');
              }}
            />

          ) : viewingResultsExam ? (
            <ExamResultsViewer
              exam={viewingResultsExam}
              classes={classes}
              initialTab={viewingResultsTab}
              onBack={() => {
                setViewingResultsExam(null);
                navigateTo('/teacher-exams', 'teacher-exams');
              }}
            />
          ) : currentTab === 'home' ? (
            <HomeLanding
              exams={exams}
              classes={classes}
              subjects={subjects}
              onNavigateTab={(tab) => navigateTo(tab === 'home' ? '/' : `/${tab}`, tab)}
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
              onViewResults={(exam, targetTab) => {
                setViewingResultsExam(exam);
                setViewingResultsTab(targetTab || 'by_class');
                navigateTo('/teacher-results', 'teacher-results');
              }}
              onRefreshExams={reloadData}
            />
          ) : (currentTab === 'teacher-live' || currentTab === 'admin-live') ? (
            (isAdmin || activeRole === 'teacher' || activeRole === 'admin' || profile?.role === 'teacher' || profile?.role === 'admin') ? (
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
                    Chức năng <strong>Giám sát trực tiếp (LIVE)</strong> dành cho <strong>Giáo viên</strong> và <strong>Quản trị viên (Admin)</strong>.
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
          ) : currentTab === 'teacher-submissions' ? (
            <StudentSubmissionsManager
              exams={exams}
              classes={classes}
              onSelectExam={(exam) => {
                setViewingResultsExam(exam);
                setViewingResultsTab('students');
                navigateTo('/teacher-results', 'teacher-results');
              }}
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
          ) : currentTab === 'plickers-live' ? (
            <PlickersScannerView
              exam={activePlickersExam || exams[0] || { id: 'exam_plickers', title: 'Khảo thí lớp học Plickers', subjectName: 'Toán học', questionCount: 10, maxScore: 10, classIds: [classes[0]?.id || '10A1'] }}
              questions={activePlickersQuestions.length > 0 ? activePlickersQuestions : []}
              classes={classes}
              initialClassId={activePlickersClassId || classes[0]?.id}
              onClose={() => navigateTo('/teacher-exams', 'teacher-exams')}
              onOpenPresentation={() => navigateTo('/plickers-present', 'plickers-present')}
            />
          ) : currentTab === 'plickers-test' ? (
            <CameraDiagnosticModal
              isOpen={true}
              classes={classes}
              initialClassId={activePlickersClassId || classes[0]?.id}
              onClose={() => navigateTo('/plickers-live', 'plickers-live')}
            />
          ) : currentTab === 'plickers-present' ? (
            <PlickersPresentationView
              exam={activePlickersExam || exams[0] || { id: 'exam_plickers', title: 'Khảo thí lớp học Plickers', subjectName: 'Toán học', questionCount: 10, maxScore: 10, classIds: [classes[0]?.id || '10A1'] }}
              questions={activePlickersQuestions.length > 0 ? activePlickersQuestions : []}
              classes={classes}
              initialClassId={activePlickersClassId || classes[0]?.id}
              onClose={() => navigateTo('/teacher-exams', 'teacher-exams')}
              onOpenScanner={() => navigateTo('/plickers-live', 'plickers-live')}
            />
          ) : currentTab === 'plickers-cards' ? (
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 text-center space-y-4 max-w-xl mx-auto my-8 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center mx-auto shadow-xs">
                <span className="text-2xl font-black">QR</span>
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">In Bộ Thẻ QR 4 Chiều (Plickers)</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Mỗi học sinh trong lớp được cấp 1 thẻ định danh hình học 4 chiều (A, B, C, D). Giáo viên quét camera một lần để nhận diện cả lớp.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPrintCardsModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Mở Trình In Thẻ
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo('/admin-students', 'admin-students')}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Quản lý Danh Sách Học Sinh
                </button>
              </div>
            </div>
          ) : currentTab === 'admin-students' ? (
            <ClassStudentManager
              classes={classes}
              onRefreshClasses={reloadData}
              onOpenCardPrint={(classId) => {
                setSelectedPrintClassId(classId);
                setShowPrintCardsModal(true);
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
          ) : currentTab === 'vannghe-scoring' ? (
            <VanNgheScoringManager />
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
          onOpenLoginModal={() => {
            window.dispatchEvent(new CustomEvent('edutest:open_login_modal'));
          }}
          onStartExam={(attempt) => {
            setActiveTakingSession({
              exam: lobbyExam.exam,
              questions: lobbyExam.questions,
              attempt
            });
            setLobbyExam(null);
          }}
          onViewPastResult={(result) => {
            setViewingResultSession({
              exam: lobbyExam.exam,
              result,
              questions: lobbyExam.questions
            });
            setLobbyExam(null);
          }}
        />
      )}

      {/* Secret Access Link Candidate Selection Modal */}
      {secretExamTarget && (
        <SecureExamStudentSelectModal
          isOpen={!!secretExamTarget}
          onClose={() => setSecretExamTarget(null)}
          exam={secretExamTarget}
          secretToken={new URLSearchParams(window.location.search).get('secretToken') || secretExamTarget.secretToken}
          onSelectStudent={async (studentInfo) => {
            const target = secretExamTarget;
            setSecretExamTarget(null);
            try {
              const qList = await getExamQuestions(target.id);
              const studentProfile = {
                id: studentInfo.id,
                displayName: studentInfo.displayName,
                email: studentInfo.email,
                role: 'student' as const,
                status: 'active' as const,
                className: studentInfo.className,
                classIds: [studentInfo.classId],
                createdAt: new Date().toISOString()
              };
              const attempt = await startOrCreateAttempt(target, studentProfile, qList.length);
              setActiveTakingSession({
                exam: target,
                questions: qList,
                attempt
              });
            } catch (err) {
              console.error('Lỗi khi vào phòng thi bí mật:', err);
            }
          }}
        />
      )}

      {/* Global QR Card Print Modal */}
      {showPrintCardsModal && (
        <QRCardPrintModal
          isOpen={showPrintCardsModal}
          classes={classes}
          onClose={() => setShowPrintCardsModal(false)}
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
