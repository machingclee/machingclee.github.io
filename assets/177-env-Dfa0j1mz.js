const n=`---
title: "Environment Variable by env-cmdrc"
date: 2023-09-11
id: blog0177
tag: nodejs
intro: "Package for combining env files conveniently."
toc: false
---

<center></center>

- **Step 1.** \`yarn add env-cmd\`
- **Step 2.** Create a \`.env-cmdrc\` in root level:
  \`\`\`text
  {
    "default": {
      "PORT": 8080
    },
    "production": {
      "GOOGLE_CLIENT_ID": "XXX.com",
      "GOOGLE_CLIENT_SECRET": "YYY",
      "GOOGLE_API_REDIRECT": "http://localhost:8080/login-google",
      "ALLOWED_EMAILS": ["machingclee@gmail.com", "james.lee@wonderbricks.com"],
      "JWT_SECRET": "SECRET!",
      "FRONTEND_URL": "http://localhost:3000"
    }
  }
  \`\`\`
- **Step 3.** We prefix any command by
  \`\`\`text
  env-cmd -f .env-cmdrc -e default,production
  \`\`\`
  For example:
  \`\`\`text
  env-cmd -f .env-cmdrc -e default,production nodemon --exec ts-node src/app.ts
  \`\`\`
`;export{n as default};
