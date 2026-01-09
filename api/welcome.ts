/**
 * Vercel API: Welcome Page
 * 
 * Serves the welcome.html page
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';

export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    // Read the welcome.html file
    const filePath = join(process.cwd(), 'public', 'welcome.html');
    const html = readFileSync(filePath, 'utf-8');
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Error serving welcome page:', error);
    return res.status(500).send('Error loading welcome page');
  }
}