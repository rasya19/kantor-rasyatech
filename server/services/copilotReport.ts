import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CopilotClient, type CopilotSession } from '@github/copilot-sdk';

async function waitForSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  signal.throwIfAborted();
  let rejectAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = () => reject(signal.reason);
    signal.addEventListener('abort', rejectAbort, { once: true });
  });
  try {
    return await Promise.race([promise, aborted]);
  } finally {
    if (rejectAbort) signal.removeEventListener('abort', rejectAbort);
  }
}

export async function generateCopilotReport(instruction: string, systemInstruction: string, model: string, signal?: AbortSignal): Promise<string> {
  const token = process.env.COPILOT_GITHUB_TOKEN;
  if (!token) throw new Error('COPILOT_GITHUB_TOKEN belum dikonfigurasi untuk akun yang berhak menggunakan Copilot.');
  const credits = Number(process.env.COPILOT_MAX_AI_CREDITS);
  if (!Number.isFinite(credits) || credits <= 0) throw new Error('COPILOT_MAX_AI_CREDITS harus diisi angka positif.');
  signal?.throwIfAborted();
  const directory = await mkdtemp(join(tmpdir(), 'rasyatech-copilot-'));
  const env = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY']
    .map((key) => [key, process.env[key]]).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  const client = new CopilotClient({ mode: 'empty', baseDirectory: directory, workingDirectory: directory,
    env, gitHubToken: token, useLoggedInUser: false, logLevel: 'error' });
  let session: CopilotSession | undefined;
  const abort = () => { if (session) void session.abort().catch((error) => console.error('[Copilot] Pembatalan sesi gagal:', error)); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    session = await waitForSignal(client.createSession({
      model, workingDirectory: directory, availableTools: [], excludedTools: ['builtin:*', 'mcp:*', 'custom:*'], tools: [],
      enableConfigDiscovery: false, enableSkills: false, skipCustomInstructions: true,
      mcpServers: {}, customAgents: [], onPermissionRequest: () => ({ kind: 'reject' }),
      systemMessage: { mode: 'append', content: systemInstruction },
      sessionLimits: { maxAiCredits: credits },
    }), signal);
    signal?.throwIfAborted();
    const result = await waitForSignal(session.sendAndWait({ prompt: instruction }, 80000), signal);
    signal?.throwIfAborted();
    const content = result?.data.content?.trim();
    if (!content) throw new Error('Copilot mengembalikan respons kosong.');
    return content;
  } finally {
    signal?.removeEventListener('abort', abort);
    try {
      if (session) await client.deleteSession(session.sessionId);
    } finally {
      const errors = await client.stop();
      if (errors.length) {
        console.error('[Copilot] Gagal menghentikan runtime:', errors);
        throw new Error('Runtime Copilot gagal dihentikan. Periksa log server.');
      }
      await rm(directory, { recursive: true, force: true });
    }
  }
}
