class SearchResults extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._searchResults = null;
    this._latestResult = null;
    this._buffer = "";
    this._countdownInterval = null;
  }

  static get observedAttributes() {
    return ["q"];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "q" && oldValue !== newValue) {
      this.performSearch(newValue);
    }
  }

  async performSearch(query) {
    const baseUrl = `https://search.actionschema.com`;
    const q = encodeURIComponent(query).toLowerCase();
    const storageKey = `search.${q}`;
    const already = localStorage.getItem(storageKey);

    if (!already || JSON.parse(already).createdAt < Date.now() - 86400000) {
      this.setLoading(true);

      try {
        const response = await fetch(`${baseUrl}/search/providers?q=${q}`);
        if (!response.ok) {
          if (response.status === 429) {
            response.headers.forEach((value, key) => {
              console.log({ key, value });
            });
            const rateLimitData = {
              status: 429,
              limit: response.headers.get("x-ratelimit-limit-requests"),
              remaining: response.headers.get("x-ratelimit-remaining-requests"),
              reset: response.headers.get("x-ratelimit-reset-requests"),
            };

            console.log("its happening! ", rateLimitData, response.headers);

            throw new Error("Rate limit exceeded", {
              cause: rateLimitData,
            });
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          this._buffer += decoder.decode(value, { stream: true });
          this.processBuffer();
        }

        // Process any remaining data in the buffer
        this._buffer += decoder.decode();
        this.processBuffer();

        if (this._latestResult) {
          this.setLoading(false);
          localStorage.setItem(storageKey, JSON.stringify(this._latestResult));
          this._searchResults = this._latestResult;
          this.renderResults(this._latestResult, query);
          this.dispatchEvent(
            new CustomEvent("searchCompleted", { detail: this._latestResult }),
          );
        } else {
          throw new Error("No valid search results received");
        }
      } catch (e) {
        console.error("Search error:", e);
        if (e.cause?.status === 429) {
          this.setRateLimitError(e.cause);
        } else {
          this.setError(`Search failed: ${e.message}`);
        }
      } finally {
        this.setLoading(false);
      }
    } else {
      const result = JSON.parse(already);
      this._searchResults = result;
      this.renderResults(result, query);
      this.dispatchEvent(
        new CustomEvent("searchCompleted", { detail: result }),
      );
    }
  }

  processBuffer() {
    const lines = this._buffer.split("\n").filter((x) => x.trim() !== "");
    this._buffer = lines.pop(); // Keep the last incomplete line in the buffer

    for (const line of lines) {
      if (line.trim() === "[DONE]") {
        continue;
      }

      try {
        const result = JSON.parse(line.replace("data: ", ""));
        console.log(result);
        if (result.status === "done") {
          this._latestResult = result;
        }
        this.updateLoadingIndicator(result);
      } catch (e) {
        console.error("Error parsing JSON:", e, "Line:", line);
      }
    }
  }

  setLoading(loading) {
    if (loading) {
      this.shadowRoot.innerHTML = `
        <style>
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 200px;
          }
          .loading-spinner {
            width: 50px;
            height: 50px;
            border: 5px solid #f3f3f3;
            border-top: 5px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .loading-text {
            margin-top: 20px;
            font-size: 18px;
            color: #333;
          }
          #loading-details {
            margin-top: 10px;
            font-size: 14px;
            color: #666;
          }
        </style>
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <div class="loading-text">Finding Your Actions</div>
          <div id="loading-details"></div>
        </div>
      `;
    } else {
      const loadingElement =
        this.shadowRoot.querySelector(".loading-container");
      if (loadingElement) {
        loadingElement.remove();
      }
    }
  }

  updateLoadingIndicator(result) {
    const loadingDetails = this.shadowRoot.querySelector("#loading-details");
    if (loadingDetails) {
      loadingDetails.textContent = `Processed ${
        result.processed || 0
      } operations`;
    }
  }

  setError(error) {
    this.shadowRoot.innerHTML = `
      <style>
        .error-message {
          color: #721c24;
          background-color: #f8d7da;
          border: 1px solid #f5c6cb;
          border-radius: 0.25rem;
          padding: 1rem;
          margin-bottom: 1rem;
        }
      </style>
      <div class="error-message">
        ⚠️ ${error}
      </div>
    `;
  }

  setRateLimitError(rateLimitData) {
    const resetTime = parseInt(rateLimitData.reset, 10);
    const countdownDate = new Date(Date.now() + resetTime * 1000);
    //        <p class="countdown">Time until reset: <span id="countdown"></span></p>

    console.log({ rateLimitData });
    const html = `
      <style>
        .error-container {
          font-family: Arial, sans-serif;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8f9fa;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .error-title {
          color: #dc3545;
          font-size: 24px;
          margin-bottom: 20px;
        }
        .countdown {
          font-size: 18px;
          margin-bottom: 20px;
        }
        .pricing-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        .pricing-table th, .pricing-table td {
          border: 1px solid #dee2e6;
          padding: 10px;
          text-align: left;
        }
        .pricing-table th {
          background-color: #e9ecef;
        }
        .button {
          display: inline-block;
          padding: 10px 20px;
          margin: 5px;
          background-color: #007bff;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          transition: background-color 0.3s;
        }
        .button:hover {
          background-color: #0056b3;
        }
      </style>
      <div class="error-container">
        <h2 class="error-title">Rate Limit Exceeded</h2>
        <p>You've reached the maximum number of requests. Please try again later.</p>
        <table class="pricing-table">
          <tr>
            <th>Plan</th>
            <th>Requests / 6h</th>
            <th>Price</th>
          </tr>
          <tr>
            <td>Free (current)</td>
            <td>25</td>
            <td>€0</td>
          </tr>
          <tr>
            <td>Developer</td>
            <td>1,000</td>
            <td>€10/month</td>
          </tr>
          <tr>
            <td>Enterprise</td>
            <td>Custom</td>
            <td>Contact us</td>
          </tr>
        </table>
        <a href="#" class="button" id="waitingListBtn">Join Waiting List</a>
        <a href="#" class="button" id="getInTouchBtn">Get in Touch</a>
        <a href="#" class="button" id="earlyAccessBtn">Get Early Access</a>
      </div>
    `;

    this.shadowRoot.innerHTML = html;

    this.startCountdown(countdownDate);
    this.setupButtons();
  }

  startCountdown(countdownDate) {
    const countdownElement = this.shadowRoot.getElementById("countdown");

    this._countdownInterval = setInterval(() => {
      const now = new Date().getTime();
      const distance = countdownDate - now;

      const hours = Math.floor(
        (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      countdownElement.textContent = `${hours}h ${minutes}m ${seconds}s`;

      if (distance < 0) {
        clearInterval(this._countdownInterval);
        countdownElement.textContent = "You can now make new requests!";
      }
    }, 1000);
  }

  setupButtons() {
    const waitingListBtn = this.shadowRoot.getElementById("waitingListBtn");
    const getInTouchBtn = this.shadowRoot.getElementById("getInTouchBtn");
    const earlyAccessBtn = this.shadowRoot.getElementById("earlyAccessBtn");

    waitingListBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href =
        "https://docs.google.com/forms/d/10V-SOE4ec0WVUIZm9AAepzs9JhL2cpWutqJdB32zaBE/edit";
    });

    getInTouchBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "https://cal.com/karsens";
    });

    earlyAccessBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "https://buy.stripe.com/4gw4j43LF8695mqcdy";
    });
  }

  renderResults(data, query) {
    const beta = localStorage.getItem("beta") === "true";
    const operations = data.operations || [];

    const html = `
      <style>
        .operations-list {
          list-style-type: none;
          padding: 0;
          margin: 0;
        }
        .operation-item {
          background-color: white;
          border-radius: 0.25rem;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          margin-bottom: 1rem;
          padding: 1rem;
          transition: box-shadow 0.2s;
        }
        .operation-item:hover {
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .operation-header {
          margin-bottom: 0.5rem;
        }
        .operation-title {
          margin: 0;
          font-size: 1.2rem;
          color: #2c3e50;
        }
        .operation-id {
          font-size: 0.9rem;
          color: #7f8c8d;
          margin: 0.25rem 0;
        }
        .operation-summary {
          margin: 0.5rem 0;
          color: #34495e;
        }
        .operation-links {
          margin-top: 0.5rem;
        }
        .operation-link {
          display: inline-block;
          margin-right: 0.5rem;
          padding: 0.25rem 0.5rem;
          background-color: #3498db;
          color: white;
          text-decoration: none;
          border-radius: 0.25rem;
          font-size: 0.9rem;
        }
        .operation-link:hover {
          background-color: #2980b9;
        }
      </style>
      <div style="padding:20px;">
        <h2>Operations</h2>
        ${
          operations.length > 0
            ? `
          <ul class="operations-list">
            ${operations
              .map((op) => this.renderOperation(op, beta, query))
              .join("")}
          </ul>
        `
            : `
          <p>No operations found.</p>
        `
        }
      </div>
    `;

    this.shadowRoot.innerHTML = html;
  }

  renderOperation(op, beta, query) {
    const {
      providerSlug,
      operationId,
      summary,
      referenceUrl,
      prunedOpenapiUrl,
      providerUrl,
      loginUrl,
      buildUrl,
    } = op;

    const chatPrompt = `Definition: ${prunedOpenapiUrl}#/operations/${operationId}
    
User requirements: 

${query}`;

    return `
      <li class="operation-item">
        <div class="operation-header">
          <a href="${providerUrl}" target="_blank"><h3 class="operation-title">${providerSlug}</h3></a>
        </div>
        <p class="operation-id">${operationId}</p>
        <p class="operation-summary">${summary || "No summary available"}</p>
        <div class="operation-links">
          
        
        <a href="search.html?tab=chat&openapiUrl=https://openapi-code-agent.vercel.app/openapi.json&input=${encodeURIComponent(
          chatPrompt,
        )}" target="_blank" class="operation-link">Write Code</a>

        <a href="search.html?tab=chat&openapiUrl=${encodeURIComponent(
          prunedOpenapiUrl,
        )}#/operations/${operationId}" target="_blank" class="operation-link">Chat</a>

          <a href="search.html?tab=reference&openapiUrl=${encodeURIComponent(
            prunedOpenapiUrl,
          )}#/operations/${operationId}" target="_blank" class="operation-link">Reference</a>
          <a href="${prunedOpenapiUrl}" target="_blank" class="operation-link">Source</a>
          ${
            beta
              ? `
              <a href="${loginUrl}" class="operation-link">Login</a>
              <a href="${buildUrl}" target="_blank" class="operation-link">Build</a>
              <a href="${prunedOpenapiUrl}" target="_blank" class="operation-link">Definition</a>
            `
              : ``
          }
        </div>
      </li>
    `;
  }

  render() {
    const query = this.getAttribute("q");
    if (query) {
      this.performSearch(query);
    } else {
      this.shadowRoot.innerHTML =
        '<div style="margin-left:20px;margin-right:20px;"><p>No search query provided.</p></div>';
    }
  }

  getSearchResults() {
    return this._searchResults;
  }
}

customElements.define("search-results", SearchResults);
