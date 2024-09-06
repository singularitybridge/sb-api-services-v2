import { createOpenAiActions } from '../../../src/actions/openAiActions';
import { ActionContext } from '../../../src/actions/types';
import * as apiKeyService from '../../../src/services/api.key.service';
import * as oaiSpeechService from '../../../src/services/oai.speech.service';
import * as speechRecognitionService from '../../../src/services/speech.recognition.service';

jest.mock('../../../src/services/api.key.service');
jest.mock('../../../src/services/oai.speech.service');
jest.mock('../../../src/services/speech.recognition.service');

describe('OpenAI Actions', () => {
  let mockContext: ActionContext;
  let actions: ReturnType<typeof createOpenAiActions>;

  beforeEach(() => {
    mockContext = {
      sessionId: 'test-session-id',
      companyId: 'test-company-id',
    };

    actions = createOpenAiActions(mockContext);

    jest.resetAllMocks();
  });

  describe('generateOpenAiSpeech', () => {
    it('should generate speech successfully', async () => {
      const mockApiKey = 'test-api-key';
      const mockAudioUrl = 'https://example.com/audio.mp3';

      (apiKeyService.getApiKey as jest.Mock).mockResolvedValue(mockApiKey);
      (oaiSpeechService.generateSpeech as jest.Mock).mockResolvedValue(mockAudioUrl);

      const result = await actions.generateOpenAiSpeech.function({
        text: 'Hello, world!',
      });

      expect(result).toEqual({ audioUrl: mockAudioUrl });
      expect(apiKeyService.getApiKey).toHaveBeenCalledWith(mockContext.companyId, 'openai');
      expect(oaiSpeechService.generateSpeech).toHaveBeenCalledWith(
        mockApiKey,
        'Hello, world!',
        'alloy',
        'tts-1-hd',
        256
      );
    });

    it('should throw an error if API key is missing', async () => {
      (apiKeyService.getApiKey as jest.Mock).mockResolvedValue(null);

      await expect(
        actions.generateOpenAiSpeech.function({
          text: 'Hello, world!',
        })
      ).rejects.toThrow('OpenAI API key is missing');
    });

    it('should throw an error if speech generation fails', async () => {
      const mockApiKey = 'test-api-key';

      (apiKeyService.getApiKey as jest.Mock).mockResolvedValue(mockApiKey);
      (oaiSpeechService.generateSpeech as jest.Mock).mockRejectedValue(new Error('Generation failed'));

      await expect(
        actions.generateOpenAiSpeech.function({
          text: 'Hello, world!',
        })
      ).rejects.toThrow('Failed to generate speech with OpenAI');
    });
  });

  describe('transcribeAudioWhisperFromURL', () => {
    it('should transcribe audio successfully', async () => {
      const mockApiKey = 'test-api-key';
      const mockTranscription = 'This is a transcription';

      (apiKeyService.getApiKey as jest.Mock).mockResolvedValue(mockApiKey);
      (speechRecognitionService.transcribeAudioWhisperFromURL as jest.Mock).mockResolvedValue(mockTranscription);

      const result = await actions.transcribeAudioWhisperFromURL.function({
        audioUrl: 'https://example.com/audio.mp3',
      });

      expect(result).toEqual({ transcription: mockTranscription });
      expect(apiKeyService.getApiKey).toHaveBeenCalledWith(mockContext.companyId, 'openai');
      expect(speechRecognitionService.transcribeAudioWhisperFromURL).toHaveBeenCalledWith(
        mockApiKey,
        'https://example.com/audio.mp3'
      );
    });

    it('should throw an error if API key is missing', async () => {
      (apiKeyService.getApiKey as jest.Mock).mockResolvedValue(null);

      await expect(
        actions.transcribeAudioWhisperFromURL.function({
          audioUrl: 'https://example.com/audio.mp3',
        })
      ).rejects.toThrow('OpenAI API key is missing');
    });

    it('should throw an error if transcription fails', async () => {
      const mockApiKey = 'test-api-key';

      (apiKeyService.getApiKey as jest.Mock).mockResolvedValue(mockApiKey);
      (speechRecognitionService.transcribeAudioWhisperFromURL as jest.Mock).mockRejectedValue(new Error('Transcription failed'));

      await expect(
        actions.transcribeAudioWhisperFromURL.function({
          audioUrl: 'https://example.com/audio.mp3',
        })
      ).rejects.toThrow('Failed to transcribe audio with OpenAI Whisper');
    });
  });
});