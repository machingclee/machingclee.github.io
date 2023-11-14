---
title: "Load Environment Variables from Aws Secret Managers"
date: 2023-11-15
id: blog0217
tag: go
intro: "Methods of sharing environment variabls has always been being diversified. Some may just keep the .env in the project. Some may share it via instant messagers. Some may store it in a webpage that require a login. We share a method that should be a norm for intense aws users!"
toc: false
---
<Center></Center>

In AWS Secrets Manager we create a secret named `simple_bank_local` (create also the env `simple_bank_dev` and `simple_bank_prod` if they exist in the future).

Next, create `key-value` pairs in the course of creating the secret. Then we load our secret by `aws-sdk`:


```go
package util

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
)

type Env struct {
	DBDriver            string        `json:"DB_DRIVER"`
	DBSource            string        `json:"DB_SOURCE"`
	ServerAddress       string        `json:"SERVER_ADDRESS"`
	TokenSymmetricKey   string        `json:"TOKEN_SYMMETRIC_KEY"`
	AccessTokenDuration time.Duration `json:"ACCESS_TOKEN_DURATION"`
}

func LoadConfig(parentDir string) (*Env, error) {
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
	var envVariables = &Env{}
	json.Unmarshal([]byte(secretString), envVariables)

	fmt.Println("Env variables retrieved")
	return envVariables, nil
}
```
Everyone who has access to this aws resource can start the project without needing to pass the env file in an ad-hoc manner. 

Now we run the programme locally by 
```text
env=local main
```
Note that we usually build an image via `RUN go build -o main main.go` that contains only the binary named `main`, and hence we use the command above.