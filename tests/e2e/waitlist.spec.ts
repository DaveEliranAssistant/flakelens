import { expect, test, type Page } from "@playwright/test";

async function stubWaitlist(page: Page, onPost: (body: { email?: string; consent?: boolean }) => void) {
  await page.route("**/api/waitlist", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { available: true } });
      return;
    }
    const body = route.request().postDataJSON() as { email?: string; consent?: boolean };
    onPost(body);
    await route.fulfill({ json: { ok: true, message: "You are on the waitlist." } });
  });
}

test("joins only after consent and discloses what is stored", async ({ page }) => {
  const posts: { email?: string; consent?: boolean }[] = [];
  await stubWaitlist(page, (body) => posts.push(body));
  let mailtoAttempted = false;
  page.on("request", (request) => {
    if (request.url().startsWith("mailto:")) mailtoAttempted = true;
  });

  await page.goto("/");
  const section = page.locator("#waitlist");
  await expect(section.getByRole("heading", { name: "Hear about the Action" })).toBeVisible();
  await expect(section.getByRole("link", { name: "npm CLI" })).toHaveAttribute("href", "#cli");
  await expect(section.getByRole("link", { name: "browser triage" })).toHaveAttribute("href", "#triage");

  const consent = page.getByLabel("I agree to receive updates about the FlakeLens GitHub Action.");
  await expect(consent).not.toBeChecked();
  await expect(page.locator(".waitlist-trap")).toHaveAttribute("inert", "");

  await section.getByText("What the waitlist stores").click();
  await expect(section).toContainText("SHA-256 hash of your browser user agent");
  await expect(section).toContainText("Your IP address is not stored");
  await expect(section).toContainText("Signups are kept until you ask for deletion");
  await expect(section.getByRole("link", { name: "dave.eliran.assistant@gmail.com" })).toHaveAttribute(
    "href",
    "mailto:dave.eliran.assistant@gmail.com?subject=FlakeLens%20waitlist%20deletion",
  );

  await page.getByLabel("Email").fill("person@example.com");
  await page.getByRole("button", { name: "Join the waitlist" }).click();
  await expect(page.locator("#waitlist-error")).toBeFocused();
  await expect(section).toContainText("Consent is required to join the waitlist.");
  expect(posts).toEqual([]);

  await consent.check();
  await page.getByRole("button", { name: "Join the waitlist" }).click();
  const success = page.locator("#waitlist-success");
  await expect(success).toContainText("You are on the waitlist.");
  await expect(success).toBeFocused();
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatchObject({ email: "person@example.com", consent: true });
  expect(mailtoAttempted).toBe(false);
});

test("removes the address the old form left in local storage", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("flakelens.waitlist.v1", "[]"));
  await page.reload();
  await expect(page.locator("#waitlist")).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("flakelens.waitlist.v1"))).toBeNull();
});

test("says the waitlist is unavailable and hides the form when the API returns 503", async ({ page }) => {
  await page.route("**/api/waitlist", (route) =>
    route.fulfill({ status: 503, json: { available: false, message: "The waitlist is temporarily unavailable." } }),
  );
  await page.goto("/");
  const section = page.locator("#waitlist");
  await expect(section.getByRole("status")).toHaveText("The waitlist is temporarily unavailable.");
  await expect(page.getByTestId("waitlist-form")).toHaveCount(0);
  await expect(section.getByRole("link", { name: "npm CLI" })).toBeVisible();
});
