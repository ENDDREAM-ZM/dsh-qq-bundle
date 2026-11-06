// 跑到哪个 DSH 版本上、走了哪条降级路径，一眼看清。
//   node compat-report.mjs
import { compatReport, compatLine } from './dsh-qq-sing/lib/dsh-compat.js';

const r = compatReport();
console.log('DSH 兼容自检');
console.log('  工具注册入口：', r.toolRegisterKey || '（还没有 ctx，插件的 apply() 里才会探测）');
console.log('  defineTool  ：', r.defineTool ? '有（参数会校验）' : `无 → ${r.toolsPkgError || '未装'}`);
console.log('  schemastery ：', r.schemastery ? '有（生成真 schema）' : `无 → ${r.schemaPkgError || '未装'}`);
if (r.defineToolFallback) console.log('  defineTool 降级：', r.defineToolFallback);
console.log('  一句话：', compatLine());
