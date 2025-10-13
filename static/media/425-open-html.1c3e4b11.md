---
title: Open Draw.io by Clicking a "Redirect" HTML
date: 2025-10-12
id: blog0425
tag: html, draw.io, system-design
toc: false
intro: Record a simple file
---

<style>
  video {
    border-radius: 4px;
  }
  img {
    max-width: 660px;
  }
</style>

- Very often we need to share system design via `draw.io`. 

- Everyone uses their own method to record the HTML link to that `draw.io` document and it is extremely easy to lose that link.

- The system design of the corresponding micro service has their own diagram. So we may for each project attach an HTML that redirects user to that `draw.io` diagram:

```html{10}
<!-- entity_relation_diagram.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Open Diagram</title>
    <script>
        // ⚙️ CONFIGURATION - Change this URL to redirect to a different diagram
        const REDIRECT_URL = 'https://app.diagrams.net/#G1uYGx6DXpcGm7m5BZyMWCBNBQPKZvY0uo#%7B%22pageId%22%3A%22X3fASYuNa3LDEZakILLq%22%7D';
    </script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            backdrop-filter: blur(10px);
        }
        h1 {
            margin-bottom: 1rem;
        }
        a {
            color: #fff;
            text-decoration: none;
            padding: 12px 24px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 5px;
            display: inline-block;
            margin-top: 1rem;
            transition: background 0.3s;
        }
        a:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        .spinner {
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-top: 3px solid white;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎨 Opening Diagram...</h1>
        <div class="spinner"></div>
        <p>Redirecting to diagrams.net</p>
        <a href="#" id="manual-link">
            Click here if not redirected automatically
        </a>
    </div>
    
    <script>
        // Set the manual link href using the configured URL
        document.getElementById('manual-link').href = REDIRECT_URL;
        
        // Automatic redirect
        setTimeout(function() {
            window.location.href = REDIRECT_URL;
        }, 100);
    </script>
</body>
</html>
```