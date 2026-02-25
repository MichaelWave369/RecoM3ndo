import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import http from "node:http";

const ROOT = process.cwd();
const report = { timestamp: new Date().toISOString(), checks: [] };

function addCheck(name, pass, detail = "") {
  report.checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} - ${name}${detail ? ` (${detail})` : ""}`);
}

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

async function runtimeChecks() {
  const server = http.createServer(async (req, res) => {
    const pathname = decodeURIComponent((req.url || "/").split("?")[0]);
    let filePath = path.join(ROOT, pathname === "/" ? "index.html" : pathname.replace(/^\//, ""));
    try {
      const stat = await fsp.stat(filePath);
      if (stat.isDirectory()) filePath = path.join(filePath, "index.html");
      const data = await fsp.readFile(filePath);
      res.writeHead(200);
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  async function fetchText(urlPath) {
    return new Promise((resolve, reject) => {
      http.get({ host: "127.0.0.1", port, path: urlPath }, (res) => {
        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString("utf8") }));
      }).on("error", reject);
    });
  }

  const indexRes = await fetchText("/index.html");
  addCheck("Runtime: /index.html returns 200", indexRes.status === 200, `status=${indexRes.status}`);

  if (fileExists("data/listings.json")) {
    const dataRes = await fetchText("/data/listings.json");
    let jsonOk = false;
    try { JSON.parse(dataRes.body); jsonOk = true; } catch { jsonOk = false; }
    addCheck("Runtime: /data/listings.json returns 200", dataRes.status === 200, `status=${dataRes.status}`);
    addCheck("Runtime: /data/listings.json valid JSON", jsonOk);
  }

  await new Promise((resolve) => server.close(resolve));
}

async function run() {
  const baselineFiles = ["index.html", "app.js", "recommender.js", "styles.css", "test.js", "README.md", "tools.js", "assistant.js", "llm.js", "map.js", "geo.js", "deals/deeplinks.js", "deals/providers/index.js", "free-finder/guide.js", "free-finder/notes.js"];
  baselineFiles.forEach((file) => addCheck(`File exists: ${file}`, fileExists(file)));

  const html = await fsp.readFile(path.join(ROOT, "index.html"), "utf8");
  const appJs = await fsp.readFile(path.join(ROOT, "app.js"), "utf8");
  const recommender = await fsp.readFile(path.join(ROOT, "recommender.js"), "utf8");
  const assistantJs = await fsp.readFile(path.join(ROOT, "assistant.js"), "utf8");
  const toolsJs = await fsp.readFile(path.join(ROOT, "tools.js"), "utf8");

  const pwaPresent = fileExists("manifest.webmanifest") || fileExists("service-worker.js");
  if (pwaPresent) {
    addCheck("PWA file exists: manifest.webmanifest", fileExists("manifest.webmanifest"));
    addCheck("PWA file exists: service-worker.js", fileExists("service-worker.js"));
    addCheck("Manifest linked in index.html", /rel=["']manifest["']/.test(html));
    addCheck("Service worker registered in app.js", /navigator\.serviceWorker\.register/.test(appJs));
  }

  addCheck("DOM hook: recommendation-form", /id=["']recommendation-form["']/.test(html));
  ["destination", "category", "budget", "style", "keyword", "max-results", "verified-only"].forEach((id) => {
    addCheck(`DOM hook id: ${id}`, new RegExp(`id=["']${id}["']`).test(html));
  });
  addCheck("DOM hook: result-summary", /id=["']result-summary["']/.test(html));
  addCheck("DOM hook: results", /id=["']results["']/.test(html));
  addCheck("Template hook: card-template", /id=["']card-template["']/.test(html));
  ["name", "score", "meta", "description", "tags"].forEach((cls) => addCheck(`Template class .${cls}`, new RegExp(`class=["'][^"']*${cls}`).test(html)));

  addCheck("Feature hook: favorites-only", /id=["']favorites-only["']/.test(html));
  addCheck("Feature hook: Copy Share Link", /copy share link/i.test(html));
  addCheck("Feature hook: Data modal trigger", /id=["']data-btn["']/.test(html));
  addCheck("Feature hook: Why this match", /Why this match\?/i.test(html));
  addCheck("Assistant UI trigger exists", /id=["']assistant-btn["']/.test(html));
  addCheck("Assistant drawer marker exists", /id=["']assistant-drawer["']/.test(html));
  addCheck("Assistant settings provider select exists", /id=["\']assistant-provider["\']/.test(html));
  addCheck("Map UI trigger exists", /id=["\']map-view-btn["\']/.test(html));
  addCheck("Map container exists", /id=["\']map["\']/.test(html));
  addCheck("Map provider toggle exists", /id=["\']map-provider["\']/.test(html));
  addCheck("Google key field exists", /id=["\']google-maps-key["\']/.test(html));
  addCheck("Leaflet assets included", /leaflet@1\.9\.4/.test(html));
  addCheck("Deals nav exists", /id=["\']deals-nav-btn["\']/.test(html));
  addCheck("Deals view exists", /id=["\']deals-view["\']/.test(html));
  addCheck("Free Finder nav exists", /id=["\']free-finder-nav-btn["\']/.test(html));
  addCheck("Free Finder view exists", /id=["\']free-finder-view["\']/.test(html));
  addCheck("Integrations registry marker exists", /integrations-registry-marker/.test(html));

  addCheck("Recommender API exposes getRecommendations", /getRecommendations/.test(recommender));
  addCheck("Recommender exported via module.exports", /module\.exports/.test(recommender));

  addCheck("app.js uses URLSearchParams", /URLSearchParams/.test(appJs));
  addCheck("app.js uses localStorage favorites", /localStorage/.test(appJs) && /favorites/.test(appJs));
  addCheck("app.js uses geolocation", /navigator\.geolocation/.test(appJs));
  addCheck("Tool protocol parser present", /parseToolCall/.test(assistantJs) || /JSON\.parse/.test(appJs));
  addCheck("Assistant tool names present", /(searchListings|recommend|getListingById|setForm|openListing|buildItinerary|openDeals|buildFreePlan)/.test(appJs + toolsJs));
  addCheck("Assistant provider wiring present", /assistant-provider/.test(html) && /assistantProvider|assistant-provider/.test(appJs));
  addCheck("Map init wiring present", /RecoMap|map-provider|refreshMapMarkers/.test(appJs));
  addCheck("Deals provider registry present", /RecoDealProviders|deals\/providers/.test(html + appJs));

  await runtimeChecks();

  const pass = report.checks.every((c) => c.pass);
  await fsp.writeFile(path.join(ROOT, "upgrade-guard-report.json"), JSON.stringify({ ...report, pass }, null, 2));
  console.log(`\nUpgrade Guard: ${pass ? "PASS" : "FAIL"}`);
  process.exit(pass ? 0 : 1);
}

run().catch(async (error) => {
  addCheck("Upgrade Guard runtime error", false, error.message);
  await fsp.writeFile(path.join(ROOT, "upgrade-guard-report.json"), JSON.stringify({ ...report, pass: false }, null, 2));
  process.exit(1);
});
