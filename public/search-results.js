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
            const rateLimitData = {
              limit: response.headers.get("x-ratelimit-limit-requests"),
              remaining: response.headers.get("x-ratelimit-remaining-requests"),
              reset: response.headers.get("x-ratelimit-reset-requests"),
            };
            throw new Error("Rate limit exceeded", { cause: rateLimitData });
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // ... (rest of the search logic remains the same)
      } catch (e) {
        console.error("Search error:", e);
        if (e.cause && e.cause.reset) {
          this.setRateLimitError(e.cause);
        } else {
          this.setError(`Search failed: ${e.message}`);
        }
      } finally {
        this.setLoading(false);
      }
    } else {
      // ... (existing code for cached results)
    }
  }

  setRateLimitError(rateLimitData) {
    const resetTime = parseInt(rateLimitData.reset, 10);
    const countdownDate = new Date(Date.now() + resetTime * 1000);

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
        <p class="countdown">Time until reset: <span id="countdown"></span></p>
        <table class="pricing-table">
          <tr>
            <th>Plan</th>
            <th>Requests / 6h</th>
            <th>Price</th>
          </tr>
          <tr>
            <td>Free (current)</td>
            <td>${rateLimitData.limit}</td>
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
      alert("You've been added to the waiting list!");
    });

    getInTouchBtn.addEventListener("click", (e) => {
      e.preventDefault();
      alert("Our team will contact you soon!");
    });

    earlyAccessBtn.addEventListener("click", (e) => {
      e.preventDefault();
      this.handleEarlyAccess();
    });
  }

  async handleEarlyAccess() {
    try {
      const response = await fetch(
        "https://api.stripe.com/v1/checkout/sessions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: "Bearer YOUR_STRIPE_SECRET_KEY",
          },
          body: new URLSearchParams({
            "payment_method_types[]": "card",
            "line_items[0][price_data][currency]": "eur",
            "line_items[0][price_data][unit_amount]": 2000,
            "line_items[0][price_data][product_data][name]":
              "Early Access Program",
            "line_items[0][quantity]": 1,
            mode: "payment",
            success_url: "https://yourwebsite.com/success",
            cancel_url: "https://yourwebsite.com/cancel",
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to create Stripe session");
      }

      const session = await response.json();

      // Redirect to Stripe Checkout
      window.location.href = session.url;
    } catch (error) {
      console.error("Error creating Stripe session:", error);
      alert("You'll be added to the early access program soon.");
    }
  }

  // ... (rest of the class methods remain the same)
}

customElements.define("search-results", SearchResults);
