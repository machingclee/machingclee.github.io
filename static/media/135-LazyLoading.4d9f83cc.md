---
title: "Lazy Loading"
date: 2023-06-11
id: blog0135
tag: react
intro: "Record the detailed implementation of lazy loading."
toc: true
---

#### Visual Demo of a Users Page

<video type="video/webm" width="100%" controls>
    <source src="/assets/tech/135/01.mp4" type="video/mp4">
</video>

#### Implementation of the Users Page with Lazy Loading

1. Construct the following element in the bottom:

   ```html
   <div id="bottom-element" ref="{bottomEleRef}" />
   ```

2. Construct an observer and let it observe this bottom element in the whole life:

   ```jsx
   const bottomEleRef = useRef < HTMLDivElement > null;
   const observerRef =
     useRef <
     IntersectionObserver >
     new IntersectionObserver((entries) => {
       if (entries.length > 0 && entries[0].intersectionRatio > 0) {
         page.current += 1;
         dispatch(
           wbuserThunkActions.getNextBatchOfUsers({
             page: page.current,
             limit: config.usersPerPage,
           })
         );
       }
     });
   ```

   We will give the detail of wbuserThunkActions.getNextBatchOfUsers in a while.

3. Register the listener to observe the bottom element:

   ```jsx
   useEffect(() => {
     if (bottomEleRef.current && observerRef.current) {
       observerRef.current.observe(bottomEleRef.current);
     }
   }, []);
   ```

4. Once bottom is scrolled into view, the thunk action that we will dispatch:

   ```js
   export const wbuserThunkActions = {
       ...,

       getNextBatchOfUsers: createAsyncThunk(
           "get-next-batch-users",
           async (
               { page, limit }: { page: number, limit: number },
               thunkAPI
           ) => {
               const res = await apiClient.get<GetWBUsersResponse>(GET_USERS(page, limit));
               const { result } = res.data;
               const { users } = result;
               return users;
           }
       )
   }
   ```

5. We then save the result in `extraReducers` into redux store.

   ```js
   extraReducers: (builder) => {
       ...

       builder.addCase(wbuserThunkActions.getNextBatchOfUsers.fulfilled, (state, action) => {
           const _users = lodash.cloneDeep(state.users);
           const newUsers = reformatRightAndRole(action.payload);
           state.users = _users.concat(newUsers);
       })
   }
   ```

#### Complete Code

```jsx
export default function Users() {
    const classes = useStyles();
    const dispatch = useAppDispatch();
    const page = useRef<number>(1);
    useEffect(() => {
        dispatch(wbuserThunkActions.getUsers({ page: 1, limit: config.usersPerPage, search: "" }));
        dispatch(wbuserThunkActions.fetchCompanyCodeNameDictionary());
    }, []);
    const users = useAppSelector(s => s.wbusers.users);
    const searchField = useAppSelector(s => s.wbusers.searchField);
    const bottomEleRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver>()

    useEffect(() => {
        if (bottomEleRef.current && observerRef.current) {
            observerRef.current.unobserve(bottomEleRef.current);
        }
        if (bottomEleRef.current) {
            observerRef.current = new IntersectionObserver(entries => {
                if (entries.length > 0 && entries[0].intersectionRatio > 0) {
                    page.current += 1;
                    dispatch(wbuserThunkActions.getUsers({ page: page.current, limit: config.usersPerPage, search: searchField }))
                }
            })
            observerRef.current.observe(bottomEleRef.current);
        }
    }, [searchField])


    useEffect(() => {
        return () => {
            dispatch(wbuserSlice.actions.reset());
        }
    }, [])

    useEffect(() => {
        page.current = 1;
        dispatch(wbuserThunkActions.getUsers({ page: page.current, limit: config.usersPerPage, search: searchField }))
    }, [searchField])



    return (<div className={classnames(classes.userTable)}>
        <Spacer height={5} />
        <WBUserSearchField />
        <Spacer height={40} />
        <WbTable style={{ marginRight: 10 }}>
            <tr>
                <th>First Name</th>
                <th>Last Name</th>
                <th className="roles">Role</th>
                <th>Company </th>
                <th className="username">User Name</th>
                <th>Unofficial</th>
                <th>Admin Portal</th>
                <th>Public</th>
            </tr>
            <tbody>
                {users.map(u => <WBUserRow user={u} />)}
            </tbody>
        </WbTable >
        <div id="bottom-element" ref={bottomEleRef} />
    </div>);
}
```
