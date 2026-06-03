import AdminSourceRegistry from "@/components/admin/AdminSourceRegistry";
import { AdminPageHeader, AdminPageBody } from "@/components/admin/primitives";
import { Database } from "lucide-react";

const AdminSourcesPage = () => (
  <>
    <AdminPageHeader
      icon={Database}
      title="Source Registry"
      subtitle="Manage data sources used to resolve markets"
    />
    <AdminPageBody>
      <AdminSourceRegistry />
    </AdminPageBody>
  </>
);

export default AdminSourcesPage;
