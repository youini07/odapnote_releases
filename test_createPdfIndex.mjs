import { createPdfIndex } from './dist-electron/pdfAnalyzer.js';

async function run() {
  const pdfPath = 'C:\\Users\\youin\\OneDrive\\문서\\카카오톡 받은 파일\\자이스토리 고2 대수 (2026년) - 문제_opt.pdf';
  console.log('Testing createPdfIndex with:', pdfPath);
  
  const onProgress = (msg, pct) => console.log(`[Progress] ${pct}% : ${msg}`);
  
  try {
    const questions = await createPdfIndex(pdfPath, 'test_wb_id', 'student', onProgress);
    console.log('Success, found questions:', questions.length);
  } catch (err) {
    console.error('Error in createPdfIndex:', err);
  }
}

run();
