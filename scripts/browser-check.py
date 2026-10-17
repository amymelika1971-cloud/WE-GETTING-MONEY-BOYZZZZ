"""Browser regression checks against a running local Memescope instance.

Requires Python Playwright and Chromium. API responses are controlled fixtures;
this verifies UI behavior, not live provider availability or narrative truth.
Usage: python3 scripts/browser-check.py [http://127.0.0.1:5173]
"""
import copy
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import sync_playwright, expect


BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5173"
OUT = Path(__file__).resolve().parents[1] / "outputs" / "browser"
OUT.mkdir(parents=True, exist_ok=True)
MINTS = ["DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", "So11111111111111111111111111111111111111112", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"]
STORY = "A community archive preserves forgotten internet artwork through a public collection and weekly themed exhibitions."


def stamp(minutes=0):
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()


def post(index=0):
    return {"id": str(index), "author": "fixture-caller-" + str(index), "text": STORY,
            "postedAt": stamp(index + 1), "url": "https://pump.fun/callouts/" + MINTS[0] + "/" + str(index), "likes": None}


def pair(index, cap):
    return {"chain": "solana", "address": MINTS[index], "dex": "fixture-pool", "marketCap": cap,
            "liquidity": 12000, "price": .00002, "volume": {"m5": 4200}, "change": {"m5": -3.5},
            "txns": {"m5": {"buys": 20, "sells": 12}}, "image": None,
            "base": {"address": MINTS[index], "name": ["Archive", "Garden", "Orbit"][index], "symbol": ["ARCH", "GARD", "ORBT"][index]}}


def coin(index, cap):
    p = pair(index, cap)
    return {"address": MINTS[index], "chain": "solana", "name": p["base"]["name"], "symbol": p["base"]["symbol"],
            "image": None, "pair": p, "observedCallouts": 7, "observedCallers": 3, "thesis": post(), "newestCall": post()}


def run():
    checks = []
    state = {"coins": [coin(0, 18000), coin(1, 26000), coin(2, 80000)], "scan_cap": 240000,
             "discovery_error": False, "scan_error": False, "old": False, "history_ok": False}
    errors = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"])
        context = browser.new_context(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))

        def api(route):
            path = urlsplit(route.request.url).path
            query = parse_qs(urlsplit(route.request.url).query)
            status = 200
            if path == "/api/discover":
                if state["discovery_error"]:
                    status, data = 503, {"error": "Fixture provider unavailable"}
                else:
                    data = {"coins": copy.deepcopy(state["coins"]), "checked": 25, "partial": True,
                            "retrievedAt": stamp(3 if state["old"] else 0)}
            elif path == "/api/scan":
                address = query.get("input", [""])[0]
                if address not in MINTS or state["scan_error"]:
                    status, data = 422, {"error": "Fixture market unavailable"}
                else:
                    index = MINTS.index(address)
                    p = pair(index, state["scan_cap"])
                    data = {"address": address, "chain": "solana", "name": p["base"]["name"], "symbol": p["base"]["symbol"],
                            "pairs": [p], "selectedPair": p["address"], "retrievedAt": stamp()}
            elif path == "/api/recent-callouts":
                data = {"sources": [
                    {"id": "pump", "name": "Pump.fun", "status": "partial", "posts": [post(i) for i in range(7)],
                     "url": "https://pump.fun/", "detail": "Partial fixture feed; more matches may exist.", "retrievedAt": stamp()},
                    {"id": "x", "name": "Twitter", "status": "not-connected", "posts": [], "url": "https://x.com/search?q=fixture",
                     "detail": "Live X posts need authorized API access. Exact-contract search is available below."},
                    {"id": "fomo", "name": "FOMO", "status": "not-connected", "posts": [], "url": "https://fomo.family/",
                     "detail": "FOMO’s social feed is not connected. Copy the contract and open FOMO to check its callouts."}], "retrievedAt": stamp()}
            elif path == "/api/security":
                data = {"provider": "RugCheck", "url": "https://rugcheck.xyz/", "retrievedAt": stamp(),
                        "checks": [], "risks": [], "holders": [], "poolLocks": []}
            elif path == "/api/history":
                if state["history_ok"]:
                    closes = [10,11,12,13,14,13,12,11,12,13,14,15,16,15,14,13,14,15,16,17,18,17,16,15,16,17,17,17,16]
                    minute = int(datetime.now(timezone.utc).timestamp() // 60) * 60000
                    data = {"points": [{"time": minute - (len(closes)-i)*60000, "open": c, "high": c+.2,
                                         "low": c-.2, "close": c} for i,c in enumerate(closes)],
                            "provider": "GeckoTerminal", "retrievedAt": stamp()}
                else:
                    status, data = 422, {"error": "Not enough indexed chart data for this pool yet."}
            else:
                route.continue_()
                return
            route.fulfill(status=status, content_type="application/json", body=json.dumps(data))

        context.route("**/api/**", api)
        page.goto(BASE, wait_until="networkidle")
        expect(page.locator(".e-row")).to_have_count(2)
        expect(page.locator(".e-detail")).to_have_count(0)
        expect(page.get_by_label("Market cap range")).to_have_value("30000")
        checks.append("Default $15K–$30K list; no automatic coin selection")
        page.get_by_label("Market cap range").select_option("200000")
        expect(page.locator(".e-row")).to_have_count(3)
        page.get_by_label("Market cap range").select_option("30000")
        page.get_by_role("button", name="Track ARCH", exact=True).click()
        expect(page.locator(".e-detail")).to_have_count(0)
        page.get_by_role("button", name=re.compile(r"^Watching")).click()
        expect(page.locator(".e-row")).to_have_count(1)
        expect(page.locator(".e-cap strong")).to_have_text("$240K")
        checks.append("Star does not open details; Watching retains coin beyond $200K")
        page.reload(wait_until="networkidle")
        page.get_by_role("button", name=re.compile(r"^Watching")).click()
        expect(page.locator(".e-row")).to_have_count(1)
        checks.append("Watchlist survives reload on the same browser")
        opener = page.locator(".e-row-main").first
        opener.focus()
        page.keyboard.press("Enter")
        expect(page.locator(".e-detail")).to_be_visible()
        expect(page.locator(".e-post")).to_have_count(5)
        expect(page.locator(".e-story")).to_contain_text(STORY)
        page.locator(".e-risk summary").click()
        expect(page.locator(".e-risk-body")).to_contain_text("unknown")
        expect(page.locator(".e-risk-body")).to_contain_text("Missing evidence stays unknown")
        expect(page.locator(".e-risk summary")).to_contain_text("Risk evidence incomplete")
        expect(page.locator(".e-risk-body")).to_contain_text("Mint authority")
        checks.append("Keyboard row opens narrative, five callouts, and unknown risk evidence")
        page.get_by_role("button", name="Twitter", exact=True).click()
        expect(page.locator(".e-no-posts")).to_contain_text("authorized API access")
        page.get_by_role("button", name="FOMO", exact=True).click()
        expect(page.locator(".e-no-posts")).to_contain_text("not connected")
        checks.append("Disconnected Twitter/FOMO states remain explicit")
        page.get_by_label("Close coin details").click()
        expect(page.locator(".e-detail")).to_have_count(0)
        expect(opener).to_be_focused()
        checks.append("Closing details restores keyboard focus")
        page.get_by_role("button", name="Stop tracking ARCH", exact=True).click()
        expect(page.locator(".e-row")).to_have_count(0)
        expect(page.locator(".e-empty")).to_contain_text("Star a coin")
        checks.append("Unstar and empty Watching state")
        state["coins"] = []
        page.goto(BASE + "?token=" + MINTS[1] + "&chain=solana", wait_until="networkidle")
        expect(page.locator(".e-story")).to_contain_text(STORY)
        checks.append("Direct contract lookup obtains narrative from fetched callouts")
        expect(page.locator(".e-pullback")).to_contain_text(re.compile(r"unknown|unavailable|not enough|not confirmed", re.I))
        checks.append("Unavailable candles do not become a positive pullback signal")
        page.keyboard.press("Escape")
        expect(page.locator(".e-detail")).to_have_count(0)
        search = page.get_by_label("Coin contract address")
        search.fill("invalid-contract")
        search.press("Enter")
        expect(page.locator(".e-detail .e-error")).to_contain_text("Fixture market unavailable")
        page.keyboard.press("Escape")
        search.fill(MINTS[1])
        state["history_ok"] = True
        search.press("Enter")
        expect(page.locator(".e-story")).to_contain_text(STORY)
        expect(page.locator(".e-pullback strong")).to_have_text("Pullback in rising structure")
        expect(page.locator(".e-pullback")).to_contain_text("completed 1m candles")
        checks.append("Search submission handles invalid contracts and real-candle structure responses")
        page.keyboard.press("Escape")
        expect(search).to_be_focused()
        state["history_ok"] = False
        state["coins"] = [coin(0, 18000), coin(1, 26000), coin(2, 80000)]
        page.goto(BASE, wait_until="networkidle")
        for width in [1280, 390, 320]:
            page.set_viewport_size({"width": width, "height": 900})
            expect(page.locator(".e-row")).to_have_count(2)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Horizontal overflow at " + str(width)
            page.screenshot(path=str(OUT / (str(width) + "-list.png")), full_page=True)
            page.locator(".e-row-main").first.click()
            expect(page.locator(".e-post")).to_have_count(5)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Detail overflow at " + str(width)
            page.screenshot(path=str(OUT / (str(width) + "-detail.png")), full_page=True)
            page.get_by_label("Close coin details").click()
        checks.append("Desktop, 390px and 320px mobile layouts have no horizontal overflow")
        state["coins"] = []
        page.reload(wait_until="networkidle")
        expect(page.locator(".e-empty")).to_contain_text("No matches")
        state["discovery_error"] = True
        page.reload(wait_until="networkidle")
        expect(page.locator(".e-error")).to_contain_text("Fixture provider unavailable")
        checks.append("Empty discovery and failed provider states are distinct")
        state["discovery_error"] = False
        state["coins"] = [coin(0, 18000)]
        state["old"] = True
        page.reload(wait_until="networkidle")
        expect(page.locator(".e-source-line")).to_contain_text("Stale callout list")
        expect(page.locator(".e-cap")).to_have_class(re.compile("old"))
        checks.append("Stale data is labeled")
        state["scan_error"] = True
        page.get_by_role("button", name="Track ARCH", exact=True).click()
        page.get_by_role("button", name=re.compile(r"^Watching")).click()
        expect(page.locator(".e-error")).to_contain_text("could not refresh")
        expect(page.locator(".e-cap")).to_have_class(re.compile("old"))
        checks.append("Failed watched refresh preserves stale fallback timestamp")
        assert not errors, "Browser errors: " + repr(errors)
        browser.close()
    result = {"passed": len(checks), "checks": checks, "page_errors": errors, "data": "controlled API fixtures"}
    (OUT / "results.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    run()
