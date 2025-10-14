
import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function listModels() {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error('Error: GOOGLE_API_KEY is not set in the .env file.');
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const models = await genAI.getGenerativeModels();
    
    console.log('Available models:');
    for (const model of models) {
        console.log(`- ${model.model}`);
    }

  } catch (error) {
    console.error('Error listing models:', error);
  }
}

listModels();
