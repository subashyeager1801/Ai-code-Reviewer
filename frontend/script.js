const API_URL = "/analyze";

const codeInput = document.getElementById("codeInput");
const codeHighlight = document.getElementById("codeHighlight");
const languageSelect = document.getElementById("language");
const analyzeBtn = document.getElementById("analyzeBtn");
const statusText = document.getElementById("status");

const lists = {
  bug: document.getElementById("bugList"),
  improvement: document.getElementById("improvementList"),
  security: document.getElementById("securityList"),
  performance: document.getElementById("performanceList"),
  style: document.getElementById("styleList"),
};

const languagePatterns = {
  Python: /\b(def|class|import|from|return|if|elif|else|for|while|try|except|with|as|lambda|None|True|False)\b/g,
  JavaScript: /\b(function|const|let|var|return|if|else|for|while|class|new|async|await|try|catch|true|false|null|undefined)\b/g,
  TypeScript: /\b(function|const|let|var|return|if|else|for|while|class|interface|type|implements|extends|public|private|readonly|async|await|true|false|null|undefined)\b/g,
  Java: /\b(public|private|protected|class|interface|static|void|int|long|double|boolean|new|return|if|else|for|while|try|catch|null|true|false)\b/g,
  "C++": /\b(int|float|double|char|bool|void|auto|class|struct|namespace|using|return|if|else|for|while|try|catch|true|false|nullptr)\b/g,
  "C#": /\b(public|private|protected|class|interface|static|void|string|int|decimal|bool|var|new|return|if|else|for|while|try|catch|null|true|false|async|await)\b/g,
  PHP: /\b(function|class|public|private|protected|echo|return|if|else|foreach|while|try|catch|null|true|false)\b/g,
  Go: /\b(package|import|func|var|const|type|struct|interface|return|if|else|for|range|go|defer|nil|true|false)\b/g,
  SQL: /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|GROUP|ORDER|BY|LIMIT|CREATE|ALTER|DROP|TABLE|INDEX|VALUES|SET|AND|OR|NOT|NULL)\b/g,
  HTML: /(&lt;\/?[\w-]+|&gt;|&lt;!--|--&gt;)/g,
  CSS: /\b(display|position|grid|flex|block|none|color|background|border|padding|margin|font|width|height|min|max|media|hover|focus)\b/g,
};

function setStatus(message) {
  statusText.textContent = message;
}

function normalizeItems(items) {
  return Array.isArray(items) ? items.filter(Boolean) : [];
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getHighlightLanguage() {
  const selected = languageSelect.value;
  if (selected === "HTML/CSS") {
    return codeInput.value.trim().startsWith("<") ? "HTML" : "CSS";
  }
  return selected || detectLanguage(codeInput.value);
}

function detectLanguage(code) {
  if (/\binterface\s+\w+|\btype\s+\w+\s*=|:\s*(string|number|boolean)\b/.test(code)) return "TypeScript";
  if (/\b(def|import|from|print)\b|__name__/.test(code)) return "Python";
  if (/\b(function|const|let|var|console\.log|=>)\b/.test(code)) return "JavaScript";
  if (/\b(public\s+class|System\.out\.println|static\s+void\s+main)\b/i.test(code)) return "Java";
  if (/\busing\s+System\b|\bnamespace\s+\w+|\bConsole\.WriteLine\b/.test(code)) return "C#";
  if (/#include\s*<|std::|cout\s*<</.test(code)) return "C++";
  if (/\b(SELECT|INSERT|UPDATE|DELETE|FROM)\b/i.test(code)) return "SQL";
  if (/<\?php|\becho\s+['"]/.test(code)) return "PHP";
  if (/\bfunc\s+\w+\(|\bpackage\s+main\b|\bfmt\.Print/.test(code)) return "Go";
  if (/^\s*[\w.-]+\s*:\s*[^;{}]+;/m.test(code)) return "CSS";
  if (/<[a-z][\s\S]*>/i.test(code)) return "HTML";
  return "Unknown";
}

function highlightCode(code, language) {
  let html = escapeHtml(code);
  const pattern = languagePatterns[language];
  const protectedTokens = [];

  function tokenKey(index) {
    let key = "";
    let value = index;
    do {
      key = String.fromCharCode(65 + (value % 26)) + key;
      value = Math.floor(value / 26) - 1;
    } while (value >= 0);
    return `@@TOK${key}@@`;
  }

  function protect(className) {
    return (match) => {
      const index = protectedTokens.length;
      protectedTokens.push(`<span class="token ${className}">${match}</span>`);
      return tokenKey(index);
    };
  }

  html = html.replace(/(\/\/.*|#.*|\/\*[\s\S]*?\*\/|&lt;!--[\s\S]*?--&gt;)/g, protect("comment"));
  html = html.replace(/("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|`[^`\\]*(?:\\.[^`\\]*)*`)/g, protect("string"));
  html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="token number">$1</span>');

  if (pattern) {
    html = html.replace(pattern, '<span class="token keyword">$1</span>');
  }

  protectedTokens.forEach((token, index) => {
    html = html.replace(tokenKey(index), token);
  });

  return html || " ";
}

function renderCodeHighlight() {
  codeHighlight.innerHTML = highlightCode(codeInput.value, getHighlightLanguage());
}

function syncHighlightScroll() {
  codeHighlight.scrollTop = codeInput.scrollTop;
  codeHighlight.scrollLeft = codeInput.scrollLeft;
}

function renderFindingText(li, item) {
  const parts = String(item).split(/(`[^`]+`)/g);
  parts.forEach((part) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      const code = document.createElement("code");
      code.innerHTML = highlightCode(part.slice(1, -1), getHighlightLanguage());
      li.appendChild(code);
      return;
    }
    li.appendChild(document.createTextNode(part));
  });
}

function renderList(type, items) {
  const list = lists[type];
  list.innerHTML = "";

  const safeItems = normalizeItems(items);
  if (safeItems.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No issues found.";
    list.appendChild(empty);
    return;
  }

  safeItems.forEach((item) => {
    const li = document.createElement("li");
    renderFindingText(li, item);
    list.appendChild(li);
  });
}

function renderResults(data) {
  renderList("bug", data.bug);
  renderList("improvement", data.improvement);
  renderList("security", data.security);
  renderList("performance", data.performance);
  renderList("style", data.style);
}

async function analyzeCode() {
  const code = codeInput.value.trim();
  const language = languageSelect.value;

  if (!code) {
    setStatus("Paste code first.");
    codeInput.focus();
    return;
  }

  analyzeBtn.disabled = true;
  setStatus("Analyzing...");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code, language: language || undefined }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Analysis failed.");
    }

    renderResults(data);
    setStatus(`Analysis complete. Detected: ${data.language || language || "Unknown"}.`);
  } catch (error) {
    renderResults({ bug: [], improvement: [], security: [], performance: [], style: [] });
    setStatus(error.message || "Could not analyze code.");
  } finally {
    analyzeBtn.disabled = false;
  }
}

analyzeBtn.addEventListener("click", analyzeCode);

codeInput.addEventListener("input", renderCodeHighlight);
codeInput.addEventListener("scroll", syncHighlightScroll);
languageSelect.addEventListener("change", renderCodeHighlight);

codeInput.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    analyzeCode();
  }
});

renderCodeHighlight();
