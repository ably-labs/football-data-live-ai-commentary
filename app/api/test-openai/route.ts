import { NextResponse } from 'next/server';
import { getOpenAIClient } from '@/lib/openai-commentary';

export async function GET() {
  try {
    console.log('[Test OpenAI] Starting test...');
    console.log('[Test OpenAI] Environment check - API Key exists:', !!process.env.OPEN_AI_API_KEY);
    console.log('[Test OpenAI] API Key length:', process.env.OPEN_AI_API_KEY?.length);
    
    const client = getOpenAIClient();
    console.log('[Test OpenAI] Client obtained successfully');
    
    // Try a simple completion
    console.log('[Test OpenAI] Making test API call...');
    const completion = await client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: 'You are a test assistant.' },
        { role: 'user', content: 'Say "OpenAI connection successful!"' }
      ],
      max_tokens: 20,
    });
    
    console.log('[Test OpenAI] API call successful');
    console.log('[Test OpenAI] Response:', completion.choices[0]?.message?.content);
    
    return NextResponse.json({
      success: true,
      message: completion.choices[0]?.message?.content,
      model: completion.model,
      usage: completion.usage,
    });
    
  } catch (error) {
    console.error('[Test OpenAI] Error:', error);
    console.error('[Test OpenAI] Error type:', error?.constructor?.name);
    console.error('[Test OpenAI] Error message:', (error as any)?.message);
    console.error('[Test OpenAI] Full error:', JSON.stringify(error, null, 2));
    
    // Check for OpenAI specific errors
    if ((error as any)?.response) {
      console.error('[Test OpenAI] API Response Status:', (error as any).response?.status);
      console.error('[Test OpenAI] API Response Data:', (error as any).response?.data);
    }
    
    return NextResponse.json({
      success: false,
      error: (error as any)?.message || 'Unknown error',
      errorType: error?.constructor?.name,
      errorDetails: JSON.stringify(error, null, 2),
    }, { status: 500 });
  }
}