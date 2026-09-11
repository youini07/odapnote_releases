import { createPdfIndex } from './dist-electron/pdfAnalyzer.js';
import * as database from './dist-electron/database.js';
import * as path from 'path';
import * as fs from 'fs';

async function run() {
  const pdfPath = 'C:\\Users\\youin\\OneDrive\\문서\\카카오톡 받은 파일\\자이스토리 고2 대수 (2026년) - 문제_opt.pdf';
  console.log('Starting automated background analysis for:', pdfPath);
  
  if (!fs.existsSync(pdfPath)) {
    console.error('File not found!');
    return;
  }

  const fileName = path.basename(pdfPath, '.pdf');
  const cleanName = fileName.replace(/_opt$/, '').replace(/_문제$/, '').replace(/_정답$/, '');
  const wId = `wb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  const workbook = {
    id: wId,
    name: cleanName,
    fileName: path.basename(pdfPath),
    filePath: pdfPath,
    type: 'student',
    analyzedAt: new Date().toISOString(),
    totalQuestions: 0,
    status: 'analyzing',
    lastAnalyzedPage: 0
  };
  
  database.saveWorkbook(workbook);

  const onProgress = (msg, pct) => console.log(`[Progress] ${pct.toFixed(1)}% : ${msg}`);
  
  try {
    const questions = await createPdfIndex(pdfPath, wId, 'student', onProgress);
    console.log('Success, found questions:', questions.length);
    
    workbook.status = 'completed';
    workbook.totalQuestions = questions.length;
    database.saveWorkbook(workbook);
    console.log('Workbook saved to database as completed.');
  } catch (err) {
    console.error('Error in createPdfIndex:', err);
    workbook.status = 'error';
    database.saveWorkbook(workbook);
  } finally {
    const { app } = await import('electron');
    app.quit();
  }
}

run();
