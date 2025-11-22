import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function TaxInfoEdit() {
  const { toast } = useToast();
  const [_, navigate] = useLocation();

  const { data: driverData, isLoading } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const profile = (driverData as any)?.profile;
  const countryCode = profile?.countryCode || "US";

  // Form state
  const [fullLegalName, setFullLegalName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [taxClassification, setTaxClassification] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [w9Status, setW9Status] = useState("");

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form when data loads
  useEffect(() => {
    if (profile) {
      setFullLegalName(profile.usaFullLegalName || `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "");
      setTaxId(profile.ssnMasked || profile.nidNumber || "");
      setTaxClassification(profile.taxClassification || "");
      setStreet(profile.usaStreet || "");
      setCity(profile.usaCity || "");
      setState(profile.usaState || "");
      setPostalCode(profile.usaZipCode || "");
      setW9Status(profile.w9Status || "pending");
    }
  }, [profile]);

  const updateTaxInfoMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/driver/tax-info", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("safego_token")}`,
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update tax information");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
      toast({
        title: "Success",
        description: "Tax information updated successfully",
      });
      navigate("/driver/account/tax-info");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update tax information",
        variant: "destructive",
      });
    },
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!fullLegalName.trim()) {
      newErrors.fullLegalName = "Full legal name is required";
    }

    if (!taxId.trim()) {
      newErrors.taxId = "Tax ID is required";
    } else if (countryCode === "US") {
      // Validate SSN format (with or without dashes)
      const cleaned = taxId.replace(/\D/g, "");
      if (cleaned.length !== 9 && !taxId.includes("*")) {
        newErrors.taxId = "Tax ID must be 9 digits (XXX-XX-XXXX)";
      }
    }

    if (!taxClassification) {
      newErrors.taxClassification = "Tax classification is required";
    }

    if (!street.trim()) {
      newErrors.street = "Street address is required";
    }

    if (!city.trim()) {
      newErrors.city = "City is required";
    }

    if (!state.trim()) {
      newErrors.state = "State/Region is required";
    }

    if (!postalCode.trim()) {
      newErrors.postalCode = "Postal code is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields correctly",
        variant: "destructive",
      });
      return;
    }

    // Only send SSN if it's not masked (new entry or being edited)
    const dataToSend: any = {
      fullLegalName,
      taxClassification,
      street,
      city,
      state,
      postalCode,
      w9Status,
    };

    // Only include taxId if it's not masked (user entered a new value)
    if (taxId && !taxId.includes("*")) {
      dataToSend.taxId = taxId;
    }

    updateTaxInfoMutation.mutate(dataToSend);
  };

  const handleCancel = () => {
    navigate("/driver/account/tax-info");
  };

  if (isLoading) {
    return <div className="bg-background min-h-screen p-6">Loading...</div>;
  }

  // Format tax ID display (mask if it's a saved SSN)
  const displayTaxId = taxId.includes("*") ? taxId : taxId;

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/driver/account/tax-info">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-primary-foreground hover:bg-primary-foreground/10" 
              data-testid="button-back"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Edit Tax Information</h1>
            <p className="text-sm opacity-90 mt-1">Update your taxpayer details</p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Taxpayer Information</CardTitle>
            <CardDescription>
              All fields are required for tax reporting compliance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Country (Read-only) */}
            <div className="space-y-2">
              <Label>Country</Label>
              <Input
                value={countryCode === "BD" ? "Bangladesh" : "United States"}
                disabled
                className="bg-muted"
                data-testid="input-country"
              />
              <p className="text-xs text-muted-foreground">
                Based on your driver profile
              </p>
            </div>

            {/* Full Legal Name */}
            <div className="space-y-2">
              <Label htmlFor="fullLegalName">
                Full Legal Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fullLegalName"
                value={fullLegalName}
                onChange={(e) => {
                  setFullLegalName(e.target.value);
                  if (errors.fullLegalName) {
                    setErrors({ ...errors, fullLegalName: "" });
                  }
                }}
                placeholder="Enter your full legal name"
                data-testid="input-full-legal-name"
                className={errors.fullLegalName ? "border-destructive" : ""}
              />
              {errors.fullLegalName && (
                <p className="text-sm text-destructive">{errors.fullLegalName}</p>
              )}
            </div>

            {/* Tax ID / SSN */}
            <div className="space-y-2">
              <Label htmlFor="taxId">
                {countryCode === "US" ? "Social Security Number (SSN)" : "Tax ID"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="taxId"
                value={displayTaxId}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow digits and dashes only
                  const cleaned = value.replace(/[^\d-]/g, "");
                  setTaxId(cleaned);
                  if (errors.taxId) {
                    setErrors({ ...errors, taxId: "" });
                  }
                }}
                placeholder={countryCode === "US" ? "XXX-XX-XXXX" : "Enter tax ID"}
                maxLength={11}
                data-testid="input-tax-id"
                className={errors.taxId ? "border-destructive" : ""}
              />
              {errors.taxId && (
                <p className="text-sm text-destructive">{errors.taxId}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {taxId.includes("*")
                  ? "Currently saved (masked for security)"
                  : "Enter your full tax ID number"}
              </p>
            </div>

            {/* Tax Classification */}
            <div className="space-y-2">
              <Label htmlFor="taxClassification">
                Tax Classification <span className="text-destructive">*</span>
              </Label>
              <Select
                value={taxClassification}
                onValueChange={(value) => {
                  setTaxClassification(value);
                  if (errors.taxClassification) {
                    setErrors({ ...errors, taxClassification: "" });
                  }
                }}
              >
                <SelectTrigger 
                  id="taxClassification" 
                  data-testid="select-tax-classification"
                  className={errors.taxClassification ? "border-destructive" : ""}
                >
                  <SelectValue placeholder="Select classification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="sole_proprietor">Sole Proprietor</SelectItem>
                  <SelectItem value="single_member_llc">Single-Member LLC</SelectItem>
                  <SelectItem value="partnership">Partnership</SelectItem>
                  <SelectItem value="corporation">Corporation</SelectItem>
                </SelectContent>
              </Select>
              {errors.taxClassification && (
                <p className="text-sm text-destructive">{errors.taxClassification}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Address Information</CardTitle>
            <CardDescription>Your permanent address for tax records</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Street Address */}
            <div className="space-y-2">
              <Label htmlFor="street">
                Street Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="street"
                value={street}
                onChange={(e) => {
                  setStreet(e.target.value);
                  if (errors.street) {
                    setErrors({ ...errors, street: "" });
                  }
                }}
                placeholder="Enter street address"
                data-testid="input-street"
                className={errors.street ? "border-destructive" : ""}
              />
              {errors.street && (
                <p className="text-sm text-destructive">{errors.street}</p>
              )}
            </div>

            {/* City */}
            <div className="space-y-2">
              <Label htmlFor="city">
                City <span className="text-destructive">*</span>
              </Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  if (errors.city) {
                    setErrors({ ...errors, city: "" });
                  }
                }}
                placeholder="Enter city"
                data-testid="input-city"
                className={errors.city ? "border-destructive" : ""}
              />
              {errors.city && (
                <p className="text-sm text-destructive">{errors.city}</p>
              )}
            </div>

            {/* State/Region */}
            <div className="space-y-2">
              <Label htmlFor="state">
                State/Region <span className="text-destructive">*</span>
              </Label>
              <Input
                id="state"
                value={state}
                onChange={(e) => {
                  setState(e.target.value);
                  if (errors.state) {
                    setErrors({ ...errors, state: "" });
                  }
                }}
                placeholder={countryCode === "US" ? "e.g., CA, NY, TX" : "Enter state/region"}
                data-testid="input-state"
                className={errors.state ? "border-destructive" : ""}
              />
              {errors.state && (
                <p className="text-sm text-destructive">{errors.state}</p>
              )}
            </div>

            {/* Postal Code */}
            <div className="space-y-2">
              <Label htmlFor="postalCode">
                Postal Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="postalCode"
                value={postalCode}
                onChange={(e) => {
                  setPostalCode(e.target.value);
                  if (errors.postalCode) {
                    setErrors({ ...errors, postalCode: "" });
                  }
                }}
                placeholder={countryCode === "US" ? "XXXXX or XXXXX-XXXX" : "Enter postal code"}
                data-testid="input-postal-code"
                className={errors.postalCode ? "border-destructive" : ""}
              />
              {errors.postalCode && (
                <p className="text-sm text-destructive">{errors.postalCode}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>W-9 Status</CardTitle>
            <CardDescription>Tax form submission status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="w9Status">W-9 Form Status</Label>
              <Select value={w9Status} onValueChange={setW9Status}>
                <SelectTrigger id="w9Status" data-testid="select-w9-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3 sticky bottom-0 bg-background py-4 border-t">
          <Button
            onClick={handleSave}
            disabled={updateTaxInfoMutation.isPending}
            className="flex-1"
            data-testid="button-save"
          >
            <Save className="h-4 w-4 mr-2" />
            {updateTaxInfoMutation.isPending ? "Saving..." : "Save Tax Information"}
          </Button>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={updateTaxInfoMutation.isPending}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
