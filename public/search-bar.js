const onlyUnique = (isEqualFn) => (value, index, self) => {
  return (
    self.findIndex((v) => (isEqualFn ? isEqualFn(v, value) : v === value)) ===
    index
  );
};

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
    this.baseUrl = `https://stt.actionschema.com`;
  }

  static get observedAttributes() {
    return ["placeholder", "value"];
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "placeholder" && oldValue !== newValue) {
      const input = this.shadowRoot.querySelector("input");
      input.setAttribute("placeholder", newValue);
    }

    if (name === "value") {
      const input = this.shadowRoot.querySelector("input");
      input.setAttribute("value", newValue);
      this.handleSearch(newValue);
    }
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
          max-width: 280px;
          font-family: Arial, sans-serif;
        }
        .search-container {
          position: relative;
          width: 100%;
        }
        input {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 10px 10px 10px;
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
          right: 10px;
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
          width: 400px;
          background: #ffffffdd;
          border: 1px solid #ddd;
          border-radius: 0 0 20px 20px;
          max-height: 300px;
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
        <input type="text" placeholder="Search 5829+ Tools">
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

    input.focus();

    // refetch ""
    this.fetchSuggestions("", true);

    input.addEventListener("focus", () => this.showSuggestions());
    input.addEventListener("click", () => this.showSuggestions());
    input.addEventListener("input", () => this.showSuggestions());
    input.addEventListener("keypress", async (e) => {
      if (e.key === "Enter") {
        this.handleSearch(input.value);
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

  async showSuggestions() {
    const input = this.shadowRoot.querySelector("input");
    const suggestionsContainer = this.shadowRoot.querySelector(".suggestions");
    const query = input.value.trim();

    let suggestions = [];
    const recentSearches = JSON.parse(localStorage.getItem("recent") || "[]")
      .filter((q) => q.toLowerCase().startsWith(query || ""))
      .map((q) => ({ query: q, type: "recent" }));

    const apiSuggestions = (await this.fetchSuggestions(query)).map((q) => ({
      type: "global",
      query: q,
    }));

    if (query.length === 0) {
      suggestions = [...recentSearches.slice(0, 5), ...apiSuggestions]
        .filter(
          onlyUnique((a, b) => a.query.toLowerCase() === b.query.toLowerCase()),
        )
        .slice(0, 12);
    } else {
      // max 3 recent, the rest api matches and popular
      suggestions = [...recentSearches.slice(0, 3), ...apiSuggestions]
        .filter(
          onlyUnique((a, b) => a.query.toLowerCase() === b.query.toLowerCase()),
        )
        .slice(0, 12);
    }

    this.renderSuggestions(suggestions, query);
    suggestionsContainer.style.display =
      suggestions.length > 0 ? "block" : "none";
  }

  async fetchSuggestions(query, force) {
    const defaultSuggestions = JSON.parse(
      localStorage.getItem("defaultSuggestions") || "[]",
    );

    if (query === "" && defaultSuggestions.length && !force) {
      return defaultSuggestions;
    }

    try {
      const response = await fetch(
        `https://search.actionschema.com/suggest?q=${encodeURIComponent(
          query,
        )}`,
      );

      if (!response.ok) throw new Error("Network response was not ok");
      const json = await response.json();

      if (query === "") {
        // save for prefetch
        localStorage.setItem("defaultSuggestions", JSON.stringify(json));
      }

      return json;
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      return [];
    }
  }

  renderSuggestions(suggestions, query) {
    const suggestionsContainer = this.shadowRoot.querySelector(".suggestions");
    suggestionsContainer.innerHTML = suggestions
      .map((suggestion) => {
        const isMatch = suggestion.query
          .toLowerCase()
          .startsWith(query.toLowerCase());

        const style =
          suggestion.type === "recent" ? "color:purple;" : isMatch ? "" : "";
        const icon =
          !isMatch && suggestion.type !== "recent"
            ? '<i style="padding-right:4px; color: gold; font-size: 8pt;" class="fa-regular fa-star"></i>'
            : "";
        return `<div style="${style}" class="suggestion-item">${icon}${suggestion.query}</div>`;
      })
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
