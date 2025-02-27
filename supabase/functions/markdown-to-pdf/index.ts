
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { marked } from 'https://esm.sh/marked@4.3.0';
import * as puppeteer from 'https://deno.land/x/puppeteer@16.2.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, content } = await req.json();
    
    if (!title || !content) {
      return new Response(
        JSON.stringify({ error: 'Title and content are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Converting to PDF: ${title}`);

    // Convert markdown to HTML
    const htmlContent = marked(content);
    
    // Full HTML document with styling
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${title}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 2cm;
            }
            h1, h2, h3, h4, h5, h6 {
              margin-top: 1.5em;
              margin-bottom: 0.5em;
              font-weight: 600;
            }
            h1 {
              font-size: 2em;
              border-bottom: 1px solid #eaecef;
              padding-bottom: 0.3em;
            }
            h2 {
              font-size: 1.5em;
              border-bottom: 1px solid #eaecef;
              padding-bottom: 0.3em;
            }
            p {
              margin: 1em 0;
            }
            pre {
              background-color: #f6f8fa;
              border-radius: 3px;
              padding: 16px;
              overflow: auto;
              font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
            }
            code {
              font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
              background-color: #f6f8fa;
              padding: 0.2em 0.4em;
              border-radius: 3px;
            }
            blockquote {
              margin: 1em 0;
              padding: 0 1em;
              color: #6a737d;
              border-left: 0.25em solid #dfe2e5;
            }
            img {
              max-width: 100%;
            }
            a {
              color: #0366d6;
              text-decoration: none;
            }
            a:hover {
              text-decoration: underline;
            }
            table {
              border-spacing: 0;
              border-collapse: collapse;
              width: 100%;
              overflow: auto;
              margin-bottom: 16px;
            }
            table th {
              font-weight: 600;
              padding: 6px 13px;
              border: 1px solid #dfe2e5;
            }
            table td {
              padding: 6px 13px;
              border: 1px solid #dfe2e5;
            }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          ${htmlContent}
        </body>
      </html>
    `;

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '1cm',
          right: '1cm',
          bottom: '1cm',
          left: '1cm',
        },
      });
      
      console.log(`PDF generated successfully for: ${title}`);
      
      // Convert to base64
      const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
      
      return new Response(
        JSON.stringify({ 
          pdfBase64,
          message: 'PDF generated successfully' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate PDF',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
