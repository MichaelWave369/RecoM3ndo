(function (globalScope) {
  async function callOllama({ model }, messages) {
    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model || "llama3.1", messages, stream: false })
    });
    if (!response.ok) throw new Error(`Ollama error ${response.status}`);
    const data = await response.json();
    return data?.message?.content || "";
  }

  async function callOpenAICompatible({ baseUrl, model, apiKey }, messages) {
    if (!baseUrl || !model || !apiKey) {
      throw new Error("OpenAI-compatible settings are incomplete.");
    }
    const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages })
    });
    if (!response.ok) throw new Error(`OpenAI-compatible error ${response.status}`);
    const data = await response.json();
    return data?.choices?.[0]?.message?.content || "";
  }

  async function callProvider(settings, messages) {
    if (settings.provider === "openai") {
      return callOpenAICompatible(settings, messages);
    }
    return callOllama(settings, messages);
  }

  const api = { callProvider, callOllama, callOpenAICompatible };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.RecoLLM = api;
})(typeof window !== "undefined" ? window : globalThis);
