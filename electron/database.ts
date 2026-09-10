// ================================================================
// database.ts - JSON 파일 기반 데이터 관리
// 왜 JSON인가? 밴드어드민과 동일한 패턴으로, 별도 DB 서버 없이
// 로컬 파일 시스템에서 간단하게 데이터를 관리하기 위함
// ================================================================

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Workbook, Question, Student, OdapNoteRecord, AppSettings } from './types.js';

/** 데이터 저장 디렉토리 (userData/odapnote_data) */
function getDataDir(): string {
  const dir = path.join(app.getPath('userData'), 'odapnote_data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** 문제 이미지 저장 디렉토리 */
function getQuestionsImageDir(workbookId: string): string {
  const workbooks = getWorkbooks();
  const wb = workbooks.find(w => w.id === workbookId);
  
  // 직관적인 폴더명: 문제집이름_고유ID뒷부분
  const safeName = wb ? wb.name.replace(/[\\/:*?"<>|]/g, '_') : '알수없는문제집';
  const shortId = workbookId.split('_').pop() || workbookId.substring(0, 6);
  const folderName = `${safeName}_${shortId}`;
  
  const dir = path.join(getDataDir(), 'images', folderName);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** JSON 파일 읽기 헬퍼 */
function readJson<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    console.error(`[DB] JSON 읽기 실패: ${filePath}`, e);
  }
  return fallback;
}

/** JSON 파일 쓰기 헬퍼 */
function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ===================== 문제집 관리 =====================

/** 모든 문제집 목록 조회 */
export function getWorkbooks(): Workbook[] {
  const filePath = path.join(getDataDir(), 'workbooks.json');
  return readJson<Workbook[]>(filePath, []);
}

/** 문제집 저장 (추가 또는 업데이트) */
export function saveWorkbook(workbook: Workbook): void {
  const workbooks = getWorkbooks();
  const idx = workbooks.findIndex(w => w.id === workbook.id);
  if (idx >= 0) {
    workbooks[idx] = workbook;
  } else {
    workbooks.push(workbook);
  }
  writeJson(path.join(getDataDir(), 'workbooks.json'), workbooks);
}

/** 문제집 삭제 */
export function deleteWorkbook(workbookId: string): void {
  let workbooks = getWorkbooks();
  
  // 매칭 해제
  workbooks = workbooks.map(w => {
    if (w.pairedWorkbookId === workbookId) {
      return { ...w, pairedWorkbookId: undefined };
    }
    return w;
  });
  
  // 이미지 폴더도 삭제 (새로운 직관적인 폴더명 방식)
  const wbToDelete = workbooks.find(w => w.id === workbookId);
  if (wbToDelete) {
    const safeName = wbToDelete.name.replace(/[\\/:*?"<>|]/g, '_');
    const shortId = workbookId.split('_').pop() || workbookId.substring(0, 6);
    const folderName = `${safeName}_${shortId}`;
    const newImgDir = path.join(getDataDir(), 'images', folderName);
    if (fs.existsSync(newImgDir)) fs.rmSync(newImgDir, { recursive: true, force: true });
  }
  
  // 구버전 폴더 방식 (혹시 남아있을 경우 삭제)
  const oldImgDir = path.join(getDataDir(), 'images', workbookId);
  if (fs.existsSync(oldImgDir)) fs.rmSync(oldImgDir, { recursive: true, force: true });
  
  writeJson(path.join(getDataDir(), 'workbooks.json'), workbooks.filter(w => w.id !== workbookId));
}

/** 학생용-교사용 문제집 매칭 */
export function pairWorkbooks(studentWorkbookId: string, teacherWorkbookId: string): void {
  const workbooks = getWorkbooks();
  const student = workbooks.find(w => w.id === studentWorkbookId);
  const teacher = workbooks.find(w => w.id === teacherWorkbookId);
  
  if (student && teacher) {
    student.pairedWorkbookId = teacherWorkbookId;
    teacher.pairedWorkbookId = studentWorkbookId;
    writeJson(path.join(getDataDir(), 'workbooks.json'), workbooks);
  }
}

// ===================== 문제 관리 =====================

/** 특정 문제집의 모든 문제 조회 */
export function getQuestions(workbookId: string): Question[] {
  const filePath = path.join(getDataDir(), `questions_${workbookId}.json`);
  return readJson<Question[]>(filePath, []);
}

/** 문제 목록 저장 (전체 교체) */
export function saveQuestions(workbookId: string, questions: Question[]): void {
  writeJson(path.join(getDataDir(), `questions_${workbookId}.json`), questions);
}

// 번호 정규화 유틸리티
function normalizeNumber(num: string): string {
  let cleaned = String(num).replace(/번$/g, '').trim();
  if (/^\d+$/.test(cleaned)) {
    return cleaned.padStart(4, '0');
  }
  return cleaned;
}

/** 특정 번호의 문제들 조회 */
export function getQuestionsByNumbers(workbookId: string, numbers: string[]): Question[] {
  const questions = getQuestions(workbookId);
  const normalizedNumbers = numbers.map(normalizeNumber);
  return questions.filter(q => normalizedNumbers.includes(normalizeNumber(q.number)));
}

/** 문제에 답안 이미지 매칭 */
export function matchAnswerImages(studentWorkbookId: string, teacherWorkbookId: string): void {
  const studentQuestions = getQuestions(studentWorkbookId);
  const teacherQuestions = getQuestions(teacherWorkbookId);
  
  // 문제 번호 기반으로 매칭
  for (const sq of studentQuestions) {
    const matchingAnswer = teacherQuestions.find(tq => normalizeNumber(tq.number) === normalizeNumber(sq.number));
    if (matchingAnswer) {
      sq.answerImagePath = matchingAnswer.imagePath;
    }
  }
  
  saveQuestions(studentWorkbookId, studentQuestions);
}

/** 문제 이미지 저장 경로 생성 */
export function getQuestionImagePath(workbookId: string, questionNumber: string): string {
  // 직관적인 파일명: '1.png', '2.png'
  return path.join(getQuestionsImageDir(workbookId), `${questionNumber}.png`);
}

// ===================== 학생 관리 =====================

/** 모든 학생 조회 */
export function getStudents(): Student[] {
  const filePath = path.join(getDataDir(), 'students.json');
  return readJson<Student[]>(filePath, []);
}

/** 학생 저장 (추가 또는 업데이트) */
export function saveStudent(student: Student): void {
  const students = getStudents();
  const idx = students.findIndex(s => s.id === student.id);
  if (idx >= 0) {
    students[idx] = student;
  } else {
    students.push(student);
  }
  writeJson(path.join(getDataDir(), 'students.json'), students);
}

/** 학생 삭제 */
export function deleteStudent(studentId: string): void {
  const students = getStudents().filter(s => s.id !== studentId);
  writeJson(path.join(getDataDir(), 'students.json'), students);
}

/** 학생에게 오답노트 기록 추가 */
export function addOdapNoteRecord(studentId: string, record: OdapNoteRecord): void {
  const students = getStudents();
  const student = students.find(s => s.id === studentId);
  if (student) {
    student.odapNotes.push(record);
    writeJson(path.join(getDataDir(), 'students.json'), students);
  }
}

/** 학생의 오답노트 기록 업데이트 */
export function updateOdapNoteRecord(studentId: string, recordId: string, updates: Partial<OdapNoteRecord>): void {
  const students = getStudents();
  const student = students.find(s => s.id === studentId);
  if (student) {
    const record = student.odapNotes.find(r => r.id === recordId);
    if (record) {
      Object.assign(record, updates);
      writeJson(path.join(getDataDir(), 'students.json'), students);
    }
  }
}

/** 학생의 오답노트 기록 삭제 */
export function deleteOdapNoteRecord(studentId: string, recordId: string): void {
  const students = getStudents();
  const student = students.find(s => s.id === studentId);
  if (student) {
    student.odapNotes = student.odapNotes.filter(r => r.id !== recordId);
    writeJson(path.join(getDataDir(), 'students.json'), students);
  }
}

// ===================== 앱 설정 =====================

/** 배포용 내장 API 키 (여기에 원장님의 API 키를 입력하시면 배포 버전 사용자들이 기본으로 사용하게 됩니다) */
const EMBEDDED_GEMINI_API_KEY = "AIzaSyAqHgMkF9_F_vrofsNLPfPrrMt2iA-x-mU"; 

/** 앱 설정 조회 */
export function getAppSettings(): AppSettings {
  const filePath = path.join(getDataDir(), 'settings.json');
  const defaults: AppSettings = {
    geminiApiKey: EMBEDDED_GEMINI_API_KEY,
    paperSize: 'A4',
    marginMm: 10,
    questionsPerPage: 4,
    dataPath: getDataDir(),
  };
  
  // 내장 키가 없고 사용자 로컬 설정에도 없을 경우 822 Link에서 가져오기 시도
  if (!defaults.geminiApiKey) {
    defaults.geminiApiKey = getGeminiKeyFrom822Link();
  }
  
  return readJson<AppSettings>(filePath, defaults);
}

/** 앱 설정 저장 - geminiApiKey는 822 Link에서만 가져오므로 저장 시 무시 */
export function saveAppSettings(settings: AppSettings): void {
  // API 키는 항상 822 Link에서 자동으로 가져오므로 사용자 수정 불가
  const current = getAppSettings();
  settings.geminiApiKey = current.geminiApiKey;
  writeJson(path.join(getDataDir(), 'settings.json'), settings);
}

/**
 * 밴드어드민의 822 Link config에서 Gemini API 키 읽기 (fallback)
 * 왜? 동일한 사용자가 밴드어드민에 이미 키를 설정해둔 경우
 * 중복 입력 없이 자동으로 가져오기 위함
 */
function getGeminiKeyFrom822Link(): string {
  try {
    const possiblePaths = [
      path.join(app.getPath('appData'), '822 Link', 'config.json'),
      path.join(app.getPath('appData'), '822-link', 'config.json'),
      path.join(app.getPath('appData'), 'Band Admin', 'catalog_config.json'),
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        const config = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (config.geminiKey) return config.geminiKey;
        if (config.geminiApiKey) return config.geminiApiKey;
      }
    }
  } catch { /* 실패 시 무시 */ }
  return '';
}

/** 데이터 디렉토리 경로 반환 (외부에서 사용) */
export function getDataDirectory(): string {
  return getDataDir();
}
