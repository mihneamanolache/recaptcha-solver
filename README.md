# `recaptcha-solver` aka RektCaptcha

[![npm version](https://img.shields.io/npm/v/@mihnea.dev/recaptcha-solver.svg)](https://www.npmjs.com/package/@mihnea.dev/recaptcha-solver)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

RektCaptcha is an automated solution for solving audio-based Google reCAPTCHA challenges using Puppeteer and Playwright. It leverages the Vosk speech-to-text model to transcribe the audio challenges and fill in the reCAPTCHA response field automatically.

## Features
- Supports **both Puppeteer and Playwright** for browser automation.
- Downloads and uses the Vosk speech-to-text model for transcribing audio.
- Automatically solves Google reCAPTCHA audio challenges.
- Compatible with ES modules and CommonJS.

## Installation
```bash
# Using npm
npm install @mihnea.dev/recaptcha-solver
# Using yarn
yarn add @mihnea.dev/recaptcha-solver
```

## Usage
Here's an example of how to use RektCaptcha with Puppeteer:
```typescript
import RektCaptcha from "@mihnea.dev/recaptcha-solver";
import puppeteer from "puppeteer";

async function main() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    const rektCaptcha = new RektCaptcha(page);
    await page.goto("https://www.google.com/recaptcha/api2/demo");
    await rektCaptcha.solve();
    await page.screenshot({ path: "screenshot.png" });
    console.log("Screenshot taken!");
    await browser.close();
}
main().catch(console.error);
```

And here's an example of how to use RektCaptcha with Playwright:
```typescript
import RektCaptcha from "@mihnea.dev/recaptcha-solver";
import { chromium } from "playwright";

async function main() {
    const browser = await chromium.launch({ 
        headless: false,
        proxy: {
            server: "<YOUR_PROXY_SERVER>",
            username: "<YOUR_PROXY_USERNAME>",
            password: "<YOUR_PROXY_PASSWORD>"
        }
    });
    const page = await browser.newPage();
    const rektCaptcha = new RektCaptcha(page);
    await page.goto("https://aida.info.ro/polite-rca");
    await rektCaptcha.solve();
    await page.screenshot({ path: "screenshot.png" });
    console.log("Screenshot taken!");
    await browser.close();
}
main().catch(console.error);
```

## Debugging
To enable debug logs, set the `DEBUG` environment variable to `recaptcha-solver:*`.

```bash
DEBUG=rektcaptcha* node script.js
```

## Contributing

Contributions are welcome! If you'd like to contribute to this project, please open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
