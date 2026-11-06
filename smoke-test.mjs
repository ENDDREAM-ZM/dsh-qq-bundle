// 三个插件的冒烟自测：起一个假 OneBot HTTP 服务，喂 JS 对象当 QQ 消息，看发出来的是什么。
//   node smoke-test.mjs
// 可选环境变量：
//   QQ_IMAGE_API_KEY / QQ_IMAGE_BASE_URL   配了就真的生一张图（要花钱，默认跳过）
//   QQ_VOICE_PYTHON                        edge-tts 解释器（默认 python3）
//   SKIP_NETWORK=1                         不跑真网络搜索

import http from 'node:http';

const results = [];
const ok = (label, extra = '') => { results.push([true, label, extra]); console.log(`✓ ${label}${extra ? ` — ${extra}` : ''}`); };
const bad = (label, extra = '') => { results.push([false, label, extra]); console.log(`✗ ${label}${extra ? ` — ${extra}` : ''}`); };

const PORT = 3996;
const sent = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    let payload = {};
    try { payload = JSON.parse(body || '{}'); } catch { /* ignore */ }
    if (req.url.includes('get_login_info')) {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ status: 'ok', retcode: 0, data: { user_id: 10000, nickname: '测试机器人' } }));
      return;
    }
    sent.push({ action: req.url.replace(/^\//, '').split('?')[0], payload });
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', retcode: 0, data: { message_id: sent.length } }));
  });
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const baseCfg = { onebotHttpUrl: `http://127.0.0.1:${PORT}`, selfId: '10000' };
const makeCtx = () => {
  const tools = new Map();
  return { tools: { register: (t) => tools.set(t.name, t) }, toolsMap: tools, effect: () => () => {}, logger: { info: () => {} } };
};
const textsOf = (msg) => (msg?.message || []).map((s) => s.data?.text || `[${s.type}]`).join('');
const lastSent = (type) => [...sent].reverse().find((s) => (s.payload.message || []).some((x) => x.type === type));

// ───────────── 通道 ─────────────
try {
  const { createAdapter } = await import('./dsh-qq-sing/lib/onebot.js');
  const a = createAdapter({ httpUrl: baseCfg.onebotHttpUrl, selfId: '10000' });
  const info = await a.getSelfInfo();
  if (String(info?.user_id) === '10000') ok('OneBot HTTP 通道能拿到机器人自身信息', String(info.nickname));
  else bad('OneBot HTTP 通道', JSON.stringify(info));
} catch (error) { bad('OneBot HTTP 通道', error.message); }

// ───────────── 点歌 ─────────────
{
  const mod = await import('./dsh-qq-sing/lib/index.js');
  const ctx = makeCtx();
  mod.apply(ctx, baseCfg);
  const tools = [...ctx.toolsMap.keys()];
  if (tools.length === 3) ok('点歌：三个工具都注册了', tools.join(', ')); else bad('点歌：工具注册', tools.join(', ') || '无');

  const chat = { kind: 'private', id: 20001 };
  const msg = (text) => ({ kind: 'private', chatId: 20001, chat, text, senderId: '20001', atMe: false, mid: 1, images: [] });

  sent.length = 0;
  await ctx.__qqSing.handleMessage(msg('点歌 晴天'));
  if (textsOf(sent[0]?.payload).includes('用哪个音源')) ok('点歌：弹出音源菜单'); else bad('点歌：音源菜单', textsOf(sent[0]?.payload));

  if (!process.env.SKIP_NETWORK) {
    sent.length = 0;
    await ctx.__qqSing.handleMessage(msg('2'));
    await new Promise((r) => setTimeout(r, 9000));
    const table = sent.map((s) => textsOf(s.payload)).join('\n');
    if (/回数字|找到这些|搜到这些/.test(table)) ok('点歌：搜出候选表', (table.split('\n').find((l) => /^\d+\./.test(l.trim())) || '').trim().slice(0, 60));
    else bad('点歌：候选表', table.slice(0, 120));

    sent.length = 0;
    await ctx.__qqSing.handleMessage(msg('1'));
    await new Promise((r) => setTimeout(r, 25000));
    const rec = lastSent('record');
    if (rec) ok('点歌：发出一条语音条', `${(rec.payload.message[0].data.file || '').slice(0, 20)}…`);
    else bad('点歌：语音条', sent.map((s) => textsOf(s.payload)).join(' / ').slice(0, 200));
  }

  sent.length = 0;
  const status = await ctx.toolsMap.get('qq_sing_status').execute({}, {});
  if (status?.sources?.length === 3 && Array.isArray(status.banWords)) ok('点歌：status 正常', `屏蔽词 ${status.banWords.length} 个`);
  else bad('点歌：status', JSON.stringify(status).slice(0, 160));

  sent.length = 0;
  await ctx.__qqSing.handleMessage({ ...msg('点歌 晴天'), kind: 'group', chat: { kind: 'group', id: 30001 }, atMe: false });
  if (!sent.length) ok('点歌：群里没 @ 不响应'); else bad('点歌：群里没 @ 竟然响应了');
}

// ───────────── 生图 ─────────────
{
  const mod = await import('./dsh-qq-image/lib/index.js');
  const ctx = makeCtx();
  const apiKey = process.env.QQ_IMAGE_API_KEY || '';
  const apiBaseUrl = process.env.QQ_IMAGE_BASE_URL || '';
  mod.apply(ctx, { ...baseCfg, apiKey, apiBaseUrl });
  const tools = [...ctx.toolsMap.keys()];
  if (tools.length === 2) ok('生图：两个工具都注册了', tools.join(', ')); else bad('生图：工具注册', tools.join(', ') || '无');

  const status = await ctx.toolsMap.get('qq_image_status').execute({}, {});
  if (status?.imageModel) ok('生图：status 正常', `Key ${status.apiKeyConfigured ? '已配置' : '未配置'}`);
  else bad('生图：status');

  if (apiKey && apiBaseUrl) {
    sent.length = 0;
    try {
      const r = await ctx.toolsMap.get('qq_image_generate').execute({ chat: { kind: 'private', id: 20001 }, prompt: '一只戴墨镜的橘猫', kind: 'image', size: '512x512' }, {});
      if (r?.url && lastSent('image')) ok('生图：真出了一张图并发出去', r.url.slice(0, 50));
      else bad('生图：生成结果', JSON.stringify(r).slice(0, 120));
    } catch (error) { bad('生图：生成失败', error.message); }
  } else {
    console.log('· 生图：没配 QQ_IMAGE_API_KEY/QQ_IMAGE_BASE_URL，跳过真出图');
  }

  sent.length = 0;
  await ctx.__qqImage.handleMessage({ kind: 'private', chatId: 20001, chat: { kind: 'private', id: 20001 }, text: '今天天气不错', senderId: '20001', atMe: false, mid: 2, images: [] });
  if (!sent.length) ok('生图：闲聊不误触发'); else bad('生图：闲聊被误触发');
}

// ───────────── 语音 ─────────────
{
  const mod = await import('./dsh-qq-voice/lib/index.js');
  const ctx = makeCtx();
  mod.apply(ctx, { ...baseCfg, edgePython: process.env.QQ_VOICE_PYTHON || 'python3' });
  const tools = [...ctx.toolsMap.keys()];
  if (tools.length === 2) ok('语音：两个工具都注册了', tools.join(', ')); else bad('语音：工具注册', tools.join(', ') || '无');

  const parsed = mod._internal.parseVoiceCommand('用粤语说 得闲饮茶');
  if (parsed.hit && parsed.dialect === 'yue') ok('语音：认得出「用粤语说」', parsed.text); else bad('语音：指令解析', JSON.stringify(parsed));

  sent.length = 0;
  try {
    const r = await ctx.toolsMap.get('qq_voice_say').execute({ chat: { kind: 'private', id: 20001 }, text: '测试一下', dialect: 'mandarin' }, {});
    if (lastSent('record')) ok('语音：合成并发出语音条', `${r.source} / ${r.bytes} 字节`);
    else bad('语音：语音条', JSON.stringify(r));
  } catch (error) { bad('语音：合成失败（宿主装 edge-tts 了吗？）', error.message); }
}

server.close();
const passed = results.filter(([p]) => p).length;
console.log(`\n通过 ${passed} / ${results.length - passed} 失败`);
process.exit(results.some(([p]) => !p) ? 1 : 0);
