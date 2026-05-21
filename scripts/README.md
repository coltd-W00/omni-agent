# Scripts

Thư mục này dành riêng cho harness automation.

## Installer

Upstream installer áp dụng Harness v0 operating files và folder structure vào
một target project directory. Nó mặc định dùng current directory, nhận target
path, và hỏi interactive users chọn `1. Merge`, `2. Override`, hoặc `3. Stop`
khi target đã chứa `AGENTS.md`, `docs/`, hoặc `scripts/`. Non-interactive
installs dừng trên các protected paths đó trừ khi có `--merge` hoặc
`--override`.

```bash
curl -fsSL "https://raw.githubusercontent.com/hoangnb24/harness-experimental/main/scripts/install-harness.sh?$(date +%s)" | bash -s -- --yes
```

```bash
curl -fsSL "https://raw.githubusercontent.com/hoangnb24/harness-experimental/main/scripts/install-harness.sh?$(date +%s)" | bash -s -- --merge --yes
```

Installer phải giới hạn trong harness files. Không dùng nó để scaffold
application source folders, package scripts, CI, tests, platform shells, hoặc
fake validation commands. Installer script không thuộc installed project
payload.

## Future Command Contract

Expected future checks:

```text
validate:quick
  format, lint, typecheck, unit tests, architecture check

test:integration
  backend contract and integration checks

test:e2e
  user-visible end-to-end flows

test:platform
  platform shell smoke checks, if the project has a native shell

test:release
  full suite, log checks, and performance smoke
```
