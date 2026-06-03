import AdminDisputes from "@/components/admin/AdminDisputes";
import { AdminPageHeader, AdminPageBody } from "@/components/admin/primitives";
import { Gavel } from "lucide-react";

const AdminDisputesPage = () => (
  <>
    <AdminPageHeader
      icon={Gavel}
      title="Disputes"
      subtitle="Review and rule on market disputes raised by users"
    />
    <AdminPageBody>
      <AdminDisputes />
    </AdminPageBody>
  </>
);

export default AdminDisputesPage;
