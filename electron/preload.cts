// ================================================================
// preload.cts - Electron IPC Bridge (contextBridge)
// 렌더러 프로세스(React)에서 메인 프로세스의 기능을 안전하게 호출
// ================================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ====== 문제집 관리 ======
  /** PDF 파일 선택 다이얼로그 */
  selectPdfFile: () => ipcRenderer.invoke('select-pdf-file'),
  
  /** PDF 분석 시작 및 재개 */
  analyzePdf: (filePath: string, type: 'student' | 'teacher', startNumber?: string, analyzeStartPage?: number, analyzeEndPage?: number, workbookId?: string) => 
    ipcRenderer.invoke('analyze-pdf', filePath, type, startNumber, analyzeStartPage, analyzeEndPage, workbookId),
    
  /** PDF 분석 중지 */
  cancelAnalyzePdf: (workbookId: string) => ipcRenderer.invoke('cancel-analyze-pdf', workbookId),
  
  /** 문제집 목록 조회 */
  getWorkbooks: () => ipcRenderer.invoke('get-workbooks'),
  
  /** 문제집 삭제 */
  deleteWorkbook: (workbookId: string) => ipcRenderer.invoke('delete-workbook', workbookId),
  
  /** 학생용-교사용 매칭 */
  pairWorkbooks: (studentId: string, teacherId: string) => 
    ipcRenderer.invoke('pair-workbooks', studentId, teacherId),
  
  /** 특정 문제집의 문제 목록 조회 */
  getQuestions: (workbookId: string) => ipcRenderer.invoke('get-questions', workbookId),

  // ====== 학생 관리 ======
  getStudents: () => ipcRenderer.invoke('get-students'),
  saveStudent: (student: any) => ipcRenderer.invoke('save-student', student),
  deleteStudent: (studentId: string) => ipcRenderer.invoke('delete-student', studentId),

  // ====== 오답노트 생성 ======
  /** 오답노트 생성 (문제 번호 기반) */
  generateOdapNote: (studentId: string, workbookId: string, questionNumbers: number[], includeAnswers: boolean) => 
    ipcRenderer.invoke('generate-odap-note', studentId, workbookId, questionNumbers, includeAnswers),
  
  /** 파일로 내보내기 */
  exportFile: (odapNoteId: string, format: 'pdf' | 'hwpx') => 
    ipcRenderer.invoke('export-file', odapNoteId, format),
  
  /** 즉시 프린트 */
  printOdapNote: (filePath: string) => ipcRenderer.invoke('print-odap-note', filePath),
  
  /** 레이아웃 변경 후 인쇄 */
  printOdapNoteWithLayout: (studentId: string, recordId: string, layout: number) => 
    ipcRenderer.invoke('print-odap-note-with-layout', studentId, recordId, layout),

  /** 개별 학생 오답노트 삭제 */
  deleteOdapNoteRecord: (studentId: string, recordId: string) => 
    ipcRenderer.invoke('delete-odap-note-record', studentId, recordId),
  
  /** 파일 저장 위치 선택 */
  selectSaveDir: () => ipcRenderer.invoke('select-save-dir'),

  // ====== 설정 ======
  getAppSettings: () => ipcRenderer.invoke('get-app-settings'),
  saveAppSettings: (settings: any) => ipcRenderer.invoke('save-app-settings', settings),

  // ====== 자동 업데이트 ======
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  onUpdaterEvent: (eventChannel: string, callback: (data: any) => void) => {
    const validChannels = ['update-available', 'update-not-available', 'download-progress', 'update-downloaded', 'updater-error'];
    if (validChannels.includes(eventChannel)) {
      const listener = (_event: any, data: any) => callback(data);
      ipcRenderer.on(eventChannel, listener);
      return () => ipcRenderer.removeListener(eventChannel, listener);
    }
    return () => {};
  },

  // ====== 이벤트 리스너 ======
  /** PDF 분석 진행 상황 */
  onAnalysisProgress: (callback: (data: { workbookId?: string; message: string; percent: number }) => void) => {
    const listener = (_event: any, value: any) => callback(value);
    ipcRenderer.on('analysis-progress', listener);
    return () => ipcRenderer.removeListener('analysis-progress', listener);
  },

  /** 이미지 파일을 base64로 읽기 (렌더러에서 미리보기용) */
  readImageAsBase64: (imagePath: string) => ipcRenderer.invoke('read-image-base64', imagePath),

  /** 외부 프로그램으로 파일 열기 */
  openExternal: (filePath: string) => ipcRenderer.invoke('open-external', filePath),

  /** 폴더 열기 */
  showInFolder: (filePath: string) => ipcRenderer.invoke('show-in-folder', filePath),

  /** 그림판으로 열기 */
  openInPaint: (filePath: string) => ipcRenderer.invoke('open-in-paint', filePath),
});
