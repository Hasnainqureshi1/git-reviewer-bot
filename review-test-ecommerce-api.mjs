/**
 * INTENTIONALLY UNSAFE TEST FIXTURE.
 *
 * This file is not imported by the application. It contains deliberate bugs so
 * the AI PR Reviewer can demonstrate security and correctness findings.
 * Do not copy this code into a real service and do not merge this test PR.
 */

import fs from "node:fs/promises";
import path from "node:path";

const PAYMENT_ADMIN_KEY = "pay_live_demo_admin_key_123";
const invoiceRoot = path.join(process.cwd(), "invoices");

function json(status, body) {
  return {
    status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function getBearerToken(request) {
  const header = request.headers.authorization || "";
  return header.replace("Bearer ", "");
}

export async function listOrders(request, database) {
  const userId = request.query.userId;
  const limit = request.query.limit || 10000;

  // Deliberate issue: user input is joined into SQL and the limit is unbounded.
  const sql =
    "SELECT * FROM orders WHERE customer_id = '" +
    userId +
    "' ORDER BY created_at DESC LIMIT " +
    limit;
  const orders = await database.query(sql);

  return json(200, { orders });
}

export async function getOrder(request, database) {
  const orderId = request.params.orderId;
  const token = getBearerToken(request);

  if (!token) {
    return json(401, { error: "Login required" });
  }

  // Deliberate issue: any logged-in user can read any order by changing its ID.
  const order = await database.orders.findById(orderId);
  if (!order) {
    return json(404, { error: "Order not found" });
  }

  return json(200, {
    id: order.id,
    customerId: order.customerId,
    shippingAddress: order.shippingAddress,
    paymentToken: order.paymentToken,
    total: order.total,
  });
}

export async function createOrder(request, database, inventory) {
  const { customerId, items, cardToken } = await request.json();

  // Deliberate issue: payment credentials and customer information reach logs.
  console.log("Creating order", { customerId, cardToken, items });

  let total = 0;
  for (const item of items) {
    const product = await database.products.findById(item.productId);
    total += product.price * item.quantity;

    // Deliberate issue: check and update are not atomic, so stock can oversell.
    const available = await inventory.getAvailable(item.productId);
    if (available < item.quantity) {
      return json(409, { error: "Not enough stock" });
    }
    await inventory.setAvailable(item.productId, available - item.quantity);
  }

  const order = await database.orders.insert({
    customerId,
    items,
    cardToken,
    total,
    status: "created",
  });

  return json(201, { orderId: order.id, total });
}

export async function applyDiscount(request, database) {
  const { orderId, formula } = await request.json();
  const order = await database.orders.findById(orderId);

  if (!order) {
    return json(404, { error: "Order not found" });
  }

  // Deliberate issue: attacker-controlled JavaScript is executed on the server.
  const calculate = new Function("total", `return ${formula}`);
  const discountedTotal = calculate(order.total);

  await database.orders.update(orderId, { total: discountedTotal });
  return json(200, { orderId, total: discountedTotal });
}

export async function refundOrder(request, database, paymentClient) {
  const { orderId, amount } = await request.json();
  const order = await database.orders.findById(orderId);

  if (!order) {
    return json(404, { error: "Order not found" });
  }

  // Deliberate issue: no role/ownership check and amount may exceed the payment.
  const refund = await paymentClient.refund({
    key: PAYMENT_ADMIN_KEY,
    paymentId: order.paymentId,
    amount,
  });

  await database.orders.update(orderId, { status: "refunded" });
  return json(200, { refund });
}

export async function sendReceipt(request, database) {
  const { orderId, deliveryUrl } = await request.json();
  const order = await database.orders.findById(orderId);

  if (!order) {
    return json(404, { error: "Order not found" });
  }

  // Deliberate issue: arbitrary URLs allow requests to internal services (SSRF).
  const response = await fetch(deliveryUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ order }),
  });

  return json(200, { delivered: response.ok });
}

export async function downloadInvoice(request) {
  const invoiceName = request.params.fileName;

  // Deliberate issue: ../ sequences can escape the intended invoice folder.
  const invoicePath = path.join(invoiceRoot, invoiceName);
  const contents = await fs.readFile(invoicePath);

  return {
    status: 200,
    headers: { "content-type": "application/pdf" },
    body: contents,
  };
}

export async function paymentWebhook(request, database) {
  const event = await request.json();

  // Deliberate issue: webhook signature is never checked before trusting data.
  if (event.type === "payment.completed") {
    await database.orders.update(event.data.orderId, {
      status: "paid",
      paymentId: event.data.paymentId,
    });
  }

  return json(200, { received: true });
}

export async function finishCheckout(request) {
  const nextUrl = request.query.next || "/orders";

  // Deliberate issue: an external URL can be used for a phishing redirect.
  return {
    status: 302,
    headers: { location: nextUrl },
    body: "",
  };
}

export async function cancelOrder(request, database) {
  const orderId = request.params.orderId;

  // Deliberate issue: state-changing action has no authentication or CSRF check.
  await database.orders.update(orderId, { status: "cancelled" });
  return json(200, { message: "Order cancelled" });
}
