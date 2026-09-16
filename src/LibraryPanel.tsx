import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Download, Upload, Search, Book, Image as ImageIcon, Trash2, FolderOpen, Calendar, Clock, Loader2, RefreshCw, ChevronDown, ChevronUp, Edit2, Save, FileText } from 'lucide-react';
import type { Workbook, Question } from './types';

interface EBook extends Workbook {
  coverImage?: string;
  tocImageBase64?: string;
  questions?: Question[];
}

export default function LibraryPanel() {
  const [ebooks, setEbooks] = useState<EBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // 선택된 책의 ID
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);
  // 펼쳐진 상세 정보용 상태
  const [detailImages, setDetailImages] = useState<{ type: 'cover'|'toc'|'question', base64: string, index?: number }[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // 수정용 폼 상태
  const [editForm, setEditForm] = useState<{ grade: string; publicationYear: string; publisher: string; folderName: string }>({
    grade: '', publicationYear: '', publisher: '', folderName: ''
  });

  // 선택된 단(Row)으로 스크롤하기 위한 참조
  const activeRowRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    try {
      const workbooks = await window.electronAPI.getWorkbooks();
      
      const ebooksWithCovers: EBook[] = await Promise.all(
        workbooks.map(async (wb) => {
          const questions = await window.electronAPI.getQuestions(wb.id);
          let coverImage;
          let tocImageBase64;
          
          if (wb.customCoverImagePath) {
             const base64 = await window.electronAPI.readImageAsBase64(wb.customCoverImagePath);
             if (base64) coverImage = base64;
          }
          
          if (wb.tocImagePath) {
            const base64 = await window.electronAPI.readImageAsBase64(wb.tocImagePath);
            if (base64) tocImageBase64 = base64;
          }
          
          // 커스텀 표지가 없으면 첫 번째 문제 이미지 사용
          if (!coverImage && questions && questions.length > 0 && questions[0].imagePath) {
             const base64 = await window.electronAPI.readImageAsBase64(questions[0].imagePath);
             if (base64) {
               coverImage = base64;
             }
          }
          return { ...wb, coverImage, tocImageBase64, questions };
        })
      );
      
      // 최신 수정일 순으로 정렬
      ebooksWithCovers.sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime());
      
      setEbooks(ebooksWithCovers);
    } catch (e) {
      console.error('라이브러리 로딩 실패:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  // expandedBookId가 변경될 때 스크롤 애니메이션
  useEffect(() => {
    if (expandedBookId && activeRowRef.current && scrollContainerRef.current) {
      setTimeout(() => {
        activeRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100); // UI 트랜지션이 시작된 직후 스크롤
    }
  }, [expandedBookId]);

  const handleExport = async (workbookId: string) => {
    setActionLoading(`export_${workbookId}`);
    try {
      const result = await window.electronAPI.exportWorkbook(workbookId);
      if (result.success) {
        alert('세이브 파일 내보내기가 완료되었습니다.');
      } else if (result.error && result.error !== '취소되었습니다.') {
        alert(`내보내기 실패: ${result.error}`);
      }
    } catch (error) {
      console.error(error);
      alert('오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleImport = async () => {
    setActionLoading('import');
    try {
      const result = await window.electronAPI.importWorkbook();
      if (result.success) {
        alert('세이브 파일 가져오기가 완료되었습니다.');
        loadLibrary(); // 새로고침
      } else if (result.error && result.error !== '취소되었습니다.') {
        alert(`가져오기 실패: ${result.error}`);
      }
    } catch (error) {
      console.error(error);
      alert('오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };
  
  const handleSelectCover = async (workbookId: string) => {
    try {
      const imagePath = await window.electronAPI.selectImageFile();
      if (!imagePath) return;
      
      setActionLoading(`cover_${workbookId}`);
      const result = await window.electronAPI.setWorkbookCover(workbookId, imagePath);
      
      if (result.success) {
        await loadLibrary(); // 재표시
      } else {
        alert(`표지 설정 실패: ${result.error}`);
      }
    } catch (error) {
      console.error(error);
      alert('표지 설정 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };
  
  const handleSelectToc = async (workbookId: string) => {
    try {
      const imagePath = await window.electronAPI.selectImageFile();
      if (!imagePath) return;
      
      setActionLoading(`toc_${workbookId}`);
      const result = await window.electronAPI.setWorkbookToc(workbookId, imagePath);
      
      if (result.success) {
        await loadLibrary(); // 재표시
      } else {
        alert(`목차 이미지 설정 실패: ${result.error}`);
      }
    } catch (error) {
      console.error(error);
      alert('목차 설정 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateInfo = async (workbookId: string) => {
    setActionLoading(`update_${workbookId}`);
    try {
      const success = await window.electronAPI.updateWorkbook(workbookId, editForm);
      if (success) {
        alert('정보가 저장되었습니다.');
        await loadLibrary();
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (error) {
      console.error(error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleExpandBook = async (book: EBook) => {
    if (expandedBookId === book.id) {
      setExpandedBookId(null);
      return;
    }
    
    setExpandedBookId(book.id);
    setEditForm({
      grade: book.grade || '',
      publicationYear: book.publicationYear || '',
      publisher: book.publisher || '',
      folderName: book.folderName || ''
    });
    
    // 표지/목차 로드
    setLoadingDetails(true);
    setDetailImages([]);
    
    const loaded: { type: 'cover'|'toc'|'question', base64: string, index?: number }[] = [];
    
    if (book.coverImage) {
      loaded.push({ type: 'cover', base64: book.coverImage });
    }
    if (book.tocImageBase64) {
      loaded.push({ type: 'toc', base64: book.tocImageBase64 });
    }
    
    setDetailImages(loaded);
    setLoadingDetails(false);
  };

  const filteredEbooks = ebooks.filter(eb => 
    eb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (eb.folderName && eb.folderName.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  const ITEMS_PER_ROW = 4;
  const rows: (EBook | null)[][] = [];
  for (let i = 0; i < filteredEbooks.length; i += ITEMS_PER_ROW) {
    const chunk = filteredEbooks.slice(i, i + ITEMS_PER_ROW) as (EBook | null)[];
    // 마지막 줄의 빈칸을 null로 채워 4열 유지
    while (chunk.length < ITEMS_PER_ROW) {
      chunk.push(null);
    }
    rows.push(chunk);
  }

  const isZoomedIn = expandedBookId !== null;

  return (
    <div className="h-full flex flex-col bg-slate-50 relative">
      {/* 헤더 */}
      <div className="shrink-0 p-6 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 z-10 shadow-sm relative">
        <div>
          <h2 className="text-2xl font-extrabold text-sky-800 tracking-tight flex items-center gap-2">
            <Book className="text-sky-600" size={26} />
            서재 (Library)
          </h2>
          <p className="text-sm text-slate-500 mt-1">작업 완료된 문제집을 실제 책장처럼 보관하고 세이브 파일로 관리하세요.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="문제집 검색..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-64 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 transition-all"
            />
          </div>
          <button
            onClick={loadLibrary}
            className="p-2 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors"
            title="새로고침"
          >
            <RefreshCw size={18} />
          </button>
          <button 
            onClick={handleImport}
            disabled={actionLoading === 'import'}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold rounded-xl shadow-sm shadow-sky-200 transition-all disabled:opacity-50"
          >
            {actionLoading === 'import' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            가져오기 (Import)
          </button>
        </div>
      </div>

      {/* 컨텐츠 (책장) - 배경 클릭 시 줌아웃 */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-100 cursor-default perspective-1000"
        onClick={() => setExpandedBookId(null)}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Loader2 size={40} className="animate-spin mb-4 text-sky-600" />
            <p>서재를 정리하는 중입니다...</p>
          </div>
        ) : (
          <div className={`mx-auto transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isZoomedIn ? 'max-w-[1200px] py-16' : 'max-w-[1000px] py-12'}`}>
            <div className="flex flex-col gap-16 relative bg-transparent overflow-visible">
              {rows.map((row, rowIndex) => {
                const isActiveRow = row.some(book => book?.id === expandedBookId);
                const isOtherRow = isZoomedIn && !isActiveRow;

                // 동적 크기 계산
                const rowHeightClass = isZoomedIn
                  ? (isActiveRow ? 'h-auto pb-10' : 'h-0 opacity-0 overflow-hidden scale-y-0 pb-0') 
                  : 'h-[200px]'; // 줌아웃 시: 고정 높이 적용 (아래로 무한 스크롤)

                const bookWidthClass = 'w-[140px]';
                const bookHeightClass = 'w-[140px] h-[195px]';
                const opacityClass = isOtherRow ? 'opacity-0' : 'opacity-100';

                return (
                  <div 
                    key={`row-${rowIndex}`} 
                    ref={isActiveRow ? activeRowRef : null}
                    className={`relative transition-all duration-700 ease-out ${rowHeightClass}`}
                  >
                    
                    {/* 줌아웃 상태: 4개 책 그리드 */}
                    {(!isZoomedIn || !isActiveRow) && (
                      <div className={`relative z-10 flex justify-between px-10 items-end h-full`}>
                        {row.map((ebook, idx) => (
                          <div 
                            key={ebook?.id || `empty-${rowIndex}-${idx}`} 
                            className={`relative flex flex-col items-center shrink-0 transition-all duration-700 ${bookWidthClass}`}
                          >
                            {ebook ? (
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleExpandBook(ebook);
                                }}
                                className={`
                                  group relative flex flex-col rounded shadow-[0_25px_20px_-15px_rgba(0,0,0,0.2)] 
                                  transition-all duration-500 cursor-pointer origin-bottom
                                  ${bookHeightClass} ${opacityClass}
                                  hover:-translate-y-2 hover:shadow-[0_35px_25px_-15px_rgba(0,0,0,0.3)]
                                `}
                                style={{ 
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0'
                                }}
                              >
                                {/* 표지 이미지 */}
                                <div className="absolute inset-0 overflow-hidden rounded border border-slate-200">
                                  {ebook.coverImage ? (
                                    <img 
                                      src={ebook.coverImage} 
                                      alt="Cover" 
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                                      <ImageIcon size={24} className="mb-1 text-sky-200" />
                                    </div>
                                  )}
                                  {/* 깔끔한 음영 오버레이 */}
                                  <div className="absolute inset-0 bg-gradient-to-r from-black/5 via-transparent to-black/5 pointer-events-none"></div>
                                </div>
                                
                                {/* 라벨 */}
                                <div className="absolute top-1.5 right-1.5 flex gap-1 z-20">
                                  <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded-sm shadow-sm ${ebook.type === 'student' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'}`}>
                                    {ebook.type === 'student' ? '학생용' : '교사용'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className={`${bookHeightClass} opacity-0`}></div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* 줌인 상태: 선택된 책 1권(좌) + 상세 정보(우) 배치 */}
                    {(isZoomedIn && isActiveRow) && (() => {
                      const expandedBook = row.find(book => book?.id === expandedBookId)!;
                      return (
                        <div className="flex flex-col md:flex-row gap-10 px-4 py-2 animate-in fade-in duration-500">
                          
                          {/* 왼쪽: 확대된 책 이미지 */}
                          <div className="shrink-0 flex flex-col items-center">
                            <div 
                              className={`
                                relative flex flex-col rounded shadow-[0_35px_25px_-15px_rgba(0,0,0,0.3)] 
                                w-[220px] h-[310px] ring-4 ring-sky-500 ring-offset-4
                              `}
                              style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
                            >
                              <div className="absolute inset-0 overflow-hidden rounded border border-slate-200">
                                {expandedBook.coverImage ? (
                                  <img src={expandedBook.coverImage} alt="Cover" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                                    <ImageIcon size={32} className="mb-1 text-sky-200" />
                                  </div>
                                )}
                              </div>
                              <div className="absolute top-2 right-2 flex gap-1 z-20">
                                <span className={`px-2 py-1 text-[10px] font-bold rounded-sm shadow-sm ${expandedBook.type === 'student' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'}`}>
                                  {expandedBook.type === 'student' ? '학생용' : '교사용'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 오른쪽: 상세 정보 패널 */}
                          <div 
                            onClick={(e) => e.stopPropagation()} 
                            className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col xl:flex-row gap-8 overflow-hidden"
                          >
                            {/* 왼쪽 폼 영역 */}
                            <div className="w-full xl:w-1/3 flex flex-col gap-4 xl:border-r border-slate-200 xl:pr-8">
                              <div className="flex items-start justify-between">
                                <h3 className="text-xl font-bold text-slate-800 mb-2">{expandedBook.name}</h3>
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-1">폴더명 (분류)</label>
                                  <input 
                                    type="text" 
                                    value={editForm.folderName} 
                                    onChange={e => setEditForm({...editForm, folderName: e.target.value})}
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-sky-500 outline-none"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">학년</label>
                                    <input 
                                      type="text" 
                                      value={editForm.grade} 
                                      placeholder="예: 고1"
                                      onChange={e => setEditForm({...editForm, grade: e.target.value})}
                                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-sky-500 outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">출판년도</label>
                                    <input 
                                      type="text" 
                                      value={editForm.publicationYear} 
                                      placeholder="예: 2024"
                                      onChange={e => setEditForm({...editForm, publicationYear: e.target.value})}
                                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-sky-500 outline-none"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-1">출판사</label>
                                  <input 
                                    type="text" 
                                    value={editForm.publisher} 
                                    onChange={e => setEditForm({...editForm, publisher: e.target.value})}
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-sky-500 outline-none"
                                  />
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 mt-4">
                                <button 
                                  onClick={() => handleUpdateInfo(expandedBook.id)}
                                  disabled={actionLoading === `update_${expandedBook.id}`}
                                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded text-sm font-bold transition-colors disabled:opacity-50 shadow-sm"
                                >
                                  {actionLoading === `update_${expandedBook.id}` ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                  정보 저장
                                </button>
                              </div>
                              
                              <div className="h-px bg-slate-200 my-2"></div>
                              
                              {/* 표지 및 목차 첨부 */}
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => handleSelectCover(expandedBook.id)}
                                  disabled={actionLoading === `cover_${expandedBook.id}`}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded text-xs font-bold transition-colors disabled:opacity-50 border border-slate-300"
                                >
                                  {actionLoading === `cover_${expandedBook.id}` ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                                  표지 커스텀
                                </button>
                                
                                <button 
                                  onClick={() => handleSelectToc(expandedBook.id)}
                                  disabled={actionLoading === `toc_${expandedBook.id}`}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded text-xs font-bold transition-colors disabled:opacity-50 border border-slate-300"
                                >
                                  {actionLoading === `toc_${expandedBook.id}` ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                                  목차 첨부
                                </button>
                              </div>
                              
                              <button 
                                onClick={() => handleExport(expandedBook.id)}
                                disabled={actionLoading === `export_${expandedBook.id}`}
                                className="w-full flex items-center justify-center gap-2 py-3 mt-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 border border-indigo-200 shadow-sm"
                              >
                                {actionLoading === `export_${expandedBook.id}` ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                                세이브 파일로 추출
                              </button>
                            </div>
                            
                            {/* 오른쪽 미리보기 영역 */}
                            <div className="w-full xl:w-2/3 flex flex-col">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                  <Search size={16} />
                                  표지 및 목차 확인
                                </h4>
                                <div className="text-xs text-sky-600 font-bold bg-sky-100 px-3 py-1 rounded-full">
                                  총 {expandedBook.totalQuestions}문항
                                </div>
                              </div>
                              
                              <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 p-6 flex gap-6 items-center shadow-inner min-h-[260px] overflow-x-auto">
                                {loadingDetails ? (
                                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                    <Loader2 size={28} className="animate-spin mb-3 text-sky-500" />
                                    <span className="text-sm">이미지를 불러오는 중...</span>
                                  </div>
                                ) : detailImages.length > 0 ? (
                                  detailImages.map((item, idx) => (
                                    <div key={idx} className="shrink-0 h-48 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden relative flex items-center justify-center p-2">
                                      <img 
                                        src={item.base64} 
                                        alt={`Preview ${idx}`} 
                                        className="h-full w-auto max-w-[400px] object-contain" 
                                      />
                                      <div className="absolute top-2 left-2 bg-slate-800/80 text-white text-[11px] font-bold px-2 py-1 rounded backdrop-blur-sm shadow-sm">
                                        {item.type === 'cover' && '표지'}
                                        {item.type === 'toc' && '목차'}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                    <span className="text-sm">미리보기 이미지가 없습니다.</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
