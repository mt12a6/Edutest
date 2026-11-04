import React, { useState } from 'react';
import { Printer, X, Download, HelpCircle, Users, CheckSquare, Sparkles } from 'lucide-react';
import { SchoolClass, UserProfile } from '../../types';

interface QRCardPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes?: SchoolClass[];
  students?: UserProfile[];
}

export const QRCardPrintModal: React.FC<QRCardPrintModalProps> = ({
  isOpen,
  onClose,
  classes = [],
  students = []
}) => {
  const [cardCount, setCardCount] = useState<number>(40);
  const [cardsPerPage, setCardsPerPage] = useState<2 | 4>(2);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [showInstructions, setShowInstructions] = useState<boolean>(true);

  if (!isOpen) return null;

  // Generate card list: if class selected with students, map students; otherwise generate 1 to cardCount
  const filteredStudents = selectedClassId === 'all' 
    ? students 
    : students.filter(s => s.classIds?.includes(selectedClassId));

  const totalCards = filteredStudents.length > 0 ? filteredStudents.length : cardCount;

  const cardItems = Array.from({ length: totalCards }, (_, i) => {
    const student = filteredStudents[i];
    return {
      cardId: i + 1,
      studentName: student?.displayName || `Học sinh số ${i + 1}`,
      studentCode: student?.email?.split('@')[0] || `HS${String(i + 1).padStart(2, '0')}`
    };
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      
      {/* Print Stylesheet injected into DOM */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #plickers-print-container, #plickers-print-container * {
            visibility: visible;
          }
          #plickers-print-container {
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
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                In Phiếu Trả Lời Trắc Nghiệm QR (Mô hình Plickers)
                <span className="text-[10px] bg-teal-500 text-slate-900 px-2 py-0.5 rounded-full font-black">
                  A4 CHUẨN
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Mỗi học sinh 1 phiếu tương tác 4 chiều (A, B, C, D) - Quét camera điện thoại nhận diện tức thì
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
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 no-print shrink-0 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            {classes.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-600">Lớp:</span>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-medium"
                >
                  <option value="all">Tất cả (In số lượng tự do)</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedClassId === 'all' && (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-600">Số lượng thẻ:</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={cardCount}
                  onChange={(e) => setCardCount(parseInt(e.target.value, 10) || 1)}
                  className="w-20 px-2 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-center"
                />
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600">Bố cục:</span>
              <button
                type="button"
                onClick={() => setCardsPerPage(2)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  cardsPerPage === 2 ? 'bg-teal-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
                }`}
              >
                2 thẻ / trang A4 (Khuyên dùng)
              </button>
              <button
                type="button"
                onClick={() => setCardsPerPage(4)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  cardsPerPage === 4 ? 'bg-teal-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
                }`}
              >
                4 thẻ / trang A4 (Tiết kiệm)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>In ngay ({cardItems.length} thẻ)</span>
            </button>
          </div>
        </div>

        {/* Instructions banner */}
        {showInstructions && (
          <div className="mx-4 mt-3 p-3 bg-teal-50 border border-teal-200 rounded-2xl flex items-start justify-between gap-3 text-xs text-teal-900 no-print shrink-0">
            <div className="flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">Hướng dẫn học sinh sử dụng:</p>
                <p className="text-[11px] text-teal-800 mt-0.5">
                  Mỗi mép thẻ tương ứng 1 đáp án A, B, C, D. Học sinh muốn chọn đáp án nào thì <strong>xoay chữ cái đó lên phía trên cùng</strong> khi giơ thẻ về phía giáo viên.
                </p>
              </div>
            </div>
            <button 
              type="button" 
              onClick={() => setShowInstructions(false)}
              className="text-teal-600 hover:text-teal-900 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Printable Cards Content Area */}
        <div id="plickers-print-container" className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 space-y-6">
          {cardItems.map((card, idx) => {
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
                        {card.studentCode}
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

                    {/* Center Geometric High-Contrast Marker */}
                    <div className="w-36 h-36 sm:w-44 sm:h-44 bg-slate-950 p-3 rounded-xl flex flex-col items-center justify-center text-white relative">
                      {/* ArUco / Geometric Corner Markers */}
                      <div className="absolute top-2 left-2 w-4 h-4 bg-white rounded-xs" />
                      <div className="absolute top-2 right-2 w-3 h-3 bg-white/40" />
                      <div className="absolute bottom-2 left-2 w-3 h-3 bg-white/40" />
                      <div className="absolute bottom-2 right-2 w-4 h-4 bg-white rounded-xs" />

                      {/* Center ID Display */}
                      <div className="w-16 h-16 rounded-full bg-white text-slate-950 flex flex-col items-center justify-center shadow-md">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">ID</span>
                        <span className="text-2xl font-black leading-none">{card.cardId}</span>
                      </div>

                      <span className="text-[9px] font-mono text-slate-300 mt-2 tracking-widest">
                        EDUTEST-{String(card.cardId).padStart(3, '0')}
                      </span>
                    </div>
                  </div>

                  {/* Bottom instruction footnote */}
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
