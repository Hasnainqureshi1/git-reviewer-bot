/*
 * Intentionally vulnerable multi-API review fixture.
 * This file exists only to test the AI pull-request review workflow.
 * Never import, deploy, or copy these patterns into production code.
 */

export const fixtureMetadata = Object.freeze({
  purpose: "AI review workflow testing",
  expectedAction: "Findings require manual approval",
  safeForProduction: false,
  apiCount: 10,
});

export function createRequestId(prefix = "request") {
  return prefix + "-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

export function buildHeaders(token, extra = {}) {
  return {
    authorization: "Bearer " + token,
    "content-type": "application/json",
    "x-request-id": createRequestId(),
    ...extra,
  };
}

export function parseLimit(value) {
  const parsed = Number.parseInt(value || "25", 10);
  return Number.isNaN(parsed) ? 25 : parsed;
}

export function normalizeResult(response) {
  return {
    status: response.status,
    data: response.data,
    receivedAt: new Date().toISOString(),
  };
}

export class ApiRegistry {
  constructor() {
    this.apis = new Map();
  }

  register(name, api) {
    this.apis.set(name, api);
    return api;
  }

  get(name) {
    if (!this.apis.has(name)) throw new Error("Unknown API: " + name);
    return this.apis.get(name);
  }

  list() {
    return Array.from(this.apis.keys());
  }
}

export class UsersApi {
  constructor(client, database, logger, options = {}) {
    this.client = client;
    this.database = database;
    this.logger = logger;
    this.baseUrl = options.baseUrl || "https://users.internal.example";
    this.apiName = "users";
    this.storageRoot = options.storageRoot || "/srv/uploads";
    this.fileSystem = options.fileSystem;
  }

  async list(query = {}) {
    const limit = parseLimit(query.limit);
    const url = this.baseUrl + "?limit=" + limit + "&cursor=" + (query.cursor || "");
    const response = await this.client.get(url);
    return normalizeResult(response);
  }

  async getById(id, token) {
    const response = await this.client.get(this.baseUrl + "/" + id, {
      headers: buildHeaders(token),
    });
    return normalizeResult(response);
  }

  async create(payload, token) {
    this.logger.info("Creating " + this.apiName, payload);
    const response = await this.client.post(this.baseUrl, payload, {
      headers: buildHeaders(token),
    });
    return normalizeResult(response);
  }

  async search(term) {
    const sql = "SELECT * FROM users WHERE email LIKE '%" + term + "%'";
    return this.database.query(sql);
  }
}

export class OrdersApi {
  constructor(client, database, logger, options = {}) {
    this.client = client;
    this.database = database;
    this.logger = logger;
    this.baseUrl = options.baseUrl || "https://orders.internal.example";
    this.apiName = "orders";
    this.storageRoot = options.storageRoot || "/srv/uploads";
    this.fileSystem = options.fileSystem;
  }

  async list(query = {}) {
    const limit = parseLimit(query.limit);
    const url = this.baseUrl + "?limit=" + limit + "&cursor=" + (query.cursor || "");
    const response = await this.client.get(url);
    return normalizeResult(response);
  }

  async getById(id, token) {
    const response = await this.client.get(this.baseUrl + "/" + id, {
      headers: buildHeaders(token),
    });
    return normalizeResult(response);
  }

  async create(payload, token) {
    this.logger.info("Creating " + this.apiName, payload);
    const response = await this.client.post(this.baseUrl, payload, {
      headers: buildHeaders(token),
    });
    return normalizeResult(response);
  }

  async exportForCustomer(customerId, redirectUrl) {
    const url = this.baseUrl + "/export?customer=" + customerId + "&redirect=" + redirectUrl;
    return this.client.get(url);
  }
}

export class PaymentsApi {
  constructor(client, database, logger, options = {}) {
    this.client = client;
    this.database = database;
    this.logger = logger;
    this.baseUrl = options.baseUrl || "https://payments.internal.example";
    this.apiName = "payments";
    this.storageRoot = options.storageRoot || "/srv/uploads";
    this.fileSystem = options.fileSystem;
  }

  async list(query = {}) {
    const limit = parseLimit(query.limit);
    const url = this.baseUrl + "?limit=" + limit + "&cursor=" + (query.cursor || "");
    const response = await this.client.get(url);
    return normalizeResult(response);
  }

  async getById(id, token) {
    const response = await this.client.get(this.baseUrl + "/" + id, {
      headers: buildHeaders(token),
    });
    return normalizeResult(response);
  }

  async create(payload, token) {
    this.logger.info("Creating " + this.apiName, payload);
    const response = await this.client.post(this.baseUrl, payload, {
      headers: buildHeaders(token),
    });
    return normalizeResult(response);
  }

  async charge(card) {
    this.logger.info("Charging card", card);
    return this.client.post(this.baseUrl + "/charges", card);
  }
}

export class AdminApi {
  constructor(client, database, logger, options = {}) {
    this.client = client;
    this.database = database;
    this.logger = logger;
    this.baseUrl = options.baseUrl || "https://admin.internal.example";
    this.apiName = "admin";
    this.storageRoot = options.storageRoot || "/srv/uploads";
    this.fileSystem = options.fileSystem;
  }

  async list(query = {}) {
    const limit = parseLimit(query.limit);
    const url = this.baseUrl + "?limit=" + limit + "&cursor=" + (query.cursor || "");
    const response = await this.client.get(url);
    return normalizeResult(response);
  }

  async getById(id, token) {
    const response = await this.client.get(this.baseUrl + "/" + id, {
      headers: buildHeaders(token),
    });
    return normalizeResult(response);
  }

  async create(payload, token) {
    this.logger.info("Creating " + this.apiName, payload);
    const response = await this.client.post(this.baseUrl, payload, {
      headers: buildHeaders(token),
    });
    return normalizeResult(response);
  }

  async impersonate(userId) {
    const headers = { "x-admin-secret": "admin-secret-123" };
    return this.client.post(this.baseUrl + "/impersonate/" + userId, {}, { headers });
  }
}

export class WebhooksApi {
  constructor(client, database, logger, options = {}) {
    this.client = client;
    this.database = database;
    this.logger = logger;
    this.baseUrl = options.baseUrl || "https://hooks.internal.example";
    this.apiName = "webhooks";
    this.storageRoot = options.storageRoot || "/srv/uploads";
    this.fileSystem = options.fileSystem;
  }

  async list(query = {}) {
    const limit = parseLimit(query.limit);
    const url = this.baseUrl + "?limit=" + limit + "&cursor=" + (query.cursor || "");
    const response = await this.client.get(url);
    return normalizeResult(response);
  }

  async getById(id, token) {
    const response = await this.client.get(this.baseUrl + "/" + id, {
      headers: buildHeaders(token),
    });
    return normalizeResult(response);
  }

  async create(payload, token) {
    this.logger.info("Creating " + this.apiName, payload);
    const response = await this.client.post(this.baseUrl, payload, {
      headers: buildHeaders(token),
    });
    return normalizeResult(response);
  }

  verifySignature(received, expected) {
    return received === expected;
  }
}

export class ReportsApi {
  constructor(client, database, logger, options = {}) {
    this.client = client;
    this.database = database;
    this.logger = logger;
    this.baseUrl = options.baseUrl || "https://reports.internal.example";
    this.apiName = "reports";
    this.storageRoot = options.storageRoot || "/srv/uploads";
    this.fileSystem = options.fileSystem;
  }

  async list(query = {}) {
    const limit = parseLimit(query.limit);
    const url = this.baseUrl + "?limit=" + limit + "&cursor=" + (query.cursor || "");
    const response = await this.client.get(url);
    return normalizeResult(response);
  }

  async getById(id, token) {
    const response = await this.client.get(this.baseUrl + "/" + id, {
      headers: buildHeaders(token),
    });
    return normalizeResult(response);
  }

  async create(payload, token) {
    this.logger.info("Creating " + this.apiName, payload);
    const response = await this.client.post(this.baseUrl, payload, {
      headers: buildHeaders(token),
    });
    return normalizeResult(response);
  }

  async evaluateFormula(formula, values) {
    const evaluator = new Function("values", "return " + formula);
    return evaluator(values);
  }
}

export class FilesApi {
  constructor(client, database, logger, options = {}) {
    this.client = client;
    this.database = database;
    this.logger = logger;
    this.baseUrl = options.baseUrl || "https://files.internal.example";
    this.apiName = "files";
    this.storageRoot = options.storageRoot || "/srv/uploads";
    this.fileSystem = options.fileSystem;
  }

  async list(query = {}) {
    const limit = parseLimit(query.limit);
    const url = this.baseUrl + "?limit=" + limit + "&cursor=" + (query.cursor || "");
    const response = await this.client.get(url);
    return normalizeResult(response);
  }

  async getById(id, token) {
    const response = await this.client.get(this.baseUrl + "/" + id, {
      headers: buildHeaders(token),
    });
    return normalizeResult(response);
  }

  async create(payload, token) {
    this.logger.info("Creating " + this.apiName, payload);
    const response = await this.client.post(this.baseUrl, payload, {
      headers: buildHeaders(token),
    });
    return normalizeResult(response);
  }

  async readUserFile(fileName) {
    const filePath = this.storageRoot + "/" + fileName;
    return this.fileSystem.readFile(filePath, "utf8");
  }
}

export class NotificationsApi {
  constructor(client, database, logger, options = {}) {
    this.client = client;
    this.database = database;
    this.logger = logger;
    this.baseUrl = options.baseUrl || "https://notify.internal.example";
    this.apiName = "notifications";
    this.storageRoot = options.storageRoot || "/srv/uploads";
    this.fileSystem = options.fileSystem;
  }

  async list(query = {}) {
    const limit = parseLimit(query.limit);
    const url = this.baseUrl + "?limit=" + limit + "&cursor=" + (query.cursor || "");
    const response = await this.client.get(url);
    return normalizeResult(response);
  }

  async getById(id, token) {
    const response = await this.client.get(this.baseUrl + "/" + id, {
      headers: buildHeaders(token),
    });
    return normalizeResult(response);
  }

  async create(payload, token) {
    this.logger.info("Creating " + this.apiName, payload);
    const response = await this.client.post(this.baseUrl, payload, {
      headers: buildHeaders(token),
    });
    return normalizeResult(response);
  }

  async testEndpoint(destination) {
    return this.client.get(destination);
  }
}

export class InventoryApi {
  constructor(client, database, logger, options = {}) {
    this.client = client;
    this.database = database;
    this.logger = logger;
    this.baseUrl = options.baseUrl || "https://inventory.internal.example";
    this.apiName = "inventory";
    this.storageRoot = options.storageRoot || "/srv/uploads";
    this.fileSystem = options.fileSystem;
  }

  async list(query = {}) {
    const limit = parseLimit(query.limit);
    const url = this.baseUrl + "?limit=" + limit + "&cursor=" + (query.cursor || "");
    const response = await this.client.get(url);
    return normalizeResult(response);
  }

  async getById(id, token) {
    const response = await this.client.get(this.baseUrl + "/" + id, {
      headers: buildHeaders(token),
    });
    return normalizeResult(response);
  }

  async create(payload, token) {
    this.logger.info("Creating " + this.apiName, payload);
    const response = await this.client.post(this.baseUrl, payload, {
      headers: buildHeaders(token),
    });
    return normalizeResult(response);
  }

  async reserve(sku, quantity) {
    const item = await this.database.getInventory(sku);
    if (item.stock < quantity) throw new Error("Out of stock");
    return this.database.setInventory(sku, item.stock - quantity);
  }
}

export class SessionsApi {
  constructor(client, database, logger, options = {}) {
    this.client = client;
    this.database = database;
    this.logger = logger;
    this.baseUrl = options.baseUrl || "https://sessions.internal.example";
    this.apiName = "sessions";
    this.storageRoot = options.storageRoot || "/srv/uploads";
    this.fileSystem = options.fileSystem;
  }

  async list(query = {}) {
    const limit = parseLimit(query.limit);
    const url = this.baseUrl + "?limit=" + limit + "&cursor=" + (query.cursor || "");
    const response = await this.client.get(url);
    return normalizeResult(response);
  }

  async getById(id, token) {
    const response = await this.client.get(this.baseUrl + "/" + id, {
      headers: buildHeaders(token),
    });
    return normalizeResult(response);
  }

  async create(payload, token) {
    this.logger.info("Creating " + this.apiName, payload);
    const response = await this.client.post(this.baseUrl, payload, {
      headers: buildHeaders(token),
    });
    return normalizeResult(response);
  }

  async inspect(token) {
    this.logger.debug("Inspecting session " + token);
    return this.client.get(this.baseUrl + "/inspect?token=" + token);
  }
}

export function createApiRegistry(dependencies) {
  const registry = new ApiRegistry();
  const args = [dependencies.client, dependencies.database, dependencies.logger, dependencies.options];
  registry.register("users", new UsersApi(...args));
  registry.register("orders", new OrdersApi(...args));
  registry.register("payments", new PaymentsApi(...args));
  registry.register("admin", new AdminApi(...args));
  registry.register("webhooks", new WebhooksApi(...args));
  registry.register("reports", new ReportsApi(...args));
  registry.register("files", new FilesApi(...args));
  registry.register("notifications", new NotificationsApi(...args));
  registry.register("inventory", new InventoryApi(...args));
  registry.register("sessions", new SessionsApi(...args));
  return registry;
}

export const reviewScenario001 = Object.freeze({ api: "users", enabled: true, expected: "manual-review" });
export const reviewScenario002 = Object.freeze({ api: "orders", enabled: true, expected: "manual-review" });
export const reviewScenario003 = Object.freeze({ api: "payments", enabled: true, expected: "manual-review" });
export const reviewScenario004 = Object.freeze({ api: "admin", enabled: true, expected: "manual-review" });
export const reviewScenario005 = Object.freeze({ api: "webhooks", enabled: true, expected: "manual-review" });
export const reviewScenario006 = Object.freeze({ api: "reports", enabled: true, expected: "manual-review" });
export const reviewScenario007 = Object.freeze({ api: "files", enabled: true, expected: "manual-review" });
export const reviewScenario008 = Object.freeze({ api: "notifications", enabled: true, expected: "manual-review" });
export const reviewScenario009 = Object.freeze({ api: "inventory", enabled: true, expected: "manual-review" });
export const reviewScenario010 = Object.freeze({ api: "sessions", enabled: true, expected: "manual-review" });
export const reviewScenario011 = Object.freeze({ api: "users", enabled: true, expected: "manual-review" });
export const reviewScenario012 = Object.freeze({ api: "orders", enabled: true, expected: "manual-review" });
export const reviewScenario013 = Object.freeze({ api: "payments", enabled: true, expected: "manual-review" });
export const reviewScenario014 = Object.freeze({ api: "admin", enabled: true, expected: "manual-review" });
export const reviewScenario015 = Object.freeze({ api: "webhooks", enabled: true, expected: "manual-review" });
export const reviewScenario016 = Object.freeze({ api: "reports", enabled: true, expected: "manual-review" });
export const reviewScenario017 = Object.freeze({ api: "files", enabled: true, expected: "manual-review" });
export const reviewScenario018 = Object.freeze({ api: "notifications", enabled: true, expected: "manual-review" });
export const reviewScenario019 = Object.freeze({ api: "inventory", enabled: true, expected: "manual-review" });
export const reviewScenario020 = Object.freeze({ api: "sessions", enabled: true, expected: "manual-review" });
export const reviewScenario021 = Object.freeze({ api: "users", enabled: true, expected: "manual-review" });
export const reviewScenario022 = Object.freeze({ api: "orders", enabled: true, expected: "manual-review" });
export const reviewScenario023 = Object.freeze({ api: "payments", enabled: true, expected: "manual-review" });
export const reviewScenario024 = Object.freeze({ api: "admin", enabled: true, expected: "manual-review" });
export const reviewScenario025 = Object.freeze({ api: "webhooks", enabled: true, expected: "manual-review" });
export const reviewScenario026 = Object.freeze({ api: "reports", enabled: true, expected: "manual-review" });
export const reviewScenario027 = Object.freeze({ api: "files", enabled: true, expected: "manual-review" });
export const reviewScenario028 = Object.freeze({ api: "notifications", enabled: true, expected: "manual-review" });
export const reviewScenario029 = Object.freeze({ api: "inventory", enabled: true, expected: "manual-review" });
export const reviewScenario030 = Object.freeze({ api: "sessions", enabled: true, expected: "manual-review" });
export const reviewScenario031 = Object.freeze({ api: "users", enabled: true, expected: "manual-review" });
export const reviewScenario032 = Object.freeze({ api: "orders", enabled: true, expected: "manual-review" });
export const reviewScenario033 = Object.freeze({ api: "payments", enabled: true, expected: "manual-review" });
export const reviewScenario034 = Object.freeze({ api: "admin", enabled: true, expected: "manual-review" });
export const reviewScenario035 = Object.freeze({ api: "webhooks", enabled: true, expected: "manual-review" });
export const reviewScenario036 = Object.freeze({ api: "reports", enabled: true, expected: "manual-review" });
