require('dotenv').config()
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const fs = require('node:fs/promises')
const path = require('node:path')
const net = require('node:net')
const { PrismaClient } = require('../generated/prisma')

const prisma = new PrismaClient()
const token = 'integration-test-only-token'
const nonce = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
const ids = { quote: null, purchaseOrders: [], invoices: [], payments: [] }
let server
let baseUrl

async function getPort() {
  const probe = net.createServer()
  probe.listen(0, '127.0.0.1')
  await once(probe, 'listening')
  const address = probe.address()
  const port = address.port
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()))
  return port
}

async function request(route, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: body instanceof FormData ? headers : body ? { 'content-type': 'application/json', ...headers } : headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })
  const content = response.status === 204 ? null : await response.json().catch(() => null)
  return { status: response.status, body: content }
}

function ok(result, status = 200) {
  assert.equal(result.status, status, JSON.stringify(result.body))
  return result.body
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Backend test server did not start.')
}

async function cleanDatabase() {
  if (ids.payments.length) {
    const attachments = await prisma.paymentAttachment.findMany({ where: { paymentId: { in: ids.payments } } })
    await prisma.paymentAttachment.deleteMany({ where: { paymentId: { in: ids.payments } } })
    await Promise.all(attachments.map((item) => fs.unlink(path.join(__dirname, '..', 'uploads', item.filename)).catch(() => {})))
    await prisma.payment.deleteMany({ where: { id: { in: ids.payments } } })
  }
  if (ids.invoices.length) await prisma.invoice.deleteMany({ where: { id: { in: ids.invoices } } })
  if (ids.purchaseOrders.length) {
    const attachments = await prisma.purchaseOrderAttachment.findMany({ where: { purchaseOrderId: { in: ids.purchaseOrders } } })
    await prisma.purchaseOrderAttachment.deleteMany({ where: { purchaseOrderId: { in: ids.purchaseOrders } } })
    await Promise.all(attachments.map((item) => fs.unlink(path.join(__dirname, '..', 'uploads', item.filename)).catch(() => {})))
    await prisma.purchaseOrder.deleteMany({ where: { id: { in: ids.purchaseOrders } } })
  }
  if (ids.quote) await prisma.quotation.deleteMany({ where: { id: ids.quote } })
}

async function main() {
  const identity = await prisma.$queryRawUnsafe('SELECT current_database() AS database')
  assert.equal(identity[0].database, 'surat_penawaran', 'Refusing to run integration tests on an unrecognized database.')
  const port = await getPort()
  baseUrl = `http://127.0.0.1:${port}`
  server = spawn(process.execPath, ['server.cjs'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), PAYMENT_VERIFICATION_TOKEN: token },
    stdio: 'ignore',
  })
  await waitForServer()

  const health = await (await fetch(`${baseUrl}/api/health`)).json()
  assert.equal(health.paymentVerificationConfigured, true)

  const quotePayload = {
    number: `QT-IT-${nonce}`, recipient: 'Customer Integration', address: 'Jalan Test', city: 'Jakarta', date: new Date().toISOString().slice(0, 10),
    validityDays: '30', senderCompany: 'PT Luma Test', introduction: '', signer: '', position: '', email: '', phone: '',
    taxEnabled: true, taxMode: 'manual', taxRate: 10, taxManualAmount: 0, type: 'Barang', status: 'Approved', title: 'Item snapshot test', items: [
      { description: 'Barang Snapshot', quantity: 2, unit: 'pcs', unitPrice: 5000, discount: 0, taxRate: 10 },
    ],
  }
  const quote = ok(await request('/api/quotations', { method: 'POST', body: quotePayload }), 201)
  ids.quote = quote.id
  assert.equal(quote.items.length, 1)

  const po = ok(await request('/api/purchase-orders', { method: 'POST', body: {
    poNumber: `PO-IT-${nonce}`, date: quotePayload.date, receivedAt: quotePayload.date, recipient: quote.recipient, quotationId: quote.id, amount: '11000.00', notes: 'test PO',
  } }), 201)
  ids.purchaseOrders.push(po.id)
  assert.equal(po.quotationId, quote.id)
  assert.equal((await request('/api/purchase-orders', { method: 'POST', body: { poNumber: po.poNumber, date: quotePayload.date, receivedAt: quotePayload.date, recipient: quote.recipient } })).status, 409)

  const legacyId = `quick-in-it-${nonce}`
  const legacyBody = { records: [{ id: legacyId, poNumber: `PO-LEGACY-${nonce}`, date: quotePayload.date, quotationId: quote.id, recipient: quote.recipient, notes: 'import test' }] }
  const imported = ok(await request('/api/purchase-orders/import-legacy', { method: 'POST', body: legacyBody }))
  assert.equal(imported.imported, 1)
  const importedAgain = ok(await request('/api/purchase-orders/import-legacy', { method: 'POST', body: legacyBody }))
  assert.equal(importedAgain.results[0].result, 'already-imported')
  const legacyPO = await prisma.purchaseOrder.findUnique({ where: { legacyLocalId: legacyId } })
  ids.purchaseOrders.push(legacyPO.id)

  const pdf = new Blob([Buffer.from('%PDF-1.4\n%test\n')], { type: 'application/pdf' })
  const poForm = new FormData(); poForm.append('file', pdf, 'purchase-order.pdf')
  const poAttachment = ok(await request(`/api/purchase-orders/${po.id}/attachments`, { method: 'POST', body: poForm }), 201)
  assert.equal((await request(`/api/purchase-orders/${po.id}/attachments/${poAttachment.id}`, { method: 'DELETE' })).status, 204)

  const invoice = ok(await request('/api/invoices', { method: 'POST', body: {
    number: `INV-IT-${nonce}`, customerName: quote.recipient, dueDate: quotePayload.date,
    purchaseOrderId: po.id, quotationId: quote.id, notes: 'snapshot test',
  } }), 201)
  ids.invoices.push(invoice.id)
  assert.equal(invoice.status, 'DRAFT')
  assert.equal(invoice.items[0].description, 'Barang Snapshot')
  assert.equal(invoice.total, '11000')

  const duplicateInvoice = await request('/api/invoices', { method: 'POST', body: {
    number: invoice.number, customerName: quote.recipient, dueDate: quotePayload.date, purchaseOrderId: po.id,
  } })
  assert.equal(duplicateInvoice.status, 409)

  const changedQuote = { ...quotePayload, title: 'Quotation changed', items: [{ description: 'Ubah setelah invoice', quantity: 1, unit: 'pcs', unitPrice: 99000, discount: 0, taxRate: 0 }] }
  ok(await request(`/api/quotations/${quote.id}`, { method: 'PUT', body: changedQuote }))
  const snapshotAfterQuoteEdit = ok(await request(`/api/invoices/${invoice.id}`))
  assert.equal(snapshotAfterQuoteEdit.items[0].description, 'Barang Snapshot')
  assert.equal(snapshotAfterQuoteEdit.items[0].unitPrice, '5000')

  const issued = ok(await request(`/api/invoices/${invoice.id}/issue`, { method: 'PATCH', body: {} }))
  assert.equal(issued.status, 'ISSUED')

  const pending = ok(await request('/api/payments', { method: 'POST', body: {
    invoiceId: invoice.id, amount: '5000', paymentDate: quotePayload.date, method: 'Transfer Bank', reference: `TRX-${nonce}`, notes: 'partial test',
  } }), 201)
  ids.payments.push(pending.id)
  assert.equal(pending.status, 'PENDING')
  let invoiceAfterPending = ok(await request(`/api/invoices/${invoice.id}`))
  assert.equal(invoiceAfterPending.paidAmount, '0.00')
  assert.equal(invoiceAfterPending.balance, '11000.00')

  const proofForm = new FormData(); proofForm.append('file', pdf, 'proof.pdf')
  const proof = ok(await request(`/api/payments/${pending.id}/attachments`, { method: 'POST', body: proofForm }), 201)
  assert.equal((await request(`/api/payments/${pending.id}/attachments/${proof.id}`, { method: 'DELETE' })).status, 204)
  assert.equal((await request(`/api/payments/${pending.id}/verify`, { method: 'PATCH', body: {} })).status, 403)
  ok(await request(`/api/payments/${pending.id}/verify`, { method: 'PATCH', headers: { 'x-payment-verification-token': token }, body: {} }))
  invoiceAfterPending = ok(await request(`/api/invoices/${invoice.id}`))
  assert.equal(invoiceAfterPending.paidAmount, '5000.00')
  assert.equal(invoiceAfterPending.balance, '6000.00')
  assert.equal(invoiceAfterPending.status, 'PARTIALLY_PAID')

  const cancelledVerified = ok(await request(`/api/payments/${pending.id}/cancel`, { method: 'PATCH', headers: { 'x-payment-verification-token': token }, body: { reason: 'Correction test' } }))
  assert.equal(cancelledVerified.status, 'CANCELLED')
  invoiceAfterPending = ok(await request(`/api/invoices/${invoice.id}`))
  assert.equal(invoiceAfterPending.paidAmount, '0.00')
  assert.equal(invoiceAfterPending.balance, '11000.00')

  const overpayment = await request('/api/payments', { method: 'POST', body: {
    invoiceId: invoice.id, amount: '11000.01', paymentDate: quotePayload.date, method: 'Transfer Bank',
  } })
  assert.equal(overpayment.status, 409)
  const overpaymentCase = ok(await request('/api/payments/overpayment-case', { method: 'POST', headers: { 'x-payment-verification-token': token }, body: {
    invoiceId: invoice.id, amount: '11000.01', paymentDate: quotePayload.date, method: 'Transfer Bank', reason: 'Test case review',
  } }), 201)
  ids.payments.push(overpaymentCase.id)
  assert.equal(overpaymentCase.status, 'REVIEW_REQUIRED')
  invoiceAfterPending = ok(await request(`/api/invoices/${invoice.id}`))
  assert.equal(invoiceAfterPending.paidAmount, '0.00')
  assert.equal(invoiceAfterPending.balance, '11000.00')
  ok(await request(`/api/payments/${overpaymentCase.id}/cancel`, { method: 'PATCH', headers: { 'x-payment-verification-token': token }, body: { reason: 'Review case test cleanup' } }))

  const concurrentOne = ok(await request('/api/payments', { method: 'POST', body: { invoiceId: invoice.id, amount: '7000', paymentDate: quotePayload.date, method: 'Transfer Bank' } }), 201)
  const concurrentTwo = ok(await request('/api/payments', { method: 'POST', body: { invoiceId: invoice.id, amount: '7000', paymentDate: quotePayload.date, method: 'Transfer Bank' } }), 201)
  ids.payments.push(concurrentOne.id, concurrentTwo.id)
  const concurrencyResults = await Promise.all([
    request(`/api/payments/${concurrentOne.id}/verify`, { method: 'PATCH', headers: { 'x-payment-verification-token': token }, body: {} }),
    request(`/api/payments/${concurrentTwo.id}/verify`, { method: 'PATCH', headers: { 'x-payment-verification-token': token }, body: {} }),
  ])
  assert.equal(concurrencyResults.filter((result) => result.status === 200).length, 1)
  assert.equal(concurrencyResults.filter((result) => result.status === 409).length, 1)
  const currentPayments = ok(await request(`/api/payments?search=${encodeURIComponent(invoice.number)}`))
  const verified = currentPayments.find((item) => item.status === 'VERIFIED')
  const pendingAfterRace = currentPayments.find((item) => item.status === 'PENDING')
  assert.ok(verified)
  assert.ok(pendingAfterRace)
  ok(await request(`/api/payments/${verified.id}/cancel`, { method: 'PATCH', headers: { 'x-payment-verification-token': token }, body: { reason: 'Race cleanup' } }))
  ok(await request(`/api/payments/${pendingAfterRace.id}/cancel`, { method: 'PATCH', body: { reason: 'Race cleanup' } }))
  const paymentDetail = ok(await request(`/api/payments/${pending.id}`))
  assert.equal(paymentDetail.history.length, 3)

  const fullPayment = ok(await request('/api/payments', { method: 'POST', body: { invoiceId: invoice.id, amount: '11000', paymentDate: quotePayload.date, method: 'Transfer Bank' } }), 201)
  ids.payments.push(fullPayment.id)
  ok(await request(`/api/payments/${fullPayment.id}/verify`, { method: 'PATCH', headers: { 'x-payment-verification-token': token }, body: {} }))
  const paidInvoice = ok(await request(`/api/invoices/${invoice.id}`))
  assert.equal(paidInvoice.status, 'PAID')
  assert.equal(paidInvoice.balance, '0.00')
  ok(await request(`/api/payments/${fullPayment.id}/cancel`, { method: 'PATCH', headers: { 'x-payment-verification-token': token }, body: { reason: 'Paid state test cleanup' } }))

  const cancelledInvoice = ok(await request(`/api/invoices/${invoice.id}/cancel`, { method: 'PATCH', body: { reason: 'Integration test cleanup' } }))
  assert.equal(cancelledInvoice.status, 'CANCELLED')
  const cancelledPO = ok(await request(`/api/purchase-orders/${po.id}/cancel`, { method: 'PATCH', body: { reason: 'Integration test cleanup' } }))
  assert.equal(cancelledPO.status, 'CANCELLED')

  const persisted = ok(await request(`/api/invoices/${invoice.id}`))
  assert.equal(persisted.items[0].description, 'Barang Snapshot')

  const listAfterReload = ok(await request('/api/purchase-orders'))
  assert.ok(listAfterReload.some((item) => item.id === po.id))
  const invoiceListAfterReload = ok(await request(`/api/invoices?search=${encodeURIComponent(invoice.number)}`))
  assert.ok(invoiceListAfterReload.some((item) => item.id === invoice.id))
  const paymentListAfterReload = ok(await request(`/api/payments?search=${encodeURIComponent(invoice.number)}`))
  assert.ok(paymentListAfterReload.some((item) => item.id === fullPayment.id))
  console.log('Billing integration passed: PO + legacy import, invoice snapshot, payments, verification, cancellation, overpayment guard, concurrency, and persistence.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(async () => {
  if (server && server.exitCode === null) {
    server.kill('SIGINT')
    await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 1500))])
  }
  await cleanDatabase().catch((error) => { console.error('Test cleanup failed:', error); process.exitCode = 1 })
  await prisma.$disconnect()
})
