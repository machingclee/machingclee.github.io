---
title: "Create a React-App via Vite, Config for MUI, Load Env Variable from Custom Files and the Latest React Router"
date: 2024-07-14
id: blog0278
tag: react, vite
toc: true
intro: "Record a standard procedure to create an react-app via vite."
---

<style>
  img {
    max-width: 660px;
  }
</style>


#### Create a React App via Vite, Configure the Application

1.  ```text
    yarn create vite my-personal-project
    ```
    Then choose `react-ts` in the command line.

2.  - Config for MUI and Config for `.env`:
      ```js{11}
      // vite.config.ts

      import { defineConfig, loadEnv } from 'vite'
      import react from '@vitejs/plugin-react'

      // https://vitejs.dev/config/
      export default defineConfig(({ command, mode }) => {
          const env = loadEnv(mode, process.cwd(), '')
          const newMap: { [key: string]: string | undefined } = {}
          Object.entries(env).forEach(([k, v]) => {
              if (k.startsWith("VITE_")) {
                  newMap[`process.env.${k}`] = v || undefined;
              }
          })
          process.env = Object.assign(process.env, newMap)

          return {
              plugins: [react()],
              optimizeDeps: {
                  include: ['@emotion/styled'],
              },
          }
      })

      ```
    - Note that I also require the `env` variable be ***prefixed*** by `VITE_` in order not to include so many unrelated variables.


#### Environment Variables

3. Create `.env.{dev, uat, prod}` files for env variables of different stages.

4.  Take `.env.prod` as an example, write:
    ```text
    # .env.prod

    VITE_ENV=prod
    VITE_ASK_BILLIE_ENABLED=false
    VITE_GOOGLE_AUTH_BACKEND_URL=https://google-auth-billie-web-prod.wonderbricks.com
    VITE_BACKEND_URL=https://alb.wonderbricks.com:9002
    ```

5. Sciprts for loading env variables for different stages:

    ```json
    "scripts": {
      "start:dev": "vite --mode dev",
      "build:uat": "tsc && vite build --mode uat",
      "build:prod": "tsc && vite build --mode prod",
      "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
      "preview": "vite preview"
    },
    ```

#### React Router v6

6.  - `App.tsx`:
      ```tsx
      // App.tsx

      import { Provider } from "react-redux"
      import { RouterProvider } from "react-router-dom"
      import { PersistGate } from "redux-persist/integration/react"
      import { persistor, store } from "./redux/store"
      import { getRouter } from "./config/router"
      import AppLoading from "./components/AppLoading"
      import { ToastContainer } from "react-toastify"

      function App() {
          return (
              <>
                <Provider store={store}>
                    <PersistGate persistor={persistor}>
                        <RouterProvider router={getRouter(store)} />
                        <AppLoading />
                        <ToastContainer limit={1} />
                    </PersistGate>
                </Provider >
              </>
          )
      }

      export default App
      ```

    - `getRouter(_: any)`:
      ```tsx
      // router.tsx

      import {
          createBrowserRouter,
          createRoutesFromElements,
          Route,
      } from "react-router-dom";
      import Terminal from "../pages/terminal/Terminal";
      import Root from "../pages/Root";
      import Login from "../pages/Login";
      import Statistic from "../pages/Statsitic/Statistic";

      export const getRouter = (_: any) => {
          return createBrowserRouter(createRoutesFromElements(
              <Route path="/" element={<Root />} >
                  <Route path="terminal" element={<Terminal />} />
                  <Route path="login" element={<Login />} />
                  <Route path="statistic" element={<Statistic />} />
              </Route>));
      }
      export default getRouter;
      ```
      Here `store` is injected into `getRouter` simply for initiating the `store` object before we actually use it in any `redux-slice`.

    - Any url that hits `/` will execute our gateway component `<Root />`:
      ```tsx
      // Root.tsx

      import { useEffect } from "react"
      import { Outlet, useLocation, useNavigate } from "react-router-dom"

      const titles: { [key: string]: string } = {
          "/terminal": "Billie Terminal",
          "/login": "Billie Login",
          "/statistic": "Billie Statistic"
      }

      export default () => {
          const location = useLocation();
          const navgiate = useNavigate();

          useEffect(() => {
              document.title = titles?.[location.pathname] || ""
          }, [location.pathname])

          useEffect(() => {
              if (location.pathname === "/") {
                  navgiate("/login");
              }
          }, [location.pathname])

          return <div>
              <Outlet />
          </div>
      }
      ```
      We treat `<Outlet />` as if using `_layout.tsx` in `next.js`. Therefore it is a suitable location to ***customize the entire layout*** of our app if needed.
