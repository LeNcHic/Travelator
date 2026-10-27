import test from "node:test";
import assert from "node:assert/strict";
import { createFlyaiSearch, flyaiArgs, normalizeFlyai, safeFlyaiUrl, validateFlyaiQuery, readCliJson } from "./flyai.ts";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FlyaiQuery } from "../shared/flyai.ts";

const now = new Date("2026-10-25T12:00:00Z");
const hotel: FlyaiQuery = { kind: "hotel", city: "sha", checkIn: "2026-11-02", checkOut: "2026-11-04" };
const train: FlyaiQuery = { kind: "train", from: "sha", to: "bei", date: "2026-11-04" };
const url = "https://router.feizhu.com/multi/webview?url=https%3A%2F%2Frouter.feizhu.com%2Fws%2F1cwEQd";
// Reduced samples from the live, keyless check on 2026-10-25.
const hotels = { status: 0, data: { itemList: [{ shId: "50219441", name: "上海鸿运来旅馆", address: "上海浦东新区惠南镇城南路612号", price: "¥2x", detailUrl: url }] } };
const trains = { status: 0, data: { itemList: [{ price: "5xx", jumpUrl: url, totalDuration: "264", journeys: [{ segments: [{
  marketingTransportNo: "G32", depCityName: "上海", arrCityName: "北京", depStationName: "上海虹桥站", arrStationName: "北京南站", depDateTime: "2026-11-04 19:25:00", arrDateTime: "2026-11-04 23:49:00", seatClassName: "二等座",
}] }] }] } };

test("CLI output survives immediate exit even above the pipe buffer size", async () => {
  const dir = await mkdtemp(join(tmpdir(), "travelator-cli-test-"));
  try {
    const file = join(dir, "fixture.cjs");
    await writeFile(file, 'console.log(JSON.stringify({text:"上海".repeat(50000)}));process.exit(0);');
    const result = await readCliJson(file, [], {}) as { text: string };
    assert.equal(result.text, "上海".repeat(50000));
    await writeFile(file, 'console.log("invalid json");process.exit(0);');
    await assert.rejects(readCliJson(file, [], {}), { code: "FLYAI_UNAVAILABLE" });
    await writeFile(file, 'console.error("MCP HTTP 451: Abnormal access behavior detected by risk control; private diagnostic");process.exit(1);');
    await assert.rejects(readCliJson(file, [], {}), error => {
      assert.equal((error as { code: string }).code, "FLYAI_ACCESS_RESTRICTED");
      assert.ok(!(error as Error).message.includes("private diagnostic")); return true;
    });
    await writeFile(file, 'console.error("MCP HTTP 429: private diagnostic");process.exit(1);');
    await assert.rejects(readCliJson(file, [], {}), { code: "FLYAI_RATE_LIMIT" });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("FlyAI validates dates in China, routes, ranges and copies only supported fields", () => {
  assert.deepEqual(validateFlyaiQuery({ ...hotel, apiKey: "ignored" }, now), hotel);
  assert.deepEqual(validateFlyaiQuery(train, now), train);
  for (const bad of [null, { ...hotel, city: "__proto__" }, { ...hotel, city: "--help" }, { ...hotel, checkIn: "2026-02-30" }, { ...hotel, checkOut: "2026-11-01" }, { ...hotel, checkOut: "2026-12-20" }, { ...train, to: "sha" }, { ...train, date: "2026-11-09" }, { ...train, date: "2026-10-24" }]) {
    assert.throws(() => validateFlyaiQuery(bad, now), { status: 400 });
  }
  assert.throws(() => validateFlyaiQuery({ ...train, date: "2026-10-25" }, new Date("2026-10-25T17:00:00Z")), { status: 400 });
  assert.ok(flyaiArgs(hotel).includes("上海"));
  assert.ok(flyaiArgs(hotel).includes("distance_asc"));
  assert.ok(flyaiArgs(hotel).includes("人民广场"));
  assert.deepEqual(flyaiArgs(train).slice(0, 5), ["search-train", "--origin", "上海", "--destination", "北京"]);
});

test("masked prices remain text and can never act as a budget quote", () => {
  const hotelResult = normalizeFlyai(hotels, hotel, now);
  const trainResult = normalizeFlyai(trains, train, now);
  assert.equal(hotelResult.offers[0].priceLabel, "¥2x");
  assert.equal(trainResult.offers[0].priceLabel, "5xx");
  assert.equal(trainResult.offers[0].minutes, 264);
  assert.equal(trainResult.offers[0].departure, "2026-11-04 19:25:00");
  assert.equal(hotelResult.limited, true);
  assert.equal("total" in hotelResult.offers[0], false);
  assert.equal(hotelResult.offers[0].hotelQuote, undefined);
  assert.equal("price" in trainResult.offers[0], false);
  assert.equal(trainResult.offers[0].trainQuote, undefined);
  assert.equal("systemMessage" in hotelResult, false);
});

test("personal key reaches the runner only, and unmasked prices change the public status", async () => {
  const secret = "unit-test-private-key";
  const fullPrices = { status: 0, data: { itemList: [{ ...hotels.data.itemList[0], price: "¥428" }] } };
  const search = createFlyaiSearch(async (args, apiKey) => {
    assert.equal(apiKey, secret);
    assert.ok(args.includes("上海"));
    assert.ok(!args.includes(secret));
    return fullPrices;
  }, () => now, secret);
  const result = await search(hotel);
  assert.equal(result.access, "personal_key");
  assert.equal(result.limited, false);
  assert.equal(result.offers[0].priceLabel, "¥428");
  assert.equal(result.offers[0].hotelQuote?.nightly, 428);
  assert.equal(result.offers[0].hotelQuote?.checkIn, hotel.checkIn);
  assert.equal(result.offers[0].hotelQuote?.checkOut, hotel.checkOut);
  assert.equal(result.offers[0].hotelQuote?.priceBasis, "nightly_search_estimate");
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.equal(normalizeFlyai(hotels, hotel, now, true).limited, true);
  assert.equal(normalizeFlyai(fullPrices, hotel, now).access, "trial");
  assert.equal(normalizeFlyai(fullPrices, hotel, now).offers[0].hotelQuote, undefined);
});

test("invalid hotel prices do not generate estimates even with a personal key", () => {
  for (const price of ["¥0", "¥2x", "-10", "¥5.999", "USD 428", "¥1000001"]) {
    const data = { status: 0, data: { itemList: [{ ...hotels.data.itemList[0], price }] } };
    assert.equal(normalizeFlyai(data, hotel, now, true).offers[0].hotelQuote, undefined);
  }
});

test("hotel coordinates distinguish the planned base from a distant administrative suburb", () => {
  const item = { ...hotels.data.itemList[0], price: "¥100" };
  const result = normalizeFlyai({ status: 0, data: { itemList: [
    { ...item, latitude: "31.2222", longitude: "121.4581" },
    { ...item, latitude: "31.033159", longitude: "121.140371" },
    { ...item, latitude: "", longitude: "" },
  ] } }, hotel, now, true);
  assert.equal(result.offers[0].hotelQuote?.distanceKm, 0);
  assert.ok(result.offers[1].hotelQuote!.distanceKm! > 25);
  assert.equal(result.offers[2].hotelQuote?.distanceKm, undefined);
});

test("personal-key train prices become date-bound passenger estimates only with complete data", () => {
  const full = { ...trains, data: { itemList: [{ ...trains.data.itemList[0], price: "598.00" }] } };
  const result = normalizeFlyai(full, train, now, true);
  assert.equal(result.offers[0].trainQuote?.amount, 598);
  assert.equal(result.offers[0].trainQuote?.seatClass, "二等座");
  assert.equal(result.offers[0].trainQuote?.fromStation, "上海虹桥站");
  assert.equal(result.offers[0].trainQuote?.departure, "2026-11-04 19:25:00");
  assert.equal(result.offers[0].trainQuote?.priceBasis, "passenger_search_estimate");
  assert.equal(normalizeFlyai(full, train, now).offers[0].trainQuote, undefined);
  for (const price of ["0", "5xx", "-20", "USD 598"]) {
    assert.equal(normalizeFlyai({ ...full, data: { itemList: [{ ...full.data.itemList[0], price }] } }, train, now, true).offers[0].trainQuote, undefined);
  }
  const missingClass = structuredClone(full);
  missingClass.data.itemList[0].journeys[0].segments[0].seatClassName = "";
  assert.equal(normalizeFlyai(missingClass, train, now, true).offers[0].trainQuote, undefined);
  const badTime = structuredClone(full);
  badTime.data.itemList[0].totalDuration = "123";
  assert.throws(() => normalizeFlyai(badTime, train, now, true), { status: 502 });
});

test("external links allow only known HTTPS Fliggy destinations", () => {
  assert.equal(safeFlyaiUrl(url), "https://router.feizhu.com/ws/1cwEQd");
  for (const bad of ["javascript:alert(1)", "https://router.feizhu.com.evil.test/ws/x", "http://router.feizhu.com/ws/x", "https://router.feizhu.com/multi/webview?url=https://evil.test", "https://user@router.feizhu.com/ws/x"]) assert.equal(safeFlyaiUrl(bad), null);
});

test("provider errors and malformed results are not reported as empty success", () => {
  for (const raw of [{ status: 1, message: "private provider diagnostics" }, {}, { status: 0, data: {} }, { status: 0, data: { itemList: [{}] } }]) assert.throws(() => normalizeFlyai(raw, hotel, now), { status: 502 });
  assert.deepEqual(normalizeFlyai({ status: 0, data: { itemList: [] } }, hotel, now).offers, []);
  assert.throws(() => normalizeFlyai(trains, { ...train, date: "2026-11-05" }, now), { status: 502 });
  assert.throws(() => normalizeFlyai(trains, { ...train, to: "gui" }, now), { status: 502 });
});

test("identical searches share a request; cache expires and dates stay part of the key", async () => {
  let calls = 0;
  let time = now.getTime();
  const search = createFlyaiSearch(async () => { calls++; return hotels; }, () => new Date(time));
  await Promise.all([search(hotel), search(hotel)]);
  assert.equal(calls, 1);
  await search(hotel);
  assert.equal(calls, 1);
  await search({ ...hotel, checkIn: "2026-11-03" });
  assert.equal(calls, 2);
  time += 120001;
  await search(hotel);
  assert.equal(calls, 3);
});

test("concurrency is bounded and failed requests can be retried", async () => {
  let finish!: (v: unknown) => void;
  const response = new Promise(resolve => { finish = resolve; });
  const search = createFlyaiSearch(() => response, () => now);
  const one = search(hotel), two = search({ ...hotel, checkIn: "2026-11-03" });
  await assert.rejects(search({ ...hotel, city: "bei" }), { status: 429 });
  finish(hotels); await Promise.all([one, two]);
  let count = 0;
  const retry = createFlyaiSearch(async () => { if (!count++) throw new Error("failed"); return hotels; }, () => now);
  await assert.rejects(retry(hotel));
  assert.equal((await retry(hotel)).offers.length, 1);
});
