const n=`---
title: PR and Empty Git Commit via SimpleGit in Nodejs
date: 2025-05-09
id: blog0395
tag: git
toc: true
intro: "We discuss programmatic way to git push changes and git commit empty commit for triggering github workflow."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Purpose

#### For production deployment workflows

- **Programmatic PR.** The programmatic PR approach is for quick deployment of **new functions** via github actions, instead of manually merge/PR a branch into the production (\`main\`) branch to trigger that action.

- **Programmatic Empty Commit.** This is for creating entirely new infra structure for \`pre-prod\` environment. When tests are done:

  1. We change the secrets in secrets manager
  2. Commit an empty message to redeploy the services using the latest secrets
  <p></p>

  The major change in the secrets is to point the services to the old database instead of the temporary database:

  [![](/assets/img/2025-05-09-01-42-46.png)](/assets/img/2025-05-09-01-42-46.png)

### Custom Nodejs Script

We defer the messy detail of \`GitUtil\` to the last section [#git-util].

#### new-functions.ts

\`\`\`ts
import repos from "./constant/repos";
import GitUtil from "./GitUtil";
import minimist from "minimist";

const args = minimist(process.argv.slice(2));

const gitUtil = new GitUtil();

const promises = repos.map((repository) => {
  const { deploymentStage, deploymentYml, owner, pr_branch, repo } = repository;
  return gitUtil.modifyServerlessYmlAndCreatePR({
    owner: owner,
    repo: repo,

    targetDeploymentYaml: deploymentYml,
    targetDeploymentStage: deploymentStage,
    targetDeploymentBranch: pr_branch,
  });
});

Promise.all(promises).then((prs) => {
  for (const pr of prs) {
    if (pr) {
      console.log("[Pull Request]", pr);
    }
  }
});
\`\`\`

#### trigger-workflows.ts

\`\`\`ts
import repos from "./constant/repos";
import GitUtil from "./GitUtil";

const gitUtil = new GitUtil();

const promises = repos.map((repository) => {
  const { owner, pr_branch, repo } = repository;
  return gitUtil.triggerWorkflow({
    owner: owner,
    repo: repo,
    targetDeploymentBranch: pr_branch,
  });
});

Promise.all(promises).then((repoUrls) => {
  for (const repoUrl of repoUrls) {
    console.log("workflow triggered", repoUrl);
  }
});
\`\`\`

#### GitUtil {#git-util}

This is merely a messy detail:

\`\`\`ts
import fs from "fs";
import simpleGit, { SimpleGit } from "simple-git";
import path from "path";
import * as yaml from "js-yaml";
import dayjs from "dayjs";

export default class GitUtil {
  jsonToYml(nestedJson: any) {
    const ymlString = yaml.dump(nestedJson, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      noCompatMode: true,
      schema: yaml.JSON_SCHEMA,
    });
    return ymlString;
  }

  createTmpDir() {
    const tmpDir = fs.mkdtempSync(path.join(".", "git-download-"));
    return tmpDir;
  }

  async downloadFileWithSimpleGit(props: {
    repoUrl: string;
    filePath: string;
    branch: string;
  }): Promise<{
    tempFilePath: string;
    fileString: string;
    removeTempDir: () => void;
    tmpDirBasedGit: SimpleGit;
  }> {
    const { branch, filePath, repoUrl } = props;
    const tmpDir = this.createTmpDir();
    try {
      console.log(\`Cloning repository to \${tmpDir}\`);
      const git = await this.cloneLocallyAndCheckout({
        repoUrl,
        tmpDir,
        branch,
      });
      // Read the file
      const fullPath = path.join(__dirname, tmpDir, filePath);
      if (fs.existsSync(fullPath)) {
        return {
          tempFilePath: fullPath,
          fileString: fs.readFileSync(fullPath, "utf8"),
          tmpDirBasedGit: git,
          removeTempDir: () =>
            fs.rmSync(tmpDir, { recursive: true, force: true }),
        };
      } else {
        throw new Error(\`File \${fullPath} not found in repository\`);
      }
    } catch (error) {
      console.error("Error with simpleGit:", error);
      throw error;
    }
  }

  private async cloneLocallyAndCheckout(props: {
    repoUrl: string;
    tmpDir: string;
    branch: string;
  }) {
    const { branch, repoUrl, tmpDir: tempDir } = props;
    const git = simpleGit({
      baseDir: tempDir,
      maxConcurrentProcesses: 6,
    });
    await git.clone(repoUrl, "./", ["--depth=1", \`--branch=\${branch}\`]);
    await git.checkout(branch);
    return git;
  }

  async triggerWorkflow(props: {
    repo: string;
    owner: string;
    targetDeploymentBranch: string;
  }) {
    const { owner, repo, targetDeploymentBranch } = props;
    const tmpDir = this.createTmpDir();
    const repoUrl = this.genRepoUrl({ owner, repo });
    const git = await this.cloneLocallyAndCheckout({
      branch: targetDeploymentBranch,
      repoUrl,
      tmpDir,
    });
    await git.removeRemote("origin").catch(() => {
      /* Ignore if remote doesn't exist */
    });
    await git.addRemote("origin", repoUrl);
    await git.commit("Trigger workflow run", ["--allow-empty"]);
    await git.push("origin", targetDeploymentBranch);
    return repoUrl;
  }

  genRepoUrl(props: { owner: string; repo: string }) {
    const { owner, repo } = props;
    const REPO_URL = \`https://github.com/\${owner}/\${repo}\`;
    return REPO_URL;
  }

  async modifyServerlessYmlAndCreatePR(props: {
    repo: string;
    owner: string;
    targetDeploymentYaml: string;
    targetDeploymentStage: string;
    targetDeploymentBranch: string;
  }) {
    const {
      owner,
      repo,
      targetDeploymentStage,
      targetDeploymentYaml,
      targetDeploymentBranch,
    } = props;
    const timestamp = dayjs(new Date()).format("YYYY-MM-DD-HH-mm-ss");
    const featureBranch = \`feature/deployment-\${timestamp}\`;

    const REPO_URL = this.genRepoUrl({ owner, repo });

    const { fileString, tempFilePath, removeTempDir, tmpDirBasedGit } =
      await this.downloadFileWithSimpleGit({
        branch: targetDeploymentBranch,
        filePath: targetDeploymentYaml,
        repoUrl: this.genRepoUrl({ owner, repo }),
      });

    const json = yaml.load(fileString) as { [key: string]: any };
    if (json?.["provider"]?.["stage"]) {
      json["provider"]["stage"] = targetDeploymentStage;
    }
    const newYaml = this.jsonToYml(json);
    try {
      // Make changes to file
      fs.writeFileSync(tempFilePath, newYaml);

      // Set remote with authentication
      await tmpDirBasedGit.removeRemote("origin").catch(() => {
        /* Ignore if remote doesn't exist */
      });
      await tmpDirBasedGit.addRemote("origin", REPO_URL);
      await tmpDirBasedGit.raw(["checkout", "-b", featureBranch]);
      // Git operations
      await tmpDirBasedGit.add(tempFilePath);
      await tmpDirBasedGit.commit("update service stage for deployment");
      await tmpDirBasedGit.push("origin", featureBranch);
      const prUrl =
        \`https://github.com/\${owner}/\${repo}/compare/\${targetDeploymentBranch}...\${featureBranch}\`.replace(
          ".git",
          ""
        );
      return prUrl;
    } catch (error) {
      console.error("Error:", error);
    } finally {
      removeTempDir();
    }
  }
}
\`\`\`
`;export{n as default};
