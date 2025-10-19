import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { classifyMessageTool } from '../tools/classify-message-tool.js';

export const messageClassifierAgent = new Agent({
  name: 'Message Classifier',
  instructions: `You are a message classifier for a financial assistant bot.

Use the classify-message tool to classify the user's message.

The tool will return:
- type: "transaction", "query", or "other"
- confidence: "high", "medium", or "low"
- reason: explanation for the classification

Simply call the tool with the user's message text.`,
  model: openai('gpt-4o-mini'),
  tools: {
    classifyMessage: classifyMessageTool,
  },
});
