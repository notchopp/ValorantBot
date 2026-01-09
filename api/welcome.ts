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
    // Try multiple possible paths for Vercel's serverless environment
    const possiblePaths = [
      join(process.cwd(), 'public', 'welcome.html'),
      join(__dirname, '..', 'public', 'welcome.html'),
      join(process.cwd(), 'welcome.html'),
    ];

    let html: string | null = null;
    let lastError: Error | null = null;

    for (const filePath of possiblePaths) {
      try {
        html = readFileSync(filePath, 'utf-8');
        break;
      } catch (err) {
        lastError = err as Error;
        continue;
      }
    }

    if (!html) {
      console.error('Error: Could not find welcome.html in any expected location', {
        triedPaths: possiblePaths,
        cwd: process.cwd(),
        __dirname,
        lastError: lastError?.message,
      });
      return res.status(500).send(`
        <html>
          <body>
            <h1>Error loading welcome page</h1>
            <p>File not found. Please check deployment.</p>
            <pre>${JSON.stringify({ cwd: process.cwd(), __dirname }, null, 2)}</pre>
          </body>
        </html>
      `);
    }
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Error serving welcome page:', error);
    return res.status(500).send(`
      <html>
        <body>
          <h1>Error loading welcome page</h1>
          <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
        </body>
      </html>
    `);
  }
}