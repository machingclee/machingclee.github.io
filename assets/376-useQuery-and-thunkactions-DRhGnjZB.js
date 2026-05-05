const e=`---
title: "Combine useQuery and Redux Toolkit Thunk Actions"
date: 2025-03-21
id: blog0376
tag: react, redux, react-query
toc: true
intro: "We discuss how to bring the power of caching/debouncing, the cahcing and cache-invalidatin, and also the handy booleans like \`isLoading\` of react query into world of react thunk actions."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Why we still want redux, why not separation of app state and server state?

#### From theo: You still use redux? An introduction to state separation

The following from **theo-t3.gg** gives a brief introduction to the concept of \`app state\` and \`server state\`:

- [You still use Redux?, youtube](https://www.youtube.com/watch?v=5-1LM2NySR0)

The mix of \`zustand\` and \`react-query\` is a typical solution to handling both states separately, instead of storing everything into a single store.

#### Objective of this article

For me storing everything in redux and accessing cached/unstaled data are all what I need. In this article we discuss how to:

> **_Sync_** the cache from \`react-query\` back to redux store.

And most importantly:

> We don't want to introduce **_any_** complexity coming from redux's \`RTK-query\`, which simply mimic react-query with much complex syntax.

What I **_hate_** \`RTK-qury\` so much: The _auto-generated_ \`useXXXQuery\`'s and \`useXXXMutation\`'s can never be located properly in the IDE, making the debug process very unpleasant.

And finally:

> - Create a hook to wrap a thunk into a \`useQuery\` call, the purpose is to **_debounce_** and do the **_caching_** properly, while keeping the project structure **_unchanged_**.
>
> - Namely, we still transform data into redux store and get the data from the redux store as usual.

### Custom Hooks

#### useBaseQuery (a wrapper of useQuery, we abstract the most basic needs out)

Our first hook wraps up the \`useQuery\` method to reduce boilerplate code:

\`\`\`tsx
// useBaseQuery
export default <T,>(props: {
  queryKey: string[];
  queryFn: () => Promise<T>;
  onDataChanged?: (data: T) => void;
  gcTime?: number;
  enabled: boolean;
  staleTime?: number;
}) => {
  const {
    queryFn,
    queryKey,
    gcTime = 100,
    staleTime = 100,
    onDataChanged,
    enabled,
  } = props;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryFn: async () => {
      return await queryFn();
    },
    queryKey,
    gcTime,
    staleTime,
    enabled,
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
\`\`\`

#### useQueryThunk

##### hashUtil.ts

In the sequel we will be using the thunkAction name as first part of our react-query key

[![](/assets/img/2025-03-24-00-36-27.png)](/assets/img/2025-03-24-00-36-27.png)

which can be accessed by \`thunkAction.typePrefix\`. Our next part will be the param that make our API call, which will be hashed into a string as the second part of our query key:

\`\`\`tsx
// hasuUtil
import sha256 from "crypto-js/sha256";

const hash = (jsonObj: object) => {
  const sortedJsonStr = JSON.stringify(jsonObj, Object.keys(jsonObj).sort());
  return sha256(sortedJsonStr).toString();
};

export default {
  hash,
};
\`\`\`

Our target key will be of the form \`[thunkAction.typePrefix, hashUtil.hash(reqParam)]\`

##### Our Hook

Let's define the following target hook:

\`\`\`tsx
// eslint-disable-next-line react-refresh/only-export-components
export default <ThunkInputParam, ReturnType>(param: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    thunk: AsyncThunk<ReturnType, ThunkInputParam, any>;
    staleTime?: number;
    enabled?: boolean;
  }) =>
  (inputParam?: ThunkInputParam) => {
    const { thunk, staleTime = 1000, enabled = true } = param;
    const dispatch = useAppDispatch();
    return useBaseQuery({
      queryKey: [thunk.typePrefix, hashUtil.hash(inputParam || {})],
      queryFn: async () => {
        // @ts-expect-error, don't try to handle the error
        const res = (await dispatch(
          inputParam ? thunk(inputParam) : thunk()
        ).unwrap()) as ReturnType;
        return res;
      },
      onDataChanged: (data) => {
        const requestID = crypto.randomUUID() || Math.random() + "";
        // eslint-disable-next-line
        dispatch(thunk.fulfilled(data, requestID, inputParam as any));
      },
      enabled,
      gcTime: staleTime,
      staleTime: staleTime,
    });
  };
\`\`\`

- By default each data change of \`useQuery\` will invoke the \`fulfilled\` method of each thunk
  to change the state in redux, this is accomplished in our \`onDataChanged\` part.

  This handles the niche case that when the \`staleTime\` of a cache has not been reached,

  - no API call has been invoked;
  - the react-query state (data part) has changed but state in redux-store does not change.

- We have made sure the change of react-query data is reflected to the state in redux-store.

- At the end the wrapper is simply calling \`useQuery({..., queryFn})\`, with queryFn being the dispatched thunk action.
- Default \`staleTime\` and \`gcTime\` are set to 1000 to bring the debounce capability to thunk actions.

### Usecases

#### Case 1: In the past

[![](/assets/img/2025-03-23-12-11-48.png)](/assets/img/2025-03-23-12-11-48.png)

#### Case 1: Now (much succinct)

[![](/assets/img/2025-03-23-12-13-13.png)](/assets/img/2025-03-23-12-13-13.png)

- Note that you can still get access to the \`invalidation\` function and the \`query\` object from \`react-query\` as usual.

- It is not strictly necessary to pass the data to redux store and get the data from the store.

#### Case 2: In the past

Our custom hook \`useQueryThunk\` also caters for the case of empty input parameters:

[![](/assets/img/2025-03-23-12-18-04.png)](/assets/img/2025-03-23-12-18-04.png)

#### Case 2: Now

[![](/assets/img/2025-03-23-12-17-15.png)](/assets/img/2025-03-23-12-17-15.png)

#### Case 3: The \`enabled: false\` option in react query to prevent API call

By using our \`useQueryThunk\` hook the only way to make sure everything gets refetched is to invalidate the \`queryKey\`.

Some component does not need the query data, but they do need the cache-invalidation method. For that we pass \`enabled: false\` as follows:

[![](/assets/img/2025-03-24-00-42-58.png)](/assets/img/2025-03-24-00-42-58.png)

Note that **_query_** with \`{ enabled: false }\` option will **_never_** get updated until we execute \`query.refetch()\`. In our case since our component only want to invalidate caches, no refetch is needed:

[![](/assets/img/2025-03-24-00-46-59.png)](/assets/img/2025-03-24-00-46-59.png)

Not only that, \`query.refetch()\` simply refreshes data, it does not update \`staleTime\` and \`gcTime\`, which can potentially cause unexpected behaviour.
`;export{e as default};
