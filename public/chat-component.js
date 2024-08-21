class ChatComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  static get observedAttributes() {
    return ["openapiUrl", "threadId", "model"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this[name] = newValue;
      this.render();
      if (name === "threadId") {
        this.loadExistingMessages();
      }
    }
  }

  connectedCallback() {
    this.openapiUrl = this.getAttribute("openapiUrl");
    this.threadId = this.getAttribute("threadId");
    this.model = this.getAttribute("model");

    this.render();
    this.setupEventListeners();
    this.loadExistingMessages();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: Arial, sans-serif;
          min-height: 100%;
        }
        .container {
          position: relative;
          height: 100%;
          min-height: 100%;
          display: flex;
          flex-direction: column;
        }
        .top-gradient {
          position: absolute;
          top: 0;
          height: 64px;
          left: 0;
          right: 0;
          background: linear-gradient(to bottom, #a0aec0, white);
          filter: blur(24px);
        }
        #chat-container {
          flex-grow: 1;
          width: 100%;
          padding-top: 64px;
          padding-left: 16px;
          padding-right: 16px;
          margin-bottom: 16px;
          overflow-y: auto;
        }
        .input-container {
          display: flex;
          width: 100%;
          padding: 16px;
        }
        #user-input {
          flex-grow: 1;
          appearance: none;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          padding: 8px 12px;
          color: #4a5568;
          line-height: 1.25;
        }
        #user-input:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.5);
        }
        #send-button {
          margin-left: 8px;
          background-color: #4299e1;
          color: white;
          font-weight: bold;
          padding: 8px 16px;
          border-radius: 4px;
          border: none;
          cursor: pointer;
        }
        #send-button:hover {
          background-color: #2b6cb0;
        }
        .message {
          margin-bottom: 8px;
        }
        .message-user {
          text-align: right;
        }
        .message-assistant {
          text-align: left;
        }
        .message-content {
          display: inline-block;
          border-radius: 4px;
          padding: 4px 8px;
          max-width: 800px;
        }
        .message-user .message-content {
          background-color: #bee3f8;
        }
        .message-assistant .message-content {
          background-color: #e2e8f0;
        }
      </style>
      <div class="container">
        <div class="top-gradient"></div>
        <div id="chat-container"></div>
        <div class="input-container">
          <input id="user-input" type="text" placeholder="Type your message...">
          <button id="send-button"><i class="fas fa-paper-plane"></i></button>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    const sendButton = this.shadowRoot.getElementById("send-button");
    const userInput = this.shadowRoot.getElementById("user-input");

    sendButton.addEventListener("click", () => this.sendMessage());
    userInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.sendMessage();
      }
    });
  }

  loadExistingMessages() {
    const threads = JSON.parse(localStorage.getItem("threads") || "{}");
    const messages = (threads[this.threadId] || {}).messages || [];
    const chatContainer = this.shadowRoot.getElementById("chat-container");
    chatContainer.innerHTML = ""; // Clear existing messages
    messages.forEach((msg) => this.addMessageToChat(msg.role, msg.message));
  }

  addMessageToChat(role, content) {
    const chatContainer = this.shadowRoot.getElementById("chat-container");
    const messageDiv = document.createElement("div");
    messageDiv.className = `message message-${role}`;
    messageDiv.innerHTML = `
      <span class="message-content">
        <strong>${role}:</strong> <span class="message-text">${marked.parse(
      content,
    )}</span>
      </span>
    `;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  async sendMessage() {
    const userInput = this.shadowRoot.getElementById("user-input");
    const message = userInput.value.trim();

    if (message) {
      this.addMessageToChat("user", message);

      const threads = JSON.parse(localStorage.getItem("threads") || "{}");
      if (!threads[this.threadId]) {
        threads[this.threadId] = { messages: [] };
      }
      threads[this.threadId].messages.push({ role: "user", message: message });
      localStorage.setItem("threads", JSON.stringify(threads));

      userInput.value = "";

      await this.fetchAssistantResponse();
    }
  }

  async fetchAssistantResponse() {
    const openapiUrl = this.getAttribute("openapiUrl");
    if (!openapiUrl) {
      alert("No openapi");
      return;
    }
    const threads = JSON.parse(localStorage.getItem("threads") || "{}");
    const response = await fetch(
      `https://chat.actionschema.com/${
        this.model
      }/chat/completions?openapiUrl=${encodeURIComponent(openapiUrl)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: threads[this.threadId].messages.map((msg) => ({
            role: msg.role,
            content: msg.message,
          })),
          stream: true,
        }),
      },
    );

    if (response.status !== 200) {
      alert(`${response.status}: ${await response.text()}`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantReply = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0].delta.content;
            if (content) {
              assistantReply += content;
              this.updateAssistantMessage(assistantReply);
            }
          } catch (e) {
            console.error("Error parsing SSE:", e);
          }
        }
      }
    }

    threads[this.threadId].messages.push({
      role: "assistant",
      message: assistantReply,
    });
    localStorage.setItem("threads", JSON.stringify(threads));
  }

  updateAssistantMessage(content) {
    const chatContainer = this.shadowRoot.getElementById("chat-container");
    let assistantMessage = chatContainer.querySelector(".current-message");

    if (!assistantMessage) {
      assistantMessage = document.createElement("div");
      assistantMessage.className = "message message-assistant current-message";
      assistantMessage.innerHTML = `
                  <span class="message-content">
                      <strong>assistant:</strong> <span class="message-text"></span>
                  </span>
              `;
      chatContainer.appendChild(assistantMessage);
    }

    const messageContent = assistantMessage.querySelector(".message-text");
    messageContent.innerHTML = marked.parse(content);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

customElements.define("chat-component", ChatComponent);