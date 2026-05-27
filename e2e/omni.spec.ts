import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

test("E2E project task start resume flow", async ({ page }) => {
  // Sinh random key và name để tránh trùng lặp giữa các lần chạy test
  const rand = Math.floor(Math.random() * 900 + 100);
  const projectKey = `UIE${rand}`;
  const projectName = `E2E UI Project ${rand}`;

  // 1. Mở trang Board trực tiếp
  console.log("Navigating to Board page...");
  await page.goto("http://localhost:5173/board");
  await expect(page).toHaveURL(/.*board/);

  // 2. Click mở Project Switcher
  console.log("Opening Project Switcher dropdown...");
  const switcher = page.locator(".project-switcher__trigger");
  await expect(switcher).toBeVisible();
  await switcher.click();

  // 3. Click "+ New Project"
  console.log("Clicking + New Project button...");
  const newProjBtn = page.locator(".project-switcher__new-project-btn");
  await expect(newProjBtn).toBeVisible();
  await newProjBtn.click();

  // 4. Điền form tạo project (Sử dụng dialog[open] để tránh strict mode trùng lặp)
  console.log(`Filling Create Project form with key ${projectKey}...`);
  const nameInput = page.locator("dialog[open] #project-name");
  const keyInput = page.locator("dialog[open] #project-key");
  const workspaceInput = page.locator("dialog[open] #project-workspace-path");
  const submitProjBtn = page.locator("dialog[open] button[type='submit']");

  await nameInput.fill(projectName);
  await keyInput.fill(projectKey);
  const workspacePath = process.env.E2E_WORKSPACE_PATH || "/tmp";
  await workspaceInput.fill(workspacePath);
  await submitProjBtn.click();

  // Chờ cho dialog Create Project đóng hẳn
  console.log("Waiting for Create Project modal to close...");
  await expect(page.locator("dialog.create-project-modal[open]")).toBeHidden();

  // Chủ động mở Project Switcher và chọn project vừa tạo để tránh race-condition tự động chọn của React Hook
  console.log("Opening Project Switcher to select the new project...");
  await switcher.click();
  const projectItem = page.locator(".project-switcher__item", { hasText: projectName });
  await expect(projectItem).toBeVisible();
  await projectItem.click();

  // Chờ Project switcher cập nhật active project
  console.log("Verifying active project label updated...");
  await expect(page.locator(".project-switcher__trigger-name")).toHaveText(projectName);

  // Đảm bảo chúng ta đang ở trang Board
  console.log("Ensuring we are on Board page...");
  await page.goto("http://localhost:5173/board");

  // 5. Tạo Task mới cho REAL CODEX agent
  console.log("Creating new Task for REAL Codex agent...");
  await page.getByRole("button", { name: "+ New Task" }).click();
  
  // Đợi Modal Create Task mở ra (dialog open)
  await expect(page.locator("dialog.app-create-task-modal[open]")).toBeVisible();
  
  await page.locator("dialog[open] #create-task-title").fill("E2E Real Codex Task");
  // Hướng dẫn Codex ghi file để ta dễ kiểm chứng kết quả chạy thật trên disk
  await page.locator("dialog[open] #create-task-description").fill(
    "Write a single file named codex_e2e.txt containing the exact word 'OMNI_AGENT_E2E' inside the current directory. Do not run any other commands. Just write the file and exit."
  );
  
  // Chọn agent codex (REAL) và role coder
  await page.locator("dialog[open] #create-task-agent").selectOption("codex");
  await page.locator("dialog[open] #create-task-role").selectOption("coder");
  await page.locator("dialog[open] button[type='submit']").click();

  // Chờ cho dialog Create Task đóng hẳn
  console.log("Waiting for Create Task modal to close...");
  await expect(page.locator("dialog.app-create-task-modal[open]")).toBeHidden();

  // Đi tới trang Board để tìm task card
  console.log("Navigating to Board page to view task card...");
  await page.goto("http://localhost:5173/board");

  // Chờ task card xuất hiện trên board ở cột Assigned
  console.log("Verifying task card appears on the board...");
  const taskCard = page.locator(".app-task-card", { hasText: "E2E Real Codex Task" });
  await expect(taskCard).toBeVisible();

  // 6. Click vào task card để mở Task Detail Panel
  console.log("Opening Task Detail Panel...");
  await taskCard.click();

  // 7. Click "Start Session" để gọi Codex thật chạy
  console.log("Starting Real Codex Session (this will call LLM and execute)...");
  const startBtn = page.getByRole("button", { name: "Start Session" });
  await expect(startBtn).toBeVisible();
  await startBtn.click();

  // Chờ task badge đổi thành Running
  console.log("Verifying task transitions to running...");
  await expect(page.locator(".app-status-badge").first()).toHaveText(/Running/);

  // 8. Chờ Codex thật hoàn thành task.
  // Vì Codex thật chạy qua mạng và xử lý LLM, ta sẽ chờ tối đa 45 giây để task tự động chuyển sang Paused hoặc Completed/Failed.
  console.log("Waiting for Real Codex agent to finish and exit (auto-pause/complete)...");
  
  // Ta dùng expect poll để kiểm tra trạng thái thay đổi từ Running sang trạng thái kết thúc (Paused hoặc Completed)
  const statusBadge = page.locator(".app-status-badge").first();
  await expect(statusBadge).not.toHaveText(/Running/, { timeout: 60000 });
  
  const finalStatus = await statusBadge.textContent();
  console.log(`Real Codex run 1 finished with status: ${finalStatus}`);

  // Kiểm tra xem file thực tế có được tạo ra trong workspace chưa
  const createdFilePath = path.join(workspacePath, "codex_e2e.txt");
  console.log(`Checking if file exists at: ${createdFilePath}`);
  expect(fs.existsSync(createdFilePath)).toBe(true);
  const fileContent = fs.readFileSync(createdFilePath, "utf8");
  console.log(`File content created by Codex: ${fileContent}`);
  expect(fileContent).toContain("OMNI_AGENT_E2E");

  // 9. Điền comment để chuẩn bị resume. Yêu cầu ghi thêm thông tin vào file đó để chứng minh resume chạy thật.
  console.log("Filling resume comment in Summary tab...");
  const resumeCommentInput = page.locator(".summary-comment-textarea");
  await expect(resumeCommentInput).toBeVisible();
  await resumeCommentInput.fill(
    "Now, append the text 'OMNI_AGENT_RESUMED' to the same file codex_e2e.txt and exit. Do not run any other commands."
  );

  // 10. Click Resume Session để chạy tiếp
  console.log("Clicking Resume Session button (real Codex resume)...");
  const resumeBtn = page.getByRole("button", { name: "Resume Session" });
  await expect(resumeBtn).toBeVisible();
  await resumeBtn.click();

  // Assert trạng thái task quay lại running
  console.log("Verifying task transitions back to running...");
  await expect(page.locator(".app-status-badge").first()).toHaveText(/Running/);

  // Chờ run thứ hai kết thúc
  console.log("Waiting for resumed real Codex to finish...");
  await expect(statusBadge).not.toHaveText(/Running/, { timeout: 60000 });
  const resumeFinalStatus = await statusBadge.textContent();
  console.log(`Real Codex resume finished with status: ${resumeFinalStatus}`);

  // Kiểm tra xem file đã được append nội dung mới chưa
  console.log("Verifying updated file content on disk...");
  const updatedContent = fs.readFileSync(createdFilePath, "utf8");
  console.log(`Updated file content after Resume: ${updatedContent}`);
  expect(updatedContent).toContain("OMNI_AGENT_RESUMED");
  
  console.log("E2E Real Codex Playwright Flow Completed Successfully!");
});
