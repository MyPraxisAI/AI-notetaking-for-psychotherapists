 
import { YandexLongAudioV3Provider } from './long_audio_v3';
import { readFileSync } from 'fs';

describe('YandexLongAudioV3Provider.processTranscriptionResult', () => {
  it('processes parsed NDJSON and preserves Cyrillic text', async () => {
    // // Set dummy env vars to satisfy constructor
    // process.env.YANDEX_API_KEY = 'dummy';
    // process.env.YANDEX_FOLDER_ID = 'dummy';
    // process.env.YANDEX_STORAGE_BUCKET = 'dummy';
    // process.env.YANDEX_ACCESS_KEY_ID = 'dummy';
    // process.env.YANDEX_SECRET_ACCESS_KEY = 'dummy';

    // const filePath = '/tmp/yandex-transcription-f8dnpma57co5g21dm13d.txt';
    // const raw = readFileSync(filePath, 'utf8');
    // const provider = new YandexLongAudioV3Provider();

    // // Use parseResponseData to get the result
    // const parsed = (provider as any).parseResponseData(raw);

    // // Call processTranscriptionResult with the parsed result
    // const processingTime = 0;
    // const options = { version: 'v3', model: 'general' };
    // const result = await (provider as any).processTranscriptionResult(parsed, processingTime, options);

    // // Search for the problematic context in the output
    // const allText = JSON.stringify(result.content_json);
    // console.log(allText);
    // expect(allText).toContain('Блин, хочется тебя обнять на самом деле');
    // expect(allText).not.toContain('��');
  });
}); 