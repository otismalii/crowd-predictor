import { AdminPageHeader, AdminPageBody, AdminSectionCard, AdminEmptyState } from "@/components/admin/primitives";
import { Settings, Construction } from "lucide-react";

const AdminSettingsPage = () => (
  <>
    <AdminPageHeader
      icon={Settings}
      title="Platform Settings"
      subtitle="Feature flags, source weights, fee schedule (super_admin only)"
    />
    <AdminPageBody>
      <AdminSectionCard title="Feature Flags">
        <AdminEmptyState
          icon={Construction}
          title="Coming next"
          description="Toggleable feature flags will live here. Track via admin_settings table (follow-up migration)."
        />
      </AdminSectionCard>
      <AdminSectionCard title="Source Reliability Weights">
        <p className="text-xs text-muted-foreground">Edit per-source weights from the Source Registry page for now.</p>
      </AdminSectionCard>
      <AdminSectionCard title="Fee Schedule">
        <p className="text-xs text-muted-foreground">Default house fee is configured at the database level. UI editor coming soon.</p>
      </AdminSectionCard>
    </AdminPageBody>
  </>
);

export default AdminSettingsPage;
