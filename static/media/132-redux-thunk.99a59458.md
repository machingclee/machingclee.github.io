---
title: "Write Middleware in Redux-Toolkit"
date: 2023-06-20
id: blog0132
tag: react
intro: "We list sample usage of createThunkAction provided by redux-toolkit in order to single out the logic of data-fetching away from the UI component."
toc: true
---

#### Write Data-Fetching in Slices

As a usual practice we create `ThunkAction` in the corresponding slice file, for example:

```typescript
// projectSlice.ts

export const fetchProjects = createAsyncThunk(
  "posts/fetchProjects",
  async () => {
    // apiClient: an axio instance with baseUrl configured
    const response = await apiClient.get<ProjectResponse[]>(GET_PROJECTS);
    return response.data;
  }
);
```

#### Problem of Using ExtraReducer to Listen `fetchProjects.pending`

When reading documentation ([link](https://redux-toolkit.js.org/api/createAsyncThunk)) we are instructed to create listener as follows:

```typescript
// sample code from official tutorial

extraReducers: (builder) => {
  // Add reducers for additional action types here, and handle loading state as needed
  builder.addCase(fetchUserById.fulfilled, (state, action) => {
    // Add user to the state array
    state.entities.push(action.payload);
  });
};
```

However, this approach does not allow dispatching additional action, not even speak of influencing the state in other slices.

For example, we want to open a `<Loading/>` dialog during data-fetching, but the `open` state lives in another `applicationSlice`. We cannot simply import `store` object and `store.dispatch` the open-dialog action because `store` needs to be created by our current `slice`, namely, circular import will occur.

#### Work Around: Write a Middleware for fetchProjects.fulfilled

We instead listen to `fetchProjects.fulfilled` by creating a middleware as follows, this is very similar to `redux-saga` (but mutch easier):

```typescript
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
```

Now we are free to dispatch any action that adjusts the state of other slices.

> **Important.** Note that we can `startListening()` multiple times using the same middleware. There is no need to create multiple middlewares for multiple actions.

#### Add Middlewares to Store

```typescript
// store.ts;
// real use case, ignore the other slices

export const store = configureStore({
  reducer: {
    user: persistedUserReducer,
    application: appSlice.reducer,
    projects: projectSlice.reducer,
    template: templateSlice.reducer,
    fakeTime: fakeTimeSlice.reducer,
  },
  devTools: true,
  //@ts-ignore, as we don't need to maintain this piece of code:
  middleware: (
    gDM //gDM stands for getDefaultMiddleware
  ) => gDM().concat(...templateMiddlewares, ...projectMiddlwares),
});
```

#### Share a Middleware for Multiple Actions by `matcher` and `isAnyOf`

In the section <a href="#Work-Around:-Write-a-Middleware-for-fetchProjects.pending">Work Around: Write a Middleware for fetchProjects.pending</a> we:

- wrote a single middleware for a `fetchProjects.pending` action,

But the same effect should be shared amount actions like `updateProjects.pending`, `deleteProject.pending`, and even CRUD for all other entities. We can collect all those thunk actions and create middlewares specifically for all data-fetching logic:

```typescript
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
```

#### Further Simplification of Writing Middlewares

Sometimes we have fine-grained notification pop-up messages for different thunk actions. It is tedious to write ``someMiddle.startListening({...` for each of the actions.

For not to repeat the coding block, we write a helper function:

```typescript
import { 
  AnyAction, ListenerEffect, 
  ListenerMiddlewareInstance, ThunkDispatch, isAnyOf 
} from "@reduxjs/toolkit"
import appSlice from "../redux/slices/appSlice"

type Effect = ListenerEffect<any, unknown, ThunkDispatch<unknown, unknown, AnyAction>, unknown>;

/**
 * actionMessageList consists of objects either of the form { action, content } or of the form { rejections } / { rejections, content }. For rejections when content is absent, the error message is supposed to be returned by thunkAPI.rejectWithValue
 * in createAsyncThunk function.
 */
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
    }[]
) => {
    for (const actionMessage of actionMessageList) {
        const { action, rejections, content, effect } = actionMessage;

        if (action) {
            let effect_: Effect;
            if (effect) {
                effect_ = effect;
            } else if (content) {
                effect_ = async (action, { dispatch }) => {
                    dispatch(appSlice.actions.updateNotification(
                        { open: true, content: content || "No Message" }
                    ))
                };
            } else {
                effect_ = async (action, thunkAPI) => { };
            }

            middleware.startListening({ actionCreator: action, effect: effect_ });
        } else if (rejections) {
            middleware.startListening({
                // @ts-ignore
                matcher: isAnyOf(...rejections),
                effect: async (action, { dispatch }) => {
                    if (content) {
                        dispatch(appSlice.actions.updateNotification(
                            { open: true, content: content || "No Message" }
                        ))
                    } else {
                        const msg = action?.payload || "";
                        let errMsg = "Failed";
                        if (msg) {
                            errMsg += ` (Reason: ${msg})`;
                        }
                        dispatch(appSlice.actions.updateNotification(
                            { open: true, content: errMsg }
                        ))
                    }
                }
            })
        }
    }
}
```
We are now happy writing multiple middlewares:

```typescript
export const companyMiddleware = createListenerMiddleware();
registerDialog(
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
```

- For `actions`:
  - If we provide `content`, then the listener will pop-up a notification with `content` as the message.
  - If we provide `effect`, then it will not pop-up notification and use custom `effect` instead.
- For `rejections`:
  - If we just have `rejections`, the message is supposed to be the error message passed from `thunkAPI.rejectWithValue` in createAsyncThunk function.
  - If we pair `rejections` with `content`, then it will show our `content` as pop-up notification.
