import React, { useState, useEffect } from 'react';
import { Printer, X, Download, HelpCircle, Users, CheckSquare, Sparkles, QrCode, FileText, UserPlus, AlertTriangle } from 'lucide-react';
import QRCode from 'qrcode';
import { SchoolClass, UserProfile, Exam, PlickersStudent } from '../../types';
import { getPlickersStudents } from '../../services/db';

interface QRCardPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam?: Exam | null;
  classes?: SchoolClass[];
  students?: UserProfile[];
}

export const QRCardPrintModal: React.FC<QRCardPrintModalProps> = ({
  isOpen,
  onClose,
  exam,
  classes = [],
  students = []
}) => {
  // Mode: 'class' (Thi theo lớp) | 'free' (Thi tự do)
  const [organizationMode, setOrganizationMode] = useState<'class' | 'free'>('class');
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '10A1');
  const [classStudents, setClassStudents] = useState<PlickersStudent[]>([]);
  const [freeStudentText, setFreeStudentText] = useState<string>(
    'Nguyễn Văn An\nTrần Thị Bình\nLê Hoàng Cường\nPhạm Thị Dung\nVũ Minh Đức\nĐặng Thúy Hằng\nBùi Quốc Huy\nHoàng Mai Linh'
  );
  const [cardCount, setCardCount] = useState<number>(35);
  const [cardsPerPage, setCardsPerPage] = useState<2 | 4>(2);
  const [templateType, setTemplateType] = useState<'plickers' | 'answer_sheet'>('plickers');
  const [showInstructions, setShowInstructions] = useState<boolean>(true);
  const [qrCodeDataUrls, setQrCodeDataUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (selectedClassId && selectedClassId !== 'all') {
      getPlickersStudents(selectedClassId).then(list => {
        setClassStudents(list);
      }).catch(e => console.warn('Lỗi tải học sinh lớp:', e));
    }
  }, [selectedClassId]);

  if (!isOpen) return null;

  // Build student list according to selected mode
  let cardItems: { cardId: number; studentName: string; studentCode: string; className: string }[] = [];

  if (organizationMode === 'class') {
    const currentClass = classes.find(c => c.id === selectedClassId);
    const className = currentClass?.name || selectedClassId;

    if (classStudents.length > 0) {
      cardItems = classStudents.map(s => ({
        cardId: s.cardId,
        studentName: s.displayName,
        studentCode: s.studentCode,
        className
      }));
    } else {
      // Fallback
      cardItems = Array.from({ length: cardCount }, (_, i) => ({
        cardId: i + 1,
        studentName: `Học sinh số ${i + 1}`,
        studentCode: `HS${String(i + 1).padStart(2, '0')}`,
        className
      }));
    }
  } else {
    // Free mode
    const lines = freeStudentText
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    if (lines.length > 0) {
      cardItems = lines.map((name, idx) => {
        const parts = name.split(',').map(p => p.trim());
        const studentName = parts[0] || `Học sinh ${idx + 1}`;
        const studentCode = parts[1] || `TD${String(idx + 1).padStart(2, '0')}`;
        return {
          cardId: idx + 1,
          studentName,
          studentCode,
          className: 'Thí sinh tự do'
        };
      });
    } else {
      cardItems = Array.from({ length: cardCount }, (_, i) => ({
        cardId: i + 1,
        studentName: `Thí sinh tự do số ${i + 1}`,
        studentCode: `TD${String(i + 1).padStart(2, '0')}`,
        className: 'Thí sinh tự do'
      }));
    }
  }

  // Generate QR codes for all students
  useEffect(() => {
    let isMounted = true;
    const generateAllQrs = async () => {
      const urls: Record<string, string> = {};
      for (const item of cardItems) {
        // Safe identifier payload: Exam ID + Student Code + Card ID
        const payload = `EDUTEST-QR:EXAM=${exam?.id || 'exam'}:STUDENT=${item.studentCode}:CARD=${item.cardId}`;
        try {
          const url = await QRCode.toDataURL(payload, {
            margin: 1,
            width: 256,
            color: { dark: '#090D16', light: '#FFFFFF' }
          });
          urls[item.cardId] = url;
        } catch (e) {
          console.warn('QR gen note:', e);
        }
      }
      if (isMounted) {
        setQrCodeDataUrls(urls);
      }
    };

    generateAllQrs();
    return () => {
      isMounted = false;
    };
  }, [organizationMode, selectedClassId, freeStudentText, cardCount, exam?.id]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      
      {/* Print Stylesheet */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #edutest-qr-print-container, #edutest-qr-print-container * {
            visibility: visible;
          }
          #edutest-qr-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-after: always;
            break-after: page;
          }
        }
      `}</style>

      {/* Main Modal Dialog */}
      <div className="w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Header (No print) */}
        <div className="p-4 sm:px-6 sm:py-4 bg-slate-900 text-white flex items-center justify-between no-print shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                In Phiếu Trả Lời & Thẻ Khảo Thí QR
                <span className="text-[10px] bg-teal-500 text-slate-900 px-2 py-0.5 rounded-full font-black">
                  A4 CHUẨN
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Hỗ trợ cả 2 hình thức: Thi theo lớp hoặc Thi tự do • Quét tức thì bằng camera điện thoại
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Config (No print) */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-3 no-print shrink-0 text-xs">
          
          {/* Organization Mode Selector Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="inline-flex p-1 bg-slate-200/80 rounded-xl font-bold text-xs">
              <button
                type="button"
                onClick={() => setOrganizationMode('class')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  organizationMode === 'class' ? 'bg-white text-teal-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Hình thức A: Thi theo lớp</span>
              </button>
              <button
                type="button"
                onClick={() => setOrganizationMode('free')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  organizationMode === 'free' ? 'bg-white text-teal-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Hình thức B: Thi tự do</span>
              </button>
            </div>

            {/* Template Type */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">Mẫu in:</span>
              <button
                type="button"
                onClick={() => setTemplateType('plickers')}
                className={`px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  templateType === 'plickers' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-700'
                }`}
              >
                Thẻ 4 chiều Plickers
              </button>
              <button
                type="button"
                onClick={() => setTemplateType('answer_sheet')}
                className={`px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  templateType === 'answer_sheet' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-700'
                }`}
              >
                Phiếu làm bài thi A4
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95 ml-auto"
            >
              <Printer className="w-4 h-4" />
              <span>In ngay ({cardItems.length} phiếu)</span>
            </button>
          </div>

          {/* Mode-specific settings */}
          {organizationMode === 'class' ? (
            <div className="flex items-center gap-3 flex-wrap">
              {classes.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-600">Chọn lớp:</span>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-medium"
                  >
                    <option value="all">Tất cả lớp</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {templateType === 'plickers' && (
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-600">Bố cục:</span>
                  <button
                    type="button"
                    onClick={() => setCardsPerPage(2)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      cardsPerPage === 2 ? 'bg-teal-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    2 thẻ / trang A4
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardsPerPage(4)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      cardsPerPage === 4 ? 'bg-teal-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    4 thẻ / trang A4
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5 bg-white p-2.5 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-semibold">Nhập danh sách thí sinh tự do (Mỗi dòng một tên):</span>
                <span className="text-[11px] text-teal-700 font-bold">{cardItems.length} thí sinh</span>
              </div>
              <textarea
                rows={3}
                value={freeStudentText}
                onChange={(e) => setFreeStudentText(e.target.value)}
                placeholder="Nguyễn Văn A&#10;Trần Thị B&#10;Lê Hoàng C, TD03..."
                className="w-full p-2 border border-slate-300 rounded-xl font-sans text-xs focus:ring-2 focus:ring-teal-500 bg-slate-50"
              />
            </div>
          )}
        </div>

        {/* Instructions banner */}
        {showInstructions && (
          <div className="mx-4 mt-3 p-3 bg-teal-50 border border-teal-200 rounded-2xl flex items-start justify-between gap-3 text-xs text-teal-900 no-print shrink-0">
            <div className="flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">Hướng dẫn sử dụng phiếu & mã QR:</p>
                <p className="text-[11px] text-teal-800 mt-0.5">
                  Mỗi học sinh được in 1 phiếu có mã định danh QR duy nhất. Giáo viên mở ứng dụng EduTest trên điện thoại, bật camera quét mã QR trên phiếu để xem và chấm bài tức thì.
                </p>
              </div>
            </div>
            <button 
              type="button" 
              onClick={() => setShowInstructions(false)}
              className="text-teal-600 hover:text-teal-900 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Printable Content Area */}
        <div id="edutest-qr-print-container" className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 space-y-6">
          {cardItems.map((card, idx) => {
            const qrUrl = qrCodeDataUrls[card.cardId];

            if (templateType === 'answer_sheet') {
              // TEMPLATE 2: A4 OFFICIAL EXAM ANSWER SHEET WITH QR CODE
              return (
                <React.Fragment key={card.cardId}>
                  <div className="bg-white rounded-2xl border-2 border-slate-400 p-6 sm:p-8 shadow-sm mx-auto max-w-2xl text-slate-900 font-sans space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                          TRƯỜNG THCS & THPT EDUTEST
                        </span>
                        <h2 className="text-lg font-black uppercase text-slate-950">
                          PHIẾU TRẢ LỜI BÀI THI KHẢO THÍ
                        </h2>
                        <p className="text-xs text-slate-700 mt-0.5 font-medium">
                          Môn: {exam?.subjectName || 'Toán học'} • Đề thi: {exam?.title || 'Bài kiểm tra định kỳ'}
                        </p>
                      </div>

                      {/* Header QR Code Box */}
                      <div className="text-center shrink-0 border-2 border-slate-900 p-1.5 rounded-xl bg-white shadow-xs">
                        {qrUrl ? (
                          <img src={qrUrl} alt="Mã QR" className="w-20 h-20 object-contain mx-auto" />
                        ) : (
                          <div className="w-20 h-20 bg-slate-100 flex items-center justify-center font-mono text-[9px]">QR Code</div>
                        )}
                        <span className="text-[9px] font-mono font-bold block text-slate-600 mt-0.5">
                          {card.studentCode}
                        </span>
                      </div>
                    </div>

                    {/* Student Metadata Box */}
                    <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs">
                      <div>
                        <span className="text-slate-500 font-medium block">Họ và tên thí sinh:</span>
                        <strong className="text-slate-950 text-sm">{card.studentName}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium block">Số báo danh / Mã:</span>
                        <strong className="font-mono text-slate-950 text-sm">{card.studentCode}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium block">Lớp / Phòng thi:</span>
                        <strong className="text-slate-950 text-sm">{card.className}</strong>
                      </div>
                    </div>

                    {/* Multiple Choice Bubbles Section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-200 pb-1">
                        <span>PHẦN I: TRẮC NGHIỆM KHÁCH QUAN (Tô kín một ô tròn lựa chọn)</span>
                        <span className="text-[11px] text-slate-500 font-normal">Mỗi câu 1 đáp án đúng</span>
                      </div>

                      <div className="grid grid-cols-4 gap-2 pt-1 text-xs">
                        {Array.from({ length: 20 }, (_, qI) => (
                          <div key={qI} className="flex items-center justify-between p-1.5 border border-slate-200 rounded-lg bg-slate-50/50">
                            <span className="font-bold text-[11px] w-6">{qI + 1}.</span>
                            <div className="flex items-center gap-1.5 font-bold text-[10px]">
                              {(['A', 'B', 'C', 'D'] as const).map(opt => (
                                <span key={opt} className="w-5 h-5 rounded-full border border-slate-400 flex items-center justify-center bg-white">
                                  {opt}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Essay Writing Space */}
                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-200 pb-1">
                        <span>PHẦN II: TỰ LUẬN & TRẢ LỜI NGẮN</span>
                        <span className="text-[11px] text-slate-500 font-normal">Trình bày lời giải chi tiết bên dưới</span>
                      </div>

                      <div className="h-44 border-2 border-dashed border-slate-300 rounded-xl p-3 bg-slate-50/30">
                        <span className="text-[10px] text-slate-400 block italic">
                          (Thí sinh trình bày bài làm tự luận vào khoảng trống này...)
                        </span>
                      </div>
                    </div>

                    {/* Footer Score & Sign Box */}
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t-2 border-slate-900 text-xs text-center">
                      <div className="p-2 border border-slate-300 rounded-xl">
                        <span className="font-bold block text-slate-700">Điểm số (Giáo viên chấm qua QR / Barem):</span>
                        <div className="h-10 mt-1 flex items-center justify-center text-lg font-black text-teal-800">
                          ....... / {exam?.maxScore || 10} điểm
                        </div>
                      </div>
                      <div className="p-2 border border-slate-300 rounded-xl">
                        <span className="font-bold block text-slate-700">Chữ ký cán bộ chấm thi:</span>
                        <div className="h-10 mt-1 flex items-center justify-center text-xs text-slate-400 italic">
                          (Ký và ghi rõ họ tên)
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="page-break" />
                </React.Fragment>
              );
            }

            // TEMPLATE 1: 4-WAY PLICKERS INTERACTIVE GEOMETRIC CARDS
            const isPageBreak = cardsPerPage === 2 ? idx % 2 === 1 : idx % 4 === 3;

            return (
              <React.Fragment key={card.cardId}>
                <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-4 sm:p-6 shadow-sm mx-auto max-w-xl">
                  {/* Card Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
                        Hệ thống thi trắc nghiệm EduTest
                      </span>
                      <h3 className="text-base font-black text-slate-900">
                        THẺ TRẢ LỜI SỐ {String(card.cardId).padStart(2, '0')}
                      </h3>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-800 block">
                        {card.studentName}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {card.studentCode} • {card.className}
                      </span>
                    </div>
                  </div>

                  {/* 4-Oriented Geometric Card Container */}
                  <div className="relative w-64 h-64 sm:w-72 sm:h-72 mx-auto border-4 border-slate-900 rounded-2xl p-4 flex items-center justify-center bg-white shadow-xs">
                    
                    {/* Top: A */}
                    <div className="absolute top-1 inset-x-0 flex flex-col items-center">
                      <span className="text-2xl font-black text-slate-900 tracking-wider">A</span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase">Lên trên = A</span>
                    </div>

                    {/* Right: B */}
                    <div className="absolute right-1 inset-y-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-slate-900 tracking-wider rotate-90">B</span>
                    </div>

                    {/* Bottom: C */}
                    <div className="absolute bottom-1 inset-x-0 flex flex-col items-center">
                      <span className="text-[8px] font-bold text-slate-400 uppercase">Lên trên = C</span>
                      <span className="text-2xl font-black text-slate-900 tracking-wider rotate-180">C</span>
                    </div>

                    {/* Left: D */}
                    <div className="absolute left-1 inset-y-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-slate-900 tracking-wider -rotate-90">D</span>
                    </div>

                    {/* Center QR Code Container */}
                    <div className="w-40 h-40 bg-white p-2 border-2 border-slate-900 rounded-2xl flex flex-col items-center justify-center shadow-md">
                      {qrUrl ? (
                        <img src={qrUrl} alt={`QR Card ${card.cardId}`} className="w-32 h-32 object-contain" />
                      ) : (
                        <div className="w-32 h-32 bg-slate-900 rounded-xl" />
                      )}
                      <span className="text-[9px] font-mono font-bold text-slate-800 mt-1">
                        #{card.cardId} • {card.studentCode}
                      </span>
                    </div>
                  </div>

                  {/* Bottom footnote */}
                  <div className="mt-3 pt-2 text-center text-[10px] text-slate-400 border-t border-slate-100 flex items-center justify-between">
                    <span>* Cắt theo viền đứt nét để sử dụng</span>
                    <span>Xoay chữ cái lựa chọn lên đỉnh trên</span>
                  </div>
                </div>

                {isPageBreak && <div className="page-break" />}
              </React.Fragment>
            );
          })}
        </div>

      </div>
    </div>
  );
};
