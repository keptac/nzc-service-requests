-- AlterTable
ALTER TABLE "LeaveApplication" ADD COLUMN     "adcom_minute_number" TEXT;

-- AlterTable
ALTER TABLE "LeaveType" ADD COLUMN     "monthly_accrual_rate" DOUBLE PRECISION;
