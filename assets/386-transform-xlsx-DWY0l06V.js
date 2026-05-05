const n=`---
title: "Transform Execls file Into Json"
date: 2025-04-14
id: blog0386
tag: excel, nodejs
toc: true
intro: "A record of simple excel to db-record task."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Task Breakdown to Import Excel File into Database

#### Data

[![](/assets/img/2025-04-14-22-02-56.png)](/assets/img/2025-04-14-22-02-56.png)

#### Task

As the data are already well organized in columns, it is enough to read the 5 columns respectively and write them into a row.

After recording all data into the database, we can directly return this list to frontend as it is a trivial task for javascript to reduce the list of data into

\`\`\`ts
{
  [lang: string]: {
    [industry: string]: {
      [specialization: string]: { tagName: string, desc: string }[]
    }
  }
}
\`\`\`

### Script to Read Excel

\`\`\`js
import { db } from "../../src/db/kysely/database";

import ExcelJS from "exceljs"
import { get, set } from "lodash"
import { v4 as uuidv4 } from "uuid"
import { Tag_Language } from "../../src/db/kysely/enums";
import fs from "fs";

type Tag = { name: string, desc: string }

test("Migrate Excel Tags", async () => {
    const processExcel = async () => {
        const colors = JSON.parse(fs.readFileSync(colorsJsonPath, 'utf8')) as string[]

        await db.deleteFrom("Tagging_TagTemplate_For_Questionnair").execute();

        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.readFile(xlsxFilePath)

        const sheets = workbook.worksheets
        const targetSheetNames = sheets.filter(s => s.name !== "V3")

        for (const sheetName of targetSheetNames) {
            const langToIndustryToSpecializationToTagsMapping: {
                [lang: string]: {
                    [industry: string]: {
                        [specialization: string]: Tag[]
                    }
                }
            } = {}
            const sheet = workbook.getWorksheet(sheetName.name)!
            const rows = sheet.getRows(1, 200)
            const rowData = rows?.map(r => [1, 2, 3, 4, 5].map(colIndex => r.getCell(colIndex).text)) || []
            const nonEmptyData = rowData
                .filter(data => data.every(datum => datum))
                .filter(data => ["EN", "CN"].includes(data[0]))
            nonEmptyData.forEach((data) => {
                const [lang, industry, specialization, name, desc] = data
                const key = [lang, industry, specialization]
                const list = get(langToIndustryToSpecializationToTagsMapping, key, [])
                set(langToIndustryToSpecializationToTagsMapping, key, [...list, { name, desc }])
            })
            const records: any[] = []
            Object.keys(langToIndustryToSpecializationToTagsMapping).forEach(lang => {
                Object.keys(langToIndustryToSpecializationToTagsMapping[lang]).forEach(industry => {
                    Object.keys(langToIndustryToSpecializationToTagsMapping[lang][industry]).forEach(specialization => {
                        const tags = langToIndustryToSpecializationToTagsMapping[lang][industry][specialization]
                        for (const tag of tags) {
                            records.push({
                                name: tag.name,
                                background_color: randomColor(colors),
                                tag_group_id: uuidv4(),
                                desc: tag.desc,
                                industry,
                                specialization,
                                lang: lang === "EN" ? "EN" : "TC" as Tag_Language,
                                rank: 0
                            })
                        }
                    })
                })
            })
            await db.insertInto("Tagging_TagTemplate_For_Questionnair").values(records).execute();
        }
    }
    await expect(processExcel()).resolves.not.toThrowError();
});

function randomIndex(min: number, max: number) {
    const random = Math.ceil(min + (max - min) * Math.random())
    return random;
}

function randomColor(colors: string[]) {
    const numOfColors = colors.length;
    const index = randomIndex(0, numOfColors - 1);
    const randomColor = colors[index];
    return randomColor
}
\`\`\`
`;export{n as default};
