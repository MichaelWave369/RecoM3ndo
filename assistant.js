(function (globalScope) {
  async function runAssistantTurn({
    userMessage,
    settings,
    listings,
    executeTool,
    currentFilters,
    currentResult,
    history
  }) {
    const toolNames = ["searchListings", "recommend", "getListingById", "setForm", "openListing", "buildItinerary", "showOnMap", "navigateTo", "openDeals", "saveDealSearch", "listDealSearches", "buildFreePlan", "addResourceNote", "listResourceNotes"];
    const context = globalScope.RecoTools.buildContext({ listings, query: userMessage, privacyMode: settings.privacyMode });

    const system = [
      "You are RecoM3ndo AI Companion.",
      "Only use listings from tool outputs. Do not invent listings.",
      "If needed, ask clarifying questions.",
      "If you need a tool, respond with strict JSON: {\"tool\":\"name\",\"args\":{},\"say\":\"optional\"}.",
      `Allowed tools: ${toolNames.join(", ")}.`,
      `Current filters: ${JSON.stringify(currentFilters || {})}`,
      `Current selected result: ${JSON.stringify(currentResult || null)}`,
      `Context snippets: ${JSON.stringify(context)}`
    ].join("\n");

    const messages = [{ role: "system", content: system }, ...history, { role: "user", content: userMessage }];

    let assistantText = "";
    let toolRounds = 0;

    while (toolRounds < 3) {
      let modelReply = "";
      try {
        modelReply = await globalScope.RecoLLM.callProvider(settings, messages);
      } catch (_error) {
        const fallbackCall = globalScope.RecoTools.localRulesAssistant({ message: userMessage, listings });
        if (!fallbackCall) {
          return { text: "I could not reach the model. Please try again or refine your request.", toolRuns: [] };
        }
        const fallbackResult = await executeTool(fallbackCall.tool, fallbackCall.args);
        return {
          text: `${fallbackCall.say || "Using local tool-only mode."}\n\n${JSON.stringify(fallbackResult, null, 2)}`,
          toolRuns: [{ call: fallbackCall, result: fallbackResult }]
        };
      }

      const maybeCall = globalScope.RecoTools.parseToolCall(modelReply);
      if (!maybeCall) {
        assistantText = modelReply || "I do not have more to add right now.";
        break;
      }

      const toolResult = await executeTool(maybeCall.tool, maybeCall.args);
      messages.push({ role: "assistant", content: maybeCall.say || JSON.stringify(maybeCall) });
      messages.push({ role: "tool", name: maybeCall.tool, content: JSON.stringify({ tool_result: toolResult }) });
      toolRounds += 1;

      if (toolRounds >= 3) {
        assistantText = `${maybeCall.say || "Executed tools."}\n\n${JSON.stringify(toolResult, null, 2)}`;
      }
    }

    return { text: assistantText || "Done.", toolRuns: [] };
  }

  const api = { runAssistantTurn };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.RecoAssistant = api;
})(typeof window !== "undefined" ? window : globalThis);
