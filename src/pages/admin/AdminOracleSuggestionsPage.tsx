import { Sparkles } from "lucide-react";
import { AdminPageHeader, AdminPageBody, AdminEmptyState } from "@/components/admin/primitives";

const AdminOracleSuggestionsPage = () => (
  <>
    <AdminPageHeader icon={Sparkles} title="Oracle Suggestions" subtitle="LOGIK-generated market drafts awaiting human approval" />
    <AdminPageBody>
      <AdminEmptyState
        icon={Sparkles}
        title="Oracle is offline"
        description="The LOGIK Oracle suggestion engine ships in Wave 2. Approved suggestions will surface here for ACP review before any market is published."
      />
    </AdminPageBody>
  </>
);

export default AdminOracleSuggestionsPage;
