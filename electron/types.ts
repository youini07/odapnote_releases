// ================================================================
// 공통 타입 정의 - Electron 메인 프로세스 + 렌더러에서 공유
// ================================================================

/** 문제집 정보 */
export interface Workbook {
  id: string;
  name: string;           // 문제집 이름 (파일명에서 추출)
  fileName: string;       // 원본 PDF 파일명
  filePath: string;       // 원본 PDF 파일 경로
  type: 'student' | 'teacher';  // 학생용/교사용
  pairedWorkbookId?: string;     // 매칭된 반대 타입 문제집 ID
  analyzedAt: string;     // 분석 완료 시각 (ISO 문자열)
  totalQuestions: number;  // 총 문제 수
  status?: 'analyzing' | 'paused' | 'completed' | 'error'; // 분석 진행 상태
  lastAnalyzedPage?: number; // 마지막으로 분석된 페이지 번호
  analyzeEndPage?: number; // 사용자가 설정했던 분석 끝 페이지
  folderName?: string; // 분류를 위한 폴더명 커스텀 지원
  customCoverImagePath?: string; // 사용자가 등록한 커스텀 표지 경로
  tocImagePath?: string; // 목차 이미지 경로
  grade?: string; // 학년
  publicationYear?: string; // 출판년도
  publisher?: string; // 출판사
}

/** 개별 문제 정보 */
export interface Question {
  id: string;
  workbookId: string;
  number: string;         // 문제 번호 (문자열 형태, 예: "0001", "1-01" 등 지원)
  page: number;           // PDF 페이지 번호
  type: '객관식' | '주관식' | '미분류';
  imagePath: string;      // 크롭된 문제 이미지 절대 경로
  answerImagePath?: string; // 매칭된 답안 이미지 경로 (교사용에서)
  textContent?: string;   // AI가 인식한 텍스트 (참고용)
  bbox: BoundingBox;      // 페이지 내 위치 (비율 좌표)
}

/** 바운딩 박스 - 페이지 크기 대비 비율 (0~1) */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 학생 정보 */
export interface Student {
  id: string;
  name: string;
  memo?: string;          // 하위 호환성 위해 남겨둠
  affiliation?: string;   // 소속
  schoolName?: string;    // 학교명
  grade?: string;         // 학년
  createdAt: string;
  odapNotes: OdapNoteRecord[];
}

/** 오답노트 기록 */
export interface OdapNoteRecord {
  id: string;
  name: string;           // "문제집이름_학생이름" 형식
  workbookId: string;
  workbookName: string;
  questionNumbers: string[];  // 선택된 문제 번호 목록
  createdAt: string;
  exportedAs?: 'pdf' | 'hwpx';
  exportedPath?: string;     // 내보낸 파일 경로
  printedAt?: string;
}

/** PDF 분석 진행 상황 */
export interface AnalysisProgress {
  status: 'uploading' | 'analyzing' | 'cropping' | 'saving' | 'done' | 'error';
  message: string;
  percent: number;        // 0~100
  currentPage?: number;
  totalPages?: number;
}

/** AI 분석 결과 - 단일 문제 */
export interface AIQuestionResult {
  number: string;
  page: number;
  type: '객관식' | '주관식' | '미분류';
  hasImage: boolean;
  bbox: BoundingBox;
  textContent: string;
}

/** AI 분석 결과 - 전체 */
export interface AIAnalysisResult {
  questions: AIQuestionResult[];
}

/** 앱 설정 */
export interface AppSettings {
  geminiApiKey: string;
  paperSize: 'A4' | 'B4';
  academyLogoPath?: string; // 학원 커스텀 로고
  academyName?: string;
  questionsPerPage: number; // 페이지당 문제 수 (기본: 4)
  dataPath: string;        // 데이터 저장 경로
  customStorageDir?: string; // 사용자 지정 저장 경로
  concurrentScanLimit?: number; // 동시 분석 페이지 수 (기본 1)
  isWorkbookLockEnabled?: boolean; // 문제집 관리 탭 잠금 여부
  workbookTabPassword?: string; // 문제집 관리 탭 잠금 비밀번호
  showTabSuneung?: boolean; // 수능/모의고사 탭 표시 여부
  showTabSchool?: boolean; // 학교기출 탭 표시 여부
  showTabMaterial?: boolean; // 자료/시험지 탭 표시 여부
}

/** Electron API */
export interface ElectronAPI {
  getAppSettings: () => Promise<AppSettings>;
  saveAppSettings: (settings: AppSettings) => Promise<boolean>;
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<any>;
}

/** 내보내기 옵션 */
export interface ExportOptions {
  format: 'pdf' | 'hwpx';
  includeAnswers: boolean;  // 답안지 포함 여부
  outputDir: string;
  questionsPerPage?: number;
  suffix?: string;
}
