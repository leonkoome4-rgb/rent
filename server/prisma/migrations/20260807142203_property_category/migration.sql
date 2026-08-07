-- CreateEnum
CREATE TYPE "PropertyCategory" AS ENUM ('RENT', 'SCHOOL_FEES', 'MEMBERSHIP', 'OTHER');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "category" "PropertyCategory" NOT NULL DEFAULT 'RENT';
