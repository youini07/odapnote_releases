// ================================================================
// 프론트엔드 타입 정의 + Electron API 타입 선언
// ================================================================

/** Electron preload에서 노출한 API 타입 */
export interface ElectronAPI {
  // 문제집 관리
  selectPdfFile: () => Promise<string | null>;
  analyzePdf: (filePath: string, type: 'student' | 'teacher', startNumber?: string, analyzeStartPage?: number, analyzeEndPage?: number, workbookId?: string) => Promise<{
    success: boolean;
    workbook?: Workbook;
    questionCount?: number;
    error?: string;
    status?: string;
  }>;
  cancelAnalyzePdf: (workbookId: string) => Promise<boolean>;
  getWorkbooks: () => Promise<Workbook[]>;
  updateWorkbook: (workbookId: string, updates: Partial<Workbook>) => Promise<boolean>;
  setWorkbookCover: (workbookId: string, imagePath: string) => Promise<{ success: boolean; newPath?: string; error?: string }>;
  setWorkbookToc: (workbookId: string, imagePath: string) => Promise<{ success: boolean; newPath?: string; error?: string }>;
  exportWorkbook: (workbookId: string) => Promise<{ success: boolean; error?: string }>;
  importWorkbook: () => Promise<{ success: boolean; error?: string; workbookId?: string }>;
  deleteWorkbook: (workbookId: string) => Promise<boolean>;
  pairWorkbooks: (studentId: string, teacherId: string) => Promise<boolean>;
  getQuestions: (workbookId: string) => Promise<Question[]>;
  rescanWorkbookImages: (workbookId: string) => Promise<{ success: boolean, addedCount: number, error?: string }>;
  scanUnregisteredFolders: () => Promise<{ success: boolean; addedWorkbooks: number; error?: string }>;
  deleteQuestions: (workbookId: string, questionIds: string[]) => Promise<{ success: boolean; error?: string }>;

  // 학생 관리
  getStudents: () => Promise<Student[]>;
  saveStudent: (student: Student) => Promise<boolean>;
  deleteStudent: (studentId: string) => Promise<boolean>;

  // 오답노트 생성
  generateOdapNote: (
    studentId: string,
    workbookId: string,
    questionNumbers: string[],
    includeAnswers: boolean
  ) => Promise<{
    success: boolean;
    record?: OdapNoteRecord;
    notePath?: string;
    answerPath?: string | null;
    error?: string;
  }>;
  exportFile: (odapNoteId: string, format: 'pdf' | 'hwpx') => Promise<any>;
  printOdapNote: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  printOdapNoteWithLayout: (studentId: string, recordId: string, layout: number) => Promise<{ success: boolean; error?: string; isFallback?: boolean }>;
  deleteOdapNoteRecord: (studentId: string, recordId: string) => Promise<{ success: boolean; error?: string }>;
  selectSaveDir: () => Promise<string | null>;
  selectLogoImage: () => Promise<string | null>;
  selectImageFile: () => Promise<string | null>;

  // 설정
  getAppSettings: () => Promise<AppSettings>;
  saveAppSettings: (settings: AppSettings) => Promise<boolean>;
  getAppVersion: () => Promise<string>;

  // 자동 업데이트
  checkForUpdates: () => Promise<any>;
  downloadUpdate: () => Promise<any>;
  quitAndInstall: () => Promise<void>;
  onUpdaterEvent: (channel: string, callback: (data: any) => void) => () => void;

  // 이벤트 리스너
  onAnalysisProgress: (callback: (data: { workbookId?: string; message: string; percent: number }) => void) => () => void;

  // 유틸리티
  readImageAsBase64: (imagePath: string) => Promise<string | null>;
  openExternal: (filePath: string) => Promise<void>;
  showInFolder: (filePath: string) => Promise<void>;
  openInPaint: (filePath: string) => Promise<void>;
}

// 전역 타입 선언
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export interface Workbook {
  id: string;
  name: string;
  fileName: string;
  filePath: string;
  type: 'student' | 'teacher';
  pairedWorkbookId?: string;
  analyzedAt: string;
  totalQuestions: number;
  status?: 'analyzing' | 'paused' | 'completed' | 'error';
  lastAnalyzedPage?: number;
  analyzeEndPage?: number; // 사용자가 설정했던 분석 끝 페이지
  folderName?: string; // 분류를 위한 폴더명 커스텀 지원
  customCoverImagePath?: string; // 사용자가 등록한 커스텀 표지 경로
  tocImagePath?: string; // 목차 이미지 경로
  grade?: string; // 학년
  publicationYear?: string; // 출판년도
  publisher?: string; // 출판사
}

export interface Question {
  id: string;
  workbookId: string;
  number: string;
  page: number;
  type: '객관식' | '주관식' | '미분류';
  imagePath: string;
  answerImagePath?: string;
  textContent?: string;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface Student {
  id: string;
  name: string;
  memo?: string; // 하위 호환성 위해 남겨둠
  affiliation?: string; // 소속
  schoolName?: string; // 학교명
  grade?: string; // 학년
  createdAt: string;
  odapNotes: OdapNoteRecord[];
}

export interface OdapNoteRecord {
  id: string;
  name: string;
  workbookId: string;
  workbookName: string;
  questionNumbers: string[];
  createdAt: string;
  exportedAs?: 'pdf' | 'hwpx';
  exportedPath?: string;
  printedAt?: string;
}

export interface AppSettings {
  geminiApiKey: string;
  paperSize: 'A4' | 'B4';
  academyLogoPath?: string;
  academyName?: string;
  questionsPerPage: number;
  dataPath: string;
  customStorageDir?: string;
  concurrentScanLimit?: number; // 동시 분석 페이지 수 (기본 1)
  isWorkbookLockEnabled?: boolean; // 문제집 관리 탭 잠금 여부
  workbookTabPassword?: string; // 문제집 관리 탭 잠금 비밀번호
  showTabSuneung?: boolean; // 수능/모의고사 탭 표시 여부
  showTabSchool?: boolean; // 학교기출 탭 표시 여부
  showTabMaterial?: boolean; // 자료/시험지 탭 표시 여부
  useProLayout?: boolean; // Pro 모델로 레이아웃 분석 (정확도↑ 비용↑)
}
