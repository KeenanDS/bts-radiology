
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

// This is the TypeScript entrypoint that will invoke our Python handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the request body
    const payload = await req.json();
    
    // Execute the Python script with the request payload
    const command = new Deno.Command("python3", {
      args: ["index.py"],
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
      cwd: "./supabase/functions/process-podcast-audio-python",
    });
    
    // Create a subprocess and pipe the request payload to it
    const process = command.spawn();
    const writer = process.stdin.getWriter();
    
    await writer.write(new TextEncoder().encode(JSON.stringify(payload)));
    await writer.close();
    
    // Wait for the process to complete
    const { stdout, stderr, code } = await process.output();
    
    if (code !== 0) {
      const errorMessage = new TextDecoder().decode(stderr);
      console.error(`Python process error: ${errorMessage}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Python processing failed: ${errorMessage}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Parse and return the Python script's output
    const output = new TextDecoder().decode(stdout);
    const result = JSON.parse(output);
    
    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(`Error in process-podcast-audio-python: ${error.message}`);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
