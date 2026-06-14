import { History } from "lucide-react";
import { AdminPageHeader, AdminPageBody, AdminEmptyState } from "@/components/admin/primitives";

const AdminPredictionHistoryPage = () => (
  <>
    <AdminPageHeader icon={History} title="Prediction History" subtitle="Brier scores and calibration per domain" />
    <AdminPageBody>
      <AdminEmptyState icon={History} title="Calibration data lands in Wave 3" description="Per-user and per-domain prediction accuracy will populate after the creator scoring engine ships." />
    </AdminPageBody>
  </>
);

export default AdminPredictionHistoryPage;
