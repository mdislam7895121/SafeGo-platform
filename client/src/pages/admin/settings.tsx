import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Settings as SettingsIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";

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

interface AllSettings {
  general: GeneralSettings;
  kyc: KYCSettings;
  commission: CommissionSettings;
  settlement: SettlementSettings;
  notifications: NotificationSettings;
  security: SecuritySettings;
}

export default function AdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("general");

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

  // Initialize state when settings load
  if (settings && !general) {
    setGeneral(settings.general);
    setKyc(settings.kyc);
    setCommission(settings.commission);
    setSettlement(settings.settlement);
    setNotifications(settings.notifications);
    setSecurity(settings.security);
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

  if (isLoading || !general || !kyc || !commission || !settlement || !notifications || !security) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="general" data-testid="tab-general">General</TabsTrigger>
          <TabsTrigger value="kyc" data-testid="tab-kyc">KYC Rules</TabsTrigger>
          <TabsTrigger value="commission" data-testid="tab-commission">Commission</TabsTrigger>
          <TabsTrigger value="settlement" data-testid="tab-settlement">Settlement</TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
        </TabsList>

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
          <Card>
            <CardHeader>
              <CardTitle>Commission Settings</CardTitle>
              <CardDescription>
                Configure default commission rates and country-specific overrides
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
      </Tabs>
    </div>
  );
}
