-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "supervisor_id" TEXT;

-- AlterTable
ALTER TABLE "LeaveApplication" ADD COLUMN     "supervisor_approved_at" TIMESTAMP(3),
ADD COLUMN     "supervisor_user_id" TEXT;

-- CreateIndex
CREATE INDEX "Employee_supervisor_id_idx" ON "Employee"("supervisor_id");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
