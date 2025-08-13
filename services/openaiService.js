import OpenAI from "openai";
import { config } from "../config/environment.js";
import { logger } from "../utils/logger.js";

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.api.openai.apiKey,
    });
  }

  async generateText(prompt, res) {
    try {
      const stream = await this.openai.chat.completions.create({
        model: "gpt-5-chat-latest",
        messages: [
          {
            role: "system",
            content:
              "You are an academic narrative synthesis agent with expertise in climate, indigenous, natural, water, and social history. Your task is to produce a concise (<210 words), narrative that integrates based on the instructions you are given.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2048,
        top_p: 0.7,
        frequency_penalty: 0.32,
        presence_penalty: 0.51,
        stream: true,
      });

      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      });

      for await (const chunk of stream) {
        res.write(chunk.choices[0]?.delta?.content || "");
      }
      
      res.end();
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        logger.error("OpenAI API Error:");
        logger.error("Request ID:", error.request_id);
        logger.error("Status:", error.status);
        logger.error("Name:", error.name);
        logger.error("Headers:", JSON.stringify(error.headers));
      } else {
        logger.error("Unknown error calling OpenAI API:", error);
      }
      
      if (!res.headersSent) {
        res.status(500).send("Failed to generate text");
      } else {
        res.end();
      }
    }
  }
}

export const openaiService = new OpenAIService();

