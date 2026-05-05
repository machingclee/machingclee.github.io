const t=`---
title: "Routing Config in React Router v6"
date: 2024-07-29
id: blog0301
tag: react
toc: true
intro: "Record the usage of react-router v6."
---

<style>
  img {
    max-width: 660px;
  }
</style>

### \`RouterProvider\` in \`App.tsx\`

\`\`\`tsx
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
\`\`\`

### \`getRouter\` in \`router.tsx\`


\`\`\`tsx
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
\`\`\`
Here \`store\` is injected into \`getRouter\` simply for initiating the \`store\` object before we actually use it in any \`redux-slice\`.

### \`Root.tsx\`

Any url that hits \`/\` will execute our gateway component \`<Root />\`:
\`\`\`tsx
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
\`\`\`
We treat \`<Outlet />\` as if using \`_layout.tsx\` in \`next.js\`. Therefore it is a suitable location to ***customize the entire layout*** of our app if needed.

### Nested Routing in \`router.tsx\`

#### Routing Config

\`\`\`text{5}
<Route path={"/"} element={<Root />} >
    <Route path="/login" element={<Login />} />
    <Route path="/dashboard" element={<Dashboard />} >
        <Route path={"students"} element={<RouteIndex />} >
            <Route index element={<Students />} />
            <Route path=":studentId" element={<StudentDetail />} />
        </Route>
        <Route />
        <Route path={"users"} element={<Users />} />

        <Route path={"timetables"} element={<Timetables />} />
    </Route>
</Route>
\`\`\`
- The highlighted \`<Route index />\` will be rendered when hitting \`/dashboard/students\`.

- Here \`RouteIndex\` is as simple as:
  \`\`\`tsx
  import { Outlet } from "react-router-dom"

  export default () => {
      return <>{<Outlet />}</>
  }
  \`\`\`
  It is a good place to set special layout to the whole students section.


#### Get the path param \`/dashboard/students/:studentId\` in \`<StudentDetail />\`

\`\`\`tsx{13}
// StudentDetail.tsx

import { useNavigate, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import SectionTitle from "../../../components/SectionTitle";
import { useEffect } from "react";
import { StudentThunkAction } from "../../../redux/slices/studentSlice";
import Spacer from "../../../components/Spacer";
import { IoMdArrowBack } from "react-icons/io";
import { Button } from "antd";

export default () => {
    const { studentId } = useParams<{ studentId: string }>();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const studentDetail = useAppSelector(s => s.student.studentDetail.detail);
    const { first_name, last_name } = studentDetail || {};

    useEffect(() => {
        if (studentId) {
            dispatch(StudentThunkAction.getStudentDetail({ studentId }));
        }
    }, [studentId]);

    if (!studentDetail) {
        return null;
    }

    return (
        <div>
            <SectionTitle>
                <Button shape="circle" onClick={() => { navigate(-1) }}><IoMdArrowBack /></Button>
                <Spacer height={1} />
                Student Detail
            </SectionTitle>
            <Spacer />
            <table>
                <tbody>
                    <tr>
                        <td>Name:</td> <td>{\`\${first_name} \${last_name}\`}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    )
}
\`\`\``;export{t as default};
