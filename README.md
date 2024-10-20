# `recaptcha-solver` aka RektCaptcha

RektCaptcha is an automated solution for solving audio-based Google reCAPTCHA challenges using Puppeteer and Playwright. It leverages the Vosk speech-to-text model to transcribe the audio challenges and fill in the reCAPTCHA response field automatically.

## Features
- Supports both Puppeteer and Playwright for browser automation.
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

## Debugging
To enable debug logs, set the `DEBUG` environment variable to `recaptcha-solver:*`.

```bash
DEBUG=rektcaptcha* node script.js
```

## Contributing

Contributions are welcome! If you'd like to contribute to this project, please open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
