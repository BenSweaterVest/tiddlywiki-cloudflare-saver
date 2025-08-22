/**
 * Cloudflare Function for TiddlyWiki Saver Plugin
 * Save at: functions/save.js in your Cloudflare Pages repository
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  
  // Set CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  
  try {
    // Parse request
    const { content, password, timestamp } = await request.json();
    
    // Validate required fields
    if (!content || !password) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: content and password' 
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    
    // Verify password
    if (password !== env.SAVE_PASSWORD) {
      return new Response(JSON.stringify({ 
        error: 'Invalid password' 
      }), {
        status: 401,
        headers: corsHeaders
      });
    }
    
    // Validate environment variables
    if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
      console.error('Missing environment variables');
      return new Response(JSON.stringify({ 
        error: 'Server configuration error' 
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
    
    // Get current file info to retrieve SHA
    const currentFileResponse = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPO}/contents/index.html`,
      {
        headers: {
          'Authorization': `token ${env.GITHUB_TOKEN}`,
          'User-Agent': 'TiddlyWiki-Cloudflare-Saver/1.0',
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    let sha = null;
    if (currentFileResponse.ok) {
      const currentFile = await currentFileResponse.json();
      sha = currentFile.sha;
    } else if (currentFileResponse.status !== 404) {
      // File exists but we got an error (not "not found")
      console.error('Failed to get current file:', currentFileResponse.status);
      return new Response(JSON.stringify({ 
        error: 'Failed to access repository file' 
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
    
    // Prepare content for GitHub (base64 encode)
    const encodedContent = btoa(unescape(encodeURIComponent(content)));
    
    // Prepare commit data
    const commitData = {
      message: `Update TiddlyWiki via Cloudflare Saver - ${new Date(timestamp || Date.now()).toISOString()}`,
      content: encodedContent,
      committer: {
        name: 'TiddlyWiki Cloudflare Saver',
        email: 'noreply@cloudflare-saver.local'
      }
    };
    
    // Include SHA if file exists (for updates)
    if (sha) {
      commitData.sha = sha;
    }
    
    // Save to GitHub
    const saveResponse = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPO}/contents/index.html`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${env.GITHUB_TOKEN}`,
          'User-Agent': 'TiddlyWiki-Cloudflare-Saver/1.0',
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(commitData)
      }
    );
    
    if (!saveResponse.ok) {
      const errorData = await saveResponse.json().catch(() => ({}));
      console.error('GitHub API error:', saveResponse.status, errorData);
      
      let errorMessage = 'Failed to save to GitHub';
      if (errorData.message) {
        errorMessage += ': ' + errorData.message;
      }
      
      return new Response(JSON.stringify({ 
        error: errorMessage,
        details: errorData
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
    
    const saveResult = await saveResponse.json();
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'TiddlyWiki saved successfully',
      commit: saveResult.commit.sha,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: corsHeaders
    });
    
  } catch (error) {
    console.error('Save function error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error: ' + error.message 
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

// Handle CORS preflight requests
export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}

