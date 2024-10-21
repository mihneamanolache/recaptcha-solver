import fs from "fs";
import os from 'os';
import path from "path";
import type { Page as PlaywrightPage, ElementHandle as PlaywrightElementHandle, Frame as PlaywrightFrame } from "playwright";
import type { Page as PuppeteerPage, ElementHandle as PuppeteerElementHandle, Frame as PuppeteerFrame } from "puppeteer";
import ffmpeg from 'fluent-ffmpeg';
import extract from 'extract-zip';
import { Model, Recognizer } from 'vosk';
import { Reader } from 'wav';
import tmp, { type FileResult } from 'tmp';
import debug, { type Debugger } from 'debug';

const MODEL_URL: string = 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip';
const HOME_DIR: string = os.homedir();
const MODEL_DIR: string = path.join(HOME_DIR, '.rektCaptcha', 'models');
const MODEL_PATH: string = path.join(MODEL_DIR, 'vosk-model-small-en-us-0.15');

// Type guards to check if we are working with Playwright or Puppeteer
function isPlaywrightPage(page: unknown): page is PlaywrightPage {
    return (page as PlaywrightPage).fill !== undefined;
}

function isPuppeteerPage(page: unknown): page is PuppeteerPage {
    return (page as PuppeteerPage).waitForSelector !== undefined;
}

// Type guards for Frames
function isPlaywrightFrame(frame: unknown): frame is PlaywrightFrame {
    return (frame as PlaywrightFrame).waitForSelector !== undefined;
}

function isPuppeteerFrame(frame: unknown): frame is PuppeteerFrame {
    return (frame as PuppeteerFrame).waitForSelector !== undefined;
}

/**
 * Class representing a RectCaptcha handler for solving audio reCAPTCHA challenges.
 */
export default class RektCaptcha {
    protected page:     PlaywrightPage | PuppeteerPage;
    protected timeout:  number;
    protected logger:   Debugger;
    private _model:     string;

    public constructor(
        page: PlaywrightPage | PuppeteerPage, 
        timeout: number = 15000, 
        model: string = MODEL_URL
    ) {
        this.page = page;
        this.timeout = timeout;
        this._model = model;
        this.logger = debug('rektcaptcha');
        this.downloadModel().then((): void => {
            this.logger("Vosk model is ready for use.");
        }).catch((): void => {/**/});
    }

    /**
     * Downloads and extracts the Vosk model for speech-to-text processing.
     * @returns {Promise<void>} - Resolves when the model is ready.
     */
    protected async downloadModel(): Promise<void> {
        if ([
            'am/final.mdl',
            'graph/HCLr.fst',
            'graph/Gr.fst',
            'ivector/final.dubm'
        ].every((file): boolean => fs.existsSync(path.join(MODEL_DIR, file)))) {
            this.logger('Model already exists, skipping download.');
            return;
        }

        this.logger('Downloading Vosk model...');
        const zipPath: string = path.join(MODEL_DIR, 'vosk-model-small-en-us-0.15.zip');

        if (!fs.existsSync(MODEL_DIR)) {
            fs.mkdirSync(MODEL_DIR, { recursive: true });
        }

        const response: Response = await fetch(this._model);
        const buffer: ArrayBuffer = await response.arrayBuffer();
        fs.writeFileSync(zipPath, Buffer.from(buffer));

        await extract(zipPath, { dir: MODEL_DIR });
        fs.unlinkSync(zipPath);
        this.logger('Model extracted.');
    }

    /**
     * Solves the reCAPTCHA challenge.
     */
    public async solve(): Promise<void> {
        this.logger("Solving reCAPTCHA.");

        const $recaptcha: PlaywrightElementHandle | PuppeteerElementHandle | null = await this.waitForSelector("iframe[src*='recaptcha']");
        if (!$recaptcha) throw new Error("reCAPTCHA iframe not found");

        const $recaptchaFrame: PlaywrightFrame | PuppeteerFrame | null = await this.getContentFrame($recaptcha as PlaywrightElementHandle<Element> | PuppeteerElementHandle);
        if (!$recaptchaFrame) throw new Error("reCAPTCHA content frame not found");

        const $recaptchaAnchor: PlaywrightElementHandle | PuppeteerElementHandle | null = await this.waitForSelectorInsideFrame($recaptchaFrame, "#recaptcha-anchor");
        if ($recaptchaAnchor) {
            if (isPlaywrightFrame($recaptchaFrame)) {
                await ($recaptchaAnchor as PlaywrightElementHandle<Element>).click();  // Playwright type
            } else if (isPuppeteerFrame($recaptchaFrame)) {
                await ($recaptchaAnchor as PuppeteerElementHandle).click();  // Puppeteer type
            }
        }

        const $challenge: PlaywrightElementHandle | PuppeteerElementHandle | null  = await this.waitForSelector("iframe[src*='https://www.google.com/recaptcha/api2/bframe']");
        if ($challenge) {
            const $challengeFrame: PlaywrightFrame | PuppeteerFrame | null = await this.getContentFrame($challenge as PlaywrightElementHandle<Element> | PuppeteerElementHandle);
            if ($challengeFrame) {
                await this.solveTask($challengeFrame);
            } else {
                throw new Error("Could not retrieve content frame from challenge iframe.");
            }
        } else {
            throw new Error("Challenge iframe not found.");
        }

    }

    /**
     * Solves the specific task inside the reCAPTCHA challenge.
     * @param {Frame} frame - The reCAPTCHA challenge frame.
     */
    protected async solveTask(frame: PlaywrightFrame | PuppeteerFrame): Promise<void> {
        const audioBtn: PlaywrightElementHandle | PuppeteerElementHandle | null = await this.waitForSelectorInsideFrame(frame, "#recaptcha-audio-button");
        if (audioBtn) {
            if (isPlaywrightFrame(frame)) {
                await (audioBtn as PlaywrightElementHandle<Element>).click();  // Playwright type
            } else if (isPuppeteerFrame(frame)) {
                await (audioBtn as PuppeteerElementHandle).click();  // Puppeteer type
            }
        }

        this.logger("Waiting for audio challenge...");
        await new Promise((resolve): NodeJS.Timeout => setTimeout(resolve, 2000));

        const audioSrc: string | null = await this.getAttributeFromSelector(frame, "#audio-source", "src");
        this.logger("Audio source:", audioSrc);

        if (audioSrc) {
            const result: string = await this.processAudioChallenge(audioSrc);
            this.logger("Transcription result:", result);

            const $responseField: PuppeteerElementHandle | PlaywrightElementHandle | null = await this.waitForSelectorInsideFrame(frame, "#audio-response");
            if ($responseField) {
                await this.fillOrType($responseField as PlaywrightElementHandle<Element> | PuppeteerElementHandle, result);
            }

            const verifyButton: PuppeteerElementHandle | PlaywrightElementHandle | null = await this.waitForSelectorInsideFrame(frame, "#recaptcha-verify-button");
            if (verifyButton) {
                if (isPlaywrightFrame(frame)) {
                    await (verifyButton as PlaywrightElementHandle<Element>).click();  // Playwright type
                } else if (isPuppeteerFrame(frame)) {
                    await (verifyButton as PuppeteerElementHandle).click();  // Puppeteer type
                }

            }
        }
    }

        /**
         * Fetches and processes audio from the reCAPTCHA's audio challenge and sends it for speech-to-text processing.
         * @param {string} audioSrc - The source URL of the audio file from the reCAPTCHA.
         * @returns {Promise<string | null>} - Resolves when the audio has been processed and transcribed.
         */
        protected async processAudioChallenge(audioSrc: string): Promise<string> {
            this.logger("Downloading audio challenge...");
        const response: Response = await fetch(audioSrc);
        if (!response.ok) {
            throw new Error(`Failed to download audio: ${response.statusText}`);
        }

        const audioBuffer: ArrayBuffer = await response.arrayBuffer();
        const wavBuffer: Buffer = await this.preprocessAudioBuffer(Buffer.from(audioBuffer), 'mp3');
        const result: string = await this.runSpeechToText(wavBuffer);
        return result;
    }

    /**
     * Preprocesses the audio buffer, converting it to 16kHz mono WAV format required by the Vosk model.
     * @param {Buffer} audioBuffer - The audio buffer to preprocess.
     * @param {string} inputFormat - The format of the input audio (e.g., 'mp3').
     * @returns {Promise<Buffer>} - Resolves with the processed audio buffer in WAV format.
     */
    protected async preprocessAudioBuffer(audioBuffer: Buffer, inputFormat: string): Promise<Buffer> {
        return new Promise((resolve, reject): void => {
            this.logger(`Converting audio buffer from ${inputFormat} to 16kHz mono WAV...`);

            const tmpInputFile: FileResult = tmp.fileSync({ postfix: `.${inputFormat}` });
            const tmpOutputFile: FileResult = tmp.fileSync({ postfix: '.wav' });

            fs.writeFileSync(tmpInputFile.name, audioBuffer);

            ffmpeg(tmpInputFile.name)
                .audioFrequency(16000)
                .audioChannels(1)
                .toFormat('wav')
                .on('error', (err): void => {
                    console.error('Error during audio processing:', err);
                    reject(err);
                })
                .on('end', (): void => {
                    this.logger('Audio processing complete.');
                    const processedBuffer: Buffer = fs.readFileSync(tmpOutputFile.name);
                    resolve(processedBuffer);

                    tmpInputFile.removeCallback();
                    tmpOutputFile.removeCallback();
                })
                .save(tmpOutputFile.name);
        });
    }

    /**
     * Runs the speech-to-text process using the Vosk model on the preprocessed audio buffer.
     * @param {Buffer} audioBuffer - The preprocessed audio buffer.
     * @returns {Promise<string>} - Resolves with the final transcription.
     */
    protected async runSpeechToText(audioBuffer: Buffer): Promise<string> {
        await this.downloadModel();

        const model: Model = new Model(MODEL_PATH);
        const wfReader: Reader = new Reader();

        return new Promise((resolve, reject): void => {
            wfReader.on('format', ({ audioFormat, sampleRate, channels }): void => {
                if (audioFormat !== 1 || channels !== 1) {
                    reject(new Error('Audio must be WAV format with Mono channel'));
                    return;
                }

                const rec = new Recognizer({ model, sampleRate });
                wfReader.on('data', (data: Buffer): void => {
                    if (rec.acceptWaveform(data)) {
                        resolve(rec.finalResult().text);
                    }
                });

                wfReader.on('end', (): void => {
                    const result = rec.finalResult();
                    resolve(result.text);
                    rec.free();
                    model.free();
                });
            });
            wfReader.end(audioBuffer);
        });
    }

    /**
     * Waits for a selector using the appropriate page type (Playwright or Puppeteer).
     */
    protected async waitForSelector(selector: string): Promise<PlaywrightElementHandle<Element> | PuppeteerElementHandle | null> {
        if (isPlaywrightPage(this.page)) {
            return this.page.waitForSelector(selector, { timeout: this.timeout }) as Promise<PlaywrightElementHandle<Element> | null>;
        } else if (isPuppeteerPage(this.page)) {
            return this.page.waitForSelector(selector, { timeout: this.timeout });
        }
        return null;
    }

    /**
     * Waits for a selector inside a frame using the appropriate frame type (Playwright or Puppeteer).
     */
    protected async waitForSelectorInsideFrame(
        frame: PlaywrightFrame | PuppeteerFrame,
        selector: string
    ): Promise<PlaywrightElementHandle<Element> | PuppeteerElementHandle | null> {
        if (isPlaywrightFrame(frame)) {
            return frame.waitForSelector(selector, { timeout: this.timeout }) as Promise<PlaywrightElementHandle<Element> | null>;
        } else if (isPuppeteerFrame(frame)) {
            return frame.waitForSelector(selector, { timeout: this.timeout });
        }
        return null;
    }

    /**
     * Gets the content frame of an iframe element using the appropriate page type.
     */
    protected async getContentFrame(
        element: PlaywrightElementHandle<Element> | PuppeteerElementHandle
    ): Promise<PlaywrightFrame | PuppeteerFrame | null> {
        if (isPlaywrightPage(this.page)) {
            return (element as PlaywrightElementHandle<Element>).contentFrame();
        } else if (isPuppeteerPage(this.page)) {
            return (element as PuppeteerElementHandle).contentFrame();
        }
        return null;
    }

    /**
     * Gets the attribute from a selector inside a frame.
     */
    protected async getAttributeFromSelector(
        frame: PlaywrightFrame | PuppeteerFrame,
        selector: string,
        attribute: string
    ): Promise<string | null> {
        if (isPlaywrightFrame(frame)) {
            return frame.$eval(selector, (el: Element, attr: string): string | null => el.getAttribute(attr), attribute);
        } else if (isPuppeteerFrame(frame)) {
            return frame.$eval(selector, (el: Element): string | null => el.getAttribute(attribute));
        }
        return null;
    }

    /**
     * Fills or types into an input field based on Playwright or Puppeteer.
     */
    protected async fillOrType(
        element: PlaywrightElementHandle<Element> | PuppeteerElementHandle,
        text: string
    ): Promise<void> {
        if (isPlaywrightPage(this.page)) {
            await (element as PlaywrightElementHandle<Element>).fill(text); 
        } else if (isPuppeteerPage(this.page)) {
            await (element as PuppeteerElementHandle).type(text); 
        }
    }
}
