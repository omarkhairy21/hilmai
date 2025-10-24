import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const inputSchema = z.object({
  chatId: z.number(),
  voiceFilePath: z.string(),
  userInfo: z.object({
    username: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  }),
});

const transcribe = createStep({
  id: 'transcribe',
  inputSchema,
  outputSchema: z.object({
    chatId: z.number(),
    userInfo: inputSchema.shape.userInfo,
    text: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const txAgent = mastra.getAgent('transactionExtractor');
    const prompt = `Transcribe this voice message to text.\n\nVoice file path: ${inputData.voiceFilePath}\n\nUse the transcribe-voice tool to convert the audio to text. Only return the transcription.`;
    const res = await txAgent.generate(prompt, { resourceId: inputData.chatId.toString() });

    let text = res.text;
    const transcribeSchema = z.object({ text: z.string() });
    const maybe = res.toolResults?.[0]?.payload?.result as unknown;
    const parsed = maybe ? transcribeSchema.safeParse(maybe) : { success: false };
    if ((parsed as any).success) text = (parsed as any).data.text;

    return { chatId: inputData.chatId, userInfo: inputData.userInfo, text };
  },
});

const classificationSchema = z.object({ type: z.string() });

const baseRouteInput = z.object({
  text: z.string(),
  chatId: z.number(),
  userInfo: inputSchema.shape.userInfo,
});

const classifyAndRoute = createStep({
  id: 'classifyAndRoute',
  inputSchema: baseRouteInput,
  outputSchema: z.object({ responseText: z.string() }),
  execute: async ({ inputData, mastra }) => {
    const baseInput = baseRouteInput.parse(inputData);
    const { text, chatId, userInfo } = baseInput;
    if (!text || !text.trim()) {
      return {
        responseText:
          '❌ Could not transcribe the voice note. Please try again or type your message.',
      };
    }

    const classifier = mastra.getAgent('messageClassifier');
    const classificationResult = await classifier.generate(text);
    let classification: z.infer<typeof classificationSchema> = { type: 'other' };
    const maybe = classificationResult.toolResults?.[0]?.payload?.result as unknown;
    const parsed = maybe ? classificationSchema.safeParse(maybe) : { success: false };
    if ((parsed as any).success) classification = (parsed as any).data;

    if (classification.type === 'query') {
      const agent = mastra.getAgent('financeInsights');
      const result = await agent.generate(`User Question: ${text}`, {
        resourceId: chatId.toString(),
      });
      return { responseText: result.text };
    }

    if (classification.type === 'transaction') {
      const agent = mastra.getAgent('transactionExtractor');
      const result = await agent.generate(
        `${text}\n\n[User Info: Chat ID: ${chatId}, Username: @${userInfo.username || 'unknown'}, Name: ${userInfo.firstName || ''} ${userInfo.lastName || ''}]`,
        { resourceId: chatId.toString() }
      );
      return { responseText: `✅ Transaction recorded!\n\n${result.text}` };
    }

    return {
      responseText:
        `I can help you with:\n\n` +
        `💰 Logging transactions: \"Spent $50 at Target\"\n` +
        `📊 Answering questions: \"How much did I spend on groceries?\"`,
    };
  },
});

export const telegramVoiceWorkflow = createWorkflow({
  id: 'telegramVoice',
  inputSchema,
  outputSchema: z.object({ responseText: z.string() }),
})
  .then(transcribe)
  .then(classifyAndRoute)
  .commit();
