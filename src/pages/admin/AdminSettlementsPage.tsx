import { Workflow } from "lucide-react";
import { AdminPageHeader, AdminPageBody, AdminEmptyState } from "@/components/admin/primitives";

const AdminSettlementsPage = () => (
  <>
    <AdminPageHeader icon={Workflow} title="Settlements" subtitle="Two-step preview and approval for every payout batch" />
    <AdminPageBody>
      <AdminEmptyState
        icon={Workflow}
        title="Settlement engine coming in Wave 4"
        description="Every settlement will require an ACP preview, a reconciliation pre-check (imbalance must equal zero), then explicit approval."
      />
    </AdminPageBody>
  </>
);

export default AdminSettlementsPage;
