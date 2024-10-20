import { chromium } from "playwright";
import RektCaptcha from "../src";
import puppeteer from "puppeteer";

describe("Solve rectCaptcha", (): void => {
    it("Playwrigh", async (): Promise<void> => {
        const browser = await chromium.launch({
            headless: false,
        });
        const page = await browser.newPage();
        page.setDefaultTimeout(60_000);
        const rectCaptcha = new RektCaptcha(page); 
        await page.goto("https://aida.info.ro/polite-rca");
        await rectCaptcha.solve();
        await page.screenshot({ path: "screenshot.png" });
        await browser.close();
    });

    it("Puppeteer", async (): Promise<void> => {
        const browser = await puppeteer.launch({
            headless: false,
        });
        const page = await browser.newPage();
        page.setDefaultTimeout(60_000);
        const rectCaptcha = new RektCaptcha(page); 
        await page.goto("https://aida.info.ro/polite-rca");
        await rectCaptcha.solve();
        await page.screenshot({ path: "screenshot.png" });
        await browser.close();
    });
});

