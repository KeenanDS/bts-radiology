
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { marked } from 'https://esm.sh/marked@4.3.0';
import { parse } from 'https://deno.land/std@0.177.0/encoding/base64.ts';

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
    
    // Create PDF using the PDF API service instead of Puppeteer
    const pdfResponse = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`api:${Deno.env.get('PDFSHIFT_API_KEY')}`)}`,
      },
      body: JSON.stringify({
        source: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <title>${title}</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  margin: 2cm;
                }
                h1 { font-size: 2em; margin-bottom: 1em; }
                pre { background: #f6f8fa; padding: 1em; border-radius: 4px; }
                code { font-family: monospace; }
              </style>
            </head>
            <body>
              <h1>${title}</h1>
              ${htmlContent}
            </body>
          </html>
        `,
        format: 'A4',
        margin: '1cm',
      }),
    });

    if (!pdfResponse.ok) {
      throw new Error(`PDF generation failed: ${pdfResponse.statusText}`);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

    console.log('PDF generated successfully');
    
    return new Response(
      JSON.stringify({ 
        pdfBase64: base64Pdf,
        message: 'PDF generated successfully' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
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
