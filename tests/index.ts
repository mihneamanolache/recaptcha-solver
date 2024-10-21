import { chromium } from "playwright";
import RektCaptcha from "../src";
import puppeteer from "puppeteer";
import { expect } from "chai";

const launchOptions = { headless: false };

describe("Solve rektCaptcha", (): void => {
    it("Playwright", async (): Promise<void> => {
        const browser = await chromium.connect(`ws:/localhost:3000/chromium/playwright?launch=${JSON.stringify(launchOptions)}`);
        const page = await browser.newPage();
        page.setDefaultTimeout(60_000);
        const rectCaptcha = new RektCaptcha(page); 
        await page.goto("https://aida.info.ro/polite-rca");
        await rectCaptcha.solve();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const $recaptchaFrame = await (async () => {
            try {
                const _s = await page.waitForSelector("iframe[src*='recaptcha']", { timeout: 10000 });
                return _s;
            } catch (e: unknown) {
                return null;
            }
        })();
        const $recaptcha = await $recaptchaFrame?.contentFrame();
        const $checkBox = await $recaptcha?.$(".recaptcha-checkbox");
        const ariaChecked = await $checkBox?.getAttribute("aria-checked");
        expect(ariaChecked).to.equal("true");
        await browser.close();
    });

    it("Puppeteer", async (): Promise<void> => {
        const browser = await puppeteer.connect({
            browserWSEndpoint: `ws://localhost:3000?launch=${JSON.stringify(launchOptions)}`,
        });
        const page = await browser.newPage();
        page.setDefaultTimeout(60_000);
        const rectCaptcha = new RektCaptcha(page); 
        await page.goto("https://aida.info.ro/polite-rca");
        await rectCaptcha.solve();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const $recaptchaFrame = await (async () => {
            try {
                const _s = await page.waitForSelector("iframe[src*='recaptcha']", { timeout: 10000 });
                return _s;
            } catch (e: unknown) {
                return null;
            }
        })();
        const $recaptcha = await $recaptchaFrame?.contentFrame();
        const ariaChecked = await $recaptcha?.$eval(".recaptcha-checkbox", (el) => el.getAttribute("aria-checked"));
        console.log(ariaChecked + "\n\n\n");
        expect(ariaChecked).to.equal("true");
        await browser.close();
    });
});

