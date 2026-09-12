// ================================================================
// exporter.ts - 오답노트를 PDF / HWPX 파일로 내보내기
//
// 양식 (첨부 이미지 기반):
// - 헤더: 이름 + 교재명 + 로고
// - 2×2 그리드 (한 페이지 4문제)
// - 각 셀: Page.번호 라벨 → 문제 이미지 → 풀이 공간
// - 답안지도 동일 순서로 별도 생성
// ================================================================

import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { Question, ExportOptions } from './types.js';
import { getAppSettings } from './database.js';

// A4, B4 Sizes will be determined dynamically
// 색상 상수
const COLOR_BLACK = '#000000';
const COLOR_GRAY = '#666666';
const COLOR_LIGHT_GRAY = '#cccccc';
const COLOR_HEADER_BG = '#f0f0f0';
const COLOR_QUESTION_NUMBER = '#e74c3c'; // 빨간색 문제번호 (예시 이미지 참고)

/**
 * 오답노트 PDF 생성
 * 
 * @param questions - 선택된 문제 목록 (순서대로)
 * @param studentName - 학생 이름
 * @param workbookName - 문제집 이름
 * @param outputPath - 출력 파일 경로
 * @param isAnswerSheet - true이면 답안지, false이면 문제지
 */
export async function generatePdf(
  questions: Question[],
  studentName: string,
  workbookName: string,
  outputPath: string,
  isAnswerSheet: boolean = false,
  questionsPerPageOverride?: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const settings = getAppSettings();
      const marginPt = 15 * 2.83465; // 고정 15mm (1mm = 2.83465pt)
      
      const doc = new PDFDocument({
        size: settings.paperSize,
        margins: { top: marginPt, bottom: marginPt, left: marginPt, right: marginPt },
        info: {
          Title: `${workbookName}_${studentName}${isAnswerSheet ? '_답안지' : ''}`,
          Author: '수학전문학원 오답노트',
        }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // 한글 폰트 (시스템 폰트 사용)
      const fontPath = getFontPath();
      if (fontPath) {
        doc.registerFont('Korean', fontPath);
        doc.font('Korean');
      }

      const questionsPerPage = questionsPerPageOverride || settings.questionsPerPage || 4;
      const totalPages = Math.ceil(questions.length / questionsPerPage);

      for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        if (pageIdx > 0) doc.addPage();

        const pageQuestions = questions.slice(
          pageIdx * questionsPerPage,
          (pageIdx + 1) * questionsPerPage
        );

        // 헤더 그리기
        drawHeader(doc, studentName, workbookName, isAnswerSheet, marginPt, settings.academyLogoPath);

        // 그리드로 문제 배치
        drawQuestionGrid(doc, pageQuestions, isAnswerSheet, settings, questionsPerPageOverride);
      }

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 헤더 영역 그리기
 * 양식: 이름 : {학생이름}  |  교재 : {문제집이름}  | [로고]
 */
function drawHeader(
  doc: PDFKit.PDFDocument, 
  studentName: string, 
  workbookName: string,
  isAnswerSheet: boolean,
  marginPt: number,
  academyLogoPath?: string
): void {
  const headerHeight = 50;
  const contentWidth = doc.page.width - marginPt * 2;

  // 헤더 배경
  doc.rect(marginPt, marginPt, contentWidth, headerHeight)
     .stroke(COLOR_BLACK);

  // 이름
  doc.fontSize(12)
     .fillColor(COLOR_BLACK)
     .text(`이름 :  ${studentName}`, marginPt + 10, marginPt + 8, {
       width: contentWidth - 20,
     });

  // 교재명
  const subtitle = isAnswerSheet ? '[답안지]' : '';
  doc.fontSize(12)
     .text(`교재 :  ${workbookName} ${subtitle}`, marginPt + 10, marginPt + 28, {
       width: contentWidth - 20,
     });

  // 커스텀 학원 로고 렌더링 (설정된 경우)
  if (academyLogoPath && fs.existsSync(academyLogoPath)) {
    try {
      // 권장 가로 폭을 약 150pt로 제한, 높이는 헤더에 맞게 비례 축소 (최대 높이 40pt)
      const logoMaxWidth = 250;
      const logoMaxHeight = 44;
      
      doc.image(academyLogoPath, marginPt + contentWidth - logoMaxWidth - 3, marginPt + 3, {
        fit: [logoMaxWidth, logoMaxHeight],
        align: 'right',
        valign: 'center'
      });
    } catch (e) {
      console.error('[Exporter] 로고 이미지 렌더링 실패:', e);
    }
  }
}

/**
 * 2×2 그리드로 문제 배치
 * 각 셀: Page.{번호} 라벨 + 문제 이미지 + 풀이 공간
 */
function drawQuestionGrid(
  doc: PDFKit.PDFDocument, 
  questions: Question[],
  isAnswerSheet: boolean,
  settings: any,
  questionsPerPageOverride?: number
): void {
  const marginPt = 15 * 2.83465; // 고정 15mm
  const headerHeight = 50;
  const gridTop = marginPt + headerHeight;
  const contentWidth = doc.page.width - marginPt * 2;
  const contentHeight = doc.page.height - marginPt * 2 - headerHeight;

  const questionsPerPage = questionsPerPageOverride || settings.questionsPerPage || 4;
  
  let cols = 2;
  let rows = 2;
  if (questionsPerPage === 2) {
    cols = 1;
    rows = 2;
  } else if (questionsPerPage === 6) {
    cols = 2;
    rows = 3;
  }

  const cellWidth = contentWidth / cols;
  const cellHeight = contentHeight / rows;
  const cellPadding = 5;
  const pageLabelHeight = 18;

  for (let i = 0; i < questions.length && i < questionsPerPage; i++) {
    const q = questions[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellX = marginPt + col * cellWidth;
    const cellY = gridTop + row * cellHeight;

    // 셀 테두리
    doc.rect(cellX, cellY, cellWidth, cellHeight)
       .stroke(COLOR_BLACK);

    // Page 라벨
    doc.rect(cellX, cellY, cellWidth, pageLabelHeight)
       .fill(COLOR_HEADER_BG)
       .stroke(COLOR_BLACK);

    doc.fillColor(COLOR_BLACK)
       .fontSize(9)
       .text(`Page.${q.page}`, cellX + 5, cellY + 4, {
         width: cellWidth - 10,
       });

    // 문제 이미지 영역
    const imgY = cellY + pageLabelHeight + cellPadding;
    const imgAreaWidth = cellWidth - cellPadding * 2;
    // 문제 이미지는 셀 높이의 약 60%를 차지하고, 나머지는 풀이 공간
    const imgAreaHeight = (cellHeight - pageLabelHeight) * (isAnswerSheet ? 0.85 : 0.55);

    // 이미지 경로 결정 (답안지면 answerImagePath 사용)
    const imagePath = isAnswerSheet 
      ? (q.answerImagePath || q.imagePath) 
      : q.imagePath;

    if (imagePath && fs.existsSync(imagePath)) {
      try {
        // 이미지를 셀 크기에 맞춰 배치
        doc.image(imagePath, cellX + cellPadding, imgY, {
          fit: [imgAreaWidth, imgAreaHeight],
        });
      } catch (imgErr) {
        // 이미지 로드 실패 시 텍스트로 대체
        doc.fillColor(COLOR_GRAY)
           .fontSize(8)
           .text(`[이미지 로드 실패: 문제 ${q.number}]`, cellX + cellPadding, imgY);
      }
    } else {
      // 이미지가 없는 경우 텍스트 내용 표시
      doc.fillColor(COLOR_BLACK)
         .fontSize(10);
      
      // 문제 번호 (빨간색 강조)
      doc.fillColor(COLOR_QUESTION_NUMBER)
         .fontSize(12)
         .text(`${q.number}`, cellX + cellPadding, imgY, { continued: true });
      
      doc.fillColor(COLOR_BLACK)
         .fontSize(9)
         .text(`  ${q.textContent || ''}`, {
           width: imgAreaWidth - 30,
         });
    }
  }
}

/**
 * 시스템에서 한글 폰트 경로 찾기
 * Windows 환경에서 맑은 고딕을 우선 사용
 */
function getFontPath(): string | null {
  const candidates = [
    'C:\\Windows\\Fonts\\malgun.ttf',     // 맑은 고딕
    'C:\\Windows\\Fonts\\NanumGothic.ttf', // 나눔고딕
    'C:\\Windows\\Fonts\\gulim.ttc',       // 굴림
  ];
  
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * 오답노트 + 답안지를 한번에 생성
 * 
 * @returns { notePath: string, answerPath: string | null }
 */
export async function generateOdapNoteFiles(
  questions: Question[],
  studentName: string,
  workbookName: string,
  outputDir: string,
  options: ExportOptions
): Promise<{ notePath: string; answerPath: string | null }> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const baseName = options.suffix ? `${workbookName}_${studentName}_${options.suffix}` : `${workbookName}_${studentName}`;
  
  // 오답노트 (문제지) 생성
  const notePath = path.join(outputDir, `${baseName}.pdf`);
  await generatePdf(questions, studentName, workbookName, notePath, false, options.questionsPerPage);

  // 답안지 생성 (답안 이미지가 있는 문제가 하나라도 있으면)
  let answerPath: string | null = null;
  if (options.includeAnswers) {
    const hasAnswers = questions.some(q => q.answerImagePath);
    if (hasAnswers) {
      answerPath = path.join(outputDir, `${baseName}_답안지.pdf`);
      await generatePdf(questions, studentName, workbookName, answerPath, true, options.questionsPerPage);
    }
  }

  return { notePath, answerPath };
}
