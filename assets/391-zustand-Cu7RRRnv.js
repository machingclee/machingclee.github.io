const e=`---
title: Replace Redux by Zustand and React-Query
date: 2025-04-28
id: blog0391
tag: react, zustand, react-query
toc: true
intro: "Record a standard setup as a transition from redux to zustand. This article will be kept updated along the way I delve deeper using zustand."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### A Store Mimicing the Slice in Redux Toolkit

In an ordinary redux slice we need to define the **state**, the **reducers**, and the **extra reducers** for successful thunk actions.

Because API-calls will be delegated to react-query, for zustand it remains to define a store that contains

- state
- setters (a replacement of reducers)

whether to store the fetched data from react-query into zustand store depends on

- how often we need the most updated data and
- how complicated are the data processing of the fetched data.

For most cases we can keep putting the data into zustand store for debug purpose. We make direct use of the \`{ data }\` part from react-query quen we need **_caching_** or **_prefetched_** data.

\`\`\`js-1
import { create } from 'zustand'
import { persist } from "zustand/middleware"
import { immer } from 'zustand/middleware/immer'

interface AuthState {
  accessToken: string
  clickToLogin: () => void
}

interface AuthSetters {
  setAccessToken: (token: string) => void
  setClickToLogin: (fn: () => void) => void
}

const initialState: AuthState = {
  accessToken: "",
  clickToLogin: () => { }
}
\`\`\`

Note that here we also store functions into the store. As in redux we need to be careful when we try to persist data into \`localStorage\`:

\`\`\`js-19{37-39,41-50}
export default create<{ state: AuthState, setters: AuthSetters }>()(
  persist(immer(set => ({
    state: initialState,
    setters: {
      setAccessToken: token => {
        set(store => {
            store.state.accessToken = token;
        })
      },
      setClickToLogin: (fn: () => void) => {
        set(store => {
            store.state.clickToLogin = fn
        })
      }
    }
  })),
    {
      name: "auth-storage",
      partialize: (store) => ({
        state: { accessToken: store.state.accessToken }
      }),
      // omit the following when our persisted data are on the top level of key-value pairs
      merge: (persistedState, currentState) => {
        const typedPersistedState = persistedState as { state?: Partial<AuthState> }
        return {
          ...currentState,
          state: {
            ...currentState.state,
            ...(typedPersistedState?.state || {})
          }
        }
      }
    }
  )
)
\`\`\`

We set a whitelist of persisted data by \`partialize\`.

When nested property is needed (which is our case as we separate our state by \`state\` and \`setters\` for clarity), we explain how to merge the persisted state and the initial state.

### Axios Instance that uses the Token in Request Interceptor

By default a store created from zustand has an API to get the state outside of any react component (on the other hand we need to get the state of a redux-store in an hacky way).

\`\`\`js-1{14}
import axios from "axios";
import getEnv from "../src/util/getEnv";
import useAuthStore from "../src/store/useAuthStore";

const billieInfoClient = axios.create({
    baseURL: getEnv().VITE_BILLIE_INFO_BACKEND_ORIGIN,
    responseEncoding: "utf8",
    headers: {
        "Content-type": "application/json",
    },
});

billieInfoClient.interceptors.request.use((req) => {
    const token = useAuthStore.getState().state.accessToken;
    if (token) {
      req.headers["Authorization"] = "Bearer " + token;
    }
    return req;
});

export default billieInfoClient;
\`\`\`

with

\`\`\`js
// util/getEnv.ts
const env = import.meta.env;

export default () => {
  return env;
};
\`\`\`

in a vite react-app application.

### API Call

We will use \`sonner\` and \`toast\` from shadcn.

#### useQuery

\`\`\`js-1{37}
import billieInfoClient from "../../axios/billieInfoClient";
import { BillieConfig } from "../../../google-auth-backend/src/dto/dto";
import useBillieInfoStore from "@/store/useBillieInfoStore";
import apiRoutes from "../../axios/apiRoutes";
import { useQuery } from "@tanstack/react-query";
import queryKeys from "./queryKeys";
import { useEffect } from "react";
import { toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";

export default () => {
  const setBiillieInfo = useBillieInfoStore((s) => s.setters.setBiillieInfo);
  const clickToLogin = useAuthStore((s) => s.state.clickToLogin);
  const setAccessToken = useAuthStore((s) => s.setters.setAccessToken);

  const query = useQuery({
    queryKey: queryKeys.TERRAFORM_CONFIG,
    queryFn: async () => {
      const res =
        (await billieInfoClient.get) <
        {
          success: boolean,
          result: {
            dev: BillieConfig,
            uat: BillieConfig,
            prod: BillieConfig,
          },
        } >
        apiRoutes.BILLIE_INFOR_TERRAFORM_CONFIG;
      if (res.data.result) {
        setBiillieInfo(res.data.result);
      }
      return res.data;
    },
    staleTime: 0,
    gcTime: 0,
    enabled: false
  });
\`\`\`

- We choose to use \`enabled = false\` because we are not going to fetch data whenever a component gets (re)rerendered.

- We have further dicussion on \`staleTime\` and \`gcTime\` in [this article](/blog/article/React-Query-Fundamentals#stateTime-vs-gcTime).

#### Do we store data into zustand?

The following \`useEffect\` is **_optional_** (but requires consideration):

\`\`\`js-39
  useEffect(() => {
    if (query?.data?.success && query?.data?.result) {
      setBiillieInfo(query.data.result);
    }
  }, [query.data]);
\`\`\`

We can directly get the data by returning the \`query\` to the component that needs it. But first consider the way to share the fetched data:

1. Do we want to cache it?
2. Do we want an API call of a hardly updated data everytime we need it?
3. Do we want the latest data everytime a component get rerendered? (if we \`useQuery\` inside a component, it calls the api everytime the \`staleTime\` gets exceeded)

In our situation:

- As we don't need to refetch the data everytime a component gets rerendered, we simply put that data into zustand, and we put \`{ enabled: false }\` into the useQuery.
- In case we always want latest data shown in the screen (when rerendered, or when on focused), we simply use the data from react query.

#### Error Handling

Finally we handle the error when needed:

\`\`\`js-45
  useEffect(() => {
    if (query.error || (query?.data?.success != null && !query.data.success)) {
      setAccessToken("");
      toast("Please login again", {
        action: {
          label: "Click to Login",
          onClick: () => {
            clickToLogin();
          },
        },
      });
    }
  }, [query.error]);
  // in case the API always return 200 status code:
  // }, [query.error, query?.data?.success]);

  return query;
};
\`\`\`
`;export{e as default};
