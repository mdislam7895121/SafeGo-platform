import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft, Home, Building2, Star, Plus, Trash2, Loader2,
  MapPin, AlertCircle, Check, Pencil
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { GooglePlacesInput } from "@/components/rider/GooglePlacesInput";

interface LocationData {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

interface SavedPlace {
  id: string;
  label: "home" | "work" | "other";
  customLabel?: string;
  addressText: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  iconType?: string;
  isDefaultPickup: boolean;
  isDefaultDropoff: boolean;
  createdAt: string;
}

interface SavedPlacesResponse {
  savedPlaces: SavedPlace[];
  maxAllowed: number;
}

const labelIcons = {
  home: Home,
  work: Building2,
  other: Star,
};

const labelColors = {
  home: "text-blue-600 bg-blue-100 dark:bg-blue-950",
  work: "text-purple-600 bg-purple-100 dark:bg-purple-950",
  other: "text-amber-600 bg-amber-100 dark:bg-amber-950",
};

export default function SavedPlaces() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<SavedPlace | null>(null);

  const [newPlace, setNewPlace] = useState({
    label: "other" as "home" | "work" | "other",
    customLabel: "",
    addressText: "",
    latitude: 0,
    longitude: 0,
    placeId: "",
    isDefaultPickup: false,
    isDefaultDropoff: false,
  });

  const { data, isLoading, error } = useQuery<SavedPlacesResponse>({
    queryKey: ["/api/customer/saved-places"],
  });

  const addPlaceMutation = useMutation({
    mutationFn: async (placeData: typeof newPlace) => {
      const response = await apiRequest("/api/customer/saved-places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(placeData),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/saved-places"] });
      toast({
        title: "Place saved",
        description: "Your saved place has been added successfully.",
      });
      setShowAddDialog(false);
      resetNewPlace();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save place",
        description: error.message || "Could not save your place. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updatePlaceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof newPlace> }) => {
      const response = await apiRequest(`/api/customer/saved-places/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/saved-places"] });
      toast({
        title: "Place updated",
        description: "Your saved place has been updated.",
      });
      setShowEditDialog(false);
      setSelectedPlace(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message || "Could not update your place.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(`/api/customer/saved-places/${id}`, {
        method: "DELETE",
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/saved-places"] });
      toast({
        title: "Place removed",
        description: "Your saved place has been removed.",
      });
      setShowDeleteDialog(false);
      setSelectedPlace(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message || "Could not remove your place.",
        variant: "destructive",
      });
    },
  });

  const resetNewPlace = () => {
    setNewPlace({
      label: "other",
      customLabel: "",
      addressText: "",
      latitude: 0,
      longitude: 0,
      placeId: "",
      isDefaultPickup: false,
      isDefaultDropoff: false,
    });
  };

  const handleLocationSelect = (location: LocationData, isEdit = false) => {
    if (isEdit && selectedPlace) {
      setSelectedPlace({
        ...selectedPlace,
        addressText: location.address,
        latitude: location.lat,
        longitude: location.lng,
        placeId: location.placeId,
      });
    } else {
      setNewPlace({
        ...newPlace,
        addressText: location.address,
        latitude: location.lat,
        longitude: location.lng,
        placeId: location.placeId || "",
      });
    }
  };

  const handleAddPlace = () => {
    if (!newPlace.addressText || newPlace.latitude === 0) {
      toast({
        title: "Address required",
        description: "Please select a valid address from the suggestions.",
        variant: "destructive",
      });
      return;
    }

    if (newPlace.label === "other" && !newPlace.customLabel.trim()) {
      toast({
        title: "Label required",
        description: "Please enter a label for this place.",
        variant: "destructive",
      });
      return;
    }

    addPlaceMutation.mutate(newPlace);
  };

  const handleEditClick = (place: SavedPlace) => {
    setSelectedPlace(place);
    setShowEditDialog(true);
  };

  const handleDeleteClick = (place: SavedPlace) => {
    setSelectedPlace(place);
    setShowDeleteDialog(true);
  };

  const handleUpdatePlace = () => {
    if (!selectedPlace) return;

    updatePlaceMutation.mutate({
      id: selectedPlace.id,
      data: {
        label: selectedPlace.label,
        customLabel: selectedPlace.customLabel,
        addressText: selectedPlace.addressText,
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude,
        placeId: selectedPlace.placeId,
        isDefaultPickup: selectedPlace.isDefaultPickup,
        isDefaultDropoff: selectedPlace.isDefaultDropoff,
      },
    });
  };

  const savedPlaces = data?.savedPlaces || [];
  const maxAllowed = data?.maxAllowed || 10;
  const canAddMore = savedPlaces.length < maxAllowed;

  const hasHome = savedPlaces.some((p) => p.label === "home");
  const hasWork = savedPlaces.some((p) => p.label === "work");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-6 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center gap-4 p-4">
          <Link href="/customer">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Saved Places</h1>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {canAddMore && (
          <Card 
            className="border-dashed hover-elevate cursor-pointer" 
            onClick={() => setShowAddDialog(true)}
            data-testid="button-add-place"
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Add saved place</p>
                  <p className="text-sm text-muted-foreground">
                    Save your frequent destinations
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">Failed to load saved places. Please try again.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {savedPlaces.length === 0 && !error && (
          <Card className="bg-muted/50">
            <CardContent className="p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">No saved places</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Save your home, work, and other frequent destinations for quick booking
              </p>
              <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-first-place">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Place
              </Button>
            </CardContent>
          </Card>
        )}

        {savedPlaces.map((place) => {
          const Icon = labelIcons[place.label];
          const colorClass = labelColors[place.label];

          return (
            <Card key={place.id} data-testid={`card-place-${place.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${colorClass}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium capitalize">
                        {place.label === "other" ? place.customLabel : place.label}
                      </p>
                      {place.isDefaultPickup && (
                        <Badge variant="outline" className="text-[10px]">
                          Default Pickup
                        </Badge>
                      )}
                      {place.isDefaultDropoff && (
                        <Badge variant="outline" className="text-[10px]">
                          Default Dropoff
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-1" title={place.addressText}>
                      {place.addressText}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditClick(place)}
                      data-testid={`button-edit-${place.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(place)}
                      className="text-destructive hover:text-destructive"
                      data-testid={`button-delete-${place.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Card className="bg-muted/50">
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            {savedPlaces.length} of {maxAllowed} places saved
          </CardContent>
        </Card>
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Saved Place</DialogTitle>
            <DialogDescription>
              Save a location for quick access when booking rides
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Place Type</Label>
              <Select
                value={newPlace.label}
                onValueChange={(value: "home" | "work" | "other") => 
                  setNewPlace({ ...newPlace, label: value, customLabel: "" })
                }
              >
                <SelectTrigger data-testid="select-place-type">
                  <SelectValue placeholder="Select place type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="home" disabled={hasHome}>
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      Home {hasHome && "(Already saved)"}
                    </div>
                  </SelectItem>
                  <SelectItem value="work" disabled={hasWork}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Work {hasWork && "(Already saved)"}
                    </div>
                  </SelectItem>
                  <SelectItem value="other">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4" />
                      Other
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newPlace.label === "other" && (
              <div className="space-y-2">
                <Label htmlFor="customLabel">Custom Label</Label>
                <Input
                  id="customLabel"
                  value={newPlace.customLabel}
                  onChange={(e) => setNewPlace({ ...newPlace, customLabel: e.target.value })}
                  placeholder="e.g., Gym, Mom's House, Office 2"
                  maxLength={50}
                  data-testid="input-custom-label"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Address</Label>
              <GooglePlacesInput
                value={newPlace.addressText}
                onChange={(value) => setNewPlace({ ...newPlace, addressText: value })}
                onLocationSelect={(loc) => handleLocationSelect(loc)}
                placeholder="Search for an address"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="defaultPickup"
                  checked={newPlace.isDefaultPickup}
                  onChange={(e) => setNewPlace({ ...newPlace, isDefaultPickup: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                  data-testid="checkbox-default-pickup"
                />
                <Label htmlFor="defaultPickup" className="text-sm font-normal cursor-pointer">
                  Set as default pickup location
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="defaultDropoff"
                  checked={newPlace.isDefaultDropoff}
                  onChange={(e) => setNewPlace({ ...newPlace, isDefaultDropoff: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                  data-testid="checkbox-default-dropoff"
                />
                <Label htmlFor="defaultDropoff" className="text-sm font-normal cursor-pointer">
                  Set as default dropoff location
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetNewPlace(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleAddPlace}
              disabled={addPlaceMutation.isPending}
              data-testid="button-confirm-add"
            >
              {addPlaceMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Place"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Saved Place</DialogTitle>
            <DialogDescription>
              Update your saved location details
            </DialogDescription>
          </DialogHeader>

          {selectedPlace && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Place Type</Label>
                <Select
                  value={selectedPlace.label}
                  onValueChange={(value: "home" | "work" | "other") =>
                    setSelectedPlace({ ...selectedPlace, label: value })
                  }
                >
                  <SelectTrigger data-testid="select-edit-place-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem 
                      value="home" 
                      disabled={hasHome && selectedPlace.label !== "home"}
                    >
                      Home
                    </SelectItem>
                    <SelectItem 
                      value="work" 
                      disabled={hasWork && selectedPlace.label !== "work"}
                    >
                      Work
                    </SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedPlace.label === "other" && (
                <div className="space-y-2">
                  <Label htmlFor="editCustomLabel">Custom Label</Label>
                  <Input
                    id="editCustomLabel"
                    value={selectedPlace.customLabel || ""}
                    onChange={(e) =>
                      setSelectedPlace({ ...selectedPlace, customLabel: e.target.value })
                    }
                    placeholder="e.g., Gym, Mom's House"
                    maxLength={50}
                    data-testid="input-edit-custom-label"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Address</Label>
                <GooglePlacesInput
                  value={selectedPlace.addressText}
                  onChange={(value) =>
                    setSelectedPlace({ ...selectedPlace, addressText: value })
                  }
                  onLocationSelect={(loc) => handleLocationSelect(loc, true)}
                  placeholder="Search for an address"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="editDefaultPickup"
                    checked={selectedPlace.isDefaultPickup}
                    onChange={(e) =>
                      setSelectedPlace({ ...selectedPlace, isDefaultPickup: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300"
                    data-testid="checkbox-edit-default-pickup"
                  />
                  <Label htmlFor="editDefaultPickup" className="text-sm font-normal cursor-pointer">
                    Set as default pickup location
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="editDefaultDropoff"
                    checked={selectedPlace.isDefaultDropoff}
                    onChange={(e) =>
                      setSelectedPlace({ ...selectedPlace, isDefaultDropoff: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300"
                    data-testid="checkbox-edit-default-dropoff"
                  />
                  <Label htmlFor="editDefaultDropoff" className="text-sm font-normal cursor-pointer">
                    Set as default dropoff location
                  </Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdatePlace}
              disabled={updatePlaceMutation.isPending}
              data-testid="button-confirm-edit"
            >
              {updatePlaceMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove saved place?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              {selectedPlace?.label === "other"
                ? selectedPlace.customLabel
                : selectedPlace?.label}
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedPlace && deleteMutation.mutate(selectedPlace.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
