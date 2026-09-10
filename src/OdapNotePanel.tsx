// ================================================================
// OdapNotePanel.tsx - 오답노트 생성 탭 (핵심 기능)
// 학생 선택 → 문제집 선택 → 문제번호 입력 → 오답노트 생성/출력
// ================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Download, Printer, Eye, Loader2,
  CheckCircle2, AlertCircle, Plus, X, Image,
  BookOpen, User
} from 'lucide-react';
import type { Student, Workbook, Question } from './types';

export default function OdapNotePanel() {
  const [students, setStudents] = useState<Student[]>([]);
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedWorkbookId, setSelectedWorkbookId] = useState('');
  const [questionNumbersInput, setQuestionNumbersInput] = useState('');
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);
  const [previewImages, setPreviewImages] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{
    success: boolean;
    notePath?: string;
    answerPath?: string | null;
    error?: string;
    name?: string;
  } | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);

  // 데이터 로딩
  const loadData = useCallback(async () => {
    const [studentsData, workbooksData] = await Promise.all([
      window.electronAPI.getStudents(),
      window.electronAPI.getWorkbooks(),
    ]);
    setStudents(studentsData);
    // 학생용 문제집만 표시 (오답노트는 학생용에서 생성)
    setWorkbooks(workbooksData.filter(w => w.type === 'student'));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 문제집 선택 시 전체 문제 목록 로드
  useEffect(() => {
    if (selectedWorkbookId) {
      window.electronAPI.getQuestions(selectedWorkbookId).then(setAllQuestions);
    } else {
      setAllQuestions([]);
    }
  }, [selectedWorkbookId]);

  // 번호 파싱 및 정규화
  const normalizeNumber = (num: string) => {
    let cleaned = num.replace(/번$/g, '').trim();
    if (/^\d+$/.test(cleaned)) {
      return cleaned.padStart(4, '0');
    }
    return cleaned;
  };

  const parseQuestionNumbers = (input: string): string[] => {
    return input
      .split(/[,\s]+/)
      .map(n => n.trim())
      .filter(n => n !== '')
      .map(normalizeNumber);
  };

  // 미리보기 로딩
  const handlePreview = async () => {
    const numbers = parseQuestionNumbers(questionNumbersInput);
    if (numbers.length === 0 || !selectedWorkbookId) return;

    // 전체 문제에서 입력된 번호 매칭
    const matched = numbers
      .map(num => allQuestions.find(q => normalizeNumber(q.number) === num))
      .filter(Boolean) as Question[];

    setPreviewQuestions(matched);

    // 이미지 로딩
    const images: Record<string, string> = {};
    for (const q of matched) {
      const base64 = await window.electronAPI.readImageAsBase64(q.imagePath);
      if (base64) images[q.id] = base64;
    }
    setPreviewImages(images);
  };

  // 오답노트 생성
  const handleGenerate = async () => {
    if (!selectedStudentId || !selectedWorkbookId) return;
    const numbers = parseQuestionNumbers(questionNumbersInput);
    if (numbers.length === 0) return;

    setIsGenerating(true);
    setResult(null);

    const res = await window.electronAPI.generateOdapNote(
      selectedStudentId,
      selectedWorkbookId,
      numbers,
      includeAnswers
    );

    setIsGenerating(false);
    setResult({
      success: res.success,
      notePath: res.notePath,
      answerPath: res.answerPath,
      error: res.error,
      name: res.record?.name,
    });

    if (res.success) {
      // 학생 데이터 리로드 (기록 갱신)
      const updatedStudents = await window.electronAPI.getStudents();
      setStudents(updatedStudents);
    }
  };

  // 찾을 수 없는 문제번호 체크
  const inputNumbers = parseQuestionNumbers(questionNumbersInput);
  const missingNumbers = inputNumbers.filter(
    num => !allQuestions.some(q => normalizeNumber(q.number) === num)
  );

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const selectedWorkbook = workbooks.find(w => w.id === selectedWorkbookId);

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      {/* 상단: 입력 영역 */}
      <div className="bg-slate-900/80 rounded-xl border border-slate-700/50 p-6">
        <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
          <FileText size={20} className="text-emerald-400" />
          오답노트 생성
        </h2>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* 학생 선택 */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium flex items-center gap-1">
              <User size={12} />
              학생 선택
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors appearance-none cursor-pointer"
            >
              <option value="">-- 학생을 선택하세요 --</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name} {s.memo ? `(${s.memo})` : ''}</option>
              ))}
            </select>
          </div>

          {/* 문제집 선택 */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium flex items-center gap-1">
              <BookOpen size={12} />
              문제집 선택
            </label>
            <select
              value={selectedWorkbookId}
              onChange={(e) => setSelectedWorkbookId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors appearance-none cursor-pointer"
            >
              <option value="">-- 문제집을 선택하세요 --</option>
              {workbooks.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.totalQuestions}문제)</option>
              ))}
            </select>
          </div>
        </div>

        {/* 문제번호 입력 */}
        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-1.5 font-medium">
            문제번호 입력 (쉼표로 구분)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={questionNumbersInput}
              onChange={(e) => setQuestionNumbersInput(e.target.value)}
              placeholder="예: 11, 19, 5, 102, 140, 350"
              className="flex-1 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors font-mono"
            />
            <button
              onClick={handlePreview}
              disabled={!selectedWorkbookId || inputNumbers.length === 0}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-40"
            >
              <Eye size={14} />
              미리보기
            </button>
          </div>

          {/* 입력 상태 표시 */}
          <div className="flex items-center gap-3 mt-2 text-[11px]">
            {inputNumbers.length > 0 && (
              <span className="text-slate-500">
                {inputNumbers.length}개 문제 선택
              </span>
            )}
            {missingNumbers.length > 0 && (
              <span className="text-yellow-400 flex items-center gap-1">
                <AlertCircle size={10} />
                문제집에 없는 번호: {missingNumbers.join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* 옵션 + 생성 버튼 */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeAnswers}
              onChange={(e) => setIncludeAnswers(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-emerald-500 focus:ring-emerald-500"
            />
            답안지도 함께 생성
          </label>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedStudentId || !selectedWorkbookId || inputNumbers.length === 0}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <Plus size={16} />
                오답노트 생성
              </>
            )}
          </button>
        </div>

        {/* 오답노트 이름 미리보기 */}
        {selectedStudent && selectedWorkbook && (
          <div className="mt-3 text-xs text-slate-500">
            생성될 파일명: <span className="text-emerald-400 font-mono">{selectedWorkbook.name}_{selectedStudent.name}.pdf</span>
          </div>
        )}
      </div>

      {/* 결과 알림 */}
      {result && (
        <div className={`rounded-xl border p-4 flex items-start gap-3 ${
          result.success
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          {result.success ? (
            <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            {result.success ? (
              <>
                <div className="text-sm font-semibold text-emerald-300 mb-1">
                  오답노트가 성공적으로 생성되었습니다!
                </div>
                <div className="text-xs text-emerald-500/80">
                  {result.name}
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-semibold text-red-300 mb-1">생성 실패</div>
                <div className="text-xs text-red-400">{result.error}</div>
              </>
            )}
          </div>
          {result.success && (
            <div className="flex gap-2">
              {result.notePath && (
                <>
                  <button
                    onClick={() => window.electronAPI.openExternal(result.notePath!)}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <Download size={12} />
                    열기
                  </button>
                  <button
                    onClick={() => window.electronAPI.printOdapNote(result.notePath!)}
                    className="px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <Printer size={12} />
                    프린트
                  </button>
                </>
              )}
              {result.answerPath && (
                <button
                  onClick={() => window.electronAPI.openExternal(result.answerPath!)}
                  className="px-3 py-1.5 text-xs font-medium text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <FileText size={12} />
                  답안지
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 미리보기 영역 (2×2 그리드) */}
      {previewQuestions.length > 0 && (
        <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Eye size={16} className="text-blue-400" />
              오답노트 미리보기
              <span className="text-slate-500 font-normal">({previewQuestions.length}문제)</span>
            </h3>
            <button
              onClick={() => { setPreviewQuestions([]); setPreviewImages({}); }}
              className="p-1 text-slate-500 hover:text-white rounded"
            >
              <X size={16} />
            </button>
          </div>

          {/* 페이지별 2×2 그리드 미리보기 */}
          {Array.from({ length: Math.ceil(previewQuestions.length / 4) }).map((_, pageIdx) => {
            const pageQuestions = previewQuestions.slice(pageIdx * 4, (pageIdx + 1) * 4);
            return (
              <div key={pageIdx} className="mb-4">
                {pageIdx > 0 && (
                  <div className="text-[10px] text-slate-600 text-center my-2">--- 페이지 {pageIdx + 1} ---</div>
                )}
                <div className="bg-white rounded-lg p-3 shadow-inner">
                  {/* 헤더 */}
                  <div className="border border-gray-400 p-2 mb-0.5">
                    <div className="text-[11px] text-gray-800 font-bold">
                      이름 : {selectedStudent?.name || '???'}
                    </div>
                    <div className="text-[11px] text-gray-800 font-bold">
                      교재 : {selectedWorkbook?.name || '???'}
                    </div>
                  </div>
                  {/* 2×2 그리드 */}
                  <div className="grid grid-cols-2 gap-0.5">
                    {pageQuestions.map((q) => (
                      <div key={q.id} className="border border-gray-300 p-2 min-h-[120px]">
                        <div className="text-[9px] text-gray-500 font-medium mb-1 border-b border-gray-200 pb-0.5">
                          Page.{q.page}
                        </div>
                        {previewImages[q.id] ? (
                          <img
                            src={previewImages[q.id]}
                            alt={`문제 ${q.number}`}
                            className="max-h-[80px] object-contain"
                          />
                        ) : (
                          <div className="flex items-center gap-1 text-[10px] text-gray-600 py-2">
                            <span className="text-red-500 font-bold">{q.number}</span>
                            <span className="truncate">{q.textContent || '(생성 시 자동 추출됨)'}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {/* 빈 셀 채우기 */}
                    {Array.from({ length: 4 - pageQuestions.length }).map((_, i) => (
                      <div key={`empty-${i}`} className="border border-gray-200 bg-gray-50 min-h-[120px]" />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
