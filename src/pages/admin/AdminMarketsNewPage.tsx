import { AdminPageHeader, AdminPageBody } from "@/components/admin/primitives";
import MarketBuilder from "@/components/admin/MarketBuilder";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";

const AdminMarketsNewPage = () => {
  const navigate = useNavigate();
  return (
    <>
      <AdminPageHeader
        icon={Plus}
        title="Create New Market"
        subtitle="Build and publish a new prediction market"
      />
      <AdminPageBody>
        <div className="max-w-3xl">
          <MarketBuilder onCreated={() => navigate("/admin/markets")} />
        </div>
      </AdminPageBody>
    </>
  );
};

export default AdminMarketsNewPage;
