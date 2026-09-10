// ================================================================
// main.ts - Electron 메인 프로세스 진입점
// 밴드어드민과 동일한 구조: 창 생성 + IPC 핸들러 + 자동 업데이트
// ================================================================

// @ts-nocheck
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import * as database from './database.js';
import { createPdfIndex, extractAndCropQuestions } from './pdfAnalyzer.js';
import { generateOdapNoteFiles } from './exporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    icon: path.join(__dirname, '../build/icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // 개발 모드에서는 Vite dev server, 프로덕션에서는 빌드된 파일
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // 개발자 도구 자동 실행 해제
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  createWindow();

  // ====== 자동 업데이트 설정 ======
  autoUpdater.autoDownload = false;
  autoUpdater.on('update-available', (info: any) => {
    mainWindow?.webContents.send('update-available', info);
  });
  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-not-available');
  });
  autoUpdater.on('download-progress', (progress: any) => {
    mainWindow?.webContents.send('download-progress', progress);
  });
  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update-downloaded');
  });
  autoUpdater.on('error', (err: Error) => {
    mainWindow?.webContents.send('updater-error', err.message);
  });

  // 앱 시작 시 업데이트 체크 (프로덕션에서만)
  if (!process.env.VITE_DEV_SERVER_URL) {
    try { await autoUpdater.checkForUpdates(); } catch { /* 무시 */ }
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

// ====== 문제집 관리 IPC ======

/** PDF 파일 선택 다이얼로그 */
ipcMain.handle('select-pdf-file', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'PDF 파일', extensions: ['pdf'] }],
    title: 'PDF 문제집 선택',
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

/** PDF 분석 시작 */
ipcMain.handle('analyze-pdf', async (event, filePath: string, type: 'student' | 'teacher') => {
  try {
    // 파일명에서 문제집 이름 추출
    const fileName = path.basename(filePath, '.pdf');
    // "(학생용)", "(교사용)" 등의 태그 제거하여 깔끔한 이름 생성
    const cleanName = fileName
      .replace(/\s*\(학생용\)\s*/g, '')
      .replace(/\s*\(교사용\)\s*/g, '')
      .replace(/\s*\(답안\)\s*/g, '')
      .trim();
    
    const workbookId = `wb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    // 진행 상황 콜백
    const onProgress = (message: string, percent: number) => {
      mainWindow?.webContents.send('analysis-progress', { message, percent });
    };

    // 문제집 정보 임시 저장 (알수없는문제집 방지)
    const workbook = {
      id: workbookId,
      name: cleanName,
      fileName: path.basename(filePath),
      filePath: filePath,
      type,
      analyzedAt: new Date().toISOString(),
      totalQuestions: 0,
    };
    database.saveWorkbook(workbook);

    let questions;
    try {
      // V2: PDF 전체를 순차적으로 페이지별 이미지화 및 문제 영역 크롭 (사전 처리)
      questions = await createPdfIndex(filePath, workbookId, type, onProgress);
    } catch (e) {
      database.deleteWorkbook(workbookId);
      throw e;
    }

    // 분석 완료 후 문제 개수 업데이트
    workbook.totalQuestions = questions.length;
    database.saveWorkbook(workbook);

    return { success: true, workbook, questionCount: questions.length };
  } catch (error: any) {
    console.error('[Main] PDF 분석 실패:', error);
    return { success: false, error: error.message };
  }
});

/** 문제집 목록 조회 */
ipcMain.handle('get-workbooks', () => database.getWorkbooks());

/** 문제집 삭제 */
ipcMain.handle('delete-workbook', (event, workbookId: string) => {
  database.deleteWorkbook(workbookId);
  return true;
});

/** 학생용-교사용 매칭 */
ipcMain.handle('pair-workbooks', (event, studentId: string, teacherId: string) => {
  database.pairWorkbooks(studentId, teacherId);
  // 매칭 후 답안 이미지 연결
  database.matchAnswerImages(studentId, teacherId);
  return true;
});

/** 문제 목록 조회 */
ipcMain.handle('get-questions', (event, workbookId: string) => {
  return database.getQuestions(workbookId);
});

// ====== 학생 관리 IPC ======

ipcMain.handle('get-students', () => database.getStudents());

ipcMain.handle('save-student', (event, student: any) => {
  database.saveStudent(student);
  return true;
});

ipcMain.handle('delete-student', (event, studentId: string) => {
  database.deleteStudent(studentId);
  return true;
});

// ====== 오답노트 생성 IPC ======

/** 오답노트 생성 */
ipcMain.handle('generate-odap-note', async (event, studentId: string, workbookId: string, questionNumbers: string[], includeAnswers: boolean) => {
  try {
    const students = database.getStudents();
    const student = students.find(s => s.id === studentId);
    if (!student) throw new Error('학생을 찾을 수 없습니다.');

    const workbooks = database.getWorkbooks();
    const workbook = workbooks.find(w => w.id === workbookId);
    if (!workbook) throw new Error('문제집을 찾을 수 없습니다.');

    // 선택된 번호의 문제 조회
    let questions = database.getQuestionsByNumbers(workbookId, questionNumbers);
    if (questions.length === 0) throw new Error('선택된 문제가 없습니다.');

    // V2: 이미 사전에 추출/크롭된 이미지를 사용하므로 온디맨드 처리 없이 배열을 통과시킵니다.
    questions = await extractAndCropQuestions(workbookId, workbook.filePath, questions, workbook.type);
    
    // 크롭 후 DB 업데이트 (imagePath 등 저장)
    const allQuestions = database.getQuestions(workbookId);
    questions.forEach(q => {
      const idx = allQuestions.findIndex(all => all.number === q.number);
      if (idx !== -1) allQuestions[idx] = q;
    });
    database.saveQuestions(workbookId, allQuestions);

    // 입력 순서대로 정렬
    const orderedQuestions = questionNumbers
      .map(num => questions.find(q => q.number === num))
      .filter(Boolean) as any[];

    // 출력 디렉토리
    const outputDir = path.join(database.getDataDirectory(), 'exports');

    // PDF 생성
    const result = await generateOdapNoteFiles(
      orderedQuestions,
      student.name,
      workbook.name,
      outputDir,
      { format: 'pdf', includeAnswers, outputDir }
    );

    // 학생 DB에 오답노트 기록 추가
    const recordId = `on_${Date.now()}`;
    const record = {
      id: recordId,
      name: `${workbook.name}_${student.name}`,
      workbookId,
      workbookName: workbook.name,
      questionNumbers,
      createdAt: new Date().toISOString(),
      exportedAs: 'pdf' as const,
      exportedPath: result.notePath,
    };
    database.addOdapNoteRecord(studentId, record);

    return {
      success: true,
      record,
      notePath: result.notePath,
      answerPath: result.answerPath,
    };
  } catch (error: any) {
    console.error('[Main] 오답노트 생성 실패:', error);
    return { success: false, error: error.message };
  }
});

/** 즉시 프린트 */
ipcMain.handle('print-odap-note', async (event, filePath: string) => {
  try {
    // PDF 파일을 기본 프로그램으로 열어서 인쇄 (가장 안정적인 방법)
    await shell.openPath(filePath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

/** 레이아웃 변경 후 프린트 */
ipcMain.handle('print-odap-note-with-layout', async (event, studentId: string, recordId: string, layout: number) => {
  try {
    const students = database.getStudents();
    const student = students.find(s => s.id === studentId);
    if (!student) throw new Error('학생을 찾을 수 없습니다.');

    const record = student.odapNotes.find(r => r.id === recordId);
    if (!record) throw new Error('오답노트 기록을 찾을 수 없습니다.');

    const workbooks = database.getWorkbooks();
    const workbook = workbooks.find(w => w.id === record.workbookId);
    if (!workbook) {
      if (record.exportedPath && fs.existsSync(record.exportedPath)) {
        await shell.openPath(record.exportedPath);
        return { success: true, isFallback: true };
      }
      throw new Error('문제집을 찾을 수 없습니다.');
    }

    const questions = database.getQuestionsByNumbers(workbook.id, record.questionNumbers);
    
    // 입력 순서대로 정렬
    const orderedQuestions = record.questionNumbers
      .map(num => questions.find(q => q.number === num))
      .filter(Boolean) as any[];

    if (orderedQuestions.length === 0) throw new Error('문제를 찾을 수 없습니다.');

    const outputDir = path.join(database.getDataDirectory(), 'exports');
    const suffix = `${layout}x_${Date.now()}`;

    // PDF 재생성
    const result = await generateOdapNoteFiles(
      orderedQuestions,
      student.name,
      workbook.name,
      outputDir,
      { format: 'pdf', includeAnswers: false, outputDir, questionsPerPage: layout, suffix }
    );
    
    // DB 업데이트
    database.updateOdapNoteRecord(studentId, recordId, { exportedPath: result.notePath });

    // PDF 열기
    await shell.openPath(result.notePath);
    return { success: true };
  } catch (error: any) {
    console.error('[Main] 오답노트 재생성 후 프린트 실패:', error);
    return { success: false, error: error.message };
  }
});

/** 개별 학생 오답노트 삭제 */
ipcMain.handle('delete-odap-note-record', (event, studentId: string, recordId: string) => {
  try {
    database.deleteOdapNoteRecord(studentId, recordId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

/** 파일 저장 위치 선택 */
ipcMain.handle('select-save-dir', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '저장 폴더 선택',
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// ====== 설정 IPC ======

ipcMain.handle('get-app-settings', () => database.getAppSettings());

ipcMain.handle('save-app-settings', (event, settings: any) => {
  database.saveAppSettings(settings);
  return true;
});

// ====== 유틸리티 IPC ======

/** 이미지를 base64로 읽기 (렌더러 미리보기용) */
ipcMain.handle('read-image-base64', (event, imagePath: string) => {
  try {
    if (fs.existsSync(imagePath)) {
      const buffer = fs.readFileSync(imagePath);
      return `data:image/png;base64,${buffer.toString('base64')}`;
    }
  } catch { /* 무시 */ }
  return null;
});

/** 외부 프로그램으로 열기 */
ipcMain.handle('open-external', async (event, filePath: string) => {
  await shell.openPath(filePath);
});

/** 폴더에서 보기 */
ipcMain.handle('show-in-folder', (event, filePath: string) => {
  shell.showItemInFolder(filePath);
});

/** 그림판으로 열기 */
ipcMain.handle('open-in-paint', (event, filePath: string) => {
  return new Promise((resolve, reject) => {
    // Windows 그림판 실행
    exec(`mspaint "${filePath}"`, (error) => {
      if (error) {
        console.error('[Main] 그림판 열기 실패:', error);
        reject(error);
      } else {
        resolve(true);
      }
    });
  });
});

// ====== 자동 업데이트 IPC ======

ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return result?.updateInfo || null;
  } catch { return null; }
});

ipcMain.handle('download-update', async () => {
  return await autoUpdater.downloadUpdate();
});

ipcMain.handle('quit-and-install', () => {
  autoUpdater.quitAndInstall();
});
