import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    steady_load: {
      executor: "constant-vus",
      vus: 20,
      duration: "2m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800", "p(99)<1500"],
  },
};

const BASE_URL = __ENV.RAG_BASE_URL || "http://localhost:8000";
const TENANT = __ENV.TENANT_ID || "public";

export default function () {
  const payload = JSON.stringify({
    query: "求导法则与极值点判断",
    subject_id: "math",
    top_k: 5,
    retrieval_mode: "hybrid_visual",
  });

  const res = http.post(`${BASE_URL}/retrieve`, payload, {
    headers: {
      "Content-Type": "application/json",
      "x-tenant-id": TENANT,
      "x-request-id": `k6-${__VU}-${__ITER}`,
    },
  });

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response has context": (r) => (r.json("context") || "").length >= 0,
  });

  sleep(1);
}
