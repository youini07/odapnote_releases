// ================================================================
// database.ts - JSON 파일 기반 데이터 관리
// 왜 JSON인가? 밴드어드민과 동일한 패턴으로, 별도 DB 서버 없이
// 로컬 파일 시스템에서 간단하게 데이터를 관리하기 위함
// ================================================================

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Workbook, Question, Student, OdapNoteRecord, AppSettings } from './types.js';

/** 시스템 기본 데이터 저장 디렉토리 (settings.json 등 유지) */
function getSystemDataDir(): string {
  const dir = path.join(app.getPath('userData'), 'odapnote_data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** 실제 데이터가 저장되는 디렉토리 (커스텀 경로가 있으면 우선 사용) */
function getDataDir(): string {
  const systemDir = getSystemDataDir();
  const settingsPath = path.join(systemDir, 'settings.json');
  try {
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (settings.customStorageDir && fs.existsSync(settings.customStorageDir)) {
        return settings.customStorageDir;
      }
    }
  } catch (e) {
    console.error('[DB] 설정 파일 읽기 에러:', e);
  }
  return systemDir;
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

/** 선택한 문제 삭제 (이미지 파일 포함) */
export function deleteQuestions(workbookId: string, questionIds: string[]): { success: boolean, error?: string } {
  try {
    let questions = getQuestions(workbookId);
    const toDelete = questions.filter(q => questionIds.includes(q.id));
    
    // 이미지 파일 삭제
    for (const q of toDelete) {
      if (q.imagePath && fs.existsSync(q.imagePath)) {
        fs.unlinkSync(q.imagePath);
      }
    }
    
    questions = questions.filter(q => !questionIds.includes(q.id));
    saveQuestions(workbookId, questions);
    
    const workbooks = getWorkbooks();
    const wb = workbooks.find(w => w.id === workbookId);
    if (wb) {
      wb.totalQuestions = questions.length;
      saveWorkbook(wb);
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
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

export function getAppSettings(): AppSettings {
  const filePath = path.join(getSystemDataDir(), 'settings.json');
  const defaults: AppSettings = {
    geminiApiKey: '',
    paperSize: 'A4',
    marginMm: 10,
    questionsPerPage: 4,
    dataPath: getDataDir(),
  };
  
  const savedSettings = readJson<AppSettings>(filePath, defaults);

  // 저장된 키가 없을 경우 822 Link에서 가져오기 시도 (선택적)
  if (!savedSettings.geminiApiKey) {
    savedSettings.geminiApiKey = getGeminiKeyFrom822Link();
  }
  
  return { ...defaults, ...savedSettings };
}

/** 앱 설정 저장 */
export function saveAppSettings(settings: AppSettings): void {
  writeJson(path.join(getSystemDataDir(), 'settings.json'), settings);
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

/** 
 * 수동으로 추가된 누락된 문제 이미지를 폴더에서 스캔하여 데이터베이스에 반영
 */
export function rescanQuestionImages(workbookId: string): { success: boolean, addedCount: number, error?: string } {
  try {
    const dir = getQuestionsImageDir(workbookId);
    if (!fs.existsSync(dir)) return { success: false, error: '이미지 디렉토리를 찾을 수 없습니다.', addedCount: 0 };
    
    let questions = getQuestions(workbookId);
    
    // 이전에 잘못된 스캔으로 인해 추가된 P000_ 형태의 문제 번호 정리 (자동 복구)
    const originalLength = questions.length;
    questions = questions.filter(q => !/^P\d+_.+/i.test(q.number));
    
    const existingNumbers = new Set(questions.map(q => normalizeNumber(q.number)));
    
    const files = fs.readdirSync(dir);
    let addedCount = 0;
    
    for (const file of files) {
      if (file.toLowerCase().endsWith('.png')) {
        let basename = path.basename(file, '.png');
        
        // P008_0018.png 와 같이 페이지 접두사가 붙은 경우 제거하여 순수 문제 번호만 추출
        const match = basename.match(/^P\d+_(.+)$/i);
        if (match) {
          basename = match[1];
        }
        
        const num = normalizeNumber(basename);
        
        if (!existingNumbers.has(num)) {
          // get the workbook type
          const workbooks = getWorkbooks();
          const wb = workbooks.find(w => w.id === workbookId);
          const wbType = wb ? wb.type : 'student';

          questions.push({
            id: `q_manual_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
            number: num,
            page: 1,
            imagePath: path.join(dir, file),
            textContent: '',
            workbookId: workbookId,
            type: '미분류',
            bbox: { x: 0, y: 0, width: 0, height: 0 }
          });
          existingNumbers.add(num);
          addedCount++;
        }
      }
    }
    
    if (addedCount > 0 || questions.length !== originalLength) {
      questions.sort((a, b) => {
         const numA = parseInt(a.number, 10);
         const numB = parseInt(b.number, 10);
         if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
         return a.number.localeCompare(b.number);
      });
      saveQuestions(workbookId, questions);
      
      const workbooks = getWorkbooks();
      const wb = workbooks.find(w => w.id === workbookId);
      if (wb) {
        wb.totalQuestions = questions.length;
        saveWorkbook(wb);
      }
    }
    
    // 만약 에러 복구만 일어났고 추가된 건 없다면, 복구된 사실을 알리기 위해 임의로 addedCount를 반환하지 않고 success 처리
    return { success: true, addedCount };
  } catch (error: any) {
    return { success: false, error: error.message, addedCount: 0 };
  }
}
