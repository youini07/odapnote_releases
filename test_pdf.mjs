import * as fs from 'fs';
import { pdf } from 'pdf-to-img';

async function testPdf() {
  try {
    const pdfPath = 'C:\\Users\\youin\\OneDrive\\문서\\카카오톡 받은 파일\\자이스토리 고2 대수 (2026년) - 문제_opt.pdf';
    console.log('Testing PDF Path:', pdfPath);
    if (!fs.existsSync(pdfPath)) {
      console.error('File does not exist!');
      return;
    }
    console.log('File exists, size:', fs.statSync(pdfPath).size);
    const document = await pdf(pdfPath, { scale: 2 });
    console.log('PDF document loaded, pages:', document.length);
    let i = 0;
    for await (const page of document) {
        console.log('Yielded page', ++i);
        break; // just test the first page
    }
  } catch (error) {
    console.error('Error during PDF processing:', error);
  }
}

testPdf();
