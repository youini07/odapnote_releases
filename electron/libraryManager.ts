import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { getWorkbooks, saveWorkbook, getQuestions, saveQuestions, getDataDir, getQuestionsImageDir } from './database.js';

/**
 * 문제집 내보내기 (Export)
 * @param workbookId 문제집 ID
 * @param savePath 저장할 zip 파일 (.odapbk) 경로
 */
export async function exportWorkbook(workbookId: string, savePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const workbooks = getWorkbooks();
    const workbook = workbooks.find(w => w.id === workbookId);
    
    if (!workbook) {
      return { success: false, error: '문제집을 찾을 수 없습니다.' };
    }

    const questions = getQuestions(workbookId);
    const imageDir = getQuestionsImageDir(workbookId);

    const zip = new AdmZip();

    // 1. 메타데이터 추가 (workbook.json)
    zip.addFile('workbook.json', Buffer.from(JSON.stringify(workbook, null, 2), 'utf-8'));

    // 2. 문제 데이터 추가 (questions.json)
    zip.addFile('questions.json', Buffer.from(JSON.stringify(questions, null, 2), 'utf-8'));

    // 3. 이미지 폴더 추가
    if (fs.existsSync(imageDir)) {
      zip.addLocalFolder(imageDir, 'images');
    }

    // 4. zip 파일 생성
    zip.writeZip(savePath);

    return { success: true };
  } catch (error: any) {
    console.error('Export failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 문제집 가져오기 (Import)
 * @param filePath 가져올 zip 파일 (.odapbk) 경로
 */
export async function importWorkbook(filePath: string): Promise<{ success: boolean; error?: string; workbookId?: string }> {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: '파일이 존재하지 않습니다.' };
    }

    const zip = new AdmZip(filePath);
    
    const workbookEntry = zip.getEntry('workbook.json');
    const questionsEntry = zip.getEntry('questions.json');
    
    if (!workbookEntry || !questionsEntry) {
      return { success: false, error: '올바른 오답노트 백업 파일(.odapbk)이 아닙니다.' };
    }

    const workbookData = JSON.parse(workbookEntry.getData().toString('utf-8'));
    const questionsData = JSON.parse(questionsEntry.getData().toString('utf-8'));

    // ID 충돌 방지를 위해 새로운 ID 부여 (선택사항이나, 같은 워크북 중복 방지 위해 덮어쓰거나 새로 발급)
    // 여기서는 원본 그대로 복원하되, 이미 같은 ID가 있으면 덮어씁니다. (세이브 파일 개념이므로)
    const workbookId = workbookData.id;
    saveQuestions(workbookId, questionsData);

    // 이미지 추출 (기존 폴더가 있으면 지우거나 덮어쓰기)
    const imageDir = getQuestionsImageDir(workbookId);
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }
    
    // zip 내부의 images 폴더 안의 파일들을 추출
    const zipEntries = zip.getEntries();
    zipEntries.forEach(entry => {
      if (entry.entryName.startsWith('images/') && !entry.isDirectory) {
        // 'images/' 접두사 제거
        const fileName = entry.entryName.substring('images/'.length);
        const extractPath = path.join(imageDir, fileName);
        fs.writeFileSync(extractPath, entry.getData());
      }
    });

    // 질문 객체의 imagePath 업데이트 (다른 PC에서 가져왔을 경우 절대 경로가 달라지므로)
    const updatedQuestions = questionsData.map((q: any) => {
      if (q.imagePath) {
        const fileName = path.basename(q.imagePath);
        q.imagePath = path.join(imageDir, fileName);
      }
      if (q.answerImagePath) {
        const answerFileName = path.basename(q.answerImagePath);
        q.answerImagePath = path.join(imageDir, answerFileName);
      }
      return q;
    });

    // 워크북 객체의 커스텀 표지 및 목차 이미지 경로 업데이트
    if (workbookData.customCoverImagePath) {
      workbookData.customCoverImagePath = path.join(imageDir, path.basename(workbookData.customCoverImagePath));
    }
    if (workbookData.tocImagePath) {
      workbookData.tocImagePath = path.join(imageDir, path.basename(workbookData.tocImagePath));
    }

    saveWorkbook(workbookData);
    saveQuestions(workbookId, updatedQuestions);

    return { success: true, workbookId };
  } catch (error: any) {
    console.error('Import failed:', error);
    return { success: false, error: error.message };
  }
}
