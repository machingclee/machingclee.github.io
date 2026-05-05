const e=`---
title: "Algolia Revisit"
date: 2024-01-21
id: blog0234
tag: react, algolia, searching, nodejs
intro: "In the past we have discussed algolia backend and the corresponding frontend, revisit this topic with all code written in nodejs"
toc: true
---

<style>
  img {
    max-width: 660px
  }
</style>

### The Backend Counterpart in Java

- In the past we have written an Algolia search backend in java [**here**](/blog/article/Build-a-Search-Function).

- This time we simplify everything by writing all components in nodejs.

- Some detail will be ignored in this article as we mainly just focus on the implementation of the corrsponding concept in nodejs.


### Backend/algoliaService

\`\`\`js
// algoliaService.ts
import algoliasearch, { SearchClient } from "algoliasearch";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import { Types } from "mongoose";
import { db } from "../db/kysely/database";
import { LLMResultInMongo, LLMSummaryModel } from "../db/mongo/models/LLMSummary";
import { AlgoliaRecord } from "../dto/dto";
import logger from "../util/logger";

const APPLICATION_ID = process.env?.ALGOLIA_APPLICATION_ID || "";
const ADMIN_API_KEY = process.env?.ALGOLIA_ADMIN_API_KEY || "";
const INDEX_NAME = process.env?.ALGOLIA_INDEX_NAME || ""
const FRONTEND_SEARCH_API_KEY = process.env?.ALGOLIA_SEARCH_KEY || "";

let searchClient: { current: SearchClient | null } = { current: null };
const client = algoliasearch(APPLICATION_ID, ADMIN_API_KEY);
const index = client.initIndex(INDEX_NAME);

const newSearchClient = () => {
    client.initIndex(INDEX_NAME);
    logger.info("Algolia Client Inited");
    searchClient.current = client;
}

const getSearchClient = () => {
    return searchClient.current;
}

const addRecord = async (newRecord: AlgoliaRecord): Promise<string> => {
    return new Promise((resolve, reject) => {
        index.saveObject(newRecord).then((result) => {
            const { objectID } = result;
            resolve(objectID);
        }).catch(err => {
            reject(err);
        });
    })
}
\`\`\`
#### Initialize Algolia DB for Searching, Define Search and Filter attribute.

- Here we qurey our database by \`kysely\`, this part of code is project-dependnent.

- You should have your own logic to get target documents to be searched.

- The main point is to exceute \`index.saveObject(record)\` to save the search target with \`objectID\` being the search target id (used by algolia as an \`id\` attribute).

- **Search attributes** are the ones whose content will be being seached.

- **Filter attributes** are the ones whose content will be used to filter users who have right to get that document.

\`\`\`js
const initAlgoliaDB = async () => {
    const index = client.initIndex(INDEX_NAME);
    index.clearObjects();
    const allSessions = await db.selectFrom("MessagesSession")
        .leftJoin("Channel", "Channel.id", "MessagesSession.channelId")
        .leftJoin("Project", "Project.id", "Channel.projectId")
        .leftJoin("User", "User.id", "MessagesSession.hostUserId")
        .innerJoin("LLMSummary", "LLMSummary.messagesSessionId", "MessagesSession.id")
        .where("LLMSummary.llmResultMongoOid", "is not", null)
        .where(eb => eb.or([
            eb("MessagesSession.type", "=", "PUBLIC_CHATROOM"),
            eb.and([
                eb("MessagesSession.type", "=", "PERSONAL_CHATROOM"),
                eb("MessagesSession.isDraftInstantIssue", "=", false)
            ])
        ]))
        .selectAll("MessagesSession")
        .select("LLMSummary.llmResultMongoOid")
        .select(eb => [
            jsonArrayFrom(eb.
                selectFrom("UserToJoinedProject")
                .select("UserToJoinedProject.userId as joinedUserId")
                .whereRef("UserToJoinedProject.projectId", "=", "Project.id")
            ).as("members")
        ])
        .select(["User.companyId as hostCompanyId", "User.firstName as hostFirstname", "User.lastName as hostLastname"])
        .execute();

    const oids = allSessions.map(session => session.llmResultMongoOid) as string[];
    const nonnullSummaries = await LLMSummaryModel.find({ _id: { $in: oids } }).lean();
    const nonnullSummarySessionIdAndResult = allSessions.map(s => {
        const target = nonnullSummaries.find(summary => summary._id.toString() === s.llmResultMongoOid);
        return {
            sessionId: s.id,
            result: { enResult: target?.result, tcResult: target?.zhResult }
        }
    })

    const resultsToSearch = nonnullSummarySessionIdAndResult.map(data => {
        const { result, sessionId } = data;
        const { enResult, tcResult } = result;
        const aiResult = llmResultToAlgoliaResult({ enResult: enResult || [], tcResult: tcResult || [] });
        const originalSession = allSessions.find(s => s.id === sessionId);
        const { name, members } = originalSession!;
        return {
            objectID: sessionId,
            members: members.map(m => m.joinedUserId),
            name,
            aiResult,
        }
    }) as AlgoliaRecord[];

    try {
        for (const result of resultsToSearch) {
            index.saveObject(result).catch(err => {
                console.log(err);
            })
        }
    } catch (err) {
        console.log(JSON.stringify(err));
    }

    index.setSettings({
        attributesForFaceting: [
            "searchable(name)",
            "searchable(aiResult)",
            "searchable(username)",
            "filterOnly(members)"
        ],
    })
}
\`\`\`

#### Util Functions


\`\`\`js
// by the way the flatten here can be simply replaced by flatMap
const flatten = (results: ((string | undefined | null)[])[]) => {
    return results.reduce<string[]>((prev, curr) => {
        const curr_ = curr?.filter(c => c) as string[];
        const prev_ = prev?.filter(p => p) as string[];
        return [...curr_, ...prev_]
    }, [])
}

const llmResultToAlgoliaResult = (params: {
    enResult: LLMResultInMongo[],
    tcResult: LLMResultInMongo[]
}) => {
    const { enResult, tcResult } = params;
    const enTitle = enResult?.[0]?.title || "";
    const zhTitle = tcResult?.[0]?.title || "";
    const titles = [enTitle, zhTitle].filter(str => str) as string[];
    const enSummary = enResult.map(result => result.summary);
    const enKeyPoints = flatten(enResult.map(result => result.keyPoints));
    const enTags = flatten(enResult.map(result => result.keywords));
    const tcSummary = tcResult?.map(result => result.summary) || [];
    const tcKeyPoints = flatten(tcResult?.map(result => result.keyPoints) || []);
    const tcTags = flatten(tcResult?.map(result => result.keywords) || []);

    const aiResult = [
        ...titles,
        ...enKeyPoints,
        ...tcKeyPoints,
        ...enSummary,
        ...tcSummary,
        ...enTags,
        ...tcTags
    ] as string[]

    return aiResult;
}

const getAllMembers = async (sessionId: string) => {
    const idResults = await db.selectFrom("MessagesSession")
        .leftJoin("Channel", "Channel.id", "MessagesSession.channelId")
        .leftJoin("Project", "Project.id", "Channel.projectId")
        .leftJoin("UserToJoinedProject", "UserToJoinedProject.projectId", "Project.id")
        .select("UserToJoinedProject.userId")
        .where("MessagesSession.id", "=", sessionId)
        .execute();
    const ids = idResults.map(result => result?.userId).filter(id => id) as string[];
    return ids;
}

const createSearchApiKey = (userId: string) => {
    const client = getSearchClient();
    // doc: https://www.algolia.com/doc/deprecated/api-clients/javascript/v3/methods/generate-secured-api-key/?client=javascript#examples
    const restrictedAPIKey = client?.generateSecuredApiKey(
        FRONTEND_SEARCH_API_KEY,
        { filters: \`members:\${userId}\` }
    );

    return { restrictedAPIKey, applicationId: APPLICATION_ID, index: INDEX_NAME };
}

export default {
    getAllMembers,
    llmResultToAlgoliaResult,
    addRecord,
    initAlgoliaDB,
    newSearchClient,
    getSearchClient,
    createSearchApiKey
}
\`\`\`

#### Create API searchKey to Restrict Document Access

Recall the \`createSearchApiKey\` function in \`algoliaService\` defined above, we have restrict the access of documents by the criterion:
\`\`\`js
{ filters: \`members:\${userId}\` }
\`\`\`
which means that:
- We have an attribute \`members: string[]\` in our document. 
- The new \`apikey\` for searching can hit the target only when \`members.include(userId)\`.

Next, since the \`applicationId\` and \`searchIndex\` can be defined in the backend and passed  to frontend (though you can save the same set of strings in frontend as well, but then we loss the single source of truth), we also return them.

\`\`\`js
searchRouter.get("/api-key", (req, res) => {
    const userId = req.user?.userId;
    if (!userId) {
        throw new Error("uesrId cannot be found");
    }
    const { restrictedAPIKey, applicationId, index } = algoliaService.createSearchApiKey(userId);
    res.json({
        success: true,
        result: { securedAPIKey: restrictedAPIKey, applicationId, index }
    })
});
\`\`\`



### Frontend 
#### Algolia Class and Static Methods

\`\`\`js
import algoliasearch, { SearchClient } from 'algoliasearch/lite';
import apiClient from "../axios/apiClient";
import apiRoutes from "../axios/apiRoutes";
import { WBResponse } from "../axios/responseTypes";
import msgUtil from "./msgUtil";

export class Algolia {
    private static client: SearchClient | null = null;
    private static index: string = "";
    private static applicationId = "";
    private static securedAPIKey = "";

    public static getSearchData = () => {
        return {
            index: this.index,
            applicationId: this.applicationId,
            securedAPIKey: this.securedAPIKey
        };
    }

    public static getClient = async () => {
        if (!this.client) {
            const res = await apiClient.get<WBResponse<{ applicationId: string, securedAPIKey: string, index: string }>>(apiRoutes.GET_SECURED_API_KEY);
            const { success } = res.data;
            if (success) {
                const { applicationId, securedAPIKey, index } = res.data.result;
                this.index = index;
                this.applicationId = applicationId;
                this.securedAPIKey = securedAPIKey;
                this.client = algoliasearch(applicationId, securedAPIKey);
            }
            else {
                msgUtil.persistedError("Cannot get API key");
            }
        }
        if (!this.client) {
            msgUtil.persistedError("Cannot get search client");
            return null;
        }
        return this.client;
    }
}
\`\`\`

#### Usage

\`\`\`js
export type SearchResult = {
    results: {
        hits: {
            aiResult: string[],
            objectID: string,
            username: string
        }[]
    }[]
}
export type Hits = SearchResult["results"][0]["hits"];
    // inside a component
    const updateSearchResult = useMemo(() => debounce(async (text: string) => {
        const algoliaClient = await Algolia.getClient();
        const { index } = Algolia.getSearchData();
        const searchResult = await algoliaClient?.search([{
            indexName: index,
            query: text,
            params: { hitsPerPage: 5, attributesToRetrieve: ["aiResult", "username", "objectID"] }
        }], {}) as SearchResult;
        setHits(searchResult.results?.[0].hits);
    }, 500), []);
\`\`\`

- Here you can save a more comprehensive search target in algolia db to directly display the searchResult. 

- Or you can make use of the \`objectID\` to directly fetch desired target from your own database.`;export{e as default};
