title: Lazy React Router
date: 2021-07-12
intro: Inside a routed component, we introduce `useRouteMatch` on type annotation and the way to extract params. 

##### Routing in This Blog Page

The routing of this react application is controlled by the following single `router.ts` file:

```typescript
interface IRouter {
  path: string,
  component: () => JSX.Element,
  exact?: boolean,
  routes?: IRouter[]
}

const routers: IRouter[] = [
  {
    path: navRoutes.ROOT,
    component: MainContent,
    routes: [
      {
        path: navRoutes.ABOUT,
        component: About,
        exact: true
      },
      {
        path: navRoutes.SKILLS,
        component: Skills,
        exact: true
      },
      ...
      {
        path: `${navRoutes.BLOG}`,
        component: Blog,
        exact: false
      }
    ]
  }
]
```

Note that for a sub-routing to work, `exact: false` is important.

`MainContent` is the largest container where we want to switch from one component to another. Inside `Blog` there is a `Switch` component that is used to further render component inside `routes` props.

You may notice that each route contains an optional `routes` props, which is, originally, used to further change the content of a component by sub-routing (like this page, `/Blog/article-title` will route you to different article). 

I used to add another `Switch` in `Blog` component to achive this, but recently I find a much convenient way. I call this a lazy routing since it can really achive routing in an extremely lazy but cleaner way by using `useRouteMatch`.

The `Blog` component now has the following structure:

```typescript
export default () => {
  ...

  const match = useRouteMatch<{ matchedArticleTitle: string }>(
    `${navRoutes.BLOG}/:matchedArticleTitle`
  );
  const { matchedArticleTitle } = match?.params || { matchedArticleTitle: "" };

  const activeBlogArticleTitle = useSelector(
    (state: TRootState) => state.app.blog.activeBlogArticleTitle
  );
  const selectedArticle = articles.find(
    md => md.title === activeBlogArticleTitle
  );

  ...

  useEffect(() => {
    dispatch(appActions.updateBlog(
      { activeBlogArticleTitle: matchedArticleTitle }
    ));
  }, [matchedArticleTitle]);

  return (
    <div className="blog">
      ...
    </div >
  )
}
```

`useRouteMatch` catches the param in exactly the way we want. And this is cleaner than using `Route` in the sense that you can observe which route, in which way, affects this component directly inside the code of this component. 

Now on `matchedArticleTitle` changed, our `useEffect` hook will update the state of `activeBlogArticleTitle` in our `redux` store. And we can change our content based on this unique article name (as `selectedArticle` is changed).



