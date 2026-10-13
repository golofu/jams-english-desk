// Vercel entry: same handler as Netlify (Web Request → Response).
import handler from '../netlify/functions/coach.js';

export const POST = handler;
