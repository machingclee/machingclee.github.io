const n=`---
title: Redux Toolkit Quick Setup
date: 2022-11-15
id: blog0107
tag: react
intro: Record the setup for redux toolkit.
---

### Dependency

\`\`\`text
yarn add @reduxjs/toolkit react-redux @types/react-redux
\`\`\`

### Folder Structures

<Center>
  <img src="/assets/tech/107-reduxtoolkit/2022-11-15_040250.png"/>
</Center>

<p/>

#### hooks.ts

\`\`\`js
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './store';

// Use throughout your app instead of plain \`useDispatch\` and \`useSelector\`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
\`\`\`

#### store.ts

\`\`\`js
import { configureStore, ThunkAction, Action } from "@reduxjs/toolkit";
import dictSlice from "../slices/dictSlice";

export const store = configureStore({
  reducer: {
    dict: dictSlice.reducer,
  },
  devTools: true,
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
\`\`\`

#### dictSlice.ts

The following is a simple start-up template:

\`\`\`js
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type DictState = {
  selectedNoteId: string,
  selectedPageId: string,
  selectedVocabId: string,
  imageText: string,
  searchText: string,
};

const initialState: DictState = {
  selectedNoteId: "",
  selectedPageId: "",
  selectedVocabId: "",
  imageText: "",
  searchText: "",
};

const dictSlice = createSlice({
  name: "dict",
  initialState,
  reducers: {
    setSearchText: (state, action: PayloadAction<string>) => {
      state.searchText = action.payload;
    },
  },
});

export default dictSlice;
\`\`\`

#### util/registerEffects.ts

\`\`\`js
import {
    AnyAction,
    ListenerEffect,
    ListenerMiddlewareInstance,
    ThunkDispatch,
    isAnyOf
} from "@reduxjs/toolkit";
// import msgUtil from "./msgUtil";
// import appSlice from "../redux/slices/appSlice";

type Effect = ListenerEffect<any, unknown, ThunkDispatch<unknown, unknown, AnyAction>, unknown>;

/**
 * actionMessageList consists of objects either of the form { action, content } or  of the form { rejections } / { rejections, content }. When content is absent, the error message is supposed to be returned by thunkAPI.rejectWithValue
 * in createAsyncThunk function.
 */
const messageDispatch = ({ contentType, content }: { contentType: string, content: string }) => {
    if (contentType === "sucesss") {
        // snackbarUtils.success(content)
    } else if (contentType === "info") {
        // snackbarUtils.info(content)
    } else if (contentType === "warning") {
        // snackbarUtils.warning(content)
    } else if (contentType === "error") {
        // snackbarUtils.error(content);
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
                            errMsg += \` (Reason: \${msg})\`;
                            if (msg) {
                                msgUtil.error(msg);
                            }
                        }
                    }
                })
            }

        }
    }
}
\`\`\`
`;export{n as default};
