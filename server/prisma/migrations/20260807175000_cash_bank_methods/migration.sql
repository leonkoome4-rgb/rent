-- Replace generic MANUAL with explicit CASH / BANK settlement methods.
ALTER TYPE "PayMethod" RENAME TO "PayMethod_old";
CREATE TYPE "PayMethod" AS ENUM ('STK', 'C2B', 'CASH', 'BANK');
ALTER TABLE "Payment" ALTER COLUMN "method" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "method" TYPE "PayMethod" USING (method::text::"PayMethod");
ALTER TABLE "Payment" ALTER COLUMN "method" SET DEFAULT 'STK';
DROP TYPE "PayMethod_old";
