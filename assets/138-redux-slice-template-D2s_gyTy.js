const n=`---
title: "Redux Slice Template"
date: 2023-06-13
id: blog0138
tag: react
intro: "Record my template of redux slice."
toc: false
---

\`\`\`javascript
import { PayloadAction, createAsyncThunk, createListenerMiddleware, createSlice, isAnyOf } from "@reduxjs/toolkit"
import appSlice from "./appSlice"

type State = {
    sth: string
}
const initialState: State = {
    sth: ""
}

const slice = createSlice(
    {
        name: "sth",
        initialState,
        reducers: {
            reset: (state) => {
                return initialState
            }
        },
        extraReducers: (builder) => {
            builder.addCase(someThunkAction.fetchSth.fulfilled, (state, action) => {

            })
        }
    }
)

export const someThunkAction = {
    fetchSth: createAsyncThunk("get-sth", async () => {

    })
}

const someMiddleware = createListenerMiddleware();

someMiddleware.startListening({
    matcher: isAnyOf(
        someThunkAction.fetchSth.fulfilled,
    ),
    effect: async (action, listenerApi) => {
        listenerApi.dispatch(appSlice.actions.updateNotification(
            {
                open: true,
                content: "Loaded."
            }
        ))
    }
});

export default slice;
\`\`\`
`;export{n as default};
