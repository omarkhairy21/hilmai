import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const inputSchema = z.object({
  text: z.string(),
  chatId: z.number(),
  userInfo: z.object({
    username: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  }),
});

const classificationSchema = z.object({
  type: z.string(),
  confidence: z.string().optional(),
  reason: z.string().optional(),
});

const classify = createStep({
  id: 'classify',
  inputSchema,
  outputSchema: z.object({
    text: z.string(),
    chatId: z.number(),
    userInfo: inputSchema.shape.userInfo,
    classification: classificationSchema,
  }),
  execute: async ({ inputData, mastra }) => {
    const classifier = mastra.getAgent('messageClassifier');
    const result = await classifier.generate(inputData.text);

    let classification: z.infer<typeof classificationSchema> = { type: 'other' };
    const maybe = result.toolResults?.[0]?.payload?.result as unknown;
    const parsed = maybe ? classificationSchema.safeParse(maybe) : { success: false };
    if ((parsed as any).success) classification = (parsed as any).data;

    return {
      text: inputData.text,
      chatId: inputData.chatId,
      userInfo: inputData.userInfo,
      classification,
    };
  },
});

const routeInputSchema = z.object({
  text: z.string(),
  chatId: z.number(),
  userInfo: inputSchema.shape.userInfo,
  classification: classificationSchema,
});

const route = createStep({
  id: 'route',
  inputSchema: routeInputSchema,
  outputSchema: z.object({ responseText: z.string() }),
  execute: async ({ inputData, mastra }) => {
    const { text, chatId, userInfo, classification } = routeInputSchema.parse(inputData);

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
        `💰 Logging transactions: "Spent $50 at Target"\n` +
        `📊 Answering questions: "How much did I spend on groceries?"\n` +
        `📷 Receipts and 🎤 voice are supported too!`,
    };
  },
});

export const telegramRoutingWorkflow = createWorkflow({
  id: 'telegramRouting',
  inputSchema,
  outputSchema: z.object({ responseText: z.string() }),
})
  .then(classify)
  .then(route)
  .commit();
