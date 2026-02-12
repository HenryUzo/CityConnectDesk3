# Ollama AI Chat - Detailed Logging & Performance Diagnostics

## Overview
Comprehensive logging has been added to both client and server to identify bottlenecks in the AI chat flow.

## What's Been Added

### 🔧 Server-Side Changes

#### 1. **server/ai/ollama.ts** - Ollama Request Timing
Logs the entire Ollama request lifecycle:
```
[OLLAMA] 🚀 Starting Ollama chat request
[OLLAMA] Model: qwen2.5:7b
[OLLAMA] Base URL: http://127.0.0.1:11434
[OLLAMA] Temperature: 0.2
[OLLAMA] Message sizes - System: 2150 chars, User: 890 chars
[OLLAMA] Total message size: 3040 chars
[OLLAMA] ⏱️ Sending request to http://127.0.0.1:11434/api/chat...
[OLLAMA] ✅ Got response from Ollama in 45230ms (status: 200)
[OLLAMA] 📦 Response parsing took 5ms
[OLLAMA] Response size: 1240 chars
[OLLAMA] ⏱️ Total Ollama request time: 45235ms
```

**Key Metrics:**
- Model being used
- Prompt sizes (System & User)
- Time to get response from Ollama
- Time to parse response
- **Total Ollama time** (this is where slowness will show up)

#### 2. **server/app-routes.ts** - Full AI Chat Endpoint Timing
Logs the entire `/api/ai/chat` endpoint flow:
```
[AI CHAT] 🏃 New AI chat request received
[AI CHAT] Request size: 1850 chars
[AI CHAT] User: user-123-abc
[AI CHAT] ✅ Request parsed in 2ms
[AI CHAT] 🗄️ Database queries completed in 42ms
[AI CHAT] 📋 Prompt details:
[AI CHAT]   - System prompt size: 2150 chars
[AI CHAT]   - User prompt size: 890 chars
[AI CHAT]   - Total prompt size: 3040 chars
[AI CHAT]   - History items: 6
[AI CHAT]   - Category: Electrician
[AI CHAT] 🤖 Using provider: ollama | Model: qwen2.5:7b
[AI CHAT] ⏳ Waiting for Ollama response...
[AI CHAT] ✅ Ollama response received in 45235ms (1240 chars)
[AI CHAT] 📦 JSON parsing took 3ms
[AI CHAT] 🎉 Request completed in 45282ms
[AI CHAT] ⏱️ Breakdown: DB=42ms, AI Provider=45235ms, Total=45282ms
```

**Key Metrics:**
- Request parsing time
- Database query time
- System/User prompt sizes
- **Time waiting for AI provider** (Ollama/Gemini/OpenAI)
- JSON parsing time
- Full breakdown showing where time is spent

### 🌐 Client-Side Changes

#### **client/src/lib/citybuddy-gemini.ts** - Browser Request Timing
Logs from the browser side:
```
[CLIENT] 🚀 Sending AI chat request for category: Electrician
[CLIENT] 📦 Request payload size: 1850 chars
[CLIENT] 📝 History items: 6
[CLIENT] ⏱️ Response received from server in 45320ms
[CLIENT] ✅ AI response processed successfully in 45350ms
[CLIENT] Intent: clarify, Confidence: 0.85
```

**Key Metrics:**
- Time from browser to server response
- Request payload size
- Number of history items sent
- Final response processing time

## How to Diagnose Using the Logs

### 📊 Open Browser Console
1. Open DevTools (F12)
2. Go to **Console** tab
3. Filter for `[CLIENT]` to see browser-side logs

### 📊 Check Server Logs
In your terminal where `npm run dev` is running, look for:
- `[OLLAMA]` logs for Ollama-specific timing
- `[AI CHAT]` logs for full endpoint timing

## Performance Interpretation Guide

### Normal Performance (Gemini/OpenAI)
```
[AI CHAT] Request completed in 2500ms
[AI CHAT] Breakdown: DB=42ms, AI Provider=2400ms, Total=2500ms
```
- Should be **< 5 seconds** for most requests

### Slow Ollama (qwen2.5:7b)
```
[AI CHAT] Request completed in 45282ms
[AI CHAT] Breakdown: DB=42ms, AI Provider=45235ms, Total=45282ms
```
- **45+ seconds** = Model is too slow or not loaded in GPU memory
- Most time in **AI Provider** (Ollama request)

### Database Issues
```
[AI CHAT] 🗄️ Database queries completed in 3420ms
```
- If DB time is **> 1000ms**, there's a database bottleneck

### Timeout Issues
```
[OLLAMA] ❌ Request timeout after 300000ms
```
- Request took longer than **5 minutes** (300 seconds)
- Definitely need a faster model

## Recommended Next Steps

### Option 1: Switch to Faster Model (Recommended)
Use a smaller, faster model that's optimized for speed:

```powershell
# Pull a faster model in Ollama
ollama pull mistral:7b
# or
ollama pull neural-chat
# or even smaller:
ollama pull phi


# Update .env.local
OLLAMA_MODEL=mistral:7b
```

Then restart your server: `npm run dev`

### Option 2: Enable GPU Acceleration
If you have NVIDIA GPU:
```env
OLLAMA_NUM_GPU=1
```

### Option 3: Monitor Resource Usage
While the AI chat is running, check:
- **Windows Task Manager** → Performance tab
- CPU usage should be **40-100%**
- RAM usage (how much is available)
- GPU usage (if applicable)

## Example: Reading the Logs

**Scenario: Slow Response (45+ seconds)**
```
[OLLAMA] 🚀 Starting Ollama chat request
[OLLAMA] Model: qwen2.5:7b          ← Large model
[OLLAMA] Message sizes - System: 2150 chars, User: 890 chars
[OLLAMA] ⏱️ Sending request...
[OLLAMA] ✅ Got response from Ollama in 45230ms    ← Takes 45 seconds!
[OLLAMA] ⏱️ Total Ollama request time: 45235ms
```
**Diagnosis:** Model is too slow. Switch to `mistral:7b` or `phi`.

**Scenario: Database Slow**
```
[AI CHAT] 🗄️ Database queries completed in 5420ms    ← Takes 5+ seconds!
```
**Diagnosis:** Database query optimization needed.

## Environment Variables for Debugging

Add these to `.env.local` for more detailed logging:
```env
# Ollama config
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:7b

# Debug mode (increases logging)
DEBUG=*
LOG_LEVEL=debug
```

## Testing the Speed

### Quick Speed Test
```powershell
# From terminal, test Ollama directly
curl -s -X POST http://127.0.0.1:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5:7b",
    "prompt": "What is the capital of France?",
    "stream": false
  }' | measure-object -Property (measure)
```

This shows bare Ollama response time (without any CityConnect overhead).

## Summary

- **Server Logs:** See where the 45+ seconds are being spent
- **Client Logs:** See end-to-end time from browser perspective
- **Model Size:** `qwen2.5:7b` is likely too slow—switch to `mistral` or `phi`
- **Each log line has a timestamp prefix** → Track exact duration of each step

Monitor these logs while testing the chat and report:
1. Total time (should be < 5-10 seconds)
2. Where most time is spent (DB vs AI Provider)
3. Model being used
