const express = require('express')
const cors = require('cors')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { PrismaClient } = require('./generated/prisma')
const { createBillingRouter } = require('./modules/billing.cjs')

const app = express()
const prisma = new PrismaClient()
const PORT = Number(process.env.PORT || 3001)
const QUOTATION_STATUSES = ['Draft', 'Sent', 'Follow Up', 'Approved', 'Rejected', 'Revised']

const UPLOAD_DIR = path.join(__dirname, 'uploads')
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use('/uploads', express.static(UPLOAD_DIR))

function reqType(value) {
  return ['signature', 'stamp'].includes(value) ? value : null
}

function normalizeStatus(value, fallback = 'Draft') {
  return QUOTATION_STATUSES.includes(value) ? value : fallback
}

function normalizeType(value, fallback = 'Barang & Jasa') {
  const validTypes = ['Barang', 'Jasa', 'Barang & Jasa']
  return validTypes.includes(value) ? value : fallback
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function safeString(value, fallback = '') {
  if (typeof value !== 'string') return fallback
  return value
}

function sendServerError(res, error) {
  console.error('API request failed:', error)
  return res.status(500).json({ error: 'Terjadi kesalahan server. Silakan coba kembali.' })
}

function isUniqueConstraintViolation(error) {
  return Boolean(error && typeof error === 'object' && error.code === 'P2002')
}

function buildItemPayload(item, index) {
  const quantity = Math.max(1, Math.round(safeNumber(item?.quantity, 1)))
  const unitPrice = Math.max(0, safeNumber(item?.unitPrice, 0))
  const discount = Math.max(0, safeNumber(item?.discount, 0))
  const taxRate = Math.max(0, safeNumber(item?.taxRate, 0))
  const subtotalBase = quantity * unitPrice - discount
  const subtotal = subtotalBase + Math.max(0, subtotalBase * (taxRate / 100))

  return {
    description: safeString(item?.description, `Item ${index + 1}`).trim() || `Item ${index + 1}`,
    quantity,
    unit: safeString(item?.unit, 'pcs').trim() || 'pcs',
    unitPrice,
    discount,
    taxRate,
    subtotal,
  }
}

function buildQuotationPayload(body) {
  const items = Array.isArray(body?.items) ? body.items : []

  return {
    recipient: safeString(body?.recipient, 'Customer belum diisi').trim() || 'Customer belum diisi',
    address: safeString(body?.address, '').trim(),
    city: safeString(body?.city, '').trim(),
    date: safeString(body?.date, new Date().toISOString().slice(0, 10)).trim() || new Date().toISOString().slice(0, 10),
    number: safeString(body?.number, '').trim(),
    validityDays: safeString(body?.validityDays, '30').trim() || '30',
    senderCompany: safeString(body?.senderCompany, 'PT Luma').trim() || 'PT Luma',
    introduction: safeString(body?.introduction, '').trim(),
    signer: safeString(body?.signer, '').trim(),
    position: safeString(body?.position, '').trim(),
    email: safeString(body?.email, '').trim(),
    phone: safeString(body?.phone, '').trim(),
    taxEnabled: Boolean(body?.taxEnabled ?? true),
    taxMode: safeString(body?.taxMode, 'manual').trim() || 'manual',
    taxRate: safeNumber(body?.taxRate, 0),
    taxManualAmount: safeNumber(body?.taxManualAmount, 0),
    signatureImage: safeString(body?.signatureImage, '').trim() || null,
    stampImage: safeString(body?.stampImage, '').trim() || null,
    type: normalizeType(body?.type),
    status: normalizeStatus(body?.status),
    title: safeString(body?.title, '').trim() || null,
    validUntil: safeString(body?.validUntil, '').trim() || null,
    notes: safeString(body?.notes, '').trim() || null,
    followUpDate: safeString(body?.followUpDate, '').trim() || null,
    followUpStatus: safeString(body?.followUpStatus, 'Belum dijadwalkan').trim() || 'Belum dijadwalkan',
    followUpNotes: safeString(body?.followUpNotes, '').trim() || null,
    items: items.map(buildItemPayload),
  }
}

const assetStorage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, UPLOAD_DIR),
  filename: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase()
    callback(null, `${crypto.randomUUID()}${ext}`)
  },
})

const quoteUpload = multer({
  storage: assetStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    if (!allowed.includes(file.mimetype)) {
      callback(new Error('File tidak didukung. Gunakan PDF, DOCX, XLSX, PNG, JPG, atau WEBP.'))
      return
    }
    callback(null, true)
  },
})

const assetUpload = multer({
  storage: assetStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
    if (!allowed.includes(file.mimetype)) {
      callback(new Error('File harus PNG, JPG, WEBP, atau PDF'))
      return
    }
    callback(null, true)
  },
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', paymentVerificationConfigured: Boolean(process.env.PAYMENT_VERIFICATION_TOKEN) })
})

app.get('/api/quotations', async (_req, res) => {
  try {
    const quotations = await prisma.quotation.findMany({
      include: {
        items: true,
        attachments: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(quotations)
  } catch (error) {
    sendServerError(res, error)
  }
})

app.get('/api/quotations/:id', async (req, res) => {
  try {
    const quotation = await prisma.quotation.findUnique({
      where: { id: req.params.id },
      include: { items: true, attachments: true },
    })

    if (!quotation) {
      return res.status(404).json({ error: 'Quotation tidak ditemukan' })
    }

    res.json(quotation)
  } catch (error) {
    sendServerError(res, error)
  }
})

app.post('/api/quotations', async (req, res) => {
  try {
    const payload = buildQuotationPayload(req.body)

    if (!payload.number) {
      return res.status(400).json({ error: 'Nomor quotation wajib diisi' })
    }

    const quotation = await prisma.quotation.create({
      data: {
        ...payload,
        items: {
          create: payload.items,
        },
      },
      include: {
        items: true,
        attachments: true,
      },
    })

    res.status(201).json(quotation)
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return res.status(409).json({ error: 'Nomor quotation sudah digunakan.' })
    }
    sendServerError(res, error)
  }
})

app.put('/api/quotations/:id', async (req, res) => {
  try {
    const payload = buildQuotationPayload(req.body)

    const quotation = await prisma.quotation.update({
      where: { id: req.params.id },
      data: {
        ...payload,
        items: {
          deleteMany: {},
          create: payload.items,
        },
      },
      include: {
        items: true,
        attachments: true,
      },
    })

    res.json(quotation)
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return res.status(409).json({ error: 'Nomor quotation sudah digunakan.' })
    }
    sendServerError(res, error)
  }
})

app.patch('/api/quotations/:id/status', async (req, res) => {
  const { status } = req.body ?? {}
  if (!QUOTATION_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Status transaksi tidak valid.' })
  }

  try {
    const quotation = await prisma.quotation.update({
      where: { id: req.params.id },
      data: { status },
      select: { id: true, number: true, status: true, updatedAt: true },
    })
    res.json(quotation)
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'P2025') {
      return res.status(404).json({ error: 'Quotation tidak ditemukan.' })
    }
    sendServerError(res, error)
  }
})

app.delete('/api/quotations/:id', async (req, res) => {
  try {
    await prisma.quotation.delete({
      where: { id: req.params.id },
    })

    res.status(204).end()
  } catch (error) {
    sendServerError(res, error)
  }
})

app.post('/api/quotations/:id/attachments', quoteUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File lampiran wajib dipilih' })
    }

    const quotation = await prisma.quotation.findUnique({ where: { id: req.params.id } })
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation tidak ditemukan' })
    }

    const attachment = await prisma.quotationAttachment.create({
      data: {
        quotationId: req.params.id,
        name: req.file.originalname,
        filename: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: `http://localhost:${PORT}/uploads/${req.file.filename}`,
      },
    })

    res.status(201).json(attachment)
  } catch (error) {
    sendServerError(res, error)
  }
})

app.get('/api/quotations/:id/attachments', async (req, res) => {
  try {
    const attachments = await prisma.quotationAttachment.findMany({
      where: { quotationId: req.params.id },
      orderBy: { uploadedAt: 'desc' },
    })

    res.json(attachments)
  } catch (error) {
    sendServerError(res, error)
  }
})

app.delete('/api/quotations/:id/attachments/:attachmentId', async (req, res) => {
  try {
    const attachment = await prisma.quotationAttachment.findUnique({
      where: { id: req.params.attachmentId },
    })

    if (!attachment) {
      return res.status(404).json({ error: 'Lampiran tidak ditemukan' })
    }

    const filePath = path.join(UPLOAD_DIR, attachment.filename)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    await prisma.quotationAttachment.delete({
      where: { id: req.params.attachmentId },
    })

    res.status(204).end()
  } catch (error) {
    sendServerError(res, error)
  }
})

app.get('/api/assets', async (req, res) => {
  try {
    const type = reqType(req.query.type)
    const assets = await prisma.asset.findMany({
      where: type ? { type } : undefined,
      orderBy: { createdAt: 'desc' },
    })

    res.json(assets)
  } catch (error) {
    sendServerError(res, error)
  }
})

app.post('/api/assets', assetUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File gambar wajib dipilih' })
    }

    const type = reqType(req.body.type)
    if (!type) {
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'Jenis asset tidak valid' })
    }

    const asset = {
      id: crypto.randomUUID(),
      name: req.file.originalname,
      type,
      filename: req.file.filename,
      url: `http://localhost:${PORT}/uploads/${req.file.filename}`,
    }

    const saved = await prisma.asset.create({ data: asset })
    res.status(201).json(saved)
  } catch (error) {
    sendServerError(res, error)
  }
})

app.delete('/api/assets/:id', async (req, res) => {
  try {
    const asset = await prisma.asset.findUnique({ where: { id: req.params.id } })
    if (!asset) {
      return res.status(404).json({ error: 'Aset tidak ditemukan' })
    }

    const filePath = path.join(UPLOAD_DIR, asset.filename)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    await prisma.asset.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (error) {
    sendServerError(res, error)
  }
})

app.use('/api', (req, _res, next) => {
  req.prisma = prisma
  next()
}, createBillingRouter())

app.listen(PORT, () => {
  console.log(`Backend berjalan di http://localhost:${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/api/health`)
})

process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
