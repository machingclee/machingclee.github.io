const t=`---
title: "Complete Golang Project Structure"
date: 2023-11-13
id: blog0214
tag: go
intro: "We record how to create a complete web application project in go."
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

### Repository

- https://github.com/machingclee/2023-11-04-go-gin

### When is Go Over Nodejs?

When IO bound is not a concern, and if we are concerned about the high-concurrency and cpu capability, then go has an advantage that cpu-intensive task **_does not block_**, ensuring the performance of the application.

If our application is full of cpu-bound tasks, then Go is a good choice.

For example, my messaging app needs to format all incoming voice messages from \`.m4a\` into \`.mp3\`, which is cpu-intensive as users use voice more often the using text messages.

What if we offload this reformatting task to other microservices?

- **To Lambda Services.** It depends on **_how frequent this formatting task is_**. In my use case, the formatting task is one of the main feature of the app, which is **_frequent_**. Designating this task to a lambda can introduce huge cost in the future.

- **To Other Backend Service (additional EC2/Fargate Instance).** This is of course a good solution if our task to be offloaded is language-specific.

  But note that it will also increase the architectual complexity and we don't want api-dependencies explosion for no good reason.

**_To sum up_**, if our application is **_flooded with_**

- cpu-bounded and
- non-language-specific tasks,

then just go with golang!

### api

#### api/server.go

\`\`\`go
type Server struct {
	config     *util.Config
	store      db.Store
	tokenMaker token.Maker
	router     *gin.Engine
}

func NewServer(config *util.Config, store db.Store) (*Server, error) {
	tokenMaker, err := token.NewJWTMaker(config.TokenSymmetricKey)
	if err != nil {
		return nil, err
	}
	server := &Server{
		config:     config,
		store:      store,
		tokenMaker: tokenMaker,
	}

	server.setupRouter()

	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		v.RegisterValidation("currency", validCurrency)
	}

	return server, nil
}

func errorResponse(err error) gin.H {
	return gin.H{"error": err.Error()}
}

func (server *Server) Start(address string) error {
	err := server.router.Run(address)
	return err
}

func (server *Server) setupRouter() {
	router := gin.Default()

	user := router.Group("/user")
	user.POST("/", server.createUser)
	user.POST("/login", server.loginUser)

	account := router.Group("/account")
	account.Use(authMiddleware(server.tokenMaker))
	account.POST("/", server.createAccount)
	account.POST("/transfers", server.createTransfer)
	account.GET("/:id", server.getAccount)
	account.GET("/list", server.listAccount)

	server.router = router
}
\`\`\`

#### api/middleware.go

\`\`\`go
const (
	authorizationHeaderKey  = "authorization"
	authorizationType       = "bearer"
	authorizationPayloadKey = "auth_payload"
)

func authMiddleware(tokenMaker token.Maker) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		authHeader := ctx.GetHeader(authorizationHeaderKey)
		if len(authHeader) == 0 {
			err := errors.New("auth header is not provided")
			ctx.AbortWithStatusJSON(http.StatusUnauthorized, errorResponse(err))
			return
		}

		fields := strings.Split(authHeader, " ")
		if len(fields) < 2 {
			err := errors.New("invalid authorization header")
			ctx.AbortWithStatusJSON(http.StatusUnauthorized, errorResponse(err))
			return
		}
		authType := strings.ToLower(fields[0])
		if authorizationType != authType {
			err := errors.New("only support beaer token")
			ctx.AbortWithStatusJSON(http.StatusUnauthorized, errorResponse(err))
			return
		}

		authToken := fields[1]
		payload, err := tokenMaker.VerifyToken(authToken)
		if err != nil {
			ctx.AbortWithStatusJSON(http.StatusUnauthorized, errorResponse(err))
			return
		}
		ctx.Set(authorizationPayloadKey, payload)
		ctx.Next()
	}
}
\`\`\`

#### api/account.go

\`\`\`go
package api

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
	"github.com/machingclee/2023-11-04-go-gin/internal/db"
	"github.com/machingclee/2023-11-04-go-gin/token"
)

type createAccountRequest struct {
	Owner    string \`json:"owner" binding:"required"\`
	Currency string \`json:"currency" binding:"required,currency"\`
}

func (server *Server) createAccount(ctx *gin.Context) {
	var req createAccountRequest

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, errorResponse(err))
		return
	}

	authPayload := ctx.MustGet(authorizationPayloadKey).(*token.Payload)

	arg := db.CreateAccountParams{
		Owner:    sql.NullString{String: authPayload.Username, Valid: true},
		Currency: req.Currency,
		Balance:  0,
	}

	account, err := server.store.CreateAccount(ctx, arg)

	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok {
			log.Println(pqErr.Code.Name())
		}
		ctx.JSON(http.StatusInternalServerError, errorResponse(err))
		return
	}

	ctx.JSON(http.StatusOK, account)
}

type getAccountRequest struct {
	ID int64 \`uri:"id" binding:"required,min=1"\`
}

func (server *Server) getAccount(ctx *gin.Context) {
	var req getAccountRequest

	if err := ctx.ShouldBindUri(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, errorResponse(err))
		return
	}

	authPayload := ctx.MustGet(authorizationPayloadKey).(*token.Payload)

	account, err := server.store.GetAccount(ctx, req.ID)

	isOwner := account.Owner.Valid && (account.Owner.String == authPayload.Username)

	if !isOwner {
		err := errors.New("Request user is not the account owner")
		ctx.JSON(http.StatusUnauthorized, errorResponse(err))
	}

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, errorResponse(err))
		return
	}

	ctx.JSON(http.StatusOK, account)
}

type listAccountRequest struct {
	Page int32 \`form:"page" binding:"required,min=1"\`
	Size int32 \`form:"size" binding:"required,min=5,max=100"\`
}

func (server *Server) listAccount(ctx *gin.Context) {
	var req listAccountRequest

	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, errorResponse(err))
		return
	}

	authPayload := ctx.MustGet(authorizationPayloadKey).(*token.Payload)

	arg := db.ListAccountsParams{
		Owner:  sql.NullString{String: authPayload.Username, Valid: true},
		Limit:  req.Size,
		Offset: req.Size * (req.Page - 1),
	}

	fmt.Println("arg", arg)

	accounts, err := server.store.ListAccounts(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, errorResponse(err))
		return
	}

	ctx.JSON(http.StatusOK, accounts)
}
\`\`\`

### util/config.go

This essentially captures the values from \`.env\` file.

\`\`\`go
package util

import (
	"github.com/spf13/viper"
	"time"
)

type Config struct {
	DBDriver            string        \`mapstructure:"DB_DRIVER"\`
	DBSource            string        \`mapstructure:"DB_SOURCE"\`
	ServerAddress       string        \`mapstructure:"SERVER_ADDRESS"\`
	TokenSymmetricKey   string        \`mapstructure:"TOKEN_SYMMETRIC_KEY"\`
	AccessTokenDuration time.Duration \`mapstructure:"ACCESS_TOKEN_DURATION"\`
}

func LoadConfig(parentDir string) (*Config, error) {
	viper.AddConfigPath(parentDir)
	viper.SetConfigName("app")
	viper.SetConfigType("env")

	viper.AutomaticEnv()

	err := viper.ReadInConfig()
	if err != nil {
		return nil, err
	}
	config := Config{}
	err = viper.Unmarshal(&config)
	if err != nil {
		return nil, err
	}
	return &config, nil
}
\`\`\`

### internal/db/store.go

\`\`\`go
type SQLStore struct {
	*Queries
	db *sql.DB
}

func NewStore(db *sql.DB) Store {
	return &SQLStore{
		db:      db,
		Queries: New(db),
	}
}
\`\`\`

Here both \`Queries\` and \`New\` come from \`db.go\` generated from \`sqlc\`, which we don't have much to care.

### token

#### token/maker.go, The Interface

Our file just contain an interface, as apart from jwt-token, we also use paseto-token in Golang world (which we don't introduce here).

\`\`\`go
package token

import "time"

type Maker interface {
	CreateToken(username string, duration time.Duration) (string, error)
	VerifyToken(token string) (*Payload, error)
}
\`\`\`

#### token/jwt_maker.go, The Implementation

\`\`\`go
package token

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const minSecretKeySize = 10

type JWTMaker struct {
	secretKey string
}

func NewJWTMaker(secretKey string) (Maker, error) {
	if len(secretKey) < minSecretKeySize {
		return nil, fmt.Errorf("invalid key size:,  must be at least %d characters", minSecretKeySize)
	}
	return &JWTMaker{secretKey}, nil
}

func (jwtMaker *JWTMaker) CreateToken(username string, duration time.Duration) (string, error) {
	payload, err := NewPayload(username, duration)

	if err != nil {
		return "", err
	}

	jwtToken := jwt.NewWithClaims(jwt.SigningMethodHS256, payload)
	return jwtToken.SignedString([]byte(jwtMaker.secretKey))
}

func (jwtMaker *JWTMaker) VerifyToken(token string) (*Payload, error) {
	keyFunc := func(token *jwt.Token) (interface{}, error) {
		_, ok := token.Method.(*jwt.SigningMethodHMAC)
		if !ok {
			return nil, ErrInvalidToken
		}
		return []byte(jwtMaker.secretKey), nil
	}
	jwtToken, err := jwt.ParseWithClaims(token, &Payload{}, keyFunc)

	if err != nil {
		return nil, errors.New(err.Error())
	}

	payload, ok := jwtToken.Claims.(*Payload)
	if !ok {
		return nil, ErrInvalidToken
	}

	return payload, nil
}
\`\`\`

#### token/payload.go

\`\`\`go
package token

import (
	"errors"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var (
	ErrInvalidToken = errors.New("Invalid Token")
	ErrExpiredToken = errors.New("token has invalid claims: token is expired")
)

type Payload struct {
	ID        uuid.UUID \`json:"id"\`
	Username  string    \`json:"username"\`
	IssuedAt  time.Time \`json:"issued_at"\`
	ExpiredAt time.Time \`json:"expired_at"\`
}

func (*Payload) GetAudience() (jwt.ClaimStrings, error) {
	return []string{"james-auth"}, nil
}

func (p *Payload) GetExpirationTime() (*jwt.NumericDate, error) {
	return jwt.NewNumericDate(p.ExpiredAt), nil
}

func (p *Payload) GetIssuedAt() (*jwt.NumericDate, error) {
	return jwt.NewNumericDate(p.IssuedAt), nil
}

func (*Payload) GetIssuer() (string, error) {
	return "James", nil
}

func (p *Payload) GetNotBefore() (*jwt.NumericDate, error) {
	return jwt.NewNumericDate(p.IssuedAt), nil
}

func (p *Payload) GetSubject() (string, error) {
	return p.Username, nil
}

func NewPayload(username string, duration time.Duration) (*Payload, error) {
	tokenID, err := uuid.NewRandom()
	if err != nil {
		return nil, err
	}

	payload := &Payload{
		ID:        tokenID,
		Username:  username,
		IssuedAt:  time.Now(),
		ExpiredAt: time.Now().Add(duration),
	}

	return payload, nil
}
\`\`\`
`;export{t as default};
