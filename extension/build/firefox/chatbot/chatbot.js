// chatbot/chatbot.js
console.log("🔥 Chatbot loaded");

let jobDescription = "";
let resumeData = null;
let chatHistory = [];

// Load context when page opens
(async () => {
  // Get job description from URL params or storage
  const urlParams = new URLSearchParams(window.location.search);
  const jobDescParam = urlParams.get('jobDescription');
  
  if (jobDescParam) {
    try {
      jobDescription = decodeURIComponent(jobDescParam);
    } catch (e) {
      // If decoding fails, use the raw param or fall back to storage
      console.warn("Failed to decode job description from URL:", e);
      jobDescription = jobDescParam;
    }
  }
  
  // Always try to get from storage if URL param failed or was empty
  if (!jobDescription || jobDescription.length < 50) {
    const result = await chrome.storage.local.get(['lastJobDescription']);
    if (result.lastJobDescription) {
      jobDescription = result.lastJobDescription;
    }
  }
  
  // Get resume data
  const resumeResult = await chrome.storage.local.get(['uploadedResume']);
  if (resumeResult.uploadedResume) {
    resumeData = resumeResult.uploadedResume;
  } else {
    // Load default resume
    try {
      const url = chrome.runtime.getURL("data/resume.json");
      const response = await fetch(url);
      resumeData = await response.json();
    } catch (e) {
      console.error("Failed to load resume:", e);
    }
  }
  
  // Show context info
  if (jobDescription || resumeData) {
    const contextInfo = document.getElementById('contextInfo');
    const contextText = document.getElementById('contextText');
    let contextParts = [];
    if (jobDescription) {
      contextParts.push(`Job description (${jobDescription.length} chars)`);
    }
    if (resumeData) {
      contextParts.push(`Resume for ${resumeData.name || 'candidate'}`);
    }
    contextText.textContent = contextParts.join(', ');
    contextInfo.style.display = 'block';
  }
})();

// Auto-resize textarea
const messageInput = document.getElementById('messageInput');
messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
});

// Send message on Enter (Shift+Enter for new line)
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Suggestion chips
document.querySelectorAll('.suggestion-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const question = chip.getAttribute('data-question');
    messageInput.value = question;
    sendMessage();
  });
});

// Send button
document.getElementById('sendButton').addEventListener('click', sendMessage);

async function sendMessage() {
  const input = messageInput;
  const message = input.value.trim();
  
  if (!message) return;
  
  // Add user message to chat
  addMessage('user', message);
  input.value = '';
  input.style.height = 'auto';
  
  // Show loading
  const loadingId = addLoadingMessage();
  
  // Get API key
  const apiKeyResult = await chrome.storage.sync.get(['openaiApiKey']);
  const apiKey = apiKeyResult.openaiApiKey;
  
  if (!apiKey) {
    removeLoadingMessage(loadingId);
    addMessage('assistant', 'Error: OpenAI API key not set. Please configure it in extension settings.');
    return;
  }
  
  // Add to chat history
  chatHistory.push({ role: 'user', content: message });
  
  try {
    // Get backend URL (should match background.js)
    const backendUrl = "http://localhost:3000"; // Update this to match your hosted backend
    
    const response = await fetch(`${backendUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OpenAI-API-Key': apiKey
      },
      body: JSON.stringify({
        message: message,
        jobDescription: jobDescription,
        resume: resumeData,
        chatHistory: chatHistory.slice(-10) // Last 10 messages for context
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    const assistantMessage = data.response || data.message || 'Sorry, I could not generate a response.';
    
    removeLoadingMessage(loadingId);
    addMessage('assistant', assistantMessage);
    
    // Add to chat history
    chatHistory.push({ role: 'assistant', content: assistantMessage });
    
  } catch (error) {
    console.error('Chat error:', error);
    removeLoadingMessage(loadingId);
    addMessage('assistant', `Error: ${error.message}. Make sure the backend server is running.`);
  }
}

function addMessage(role, content) {
  const messages = document.getElementById('messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;
  
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = role === 'user' ? 'You' : 'AI';
  
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  messageContent.textContent = content;

  messageDiv.appendChild(avatar);
  messageDiv.appendChild(messageContent);
  messages.appendChild(messageDiv);
  
  // Scroll to bottom
  messages.scrollTop = messages.scrollHeight;
  
  return messageDiv;
}

function addLoadingMessage() {
  const messages = document.getElementById('messages');
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message assistant';
  loadingDiv.id = 'loading-message';
  
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = 'AI';
  
  const loadingContent = document.createElement('div');
  loadingContent.className = 'loading';
  loadingContent.innerHTML = `
    <div class="loading-dot"></div>
    <div class="loading-dot"></div>
    <div class="loading-dot"></div>
  `;
  
  loadingDiv.appendChild(avatar);
  loadingDiv.appendChild(loadingContent);
  messages.appendChild(loadingDiv);
  
  messages.scrollTop = messages.scrollHeight;
  
  return 'loading-message';
}

function removeLoadingMessage(id) {
  const loading = document.getElementById(id);
  if (loading) {
    loading.remove();
  }
}

