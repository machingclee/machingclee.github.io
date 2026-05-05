const n=`---
title: "Google Login in Popup Window"
date: 2025-04-12
id: blog0384
tag: google-cloud
toc: true
intro: "Google login without redirection of main page by popping up a new window."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Result

Click \`GET DATA\` which triggers a google login:

[![](/assets/img/2025-04-13-04-10-29.png)](/assets/img/2025-04-13-04-10-29.png)

### Frontend

#### router.tsx

\`\`\`tsx
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
} from "react-router-dom";
import Root from "./pages/Root";
import LoginSuccess from "./pages/LoginSuccess";
import BillieInfo from "./pages/BillieInfo";

export const getRouter = (_?: any) => {
  return createBrowserRouter(
    createRoutesFromElements(
      <Route path="/" element={<Root />}>
        <Route path="billie-info" element={<BillieInfo />} />
        <Route path="login-succeed" element={<LoginSuccess />} />
      </Route>
    )
  );
};
\`\`\`

#### App.tsx (using this router)

\`\`\`tsx
import { RouterProvider } from "react-router-dom";
import "./App.css";
import getRouter from "./router";

function App() {
  return (
    <>
      <RouterProvider router={getRouter()} />
    </>
  );
}

export default App;
\`\`\`

#### The page: \`/billie-info\`

##### Open popup window

\`\`\`tsx-1
import { Button } from "@mui/material";
import axios from "axios";
import { useEffect, useState } from "react";

export default function BillieInfo() {
  const [user, setUser] = useState("");
  const [loginUrl, setloginUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const openLoginPopup = () => {
    setLoading(true);

    // define popup dimensions and position
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2.5;

    // open the popup window
    const popup = window.open(
      loginUrl,
      "googleAuthPopup",
      \`width=\${width},height=\${height},left=\${left},top=\${top},resizable=yes,scrollbars=yes,status=yes\`
    );

    // check if popup was blocked
    if (!popup || popup.closed || typeof popup.closed === "undefined") {
      console.error("Popup was blocked by the browser");
      setLoading(false);
      alert("Please allow popups for this website to login");
      return;
    }

    // set up polling to check if the popup was closed
    const checkPopupClosed = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(checkPopupClosed);
        setLoading(false);
      }
    }, 1000);

    return popup;
  };
\`\`\`

##### Handle login succeeded message from popup window

\`\`\`tsx-44{55-60}
  useEffect(() => {
    const handleAuthMessage = (event: any) => {
      // check origin for security
      if (event.origin !== window.location.origin) {
        console.warn("Received message from unknown origin:", event.origin);
        return;
      }

      console.log("Received message:", event.data);

      // process authentication success message
      if (event.data && event.data.type === "AUTH_SUCCESS") {
        console.log("Auth success!", event.data.user);
        setUser(event.data.user);
        alert("user received: " + event.data.user);
        // store user info or token as needed
      }
    };

    // add listener
    window.addEventListener("message", handleAuthMessage);

    // clean up
    return () => window.removeEventListener("message", handleAuthMessage);
  }, []);
\`\`\`

##### Get the authentication URL

\`\`\`tsx-69
  useEffect(() => {
    const getURL = async () => {
      const res = await axios.get<{ url: string }>(
        "http://localhost:8765/login"
      );
      setloginUrl(res.data.url);
    };
    getURL();
  }, []);
\`\`\`

##### The simple get data button

\`\`\`tsx-78
  return (
    <div>
      <Button onClick={openLoginPopup}>Get Data</Button>
    </div>
  );
}
\`\`\`

#### The page: \`/login-succeed\`

##### The custom data after google auth redirecting to our backend's GET endpoint:

When this \`/login-succeed\` route is triggered, because we carry information from our backend via query-parameter, we need to parse the query string into an object:

\`\`\`tsx-1
import { Button } from "@mui/material";
import { useEffect, useState } from "react";

export default () => {
  const [email, setEmail] = useState("");

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const queryParams: { [key: string]: string } = {};
    searchParams.entries();
    for (const [key, value] of searchParams.entries()) {
      queryParams[key] = value;
    }
\`\`\`

##### Send back data to parent window via \`message\` event

- The parent window that popups the login-window will listen to the changes by

  \`\`\`tsx
  window.addEventListener("message", (event) => {
    // process event.data
  });
  \`\`\`

- The parent window will receive line-17 in \`event.data\`

  \`\`\`tsx-14{18}
      setEmail(queryParams["email"]);

      if (window.opener) {
        window.opener.postMessage(
          { type: "AUTH_SUCCESS", user: queryParams["email"] },
          "http://localhost:5173" // parent origin
        );
      }
    }, []);

    return (
      <div>
        {\`Welcome, \${email}\`}{" "}
        <Button
          onClick={() => {
            window.close();
          }}
        >
          Close
        </Button>
      </div>
    );
  };
  \`\`\`

  Therefore the parent can access

  \`\`\`ts
  { type: "AUTH_SUCCESS", user: queryParams["email"] }
  \`\`\`

  by \`event.data\` via listening to \`message\` event.

### Backend: The Route and Controller

In the past we have studied how to perform google login by creating a URL (for frontend-redirection) and using correct credentials registered in google cloud platform:

- [Google-Login](/blog/article/Google-Login)

The backend is **_identical_** without any changes.
`;export{n as default};
