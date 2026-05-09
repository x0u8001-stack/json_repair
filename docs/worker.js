const PYTHONANYWHERE_API = "https://mangiucugna.pythonanywhere.com/api/repair-json";

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return handleCORS();
    }

    try {
      const url = new URL(request.url);
      
      // Only proxy the API endpoint
      if (url.pathname === "/api/repair-json" && request.method === "POST") {
        return await proxyToPythonAnywhere(request);
      }

      // Serve static files for other requests
      return await serveStatic(request, env);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    }
  },
};

function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

async function proxyToPythonAnywhere(request) {
  try {
    const requestBody = await request.json();
    
    const response = await fetch(PYTHONANYWHERE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Cloudflare-Worker-Proxy/1.0",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        input: "",
        output: null,
        error: `Failed to fetch: ${error.message}` 
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  }
}

async function serveStatic(request, env) {
  const url = new URL(request.url);
  const path = url.pathname === "/" ? "/index.html" : url.pathname;

  // Try to get from Cloudflare Assets/KV first
  if (env.ASSETS) {
    try {
      const asset = await env.ASSETS.fetch(new Request(path, request));
      if (asset && asset.status !== 404) {
        const response = new Response(asset.body, asset);
        response.headers.set("Content-Type", getContentType(path));
        return response;
      }
    } catch (e) {
      // Fall through to default response
    }
  }

  // Default to serving index.html for SPA routing
  if (env.ASSETS) {
    try {
      const indexAsset = await env.ASSETS.fetch(new Request("/index.html", request));
      if (indexAsset) {
        const response = new Response(indexAsset.body, indexAsset);
        response.headers.set("Content-Type", "text/html");
        return response;
      }
    } catch (e) {
      // Fall through
    }
  }

  return new Response("Not found", { status: 404 });
}

function getContentType(path) {
  const ext = path.split('.').pop().toLowerCase();
  const types = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
  };
  return types[ext] || 'application/octet-stream';
}
