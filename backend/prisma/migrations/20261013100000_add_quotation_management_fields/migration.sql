ALTER TABLE "Quotation"
ADD COLUMN "type" TEXT NOT NULL DEFAULT 'Barang & Jasa',
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Draft',
ADD COLUMN "title" TEXT,
ADD COLUMN "validUntil" TEXT,
ADD COLUMN "notes" TEXT,
ADD COLUMN "followUpDate" TEXT,
ADD COLUMN "followUpStatus" TEXT NOT NULL DEFAULT 'Belum dijadwalkan',
ADD COLUMN "followUpNotes" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "QuotationItem"
ADD COLUMN "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "subtotal" DOUBLE PRECISION;

CREATE TABLE "QuotationAttachment" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationAttachment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "QuotationAttachment"
ADD CONSTRAINT "QuotationAttachment_quotationId_fkey"
FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
