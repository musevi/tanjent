import Groq from 'groq-sdk';

const apiKey = import.meta.env.VITE_GROQ_API_KEY as string;

if (!apiKey) {
  throw new Error(
    'Missing VITE_GROQ_API_KEY. Copy .env.example to .env and add your Groq API key.'
  );
}

export const groq = new Groq({
  apiKey,
  dangerouslyAllowBrowser: true, // safe for local dev — never deploy this publicly
});
