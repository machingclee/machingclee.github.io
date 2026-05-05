const n=`---
title: "Custom Winston Logger in Nodejs"
date: 2023-11-03
id: blog0206
tag: nodejs, express
intro: "Record my custom configuration of express logger"
toc: false
---

<style>
  img {
    max-width: 600px;
  }
  video {
    border-radius: 8px;
  }
</style>


### Configuration

Since I am used to deploying applications in \`Fargate\`, a \`CloudWatch\` logging service is inherited and therefore I don't ***transport*** and ***rotate*** logging into a \`txt\` or \`log\` file.




\`\`\`js
import { Express } from "express";
import winston from "winston";
import expressWinston from "express-winston";
import Dayjs from "../util/hkDayjs";

expressWinston.responseWhitelist.push('body');

// caution, the "whitelist" is shown here just show that we can do that 
// it is better to log request body only for specific routers (just add a middleware)
// otherwise the credentials (like login password) will also be logged
expressWinston.requestWhitelist.push('body');      

const dayjs = Dayjs.get(); // always hk timezone

export const format = winston.format.printf(info => {
    const currTimeDayjs = dayjs(new Date()).tz("Asia/Hong_Kong");
    const date = currTimeDayjs.format("YYYY-MM-DD");
    const time = currTimeDayjs.format("h:mma");
    const { req, res, responseTime } = info.meta;
    const statusCode = res["statusCode"];
    const responseBody = JSON.stringify(res["body"]);
    if (req?.headers?.authorization) {
        req.headers.authorization = undefined;
    }
    const req_ = JSON.stringify({ req });
    return \`------------------------------------------------------\` + "\\n" +
        \`[\${date}][HKT: \${time}][\${info.level}] \${info.message} \${statusCode} in \${responseTime}ms\\n[Request]\\t\${req_}\\n[ResponseBody]\\t\${responseBody}\`;
});

export default (app: Express) => {
    app.use(expressWinston.logger({
        ignoreRoute: (req, res): boolean => {
            // ignore the get request emitted from health check from target group in aws.
            if (req.originalUrl === "/test" || req.url === "/test") {
                return true;
            }
            return false
        },
        transports: [
            new winston.transports.Console({
                format: format
            })
        ],
        format: winston.format.combine(
            winston.format.json()
        )
    }));
}
\`\`\`

`;export{n as default};
