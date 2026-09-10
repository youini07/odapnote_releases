// ================================================================
// WorkbookPanel.tsx - 문제집 관리 탭
// PDF 업로드, AI 분석, 문제집 목록, 학생용↔교사용 매칭
// ================================================================

import { useState, useEffect, useCallback } from 'react';
import { Upload, BookOpen, Trash2, Link, Search, FileText, Loader2, AlertCircle, CheckCircle2, Image, ChevronDown, ChevronUp } from 'lucide-react';
import type { Workbook, Question } from './types';

export default function WorkbookPanel() {
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ message: '', percent: 0 });
  const [selectedType, setSelectedType] = useState<'student' | 'teacher'>('student');
  const [expandedWorkbook, setExpandedWorkbook] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionImages, setQuestionImages] = useState<Record<string, string>>({});
  const [pairingMode, setPairingMode] = useState<string | null>(null); // 매칭할 문제집 ID
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 데이터 로딩
  const loadWorkbooks = useCallback(async () => {
    try {
      const data = await window.electronAPI.getWorkbooks();
      setWorkbooks(data);
    } catch (e) {
      console.error('문제집 로딩 실패:', e);
    }
  }, []);

  useEffect(() => {
    loadWorkbooks();
    // 분석 진행 상황 이벤트 구독
    const cleanup = window.electronAPI.onAnalysisProgress((data) => {
      setAnalysisProgress(data);
    });
    return cleanup;
  }, [loadWorkbooks]);

  // PDF 파일 선택 및 분석
  const handleAnalyzePdf = async () => {
    setErrorMsg(null);
    const filePath = await window.electronAPI.selectPdfFile();
    if (!filePath) return;

    setIsAnalyzing(true);
    setAnalysisProgress({ message: '시작 중...', percent: 0 });

    const result = await window.electronAPI.analyzePdf(filePath, selectedType);
    
    setIsAnalyzing(false);
    if (result.success) {
      await loadWorkbooks();
      setAnalysisProgress({ message: `완료! ${result.questionCount}개 문제 인식`, percent: 100 });
    } else {
      setErrorMsg(result.error || '분석에 실패했습니다.');
    }
  };

  // 문제집 확장/축소 (문제 미리보기)
  const toggleExpand = async (workbookId: string) => {
    if (expandedWorkbook === workbookId) {
      setExpandedWorkbook(null);
      return;
    }
    setExpandedWorkbook(workbookId);
    const qs = await window.electronAPI.getQuestions(workbookId);
    setQuestions(qs);

    // 모든 문제 이미지 병렬 로딩 (사용자 요청에 따라 전체 표시)
    const images: Record<string, string> = {};
    await Promise.all(qs.map(async (q) => {
      const base64 = await window.electronAPI.readImageAsBase64(q.imagePath);
      if (base64) images[q.id] = base64;
    }));
    setQuestionImages(images);
  };

  // 문제집 삭제 상태
  const [workbookToDelete, setWorkbookToDelete] = useState<Workbook | null>(null);
  const [deleteInput, setDeleteInput] = useState('');

  // 삭제 확인 모달 열기
  const requestDelete = (workbook: Workbook) => {
    setWorkbookToDelete(workbook);
    setDeleteInput('');
  };

  // 실제 삭제 실행
  const confirmDelete = async () => {
    if (!workbookToDelete || deleteInput !== '삭제') return;

    await window.electronAPI.deleteWorkbook(workbookToDelete.id);
    await loadWorkbooks();
    if (expandedWorkbook === workbookToDelete.id) setExpandedWorkbook(null);
    setWorkbookToDelete(null);
  };

  // 학생용↔교사용 매칭
  const handlePair = async (targetId: string) => {
    if (!pairingMode) return;
    await window.electronAPI.pairWorkbooks(pairingMode, targetId);
    setPairingMode(null);
    await loadWorkbooks();
  };

  const studentWorkbooks = workbooks.filter(w => w.type === 'student');
  const teacherWorkbooks = workbooks.filter(w => w.type === 'teacher');

  return (
    <div className="p-6 space-y-6">
      {/* 상단: PDF 업로드 영역 */}
      <div className="bg-slate-900/80 rounded-xl border border-slate-700/50 p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Upload size={20} className="text-emerald-400" />
          PDF 문제집 분석
        </h2>

        <div className="flex items-end gap-4">
          {/* 문제집 유형 선택 */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">문제집 유형</label>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedType('student')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  selectedType === 'student'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                }`}
              >
                📘 학생용 (문제)
              </button>
              <button
                onClick={() => setSelectedType('teacher')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  selectedType === 'teacher'
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                }`}
              >
                📙 교사용 (답안)
              </button>
            </div>
          </div>

          {/* 분석 시작 버튼 */}
          <button
            onClick={handleAnalyzePdf}
            disabled={isAnalyzing}
            className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-lg shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                분석 중...
              </>
            ) : (
              <>
                <Search size={16} />
                PDF 선택 & 분석 시작
              </>
            )}
          </button>
        </div>

        {/* 분석 진행 바 */}
        {isAnalyzing && (
          <div className="mt-4 bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span className="flex items-center gap-2">
                <Loader2 size={12} className="animate-spin text-emerald-400" />
                {analysisProgress.message}
              </span>
              <span className="text-emerald-400 font-bold">{Math.round(analysisProgress.percent)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all duration-500"
                style={{ width: `${analysisProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {errorMsg && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{errorMsg}</p>
          </div>
        )}
      </div>

      {/* 문제집 목록 */}
      <div className="space-y-4">
        {/* 학생용 문제집 */}
        <div>
          <h3 className="text-sm font-semibold text-slate-400 mb-2 flex items-center gap-2">
            <BookOpen size={14} />
            학생용 문제집 ({studentWorkbooks.length})
          </h3>
          <div className="space-y-2">
            {studentWorkbooks.map(wb => (
              <WorkbookCard
                key={wb.id}
                workbook={wb}
                allWorkbooks={workbooks}
                isExpanded={expandedWorkbook === wb.id}
                questions={expandedWorkbook === wb.id ? questions : []}
                questionImages={questionImages}
                pairingMode={pairingMode}
                onToggleExpand={() => toggleExpand(wb.id)}
                onDelete={() => requestDelete(wb)}
                onStartPairing={() => setPairingMode(wb.id)}
                onCancelPairing={() => setPairingMode(null)}
                onPairWith={handlePair}
              />
            ))}
            {studentWorkbooks.length === 0 && (
              <div className="text-center py-8 text-slate-600 text-sm">
                아직 등록된 학생용 문제집이 없습니다
              </div>
            )}
          </div>
        </div>

        {/* 교사용 문제집 */}
        <div>
          <h3 className="text-sm font-semibold text-slate-400 mb-2 flex items-center gap-2">
            <FileText size={14} />
            교사용 답안지 ({teacherWorkbooks.length})
          </h3>
          <div className="space-y-2">
            {teacherWorkbooks.map(wb => (
              <WorkbookCard
                key={wb.id}
                workbook={wb}
                allWorkbooks={workbooks}
                isExpanded={expandedWorkbook === wb.id}
                questions={expandedWorkbook === wb.id ? questions : []}
                questionImages={questionImages}
                pairingMode={pairingMode}
                onToggleExpand={() => toggleExpand(wb.id)}
                onDelete={() => requestDelete(wb)}
                onStartPairing={() => setPairingMode(wb.id)}
                onCancelPairing={() => setPairingMode(null)}
                onPairWith={handlePair}
              />
            ))}
            {teacherWorkbooks.length === 0 && (
              <div className="text-center py-8 text-slate-600 text-sm">
                아직 등록된 교사용 답안지가 없습니다
              </div>
            )}
          </div>
        </div>
      </div>
      {/* 삭제 확인 모달 */}
      {workbookToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <AlertCircle size={24} />
              <h3 className="text-lg font-bold text-white">문제집 삭제 경고</h3>
            </div>
            
            <p className="text-sm text-slate-300 mb-2">
              <span className="font-bold text-white">{workbookToDelete.name}</span> 문제집을 정말로 삭제하시겠습니까?
            </p>
            <p className="text-xs text-red-400/90 bg-red-500/10 border border-red-500/20 p-3 rounded-lg mb-5 leading-relaxed">
              사전에 추출된 <strong>모든 문제 이미지 파일들이 함께 영구 삭제</strong>되며, 복구할 수 없습니다. 계속 진행하시려면 아래에 <strong>'삭제'</strong>라고 입력해 주세요.
            </p>

            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="삭제"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white mb-5 focus:outline-none focus:border-red-500 transition-colors"
              autoFocus
            />

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setWorkbookToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteInput !== '삭제'}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                영구 삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== 문제집 카드 컴포넌트 =====================

interface WorkbookCardProps {
  workbook: Workbook;
  allWorkbooks: Workbook[];
  isExpanded: boolean;
  questions: Question[];
  questionImages: Record<string, string>;
  pairingMode: string | null;
  onToggleExpand: () => void;
  onDelete: () => void;
  onStartPairing: () => void;
  onCancelPairing: () => void;
  onPairWith: (targetId: string) => void;
}

function WorkbookCard({
  workbook, allWorkbooks, isExpanded, questions, questionImages,
  pairingMode, onToggleExpand, onDelete, onStartPairing, onCancelPairing, onPairWith,
}: WorkbookCardProps) {
  const paired = workbook.pairedWorkbookId
    ? allWorkbooks.find(w => w.id === workbook.pairedWorkbookId)
    : null;
  
  const isPairingTarget = pairingMode && pairingMode !== workbook.id
    && allWorkbooks.find(w => w.id === pairingMode)?.type !== workbook.type;

  const typeColor = workbook.type === 'student' ? 'blue' : 'orange';

  return (
    <div className={`bg-slate-900/60 rounded-lg border transition-all ${
      isPairingTarget 
        ? 'border-yellow-500/50 shadow-lg shadow-yellow-500/10 cursor-pointer' 
        : 'border-slate-700/50'
    }`}>
      {/* 카드 헤더 */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => isPairingTarget ? onPairWith(workbook.id) : onToggleExpand()}
      >
        <div className={`w-2 h-2 rounded-full bg-${typeColor}-400`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-white truncate">{workbook.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded bg-${typeColor}-500/15 text-${typeColor}-400 font-medium`}>
              {workbook.type === 'student' ? '학생용' : '교사용'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
            <span>{workbook.totalQuestions}문제</span>
            <span>·</span>
            <span>{new Date(workbook.analyzedAt).toLocaleDateString()}</span>
            {paired && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 text-emerald-500">
                  <Link size={10} />
                  {paired.name} 매칭됨
                </span>
              </>
            )}
          </div>
        </div>

        {/* 버튼들 */}
        <div className="flex items-center gap-1">
          {!paired && !pairingMode && (
            <button
              onClick={(e) => { e.stopPropagation(); onStartPairing(); }}
              className="p-1.5 text-slate-500 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-md transition-colors"
              title="답안지 매칭"
            >
              <Link size={14} />
            </button>
          )}
          {pairingMode === workbook.id && (
            <button
              onClick={(e) => { e.stopPropagation(); onCancelPairing(); }}
              className="px-2 py-1 text-[11px] text-yellow-400 bg-yellow-500/10 rounded border border-yellow-500/30"
            >
              매칭 취소
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
            title="삭제"
          >
            <Trash2 size={14} />
          </button>
          {isExpanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
        </div>
      </div>

      {/* 매칭 안내 */}
      {isPairingTarget && (
        <div className="px-4 pb-2">
          <div className="text-xs text-yellow-400 bg-yellow-500/10 px-3 py-1.5 rounded border border-yellow-500/20">
            클릭하여 이 문제집과 매칭
          </div>
        </div>
      )}

      {/* 확장 영역: 문제 미리보기 */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-800/50">
          <p className="text-xs text-slate-500 my-3 flex justify-between items-center">
            <span>문제 미리보기 (전체 {questions.length}개)</span>
            <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">
              이미지를 클릭하면 그림판에서 수정할 수 있습니다
            </span>
          </p>
          <div className="grid grid-cols-4 gap-2">
            {questions.map(q => (
              <div 
                key={q.id} 
                onClick={() => window.electronAPI.openInPaint(q.imagePath)}
                className="bg-slate-800/80 rounded-md p-2 border border-slate-700/30 cursor-pointer hover:border-emerald-400 hover:ring-2 hover:ring-emerald-400/20 transition-all group"
                title="클릭하여 그림판으로 열기"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-red-400">#{q.number}</span>
                    <span className="text-[9px] text-slate-500">p.{q.page}</span>
                  </div>
                </div>
                {questionImages[q.id] ? (
                  <img
                    src={questionImages[q.id]}
                    alt={`문제 ${q.number}`}
                    className="w-full h-20 object-contain bg-white/90 rounded group-hover:brightness-95 transition-all"
                  />
                ) : (
                  <div className="w-full h-20 bg-slate-700/50 rounded flex items-center justify-center">
                    <Image size={16} className="text-slate-600" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
