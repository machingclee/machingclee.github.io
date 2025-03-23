---
title: "Combine useQuery and Redux Toolkit Thunk Actions"
date: 2025-03-21
id: blog0376
tag: react, redux
toc: true
intro: "We discuss how to bring the power of caching/debouncing, the cahcing and cache-invalidatin, and also the handy booleans like `isLoading` of react query into world of react thunk actions."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

#### Why we still want redux, why not separation of app state and server state?

##### From theo: You still use redux? An introduction to state separation

The following from **theo-t3.gg** gives a brief introduction to the concept of `app state` and `server state`:

- [You still use Redux?, youtube](https://www.youtube.com/watch?v=5-1LM2NySR0)

The mix of `zustand` and `react-query` is a typical solution to handling both states separately, instead of storing everything into a single store.

But what if I want data from the UI (coming from the server) **_without_** making that API call again? We either set a incredibly large `staleTime` or store that data back into `zustand`.

Worse still there can be multiple places to perform data-postprocessing. They can come form `queryFn` in `react-query`, or come from custom methods in `create` factory of `zustand`.

However, back to redux:

- Every data post-processing happens in `fulfilled` handler of each thunk actions.
- We can add middleware to `pending` and `fulfill` actions for different purposes (the most easy yet common case would be adding a fullscreen loading spinner).

The use of `redux-toolkit` forcefully brought us to a unique architecture with less freedom and also decoupled the side-effect by registering those state changes to desired actions.

##### Objective of this article

For me storing everything in redux and accessing cached/unstaled (without extra api call) data are all what I need. In this article we discuss how to:

> **_Sync_** the cache from `react-query` back to redux store.

And most importantly:

> We don't want to introduce **_any_** complexity coming from redux's `RTK-query`, which simply mimic react-query with much complex syntax.

What I **_hate_** `RTK-qury` so much: The _auto-generated_ `useXXXQuery`'s and `useXXXMutation`'s can never be located properly in the IDE, making the debug process very unpleasant.

And finally:

> - Create a hook to wrap a thunk into a `useQuery` call, the purpose is to **_debounce_** and do the **_caching_** properly, while keeping the project structure **_unchanged_**.
>
> - Namely, we still transform data into redux store and get the data from the redux store as usual.

#### Custom Hooks

##### useBaseQuery (a wrapper of useQuery, we abstract the most basic needs out)

Our first hook wraps up the `useQuery` method to reduce boilerplate code:

```tsx
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export default <T,>(props: {
  queryKey: string[];
  queryFn: () => Promise<T>;
  onDataChanged?: (data: T) => void;
  gcTime?: number;
  staleTime?: number;
}) => {
  const {
    queryFn,
    queryKey,
    gcTime = 100,
    staleTime = 100,
    onDataChanged,
  } = props;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryFn: async () => {
      return await queryFn();
    },
    queryKey,
    gcTime,
    staleTime,
    refetchOnWindowFocus: false,
  });

  const invalidation = async () =>
    await queryClient.invalidateQueries({ queryKey });

  useEffect(() => {
    if (query.data) {
      onDataChanged?.(query.data);
    }
    // eslint-disable-next-line
  }, [query.data]);

  return { query, invalidation };
};
```

##### useQueryThunk

Let's define the following custom hook:

```tsx
// useQueryThunk
import { AsyncThunk } from "@reduxjs/toolkit";
import useBaseQuery from "./useBaseQuery";
import hashUtil from "../utils/hashUtil";
import { useAppDispatch } from "../redux/hooks";

export default <T,>(param: {
    thunk: AsyncThunk<any, T, any>;
    staleTime?: number;
  }) =>
  (req?: T) => {
    const { thunk, staleTime = 1000 } = param;
    const dispatch = useAppDispatch();
    return useBaseQuery({
      queryKey: [thunk.typePrefix, hashUtil.hash(req || {})],
      queryFn: async () => {
        // @ts-expect-error, don't try to handle the error
        const res = await dispatch(req ? thunk(req) : thunk()).unwrap();
        return res;
      },
      onDataChanged: (data) => {
        // eslint-disable-next-line
        dispatch(
          thunk.fulfilled(data, Math.random() + "", (req || null) as any)
        );
      },
      gcTime: staleTime,
      staleTime: staleTime,
    });
  };
```

- By default each data change of `useQuery` will invoke the `fulfilled` method of each thunk
  to change the state in redux, this is accomplished in our `onDataChanged` part.

  This handles the niche case that when the `staleTime` of a cache has not been reached,

  - no API call has been invoked;
  - the react-query state (data part) has changed but state in redux-store does not change.

  The change of react-query data should also be reflected to the state in redux-store.

- At the end the wrapper is simply calling `useQuery({..., queryFn})`, with queryFn being the dispatched thunk action.
- Default `staleTime` and `gcTime` are set to 1000 to bring the debounce capability to thunk actions.

#### Usecases

##### Case 1: In the past

[![](/assets/img/2025-03-23-12-11-48.png)](/assets/img/2025-03-23-12-11-48.png)

##### Case 1: Now (much succinct)

[![](/assets/img/2025-03-23-12-13-13.png)](/assets/img/2025-03-23-12-13-13.png)

- Note that you can still get access to the `invalidation` function and the `query` object from `react-query` as usual.

- It is not strictly necessary to pass the data to redux store and get the data from the store.

##### Case 2: In the past

Our custom hook `useQueryThunk` also caters for the case of empty input parameters:

[![](/assets/img/2025-03-23-12-18-04.png)](/assets/img/2025-03-23-12-18-04.png)

##### Case 2: Now

[![](/assets/img/2025-03-23-12-17-15.png)](/assets/img/2025-03-23-12-17-15.png)
