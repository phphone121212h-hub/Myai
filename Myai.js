import { CreateMLCEngine } from "https://esm.run/@mlc-ai/web-llm";

const statusEl = document.getElementById('status');
const progressEl = document.getElementById('progress');
const micBtn = document.getElementById('micBtn');
const logEl = document.getElementById('log');

// 1. Initialize WebLLM with a Quantized Mobile-Friendly Model
const selectedModel = "Phi-3.5-mini-instruct-q4f16_1-MLC"; 
let engine;

async function initAI() {
  try {
    // Hardware Check
    if (!navigator.gpu) throw new Error("WebGPU not supported on this browser. Fallback required.");

    // Quota Check: Ensure device has enough storage for model weights
    const estimate = await navigator.storage.estimate();
    const availableGB = (estimate.quota - estimate.usage) / (1024 ** 3);
    if (availableGB < 2) throw new Error("Insufficient storage for local model.");

    // Create Engine with automatic IndexedDB caching
    engine = await CreateMLCEngine(selectedModel, {
      initProgressCallback: (info) => {
        statusEl.innerText = `Loading: ${info.text}`;
        progressEl.value = Math.round((info.loaded / info.total) * 100) || 0;
      }
    });

    statusEl.innerText = "Status: AI Ready (100% Local)";
    progressEl.style.display = "none";
    micBtn.disabled = false;
  } catch (error) {
    statusEl.innerText = `Error: ${error.message}`;
    // Execute fallback logic here
  }
}

// 2. The Hands: Map JSON to Web APIs
async function executeDeviceAction(jsonString) {
  try {
    const command = JSON.parse(jsonString);
    log(`Executing Action: ${command.action}`);

    switch(command.action) {
      case "share":
        if (navigator.share) {
          await navigator.share({ title: 'AI Assistant', text: command.payload });
        }
        break;
      
      case "notify":
        if (Notification.permission === "granted") {
          new Notification("AI Assistant", { body: command.payload });
        } else {
          await Notification.requestPermission();
        }
        break;

      case "get_contact":
        if ('contacts' in navigator) {
          const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false });
          log(`Found contact: ${JSON.stringify(contacts)}`);
        }
        break;

      default:
        log(`Unknown intent.`);
    }
  } catch (e) {
    log(`Failed to parse AI output as JSON.`);
  }
}

// 3. The Inference Loop
async function processCommand(userText) {
  log(`User: "${userText}"`);
  
  const systemPrompt = `You are a mobile OS assistant. Map the user's command to JSON. 
  Valid actions: "share", "notify", "get_contact". 
  Output ONLY valid JSON. Example: {"action": "share", "payload": "Message text"}`;

  log("AI: Processing on GPU...");
  
  // Force structured JSON output
  const reply = await engine.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userText }
    ],
    response_format: { type: "json_object" }
  });

  const output = reply.choices[0].message.content;
  log(`AI Output: \n${output}`);
  
  executeDeviceAction(output);
}

// 4. Web Speech API Trigger
micBtn.addEventListener('click', () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return log("Speech API unsupported.");
  
  const recognition = new SpeechRecognition();
  recognition.onstart = () => log("Listening...");
  recognition.onresult = (event) => processCommand(event.results[0][0].transcript);
  recognition.start();
});

function log(msg) { logEl.innerText += `\n${msg}\n---`; }

initAI();
