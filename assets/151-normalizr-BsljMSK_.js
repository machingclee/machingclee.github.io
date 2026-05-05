const n=`---
title: "normalizr --- Convert Array of Data Into Hashmap"
date: 2023-07-05
id: blog0151
tag: react
intro: "\`normalizr\` will be helpful if we have complex manipulation of data in an array (like drag and drop)"
toc: true
---

### Introduction

- For me \`normalizr\` does not help that much because I assign every object a \`reduxstoreIndex\` (which is the index in the array) before storing into the redux store.

- Every time I want to update, I will pass the update function a \`reduxstoreIndex\` to update the desired object directly.

- But \`normalizr\` will be exceptionally helpful if we do complex operation on the data like drag and drop. Moving a row is equivalent to moving an \`id\` value.

\`\`\`typescript
import { normalize, schema } from "normalizr";

export type Programme = {
  overall_est_end_delay_days: number | null;
  desc_lines: string;
  suspended: boolean;
  prog_ref_no_str: string;
  supplier_manu_name: string;
  overall_est_end_date_str: string;
  programme_oid: string;
};

const programmeEntity = new schema.Entity<Programme>("programmes", undefined, {
  idAttribute: "programme_oid",
});
\`\`\`

In one of our reducers

\`\`\`typescript
initProgrammes: (state, action: PayloadAction<Programme[]>) => {
  const programmes = action.payload;
  const normalized = normalize(programmes, [programmeEntity]);
  state.entities = normalized.entities;
  state.ids = normalized.result;
};
\`\`\`

Effects:

\`\`\`none
// programmes
[
    {
        "overall_est_end_delay_days": null,
        "desc_lines": "some mssage",
        "suspended": false,
        "prog_ref_no_str": "#P005",
        "supplier_manu_name": "ARTSUM",
        "overall_est_end_date_str": "",
        "programme_oid": "646db49bf128363aab1c1398"
    },
    {
        "overall_est_end_delay_days": null,
        "desc_lines": "1\\n2\\n3\\n4\\n5\\n6\\n7\\n8\\n9",
        "suspended": false,
        "prog_ref_no_str": "#P004",
        "supplier_manu_name": "ARTSUM",
        "overall_est_end_date_str": "",
        "programme_oid": "64642a67973fac69322c1a25"
    },
    {
        "overall_est_end_delay_days": 0,
        "desc_lines": "Time to apply",
        "suspended": false,
        "prog_ref_no_str": "#P003",
        "supplier_manu_name": "ARTSUM",
        "overall_est_end_date_str": "26-MAY-23",
        "programme_oid": "645c63ebbc2bb4366b064152"
    },
    {
        "overall_est_end_delay_days": 11,
        "desc_lines": "I am unstopable~",
        "suspended": false,
        "prog_ref_no_str": "#P002",
        "supplier_manu_name": "ARTSUM",
        "overall_est_end_date_str": "29-MAY-23",
        "programme_oid": "6458ae0252c1ff2d50188a38"
    },
    {
        "overall_est_end_delay_days": 11,
        "desc_lines": "First line to test your ability\\nSecond line to confirm your mind\\nThird line to setup your thingkings",
        "suspended": false,
        "prog_ref_no_str": "#P001",
        "supplier_manu_name": "ARTSUM",
        "overall_est_end_date_str": "30-MAY-23",
        "programme_oid": "6458ad1752c1ff2d50188a04"
    }
]
\`\`\`

After normlization:

\`\`\`none
// normalize(programmes, [programmeEntity])
{
    "entities": {
        "programmes": {
            "646db49bf128363aab1c1398": {
                "overall_est_end_delay_days": null,
                "desc_lines": "some mssage",
                "suspended": false,
                "prog_ref_no_str": "#P005",
                "supplier_manu_name": "ARTSUM",
                "overall_est_end_date_str": "",
                "programme_oid": "646db49bf128363aab1c1398"
            },
            "64642a67973fac69322c1a25": {
                "overall_est_end_delay_days": null,
                "desc_lines": "1\\n2\\n3\\n4\\n5\\n6\\n7\\n8\\n9",
                "suspended": false,
                "prog_ref_no_str": "#P004",
                "supplier_manu_name": "ARTSUM",
                "overall_est_end_date_str": "",
                "programme_oid": "64642a67973fac69322c1a25"
            },
            "645c63ebbc2bb4366b064152": {
                "overall_est_end_delay_days": 0,
                "desc_lines": "Time to apply",
                "suspended": false,
                "prog_ref_no_str": "#P003",
                "supplier_manu_name": "ARTSUM",
                "overall_est_end_date_str": "26-MAY-23",
                "programme_oid": "645c63ebbc2bb4366b064152"
            },
            "6458ae0252c1ff2d50188a38": {
                "overall_est_end_delay_days": 11,
                "desc_lines": "I am unstopable~",
                "suspended": false,
                "prog_ref_no_str": "#P002",
                "supplier_manu_name": "ARTSUM",
                "overall_est_end_date_str": "29-MAY-23",
                "programme_oid": "6458ae0252c1ff2d50188a38"
            },
            "6458ad1752c1ff2d50188a04": {
                "overall_est_end_delay_days": 11,
                "desc_lines": "First line to test your ability\\nSecond line to confirm your mind\\nThird line to setup your thingkings",
                "suspended": false,
                "prog_ref_no_str": "#P001",
                "supplier_manu_name": "ARTSUM",
                "overall_est_end_date_str": "30-MAY-23",
                "programme_oid": "6458ad1752c1ff2d50188a04"
            }
        }
    },
    "result": [
        "646db49bf128363aab1c1398",
        "64642a67973fac69322c1a25",
        "645c63ebbc2bb4366b064152",
        "6458ae0252c1ff2d50188a38",
        "6458ad1752c1ff2d50188a04"
    ]
}
\`\`\`

### Abstract into a Until Function

\`\`\`typescript
import { normalize, schema } from "normalizr";

export default function normalizeUtil<T>({
  targetArr,
  idAttribute,
}: {
  targetArr: T[];
  idAttribute: string;
}) {
  const objectEntity = new schema.Entity<Selection>("object", undefined, {
    idAttribute,
  });
  const normalized = normalize(targetArr, [objectEntity]);
  const idToObject = normalized.entities["object"] as { [id: string]: T };
  const ids = normalized["result"] as string[];
  return { ids, idToObject };
}
\`\`\`
`;export{n as default};
