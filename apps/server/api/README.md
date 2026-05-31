# Internal gRPC Contracts

This directory contains internal service contracts used between `apps/server` and internal callers (for example `apps/agent`).

## Current proto files

- `proto/task/v1/task.proto`

## Generation

Use your preferred protobuf toolchain (for example `buf` or `protoc`) to generate Go stubs into `api/gen`.

Example (protoc):

```bash
PATH="$(go env GOPATH)/bin:$PATH" protoc \
  --go_out=./api/gen \
  --go_opt=paths=source_relative \
  --go-grpc_out=./api/gen \
  --go-grpc_opt=paths=source_relative \
  --proto_path=./api/proto \
  ./api/proto/task/v1/task.proto
```

