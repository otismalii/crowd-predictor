import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Save, X, Phone, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SpotlightCard from "@/components/reactbits/SpotlightCard";

interface ProfileEditProps {
  profile: any;
  onClose: () => void;
  onSaved: (updated: any) => void;
}

const ProfileEdit = ({ profile, onClose, onSaved }: ProfileEditProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState(profile.username || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [phoneNumber, setPhoneNumber] = useState(profile.phone_number || "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const phoneAlreadySet = !!profile.phone_number;

  const validatePhone = (phone: string): boolean => {
    if (!phone) return true; // optional if not set yet
    const cleaned = phone.replace(/\s+/g, "");
    return /^254\d{9}$/.test(cleaned);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 2MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
    } else {
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`);
      toast({ title: "Avatar uploaded!" });
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!username.trim() || username.length > 30) {
      toast({ title: "Username must be 1-30 characters", variant: "destructive" });
      return;
    }
    if (bio.length > 200) {
      toast({ title: "Bio must be under 200 characters", variant: "destructive" });
      return;
    }

    // Validate phone if being set for the first time
    const cleanedPhone = phoneNumber.replace(/\s+/g, "");
    if (cleanedPhone && !validatePhone(cleanedPhone)) {
      toast({ title: "Invalid phone format", description: "Use format: 254XXXXXXXXX (12 digits)", variant: "destructive" });
      return;
    }

    setSaving(true);
    const updateData: any = {
      username: username.trim(),
      bio: bio.trim(),
      avatar_url: avatarUrl || null,
    };

    // Only allow setting phone if not already set
    if (!phoneAlreadySet && cleanedPhone) {
      updateData.phone_number = cleanedPhone;
    }

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id);

    if (error) {
      const msg = error.message?.includes("idx_profiles_phone_number_unique")
        ? "This phone number is already linked to another account"
        : error.message;
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } else {
      toast({ title: "Profile updated! ✨" });
      onSaved({ ...profile, ...updateData });
    }
    setSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
    >
      <SpotlightCard className="mb-8" spotlightColor="rgba(120, 255, 120, 0.1)">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold tracking-wider">Edit Profile</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <Avatar className="h-24 w-24 ring-4 ring-border/50 group-hover:ring-primary/30 transition-all">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary font-display font-bold">
                  {(username || "?")[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-6 w-6 text-primary" />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <p className="text-[11px] text-muted-foreground">
              {uploading ? "Uploading..." : "Click to change avatar"}
            </p>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <Label className="text-xs">Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={30}
              placeholder="Your username"
              className="bg-background/50"
            />
            <p className="text-[11px] text-muted-foreground text-right">{username.length}/30</p>
          </div>

          {/* Phone Number */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <Phone className="h-3 w-3 text-primary" /> Phone Number
              {phoneAlreadySet && <Lock className="h-3 w-3 text-muted-foreground" />}
            </Label>
            {phoneAlreadySet ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border/30 bg-muted/20">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="font-display text-sm">
                  {profile.phone_number.slice(0, 3)}***{profile.phone_number.slice(-3)}
                </span>
                <span className="text-[10px] text-muted-foreground ml-auto">Contact admin to change</span>
              </div>
            ) : (
              <>
                <Input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, "").slice(0, 12))}
                  placeholder="254712345678"
                  className="bg-background/50 font-display"
                  maxLength={12}
                />
                <p className="text-[11px] text-muted-foreground">
                  Format: 254XXXXXXXXX · Required for withdrawals · Cannot be changed later
                </p>
              </>
            )}
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <Label className="text-xs">Bio</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="Tell us about yourself..."
              className="bg-background/50 resize-none"
            />
            <p className="text-[11px] text-muted-foreground text-right">{bio.length}/200</p>
          </div>

          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
            <Button onClick={handleSave} disabled={saving} className="w-full neon-glow font-display tracking-wider">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </motion.div>
        </div>
      </SpotlightCard>
    </motion.div>
  );
};

export default ProfileEdit;
