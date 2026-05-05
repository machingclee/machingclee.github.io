const e=`---
title: Migrate from ThunkActions to RTK-Query
date: 2025-06-21
id: blog0400
tag: react
toc: true
intro: "A simple introduction to rtk-query"
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px
  }
</style>

### \`createApi\` with an Query Endpoint

This section simple records the definition of \`apiClient\` nand \`baseQuery\`, they are not the focus of this article and we have no further dicussion on their implementation.


#### \`apiClient\`

As usual we define a basic api client which handles important logic such as aborting a call when there is no token in the header, or retry the api call once access-token expired.

\`\`\`ts
import axios, { AxiosInstance } from 'axios';
import type { ReduxToolkitStore, RootState } from '../redux/store';
import apiRoutes from './apiRoutes';
import { CustomResponse } from './responseTypes';
import getEnv from '../utils/getEnv';

const baseURL = getEnv().VITE_BACKEND_URL || '';
console.log('baseURLbaseURLbaseURL', baseURL);

declare module 'axios' {
    interface AxiosInstance {
        post<T = any, D = any>(url: string, data?: D): Promise<AxiosResponse<T, D>>;
    }
    interface AxiosInstance {
        put<T = any, D = any>(url: string, data?: D): Promise<AxiosResponse<T, D>>;
    }
}

export const loginApiClient = axios.create({
    baseURL,
    responseEncoding: 'utf8',
    headers: {
        'Content-type': 'application/json',
    },
});

const apiClient = axios.create({
    baseURL,
    responseEncoding: 'utf8',
    headers: {
        'Content-type': 'application/json',
    },
});

apiClient.defaults.withCredentials = true;

export const configApiClient = (apiClient: AxiosInstance, store: ReduxToolkitStore) => {
    apiClient.interceptors.request.use(req => {
        const token = store?.getState()?.auth?.accessToken || '';
        if (token) {
            req.headers['Authorization'] = 'Bearer ' + token;
            return req;
        } else {
            return Promise.reject('Request Cancelled');
        }
    });

    apiClient.interceptors.response.use(
        response => response,
        async error => {
            const originalConfig = error.config;
            if ((error?.response?.status === 403 || error?.response?.status === 401) && !originalConfig._retry) {
                const errorMessage = error?.response?.data?.errorMessage || '';
                if (errorMessage === 'JWT_EXPIRED') {
                    originalConfig._retry = true;
                    const refreshToken = (store?.getState() as RootState)?.auth.refreshToken;
                    const res = await apiClient.post<CustomResponse<{ accessToken: string }>>(
                        apiRoutes.POST_REFRESH_TOKEN,
                        { refreshToken }
                    );
                    const { success } = res.data;
                    if (!success) {
                        if (res.data.errorMessage === 'jwt expired') {
                            // this error message comes from .verify() method for refresh token,
                            // which means that user must be logged out since there is no way the user can get information
                            setTimeout(() => {
                                // msgUtil.persistedError("Session expired, please login again");
                                console.log('dispatch reset action');
                                store.dispatch({ type: 'auth/reset' });
                                setTimeout(() => {
                                    store.dispatch({
                                        type: 'app/closeLoading',
                                    });
                                }, 1);
                            }, 1000);
                        }
                    } else {
                        const { result } = res.data;
                        const newAccessToken = result.accessToken;
                        // avoid cycle dependecies.
                        const action = (token: string) => {
                            return {
                                type: 'auth/setClientAccessToken',
                                payload: token,
                            };
                        };
                        store.dispatch(action(newAccessToken));
                        return apiClient(originalConfig);
                    }
                }
            } else if (error?.response?.status === 404) {
                //404 page
            } else if (error?.response?.status === 500) {
                //do nothing
            } else {
            }
            return Promise.reject(error);
        }
    );
};

export default apiClient;
\`\`\`

#### \`baseQuery\`


This is a new component when we try to use RTK-Query. 

Since our apis are designed to return 
- \`{ success: boolean, errorMessage?: string, result: any }\`,

to simplify our implementation when using RTK-Query we extract the \`res.data.result\` from axios response to \`baseQuery\`.

\`\`\`ts
import { BaseQueryFn } from '@reduxjs/toolkit/query';
import { AxiosError, AxiosRequestConfig } from 'axios';
import apiClient from './apiClient';
import { CustomResponse } from './responseTypes';

const baseQuery: BaseQueryFn<
    | {
          url: string;
          method?: AxiosRequestConfig['method'];
          // for post, put, patch, it's called body in fetchBaseQuery but it's called data in axios, so we need to transform it
          body?: AxiosRequestConfig['data'];
          params?: AxiosRequestConfig['params'];
          headers?: AxiosRequestConfig['headers'];
      }
    | string,
    unknown,
    {
        status?: number | string;
        message: string;
    }
> = async args => {
    let config: AxiosRequestConfig = {};
    if (typeof args === 'string') {
        config = { url: args, method: 'get' };
    } else {
        config = {
            url: args.url,
            method: args.method,
            data: args.body,
            params: args.params,
            headers: args.headers,
        };
    }
    try {
        const result = (await apiClient(config)).data as CustomResponse<unknown>;
        if (result.success) {
            return { data: result.result };
        } else {
            return {
                error: {
                    status: 'server-error',
                    message: result.errorMessage || 'Server error',
                },
            };
        }
    } catch (err: unknown) {
        if (err instanceof AxiosError) {
            return {
                error: {
                    status: err.response?.status,
                    message: err.message,
                },
            };
        } else {
            return {
                error: {
                    status: 'unknown',
                    message: (err as Error).message || 'Unknown error',
                },
            };
        }
    }
};

export default baseQuery;
\`\`\`



### The \`studentApi\` Object



#### With an exmaple of query endpoint

\`\`\`ts
import { createApi } from '@reduxjs/toolkit/query/react';
\`\`\`

\`\`\`ts
export const studentsApi = createApi({
    reducerPath: 'studentsQuery',
    baseQuery: baseQuery,
    tagTypes: [
        'Students',
        'StudentWeeklyClasses',
        'StudentClasses',
        'StudentPackages',
        'StudentDailyClasses',
        'StudentDetail',
    ],
    endpoints: builder => ({
        getStudentClassesForWeeklyTimetable: builder.query<
            // the api itself simpliy returns { classes: TimetableLesson[] }, 
            // the type here is the eventual type that the component 
            // consumes after transformResponse
            {
                hrUnixTimestampToLesson: { [id: string]: TimetableLesson };
                hrUnixTimestamps: string[];
            },
            { studentId: string }
        >({
            query: ({ studentId }) => apiRoutes.GET_STUDENT_CLASSES_FOR_WEEKLY_TIMETABLE(studentId),
            transformResponse: (response: { classes: TimetableLesson[] }) => {
                const { classes } = response;
                const { idToObject, ids } = normalizeUtil.normalize({
                    idAttribute: 'hourUnixTimestamp',
                    targetArr: classes,
                });
                return { hrUnixTimestampToLesson: idToObject, hrUnixTimestamps: ids };
            },
            providesTags: ['StudentWeeklyClasses'],
            keepUnusedDataFor: 60, // 60s
        }),
    })
})
\`\`\`
#### An example of mutation endpoint which updates the \`useQuery\` state of another query API

Very often when we make a small change to an item of a list we don't want to refetch that item into the list because:
- May have no such API at all
- Even we have such an API, the API for an item is not designed for the display of an entire list of items (might have incompatible fields)
- Fetching a list is expensive

And very often an update to the internal state will do. The way to do this in rtk-query is syntactically tricky:

\`\`\`ts
detachFromGroup: builder.mutation<{ hour_unix_timestamp: number }, DetachClassRequest>({
    query: ({ classId, studentId }) => ({
        url: apiRoutes.PUT_DETACH_CLASS_FROM_GROUP,
        method: 'PUT',
        body: { classId },
    }),
    onQueryStarted: async (
      // the input param in mutation
      { classId, studentId },
      // feasible tools, you may need the state from UI, 
      // from return value of the API, etc,               
      { dispatch, queryFulfilled, getState: _getState } 
    ) => {
        try {
            // this is the return value from the API call
            const { hour_unix_timestamp } = (await queryFulfilled).data;

            if (studentId) {
                dispatch(studentsApi.util.updateQueryData(
                    // the name of the endpoint
                    'getStudentClassesForWeeklyTimetable', 
                    // input param of the endpoint
                    { studentId },
                    draft => {
                        // state change without additional API call
                        if (draft.hrUnixTimestampToLesson?.[String(hour_unix_timestamp)]) {
                            draft.hrUnixTimestampToLesson![String(hour_unix_timestamp)]!.classGroup = null;
                        }
                    }));
            }
        } catch (error) {
            console.error('Error detaching class:', error);
        }
    },
    invalidatesTags: ['StudentPackages'],
}),
\`\`\`
#### API Call with customized config different from \`baseQuery\`

Our \`apiClient\` is designed to throw error (stop making request) when a token is not present in the header.

But for publicly accessible API we don't need a token, therefore for such endpoint we create custom \`queryFn\` to have  a refined logic:

\`\`\`ts
getStudentInfo: builder.query<UIStudentDetail, { studentId: string }>({
    queryFn: async ({ studentId }) => {
        try {
            const baseURL = getEnv().VITE_BACKEND_URL || '';
            const clientWithoutTokenChecking = axios.create({
                baseURL,
                headers: {
                    'Content-type': 'application/json',
                },
            });
            const response = await clientWithoutTokenChecking.get<CustomResponse<UIStudentDetail>>(
                apiRoutes.GET_STUDENT_INFO(studentId)
            );
            if (response.data.success) {
                return { data: response.data.result };
            } else {
                return {
                    error: {
                        status: 'server-error',
                        message: response.data.errorMessage || 'Server error',
                    },
                };
            }
        } catch (error: any) {
            return {
                error: {
                    status: error.response?.status || 'unknown',
                    message: error.message || 'Unknown error',
                },
            };
        }
    },
    providesTags: (_result, _error, { studentId }) => [{ type: 'StudentDetail', id: studentId }],
    keepUnusedDataFor: 60, // 60s
}),
\`\`\``;export{e as default};
