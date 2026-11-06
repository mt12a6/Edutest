import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  Clock, 
  Monitor, 
  CheckCircle2, 
  AlertCircle, 
  Award, 
  Download, 
  Printer, 
  Save, 
  Sparkles, 
  Search, 
  Filter, 
  ChevronRight, 
  Plus, 
  BookOpen, 
  Check, 
  X, 
  AlertTriangle,
  RotateCcw,
  FileSpreadsheet,
  GraduationCap,
  Layers,
  Edit3
} from 'lucide-react';
import { SchoolClass, Subject } from '../../types';
import { 
  getAllUsers, 
  getClassAttendanceRecords, 
  saveClassAttendanceRecord, 
  ClassAttendanceRecord, 
  StudentAttendanceItem 
} from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import * as XLSX from 'xlsx';

interface ClassAttendanceManagerProps {
  classes: SchoolClass[];
  subjects: Subject[];
}

export const ClassAttendanceManager: React.FC<ClassAttendanceManagerProps> = ({
  classes,
  subjects
}) => {
  const { user, profile } = useAuth();

  // Selected Class & Date & Period
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.name || '6A1');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1);
  const [selectedSubjectName, setSelectedSubjectName] = useState<string>(subjects[0]?.name || 'Tin học');
  const [lessonType, setLessonType] = useState<'theory' | 'practice_lab'>('practice_lab');
  const [lessonTitle, setLessonTitle] = useState<string>('Bài thực hành: Soạn thảo văn bản & bảng tính');

  // Teaching Session Evaluation (Sổ đầu bài)
  const [sessionRating, setSessionRating] = useState<'excellent' | 'good' | 'average' | 'poor'>('excellent');
  const [evaluationNotes, setEvaluationNotes] = useState<string>('Lớp học nghiêm túc, trật tự, thực hành tốt trên máy tính.');
  const [homeworkNotes, setHomeworkNotes] = useState<string>('Xem lại bài học và chuẩn bị trước bài tập thực hành tiếp theo.');
  const [teacherName, setTeacherName] = useState<string>(profile?.displayName || user?.displayName || 'Giáo viên phụ trách');

  // Student Attendance Items
  const [students, setStudents] = useState<StudentAttendanceItem[]>([]);
  const [searchStudent, setSearchStudent] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'late' | 'excused' | 'unexcused'>('all');
  
  // Status feedback
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);
  const [historyRecords, setHistoryRecords] = useState<ClassAttendanceRecord[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // Standard Vietnamese names generator for class roster fallback
  const generateDefaultClassRoster = (clsName: string, count: number = 35): StudentAttendanceItem[] => {
    const lastNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Phan', 'Đỗ', 'Bùi', 'Đặng'];
    const middleNames = ['Văn', 'Thị', 'Đình', 'Thanh', 'Hữu', 'Ngọc', 'Quang', 'Minh', 'Đức', 'Phương'];
    const firstNames = ['An', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Giang', 'Hà', 'Hải', 'Huy', 'Khoa', 'Linh', 'Long', 'Mai', 'Nam', 'Nhi', 'Phong', 'Quân', 'Sơn', 'Tâm', 'Thảo', 'Trang', 'Tuấn', 'Tùng', 'Vy', 'Yến'];

    const roster: StudentAttendanceItem[] = [];
    for (let i = 1; i <= count; i++) {
      const ln = lastNames[(i * 3) % lastNames.length];
      const mn = middleNames[(i * 7) % middleNames.length];
      const fn = firstNames[(i * 11) % firstNames.length];
      roster.push({
        studentId: `std-${clsName}-${i}`,
        studentName: `${ln} ${mn} ${fn}`,
        status: 'present',
        labComputerNumber: `Máy ${String(i).padStart(2, '0')}`,
        notes: ''
      });
    }
    return roster;
  };

  // Load existing attendance record or generate class roster
  useEffect(() => {
    const loadClassData = async () => {
      try {
        const records = await getClassAttendanceRecords(selectedClassId);
        setHistoryRecords(records);

        // Check if a record already exists for this date and period
        const matched = records.find(r => r.date === selectedDate && r.period === selectedPeriod);
        if (matched) {
          setLessonTitle(matched.lessonTitle || '');
          setLessonType(matched.lessonType || 'practice_lab');
          setSessionRating(matched.rating || 'excellent');
          setEvaluationNotes(matched.evaluationNotes || '');
          setHomeworkNotes(matched.homeworkNotes || '');
          setTeacherName(matched.teacherName || profile?.displayName || 'Giáo viên');
          setSelectedSubjectName(matched.subjectName || 'Tin học');
          setStudents(matched.students || []);
          return;
        }

        // Otherwise load real users from class or fallback to standard roster
        const allUsers = await getAllUsers();
        const classUsers = allUsers.filter(u => 
          u.role === 'student' && 
          (u.className?.toUpperCase() === selectedClassId.toUpperCase() || u.classIds?.includes(selectedClassId))
        );

        if (classUsers.length > 0) {
          const list: StudentAttendanceItem[] = classUsers.map((u, idx) => ({
            studentId: u.id,
            studentName: u.displayName || u.email,
            status: 'present',
            labComputerNumber: `Máy ${String(idx + 1).padStart(2, '0')}`,
            notes: ''
          }));
          setStudents(list);
        } else {
          const clsObj = classes.find(c => c.name === selectedClassId || c.id === selectedClassId);
          const count = clsObj?.studentCount || 35;
          setStudents(generateDefaultClassRoster(selectedClassId, count));
        }
      } catch (err) {
        console.error('Lỗi nạp dữ liệu chuyên cần:', err);
        setStudents(generateDefaultClassRoster(selectedClassId, 35));
      }
    };

    loadClassData();
  }, [selectedClassId, selectedDate, selectedPeriod]);

  // Quick action: Mark all present
  const handleMarkAllPresent = () => {
    setStudents(prev => prev.map(s => ({ ...s, status: 'present' })));
  };

  // Quick action: Auto-assign computers (Máy 01 -> Máy N)
  const handleAutoAssignComputers = () => {
    setStudents(prev => prev.map((s, idx) => ({
      ...s,
      labComputerNumber: `Máy ${String(idx + 1).padStart(2, '0')}`
    })));
  };

  // Update single student status
  const handleSetStudentStatus = (studentId: string, status: 'present' | 'late' | 'excused' | 'unexcused') => {
    setStudents(prev => prev.map(s => s.studentId === studentId ? { ...s, status } : s));
  };

  // Update single student computer number
  const handleSetComputerNumber = (studentId: string, computerNum: string) => {
    setStudents(prev => prev.map(s => s.studentId === studentId ? { ...s, labComputerNumber: computerNum } : s));
  };

  // Update student note
  const handleSetStudentNote = (studentId: string, notes: string) => {
    setStudents(prev => prev.map(s => s.studentId === studentId ? { ...s, notes } : s));
  };

  // Save Attendance & Teaching Evaluation
  const handleSaveAttendance = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    try {
      const clsObj = classes.find(c => c.name === selectedClassId || c.id === selectedClassId);
      const recordData = {
        classId: selectedClassId,
        className: clsObj?.name || selectedClassId,
        date: selectedDate,
        period: selectedPeriod,
        subjectName: selectedSubjectName,
        lessonTitle: lessonTitle.trim() || 'Nội dung tiết học',
        lessonType,
        rating: sessionRating,
        evaluationNotes: evaluationNotes.trim(),
        homeworkNotes: homeworkNotes.trim(),
        teacherName: teacherName.trim(),
        teacherId: user?.uid || profile?.id || 'teacher',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        students
      };

      await saveClassAttendanceRecord(recordData);
      setSaveSuccessMsg(`Đã lưu thành công Sổ chuyên cần & Đánh giá ngày dạy cho Lớp ${selectedClassId}!`);
      
      // Update history list
      const updatedList = await getClassAttendanceRecords(selectedClassId);
      setHistoryRecords(updatedList);

      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Lỗi lưu sổ chuyên cần:', err);
      setSaveErrorMsg('Không thể lưu sổ chuyên cần. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    const dataRows = students.map((s, idx) => ({
      'STT': idx + 1,
      'Mã học sinh': s.studentId,
      'Họ và tên': s.studentName,
      'Lớp': selectedClassId,
      'Ngày dạy': selectedDate,
      'Tiết': selectedPeriod,
      'Môn học': selectedSubjectName,
      'Chuyên cần': s.status === 'present' ? 'Đi học' : s.status === 'late' ? 'Đi muộn' : s.status === 'excused' ? 'Nghỉ có phép' : 'Nghỉ không phép',
      'Máy tính thực hành': lessonType === 'practice_lab' ? (s.labComputerNumber || 'Chưa gán') : 'Lý thuyết',
      'Ghi chú': s.notes || ''
    }));

    const summaryRow = [
      {
        'STT': 'ĐÁNH GIÁ NGÀY DẠY',
        'Mã học sinh': `Xếp loại: ${sessionRating === 'excellent' ? 'Tốt' : sessionRating === 'good' ? 'Khá' : sessionRating === 'average' ? 'Đạt' : 'Cần cố gắng'}`,
        'Họ và tên': `Nhận xét: ${evaluationNotes}`,
        'Lớp': `Dặn dò: ${homeworkNotes}`,
        'Ngày dạy': `Giáo viên: ${teacherName}`,
        'Tiết': '',
        'Môn học': '',
        'Chuyên cần': '',
        'Máy tính thực hành': '',
        'Ghi chú': ''
      }
    ];

    const ws = XLSX.utils.json_to_sheet([...dataRows, ...summaryRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `ChuyenCan_${selectedClassId}`);
    XLSX.writeFile(wb, `SoChuyenCan_Lop${selectedClassId}_Ngay_${selectedDate}.xlsx`);
  };

  // Metrics calculation
  const totalCount = students.length;
  const presentCount = students.filter(s => s.status === 'present').length;
  const lateCount = students.filter(s => s.status === 'late').length;
  const excusedCount = students.filter(s => s.status === 'excused').length;
  const unexcusedCount = students.filter(s => s.status === 'unexcused').length;

  const filteredStudents = students.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (searchStudent.trim() && !s.studentName.toLowerCase().includes(searchStudent.toLowerCase()) && !s.labComputerNumber?.toLowerCase().includes(searchStudent.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      
      {/* Toast Alert */}
      {saveSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center justify-between shadow-xs animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{saveSuccessMsg}</span>
          </div>
          <button onClick={() => setSaveSuccessMsg(null)} className="p-1 text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {saveErrorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{saveErrorMsg}</span>
          </div>
          <button onClick={() => setSaveErrorMsg(null)} className="p-1 text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Header Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-teal-600 text-white flex items-center justify-center shadow-md">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
              Quản lý Học sinh theo Lớp &amp; Sổ Chuyên cần
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi chuyên cần, vị trí máy tính thực hành tin học và đánh giá chất lượng ngày dạy
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Xuất bảng điểm danh & phòng máy sang file Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Xuất Excel</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs hidden sm:flex"
            title="In sổ chuyên cần chuẩn trang A4"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>In A4</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAttendance}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Đang lưu...' : 'Lưu Sổ chuyên cần'}</span>
          </button>
        </div>
      </div>

      {/* 2. Class, Date, Period & Subject Selector Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Class Selector */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Lớp học:
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            {classes.map(c => (
              <option key={c.id} value={c.name}>
                Lớp {c.name} (Khối {c.grade})
              </option>
            ))}
          </select>
        </div>

        {/* Date Selector */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Ngày dạy:
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 cursor-pointer"
          />
        </div>

        {/* Period Selector */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Tiết học:
          </label>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(Number(e.target.value))}
            className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value={1}>Tiết 1 (Sáng)</option>
            <option value={2}>Tiết 2 (Sáng)</option>
            <option value={3}>Tiết 3 (Sáng)</option>
            <option value={4}>Tiết 4 (Sáng)</option>
            <option value={5}>Tiết 5 (Sáng)</option>
            <option value={6}>Tiết 6 (Chiều)</option>
            <option value={7}>Tiết 7 (Chiều)</option>
            <option value={8}>Tiết 8 (Chiều)</option>
          </select>
        </div>

        {/* Subject Selector */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Môn học:
          </label>
          <select
            value={selectedSubjectName}
            onChange={(e) => setSelectedSubjectName(e.target.value)}
            className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            {subjects.map(s => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Lesson Type (Thực hành phòng máy vs Lý thuyết) */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Hình thức tiết dạy:
          </label>
          <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setLessonType('practice_lab')}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                lessonType === 'practice_lab'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Thực hành</span>
            </button>
            <button
              type="button"
              onClick={() => setLessonType('theory')}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                lessonType === 'theory'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Lý thuyết</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Teaching Evaluation Card (Sổ đầu bài điện tử) */}
      <div className="bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-indigo-50/70 p-4 sm:p-5 rounded-3xl border border-indigo-200/90 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-indigo-200/60 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
              📝
            </span>
            <h3 className="font-extrabold text-sm text-indigo-950">
              Đánh giá Ngày dạy (Sổ đầu bài tiết học)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-indigo-900">Xếp loại tiết:</span>
            <div className="flex items-center gap-1">
              {[
                { key: 'excellent', label: '⭐ Tốt (Xuất sắc)', color: 'bg-emerald-600 text-white' },
                { key: 'good', label: '👍 Khá', color: 'bg-indigo-600 text-white' },
                { key: 'average', label: '👌 Đạt', color: 'bg-amber-600 text-white' },
                { key: 'poor', label: '⚠️ Cần cố gắng', color: 'bg-rose-600 text-white' }
              ].map(r => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setSessionRating(r.key as any)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    sessionRating === r.key
                      ? `${r.color} shadow-xs scale-102`
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-indigo-900 mb-1">
              Tên bài dạy / Nội dung kiến thức:
            </label>
            <input
              type="text"
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              placeholder="Ví dụ: Bài thực hành 3: Tạo bảng tính và công thức"
              className="w-full px-3 py-2 text-xs font-semibold bg-white border border-indigo-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-indigo-900 mb-1">
              Nhận xét tiết dạy &amp; Ý thức học tập:
            </label>
            <input
              type="text"
              value={evaluationNotes}
              onChange={(e) => setEvaluationNotes(e.target.value)}
              placeholder="Nhận xét nề nếp, phát biểu, thực hành..."
              className="w-full px-3 py-2 text-xs font-semibold bg-white border border-indigo-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-indigo-900 mb-1">
              Bài tập về nhà / Dặn dò của giáo viên:
            </label>
            <input
              type="text"
              value={homeworkNotes}
              onChange={(e) => setHomeworkNotes(e.target.value)}
              placeholder="Dặn dò bài tập, tài liệu chuẩn bị..."
              className="w-full px-3 py-2 text-xs font-semibold bg-white border border-indigo-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* 4. Attendance Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sĩ số lớp</span>
          <p className="text-xl font-black text-slate-900 mt-0.5">{totalCount} học sinh</p>
        </div>

        <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">✅ Đi học</span>
          <p className="text-xl font-black text-emerald-800 mt-0.5">
            {presentCount} <span className="text-xs font-normal text-emerald-600">({totalCount > 0 ? Math.round(presentCount/totalCount*100) : 0}%)</span>
          </p>
        </div>

        <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">⏰ Đi muộn</span>
          <p className="text-xl font-black text-amber-800 mt-0.5">{lateCount} học sinh</p>
        </div>

        <div className="p-3.5 bg-orange-50 rounded-2xl border border-orange-200 shadow-2xs">
          <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wider block">📝 Nghỉ có phép</span>
          <p className="text-xl font-black text-orange-800 mt-0.5">{excusedCount} học sinh</p>
        </div>

        <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">❌ Nghỉ không phép</span>
          <p className="text-xl font-black text-rose-800 mt-0.5">{unexcusedCount} học sinh</p>
        </div>
      </div>

      {/* 5. Student Roster with Attendance & Computer Assignment */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Quick actions & Search filter bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleMarkAllPresent}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Đánh dấu tất cả Đi học</span>
            </button>

            {lessonType === 'practice_lab' && (
              <button
                type="button"
                onClick={handleAutoAssignComputers}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Tự động gán số máy theo thứ tự danh sách (Máy 01 -> Máy N)"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Tự động đánh số máy (01 - {totalCount})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                const clsObj = classes.find(c => c.name === selectedClassId || c.id === selectedClassId);
                setStudents(generateDefaultClassRoster(selectedClassId, clsObj?.studentCount || 35));
              }}
              className="px-3 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Đặt lại</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Tìm học sinh hoặc số máy..."
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="present">Đi học</option>
              <option value="late">Đi muộn</option>
              <option value="excused">Nghỉ có phép</option>
              <option value="unexcused">Nghỉ không phép</option>
            </select>
          </div>
        </div>

        {/* Student Table / Cards */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-3.5 w-12 text-center">STT</th>
                <th className="py-3 px-4 min-w-[180px]">Họ và tên học sinh</th>
                <th className="py-3 px-3 min-w-[280px]">Trạng thái Chuyên cần</th>
                {lessonType === 'practice_lab' && (
                  <th className="py-3 px-3 min-w-[150px]">Máy tính thực hành</th>
                )}
                <th className="py-3 px-4 min-w-[200px]">Ghi chú học sinh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredStudents.map((s, idx) => {
                return (
                  <tr 
                    key={s.studentId}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      s.status === 'unexcused' 
                        ? 'bg-rose-50/30' 
                        : s.status === 'late'
                        ? 'bg-amber-50/30'
                        : s.status === 'excused'
                        ? 'bg-orange-50/30'
                        : ''
                    }`}
                  >
                    {/* STT */}
                    <td className="py-2.5 px-3.5 text-center font-bold text-slate-400">
                      {idx + 1}
                    </td>

                    {/* Name */}
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{s.studentName}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {s.studentId}
                      </span>
                    </td>

                    {/* 4 Chuyên cần Options (1 click) */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleSetStudentStatus(s.studentId, 'present')}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            s.status === 'present'
                              ? 'bg-emerald-600 text-white shadow-2xs font-extrabold scale-102'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                          <span>Đi học</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSetStudentStatus(s.studentId, 'late')}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            s.status === 'late'
                              ? 'bg-amber-500 text-white shadow-2xs font-extrabold scale-102'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>Đi muộn</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSetStudentStatus(s.studentId, 'excused')}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            s.status === 'excused'
                              ? 'bg-orange-500 text-white shadow-2xs font-extrabold scale-102'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <span>Nghỉ phép</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSetStudentStatus(s.studentId, 'unexcused')}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            s.status === 'unexcused'
                              ? 'bg-rose-600 text-white shadow-2xs font-extrabold scale-102'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <X className="w-3 h-3" />
                          <span>Không phép</span>
                        </button>
                      </div>
                    </td>

                    {/* Lab Computer Number */}
                    {lessonType === 'practice_lab' && (
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <Monitor className="w-4 h-4 text-indigo-600 shrink-0" />
                          <input
                            type="text"
                            value={s.labComputerNumber || ''}
                            onChange={(e) => handleSetComputerNumber(s.studentId, e.target.value)}
                            placeholder="Máy 01..."
                            className="w-24 px-2 py-1 text-xs font-bold text-indigo-900 bg-indigo-50/60 border border-indigo-200 rounded-lg focus:bg-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </td>
                    )}

                    {/* Notes */}
                    <td className="py-2.5 px-4">
                      <input
                        type="text"
                        value={s.notes || ''}
                        onChange={(e) => handleSetStudentNote(s.studentId, e.target.value)}
                        placeholder="Ghi chú ý thức, bài tập..."
                        className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredStudents.length === 0 && (
          <div className="p-8 text-center text-slate-400 text-xs">
            Không tìm thấy học sinh nào phù hợp.
          </div>
        )}
      </div>

    </div>
  );
};
