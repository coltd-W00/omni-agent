# Harness

Mục tiêu của project là cung cấp một reusable operating harness cho phép humans
và agents biến future product spec thành công việc an toàn, có validation.

App là thứ users chạm vào. Harness là thứ agents chạm vào.

## Mental Model

```text
------------------+
| Human intent    |
+------------------+
         |
         v
+------------------+
| Feature intake   |
+------------------+
         |
         v
+------------------+
| Story packet     |
+------------------+
         |
         v
+------------------+
| Agent work loop  |
+------------------+
         |
         v
+------------------+
| Product delta    |
+------------------+
         |
         v
+------------------+
| Validation proof |
+------------------+
         |
         v
+------------------+
| Harness delta    |
+------------------+
         |
         v
+------------------+
| Next intent      |
+------------------+
```

Mỗi task có hai output khả dĩ:

1. Product delta: app code, tests, API shape, data model, hoặc product docs.
2. Harness delta: docs, templates, validation expectations, backlog items, hoặc
   decision records giúp task tiếp theo dễ hơn.

## Harness v0 Scope

Harness v0 bao gồm:

- Agent entrypoint.
- Empty product documentation structure.
- Feature intake và risk lanes.
- Story templates.
- Decision log template.
- Validation report template.
- Test matrix placeholder.
- Harness growth backlog.

Harness v0 cố ý loại trừ:

- Project-specific `SPEC.md`.
- Pre-sliced product domains.
- Locked application stack.
- App source scaffolding.
- Package scripts.
- Test runner config.
- CI workflows.
- Database migrations hoặc infrastructure.

Những thứ đó chỉ nên xuất hiện khi một selected story cần chúng.

## Source Hierarchy

```text
User-provided spec or prompt
  input material for first buildout or future changes

docs/product/*
  current product contract derived from accepted input

docs/stories/*
  story-sized work packets and historical evidence

docs/TEST_MATRIX.md
  behavior-to-proof control panel

docs/decisions/*
  why the contract changed
```

Trước implementation, product docs mô tả intent. Sau implementation, product
docs cộng với executable tests trở thành living contract.

## Spec Lifecycle

Harness v0 bắt đầu mà không track project spec. Khi human cung cấp
specification, xem nó là input material, không phải operating manual vĩnh viễn.
Dùng nó để populate product docs, story packets, architecture decisions, và
validation expectations trong buildout đầu tiên.

Sau khi specification đã được phân rã, không tiếp tục mở rộng nó như living
product plan. Ongoing work nên cập nhật các product docs nhỏ hơn, stories, test
matrix, và decision records.

Ongoing work nên đi vào harness dưới một trong các input types:

- New spec: project specification cần trở thành product docs và initial story
  candidates.
- Spec slice: một selected behavior từ spec đã được chấp nhận.
- Change request: bounded behavior change, bug fix, hoặc product refinement.
- New initiative: product area lớn hơn cần nhiều stories.
- Maintenance request: dependency, architecture, performance, security, hoặc
  operational work.
- Harness improvement: thay đổi process, template, proof, hoặc
  agent-instruction.

Spec-to-work loop là:

```text
human intent or supplied spec
  -> classify input type
  -> update or create product contract
  -> create story packet or initiative notes when needed
  -> define validation proof
  -> implement or document the blocker
  -> update product docs, stories, test matrix, and decisions
  -> capture harness friction
```

Product areas lớn nên dùng scoped initiative notes thay vì một monolithic
specification thứ hai. Một initiative nên giải thích goal, affected product
docs, candidate stories, validation shape, open decisions, và exit criteria.
Nếu initiative work trở thành repeated pattern, thêm template hoặc proposal vào
`docs/HARNESS_BACKLOG.md`.

## Growth Rule

Harness phát triển từ friction.

Khi agent bị nhầm lẫn, lặp lại manual reasoning, cần validation command mới,
phát hiện missing rule, hoặc thấy recurring failure pattern, agent phải cải
thiện harness trực tiếp hoặc thêm proposal vào `HARNESS_BACKLOG.md`.

## Future Validation Ladder

Hiện chưa có validation scripts. Khi implementation bắt đầu, ladder kỳ vọng là:

```text
validate:quick
  format, lint, typecheck, unit tests, architecture check

test:integration
  backend, database, provider, or service checks as the stack requires

test:e2e
  user-visible end-to-end flows

test:platform
  shell, mobile, desktop, or deployment smoke checks as the stack requires

test:release
  full suite, log checks, and performance smoke
```

Agents không được claim các commands này pass cho đến khi chúng tồn tại và đã
được chạy.
