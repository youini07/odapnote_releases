// ================================================================
// WorkbookPanel.tsx - 문제집 관리 탭
// PDF 업로드, AI 분석, 문제집 목록, 학생용↔교사용 매칭
// ================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, BookOpen, Trash2, Link, Search, FileText, Loader2, AlertCircle, CheckCircle2, Image, ChevronDown, ChevronUp, RefreshCw, FolderOpen, Edit2, Save, X } from 'lucide-react';
import type { Workbook, Question } from './types';

// ===================== 독립된 페이지 검색 컴포넌트 =====================
function PageSearchInput({ onSearch }: { onSearch: (page: number) => void }) {
  const [val, setVal] = useState('');
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const page = parseInt(val, 10);
      if (!isNaN(page)) onSearch(page);
    }
  };

  const handleSearch = () => {
    const page = parseInt(val, 10);
    if (!isNaN(page)) onSearch(page);
  };

  return (
    <div className="flex items-center gap-2 mb-3 bg-slate-50 p-2 rounded-lg border border-slate-200 w-fit">
      <Search size={14} className="text-slate-500" />
      <input
        type="text"
        inputMode="numeric"
        value={val}
        onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, ''))}
        onKeyDown={handleKeyDown}
        placeholder="페이지 이동 (예: 46)"
        className="bg-transparent border-none text-sm text-slate-800 focus:outline-none w-32 placeholder-slate-500"
      />
      <button
        onClick={handleSearch}
        className="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded text-xs text-slate-700 font-medium transition-colors"
      >
        이동
      </button>
    </div>
  );
}

export default function WorkbookPanel() {
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [analyzingJobs, setAnalyzingJobs] = useState<Record<string, { message: string, percent: number }>>({});
  const [selectedType, setSelectedType] = useState<'student' | 'teacher' | 'teacher_quick'>('student');
  const [showTeacherDropdown, setShowTeacherDropdown] = useState(false);
  const [analyzeStartPage, setAnalyzeStartPage] = useState('');
  const [analyzeEndPage, setAnalyzeEndPage] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [expandedWorkbook, setExpandedWorkbook] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionImages, setQuestionImages] = useState<Record<string, string>>({});
  const [pairingMode, setPairingMode] = useState<string | null>(null); // 매칭할 문제집 ID
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadFolderName, setUploadFolderName] = useState<string>(''); // 업로드 시 폴더명 지정

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
    // 분석 진행 상황 이벤트 구독 (개별 작업 처리)
    const cleanup = window.electronAPI.onAnalysisProgress((data) => {
      if (data.workbookId) {
        setAnalyzingJobs(prev => ({
          ...prev,
          [data.workbookId!]: { message: data.message, percent: data.percent }
        }));
        
        // 새로 추가된 문제집이 아직 목록에 없으면 로드
        setWorkbooks(prev => {
          if (!prev.find(w => w.id === data.workbookId)) {
            loadWorkbooks();
          }
          return prev;
        });
      }
    });
    return cleanup;
  }, [loadWorkbooks]);

  // PDF 파일 첨부
  const handleSelectFile = async () => {
    setErrorMsg(null);
    const filePath = await window.electronAPI.selectPdfFile();
    if (filePath) {
      setSelectedFile(filePath);
    }
  };

  // 분석 시작 (백그라운드 실행)
  const handleAnalyzePdf = async () => {
    if (!selectedFile) return;
    setErrorMsg(null);
    const fileToAnalyze = selectedFile;
    // 다음 파일을 바로 추가할 수 있도록 즉시 비움
    setSelectedFile(null);

    try {
      const startP = analyzeStartPage.trim() ? parseInt(analyzeStartPage.trim(), 10) : undefined;
      const endP = analyzeEndPage.trim() ? parseInt(analyzeEndPage.trim(), 10) : undefined;

      const result = await window.electronAPI.analyzePdf(fileToAnalyze, selectedType, undefined, startP, endP);
      
      if (result.success && result.workbook) {
        // 방금 생성된 문제집의 폴더명 업데이트 (DB 저장을 위해)
        if (uploadFolderName.trim()) {
           const updatedWb = { ...result.workbook, folderName: uploadFolderName.trim() };
           // We need a way to save updated workbook. We don't have a direct saveWorkbook API exposed to renderer.
           // However, analyzePdf might save it. Wait, if we can't update it directly, we might need to add it to API.
           // Actually, since we don't have `updateWorkbook` API, we should expose it or pass folderName to analyzePdf.
           // Let's pass folderName to analyzePdf if possible, or add updateWorkbook API. 
           // BUT changing analyzePdf signature is hard because it's used in main process.
           // Let's add `updateWorkbook` API to preload/main later, or just use a new API endpoint.
           // WAIT! The user didn't ask to set folder DURING upload specifically, they just said "분류완료된 문제집을 폴더를 만들어서 문제집을 분류 보관할수 있게해줘."
           // I'll add `updateWorkbook` to window.electronAPI in a moment. For now, let's call `window.electronAPI.updateWorkbook(workbookId, {folderName})`.
           if ((window.electronAPI as any).updateWorkbook) {
               await (window.electronAPI as any).updateWorkbook(result.workbook.id, { folderName: uploadFolderName.trim() });
           }
        }
        await loadWorkbooks();
        setAnalyzingJobs(prev => {
          const next = { ...prev };
          if (result.workbook?.id) delete next[result.workbook.id];
          return next;
        });
      } else {
        setErrorMsg(result.error || '분석에 실패했습니다.');
        // 에러 발생 시, 만약 임시로 생성된 카드가 있다면 제거를 위해 로드
        await loadWorkbooks();
      }
    } catch (err: any) {
      console.error('Unhandled error during analyzePdf:', err);
      setErrorMsg(`분석 중 시스템 오류가 발생했습니다: ${err.message}`);
      await loadWorkbooks();
    }
  };

  // 분석 중지 (개별 작업)
  const handleCancelAnalysis = async (workbookId: string) => {
    await window.electronAPI.cancelAnalyzePdf(workbookId);
    setAnalyzingJobs(prev => ({
      ...prev,
      [workbookId]: { ...prev[workbookId], message: '중지 요청 중...' }
    }));
  };

  // 이어서 분석 (재개)
  const handleResumeAnalysis = async (workbookId: string, filePath: string, type: 'student' | 'teacher' | 'teacher_quick') => {
    setErrorMsg(null);
    
    // UI 즉각 반영을 위해 빈 상태 생성
    setAnalyzingJobs(prev => ({
      ...prev,
      [workbookId]: { message: '준비 중...', percent: 0 }
    }));

    const result = await window.electronAPI.analyzePdf(filePath, type, undefined, undefined, undefined, workbookId);
    
    if (result.success) {
      await loadWorkbooks();
      setAnalyzingJobs(prev => {
        const next = { ...prev };
        delete next[workbookId];
        return next;
      });
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
    if (!workbookToDelete || deleteInput.trim() !== '삭제') return;

    try {
      await window.electronAPI.deleteWorkbook(workbookToDelete.id);
      await loadWorkbooks();
      if (expandedWorkbook === workbookToDelete.id) setExpandedWorkbook(null);
      setWorkbookToDelete(null);
    } catch (err: any) {
      alert(`삭제 중 오류가 발생했습니다: ${err.message}`);
    }
  };

  // 학생용↔교사용 매칭
  const handlePair = async (targetId: string) => {
    if (!pairingMode) return;
    await window.electronAPI.pairWorkbooks(pairingMode, targetId);
    setPairingMode(null);
    await loadWorkbooks();
  };

  // 데이터 리로드 (스캔 알림 없이 갱신만)
  const handleReloadData = async (workbookId: string) => {
    const qs = await window.electronAPI.getQuestions(workbookId);
    setQuestions(qs);
    const images: Record<string, string> = {};
    await Promise.all(qs.map(async (q) => {
      const base64 = await window.electronAPI.readImageAsBase64(q.imagePath);
      if (base64) images[q.id] = base64;
    }));
    setQuestionImages(images);
    loadWorkbooks();
  };

  // 수동 이미지 스캔
  const handleRescan = async (workbookId: string) => {
    const res = await window.electronAPI.rescanWorkbookImages(workbookId);
    if (res.success) {
      if (res.addedCount > 0) {
        alert(`스캔 완료: ${res.addedCount}개의 새 이미지가 데이터베이스에 추가되었습니다.`);
        await handleReloadData(workbookId);
      } else {
        alert('추가된 새 이미지가 없습니다. 파일명이 올바른지 확인해주세요 (예: 15.png, 0015.png)');
      }
    } else {
      alert(`스캔 실패: ${res.error}`);
    }
  };

  const handleUpdateFolder = async (workbookId: string, folderName: string) => {
    if ((window.electronAPI as any).updateWorkbook) {
       await (window.electronAPI as any).updateWorkbook(workbookId, { folderName: folderName.trim() || undefined });
       await loadWorkbooks();
    } else {
       alert("해당 기능을 지원하려면 앱 업데이트(백엔드 변경)가 필요합니다.");
    }
  };

  const studentWorkbooks = workbooks.filter(w => w.type === 'student');
  const teacherWorkbooks = workbooks.filter(w => w.type === 'teacher' || w.type === 'teacher_quick');

  const renderWorkbooksByFolder = (workbooksToRender: Workbook[], title: string, icon: React.ReactNode) => {
    const groups: Record<string, Workbook[]> = {};
    workbooksToRender.forEach(wb => {
      const folder = wb.folderName || '미분류';
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(wb);
    });

    const folders = Object.keys(groups).sort((a, b) => {
      if (a === '미분류') return 1;
      if (b === '미분류') return -1;
      return a.localeCompare(b);
    });

    return (
      <div>
        <h3 className="text-sm font-semibold text-slate-500 mb-2 flex items-center gap-2">
          {icon}
          {title} ({workbooksToRender.length})
        </h3>
        <div className="space-y-4">
          {folders.map(folder => (
            <div key={folder} className="bg-white/40 rounded-lg p-3 border border-slate-200/30">
              <div className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5 px-1">
                <FolderOpen size={14} className={folder === '미분류' ? 'text-slate-500' : 'text-indigo-500'} />
                {folder}
                <span className="text-slate-500 font-normal ml-1">({groups[folder].length})</span>
              </div>
              <div className="space-y-2 pl-2">
                {groups[folder].map(wb => (
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
                    onResumeAnalysis={() => handleResumeAnalysis(wb.id, wb.filePath, wb.type)}
                    onCancelAnalysis={() => handleCancelAnalysis(wb.id)}
                    onRescan={() => handleRescan(wb.id)}
                    onReloadData={() => handleReloadData(wb.id)}
                    onUpdateFolder={(folder) => handleUpdateFolder(wb.id, folder)}
                    jobProgress={analyzingJobs[wb.id]}
                  />
                ))}
              </div>
            </div>
          ))}
          {workbooksToRender.length === 0 && (
            <div className="text-center py-8 text-slate-600 text-sm">
              아직 등록된 {title}이(가) 없습니다
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* 상단: PDF 업로드 영역 */}
      <div className="bg-white shadow-sm border border-slate-100 rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Upload size={20} className="text-indigo-600" />
          PDF 문제집 분석
        </h2>

        <div className="flex flex-wrap items-end gap-4">
          {/* 문제집 유형 선택 */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 font-medium">문제집 유형</label>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedType('student')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                  selectedType === 'student'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-slate-50 text-slate-500 border border-slate-200 hover:text-slate-800'
                }`}
              >
                📘 학생용 (문제)
              </button>
              <div className="relative">
                <button
                  onClick={() => {
                    if (selectedType !== 'teacher' && selectedType !== 'teacher_quick') {
                      setSelectedType('teacher'); // 기본값으로 먼저 선택
                      setShowTeacherDropdown(true);
                    } else {
                      setShowTeacherDropdown(!showTeacherDropdown);
                    }
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap flex items-center gap-1 ${
                    selectedType === 'teacher' || selectedType === 'teacher_quick'
                      ? 'bg-orange-500/20 text-orange-500 border border-orange-500/30'
                      : 'bg-slate-50 text-slate-500 border border-slate-200 hover:text-slate-800'
                  }`}
                >
                  {selectedType === 'teacher_quick' ? '⚡ 교사용 (빠른정답)' : '📝 교사용 (풀이형)'}
                  <ChevronDown size={14} className={`transition-transform ${showTeacherDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showTeacherDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-20 py-1 overflow-hidden">
                    <button 
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedType === 'teacher' ? 'bg-orange-50/50 text-orange-600 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                      onClick={() => { 
                        setSelectedType('teacher'); 
                        setShowTeacherDropdown(false); 
                      }}
                    >
                      📝 교사용 (풀이형)
                    </button>
                    <button 
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedType === 'teacher_quick' ? 'bg-orange-50/50 text-orange-600 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                      onClick={() => { 
                        setSelectedType('teacher_quick'); 
                        setShowTeacherDropdown(false); 
                      }}
                    >
                      ⚡ 교사용 (빠른정답)
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* 드롭다운 바깥 영역 클릭 시 닫히도록 하는 투명 오버레이 */}
            {showTeacherDropdown && (
              <div 
                className="fixed inset-0 z-10"
                onClick={() => setShowTeacherDropdown(false)}
              />
            )}
          </div>



          {/* 분석 페이지 범위 (선택) */}
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5 font-medium">분석 범위 (페이지)</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  value={analyzeStartPage}
                  onChange={(e) => setAnalyzeStartPage(e.target.value)}
                  placeholder="시작"
                  className="px-3 py-2 text-sm bg-slate-50 text-slate-700 border border-slate-200 rounded-lg placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 w-20 text-center"
                />
                <span className="text-slate-500">~</span>
                <input
                  type="number"
                  min="1"
                  value={analyzeEndPage}
                  onChange={(e) => setAnalyzeEndPage(e.target.value)}
                  placeholder="끝"
                  className="px-3 py-2 text-sm bg-slate-50 text-slate-700 border border-slate-200 rounded-lg placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 w-20 text-center"
                />
              </div>
            </div>
          </div>
          {/* 폴더명 (선택) */}
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5 font-medium">분류 폴더명 (선택)</label>
              <input
                type="text"
                value={uploadFolderName}
                onChange={(e) => setUploadFolderName(e.target.value)}
                placeholder="예: 고1 수학"
                className="px-3 py-2 text-sm bg-slate-50 text-slate-700 border border-slate-200 rounded-lg placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 w-32"
              />
            </div>
          </div>

          <div className="flex gap-2 items-end">
            {/* 파일 첨부 버튼 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-500 font-medium">문제집 파일</label>
              <button
                onClick={handleSelectFile}
                className="px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 max-w-[200px]"
                title={selectedFile || 'PDF 파일 선택'}
              >
                <Upload size={16} className="text-blue-400" />
                <span className="truncate">{selectedFile ? selectedFile.split('\\').pop() : 'PDF 첨부'}</span>
              </button>
            </div>

            {/* 분석 시작 버튼 (새 작업 등록) */}
            <button
              onClick={handleAnalyzePdf}
              disabled={!selectedFile}
              className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-lg shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
            >
              <Search size={16} />
              분석 시작
            </button>
          </div>
        </div>

        {/* 에러 메시지 */}
        {errorMsg && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{errorMsg}</p>
          </div>
        )}
      </div>

      {/* 문제집 목록 */}
      <div className="space-y-6">
        {/* 학생용 문제집 */}
        {renderWorkbooksByFolder(studentWorkbooks, "학생용 문제집", <BookOpen size={14} />)}

        {/* 교사용 문제집 */}
        {renderWorkbooksByFolder(teacherWorkbooks, "교사용 답안지", <FileText size={14} />)}
      </div>
      {/* 삭제 확인 모달 */}
      {workbookToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <AlertCircle size={24} />
              <h3 className="text-lg font-bold text-slate-800">문제집 삭제 경고</h3>
            </div>
            
            <p className="text-sm text-slate-600 mb-2">
              <span className="font-bold text-slate-800">{workbookToDelete.name}</span> 문제집을 정말로 삭제하시겠습니까?
            </p>
            <p className="text-xs text-red-400/90 bg-red-500/10 border border-red-500/20 p-3 rounded-lg mb-5 leading-relaxed">
              사전에 추출된 <strong>모든 문제 이미지 파일들이 함께 영구 삭제</strong>되며, 복구할 수 없습니다. 계속 진행하시려면 아래에 <strong>'삭제'</strong>라고 입력해 주세요.
            </p>

            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="삭제"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 mb-5 focus:outline-none focus:border-red-500 transition-colors"
              autoFocus
            />

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setWorkbookToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteInput.trim() !== '삭제'}
                className="px-4 py-2 text-sm font-bold text-slate-800 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
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
  onResumeAnalysis: () => void;
  onCancelAnalysis: () => void;
  onRescan: () => void;
  onReloadData: () => void;
  onUpdateFolder: (folderName: string) => void;
  jobProgress?: { message: string, percent: number };
}

function WorkbookCard({
  workbook, allWorkbooks, isExpanded, questions, questionImages,
  pairingMode, onToggleExpand, onDelete, onStartPairing, onCancelPairing, onPairWith, onResumeAnalysis, onCancelAnalysis, onRescan, onReloadData, onUpdateFolder, jobProgress
}: WorkbookCardProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isEditingFolder, setIsEditingFolder] = useState(false);
  const [editFolderInput, setEditFolderInput] = useState(workbook.folderName || '');

  // isExpanded가 변경될 때 선택 초기화
  useEffect(() => {
    if (!isExpanded) setSelectedIds(new Set());
  }, [isExpanded]);

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}개의 문제를 정말 삭제하시겠습니까?\n(이미지 파일도 함께 영구 삭제됩니다)`)) return;

    const res = await window.electronAPI.deleteQuestions(workbook.id, Array.from(selectedIds));
    if (res.success) {
      alert('선택한 문제가 삭제되었습니다.');
      setSelectedIds(new Set());
      onReloadData();
    } else {
      alert(`삭제 실패: ${res.error}`);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };
  const paired = workbook.pairedWorkbookId
    ? allWorkbooks.find(w => w.id === workbook.pairedWorkbookId)
    : null;
  
  const isPairingTarget = pairingMode && pairingMode !== workbook.id
    && allWorkbooks.find(w => w.id === pairingMode)?.type !== workbook.type;

  const typeColor = workbook.type === 'student' ? 'blue' : 'orange';

  const scrollToPage = (pageNum: number) => {
    const firstQ = questions.find(q => q.page === pageNum);
    if (firstQ) {
      const el = document.getElementById(`wb-${workbook.id}-q-${firstQ.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // highlight briefly
        el.style.transition = 'box-shadow 0.3s';
        el.style.boxShadow = '0 0 0 3px #10b981';
        setTimeout(() => { el.style.boxShadow = 'none'; }, 1500);
      } else {
        alert(`${pageNum}페이지를 찾을 수 없습니다.`);
      }
    } else {
      alert(`${pageNum}페이지에 해당하는 문제가 없습니다.`);
    }
  };

  return (
    <div className={`bg-white shadow-sm border border-slate-100 rounded-lg border transition-all ${
      isPairingTarget 
        ? 'border-yellow-500/50 shadow-lg shadow-yellow-500/10 cursor-pointer' 
        : 'border-slate-200'
    }`}>
      {/* 카드 헤더 */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50/30 transition-colors"
        onClick={() => isPairingTarget ? onPairWith(workbook.id) : onToggleExpand()}
      >
        <div className={`w-2 h-2 rounded-full bg-${typeColor}-400`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-slate-800 truncate">{workbook.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded bg-${typeColor}-500/15 text-${typeColor}-400 font-medium`}>
              {workbook.type === 'student' ? '학생용' : '교사용'}
            </span>
            {workbook.status === 'paused' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-medium border border-yellow-500/20">
                {workbook.lastAnalyzedPage ? `일시 중지됨 (${workbook.lastAnalyzedPage}p 완료)` : '일시 중지됨'}
              </span>
            )}
            {workbook.status === 'analyzing' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-600 font-medium border border-indigo-500/20 flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" />
                {workbook.lastAnalyzedPage ? `분석 중 (${workbook.lastAnalyzedPage}p)` : '분석 준비 중...'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
            <span>{workbook.totalQuestions}문제</span>
            <span>·</span>
            <span>{new Date(workbook.analyzedAt).toLocaleDateString()}</span>
            {paired && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 text-indigo-500">
                  <Link size={10} />
                  {paired.name} 매칭됨
                </span>
              </>
            )}
          </div>
        </div>

        {/* 버튼들 */}
        <div className="flex items-center gap-1 shrink-0">
          {isEditingFolder ? (
            <div className="flex items-center gap-1 bg-slate-50 rounded p-1" onClick={e => e.stopPropagation()}>
              <input 
                type="text" 
                value={editFolderInput} 
                onChange={e => setEditFolderInput(e.target.value)} 
                placeholder="폴더명"
                className="w-24 px-1.5 py-0.5 text-xs bg-white border border-slate-200 rounded text-slate-800 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onUpdateFolder(editFolderInput);
                    setIsEditingFolder(false);
                  } else if (e.key === 'Escape') {
                    setIsEditingFolder(false);
                  }
                }}
                autoFocus
              />
              <button onClick={() => { onUpdateFolder(editFolderInput); setIsEditingFolder(false); }} className="p-1 text-indigo-600 hover:bg-indigo-500/20 rounded">
                <Save size={12} />
              </button>
              <button onClick={() => setIsEditingFolder(false)} className="p-1 text-slate-500 hover:bg-slate-100 rounded">
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setEditFolderInput(workbook.folderName || ''); setIsEditingFolder(true); }}
              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-500/10 rounded-md transition-colors"
              title="폴더명 수정"
            >
              <FolderOpen size={14} />
            </button>
          )}

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
          {workbook.status !== 'completed' && !pairingMode && workbook.status !== 'analyzing' && (
            <button
              onClick={(e) => { e.stopPropagation(); onResumeAnalysis(); }}
              className="px-2 py-1 text-[11px] text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 rounded border border-indigo-500/30 transition-colors"
            >
              이어서 분석
            </button>
          )}
          {workbook.status === 'analyzing' && (
            <button
              onClick={(e) => { e.stopPropagation(); onCancelAnalysis(); }}
              className="px-2 py-1 text-[11px] text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded border border-red-500/30 transition-colors"
            >
              분석 정지
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

      {/* 진행 상황 바 (카드 내부) */}
      {workbook.status === 'analyzing' && jobProgress && (
        <div className="px-4 pb-3">
          <div className="flex justify-between text-[10px] text-slate-500 mb-1.5">
            <span className="flex items-center gap-1">
              <Loader2 size={10} className="animate-spin text-indigo-600" />
              {jobProgress.message}
            </span>
            <span className="text-indigo-600 font-medium">{Math.round(jobProgress.percent)}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-600 to-purple-500 transition-all duration-500"
              style={{ width: `${jobProgress.percent}%` }}
            />
          </div>
        </div>
      )}

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
          {(() => {
            // 연속된 문제 번호에서 누락된 번호 계산
            const nums = questions.map(q => {
              const coreNumber = q.number.replace(/^P\d+[_ \-]/, '');
              const match = coreNumber.match(/^(.*?)(\d+)$/);
              return match ? { prefix: match[1], num: parseInt(match[2], 10), padLen: match[2].length, original: q.number } : null;
            }).filter(Boolean) as { prefix: string; num: number; padLen: number; original: string }[];

            // prefix별 그룹핑
            const groups: Record<string, typeof nums> = {};
            for (const n of nums) {
              if (!groups[n.prefix]) groups[n.prefix] = [];
              groups[n.prefix].push(n);
            }

            const missingNumbers: string[] = [];
            for (const [prefix, list] of Object.entries(groups)) {
              list.sort((a, b) => a.num - b.num);
              if (list.length < 2) continue;
              const minNum = list[0].num;
              const maxNum = list[list.length - 1].num;
              const existingNums = new Set(list.map(l => l.num));
              for (let n = minNum; n <= maxNum; n++) {
                if (!existingNums.has(n)) {
                  missingNumbers.push(prefix + String(n).padStart(list[0].padLen, '0'));
                }
              }
            }

            const expectedTotal = questions.length + missingNumbers.length;

            return (
              <>
                <div className="my-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">
                      문제 미리보기 (전체 {questions.length}개{missingNumbers.length > 0 && <span className="text-red-400"> / 예상 {expectedTotal}개</span>})
                    </span>
                    <div className="flex items-center gap-2">
                      {selectedIds.size > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteSelected(); }}
                          className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-1 rounded hover:bg-red-500/20 flex items-center gap-1 transition-colors font-semibold"
                        >
                          <Trash2 size={10} />
                          선택 삭제 ({selectedIds.size})
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); onRescan(); }}
                        className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-1 rounded hover:bg-blue-500/20 flex items-center gap-1 transition-colors"
                        title="폴더에 직접 넣은 이미지 스캔"
                      >
                        <RefreshCw size={10} />
                        폴더 수동 스캔
                      </button>
                      <span className="text-[10px] text-indigo-500 bg-indigo-500/10 px-2 py-1 rounded">
                        이미지를 클릭하면 그림판에서 수정할 수 있습니다
                      </span>
                    </div>
                  </div>
                  {missingNumbers.length > 0 && (
                    <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <span className="text-[11px] text-red-400 font-semibold">
                        ⚠ 누락 {missingNumbers.length}개:
                      </span>
                      <span className="text-[10px] text-red-300 ml-1.5">
                        {missingNumbers.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </>
            );
          })()}

          {/* 페이지 검색 바 (IIFE 외부로 분리하여 포커스 잃음 방지) */}
          <PageSearchInput onSearch={scrollToPage} />

          <div className="grid grid-cols-4 gap-2">
            {[...questions].sort((a, b) => {
              if (a.page !== b.page) return a.page - b.page;
              return a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' });
            }).map(q => (
              <div 
                key={q.id} 
                id={`wb-${workbook.id}-q-${q.id}`}
                className={`relative bg-slate-50 rounded-md p-2 border transition-all group ${
                  selectedIds.has(q.id) 
                    ? 'border-red-500/50 ring-1 ring-red-500/20' 
                    : 'border-slate-200/30 hover:border-indigo-600 hover:ring-2 hover:ring-indigo-600/20'
                }`}
              >
                <div className="absolute top-2 right-2 z-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(q.id)}
                    onChange={() => toggleSelect(q.id)}
                    className="w-4 h-4 rounded border-slate-300 bg-slate-50 text-red-500 focus:ring-red-500/50 cursor-pointer"
                  />
                </div>
                <div 
                  onClick={() => window.electronAPI.openInPaint(q.imagePath)}
                  className="cursor-pointer h-full flex flex-col"
                  title="클릭하여 그림판으로 열기"
                >
                  <div className="flex items-center justify-between mb-1 pr-6">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-red-400">#{q.number.replace(/^P\d+[_ \-]/, '')}</span>
                      <span className="text-[9px] text-slate-500">p.{q.page}</span>
                    </div>
                  </div>
                  {workbook.type === 'teacher_quick' ? (
                    <div className="w-full h-20 bg-slate-100 rounded flex items-center justify-center p-2 text-center overflow-auto">
                      <span className="text-sm font-semibold text-slate-800 break-all">{q.answerText}</span>
                    </div>
                  ) : questionImages[q.id] ? (
                    <img
                      src={questionImages[q.id]}
                      alt={`문제 ${q.number}`}
                      className="w-full h-20 object-contain bg-white/90 rounded group-hover:brightness-95 transition-all"
                    />
                  ) : (
                    <div className="w-full h-20 bg-slate-100 rounded flex items-center justify-center">
                      <Image size={16} className="text-slate-600" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
