import { Brain } from "lucide-react";
import { AdminPageHeader, AdminPageBody, AdminEmptyState } from "@/components/admin/primitives";

const AdminIntelligenceInsightsPage = () => (
  <>
    <AdminPageHeader icon={Brain} title="LOGIK Insights" subtitle="Oracle run log, calibration metrics, and confidence drift" />
    <AdminPageBody>
      <AdminEmptyState
        icon={Brain}
        title="LOGIK Oracle ships in Wave 2"
        description="Each Oracle invocation will be logged here with input, output, model, latency and cost — feeding the recursive learning loop."
      />
    </AdminPageBody>
  </>
);

export default AdminIntelligenceInsightsPage;
