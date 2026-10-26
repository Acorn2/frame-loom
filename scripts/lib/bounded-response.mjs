import {Buffer} from 'node:buffer';

export const MAX_TTS_RESPONSE_BYTES = 32 * 1024 * 1024;
export async function readBoundedResponse(response, limit = MAX_TTS_RESPONSE_BYTES) {
  const advertised = Number(response.headers.get('content-length'));
  if (advertised > limit) {
    await response.body?.cancel();
    throw new Error('TTS 响应超过字节上限，请拆分旁白。');
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = []; let bytes = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {await reader.cancel(); throw new Error('TTS 响应超过字节上限，请拆分旁白。');}
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, bytes);
  } finally {reader.releaseLock();}
}
