const n=`---
title: "Flow Charts for Documentation using Mermaid"
date: 2025-11-26
id: blog0440
tag: mermaid, documentation
toc: true
intro: Record some exmaple of charts created by mermaid
img: /assets/img/2025-11-30-11-32-55.png
scale: 1.2
offsety: -20
offsetx: -10
---

<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
</style>

### Example: Sequence Diagram for Google Authentication


\`\`\`mermaid
sequenceDiagram
  participant User as Our Frontend
  participant Lambda as Backend (Lambda)
  participant Google as Google Authentication

  User->>Lambda: GET /login
 
  Lambda-->>User: LOGIN_URL for Google Authentication (scoped to company account only)
  User->>Google: GET LOGIN_URL (via popup window)

  rect rgb(200, 220, 250)
    Note over User, Lambda: Google redirects browser to callback URL on login succeeded
    Google-->>User: 302 Redirect to /login-google
    User->>Lambda: GET /login-google (auth code)
  end
  
  rect rgb(200, 220, 250)
    Note over User, Lambda: Redirect browser again to our frontend
    Lambda-->>User: 302 Redirect to <frontend-domain>/login-succeeded?jwtToken=...
    User->>User: GET /login-succeeded?jwtToken=...  (via the same popup window)
    Note over User, User: Token consumed and is set into context (zustand)
  end
\`\`\`


\`\`\`text
sequenceDiagram
  participant User as Our Frontend
  participant Lambda as Backend (Lambda)
  participant Google as Google Authentication

  User->>Lambda: GET /login
 
  Lambda-->>User: LOGIN_URL for Google Authentication (scoped to company account only)
  User->>Google: GET LOGIN_URL (via popup window)

  rect rgb(200, 220, 250)
    Note over User, Lambda: Google redirects browser to callback URL on login succeeded
    Google-->>User: 302 Redirect to /login-google
    User->>Lambda: GET /login-google (auth code)
  end
  
  rect rgb(200, 220, 250)
    Note over User, Lambda: Redirect browser again to our frontend
    Lambda-->>User: 302 Redirect to <frontend-domain>/login-succeeded?jwtToken=...
    User->>User: GET /login-succeeded?jwtToken=...  (via the same popup window)
    Note over User, User: Token consumed and is set into context (zustand)
  end
\`\`\`


### Example: Top Down or Left Right Diagram

\`\`\`mermaid
graph TD;
  A[Action A] --> B["Execute <code>some_function</code>"] 
  --> C[Action C]
  --> D[Action D]
  --> E[Action E];
\`\`\`
Change to \`graph LR;\` for left to right:
\`\`\`text{1}
graph TD;
  A[Action A] --> B["Execute <code>some_function</code>"] 
  --> C[Action C]
  --> D[Action D]
  --> E[Action E];
\`\`\``;export{n as default};
