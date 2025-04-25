---
title: Usual Pattern for Multiple ENV Files
date: 2025-04-23
id: blog0388
tag: env
toc: true
intro: "Record several ways to manage multiple env files."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

#### Shared Credentials via Private Repository

Inspired from spring boot project, a natural organization of env files in nodejs would be

![](/assets/img/2025-04-25-02-16-11.png)

where `.env.json` are shared variables, `.env.{dev,uat,prod}.json` are stage-specific variables that possibly override those in `.env.json`.

Apart from that, we would also have a `.env.local` (git-ignored) that override the project config **_for debugging purpose_**.

Deployment scripts are usually like:

```json
"scripts": {
  "start": "env-cmd -f .env.json ts-node src/app.ts",
  "start:local": "env-cmd -f .env.json env-cmd -f .env.local.json ts-node src/app.ts",
  "start:dev": "env-cmd -f .env.json env-cmd -f .env.dev.json ts-node src/app.ts",
}
```

- The `start` script usually points to deployed `DEV` endpoints to avoid any hurdle for frontend developers.

- **Caution.** We cannot write `"start": "start:dev"`

  **Reason.** `DEV` environment can possibly access VPC-**_internal_** resources, so `yarn start` points to publicly accessible `DEV` endpoints (deliberately designed for debugging or frontend developer) and should potentially differs from `start:dev`.

On the other hand, spring boot simply controls this by env variable

```env
SPRING_PROFILES_ACTIVE="a,b,c"
```

Here `"a,b,c"` is a _profile-name(s)_, which tells spring boot to consume

- `application.yml`
- `application-{a,b,c}.yml`, with `c` overriding `b`, `b` overriding `a`, etc

This is proven to be a nice pattern, whenever we want to debug, just add a git-ignored `.env.local.json` env file that is **_not visible_** to any one.

#### Pull Credentials via Shell Script

##### Example from Expo Project (React-Native)

This is more secure but requires additional setup. A typical example in this approach is **_expo-backed_** mobile project.

```json
  "scripts": {
    "env:pull:dev": "eas env:pull --environment development --non-interactive",
    "env:pull:uat": "eas env:pull --environment preview --non-interactive",
    "env:pull:prod": "eas env:pull --environment production --non-interactive",
  }
```

This will pull the remote states into `.env.local`.

##### Mimicing that from expo via aws secrets managers

###### Via Secrets Managers

By mimicing the expo approach, we can use aws secrets manager to achieve similar result via:

```bash-1{3}
aws secretsmanager get-secret-value --secret-id your-secret-name \
--query SecretString --output text \
| jq -r 'to_entries|map("\(.key)=\(.value)")|.[]' \
> .env.local
```

- line-3 is optional, if we use json file directly as environment variable (such as `env-cmd` in nodejs), then we skip this line.

- Here `SecretString` is a **_type_** of fields stored in secrets manager, which is typically a json string (that's why we pipe it into `jq`).

###### Should we do this?

Pulling credentials from cloud will increase the complexity for maintainence and to my experience provide no exceptionally good advantage in the world of backend projects.

Expo can do this becuase frontend world is just **_much simpler_** when it comes to managing variables.
