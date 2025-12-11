import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, uploadWithAuth } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, Save, Palette, Eye, Loader2, Camera, Check, X } from "lucide-react";

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
  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const { data: branding, isLoading } = useQuery<RestaurantBranding>({
    queryKey: ["/api/restaurant/branding"],
  });

  useEffect(() => {
    if (branding) {
      setLogoUrl(branding.logoUrl || "");
      setCoverPhotoUrl(branding.coverPhotoUrl || "");
      setPrimaryColor(branding.primaryColor || "");
      setSecondaryColor(branding.secondaryColor || "");
      setThemeMode(branding.themeMode || "light");
    }
  }, [branding]);

  const handleImageUpload = async (file: File, type: "logo" | "cover") => {
    const setUploading = type === "logo" ? setLogoUploading : setCoverUploading;
    const setUrl = type === "logo" ? setLogoUrl : setCoverPhotoUrl;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadWithAuth(`/api/restaurant/upload-image?type=${type}`, formData);
      
      if (result?.url) {
        setUrl(result.url);
        queryClient.invalidateQueries({ queryKey: ["/api/restaurant/branding"] });
        toast({
          title: "Upload Successful",
          description: `${type === "logo" ? "Logo" : "Cover photo"} uploaded successfully.`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const triggerFileUpload = (type: "logo" | "cover") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        await handleImageUpload(file, type);
      }
    };
    input.click();
  };

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
              <div className="space-y-3">
                <Label>Restaurant Logo</Label>
                <div className="flex items-start gap-4">
                  {logoUrl ? (
                    <div className="relative h-24 w-24 rounded-lg overflow-hidden border-2 border-dashed">
                      <img
                        src={logoUrl}
                        alt="Logo preview"
                        className="h-full w-full object-cover"
                        data-testid="img-logo-preview"
                      />
                      <div className="absolute bottom-1 right-1 bg-green-500 rounded-full p-0.5">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="h-24 w-24 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/50">
                      <Camera className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={logoUploading}
                      onClick={() => triggerFileUpload("logo")}
                      data-testid="button-upload-logo"
                    >
                      {logoUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          {logoUrl ? "Change Logo" : "Upload Logo"}
                        </>
                      )}
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Square image, min 200x200px
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Cover Photo</Label>
                <div className="flex flex-col gap-4">
                  {coverPhotoUrl ? (
                    <div className="relative h-40 w-full rounded-lg overflow-hidden border-2 border-dashed">
                      <img
                        src={coverPhotoUrl}
                        alt="Cover preview"
                        className="h-full w-full object-cover"
                        data-testid="img-cover-preview"
                      />
                      <div className="absolute bottom-2 right-2 bg-green-500 rounded-full p-0.5">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="h-40 w-full rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/50">
                      <div className="text-center">
                        <Camera className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No cover photo</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={coverUploading}
                      onClick={() => triggerFileUpload("cover")}
                      data-testid="button-upload-cover"
                    >
                      {coverUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          {coverPhotoUrl ? "Change Cover" : "Upload Cover"}
                        </>
                      )}
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      16:9 aspect ratio, min 1200x675px
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

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
                      value={secondaryColor || "#666666"}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-16 h-10"
                      data-testid="input-secondary-color"
                    />
                    <Input
                      type="text"
                      placeholder="#666666"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      pattern="^#[0-9A-Fa-f]{6}$"
                      data-testid="input-secondary-color-text"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Accent and secondary elements (hex code)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Theme Mode
              </CardTitle>
              <CardDescription>
                Choose the display mode for your restaurant page
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="themeMode">Display Mode</Label>
                <Select value={themeMode} onValueChange={setThemeMode}>
                  <SelectTrigger data-testid="select-theme-mode">
                    <SelectValue placeholder="Select theme mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light Mode</SelectItem>
                    <SelectItem value="dark">Dark Mode</SelectItem>
                    <SelectItem value="system">System Default</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  This affects how your restaurant page appears to customers
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={updateBrandingMutation.isPending}
              data-testid="button-save-branding"
            >
              {updateBrandingMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
