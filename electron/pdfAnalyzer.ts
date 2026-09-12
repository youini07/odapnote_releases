// ================================================================
// pdfAnalyzer.ts - Gemini AI 기반 PDF 분석기 (개선 버전)
//
// 개선 사항:
// 1. 같은 단(column)의 문제들을 동일 너비로 crop → 텍스트 크기 통일
// 2. 빈 이미지 감지 (sharp stats) → 인식 실패 자동 필터링
// 3. 문제 번호 연속성 검사 → 누락 구간 강화 프롬프트 재분석
// ================================================================

import { Path2D } from 'path2d';
import { DOMMatrix } from 'canvas';

if (typeof global !== 'undefined') {
  if (!(global as any).Path2D) {
    (global as any).Path2D = Path2D;
  }
  if (!(global as any).DOMMatrix) {
    (global as any).DOMMatrix = DOMMatrix;
  }
}

import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import { Question, AIQuestionResult } from './types.js';
import { getQuestionImagePath, saveQuestions, getQuestions, getAppSettings, getDataDirectory, getWorkbooks, saveWorkbook } from './database.js';

// 취소 토큰 관리용
export const activeAnalyses: Record<string, { abort: boolean, workbookId?: string }> = {};

// 빈 이미지 판정 임계값 (채널 표준편차 평균)
// 왜 5? 거의 흰색인 빈 공간은 stddev가 0~3 수준, 실제 내용이 있으면 20 이상
const BLANK_IMAGE_THRESHOLD = 5;

// 같은 단(column)으로 판정하는 x좌표 차이 임계값 (페이지 너비 대비 비율)
// 왜 0.08? 같은 단에 속한 문제들의 x좌표는 보통 1~5% 이내로 유사
const COLUMN_GROUP_THRESHOLD = 0.08;

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
      if (msg.includes('404') || msg.includes('not found') || msg.includes('NOT_FOUND') || msg.includes('unsupported') || msg.includes('400')) {
        console.warn(`[Gemini] ${model} 접근 불가, 다음 모델 시도 중...`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * crop된 이미지가 빈 공간(거의 균일한 색상)인지 검사
 * 왜 필요? AI가 문제 번호를 잘못 인식하여 빈 영역을 잡았을 때 자동으로 걸러내기 위함
 */
async function isBlankImage(imagePath: string): Promise<boolean> {
  try {
    const sharp = await getSharp();
    const stats = await sharp(imagePath).stats();
    // 모든 채널의 표준편차가 매우 낮으면 빈 이미지로 판단
    const avgStdDev = stats.channels.reduce(
      (sum: number, ch: { stdev: number }) => sum + ch.stdev, 0
    ) / stats.channels.length;
    
    console.log(`[BlankCheck] ${path.basename(imagePath)}: 평균 stddev = ${avgStdDev.toFixed(2)}`);
    return avgStdDev < BLANK_IMAGE_THRESHOLD;
  } catch (e) {
    console.error(`[BlankCheck] 이미지 검사 실패:`, e);
    return false;
  }
}

/**
 * 같은 페이지 내 문제들을 단(column) 기준으로 그룹핑하고,
 * 같은 단의 모든 문제 bbox를 동일한 너비(단 전체 너비)로 확장
 * 
 * 왜 필요? AI가 문제 내용에 맞게 타이트하게 bbox를 잡으면,
 * 짧은 문제(예: "0001 A(3),B(7)")의 이미지가 작아서
 * 오답노트에서 fit할 때 텍스트가 확대되어 보이는 문제를 해결
 * 
 * 같은 단이면 동일 너비 → 동일 텍스트 스케일 보장
 */
function normalizeColumnWidths(
  bboxes: Array<{ number: string; bbox: { x: number; y: number; width: number; height: number } }>
): Array<{ number: string; bbox: { x: number; y: number; width: number; height: number } }> {
  if (bboxes.length === 0) return bboxes;

  // 1단계: x좌표 기준으로 문제들을 단(column)으로 그룹핑
  const sorted = [...bboxes].sort((a, b) => a.bbox.x - b.bbox.x);
  const columns: Array<typeof bboxes> = [];
  
  for (const item of sorted) {
    let assigned = false;
    for (const col of columns) {
      const colX = col[0].bbox.x;
      if (Math.abs(item.bbox.x - colX) < COLUMN_GROUP_THRESHOLD) {
        col.push(item);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      columns.push([item]);
    }
  }

  // 2단계: 각 단의 경계를 명확하게 지정하여 모든 문제의 너비를 완벽히 통일
  // 단을 x좌표 순으로 정렬
  columns.sort((a, b) => Math.min(...a.map(q => q.bbox.x)) - Math.min(...b.map(q => q.bbox.x)));

  const normalized: typeof bboxes = [];
  
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    // 단의 왼쪽 경계: 현재 단에서 가장 작은 x값
    const colLeft = Math.min(...col.map(q => q.bbox.x));
    
    // 단의 오른쪽 경계 결정:
    // 1. AI가 반환한 해당 단 문제들의 실제 오른쪽 끝(x + width) 중 최대값 사용
    // 2. 다음 단이 있으면 다음 단 시작점 직전으로 제한 (단 침범 방지)
    // 3. 마지막 단이면 페이지 끝(1.0)으로 제한
    const maxAiRight = Math.max(...col.map(q => q.bbox.x + q.bbox.width));
    let colRight: number;
    if (i < columns.length - 1) {
      const nextColLeft = Math.min(...columns[i + 1].map(q => q.bbox.x));
      // [수정] AI 영역과 다음 단의 중간점을 쓰지 않고, 다음 단이 시작하기 직전(0.5% 여백)까지 가로 영역을 최대로 확보하여 우측 글씨 잘림 완벽 방지
      colRight = nextColLeft - 0.005;
      // 만약 AI가 이미 다음 단을 넘어서 크게 잡았다면 최소한 AI가 잡은 만큼은 보장하되 겹침 방지
      colRight = Math.max(colRight, Math.min(maxAiRight, nextColLeft - 0.001));
    } else {
      // 마지막 단: AI가 잡은 오른쪽 끝에 기존(2%)보다 더 넉넉한 여유(5%)를 더함
      colRight = Math.min(maxAiRight + 0.05, 1.0);
    }

    // 단 전체 너비
    const colWidth = colRight - colLeft;

    console.log(`[ColumnNorm] 단 ${i+1}: x=${colLeft.toFixed(3)}, right=${colRight.toFixed(3)}, width=${colWidth.toFixed(3)}, 문제 ${col.length}개`);

    for (const item of col) {
      normalized.push({
        number: item.number,
        bbox: {
          x: colLeft,
          y: item.bbox.y,
          width: colWidth,
          height: item.bbox.height
        }
      });
    }
  }

  return normalized;
}

/**
 * 문제 번호에서 문자(prefix)와 숫자 부분을 분리합니다.
 * 예: "A01" -> { prefix: "A", num: 1, padLength: 2, original: "A01" }
 */
function parseNumberFormat(numStr: string) {
  const match = numStr.match(/^([a-zA-Z가-힣\s-]*?)(\d+)$/);
  if (!match) return null;
  return {
    prefix: match[1],
    num: parseInt(match[2], 10),
    padLength: match[2].length,
    original: numStr
  };
}

/**
 * 숫자형 및 영문혼합 문제 번호(A01, B01 등)의 연속성을 검사하여 누락된 번호와 해당 페이지 범위를 반환
 */
function findMissingNumbers(questions: Question[]): { missing: string[]; pages: number[] } {
  // 접두사(prefix)별로 그룹핑
  const groups: Record<string, Array<{ num: number; padLength: number; page: number; original: string }>> = {};
  
  for (const q of questions) {
    const parsed = parseNumberFormat(q.number);
    if (parsed) {
      if (!groups[parsed.prefix]) groups[parsed.prefix] = [];
      groups[parsed.prefix].push({
        num: parsed.num,
        padLength: parsed.padLength,
        page: q.page,
        original: parsed.original
      });
    }
  }

  const missing: string[] = [];
  const pages: Set<number> = new Set();

  for (const prefix of Object.keys(groups)) {
    const list = groups[prefix].sort((a, b) => a.num - b.num);
    if (list.length < 2) continue;

    for (let i = 0; i < list.length - 1; i++) {
      const curr = list[i];
      const next = list[i + 1];
      const gap = next.num - curr.num;

      // 간격이 1보다 크고 10 이하일 때 누락으로 간주
      if (gap > 1 && gap <= 10) {
        for (let n = curr.num + 1; n < next.num; n++) {
          const missingStr = prefix + String(n).padStart(curr.padLength, '0');
          missing.push(missingStr);
        }
        for (let p = curr.page; p <= next.page; p++) {
          pages.add(p);
        }
      }
    }
  }

  return { missing, pages: Array.from(pages).sort((a, b) => a - b) };
}

/**
 * 기본 AI 프롬프트 생성
 */
function buildPrompt(typeLabel: string, pageNumber: number, extraHints?: string, startNumber?: string): string {
  let prompt = `
이 이미지는 ${typeLabel}의 ${pageNumber}페이지입니다.
이 페이지에 있는 '모든 문제 번호'와 '해당 문제의 전체 영역(bbox)'을 찾아주세요.

[다단(Multi-Column) 레이아웃 인식 규칙 - 최우선]
이 페이지는 1단 또는 2단(좌/우) 레이아웃일 수 있습니다.
1. 먼저 페이지의 레이아웃 구조를 파악하세요. 좌측 단과 우측 단에 각각 다른 문제들이 배치되어 있을 수 있습니다.
2. 각 문제의 bbox는 **자신이 속한 단(column) 내에서만** 설정해야 합니다. 절대로 다른 단의 영역을 침범하면 안 됩니다.
3. 2단 구성일 경우: 좌측 단 문제의 bbox width는 대략 0.45~0.5 이내, 우측 단도 마찬가지입니다. 한 문제의 width가 0.7 이상이 되면 안 됩니다(1단 전체 폭 문제가 아닌 한).
4. 유형 설명이나 개념 정리 등 '문제 번호가 없는 영역'은 무시하세요. 오직 문제 번호가 있는 실제 문제만 추출합니다.

[영역(bbox) 추출 핵심 규칙]
1. bbox는 '문제 번호'부터 시작하여, 해당 문제에 속하는 '텍스트', '보기', '그림', '그래프'를 모두 포함하는 박스여야 합니다.
2. 만약 문제에 그림/도형이 포함되어 있다면 그 그림까지 반드시 bbox에 포함시키세요. 그림이 문제 번호 옆이나 아래에 있을 수 있습니다.
3. [중요] bbox의 아래쪽 경계는 해당 문제의 마지막 텍스트나 도형이 끝나는 지점에 딱 맞게(타이트하게) 잡되, 다음 문제 전까지의 불필요한 빈 공간은 최소화하세요.
4. [중요] bbox의 오른쪽 경계는 해당 단 내에서 문제 내용(텍스트, 보기, 그림 등)이 끝나는 지점까지 충분히 넓게 잡아주세요. 텍스트나 보기가 오른쪽에서 잘리지 않도록 주의하세요.
5. bbox의 x 좌표는 문제 번호의 왼쪽 시작점, width는 해당 단 내 문제 내용의 전체 너비를 포함해야 합니다.

[빈 공간 및 오인식 방지 규칙]
1. bbox 안에 반드시 '문제 번호'가 명확하게 보여야 합니다.
2. 문제 번호가 없는 '유형 설명', '개념 정리', '공식', '페이지 번호', '장식' 등은 절대 추출하지 마세요.

[문제 번호 추출 규칙]
1. 문제 번호는 보통 문단의 맨 왼쪽(좌상단)에 위치합니다. 
2. 문제 번호 뒤에 '번'이라는 글자가 있다면 제거해주세요. (예: "0001번" -> "0001", "1번" -> "1")
3. 단순한 숫자가 아닐 수 있습니다 (예: "1-01").
`;

  if (startNumber) {
    prompt += `\n[강력한 힌트: 문제 번호 형식 및 기준]
사용자가 입력한 기준 문제 번호는 "${startNumber}" 입니다.
이 문제집의 모든 문제 번호는 "${startNumber}" 와 같은 구조적 형식(알파벳 접두사, 0-패딩 자릿수 등)을 지니고 있으며, 순차적으로 증가합니다. 
(예를 들어 기준 번호가 A01 이라면, A02, A03... 이런 식의 번호가 계속 등장합니다.)
이 형식을 염두에 두고 빠짐없이 문제를 찾아주세요.\n`;
  }

  if (extraHints) {
    prompt += `\n${extraHints}\n`;
  }

  prompt += `
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
  return prompt;
}

/**
 * AI 응답에서 문제 목록 파싱
 */
function parseAiResponse(responseText: string): Array<{ number: string; bbox: { x: number; y: number; width: number; height: number } }> {
  let cleanText = (responseText || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  
  const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleanText = jsonMatch[0];
  }
  
  const parsed = JSON.parse(cleanText);
  
  if (parsed.questions && Array.isArray(parsed.questions)) {
    return parsed.questions;
  }
  return [];
}

/**
 * 단일 페이지를 AI로 분석하여 문제 목록을 추출하고 이미지를 crop하여 저장
 * 
 * 핵심: 같은 단(column)의 문제들은 동일 너비로 crop하여 텍스트 크기를 통일
 */
async function analyzeAndCropPage(
  ai: GoogleGenAI,
  pageImgPath: string,
  pageCounter: number,
  pageWidth: number,
  pageHeight: number,
  workbookId: string,
  typeLabel: string,
  extraHints?: string,
  startNumber?: string
): Promise<Question[]> {
  const sharp = await getSharp();
  const base64Img = fs.readFileSync(pageImgPath).toString('base64');
  const prompt = buildPrompt(typeLabel, pageCounter, extraHints, startNumber);

  const response = await callGemini(ai, [
    {
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'image/png', data: base64Img } },
        { text: prompt }
      ],
    },
  ]);

  const rawQuestions = parseAiResponse(response.text || '');
  
  // [핵심 개선] 같은 단의 문제들을 동일 너비로 정규화
  // 리사이즈 없이 원본 DPI를 유지하면서, 같은 단 내 crop 너비만 통일
  const normalizedQuestions = normalizeColumnWidths(rawQuestions);
  
  const pageQuestions: Question[] = [];

  for (const aq of normalizedQuestions) {
    // 문제 번호 정규화 (4자리 패딩 및 '번' 제거)
    let normalizedNumber = String(aq.number).replace(/번$/g, '').trim();
    if (/^\d+$/.test(normalizedNumber)) {
      normalizedNumber = normalizedNumber.padStart(4, '0');
    }

    // 정규화된 bbox를 픽셀 좌표로 변환
    const left = Math.max(0, Math.floor(aq.bbox.x * pageWidth));
    const top = Math.max(0, Math.floor(aq.bbox.y * pageHeight));
    const width = Math.min(Math.floor(aq.bbox.width * pageWidth), pageWidth - left);
    const height = Math.min(Math.floor(aq.bbox.height * pageHeight), pageHeight - top);

    if (width <= 0 || height <= 0) continue;

    // 탐색기 미리보기 등에서 페이지 순차 정렬이 되도록 파일명 앞에 페이지 번호를 패딩하여 붙임 (예: P143_C01.png)
    const fileBaseName = `P${String(pageCounter).padStart(3, '0')}_${normalizedNumber}`;
    const outputPath = getQuestionImagePath(workbookId, fileBaseName);

    // crop만 수행 (리사이즈 없음) → 원본 DPI 보존
    // 같은 단의 문제들은 normalizeColumnWidths에서 동일 너비로 맞춰졌으므로
    // crop 결과 이미지의 너비가 동일 → 오답노트에서 fit할 때 텍스트 크기 일치
    await sharp(pageImgPath)
      .extract({ left, top, width, height })
      .png()
      .toFile(outputPath);

    // [핵심 개선] 빈 이미지 감지 → AI가 잘못된 좌표를 반환한 경우 자동 제거
    const blank = await isBlankImage(outputPath);
    if (blank) {
      console.warn(`[BlankFilter] 문제 ${normalizedNumber} (p.${pageCounter}): 빈 이미지 감지 → 제거`);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      continue;
    }

    pageQuestions.push({
      id: `${workbookId}_q${normalizedNumber}`,
      workbookId,
      number: normalizedNumber,
      page: pageCounter,
      type: '미분류',
      imagePath: outputPath,
      bbox: aq.bbox
    });
  }

  return pageQuestions;
}

/**
 * PDF 사전 등록 (순차적 이미지 추출 및 크롭) - 개선 버전
 * 
 * 처리 흐름:
 * 1. 페이지별 AI 분석 → 단(column) 너비 정규화 → crop → 빈 이미지 필터링
 * 2. 전체 완료 후 문제 번호 연속성 검사
 * 3. 누락 구간이 있으면 해당 페이지만 강화 프롬프트로 재분석 (1회 제한)
 */
export async function createPdfIndex(
  pdfPath: string,
  workbookId: string,
  type: 'student' | 'teacher',
  onProgress: (msg: string, percent: number) => void,
  startNumber?: string,
  analyzeStartPage?: number,
  analyzeEndPage?: number,
  cancelToken?: string
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

  let allQuestions: Question[] = [];
  let startPage = 1;
  
  // 기존 문제 목록 불러오기 (이어서 분석용)
  const existingQuestions = getQuestions(workbookId);
  if (existingQuestions.length > 0) {
    allQuestions = [...existingQuestions];
    const maxPage = Math.max(...existingQuestions.map(q => q.page));
    startPage = maxPage + 1;
    console.log(`[Resume] 기존 분석 데이터 발견. ${startPage} 페이지부터 이어서 분석을 시작합니다.`);
  }
  
  // 페이지별 이미지 경로와 메타데이터 보존 (재분석 시 사용)
  const pageDataMap: Map<number, { imgPath: string; width: number; height: number }> = new Map();
  
  // ===== Phase 1: 페이지별 순차 분석 =====
  // 대용량 PDF 로드 시 메모리 초과 방지를 위해 Buffer 대신 Path 전달 & 해상도 최적화 (scale: 4로 상향하여 낮은 해상도 이슈 해결)
  const document = await pdf(pdfPath, { scale: 4 });
  
  let pageCounter = 0;
  const totalPages = document.length || 100;
  let isAborted = false;
  const chunkLimit = settings.concurrentScanLimit || 1;
  let currentChunk: Array<{ buffer: Buffer; pageCounter: number }> = [];

  const processChunk = async (chunk: Array<{ buffer: Buffer; pageCounter: number }>) => {
    const promises = chunk.map(async ({ buffer, pageCounter }) => {
      const token = cancelToken || workbookId;
      if (activeAnalyses[token]?.abort) return [];
      
      const percent = Math.floor((pageCounter / totalPages) * 85);
      onProgress(`[1/2] PDF ${pageCounter}/${totalPages}페이지 분석 및 이미지 크롭 중...`, percent);
      
      const pageImgPath = path.join(tempDir, `page_${pageCounter}.png`);
      fs.writeFileSync(pageImgPath, buffer);
      const metadata = await sharp(pageImgPath).metadata();
      const pageWidth = metadata.width || 0;
      const pageHeight = metadata.height || 0;

      pageDataMap.set(pageCounter, { imgPath: pageImgPath, width: pageWidth, height: pageHeight });

      let pageQuestions: Question[] = [];
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        if (activeAnalyses[token]?.abort) break;

        try {
          const extraHints = retryCount > 0 ? 
            "[주의] 이전 분석에서 문제를 하나도 찾지 못했습니다. 이 페이지에는 문제가 존재할 가능성이 높습니다. 엄격한 규칙을 조금 완화하여, 약간 흐릿하거나 형태가 독특하더라도 문제 번호로 보이는 것을 최대한 추출해 보세요." 
            : undefined;
            
          pageQuestions = await analyzeAndCropPage(
            ai, pageImgPath, pageCounter, pageWidth, pageHeight, workbookId, typeLabel, extraHints, startNumber
          );
          
          if (pageQuestions.length > 0) {
            break; 
          } else {
            console.warn(`[Retry] p.${pageCounter}에서 문제를 찾지 못함. 재시도 중... (${retryCount + 1}/${maxRetries})`);
          }
        } catch (err: any) {
          console.error(`[Error] p.${pageCounter} 분석 실패. 재시도 중... (${retryCount + 1}/${maxRetries})`, err.message);
        }
        
        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      if (!activeAnalyses[token]?.abort && pageQuestions.length === 0) {
        console.error(`[Critical] p.${pageCounter} 분석 3회 재시도 모두 실패 또는 문제 없음으로 판정됨.`);
      }
      return pageQuestions;
    });

    const results = await Promise.all(promises);
    for (const res of results) {
      allQuestions.push(...res);
    }
    
    try {
      const workbooks = getWorkbooks();
      const wb = workbooks.find(w => w.id === workbookId);
      if (wb) {
        wb.lastAnalyzedPage = chunk[chunk.length - 1].pageCounter;
        wb.totalQuestions = allQuestions.length;
        saveWorkbook(wb);
      }
      saveQuestions(workbookId, allQuestions);
    } catch (e) {
      console.error(`[Phase1] Chunk DB 저장 실패:`, e);
    }
  };

  for await (const pageImageBuffer of document) {
    pageCounter++;
    
    if (pageCounter < startPage || (analyzeStartPage !== undefined && pageCounter < analyzeStartPage)) {
      continue;
    }

    if (analyzeEndPage !== undefined && pageCounter > analyzeEndPage) {
      console.log(`[Limit] 지정된 분석 끝 페이지(${analyzeEndPage})에 도달하여 분석을 종료합니다.`);
      break;
    }
    
    const token = cancelToken || workbookId;
    if (activeAnalyses[token]?.abort) {
      console.log(`[Cancel] 분석 중단 요청 감지됨. (현재 페이지: ${pageCounter})`);
      onProgress('분석이 일시 중지되었습니다.', Math.floor((pageCounter / totalPages) * 85));
      isAborted = true;
      break;
    }

    currentChunk.push({ buffer: pageImageBuffer, pageCounter });

    if (currentChunk.length >= chunkLimit) {
      await processChunk(currentChunk);
      currentChunk = [];
      await delay(1500); // AI Rate Limit 방지를 위한 대기
      
      if (activeAnalyses[token]?.abort) {
        isAborted = true;
        break;
      }
    }
  }

  if (currentChunk.length > 0 && !isAborted) {
    await processChunk(currentChunk);
    await delay(1500);
  }
  
  // 만약 중단되었다면 Phase 2를 건너뛰고 여기까지 저장 후 리턴
  if (isAborted) {
    const token = cancelToken || workbookId;
    delete activeAnalyses[token];
    saveQuestions(workbookId, allQuestions);
    return allQuestions;
  }
  
  // ===== Phase 2: 문제 번호 연속성 검사 및 누락 구간 재분석 =====
  const { missing, pages: retryPages } = findMissingNumbers(allQuestions);
  
  if (missing.length > 0 && retryPages.length > 0) {
    console.log(`[Phase2] 누락 감지: ${missing.join(', ')} → 페이지 ${retryPages.join(', ')} 재분석`);
    onProgress(`[2/2] 누락 문제 ${missing.length}개 감지, ${retryPages.length}페이지 재분석 중...`, 88);

    const existingNumbers = new Set(allQuestions.map(q => q.number));

    for (const retryPage of retryPages) {
      const pageData = pageDataMap.get(retryPage);
      if (!pageData || !fs.existsSync(pageData.imgPath)) {
        console.warn(`[Phase2] 페이지 ${retryPage}의 임시 이미지가 없어 재분석 불가`);
        continue;
      }

      // 해당 페이지 근처에서 누락된 번호만 필터링하여 힌트로 전달
      const relevantMissing = missing.filter(m => {
        const num = parseInt(m, 10);
        const pageQuestions = allQuestions
          .filter(q => q.page === retryPage && /^\d+$/.test(q.number))
          .map(q => parseInt(q.number, 10));
        if (pageQuestions.length === 0) return true;
        const minNum = Math.min(...pageQuestions);
        const maxNum = Math.max(...pageQuestions);
        return num >= minNum - 10 && num <= maxNum + 10;
      });

      if (relevantMissing.length === 0) continue;

      const extraHints = `
[주의] 이 페이지에서 다음 문제 번호가 누락된 것으로 보입니다: ${relevantMissing.join(', ')}
이 번호들의 문제가 이 페이지에 있는지 특히 신중하게 확인해주세요.
문제 번호가 작은 글씨, 볼드체, 원 안의 숫자, 색상이 다른 텍스트 등 다양한 형태로 되어 있을 수 있습니다.
빈 공간이 아닌 실제 문제 내용이 있는 영역만 bbox로 잡아주세요.
`;

      try {
        const retryQuestions = await analyzeAndCropPage(
          ai, pageData.imgPath, retryPage, pageData.width, pageData.height, workbookId, typeLabel, extraHints, startNumber
        );

        for (const q of retryQuestions) {
          if (!existingNumbers.has(q.number)) {
            allQuestions.push(q);
            existingNumbers.add(q.number);
            console.log(`[Phase2] 누락 문제 복구: ${q.number} (p.${retryPage})`);
          }
        }
      } catch (e) {
        console.error(`[Phase2] 페이지 ${retryPage} 재분석 실패:`, e);
      }

      await delay(1500);
    }
  } else {
    console.log(`[Phase2] 번호 연속성 검사 완료: 누락 없음`);
  }
  
  // ===== 정리 =====
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });

  // 문제 번호순 정렬
  allQuestions.sort((a, b) => {
    const numA = parseInt(a.number, 10);
    const numB = parseInt(b.number, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.number.localeCompare(b.number);
  });

  saveQuestions(workbookId, allQuestions);
  
  const summaryMsg = missing.length > 0
    ? `추출 완료: ${allQuestions.length}문제 (${missing.length}개 누락 구간 재분석됨)`
    : `추출 완료: ${allQuestions.length}문제 처리됨`;
  
  onProgress(summaryMsg, 100);
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
  return targetQuestions;
}
