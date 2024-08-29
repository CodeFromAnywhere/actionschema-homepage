class SearchBar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.startTime = null;
    this.timerInterval = null;
    this.isRecording = false;
    this.mimeType = null;
    this.baseUrl = `https://search.actionschema.com`;
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  render() {
    // width: 100%;

    this.shadowRoot.innerHTML = `
      <style>
        @import "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css";
        :host {
          z-index: 1000;
          display: block;
          width: 100%;
          position: relative;
          max-width: 300px;
          font-family: Arial, sans-serif;
        }
        .search-container {
          position: relative;
          width: 100%;
        }
        input {
          width: 100%;
          padding: 10px 0px 10px 10px;
          font-size: 16px;
          border: 2px solid #4CAF50;
          border-radius: 5px;
          outline: none;
        }
        input:focus {
          box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
        }
        .mic-button {
          position: absolute;
          right: 0px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
          color: #4CAF50;
        }
        #timer {
          position: absolute;
          right: 40px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 14px;
          color: #4CAF50;
          display: none;
        }
        .suggestions {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: #ffffffCC;
          border: 1px solid #ddd;
          border-radius: 0 0 20px 20px;
          max-height: 200px;
          overflow-y: auto;
          display: none;
        }
        .suggestion-item {
          padding: 10px;
          cursor: pointer;
        }
        .suggestion-item:hover {
          background-color: #f0f0f0;
        }
      </style>
      <div class="search-container">
        <input type="text" placeholder="Search...">
        <button class="mic-button"><i class="fas fa-microphone"></i></button>
        <span id="timer">00:00</span>
        <div class="suggestions"></div>
      </div>
    `;
  }

  setupEventListeners() {
    const input = this.shadowRoot.querySelector("input");
    const suggestionsContainer = this.shadowRoot.querySelector(".suggestions");
    const micButton = this.shadowRoot.querySelector(".mic-button");
    const timer = this.shadowRoot.querySelector("#timer");

    input.addEventListener("focus", () => this.showSuggestions());
    input.addEventListener("input", () => this.showSuggestions());
    input.addEventListener("keypress", async (e) => {
      if (e.key === "Enter") {
        this.handleSearch(input.value);
      }

      if (this.isQuerySearchableValidator(input.value)) {
        // Do prefetch search
        const q = encodeURIComponent(input.value + e.key).toLowerCase();
        const localStorageKey = `search.${q}`;
        const already = localStorage.getItem(localStorageKey);
        if (!already || JSON.parse(already).createdAt < Date.now() - 86400000) {
          const result = await fetch(
            `https://search-operations.actionschema.com/search?q=${q}`,
          ).then((res) => res.json());
          localStorage.setItem(localStorageKey, JSON.stringify(result));
        }
      }
    });

    document.addEventListener("click", (e) => {
      if (!this.contains(e.target)) {
        suggestionsContainer.style.display = "none";
      }
    });

    micButton.addEventListener("click", () => {
      if (this.isRecording) {
        this.stopRecording();
      } else {
        this.startRecording();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Control" && !this.isRecording) {
        this.startRecording();
      }
    });

    document.addEventListener("keyup", (event) => {
      if (event.key === "Control" && this.isRecording) {
        this.stopRecording();
      }
    });
  }

  isQuerySearchableValidator(q) {
    return true;
  }

  async showSuggestions() {
    const input = this.shadowRoot.querySelector("input");
    const suggestionsContainer = this.shadowRoot.querySelector(".suggestions");
    const query = input.value.trim();

    let suggestions = [];
    const recentSearches = JSON.parse(localStorage.getItem("recent") || "[]");
    const apiSuggestions = await this.fetchSuggestions(query);

    if (query.length === 0) {
      suggestions = [
        ...new Set([...recentSearches.slice(0, 7), ...apiSuggestions]),
      ].slice(0, 12);
    } else {
      suggestions = [
        ...new Set([...recentSearches.slice(0, 3), ...apiSuggestions]),
      ].slice(0, 12);
    }

    this.renderSuggestions(suggestions);
    suggestionsContainer.style.display =
      suggestions.length > 0 ? "block" : "none";
  }

  async fetchSuggestions(query) {
    try {
      const response = await fetch(
        `https://search-operations.actionschema.com/suggest?q=${encodeURIComponent(
          query,
        )}`,
      );
      if (!response.ok) throw new Error("Network response was not ok");
      return await response.json();
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      return [];
    }
  }

  renderSuggestions(suggestions) {
    const suggestionsContainer = this.shadowRoot.querySelector(".suggestions");
    suggestionsContainer.innerHTML = suggestions
      .map((suggestion) => `<div class="suggestion-item">${suggestion}</div>`)
      .join("");

    suggestionsContainer
      .querySelectorAll(".suggestion-item")
      .forEach((item) => {
        item.addEventListener("click", () => {
          this.shadowRoot.querySelector("input").value = item.textContent;
          this.handleSearch(item.textContent);
        });
      });
  }

  handleSearch(query) {
    const recentSearches = JSON.parse(localStorage.getItem("recent") || "[]");
    recentSearches.unshift(query);
    localStorage.setItem(
      "recent",
      JSON.stringify([...new Set(recentSearches)].slice(0, 10)),
    );
    window.location.href = `search.html?q=${encodeURIComponent(query)}`;
  }

  startRecording() {
    const micButton = this.shadowRoot.querySelector(".mic-button");
    const timer = this.shadowRoot.querySelector("#timer");

    micButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    timer.style.display = "inline";

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        this.mediaRecorder = new MediaRecorder(stream, {
          mimeType: "audio/mp4",
        });
        this.mediaRecorder.start();
        this.isRecording = true;
        this.mimeType = this.mediaRecorder.mimeType;
        this.audioChunks = [];
        this.mediaRecorder.addEventListener("dataavailable", (event) => {
          this.audioChunks.push(event.data);
        });
        this.startTime = Date.now();
        this.updateTimer();
        this.timerInterval = setInterval(() => this.updateTimer(), 1000);
        micButton.innerHTML = '<i class="fas fa-stop"></i>';
      })
      .catch((error) => {
        console.error("Error accessing microphone:", error);
        micButton.innerHTML = '<i class="fas fa-microphone"></i>';
        timer.style.display = "none";
      });
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      const micButton = this.shadowRoot.querySelector(".mic-button");
      const timer = this.shadowRoot.querySelector("#timer");

      this.mediaRecorder.addEventListener("stop", async () => {
        micButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        const audioFile = new File(
          this.audioChunks,
          `file.${this.mimeType.split("/")[1]}`,
          { type: this.mimeType },
        );
        const transcript = await this.translateAudio(audioFile);
        const query = encodeURIComponent(transcript);
        window.location.href = `search.html?q=${query}`;
        micButton.innerHTML = '<i class="fas fa-microphone"></i>';
      });

      this.mediaRecorder.stop();
      this.isRecording = false;
      clearInterval(this.timerInterval);
      timer.style.display = "none";
      micButton.innerHTML = '<i class="fas fa-microphone"></i>';
    }
  }

  updateTimer() {
    const timer = this.shadowRoot.querySelector("#timer");
    const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    timer.textContent = `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  async translateAudio(audioFile) {
    const formData = new FormData();
    formData.append("file", audioFile);
    try {
      const response = await fetch(`${this.baseUrl}/audio/translations`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      const result = await response.json();
      if (typeof result.transcript !== "string") {
        throw new Error("Unexpected response format");
      }
      return result.transcript;
    } catch (error) {
      console.error("Error translating audio:", error);
      throw error;
    }
  }
}

customElements.define("search-bar", SearchBar);
