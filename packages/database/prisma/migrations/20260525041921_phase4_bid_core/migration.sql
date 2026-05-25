/*
  Warnings:

  - You are about to drop the column `profitMarginPercent` on the `Bid` table. All the data in the column will be lost.
  - The `status` column on the `Bid` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `totalCost` on the `Bid` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,2)`.
  - You are about to alter the column `totalBidPrice` on the `Bid` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,2)`.
  - You are about to alter the column `quantity` on the `BidItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,3)`.
  - You are about to alter the column `costPrice` on the `BidItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `sellPrice` on the `BidItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - Added the required column `companyId` to the `Bid` table without a default value. This is not possible if the table is not empty.
  - Made the column `totalCost` on table `Bid` required. This step will fail if there are existing NULL values in that column.
  - Made the column `totalBidPrice` on table `Bid` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'SUBMITTED', 'WON', 'LOST');

-- DropForeignKey
ALTER TABLE "BidDocument" DROP CONSTRAINT "BidDocument_bidId_fkey";

-- DropForeignKey
ALTER TABLE "BidItem" DROP CONSTRAINT "BidItem_bidId_fkey";

-- AlterTable
ALTER TABLE "Bid" DROP COLUMN "profitMarginPercent",
ADD COLUMN     "companyId" TEXT NOT NULL,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'HKD',
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '默认方案',
ADD COLUMN     "profitMarginPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
DROP COLUMN "status",
ADD COLUMN     "status" "BidStatus" NOT NULL DEFAULT 'DRAFT',
ALTER COLUMN "totalCost" SET NOT NULL,
ALTER COLUMN "totalCost" SET DEFAULT 0,
ALTER COLUMN "totalCost" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "totalBidPrice" SET NOT NULL,
ALTER COLUMN "totalBidPrice" SET DEFAULT 0,
ALTER COLUMN "totalBidPrice" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "BidDocument" ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "originalName" TEXT;

-- AlterTable
ALTER TABLE "BidItem" ADD COLUMN     "ifcElementId" TEXT,
ADD COLUMN     "isManualPrice" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "itemCode" TEXT,
ALTER COLUMN "quantity" SET DEFAULT 0,
ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(12,3),
ALTER COLUMN "unit" DROP NOT NULL,
ALTER COLUMN "costPrice" SET DEFAULT 0,
ALTER COLUMN "costPrice" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "sellPrice" SET DEFAULT 0,
ALTER COLUMN "sellPrice" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "drawingPage" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "TenderProject" ADD COLUMN     "category" TEXT,
ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "BidCommercial" (
    "id" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "companyName" TEXT,
    "registrationNo" TEXT,
    "licenses" JSONB NOT NULL DEFAULT '[]',
    "keyPersonnel" JSONB NOT NULL DEFAULT '[]',
    "pastProjects" JSONB NOT NULL DEFAULT '[]',
    "companyProfile" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BidCommercial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidTechnical" (
    "id" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "constructionMethod" TEXT,
    "siteManagement" TEXT,
    "safetyMeasures" TEXT,
    "qualityControl" TEXT,
    "durationDays" INTEGER,
    "milestonePlan" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BidTechnical_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidStatusLog" (
    "id" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BidStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BidCommercial_bidId_key" ON "BidCommercial"("bidId");

-- CreateIndex
CREATE UNIQUE INDEX "BidTechnical_bidId_key" ON "BidTechnical"("bidId");

-- CreateIndex
CREATE INDEX "BidStatusLog_bidId_idx" ON "BidStatusLog"("bidId");

-- CreateIndex
CREATE INDEX "Bid_tenderId_idx" ON "Bid"("tenderId");

-- CreateIndex
CREATE INDEX "Bid_companyId_idx" ON "Bid"("companyId");

-- CreateIndex
CREATE INDEX "BidItem_bidId_idx" ON "BidItem"("bidId");

-- AddForeignKey
ALTER TABLE "BidItem" ADD CONSTRAINT "BidItem_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidCommercial" ADD CONSTRAINT "BidCommercial_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidTechnical" ADD CONSTRAINT "BidTechnical_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidStatusLog" ADD CONSTRAINT "BidStatusLog_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidDocument" ADD CONSTRAINT "BidDocument_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE CASCADE ON UPDATE CASCADE;
