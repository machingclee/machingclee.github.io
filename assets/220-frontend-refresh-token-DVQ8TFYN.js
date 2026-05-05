const e=`---
title: "Frontend Retry Mechanism for Refresh Token"
date: 2023-11-20
id: blog0220
tag: jwt
intro: "Record the actual implementation in frontend for fail > refresh access-token > retry."
toc: false
---

### The Key in Error Interceptor

The trick is to set

\`\`\`js
const originalConfig = error.config;
\`\`\`

in the axios response interceptor, and at the end we return

\`\`\`js
originalConfig._retry = true;
apiclient(originalConfig);
\`\`\`

### The Code

\`\`\`js
import axios, { AxiosInstance } from 'axios'
import { ReduxToolkitStore, RootState } from '../redux/app/store';
import apiRoutes from './apiRoutes';
import { WBResponse } from './responseTypes';
import msgUtil from '../util/msgUtil';
import authSlice from '../redux/slices/authSlice';

const { EXPO_PUBLIC_BACKEND_URL: baseURL } = process.env;

const apiClient = axios.create({
    baseURL,
    responseEncoding: "utf8",
    headers: { 'Content-type': 'application/json' },
})

apiClient.defaults.withCredentials = true;
const chatSocketRef = { current: "" };
const notificationSocketRef = { current: "" };

// inject store into interceptor at _layout.tsx
export const configApiClient = (apiClient: AxiosInstance, store: ReduxToolkitStore) => {
    ...
    apiClient.interceptors.response.use(
        response => response,
        async error => {
            const originalConfig = error.config;
            if (
                error?.response?.status === 403 ||
                error?.response?.status === 401
            ) {
                const errorMessage = error?.response?.data?.errorMessage || "";
                if (errorMessage === "JWT_EXPIRED") {
                    originalConfig._retry = true;
                    const refreshToken = (store?.getState() as RootState)?.auth.refreshToken;
                    const res = await apiClient.post<WBResponse<{ accessToken: string }>>(apiRoutes.POST_REFRESH_TOKEN, { refreshToken });
                    const { success } = res.data;
                    if (!success) {
                        msgUtil.error(res.data.errorMessage || "");
                    } else {
                        const { result } = res.data;
                        const newAccessToken = result.accessToken;
                        store.dispatch(authSlice.actions.setAccessToken(newAccessToken));
                        return apiClient(originalConfig);
                    }
                }
            } else if (error?.response?.status === 404) {
                //404 page
            } else if (error?.response?.status === 500) {
                //do nothing
            } else {
                // snackbarUtils.info("Please try to login again");
            }
            return Promise.reject(error)
        }
    )
}

export default apiClient
\`\`\`
`;export{e as default};
