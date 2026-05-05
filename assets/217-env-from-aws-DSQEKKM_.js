const n=`---
title: "Load Environment Variables from Aws Secret Managers and Run Shell Script in Go for DB Schema Migration Based on DB_URL from Secrets"
date: 2023-11-15
id: blog0217
tag: go
intro: "Methods of sharing environment variabls has always been being diversified. Some may just keep the .env in the project. Some may share it via instant messagers. Some may store it in a webpage that require a login. We share a method that should be a norm for intense aws users!"
toc: true
---

<style>
  img {
    max-width: 600px;
  }
  video {
    border-radius: 8px;
  }
</style>

<Center></Center>

### Local Aws Secret as Environment Variables

In AWS Secrets Manager we create a secret named \`simple_bank_local\` (create also the env \`simple_bank_dev\` and \`simple_bank_prod\` if they exist in the future).

Next, create \`key-value\` pairs in the course of creating the secret.

[![](/assets/tech/217/image.png)](/assets/tech/217/image.png)

Then we load our secret by \`aws-sdk\`:

\`\`\`go
package util

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
)

type Env struct {
	DBDriver            string        \`json:"DB_DRIVER"\`
	DBSource            string        \`json:"DB_SOURCE"\`
	ServerAddress       string        \`json:"SERVER_ADDRESS"\`
	TokenSymmetricKey   string        \`json:"TOKEN_SYMMETRIC_KEY"\`
	AccessTokenDuration time.Duration \`json:"ACCESS_TOKEN_DURATION"\`
}

type intermediateEnv struct {
	AccessTokenDuration string \`json:"ACCESS_TOKEN_DURATION"\`
}

var ENV *Env = nil

func LoadEnv() (*Env, error) {
	if ENV != nil {
		return ENV, nil
	}
	env := "local"
	env_override := os.Getenv("env")
	if env_override != "" {
		env = env_override
	}

	secretName := fmt.Sprintf("simple_bank_%s", env)
	region := "ap-northeast-1"

	fmt.Printf("Getting Environment variables [%s] from aws screts ... ", secretName)

	config, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion(region))
	if err != nil {
		log.Fatal(err)
	}
	svc := secretsmanager.NewFromConfig(config)
	input := &secretsmanager.GetSecretValueInput{
		SecretId:     aws.String(secretName),
		VersionStage: aws.String("AWSCURRENT"),
	}
	result, err := svc.GetSecretValue(context.TODO(), input)
	if err != nil {
		log.Fatal(err.Error())
	}
	var secretString string = *result.SecretString
	ENV = &Env{}
	envIntermediate := &intermediateEnv{}
	json.Unmarshal([]byte(secretString), ENV)
	json.Unmarshal([]byte(secretString), envIntermediate)

	ENV.AccessTokenDuration, err = time.ParseDuration(envIntermediate.AccessTokenDuration)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Env variables retrieved")
	return ENV, nil
}
\`\`\`

Everyone who has access to this aws resource can start the project without needing to pass the env file in an ad-hoc manner.

Now we run the programme locally by

\`\`\`text
env=local main
\`\`\`

Note that we usually build an image via \`RUN go build -o main main.go\` that contains only the binary named \`main\`, and hence we use the command above.

### Execute Shell Script Using Aws Secrets with DB Schema Migration as a Sample

\`\`\`go-1
func RunDbMigration() error {
	workingDir, err := os.Getwd()
	if err != nil {
		return err
	}
	env, err := LoadEnv()
	if err != nil {
		return err
	}
	fmt.Println("Running Migration Script")
\`\`\`

The strategy is simply setting desired secret into environment variable

\`\`\`go-11
	os.Setenv("DB_URL", env.DBSource)
\`\`\`

and then run the shell script:

\`\`\`go-12
	migrationScriptPath := filepath.Join(workingDir, "script_db_migrate_up.sh")

	var cmd *exec.Cmd

	if runtime.GOOS == "windows" {
		var winBash string = \`C:\\Program Files\\Git\\usr\\bin\\sh.exe\`
		if where := os.Getenv("bin_where"); where != "" {
			winBash = where
		}
		cmd = exec.Command(winBash, migrationScriptPath)
	} else {
		cmd = exec.Command(migrationScriptPath)
	}
\`\`\`

Next we print the std outputs from the shell script.

\`\`\`go-25
	var outb, errb bytes.Buffer
	cmd.Stdout = &outb
	cmd.Stderr = &errb

	err = cmd.Run()

	if err != nil {
		return err
	}

	fmt.Println("out:", outb.String())
	fmt.Println("err:", errb.String())

	return nil
}
\`\`\`

The std output of my web-app:

\`\`\`shell
$ go run main.go
go run main.go
Getting Environment variables [simple_bank_local] from aws screts ... Env variables retrieved
Running Migration Script
out:
err: 2023/11/16 02:07:51 goose: no migrations to run. current version: 5

[GIN-debug] [WARNING] Creating an Engine instance with the Logger and Recovery middleware already attached.

[GIN-debug] [WARNING] Running in "debug" mode. Switch to "release" mode in production.
 - using env:   export GIN_MODE=release
 - using code:  gin.SetMode(gin.ReleaseMode)

[GIN-debug] POST   /user/                    --> github.com/machingclee/2023-11-04-go-gin/api.(*Server).createUser-fm (3 handlers)
[GIN-debug] POST   /user/login               --> github.com/machingclee/2023-11-04-go-gin/api.(*Server).loginUser-fm (3 handlers)
[GIN-debug] POST   /account/                 --> github.com/machingclee/2023-11-04-go-gin/api.(*Server).createAccount-fm (4 handlers)
[GIN-debug] POST   /account/transfers        --> github.com/machingclee/2023-11-04-go-gin/api.(*Server).createTransfer-fm (4 handlers)
[GIN-debug] GET    /account/:id              --> github.com/machingclee/2023-11-04-go-gin/api.(*Server).getAccount-fm (4 handlers)
[GIN-debug] GET    /account/list             --> github.com/machingclee/2023-11-04-go-gin/api.(*Server).listAccount-fm (4 handlers)
[GIN-debug] [WARNING] You trusted all proxies, this is NOT safe. We recommend you to set a value.
Please check https://pkg.go.dev/github.com/gin-gonic/gin#readme-don-t-trust-all-proxies for details.
[GIN-debug] Listening and serving HTTP on :8080
\`\`\`

Surprisingly even \`no migrations to run. current version: 5\` is not an error, our migration message still comes from \`stderr\`.
`;export{n as default};
