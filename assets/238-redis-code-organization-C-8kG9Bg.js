const e=`---
title: "Code Organization for Redis"
date: 2024-01-27
id: blog0238
tag: redis, nodejs
intro: "We study how to organize code for redis caching in a nodejs project"
toc: true
---

<style>
  img {
    max-width: 660px
  }
</style>

### File Structure 

- Similar to [Code Organization for RabbitMQ](/blog/article/Code-Organization-for-RabbitMQ), we will declare everything related to caching in side \`caching\` folder.

  ![](/assets/img/2024-01-27-17-21-45.png)

- In \`go-lang\` all folder will be a package, I find it to be a very nice convention.
- Usually the entry-point of a package will be a file named same as the package name, namely, \`some-package/some-package.ts\` (which we don't have in this case since we have nothing to initialize, unlike rabbitmq).


#### model/Caching.ts

\`\`\`js
import { getInitedRedis } from "../../redis/redis";
import logger from "../../util/logger";

const GENERAL_CACHING_DURATION = Number(process.env.GENERAL_CACHING_DURATION || "86400");

class Caching<CacheKey extends Object> {
    private identifierKey: string = "";
    private cacheKey: CacheKey | null = null;
    private customDelete?: (cannoicalUnink: (unlinkFunc: CacheKey) => Promise<number>, cacheKey: CacheKey) => Promise<void>;
    constructor(args: {
        identifierKey: string,
        customUnlink?: (cannoicalUnink: (unlinkFunc: CacheKey) => Promise<number>, cacheKey: CacheKey)
            => Promise<void>;
    }) {
        this.identifierKey = args.identifierKey;
        if (args.customUnlink) {
            this.customDelete = args.customUnlink;
        }
    }

    public setCacheKey = (key: CacheKey) => {
        this.cacheKey = key;
        return { getCache: this.get, setCache: this.set, clearCache: this.unlink, customClearCache: this.customUnlink };
    }

    private keyFromObject = (object: Object) => {
        return Object.entries(object).map(([key, value]) => \`\${key}=\${value}\`).join("&")
    }
    private getRedis = () => {
        return getInitedRedis();
    }

    private get = async () => {
        const redis = this.getRedis();
        if (!this.cacheKey) {
            throw new Error("Cache key has not been set yet");
        }
        const key = this.identifierKey + this.keyFromObject(this.cacheKey);
        logger.info(\`Get result from key: [\${key}]\`)
        return await redis.get(key);
    }

    private set = async (cache: string, expireInSeconds?: number) => {
        const redis = this.getRedis();
        if (!this.cacheKey) {
            throw new Error("Cache key has not been set yet");
        }
        const key = this.identifierKey + this.keyFromObject(this.cacheKey);
        await redis.set(key, cache, "EX", expireInSeconds || GENERAL_CACHING_DURATION)
    }

    private unlink = async () => {
        if (!this.cacheKey) {
            throw new Error("Cache key has not been set yet");
        }
        const key = this.identifierKey + this.keyFromObject(this.cacheKey);
        const redis = this.getRedis();
        await redis.unlink(key);
    }

    // 
    public cannonicalUnlink = async (cacheKey: CacheKey) => {
        const redis = this.getRedis();
        return await redis.unlink(this.identifierKey + this.keyFromObject(cacheKey));
    }

    private customUnlink = async () => {
        if (!this.customDelete) {
            await this.unlink();
        }
        const redis = this.getRedis();
        if (!this.cacheKey) {
            throw new Error("Cache key has not been set yet");
        }

        await this.customDelete?.(this.cannonicalUnlink, this.cacheKey);
    }
}

export default Caching
\`\`\`

Here \`customUnlink\` enables user of the class to designed his own cache-unlinking logic. We shall see this in the next section:



#### draftsCache.ts

- Here we define they type of key needed in caching and pass it via generic type argument.

- The \`customUnlink\` is to delete a number of pages simultaneously, instead of us executing the unlink logic page by page manaully.

- This file caches the \`user\`-dependent data, therefore an id is passed into the generic type.

\`\`\`js
import Caching from "./model/Caching";

const SESSIONS_N_CAHCHING_PAGE = Number(process.env.SESSIONS_N_CAHCHING_PAGE || "1");

const draftsCache = new Caching<{
    channelId: string,
    isAdmin: boolean,
    userId: string,
    page?: number,
}>({
    identifierKey: "USER_ID_DEPENDENT_UNPUBLISHED_INSTANT_ISSUES",
    customUnlink: async (cannoicalUnlink, currCacheKey) => {
        const { channelId, isAdmin, userId } = currCacheKey;
        await Promise.all(Array(SESSIONS_N_CAHCHING_PAGE).fill(null).map(
            (_, i) => cannoicalUnlink({ channelId, isAdmin, userId, page: i }))
        );
    }
});

export default draftsCache;
\`\`\`

#### nonDraftsCache.ts

This one is more or less the same as \`draftsCache.ts\` but it is caching \`user\`-independent 

\`\`\`js
import Caching from "./model/Caching";

const SESSIONS_N_CAHCHING_PAGE = Number(process.env.SESSIONS_N_CAHCHING_PAGE || "1");

const nonDraftsCache = new Caching<{
    channelId: string,
    isAdmin: boolean,
    page?: number,
}>({
    identifierKey: "USER_ID_INDEPENDENT_MESSAGES_SESSIONS",
    customUnlink: async (cannoicalUnlink, currCacheKey) => {
        const { channelId, isAdmin } = currCacheKey;
        await Promise.all(Array(SESSIONS_N_CAHCHING_PAGE).fill(null).map(
            (_, i) => cannoicalUnlink({ channelId, isAdmin, page: i })
        ));
    }
});

export default nonDraftsCache
\`\`\`




### Real Case: Caching Both User-Dependent and User-Independent Data

- Suppose that a page will show both \`draft\` messages as well as published messages known as \`nonDraft\` (the opposite).
- This kind of pages are difficult to cache because different users will fetch different data.
- User will see 
  - published messages (\`user\`-independent) and 
  - unpiblished draft messages (\`user\`-dependent).
- That means we need to create two caches to store different data.
- Not only that, they need to have separate logic to be invalidated.

#### Caching Strategy

- Suppose now we need to fetch data from \`page=0\` with \`limit=10\`.
- Don't be constrainted by the number 10, the \`page=0&limit=10\` in caching does not necessarily mean we need to just return 10 data. 
- We first fetch the first row from the table (\`ORDER BY created_at desc\`), if that row is a \`draft\`, we fetch 10 \`drafts\` and cache it, then try to query the opposite (\`nonDraft\`) with some constraint, then cache it. 

  We reverse the above step if the first row is a \`nonDraft\`.

- Let's study the description above in more detail with pseudo code.

- WLOG, suppose that the first row is a \`nonDraft\`, then we query the first 10 \`nonDraft\`'s, call this array \`ndArr\`.
- Next we query time-ranged user-dependent \`draft\`'s (the opposite of \`nonDraft\`) and insert them into \`ndArr\` according to \`createdAt\`, to be precise:
- Let's define the draft array \`dArr\` as 
  - \`const dArr = query(all drafts between t and T)\` (pseudo code), where 
  - \`t = min(sort(ndArr, sortby=createdAt))\` (pseudo code)
  - \`T = max(sort(ndArr, sortby=createdAt))\` (pseudo code)

- Then we finally execute \`cache_1(ndArr)\` and \`cache_2(dArr)\`.

- Next time when we query the same key, we return 
  \`\`\`js
  [...getCache_1(some_key), ...getCache_2(some_key)]
    .sort((a,b) => b.createdAt - a.createdAt)
  \`\`\`



#### Usage of our Caching Class, turn the Strategy into real code

\`\`\`js
const getCachedMessagesSessions = async (req: Request, res: Response) => {
    const { channelId } = req.params as { channelId: string };
    const { page, limit } = req.query as { page: string, limit: string }
    const page_ = Number(page);
    const limit_ = Number(limit);
    const skip = limit_ * page_;
    const userId = req.user?.userId || "";
    const compId = req.user?.compId || "";
    const isAdmin = req.user?.isAdmin || false


    // const useCaching = page_ <= 1;
    const useCaching = MESSAGES_SESSIONS_USE_CACHING;
    const cachingCondition = page_ < SESSIONS_N_CAHCHING_PAGE;

    if (useCaching && cachingCondition) {
        const { getCache: getNonDraftIssueCache, setCache: setNonDraftCache } = nonDraftCache.setCacheKey({
            channelId, isAdmin, page: page_
        });
        const { getCache: getDraftIssueCache, setCache: setDraftCache } = draftsCache.setCacheKey({
            channelId, isAdmin, userId, page: page_
        });

        const [
            nonDraftIssues,
            draftIssues
        ] = await Promise.all([
            getNonDraftIssueCache(),
            getDraftIssueCache()
        ])

        if (nonDraftIssues && draftIssues) {
            // first one page only
            const parsedResult = JSON.parse(nonDraftIssues) as { sortingTimestamp: number }[];
            const rangedDrafts = JSON.parse(draftIssues) as { sortingTimestamp: number }[];
            const merged = [...parsedResult, ...rangedDrafts].sort((a, b) => b.sortingTimestamp - a.sortingTimestamp);

            return res.json({
                success: true,
                result: { roomAsIssues: merged }
            })
        }

        // the caching mechanism will defer by whether we 
        // take 10 draft-issues, and grab non-unpublished-issue in-between by sorting time stamp, or 
        // take 10 non-draft-issue, and grab unpublished-issues in-between
        // certainly this depends on the type of latest session.
        const { sessions: initialSession } = await chatService.getMessagesSessionsWithHost({
            userId: userId,
            channelId: channelId,
            skip: 0,
            isAdmin,
            limit: 1,
        });

        if (!initialSession || initialSession.length === 0) {
            return res.json({
                success: true,
                result: { roomAsIssues: [] }
            })
        }

        const firstSession = initialSession?.[0];
        const isDraft = firstSession?.type === "PERSONAL_CHATROOM" && firstSession?.isDraftInstantIssue;

        const { sessions } = await chatService.getMessagesSessionsWithHost({
            userId: userId,
            channelId: channelId,
            draftOnly: isDraft,
            notDraft: !isDraft,
            skip,
            isAdmin,
            limit: limit_,
        });

        const rangedOppositeSessions = await chatService.getRangedSessions(sessions, {
            channelId, isAdmin, limit: limit_, skip, userId, draftOnly: !isDraft, notDraft: isDraft
        });

        const drafts = isDraft ? sessions : rangedOppositeSessions;
        const nonDrafts = isDraft ? rangedOppositeSessions : sessions;

        await Promise.all([
            setNonDraftCache(JSON.stringify(nonDrafts)),
            setDraftCache(JSON.stringify(drafts))
        ])
        const merged = [...sessions, ...rangedOppositeSessions].sort((a, b) => b.sortingTimestamp - a.sortingTimestamp);
        res.json({
            success: true,
            result: { roomAsIssues: merged }
        })

    } else {
        const { sessions } = await chatService.getMessagesSessionsWithHost({
            userId: userId,
            channelId: channelId,
            skip,
            isAdmin,
            limit: limit_,
        });
        res.json({
            success: true,
            result: { roomAsIssues: sessions }
        })
    }
}
\`\`\`
#### Cache Invalidation


- Cache Invalidation is deeply associated with your business logic and we will not discuss here. 

- But whenever you want to do it, you may do it by (assume that we need to invalidate everything):

  \`\`\` js
      const { customClearCache: customClearNonDrafts } = nonDraftsCache.setCacheKey({
         channelId, isAdmin 
      });
      const { customClearCache: customClearDrafts } = draftsCache.setCacheKey({ 
        channelId, isAdmin, userId 
      });

      await Promise.all([
          customClearNonDrafts(),
          customClearDrafts()
      ])
  \`\`\`





#### Remarks

- You should always allow yourself to switch between cached and non-cached mode in order to check whether the caching is done correctly.

- Caching should not be done in every page unless you are sure that page can never be chagned (like displaying a message-thread in a forum with ascending order in \`createdAt\`).

- However, in real applications we usually sort \`createdBy\` in \`desc\` order in order to display latest information, caching every page is not pragmatic.

- Caching does help a bit to make your application seems performant, but remember invalidation of cache is very complicated. Don't try to cache everything.
`;export{e as default};
