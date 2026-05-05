const n=`---
title: "Write Middlewares in Redux-Toolkit"
date: 2023-06-20
id: blog0132
tag: react
intro: "We list sample usage of createThunkAction provided by redux-toolkit in order to single out the logic of data-fetching away from the UI component."
toc: true
---
### Thunk Actions and Extra Reducer for the Return
#### Write Data-Fetching in Slices

As a usual practice we create \`ThunkAction\` in the corresponding slice file, for example:

\`\`\`typescript
// projectSlice.ts

export const fetchProjects = createAsyncThunk(
  "posts/fetchProjects",
  async () => {
    // apiClient: an axio instance with baseUrl configured
    const response = await apiClient.get<ProjectResponse[]>(GET_PROJECTS);
    return response.data;
  }
);
\`\`\`

#### Limitation of Using ExtraReducer to Listen \`fetchProjects.fulfilled\`

When reading documentation ([link](https://redux-toolkit.js.org/api/createAsyncThunk)) we are instructed to create listener as follows:

\`\`\`typescript
// sample code from official tutorial

extraReducers: (builder) => {
  // Add reducers for additional action types here, and handle loading state as needed
  builder.addCase(fetchProjects.fulfilled, (state, action) => {
    // Add the result to the state
    state.entities.push(action.payload);
  });
};
\`\`\`

However, this approach does not allow dispatching additional action, not even speak of influencing the state in other slices.

For example, we want to open a \`<Loading/>\` dialog during data-fetching, but the \`open\` state lives in another \`applicationSlice\`. We cannot simply import \`store\` object and \`store.dispatch\` the open-dialog action because \`store\` needs to be created by our current \`slice\`, namely, circular import will occur.

### Work Around: Write a Middleware for fetchProjects.fulfilled

We instead listen to \`fetchProjects.fulfilled\` by creating a middleware as follows, this is very similar to \`redux-saga\` (but mutch easier):

\`\`\`typescript
// projectSlice.ts

export const projectMiddleware = createListenerMiddleware();

projectMiddleware.startListening({
  actionCreator: fetchProjects.pending,
  effect: (action, listenerApi) => {
    listenerApi.dispatch(
      appSlice.actions.updateNotification({ open: true, content: "Loading..." })
    );
  },
});
projectMiddleware.startListening({
  actionCreator: fetchProjects.fulfilled,
  effect: (action, listenerApi) => {
    listenerApi.dispatch(appSlice.actions.updateNotification({ open: false }));
  },
});
\`\`\`

Now we are free to dispatch any action that adjusts the state of other slices.

> **Important.** Note that we can \`startListening()\` multiple times using the same middleware. There is no need to create multiple middlewares for multiple actions.

#### Add Middlewares to Store

\`\`\`typescript
// store.ts;
// real use case, ignore the other slices

const store = configureStore({
	reducer: rootReducer,
	middleware: (getDefaultMiddleware) =>
		//@ts-ignore
		getDefaultMiddleware({
			serializableCheck: false
		}).concat(
			projectMiddleware.middleware,
			someOtherMiddleware.middleware
		)
});
\`\`\`

#### Share a Middleware for Multiple Actions by \`matcher\` and \`isAnyOf\`

In the section <a href="#Work-Around:-Write-a-Middleware-for-fetchProjects.pending">Work Around: Write a Middleware for fetchProjects.pending</a> we:

- wrote a single middleware for a \`fetchProjects.pending\` action,

But the same effect should be shared amount actions like \`updateProjects.pending\`, \`deleteProject.pending\`, and even CRUD for all other entities. We can collect all those thunk actions and create middlewares specifically for all data-fetching logic:

\`\`\`typescript
//store.ts

const projectMiddleware = createListenerMiddleware();

const pendingActions = [
  fetchProjects.pending,
  fetchPages.pending,
  fetchStudents.pending,
  fetchCompanies.pending,
];

const fulfilledActions = [
  fetchProjects.fulfilled,
  fetchPages.fulfilled,
  fetchStudents.fulfilled,
  fetchCompanies.fulfilled,
];

projectMiddleware.startListening({
  matcher: isAnyOf(...pendingActions),
  effect: (action, listenerApi) => {
    listenerApi.dispatch(
      appSlice.actions.updateNotification({ open: true, content: "Loading..." })
    );
  },
});

projectMiddleware.startListening({
  matcher: isAnyOf(...fulfilledActions),
  effect: (action, listenerApi) => {
    listenerApi.dispatch(
      appSlice.actions.updateNotification({ open: true, content: "Loaded" })
    );
  },
});
\`\`\`

### Further Simplification for Writing Middleware to Handler Multiple Actions

Sometimes we have fine-grained notification pop-up messages for different thunk actions. It is tedious to write \`\`someMiddle.startListening({...\` for each of the actions.

For not to repeat writing the same code block, we write a helper function:

\`\`\`typescript
import {
    AnyAction,
    ListenerEffect,
    ListenerMiddlewareInstance,
    ThunkDispatch,
    isAnyOf
} from "@reduxjs/toolkit";
import snackbarUtils from "./snackbarUtils";

type Effect = ListenerEffect<any, unknown, ThunkDispatch<unknown, unknown, AnyAction>, unknown>;

/**
 * actionMessageList consists of objects either of the form { action, content } or  of the form { rejections } / { rejections, content }. When content is absent, the error message is supposed to be returned by thunkAPI.rejectWithValue
 * in createAsyncThunk function.
 */

const messageDispatch = ({ contentType, content }: { contentType: string, content: string }) => {
    if (contentType === "sucesss") {
        snackbarUtils.success(content)
    } else if (contentType === "info") {
        snackbarUtils.info(content)
    } else if (contentType === "warning") {
        snackbarUtils.warning(content)
    } else if (contentType === "error") {
        snackbarUtils.error(content);
    }
}


export default (
    middleware: ListenerMiddlewareInstance<
        unknown,
        ThunkDispatch<unknown, unknown, AnyAction>,
        unknown
    >,
    actionMessageList: {
        action?: any,
        rejections?: any[],
        content?: string
        effect?: Effect
        contentType?: "sucesss" | "info" | "error" | "warning"
    }[]
) => {
    for (const actionMessage of actionMessageList) {
        const { action, rejections, content, effect, contentType = "sucesss" } = actionMessage;

        if (action) {
            let effect_: Effect;
            if (effect) {
                effect_ = effect;
            } else if (content) {
                effect_ = async (action, { dispatch }) => {
                    messageDispatch({ contentType, content })
                    // dispatch(appSlice.actions.updateNotification(
                    //     { open: true, content: content || "No Message" }
                    // ))
                };
            } else {
                effect_ = async (action, thunkAPI) => { };
            }

            middleware.startListening({ actionCreator: action, effect: effect_ });

        } else if (rejections) {
            if (effect) {
                // @ts-ignore
                middleware.startListening({ matcher: isAnyOf(...rejections), effect });
            } else {
                middleware.startListening({
                    // @ts-ignore
                    matcher: isAnyOf(...rejections),
                    effect: async (action, { dispatch }) => {
                        if (content) {
                            messageDispatch({ contentType, content })
                            // dispatch(appSlice.actions.updateNotification(
                            //     { open: true, content: content || "No Message" }
                            // ))
                        } else {
                            const msg = action?.payload || "";
                            let errMsg = "Failed";
                            if (msg) {
                                errMsg += \` (Reason: \${msg})\`;
                            }
                            snackbarUtils.error(errMsg)
                            // dispatch(appSlice.actions.updateNotification(
                            //     { open: true, content: errMsg }
                            // ))
                        }
                    }
                })
            }

        }
    }
}
\`\`\`
We are now happy writing multiple middlewares:

\`\`\`typescript
export const companyMiddleware = createListenerMiddleware();
registerEffects(
    companyMiddleware,
    [
        {
            action: companyThunkAction.updateCompany.pending,
            content: "Updating Company ..."
        },
        {
            action: companyThunkAction.updateCompany.fulfilled,
            content: "Updated."
        },
        {
            action: companyThunkAction.fetchCompanies.pending,
            content: "Getting companies ..."
        },
        {
            action: companyThunkAction.fetchCompanies.fulfilled,
            content: "Loaded."
        },
        {
            action: companyThunkAction.uploadGenericFile.pending,
            content: "Uploading..."
        },
        {
            action: companyThunkAction.uploadGenericFile.fulfilled,
            content: "Updated"
        },
        {
            action: companyThunkAction.createCompany.pending,
            content: "Creating Company ..."
        },
        {
            rejections: [companyThunkAction.createCompany.rejected]
        }
    ]
)
\`\`\`

- For \`actions\`:
  - If we provide \`content\`, then the listener will pop-up a notification with \`content\` as the message.
  - If we provide \`effect\`, then it will not pop-up notification and use custom \`effect\` instead.
- For \`rejections\`:
  - If we just have \`rejections\`, the message is supposed to be the error message passed from \`thunkAPI.rejectWithValue\` in createAsyncThunk function.
  - If we pair \`rejections\` with \`content\`, then it will show our \`content\` as pop-up notification.


### Middleware that Handles all Rejected Actions (Optional)

We usually learn how to react to all api error in axios by using interceptor:

\`\`\`js
apiClient.interceptors.response.use(
    function (response) {
      const param = {
            url: response.config.url,
            data: response.data,
        }

        if (\`\${process.env.REACT_APP_ENV}\` === 'LOCAL') {
            if (response?.data?.success === false) {
                
            } else {
                
            }
        }
    },
    function (error) {
        if (error?.response?.status === 404) {
            //404 page
        }
    }
)
\`\`\`
We can instead handle all rejected api requests by middleware (provided that all api calls are processed by thunk actions)

\`\`\`js
import { createListenerMiddleware, isRejected } from "@reduxjs/toolkit";
import snackbarUtils from "../../util/snackbarUtils";
import { loginUrl } from "../../app/__paths__deprecated";
import { getHistory } from "../../util/historyUtils";
import authSlice from "../slices/authSlice";

const errorCodeRegex = /(?<=status\\scode\\s)\\d+/gi

export const errorMiddleware = createListenerMiddleware();

errorMiddleware.startListening({
    matcher: isRejected,
    effect: async (action, { dispatch }) => {
        const history = getHistory();
        const { error } = action;
        const { message, stack } = error;
        if (message) {
            // sample message: Request failed with status code 401
            const mathches = message.match(errorCodeRegex);
            const errorCode = parseInt(mathches?.[0] || "0");

            if (
                errorCode === 403 ||
                errorCode === 401
            ) {
                console.log('403 401 redirect: ' + loginUrl)
                dispatch(authSlice.actions.reset());
                history?.push(loginUrl);
            } else if (errorCode === 404) {
                //404 page
            } else if (errorCode === 500) {
                //do nothing
            } else {
               
            }
        }
        if (stack) {
            snackbarUtils.error(stack);
        }
    }
});
\`\`\`
This will be helpful if we are going to handle a very general error flow like 
- expiration of access-token
- make an api call to refresh access-token
- ***resume the action again***, etc.
`;export{n as default};
