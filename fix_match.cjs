const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\youin\\OneDrive\\바탕 화면\\오답노트\\문제집이미지';
const workbooksPath = path.join(dir, 'workbooks.json');

let workbooks = [];
try {
  workbooks = JSON.parse(fs.readFileSync(workbooksPath, 'utf8'));
} catch (e) {
  console.error('Failed to read workbooks:', e);
  process.exit(1);
}

function normalizeNumber(num) {
  let cleaned = String(num).replace(/^P\d+[_ \-]/i, '');
  cleaned = cleaned.replace(/^[^a-zA-Z0-9가-힣]+/, '').replace(/[^a-zA-Z0-9가-힣]+$/, '');
  cleaned = cleaned.replace(/번$/g, '').trim();
  if (/^\d+$/.test(cleaned)) {
    return cleaned.padStart(4, '0');
  }
  return cleaned;
}

let updated = 0;

for (const wb of workbooks) {
  if (wb.type === 'student' && wb.pairedWorkbookId) {
    const studentQsPath = path.join(dir, `questions_${wb.id}.json`);
    const teacherQsPath = path.join(dir, `questions_${wb.pairedWorkbookId}.json`);
    
    if (fs.existsSync(studentQsPath) && fs.existsSync(teacherQsPath)) {
      const studentQs = JSON.parse(fs.readFileSync(studentQsPath, 'utf8'));
      const teacherQs = JSON.parse(fs.readFileSync(teacherQsPath, 'utf8'));
      
      const teacherWb = workbooks.find(w => w.id === wb.pairedWorkbookId);
      if (!teacherWb) continue;
      
      let changed = false;
      for (const sq of studentQs) {
        const matchingAnswer = teacherQs.find(tq => normalizeNumber(tq.number) === normalizeNumber(sq.number));
        if (matchingAnswer) {
          if (teacherWb.type === 'teacher_quick') {
            sq.answerText = matchingAnswer.answerText;
            changed = true;
          } else {
            sq.answerImagePath = matchingAnswer.imagePath;
            changed = true;
          }
        }
      }
      
      if (changed) {
        fs.writeFileSync(studentQsPath, JSON.stringify(studentQs, null, 2), 'utf8');
        console.log(`Updated ${wb.name} with matched answers.`);
        updated++;
      }
    }
  }
}

console.log(`Done. Updated ${updated} workbooks.`);
