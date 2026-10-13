// Vercel entry: same handler as Netlify (Web Request → Response).
import handler from '../netlify/functions/live-token.js';

export const POST = handler;
