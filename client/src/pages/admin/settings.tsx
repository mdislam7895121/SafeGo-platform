import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Settings as SettingsIcon, Palette, Sun, Moon, Monitor, Eye, Type, User } from "lucide-react";
import { ProfilePhotoUploader } from "@/components/ProfilePhotoUploader";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/contexts/ThemeContext";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// Types matching the backend
interface GeneralSettings {
  supportEmail: string;
  supportPhone: string;
  defaultCountry: "BD" | "US";
}

interface KYCSettings {
  driver: {
    BD: {
      requireProfilePhoto: boolean;
      requireNid: boolean;
      requirePostalCode: boolean;
      requireVehicleDocuments: boolean;
    };
    US: {
      requireProfilePhoto: boolean;
      requireDmvLicenseDocs: boolean;
      requireTlcLicenseDocsForNY: boolean;
      requireSsn: boolean;
    };
  };
  customer: {
    BD: {
      requireNid: boolean;
    };
    US: {
      requireSsn: boolean;
    };
  };
  restaurant: {
    BD: {
      requireBusinessLicense: boolean;
    };
    US: {
      requireBusinessLicense: boolean;
    };
  };
  documentExpiry: {
    warningDays: number;
    hardBlockOnExpiry: boolean;
  };
}

interface CommissionSettings {
  driver: {
    ride: {
      defaultCommissionPercent: number;
    };
    parcel: {
      defaultCommissionPercent: number;
    };
  };
  restaurant: {
    food: {
      defaultCommissionPercent: number;
    };
  };
  countryOverrides: {
    BD: {
      driverRideCommissionPercent: number | null;
      restaurantFoodCommissionPercent: number | null;
      driverParcelCommissionPercent: number | null;
    };
    US: {
      driverRideCommissionPercent: number | null;
      restaurantFoodCommissionPercent: number | null;
      driverParcelCommissionPercent: number | null;
    };
  };
}

interface SettlementSettings {
  driver: {
    cycle: "DAILY" | "WEEKLY" | "MONTHLY";
    minPayoutAmount: number;
  };
  restaurant: {
    cycle: "DAILY" | "WEEKLY" | "MONTHLY";
    minPayoutAmount: number;
  };
}

interface NotificationSettings {
  documentExpiry: {
    enabled: boolean;
    warningDays: number;
  };
  lowWalletBalance: {
    enabled: boolean;
    threshold: number;
  };
  fraudAlerts: {
    enabled: boolean;
  };
}

interface SecuritySettings {
  sessionTimeoutMinutes: number;
  forceMfaForSuperAdmin: boolean;
}

interface SupportSettings {
  maxMessageLength: number;
  maxAttachmentSizeMB: number;
  allowedMimeTypes: string;
  defaultPriority: "low" | "normal" | "high" | "urgent";
  autoAssignMode: "manual" | "round_robin";
  businessHoursEnabled: boolean;
  businessHoursStart: string;
  businessHoursEnd: string;
}

interface RoleWelcomeMessage {
  enabled: boolean;
  title: string;
  message: string;
  ctaText?: string;
  ctaHref?: string;
  variant: "default" | "primary" | "gradient";
}

interface WelcomeMessageSettings {
  customer: RoleWelcomeMessage;
  driver: RoleWelcomeMessage;
  restaurant: RoleWelcomeMessage;
  shop_partner: RoleWelcomeMessage;
  ticket_operator: RoleWelcomeMessage;
  admin: RoleWelcomeMessage;
}

interface AllSettings {
  general: GeneralSettings;
  kyc: KYCSettings;
  commission: CommissionSettings;
  settlement: SettlementSettings;
  notifications: NotificationSettings;
  security: SecuritySettings;
  support: SupportSettings;
  welcomeMessage: WelcomeMessageSettings;
}

const PRESET_OPTIONS = [
  { value: "default", label: "SafeGo Blue", description: "Default brand theme" },
  { value: "slate", label: "Slate", description: "Professional slate tones" },
  { value: "ocean", label: "Ocean", description: "Cool ocean blues" },
  { value: "forest", label: "Forest", description: "Earthy green theme" },
  { value: "sunset", label: "Sunset", description: "Warm sunset orange" },
] as const;

const ACCESSIBILITY_OPTIONS = [
  { value: "normal", label: "Standard", description: "Default text and contrast" },
  { value: "high-contrast", label: "High Contrast", description: "Enhanced visibility" },
  { value: "large-text", label: "Large Text", description: "Bigger fonts for readability" },
  { value: "high-contrast-large", label: "High Contrast + Large Text", description: "Maximum accessibility" },
] as const;

function ThemeSettingsTab() {
  const { theme, setTheme, adminPreset, setAdminPreset, accessibilityMode, setAccessibilityMode } = useTheme();

  return (
    <TabsContent value="theme" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Theme & Appearance
          </CardTitle>
          <CardDescription>
            Customize the admin dashboard appearance and accessibility settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Sun className="h-4 w-4" />
              Color Mode
            </h3>
            <RadioGroup
              value={theme}
              onValueChange={(value) => setTheme(value as "light" | "dark" | "system")}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              <Label
                htmlFor="theme-light"
                className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 cursor-pointer hover-elevate [&:has([data-state=checked])]:border-primary"
              >
                <RadioGroupItem value="light" id="theme-light" className="sr-only" />
                <Sun className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">Light</span>
              </Label>
              <Label
                htmlFor="theme-dark"
                className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 cursor-pointer hover-elevate [&:has([data-state=checked])]:border-primary"
              >
                <RadioGroupItem value="dark" id="theme-dark" className="sr-only" />
                <Moon className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">Dark</span>
              </Label>
              <Label
                htmlFor="theme-system"
                className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 cursor-pointer hover-elevate [&:has([data-state=checked])]:border-primary"
              >
                <RadioGroupItem value="system" id="theme-system" className="sr-only" />
                <Monitor className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">System</span>
              </Label>
            </RadioGroup>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Brand Theme
            </h3>
            <p className="text-sm text-muted-foreground">
              Choose a color preset for the admin interface
            </p>
            <RadioGroup
              value={adminPreset}
              onValueChange={(value) => setAdminPreset(value as any)}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            >
              {PRESET_OPTIONS.map((preset) => (
                <Label
                  key={preset.value}
                  htmlFor={`preset-${preset.value}`}
                  className="flex items-start gap-3 rounded-md border-2 border-muted bg-popover p-3 cursor-pointer hover-elevate [&:has([data-state=checked])]:border-primary"
                >
                  <RadioGroupItem value={preset.value} id={`preset-${preset.value}`} className="mt-1" />
                  <div>
                    <span className="text-sm font-medium">{preset.label}</span>
                    <p className="text-xs text-muted-foreground">{preset.description}</p>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Accessibility
            </h3>
            <p className="text-sm text-muted-foreground">
              Adjust visual settings for improved readability
            </p>
            <RadioGroup
              value={accessibilityMode}
              onValueChange={(value) => setAccessibilityMode(value as any)}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {ACCESSIBILITY_OPTIONS.map((option) => (
                <Label
                  key={option.value}
                  htmlFor={`a11y-${option.value}`}
                  className="flex items-start gap-3 rounded-md border-2 border-muted bg-popover p-3 cursor-pointer hover-elevate [&:has([data-state=checked])]:border-primary"
                >
                  <RadioGroupItem value={option.value} id={`a11y-${option.value}`} className="mt-1" />
                  <div>
                    <span className="text-sm font-medium flex items-center gap-2">
                      {option.value.includes("large") && <Type className="h-3 w-3" />}
                      {option.label}
                    </span>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </div>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Theme preferences are stored locally and will persist across sessions.
            </p>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

function ProfileTabContent() {
  const { user } = useAuth();
  const adminName = user?.email?.split("@")[0] || "Admin";
  
  const { data: adminProfile } = useQuery({
    queryKey: ["/api/admin/home"],
  });

  const profile = (adminProfile as any)?.admin;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          My Profile
        </CardTitle>
        <CardDescription>
          Manage your admin profile photo and personal settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start gap-6">
          <ProfilePhotoUploader
            currentPhotoUrl={profile?.profilePhotoUrl}
            currentThumbnailUrl={profile?.profilePhotoThumbnail}
            userName={adminName}
            role="admin"
            size="xl"
          />
          <div className="space-y-2">
            <h3 className="font-medium">{adminName}</h3>
            <p className="text-sm text-muted-foreground">{user?.email || "Administrator"}</p>
            <p className="text-xs text-muted-foreground mt-4">
              Upload a profile photo. Maximum size: 5MB. Formats: JPEG, PNG, WebP
            </p>
          </div>
        </div>
        <Separator />
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Your profile photo will be visible to other administrators in the system.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("profile");

  // Fetch all settings
  const { data: settings, isLoading } = useQuery<AllSettings>({
    queryKey: ["/api/admin/settings"],
  });

  // State for each section (initialized from settings)
  const [general, setGeneral] = useState<GeneralSettings | null>(null);
  const [kyc, setKyc] = useState<KYCSettings | null>(null);
  const [commission, setCommission] = useState<CommissionSettings | null>(null);
  const [settlement, setSettlement] = useState<SettlementSettings | null>(null);
  const [notifications, setNotifications] = useState<NotificationSettings | null>(null);
  const [security, setSecurity] = useState<SecuritySettings | null>(null);
  const [support, setSupport] = useState<SupportSettings | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState<WelcomeMessageSettings | null>(null);

  // Initialize state when settings load
  if (settings && !general) {
    setGeneral(settings.general);
    setKyc(settings.kyc);
    setCommission(settings.commission);
    setSettlement(settings.settlement);
    setNotifications(settings.notifications);
    setSecurity(settings.security);
    // Set support with defaults if not provided by API
    setSupport(settings.support || {
      maxMessageLength: 2000,
      maxAttachmentSizeMB: 10,
      allowedMimeTypes: "image/jpeg,image/png,application/pdf",
      defaultPriority: "normal",
      autoAssignMode: "manual",
      businessHoursEnabled: false,
      businessHoursStart: "09:00",
      businessHoursEnd: "17:00",
    });
    // Set welcome message settings
    setWelcomeMessage(settings.welcomeMessage);
  }

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ section, data }: { section: string; data: any }) => {
      return apiRequest(`/api/admin/settings/${section}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({
        title: "Settings Updated",
        description: `${variables.section} settings have been saved successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const handleSaveGeneral = () => {
    if (general) {
      updateMutation.mutate({ section: "general", data: general });
    }
  };

  const handleSaveKYC = () => {
    if (kyc) {
      updateMutation.mutate({ section: "kyc", data: kyc });
    }
  };

  const handleSaveCommission = () => {
    if (commission) {
      updateMutation.mutate({ section: "commission", data: commission });
    }
  };

  const handleSaveSettlement = () => {
    if (settlement) {
      updateMutation.mutate({ section: "settlement", data: settlement });
    }
  };

  const handleSaveNotifications = () => {
    if (notifications) {
      updateMutation.mutate({ section: "notifications", data: notifications });
    }
  };

  const handleSaveSecurity = () => {
    if (security) {
      updateMutation.mutate({ section: "security", data: security });
    }
  };

  const handleSaveSupport = () => {
    if (support) {
      updateMutation.mutate({ section: "support", data: support });
    }
  };

  const handleSaveWelcomeMessage = () => {
    if (welcomeMessage) {
      updateMutation.mutate({ section: "welcomeMessage", data: welcomeMessage });
    }
  };

  if (isLoading || !general || !kyc || !commission || !settlement || !notifications || !security) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  // Support may not exist yet, use defaults if null
  const supportSettings = support || {
    maxMessageLength: 2000,
    maxAttachmentSizeMB: 10,
    allowedMimeTypes: "image/jpeg,image/png,application/pdf",
    defaultPriority: "normal" as const,
    autoAssignMode: "manual" as const,
    businessHoursEnabled: false,
    businessHoursStart: "09:00",
    businessHoursEnd: "17:00",
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <SettingsIcon className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Global Settings</h1>
        </div>
        <p className="text-muted-foreground">
          Manage platform-wide configuration for SafeGo.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="inline-flex w-full overflow-x-auto overflow-y-hidden gap-1 justify-start">
          <TabsTrigger value="profile" data-testid="tab-profile" className="whitespace-nowrap flex-shrink-0">My Profile</TabsTrigger>
          <TabsTrigger value="general" data-testid="tab-general" className="whitespace-nowrap flex-shrink-0">General</TabsTrigger>
          <TabsTrigger value="theme" data-testid="tab-theme" className="whitespace-nowrap flex-shrink-0">Theme</TabsTrigger>
          <TabsTrigger value="kyc" data-testid="tab-kyc" className="whitespace-nowrap flex-shrink-0">KYC Rules</TabsTrigger>
          <TabsTrigger value="commission" data-testid="tab-commission" className="whitespace-nowrap flex-shrink-0">Commission</TabsTrigger>
          <TabsTrigger value="tax" data-testid="tab-tax" className="whitespace-nowrap flex-shrink-0">Tax & Fees</TabsTrigger>
          <TabsTrigger value="settlement" data-testid="tab-settlement" className="whitespace-nowrap flex-shrink-0">Settlement</TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications" className="whitespace-nowrap flex-shrink-0">Notifications</TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security" className="whitespace-nowrap flex-shrink-0">Security</TabsTrigger>
          <TabsTrigger value="support" data-testid="tab-support" className="whitespace-nowrap flex-shrink-0">Support</TabsTrigger>
          <TabsTrigger value="welcomeMessage" data-testid="tab-welcome-message" className="whitespace-nowrap flex-shrink-0">Welcome Message</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <ProfileTabContent />
        </TabsContent>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Configure general platform settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="supportEmail">Support Email</Label>
                <Input
                  id="supportEmail"
                  data-testid="input-supportEmail"
                  value={general.supportEmail}
                  onChange={(e) => setGeneral({ ...general, supportEmail: e.target.value })}
                  placeholder="support@safego.test"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supportPhone">Support Phone</Label>
                <Input
                  id="supportPhone"
                  data-testid="input-supportPhone"
                  value={general.supportPhone}
                  onChange={(e) => setGeneral({ ...general, supportPhone: e.target.value })}
                  placeholder="+1234567890"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultCountry">Default Country</Label>
                <Select
                  value={general.defaultCountry}
                  onValueChange={(value: "BD" | "US") => setGeneral({ ...general, defaultCountry: value })}
                >
                  <SelectTrigger data-testid="select-defaultCountry">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BD">Bangladesh (BD)</SelectItem>
                    <SelectItem value="US">United States (US)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleSaveGeneral}
                disabled={updateMutation.isPending}
                data-testid="button-save-general"
              >
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save General Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Theme Tab */}
        <ThemeSettingsTab />

        {/* KYC Tab */}
        <TabsContent value="kyc" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>KYC Rules</CardTitle>
              <CardDescription>
                Configure identity verification requirements per role and country
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Driver KYC */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Driver KYC Requirements</h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Bangladesh (BD)</h4>
                    <div className="space-y-2 ml-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="driver-bd-profile"
                          checked={kyc.driver.BD.requireProfilePhoto}
                          onCheckedChange={(checked) =>
                            setKyc({
                              ...kyc,
                              driver: {
                                ...kyc.driver,
                                BD: { ...kyc.driver.BD, requireProfilePhoto: checked as boolean },
                              },
                            })
                          }
                        />
                        <Label htmlFor="driver-bd-profile">Require Profile Photo</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="driver-bd-nid"
                          checked={kyc.driver.BD.requireNid}
                          onCheckedChange={(checked) =>
                            setKyc({
                              ...kyc,
                              driver: {
                                ...kyc.driver,
                                BD: { ...kyc.driver.BD, requireNid: checked as boolean },
                              },
                            })
                          }
                        />
                        <Label htmlFor="driver-bd-nid">Require NID</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="driver-bd-postal"
                          checked={kyc.driver.BD.requirePostalCode}
                          onCheckedChange={(checked) =>
                            setKyc({
                              ...kyc,
                              driver: {
                                ...kyc.driver,
                                BD: { ...kyc.driver.BD, requirePostalCode: checked as boolean },
                              },
                            })
                          }
                        />
                        <Label htmlFor="driver-bd-postal">Require Postal Code</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="driver-bd-vehicle"
                          checked={kyc.driver.BD.requireVehicleDocuments}
                          onCheckedChange={(checked) =>
                            setKyc({
                              ...kyc,
                              driver: {
                                ...kyc.driver,
                                BD: { ...kyc.driver.BD, requireVehicleDocuments: checked as boolean },
                              },
                            })
                          }
                        />
                        <Label htmlFor="driver-bd-vehicle">Require Vehicle Documents</Label>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-2">United States (US)</h4>
                    <div className="space-y-2 ml-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="driver-us-profile"
                          checked={kyc.driver.US.requireProfilePhoto}
                          onCheckedChange={(checked) =>
                            setKyc({
                              ...kyc,
                              driver: {
                                ...kyc.driver,
                                US: { ...kyc.driver.US, requireProfilePhoto: checked as boolean },
                              },
                            })
                          }
                        />
                        <Label htmlFor="driver-us-profile">Require Profile Photo</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="driver-us-dmv"
                          checked={kyc.driver.US.requireDmvLicenseDocs}
                          onCheckedChange={(checked) =>
                            setKyc({
                              ...kyc,
                              driver: {
                                ...kyc.driver,
                                US: { ...kyc.driver.US, requireDmvLicenseDocs: checked as boolean },
                              },
                            })
                          }
                        />
                        <Label htmlFor="driver-us-dmv">Require DMV License Documents</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="driver-us-tlc"
                          checked={kyc.driver.US.requireTlcLicenseDocsForNY}
                          onCheckedChange={(checked) =>
                            setKyc({
                              ...kyc,
                              driver: {
                                ...kyc.driver,
                                US: { ...kyc.driver.US, requireTlcLicenseDocsForNY: checked as boolean },
                              },
                            })
                          }
                        />
                        <Label htmlFor="driver-us-tlc">Require TLC License for NY</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="driver-us-ssn"
                          checked={kyc.driver.US.requireSsn}
                          onCheckedChange={(checked) =>
                            setKyc({
                              ...kyc,
                              driver: {
                                ...kyc.driver,
                                US: { ...kyc.driver.US, requireSsn: checked as boolean },
                              },
                            })
                          }
                        />
                        <Label htmlFor="driver-us-ssn">Require SSN</Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Document Expiry */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Document Expiry Settings</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="warningDays">Warning Days Before Expiry</Label>
                    <Input
                      id="warningDays"
                      type="number"
                      min="1"
                      max="365"
                      value={kyc.documentExpiry.warningDays}
                      onChange={(e) =>
                        setKyc({
                          ...kyc,
                          documentExpiry: {
                            ...kyc.documentExpiry,
                            warningDays: parseInt(e.target.value) || 30,
                          },
                        })
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      Number of days before document expiry to send warning notifications (1-365)
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hardBlockOnExpiry"
                      checked={kyc.documentExpiry.hardBlockOnExpiry}
                      onCheckedChange={(checked) =>
                        setKyc({
                          ...kyc,
                          documentExpiry: {
                            ...kyc.documentExpiry,
                            hardBlockOnExpiry: checked as boolean,
                          },
                        })
                      }
                    />
                    <Label htmlFor="hardBlockOnExpiry">Hard Block on Expiry</Label>
                  </div>
                  <p className="text-sm text-muted-foreground ml-6">
                    When enabled, prevents KYC approval and certain actions for users with expired documents
                  </p>
                </div>
              </div>

              <Button
                onClick={handleSaveKYC}
                disabled={updateMutation.isPending}
                data-testid="button-save-kyc"
              >
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save KYC Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commission Tab */}
        <TabsContent value="commission" className="space-y-4">
          {/* SafeGo Official Commission Rates - Read Only Info Card */}
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <SettingsIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                SafeGo Official Commission Rates (System Defaults)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                These are the official commission rates applied when no admin override is set:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-700 dark:text-blue-300">Bangladesh (BD)</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li data-testid="text-bd-restaurant-commission">Restaurant: <span className="font-medium text-foreground">12%</span></li>
                    <li data-testid="text-bd-driver-commission">Driver: <span className="font-medium text-foreground">10%</span></li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-700 dark:text-blue-300">United States (US)</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li data-testid="text-us-restaurant-commission">Restaurant: <span className="font-medium text-foreground">15%</span></li>
                    <li data-testid="text-us-driver-commission">Driver: <span className="font-medium text-foreground">10%</span></li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Commission Settings</CardTitle>
              <CardDescription>
                Configure default commission rates and country-specific overrides. Values set here override the official rates above.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Default Commission Rates (%)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Driver Ride Commission</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={commission.driver.ride.defaultCommissionPercent}
                      onChange={(e) =>
                        setCommission({
                          ...commission,
                          driver: {
                            ...commission.driver,
                            ride: { defaultCommissionPercent: parseFloat(e.target.value) || 0 },
                          },
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Driver Parcel Commission</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={commission.driver.parcel.defaultCommissionPercent}
                      onChange={(e) =>
                        setCommission({
                          ...commission,
                          driver: {
                            ...commission.driver,
                            parcel: { defaultCommissionPercent: parseFloat(e.target.value) || 0 },
                          },
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Restaurant Food Commission</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={commission.restaurant.food.defaultCommissionPercent}
                      onChange={(e) =>
                        setCommission({
                          ...commission,
                          restaurant: {
                            ...commission.restaurant,
                            food: { defaultCommissionPercent: parseFloat(e.target.value) || 0 },
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">Country Overrides (Optional)</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Leave blank to use default rates. Enter a value to override for specific country.
                </p>

                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-2">Bangladesh (BD)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Driver Ride %</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="Use default"
                          value={commission.countryOverrides.BD.driverRideCommissionPercent ?? ""}
                          onChange={(e) =>
                            setCommission({
                              ...commission,
                              countryOverrides: {
                                ...commission.countryOverrides,
                                BD: {
                                  ...commission.countryOverrides.BD,
                                  driverRideCommissionPercent: e.target.value ? parseFloat(e.target.value) : null,
                                },
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Restaurant Food %</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="Use default"
                          value={commission.countryOverrides.BD.restaurantFoodCommissionPercent ?? ""}
                          onChange={(e) =>
                            setCommission({
                              ...commission,
                              countryOverrides: {
                                ...commission.countryOverrides,
                                BD: {
                                  ...commission.countryOverrides.BD,
                                  restaurantFoodCommissionPercent: e.target.value ? parseFloat(e.target.value) : null,
                                },
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Driver Parcel %</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="Use default"
                          value={commission.countryOverrides.BD.driverParcelCommissionPercent ?? ""}
                          onChange={(e) =>
                            setCommission({
                              ...commission,
                              countryOverrides: {
                                ...commission.countryOverrides,
                                BD: {
                                  ...commission.countryOverrides.BD,
                                  driverParcelCommissionPercent: e.target.value ? parseFloat(e.target.value) : null,
                                },
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">United States (US)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Driver Ride %</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="Use default"
                          value={commission.countryOverrides.US.driverRideCommissionPercent ?? ""}
                          onChange={(e) =>
                            setCommission({
                              ...commission,
                              countryOverrides: {
                                ...commission.countryOverrides,
                                US: {
                                  ...commission.countryOverrides.US,
                                  driverRideCommissionPercent: e.target.value ? parseFloat(e.target.value) : null,
                                },
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Restaurant Food %</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="Use default"
                          value={commission.countryOverrides.US.restaurantFoodCommissionPercent ?? ""}
                          onChange={(e) =>
                            setCommission({
                              ...commission,
                              countryOverrides: {
                                ...commission.countryOverrides,
                                US: {
                                  ...commission.countryOverrides.US,
                                  restaurantFoodCommissionPercent: e.target.value ? parseFloat(e.target.value) : null,
                                },
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Driver Parcel %</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="Use default"
                          value={commission.countryOverrides.US.driverParcelCommissionPercent ?? ""}
                          onChange={(e) =>
                            setCommission({
                              ...commission,
                              countryOverrides: {
                                ...commission.countryOverrides,
                                US: {
                                  ...commission.countryOverrides.US,
                                  driverParcelCommissionPercent: e.target.value ? parseFloat(e.target.value) : null,
                                },
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSaveCommission}
                disabled={updateMutation.isPending}
                data-testid="button-save-commission"
              >
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Commission Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settlement Tab */}
        <TabsContent value="settlement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Settlement Settings</CardTitle>
              <CardDescription>
                Configure payout cycles and minimum amounts for drivers and restaurants
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Driver Settlement</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Settlement Cycle</Label>
                    <Select
                      value={settlement.driver.cycle}
                      onValueChange={(value: "DAILY" | "WEEKLY" | "MONTHLY") =>
                        setSettlement({
                          ...settlement,
                          driver: { ...settlement.driver, cycle: value },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Minimum Payout Amount</Label>
                    <Input
                      type="number"
                      min="0"
                      value={settlement.driver.minPayoutAmount}
                      onChange={(e) =>
                        setSettlement({
                          ...settlement,
                          driver: {
                            ...settlement.driver,
                            minPayoutAmount: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">Restaurant Settlement</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Settlement Cycle</Label>
                    <Select
                      value={settlement.restaurant.cycle}
                      onValueChange={(value: "DAILY" | "WEEKLY" | "MONTHLY") =>
                        setSettlement({
                          ...settlement,
                          restaurant: { ...settlement.restaurant, cycle: value },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Minimum Payout Amount</Label>
                    <Input
                      type="number"
                      min="0"
                      value={settlement.restaurant.minPayoutAmount}
                      onChange={(e) =>
                        setSettlement({
                          ...settlement,
                          restaurant: {
                            ...settlement.restaurant,
                            minPayoutAmount: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSaveSettlement}
                disabled={updateMutation.isPending}
                data-testid="button-save-settlement"
              >
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Settlement Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Configure notification triggers and thresholds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Document Expiry Notifications</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="docExpiry-enabled"
                      checked={notifications.documentExpiry.enabled}
                      onCheckedChange={(checked) =>
                        setNotifications({
                          ...notifications,
                          documentExpiry: {
                            ...notifications.documentExpiry,
                            enabled: checked as boolean,
                          },
                        })
                      }
                    />
                    <Label htmlFor="docExpiry-enabled">Enable Document Expiry Notifications</Label>
                  </div>

                  <div className="space-y-2">
                    <Label>Warning Days Before Expiry</Label>
                    <Input
                      type="number"
                      min="1"
                      max="365"
                      value={notifications.documentExpiry.warningDays}
                      onChange={(e) =>
                        setNotifications({
                          ...notifications,
                          documentExpiry: {
                            ...notifications.documentExpiry,
                            warningDays: parseInt(e.target.value) || 30,
                          },
                        })
                      }
                      disabled={!notifications.documentExpiry.enabled}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">Low Wallet Balance Notifications</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="lowWallet-enabled"
                      checked={notifications.lowWalletBalance.enabled}
                      onCheckedChange={(checked) =>
                        setNotifications({
                          ...notifications,
                          lowWalletBalance: {
                            ...notifications.lowWalletBalance,
                            enabled: checked as boolean,
                          },
                        })
                      }
                    />
                    <Label htmlFor="lowWallet-enabled">Enable Low Wallet Balance Notifications</Label>
                  </div>

                  <div className="space-y-2">
                    <Label>Alert Threshold Amount</Label>
                    <Input
                      type="number"
                      min="0"
                      value={notifications.lowWalletBalance.threshold}
                      onChange={(e) =>
                        setNotifications({
                          ...notifications,
                          lowWalletBalance: {
                            ...notifications.lowWalletBalance,
                            threshold: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      disabled={!notifications.lowWalletBalance.enabled}
                    />
                    <p className="text-sm text-muted-foreground">
                      Configuration only. Implementation may be added in future releases.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">Fraud Alerts</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="fraud-enabled"
                      checked={notifications.fraudAlerts.enabled}
                      onCheckedChange={(checked) =>
                        setNotifications({
                          ...notifications,
                          fraudAlerts: { enabled: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="fraud-enabled">Enable Fraud Alert Notifications</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Configuration only. Implementation may be added in future releases.
                  </p>
                </div>
              </div>

              <Button
                onClick={handleSaveNotifications}
                disabled={updateMutation.isPending}
                data-testid="button-save-notifications"
              >
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Notification Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Configure authentication and security policies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Session Timeout (minutes)</Label>
                <Input
                  type="number"
                  min="5"
                  max="1440"
                  value={security.sessionTimeoutMinutes}
                  onChange={(e) =>
                    setSecurity({
                      ...security,
                      sessionTimeoutMinutes: parseInt(e.target.value) || 480,
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Session timeout for admin users (5-1440 minutes)
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="forceMfa"
                    checked={security.forceMfaForSuperAdmin}
                    onCheckedChange={(checked) =>
                      setSecurity({ ...security, forceMfaForSuperAdmin: checked as boolean })
                    }
                  />
                  <Label htmlFor="forceMfa">Force MFA for Super Admins</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Configuration only. MFA enforcement may be implemented in future releases.
                </p>
              </div>

              <Button
                onClick={handleSaveSecurity}
                disabled={updateMutation.isPending}
                data-testid="button-save-security"
              >
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Security Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Support Tab */}
        <TabsContent value="support" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Support Chat Settings</CardTitle>
              <CardDescription>
                Configure support chat system parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Max Message Length (characters)</Label>
                <Input
                  type="number"
                  min="100"
                  max="10000"
                  value={supportSettings.maxMessageLength}
                  onChange={(e) =>
                    setSupport({ ...supportSettings,
                      maxMessageLength: parseInt(e.target.value) || 2000,
                    })
                  }
                  data-testid="input-max-message-length"
                />
                <p className="text-sm text-muted-foreground">
                  Maximum characters allowed per message (100-10000)
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Max Attachment Size (MB)</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={supportSettings.maxAttachmentSizeMB}
                  onChange={(e) =>
                    setSupport({ ...supportSettings,
                      maxAttachmentSizeMB: parseInt(e.target.value) || 10,
                    })
                  }
                  data-testid="input-max-attachment-size"
                />
                <p className="text-sm text-muted-foreground">
                  Maximum file size for attachments (1-50 MB)
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Allowed MIME Types</Label>
                <Input
                  value={supportSettings.allowedMimeTypes}
                  onChange={(e) =>
                    setSupport({ ...supportSettings,
                      allowedMimeTypes: e.target.value,
                    })
                  }
                  placeholder="image/jpeg,image/png,application/pdf"
                  data-testid="input-allowed-mime-types"
                />
                <p className="text-sm text-muted-foreground">
                  Comma-separated list of allowed MIME types for attachments
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Default Priority for New Conversations</Label>
                <Select
                  value={supportSettings.defaultPriority}
                  onValueChange={(value: any) =>
                    setSupport({ ...supportSettings, defaultPriority: value })
                  }
                >
                  <SelectTrigger data-testid="select-default-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Default priority level for user-created support requests
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Auto-Assign Mode</Label>
                <Select
                  value={supportSettings.autoAssignMode}
                  onValueChange={(value: any) =>
                    setSupport({ ...supportSettings, autoAssignMode: value })
                  }
                >
                  <SelectTrigger data-testid="select-auto-assign-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="round_robin">Round Robin (Future)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  How conversations are assigned to support admins
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="business-hours-enabled"
                    checked={supportSettings.businessHoursEnabled}
                    onCheckedChange={(checked) =>
                      setSupport({ ...supportSettings, businessHoursEnabled: checked as boolean })
                    }
                    data-testid="checkbox-business-hours"
                  />
                  <Label htmlFor="business-hours-enabled">Enable Business Hours</Label>
                </div>
                {supportSettings.businessHoursEnabled && (
                  <div className="grid grid-cols-2 gap-4 ml-6">
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input
                        type="time"
                        value={supportSettings.businessHoursStart}
                        onChange={(e) =>
                          setSupport({ ...supportSettings, businessHoursStart: e.target.value })
                        }
                        data-testid="input-business-hours-start"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input
                        type="time"
                        value={supportSettings.businessHoursEnd}
                        onChange={(e) =>
                          setSupport({ ...supportSettings, businessHoursEnd: e.target.value })
                        }
                        data-testid="input-business-hours-end"
                      />
                    </div>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Optional: Set business hours for support availability (stored for future use)
                </p>
              </div>

              <Button
                onClick={handleSaveSupport}
                disabled={updateMutation.isPending}
                data-testid="button-save-support"
              >
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Support Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tax & Fees Tab */}
        <TabsContent value="tax" className="space-y-4">
          <TaxFeesManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Tax & Fees Management Component
function TaxFeesManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  
  //Fetch tax rules
  const { data: taxData, isLoading } = useQuery({
    queryKey: ["/api/admin/tax"],
  });
  
  const taxRules = taxData?.taxRules || [];
  
  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/tax/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tax"] });
      toast({
        title: "Tax Rule Deleted",
        description: "The tax rule has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete tax rule",
        variant: "destructive",
      });
    },
  });
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tax & Fees Configuration (Uber-Style)</CardTitle>
              <CardDescription>
                Configure tax rules for different services and jurisdictions with simple stacking calculation
              </CardDescription>
            </div>
            <Button
              onClick={() => setIsCreating(true)}
              data-testid="button-create-tax-rule"
            >
              Add Tax Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {taxRules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tax rules configured yet. Click "Add Tax Rule" to create one.
            </div>
          ) : (
            <div className="space-y-2">
              {taxRules.map((rule: any) => {
                const taxLabel = rule.taxType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
                const percentPart = rule.percentRate ? `${rule.percentRate}%` : null;
                const flatPart = rule.flatFee ? `$${rule.flatFee}` : null;
                const taxDetails = [percentPart, flatPart].filter(Boolean).join(' + ');
                
                return (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                    data-testid={`tax-rule-${rule.id}`}
                  >
                    <div className="flex-1">
                      <div className="font-semibold">{taxLabel}</div>
                      <div className="text-sm text-muted-foreground">
                        {taxDetails} • {rule.serviceType} • {rule.isActive ? 'Active' : 'Inactive'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {rule.countryCode}
                        {rule.cityCode && ` / ${rule.cityCode}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingRule(rule)}
                        data-testid={`button-edit-${rule.id}`}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteMutation.mutate(rule.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${rule.id}`}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Create/Edit Dialog */}
      {(isCreating || editingRule) && (
        <TaxRuleDialog
          rule={editingRule}
          onClose={() => {
            setIsCreating(false);
            setEditingRule(null);
          }}
        />
      )}
    </div>
  );
}

// Tax Rule Dialog Component
function TaxRuleDialog({ rule, onClose }: { rule: any; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!rule;
  
  const [formData, setFormData] = useState({
    countryCode: rule?.countryCode || "US",
    cityCode: rule?.cityCode || "",
    taxType: rule?.taxType || "VAT",
    serviceType: rule?.serviceType || "RIDE",
    percentRate: rule?.percentRate || "",
    flatFee: rule?.flatFee || "",
    isActive: rule?.isActive ?? true,
  });
  
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = isEditing ? `/api/admin/tax/${rule.id}` : "/api/admin/tax";
      const method = isEditing ? "PATCH" : "POST";
      return apiRequest(url, {
        method,
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tax"] });
      toast({
        title: isEditing ? "Tax Rule Updated" : "Tax Rule Created",
        description: `The tax rule has been ${isEditing ? "updated" : "created"} successfully.`,
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEditing ? "update" : "create"} tax rule`,
        variant: "destructive",
      });
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate at least one of percentRate or flatFee is provided
    if (!formData.percentRate && !formData.flatFee) {
      toast({
        title: "Validation Error",
        description: "At least one of Percent Rate or Flat Fee must be provided",
        variant: "destructive",
      });
      return;
    }
    
    const submitData: any = {
      countryCode: formData.countryCode,
      cityCode: formData.cityCode || null,
      taxType: formData.taxType,
      serviceType: formData.serviceType,
      isActive: formData.isActive,
    };
    
    if (formData.percentRate) {
      submitData.percentRate = parseFloat(formData.percentRate);
    }
    if (formData.flatFee) {
      submitData.flatFee = parseFloat(formData.flatFee);
    }
    
    saveMutation.mutate(submitData);
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>{isEditing ? "Edit" : "Create"} Tax Rule (Uber-Style)</CardTitle>
          <CardDescription>
            Configure tax rates with simple stacking calculation: taxAmount = baseFare * (percentRate/100) + flatFee
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tax Type *</Label>
                <Select
                  value={formData.taxType}
                  onValueChange={(value) => setFormData({ ...formData, taxType: value })}
                >
                  <SelectTrigger data-testid="select-tax-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VAT">VAT</SelectItem>
                    <SelectItem value="SALES_TAX">Sales Tax</SelectItem>
                    <SelectItem value="GOVERNMENT_SERVICE_FEE">Government Service Fee</SelectItem>
                    <SelectItem value="MARKETPLACE_FACILITATOR_TAX">Marketplace Facilitator Tax</SelectItem>
                    <SelectItem value="TRIP_FEE">Trip Fee</SelectItem>
                    <SelectItem value="LOCAL_MUNICIPALITY_FEE">Local Municipality Fee</SelectItem>
                    <SelectItem value="REGULATORY_FEE">Regulatory Fee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Service Type *</Label>
                <Select
                  value={formData.serviceType}
                  onValueChange={(value) => setFormData({ ...formData, serviceType: value })}
                >
                  <SelectTrigger data-testid="select-service-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RIDE">Ride</SelectItem>
                    <SelectItem value="FOOD">Food Delivery</SelectItem>
                    <SelectItem value="PARCEL">Parcel Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="percentRate">Percent Rate (%) (Optional)</Label>
                <Input
                  id="percentRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.percentRate}
                  onChange={(e) => setFormData({ ...formData, percentRate: e.target.value })}
                  placeholder="e.g., 10.5"
                  data-testid="input-percent-rate"
                />
                <p className="text-xs text-muted-foreground">
                  Percentage of base fare
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="flatFee">Flat Fee ($) (Optional)</Label>
                <Input
                  id="flatFee"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.flatFee}
                  onChange={(e) => setFormData({ ...formData, flatFee: e.target.value })}
                  placeholder="e.g., 2.50"
                  data-testid="input-flat-fee"
                />
                <p className="text-xs text-muted-foreground">
                  Fixed amount per transaction
                </p>
              </div>
            </div>
            
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-medium">At least one of Percent Rate or Flat Fee must be provided</p>
              <p className="text-xs text-muted-foreground mt-1">
                Example: 10% + $2.50 → taxAmount = baseFare * 0.10 + 2.50
              </p>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Country *</Label>
                <Select
                  value={formData.countryCode}
                  onValueChange={(value) => setFormData({ ...formData, countryCode: value })}
                >
                  <SelectTrigger data-testid="select-country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="BD">Bangladesh</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cityCode">City (Optional)</Label>
                <Input
                  id="cityCode"
                  value={formData.cityCode}
                  onChange={(e) => setFormData({ ...formData, cityCode: e.target.value })}
                  placeholder="e.g., NYC, LA, DHK"
                  data-testid="input-city-code"
                />
                <p className="text-xs text-muted-foreground">
                  City rules override country rules
                </p>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked as boolean })}
                  data-testid="checkbox-active"
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
              <p className="text-sm text-muted-foreground ml-6">
                Only active rules will be applied to transactions
              </p>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                data-testid="button-save-tax-rule"
              >
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Update" : "Create"} Tax Rule
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
