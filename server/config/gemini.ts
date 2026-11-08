import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  try {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    console.log('[Gemini Config] GoogleGenAI SDK berhasil diinisialisasi.');
  } catch (err) {
    console.error('[Gemini Config] Gagal menginisialisasi GoogleGenAI client:', err);
  }
} else {
  console.warn('[Gemini Config] GEMINI_API_KEY belum dikonfigurasi; pembuatan dan revisi draf tidak tersedia.');
}

export { aiClient };
