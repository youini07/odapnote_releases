// ================================================================
// build-frontend.js - Vite 빌드 후 Electron 호환을 위한 후처리
// 밴드어드민과 동일한 패턴
// ================================================================

import { execSync } from 'child_process';

console.log('[Build] Vite 빌드 시작...');
execSync('npx vite build', { stdio: 'inherit' });
console.log('[Build] Vite 빌드 완료!');
