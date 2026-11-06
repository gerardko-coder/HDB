// Builds carparks.json (carpark code, name, lat/lng and details) from HDB's Carpark Information dataset.
// Usage (Node 18+):  node build-carparks.mjs   ->  writes carparks.json next to this script.
// Put carparks.json next to index.html. Re-run occasionally; carpark locations rarely change.
import { writeFileSync } from "node:fs";

const URL_BASE = "https://data.gov.sg/api/action/datastore_search?resource_id=139a3035-e624-4f56-b63f-89ae28d4ae4c";
const titleCase = (s) => String(s || "").toLowerCase().replace(/(^|[\s/(-])([a-z])/g, (m, p, c) => p + c.toUpperCase());

function svy21ToLatLng(E, N) {
  const a = 6378137, f = 1 / 298.257223563, oLat = 1.366666 * Math.PI / 180, oLon = 103.833333, oN = 38744.572, oE = 28001.642, k = 1;
  const b = a * (1 - f), e2 = 2 * f - f * f, e4 = e2 * e2, e6 = e4 * e2;
  const A0 = 1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256, A2 = 3 / 8 * (e2 + e4 / 4 + 15 * e6 / 128), A4 = 15 / 256 * (e4 + 3 * e6 / 4), A6 = 35 * e6 / 3072;
  const Mo = a * (A0 * oLat - A2 * Math.sin(2 * oLat) + A4 * Math.sin(4 * oLat) - A6 * Math.sin(6 * oLat));
  const Mp = Mo + (N - oN) / k;
  const n = (a - b) / (a + b), n2 = n * n, n3 = n2 * n, n4 = n2 * n2;
  const G = a * (1 - n) * (1 - n2) * (1 + 9 * n2 / 4 + 225 * n4 / 64) * Math.PI / 180;
  const sg = Mp * Math.PI / (180 * G);
  const lp = sg + (3 * n / 2 - 27 * n3 / 32) * Math.sin(2 * sg) + (21 * n2 / 16 - 55 * n4 / 32) * Math.sin(4 * sg) + 151 * n3 / 96 * Math.sin(6 * sg) + 1097 * n4 / 512 * Math.sin(8 * sg);
  const s2 = Math.sin(lp) ** 2, rho = a * (1 - e2) / Math.pow(1 - e2 * s2, 1.5), v = a / Math.sqrt(1 - e2 * s2);
  const ps = v / rho, ps2 = ps * ps, ps3 = ps2 * ps, ps4 = ps2 * ps2, t = Math.tan(lp), t2 = t * t, t4 = t2 * t2, t6 = t4 * t2;
  const Ep = E - oE, x = Ep / (k * v), x3 = x ** 3, x5 = x ** 5, x7 = x ** 7, lf = t / (k * rho);
  const lat = lp - lf * (Ep * x / 2)
    + lf * (Ep * x3 / 24) * (-4 * ps2 + 9 * ps * (1 - t2) + 12 * t2)
    - lf * (Ep * x5 / 720) * (8 * ps4 * (11 - 24 * t2) - 12 * ps3 * (21 - 71 * t2) + 15 * ps2 * (15 - 98 * t2 + 15 * t4) + 180 * ps * (5 * t2 - 3 * t4) + 360 * t4)
    + lf * (Ep * x7 / 40320) * (1385 + 3633 * t2 + 4095 * t4 + 1575 * t6);
  const sec = 1 / Math.cos(lat);
  const lon = oLon * Math.PI / 180 + x * sec - x3 * sec / 6 * (ps + 2 * t2)
    + x5 * sec / 120 * (-4 * ps3 * (1 - 6 * t2) + ps2 * (9 - 68 * t2) + 72 * ps * t2 + 24 * t4)
    - x7 * sec / 5040 * (61 + 662 * t2 + 1320 * t4 + 720 * t6);
  return [lat * 180 / Math.PI, lon * 180 / Math.PI];
}

const out = [];
let offset = 0, total = Infinity;
while (offset < total) {
  const res = await fetch(`${URL_BASE}&limit=1000&offset=${offset}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  total = json.result.total;
  const recs = json.result.records;
  for (const r of recs) {
    const E = Number(r.x_coord), N = Number(r.y_coord);
    if (!r.car_park_no || !E || !N) continue;
    const [lat, lng] = svy21ToLatLng(E, N);
    out.push({
      code: r.car_park_no.trim().toUpperCase(), name: titleCase(r.address),
      lat: +lat.toFixed(5), lng: +lng.toFixed(5),
      info: {
        car_park_type: r.car_park_type, type_of_parking_system: r.type_of_parking_system,
        short_term_parking: r.short_term_parking, free_parking: r.free_parking, night_parking: r.night_parking,
        car_park_decks: r.car_park_decks, gantry_height: r.gantry_height, car_park_basement: r.car_park_basement,
      },
    });
  }
  offset += recs.length;
  if (!recs.length) break;
}
writeFileSync("carparks.json", JSON.stringify(out));
console.log(`Wrote ${out.length} carparks to carparks.json`);
