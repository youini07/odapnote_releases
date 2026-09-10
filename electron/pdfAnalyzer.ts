// ================================================================
// pdfAnalyzer.ts - Gemini AI 기반 지연 로딩(Lazy Loading) PDF 분석기
// ================================================================

import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import { Question, AIQuestionResult } from './types.js';
import { getQuestionImagePath, saveQuestions, getAppSettings, getDataDirectory } from './database.js';

let sharpModule: any = null;
async function getSharp() {
  if (!sharpModule) {
    sharpModule = (await import('sharp')).default;
  }
  return sharpModule;
}

/**
 * Gemini 모델 호출 헬퍼 (사용자가 지정한 최신 gemini-3.8-flash 우선 호출)
 */
async function callGemini(ai: GoogleGenAI, contents: any[]) {
  // 최신 2026 모델 라인업으로 우선순위 재설정
  const models = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-1.5-flash'];
  let lastErr: any = null;
  for (const model of models) {
    try {
      console.log(`[Gemini] ${model} 모델에 이미지 분석 요청 중...`);
      const response = await ai.models.generateContent({
        model,
        contents,
      });
      console.log(`[Gemini] 분석 완료 (성공)`);
      return response;
    } catch (err: any) {
      lastErr = err;
      const msg = err?.message || String(err);
      console.warn(`[Gemini] ${model} 모델 호출 실패:`, msg);
      // 모델 이름이 잘못되었거나 권한이 없는 경우(400, 403, 404 등) 다음 모델 시도
      if (msg.includes('404') || msg.includes('not found') || msg.includes('NOT_FOUND') || msg.includes('unsupported') || msg.includes('400')) {
        console.warn(`[Gemini] ${model} 접근 불가, 다음 모델 시도 중...`);
        continue;
      }
      // 그 외 치명적 에러는 즉시 중단
      throw err;
    }
  }
  throw lastErr;
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * PDF 사전 등록 (순차적 이미지 추출 및 크롭)
 * PDF를 한 페이지씩 순차적으로 읽어 해당 페이지의 모든 문제를 찾아 좌표를 추출하고
 * 곧바로 이미지를 잘라 문제번호로 저장합니다. 
 * AI 서버 부하를 막기 위해 페이지 사이에 딜레이를 줍니다.
 */
export async function createPdfIndex(
  pdfPath: string,
  workbookId: string,
  type: 'student' | 'teacher',
  onProgress: (msg: string, percent: number) => void
): Promise<Question[]> {
  const settings = getAppSettings();
  if (!settings.geminiApiKey) throw new Error('API 키가 없습니다.');
  
  onProgress('PDF 문서를 분석하여 문제 색인 및 이미지 추출을 준비 중입니다...', 5);
  
  const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });
  const typeLabel = type === 'student' ? '학생용 문제집' : '교사용 답안지';
  
  const { pdf } = await import('pdf-to-img');
  const sharp = await getSharp();
  
  const tempDir = path.join(getDataDirectory(), 'temp', workbookId);
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const allQuestions: Question[] = [];
  
  // PDF를 페이지별로 변환
  const pdfBuffer = fs.readFileSync(pdfPath);
  const document = await pdf(pdfBuffer, { scale: 3 });
  
  let pageCounter = 0;
  const totalPages = document.length || 100; // fallback to 100 if undefined
  for await (const pageImageBuffer of document) {
    pageCounter++;
    const percent = Math.floor((pageCounter / totalPages) * 95);
    onProgress(`PDF ${pageCounter}/${totalPages}페이지 분석 및 이미지 크롭 중...`, percent);
    
    const pageImgPath = path.join(tempDir, `page_${pageCounter}.png`);
    fs.writeFileSync(pageImgPath, pageImageBuffer);
    const metadata = await sharp(pageImgPath).metadata();
    const [pageWidth, pageHeight] = [metadata.width || 0, metadata.height || 0];

    const base64Img = pageImageBuffer.toString('base64');
    const prompt = `
이 이미지는 ${typeLabel}의 ${pageCounter}페이지입니다.
이 페이지에 있는 '모든 문제 번호'와 '해당 문제의 전체 영역(bbox)'을 찾아주세요.

[영역(bbox) 추출 규칙]
1. bbox는 '문제 번호', '문제 질문 텍스트', '보기(객관식 1~5번 등)', '관련 이미지/그래프'를 모두 포함하는 넉넉하지만 타이트한 박스여야 합니다.
2. 문제 번호가 반드시 bbox 영역 내(주로 좌상단)에 포함되어야 합니다.
3. 위아래로 불필요한 공백이나 다른 문제의 내용이 포함되지 않도록 타이트하게 잡아주세요 (특히 2단, 3단 편집된 문서에서 다른 단을 침범하지 않도록 주의).

[문제 번호 규칙]
1. 문제 번호가 단순한 숫자가 아닐 수 있습니다 (예: "0001", "1-01").
2. 만약 문제 번호 뒤에 '번'이라는 글자가 있다면 제거해주세요. (예: "0001번" -> "0001", "1번" -> "1")

반드시 순수 JSON 형식으로 다음 구조에 맞춰 반환하세요.
{
  "questions": [
    {
      "number": "0015",
      "bbox": { "x": 0.1, "y": 0.2, "width": 0.4, "height": 0.15 }
    }
  ]
}
x, y, width, height는 페이지 전체 너비/높이 대비 비율(0~1)입니다.
규칙: 모든 문제를 빠짐없이 적어주세요.
`;

    try {
      const response = await callGemini(ai, [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/png', data: base64Img } },
            { text: prompt }
          ],
        },
      ]);

      let cleanText = (response.text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      
      // JSON 형태 외의 찌꺼기 텍스트가 있을 수 있으므로 중괄호 블록만 추출
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanText = jsonMatch[0];
      }
      
      const parsed = JSON.parse(cleanText);

      if (parsed.questions && Array.isArray(parsed.questions)) {
        for (const aq of parsed.questions) {
          // 문제 번호 정규화 (4자리 패딩 및 '번' 제거)
          let normalizedNumber = String(aq.number).replace(/번$/g, '').trim();
          if (/^\d+$/.test(normalizedNumber)) {
            normalizedNumber = normalizedNumber.padStart(4, '0');
          }

          const left = Math.max(0, Math.floor(aq.bbox.x * pageWidth));
          const top = Math.max(0, Math.floor(aq.bbox.y * pageHeight));
          const width = Math.min(Math.floor(aq.bbox.width * pageWidth), pageWidth - left);
          const height = Math.min(Math.floor(aq.bbox.height * pageHeight), pageHeight - top);

          if (width <= 0 || height <= 0) continue;

          const outputPath = getQuestionImagePath(workbookId, normalizedNumber);
          await sharp(pageImgPath).extract({ left, top, width, height }).png().toFile(outputPath);

          allQuestions.push({
            id: `${workbookId}_q${normalizedNumber}`,
            workbookId,
            number: normalizedNumber,
            page: pageCounter,
            type: '미분류',
            imagePath: outputPath,
            bbox: aq.bbox
          });
        }
      }
    } catch (e) {
      console.error(`[SequentialExtractor] ${pageCounter}페이지 분석/크롭 실패:`, e);
      // 실패해도 다음 페이지로 넘어가도록 처리
    }

    // 임시 파일 삭제
    if (fs.existsSync(pageImgPath)) fs.unlinkSync(pageImgPath);
    
    // AI Rate Limit 방지를 위한 대기
    await delay(1500);
  }
  
  // 임시 폴더 삭제
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });

  saveQuestions(workbookId, allQuestions);
  onProgress(`모든 추출 완료: ${allQuestions.length}문제 처리됨`, 100);
  return allQuestions;
}

/**
 * Phase 2 (구형): 온디맨드 문제 이미지 추출 (더 이상 사용하지 않음)
 * - 이미 사전 단계(createPdfIndex)에서 전체 추출이 완료되므로, 배열을 그대로 반환합니다.
 */
export async function extractAndCropQuestions(
  workbookId: string,
  pdfPath: string,
  targetQuestions: Question[],
  type: 'student' | 'teacher'
): Promise<Question[]> {
  // 이미 크롭되어 저장된 이미지들을 로컬에서 바로 사용합니다.
  return targetQuestions;
}
