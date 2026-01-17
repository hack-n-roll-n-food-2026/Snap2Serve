FROM golang:1.22 AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/preprocess ./cmd/preprocess

FROM gcr.io/distroless/static
COPY --from=build /bin/preprocess /preprocess
EXPOSE 8080
ENTRYPOINT ["/preprocess"]
