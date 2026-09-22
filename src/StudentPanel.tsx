// ================================================================
// StudentPanel.tsx - 학생 관리 탭
// 학생 등록/수정/삭제 + 오답노트 제공 기록 관리
// ================================================================

import { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Trash2, Edit2, FileText, Calendar, Hash, X, Save, Printer, FolderOpen, CheckSquare } from 'lucide-react';
import type { Student, OdapNoteRecord } from './types';

export default function StudentPanel() {
  const [students, setStudents] = useState<Student[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newAffiliation, setNewAffiliation] = useState('');
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newGrade, setNewGrade] = useState('');

  const loadStudents = useCallback(async () => {
    const data = await window.electronAPI.getStudents();
    setStudents(data);
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // 학생 추가
  const handleAddStudent = async () => {
    if (!newName.trim()) return;
    const student: Student = {
      id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: newName.trim(),
      affiliation: newAffiliation.trim() || undefined,
      schoolName: newSchoolName.trim() || undefined,
      grade: newGrade.trim() || undefined,
      createdAt: new Date().toISOString(),
      odapNotes: [],
    };
    await window.electronAPI.saveStudent(student);
    setNewName('');
    setNewAffiliation('');
    setNewSchoolName('');
    setNewGrade('');
    setShowAddModal(false);
    await loadStudents();
  };

  // 학생 수정
  const handleEditStudent = async () => {
    if (!editingStudent || !newName.trim()) return;
    const updated = { 
      ...editingStudent, 
      name: newName.trim(), 
      affiliation: newAffiliation.trim() || undefined,
      schoolName: newSchoolName.trim() || undefined,
      grade: newGrade.trim() || undefined,
    };
    await window.electronAPI.saveStudent(updated);
    setEditingStudent(null);
    setNewName('');
    setNewAffiliation('');
    setNewSchoolName('');
    setNewGrade('');
    await loadStudents();
  };

  // 학생 삭제
  const handleDeleteStudent = async (studentId: string) => {
    await window.electronAPI.deleteStudent(studentId);
    if (selectedStudentId === studentId) setSelectedStudentId(null);
    await loadStudents();
  };

  // 수정 모달 열기
  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setNewName(student.name);
    // 하위 호환성: affiliation이 없고 memo만 있으면 memo를 affiliation으로 표시
    setNewAffiliation(student.affiliation || (student.schoolName || student.grade ? '' : (student.memo || '')));
    setNewSchoolName(student.schoolName || '');
    setNewGrade(student.grade || '');
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  return (
    <div className="p-6 flex gap-6 h-full print:p-0 print:h-auto print:block">
      {/* 왼쪽: 학생 목록 */}
      <div className="w-80 shrink-0 flex flex-col print:hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Users size={20} className="text-indigo-600" />
            학생 목록
            <span className="text-sm text-slate-500 font-normal">({students.length})</span>
          </h2>
          <button
            onClick={() => { setShowAddModal(true); setNewName(''); setNewAffiliation(''); setNewSchoolName(''); setNewGrade(''); }}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-lg shadow-indigo-500/20"
          >
            <UserPlus size={14} />
            추가
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5">
          {students.map(student => (
            <div
              key={student.id}
              onClick={() => setSelectedStudentId(student.id)}
              className={`
                group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all
                ${selectedStudentId === student.id
                  ? 'bg-indigo-500/10 border border-indigo-500/20'
                  : 'bg-white/50 border border-slate-200/30 hover:bg-slate-50'
                }
              `}
            >
              {/* 아바타 */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                selectedStudentId === student.id
                  ? 'bg-indigo-500/20 text-indigo-600'
                  : 'bg-slate-200/50 text-slate-500'
              }`}>
                {student.name[0]}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">{student.name}</div>
                <div className="text-[10px] text-slate-500 flex items-center gap-2">
                  {student.affiliation && <span className="font-medium text-indigo-600">{student.affiliation}</span>}
                  {student.schoolName && <span>{student.schoolName}</span>}
                  {student.grade && <span>{student.grade}</span>}
                  {/* 하위 호환성 지원: affiliation, schoolName, grade 모두 없는데 memo가 있는 경우 */}
                  {student.memo && !student.affiliation && !student.schoolName && !student.grade && <span>{student.memo}</span>}
                  <span>오답노트 {student.odapNotes.length}건</span>
                </div>
              </div>

              {/* 액션 버튼 (호버 시 표시) */}
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); openEditModal(student); }}
                  className="p-1 text-slate-500 hover:text-blue-400 rounded"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteStudent(student.id); }}
                  className="p-1 text-slate-500 hover:text-red-400 rounded"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}

          {students.length === 0 && (
            <div className="text-center py-12 text-slate-600 text-sm">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              등록된 학생이 없습니다
            </div>
          )}
        </div>
      </div>

      {/* 오른쪽: 선택된 학생의 오답노트 기록 */}
      <div className="flex-1 bg-white/50 rounded-xl border border-slate-200 p-5 flex flex-col min-w-0 print:hidden">
        {selectedStudent ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{selectedStudent.name}</h3>
                <p className="text-xs text-slate-500">
                  {selectedStudent.affiliation && <span className="text-indigo-600 font-medium mr-1">{selectedStudent.affiliation}</span>}
                  {selectedStudent.schoolName && <span className="mr-1">{selectedStudent.schoolName}</span>}
                  {selectedStudent.grade && <span className="mr-1">{selectedStudent.grade}</span>}
                  {selectedStudent.memo && !selectedStudent.affiliation && !selectedStudent.schoolName && !selectedStudent.grade && <span className="mr-1">{selectedStudent.memo}</span>}
                  {((selectedStudent.affiliation || selectedStudent.schoolName || selectedStudent.grade || selectedStudent.memo) ? '· ' : '')}
                  등록일: {new Date(selectedStudent.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-indigo-600">{selectedStudent.odapNotes.length}</div>
                <div className="text-[10px] text-slate-500">오답노트 기록</div>
              </div>
            </div>

            {/* 오답노트 기록 리스트 */}
            <div className="space-y-2">
              {selectedStudent.odapNotes.length === 0 ? (
                <div className="text-center py-12 text-slate-600 text-sm">
                  <FileText size={32} className="mx-auto mb-2 opacity-30" />
                  아직 제공된 오답노트가 없습니다
                </div>
              ) : (
                selectedStudent.odapNotes.map(record => (
                  <OdapNoteRecordCard key={record.id} record={record} studentId={selectedStudent.id} onDeleted={loadStudents} />
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-600 text-sm">
            왼쪽에서 학생을 선택하세요
          </div>
        )}
      </div>

      {/* 학생 추가/수정 모달 */}
      {(showAddModal || editingStudent) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-50 rounded-xl border border-slate-200 w-96 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">
                {editingStudent ? '학생 정보 수정' : '새 학생 등록'}
              </h3>
              <button
                onClick={() => { setShowAddModal(false); setEditingStudent(null); }}
                className="p-1 text-slate-500 hover:text-slate-800 rounded"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">이름 *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="학생 이름"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && (editingStudent ? handleEditStudent() : handleAddStudent())}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">소속 (학원/반)</label>
                <input
                  type="text"
                  value={newAffiliation}
                  onChange={(e) => setNewAffiliation(e.target.value)}
                  placeholder="예: 강남본원 A반"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">학교명</label>
                  <input
                    type="text"
                    value={newSchoolName}
                    onChange={(e) => setNewSchoolName(e.target.value)}
                    placeholder="예: 대치고등학교"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">학년</label>
                  <input
                    type="text"
                    value={newGrade}
                    onChange={(e) => setNewGrade(e.target.value)}
                    placeholder="예: 1학년"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => { setShowAddModal(false); setEditingStudent(null); }}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-800 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={editingStudent ? handleEditStudent : handleAddStudent}
                disabled={!newName.trim()}
                className="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save size={14} />
                {editingStudent ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== 오답노트 기록 카드 =====================

function OdapNoteRecordCard({ record, studentId, onDeleted }: { record: OdapNoteRecord, studentId: string, onDeleted?: () => void }) {
  const [layout, setLayout] = useState<number>(4);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [answerViewMode, setAnswerViewMode] = useState<'both' | 'answerOnly'>('both');
  const [questions, setQuestions] = useState<any[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [isLoadingAnswers, setIsLoadingAnswers] = useState(false);

  const handlePrint = async () => {
    if (record.exportedPath) {
      setIsPrinting(true);
      const res = await window.electronAPI.printOdapNoteWithLayout(studentId, record.id, layout);
      if (res.isFallback) {
        alert("안내: 이 오답노트의 원본 문제집이 삭제되어 새로운 레이아웃으로 다시 만들 수 없습니다.\n과거에 생성된 기존 PDF를 엽니다.");
      }
      setIsPrinting(false);
    }
  };

  const handleOpenFolder = async () => {
    if (record.exportedPath) {
      await window.electronAPI.showInFolder(record.exportedPath);
    }
  };

  const handleDelete = async () => {
    if (confirm(`'${record.name}' 오답노트 기록을 정말 삭제하시겠습니까?`)) {
      const res = await window.electronAPI.deleteOdapNoteRecord(studentId, record.id);
      if (res.success && onDeleted) {
        onDeleted();
      } else if (!res.success) {
        alert(`삭제 실패: ${res.error}`);
      }
    }
  };

  const handleShowAnswers = async () => {
    setShowAnswers(true);
    setIsLoadingAnswers(true);
    
    try {
      const allQs = await window.electronAPI.getQuestions(record.workbookId);
      
      const matchedQs = allQs.filter(q => record.questionNumbers.includes(q.number));
      // 번호순 정렬
      matchedQs.sort((a, b) => {
        const numA = parseInt(a.number.replace(/[^0-9]/g, ''), 10);
        const numB = parseInt(b.number.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.number.localeCompare(b.number);
      });
      
      setQuestions(matchedQs);
      
      const newImages: Record<string, string> = {};
      for (const q of matchedQs) {
        if (q.imagePath) {
          const b64 = await window.electronAPI.readImageAsBase64(q.imagePath);
          if (b64) newImages[`prob_${q.id}`] = b64;
        }
        if (q.answerImagePath) {
          const b64 = await window.electronAPI.readImageAsBase64(q.answerImagePath);
          if (b64) newImages[`ans_${q.id}`] = b64;
        }
      }
      setImages(newImages);
    } catch (e) {
      console.error(e);
      alert('정답 데이터를 불러오는데 실패했습니다.');
    } finally {
      setIsLoadingAnswers(false);
    }
  };

  return (
    <div className="bg-slate-50/60 rounded-lg border border-slate-200/30 px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-md bg-indigo-500/10 flex items-center justify-center shrink-0">
        <FileText size={16} className="text-indigo-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-800 truncate">{record.name}</div>
        <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-0.5">
          <span className="flex items-center gap-1">
            <Calendar size={9} />
            {new Date(record.createdAt).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <Hash size={9} />
            {record.questionNumbers.length}문제
          </span>
          <span className="text-slate-600">
            [{record.questionNumbers.slice(0, 5).join(', ')}
            {record.questionNumbers.length > 5 ? '...' : ''}]
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {record.exportedPath && (
          <>
            <select
              value={layout}
              onChange={(e) => setLayout(Number(e.target.value))}
              className="px-2 py-1 mr-1 bg-slate-200/50 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value={4}>2×2</option>
              <option value={6}>2×3</option>
            </select>
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className={`p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors ${isPrinting ? 'opacity-50' : ''}`}
              title="프린트"
            >
              <Printer size={14} />
            </button>
            <button
              onClick={handleShowAnswers}
              className="p-1.5 text-slate-500 hover:text-green-500 hover:bg-green-500/10 rounded-md transition-colors"
              title="답안지 보기"
            >
              <CheckSquare size={14} />
            </button>
            <button
              onClick={handleOpenFolder}
              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-500/10 rounded-md transition-colors"
              title="폴더 열기"
            >
              <FolderOpen size={14} />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
              title="기록 삭제"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>

      {/* 답안지 보기 모달 */}
      {showAnswers && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:static print:block print:bg-transparent print:p-0">
          <div id="print-area" className="bg-white rounded-2xl w-full max-w-5xl shadow-xl flex flex-col max-h-[85vh] print-expand print:max-w-none print:shadow-none print:rounded-none">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 print-hide">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <CheckSquare className="text-green-500" size={20} />
                {record.name} 답안지
              </h2>
              <div className="flex items-center gap-3">
                <div className="flex bg-slate-100 rounded-lg p-1">
                  <button 
                    onClick={() => setAnswerViewMode('both')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${answerViewMode === 'both' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    문제 포함
                  </button>
                  <button 
                    onClick={() => setAnswerViewMode('answerOnly')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${answerViewMode === 'answerOnly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    답안만
                  </button>
                </div>
                <button
                  onClick={async () => {
                    const printArea = document.getElementById('print-area');
                    if (!printArea) return alert('인쇄 영역을 찾을 수 없습니다.');
                    
                    const headHtml = document.head.innerHTML.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
                    const html = `
                      <!DOCTYPE html>
                      <html>
                      <head>
                        <base href="${window.location.href}">
                        ${headHtml}
                        <style>
                          body { background: white !important; margin: 0; padding: 20px; display: block; overflow: visible; height: auto; }
                          #print-area { box-shadow: none !important; max-width: none !important; max-height: none !important; border: none !important; height: auto !important; position: static !important; display: block !important; }
                          .print-hide { display: none !important; }
                        </style>
                      </head>
                      <body>
                        ${printArea.outerHTML}
                      </body>
                      </html>
                    `;
                    
                    const res = await window.electronAPI.printPreview(html);
                    if (!res.success) alert('미리보기 생성에 실패했습니다: ' + res.error);
                  }}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                >
                  <FileText size={14} /> PDF로 미리보기
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                >
                  <Printer size={14} /> 바로 인쇄
                </button>
                <button
                  onClick={() => setShowAnswers(false)}
                  className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 print-expand print:p-0 print:bg-white">
              <div className="hidden print:block text-2xl font-bold text-center mb-6">{record.name} 정답지</div>
              {isLoadingAnswers ? (
                <div className="flex justify-center py-12 text-slate-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
                  불러오는 중...
                </div>
              ) : questions.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  매칭된 문제 데이터가 없습니다.
                </div>
              ) : answerViewMode === 'answerOnly' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-2 print:grid-cols-5 print:gap-x-6 print:gap-y-3">
                  {questions.map((q) => (
                    <div key={q.id} className="flex items-center gap-3 py-1.5 border-b border-dashed border-slate-200 break-inside-avoid">
                      <div className="w-12 text-right font-bold text-slate-500 text-sm shrink-0">
                        {q.number.replace(/^P\d+[_ \-]/, '')}
                      </div>
                      <div className="flex-1 font-medium text-slate-800 text-sm flex items-center min-w-0">
                        {q.answerText ? (
                          <span className="whitespace-pre-wrap leading-tight">{q.answerText}</span>
                        ) : images[`ans_${q.id}`] ? (
                          <img src={images[`ans_${q.id}`]} alt="정답 이미지" className="max-h-12 max-w-full object-contain" />
                        ) : (
                          <span className="text-slate-400 text-xs italic">없음</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-6 print:space-y-4">
                  {questions.map((q) => (
                    <div key={q.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm print:shadow-none print:border-slate-300 break-inside-avoid">
                      <div className="bg-slate-100/50 px-4 py-2 border-b border-slate-200 font-semibold text-slate-700 flex justify-between print:bg-slate-100">
                        <span>#{q.number.replace(/^P\d+[_ \-]/, '')}</span>
                      </div>
                      
                      <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100 print:flex-row print:divide-y-0 print:divide-x">
                        {/* 문제 영역 */}
                        <div className="flex-1 p-4">
                          <div className="text-xs text-slate-400 mb-2 font-medium">문제</div>
                          {images[`prob_${q.id}`] ? (
                            <img src={images[`prob_${q.id}`]} alt="문제 이미지" className="max-w-full rounded border border-slate-100" />
                          ) : (
                            <div className="text-slate-400 text-sm italic">이미지가 없습니다</div>
                          )}
                        </div>
                        
                        {/* 정답 영역 */}
                        <div className="flex-1 p-4 bg-green-50/30 print:bg-transparent">
                          <div className="text-xs text-green-600 mb-2 font-medium print:text-slate-500">정답/해설</div>
                          {q.answerText ? (
                            <div className="text-slate-800 whitespace-pre-wrap font-medium">{q.answerText}</div>
                          ) : images[`ans_${q.id}`] ? (
                            <img src={images[`ans_${q.id}`]} alt="정답 이미지" className="max-w-full rounded border border-slate-100" />
                          ) : (
                            <div className="text-slate-400 text-sm italic">매칭된 정답이 없습니다</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
