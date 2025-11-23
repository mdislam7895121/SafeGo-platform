import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, Save, Palette, Eye } from "lucide-react";

interface RestaurantBranding {
  id: string;
  restaurantId: string;
  logoUrl: string | null;
  coverPhotoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  themeMode: string;
  createdAt: string;
  updatedAt: string;
}

export default function RestaurantBrandingPage() {
  const { toast } = useToast();
  
  const [logoUrl, setLogoUrl] = useState("");
  const [coverPhotoUrl, setCoverPhotoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [themeMode, setThemeMode] = useState<string>("light");

  // Fetch branding settings
  const { data: branding, isLoading } = useQuery<RestaurantBranding>({
    queryKey: ["/api/restaurant/branding"],
  });

  // Update state when branding data is loaded
  useEffect(() => {
    if (branding) {
      setLogoUrl(branding.logoUrl || "");
      setCoverPhotoUrl(branding.coverPhotoUrl || "");
      setPrimaryColor(branding.primaryColor || "");
      setSecondaryColor(branding.secondaryColor || "");
      setThemeMode(branding.themeMode || "light");
    }
  }, [branding]);

  // Update branding mutation
  const updateBrandingMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/restaurant/branding", {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/branding"] });
      toast({
        title: "Branding Updated",
        description: "Your branding settings have been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update branding settings",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data: any = {
      themeMode,
    };

    if (logoUrl) data.logoUrl = logoUrl;
    if (coverPhotoUrl) data.coverPhotoUrl = coverPhotoUrl;
    if (primaryColor) data.primaryColor = primaryColor;
    if (secondaryColor) data.secondaryColor = secondaryColor;

    updateBrandingMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Branding Settings</h1>
        <p className="text-muted-foreground">
          Customize your restaurant's visual identity and theme
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Logo & Cover Photo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Brand Assets
              </CardTitle>
              <CardDescription>
                Upload your restaurant logo and cover photo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="logoUrl">Restaurant Logo URL</Label>
                <Input
                  id="logoUrl"
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  data-testid="input-logo-url"
                />
                {logoUrl && (
                  <div className="mt-2">
                    <img
                      src={logoUrl}
                      alt="Logo preview"
                      className="h-20 w-20 object-contain border rounded-md"
                      data-testid="img-logo-preview"
                    />
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Recommended: Square image, min 200x200px
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="coverPhotoUrl">Cover Photo URL</Label>
                <Input
                  id="coverPhotoUrl"
                  type="url"
                  placeholder="https://example.com/cover.jpg"
                  value={coverPhotoUrl}
                  onChange={(e) => setCoverPhotoUrl(e.target.value)}
                  data-testid="input-cover-url"
                />
                {coverPhotoUrl && (
                  <div className="mt-2">
                    <img
                      src={coverPhotoUrl}
                      alt="Cover preview"
                      className="h-32 w-full object-cover border rounded-md"
                      data-testid="img-cover-preview"
                    />
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Recommended: 16:9 aspect ratio, min 1200x675px
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Theme Colors */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Theme Colors
              </CardTitle>
              <CardDescription>
                Set custom colors for your restaurant's theme
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={primaryColor || "#000000"}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-16 h-10"
                      data-testid="input-primary-color"
                    />
                    <Input
                      type="text"
                      placeholder="#000000"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      pattern="^#[0-9A-Fa-f]{6}$"
                      data-testid="input-primary-color-text"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Main brand color (hex code)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondaryColor"
                      type="color"
                      value={secondaryColor || "#000000"}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-16 h-10"
                      data-testid="input-secondary-color"
                    />
                    <Input
                      type="text"
                      placeholder="#000000"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      pattern="^#[0-9A-Fa-f]{6}$"
                      data-testid="input-secondary-color-text"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Accent color (hex code)
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="themeMode">Theme Mode</Label>
                <Select value={themeMode} onValueChange={setThemeMode}>
                  <SelectTrigger data-testid="select-theme-mode">
                    <SelectValue placeholder="Select theme mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="auto">Auto (System)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Default theme for your restaurant pages
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          {(primaryColor || secondaryColor) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Color Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  {primaryColor && (
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-medium">Primary Color</p>
                      <div
                        className="h-20 rounded-md border"
                        style={{ backgroundColor: primaryColor }}
                        data-testid="preview-primary-color"
                      />
                    </div>
                  )}
                  {secondaryColor && (
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-medium">Secondary Color</p>
                      <div
                        className="h-20 rounded-md border"
                        style={{ backgroundColor: secondaryColor }}
                        data-testid="preview-secondary-color"
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="submit"
              disabled={updateBrandingMutation.isPending}
              data-testid="button-save-branding"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateBrandingMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
