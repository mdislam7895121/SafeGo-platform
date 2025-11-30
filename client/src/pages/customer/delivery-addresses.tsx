import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  ArrowLeft, Plus, Home, Briefcase, MapPin, Star, Trash2, 
  Pencil, MoreVertical, CheckCircle, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useState, useCallback } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { GooglePlacesInput } from "@/components/rider/GooglePlacesInput";

type AddressLabel = 'home' | 'work' | 'other';

interface CustomerAddress {
  id: string;
  customerProfileId: string;
  label: AddressLabel;
  customLabel: string | null;
  address: string;
  lat: number;
  lng: number;
  placeId: string | null;
  apartment: string | null;
  instructions: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AddressFormData {
  label: AddressLabel;
  customLabel: string;
  address: string;
  lat: number;
  lng: number;
  placeId: string;
  apartment: string;
  instructions: string;
  isDefault: boolean;
}

const getLabelIcon = (label: AddressLabel) => {
  switch (label) {
    case 'home':
      return <Home className="h-4 w-4" />;
    case 'work':
      return <Briefcase className="h-4 w-4" />;
    default:
      return <MapPin className="h-4 w-4" />;
  }
};

const getLabelDisplayName = (label: AddressLabel, customLabel?: string | null) => {
  switch (label) {
    case 'home':
      return 'Home';
    case 'work':
      return 'Work';
    default:
      return customLabel || 'Other';
  }
};

export default function DeliveryAddressesPage() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [deleteAddressId, setDeleteAddressId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AddressFormData>({
    label: 'home',
    customLabel: '',
    address: '',
    lat: 0,
    lng: 0,
    placeId: '',
    apartment: '',
    instructions: '',
    isDefault: false,
  });

  const { data: addressesData, isLoading } = useQuery<{ addresses: CustomerAddress[] }>({
    queryKey: ['/api/customer/food/addresses'],
  });

  const addresses = addressesData?.addresses || [];

  const createMutation = useMutation({
    mutationFn: async (data: AddressFormData) => {
      return apiRequest('/api/customer/food/addresses', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer/food/addresses'] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: "Address Added",
        description: "Your delivery address has been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add address",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AddressFormData> }) => {
      return apiRequest(`/api/customer/food/addresses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer/food/addresses'] });
      setEditingAddress(null);
      resetForm();
      toast({
        title: "Address Updated",
        description: "Your delivery address has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update address",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/customer/food/addresses/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer/food/addresses'] });
      setDeleteAddressId(null);
      toast({
        title: "Address Deleted",
        description: "Your delivery address has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete address",
        variant: "destructive",
      });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/customer/food/addresses/${id}/set-default`, {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer/food/addresses'] });
      toast({
        title: "Default Address Updated",
        description: "Your default delivery address has been changed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set default address",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      label: 'home',
      customLabel: '',
      address: '',
      lat: 0,
      lng: 0,
      placeId: '',
      apartment: '',
      instructions: '',
      isDefault: false,
    });
  };

  const handleAddressChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, address: value }));
  }, []);

  const handleLocationSelect = useCallback((location: { address: string; lat: number; lng: number; placeId?: string }) => {
    setFormData(prev => ({
      ...prev,
      address: location.address,
      lat: location.lat,
      lng: location.lng,
      placeId: location.placeId || '',
    }));
  }, []);

  const openEditDialog = (addr: CustomerAddress) => {
    setEditingAddress(addr);
    setFormData({
      label: addr.label,
      customLabel: addr.customLabel || '',
      address: addr.address,
      lat: addr.lat,
      lng: addr.lng,
      placeId: addr.placeId || '',
      apartment: addr.apartment || '',
      instructions: addr.instructions || '',
      isDefault: addr.isDefault,
    });
  };

  const handleSubmit = () => {
    if (!formData.address || formData.lat === 0 || formData.lng === 0) {
      toast({
        title: "Missing Address",
        description: "Please enter a valid delivery address.",
        variant: "destructive",
      });
      return;
    }

    if (formData.label === 'other' && !formData.customLabel.trim()) {
      toast({
        title: "Missing Label",
        description: "Please enter a custom label for this address.",
        variant: "destructive",
      });
      return;
    }

    if (editingAddress) {
      updateMutation.mutate({ id: editingAddress.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/customer/profile">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-semibold" data-testid="text-page-title">Delivery Addresses</h1>
              <p className="text-sm text-muted-foreground">Manage your saved locations</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Button
          onClick={() => {
            resetForm();
            setIsAddDialogOpen(true);
          }}
          className="w-full"
          data-testid="button-add-address"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add New Address
        </Button>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : addresses.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-1">No saved addresses</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add your home, work, or other frequently used delivery locations for faster checkout.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {addresses.map((addr) => (
              <Card 
                key={addr.id} 
                className={addr.isDefault ? 'border-primary' : ''}
                data-testid={`card-address-${addr.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${addr.isDefault ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      {getLabelIcon(addr.label)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium" data-testid={`text-label-${addr.id}`}>
                          {getLabelDisplayName(addr.label, addr.customLabel)}
                        </span>
                        {addr.isDefault && (
                          <Badge variant="secondary" className="text-xs" data-testid={`badge-default-${addr.id}`}>
                            <Star className="h-3 w-3 mr-1" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate" data-testid={`text-address-${addr.id}`}>
                        {addr.address}
                      </p>
                      {addr.apartment && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Apt/Suite: {addr.apartment}
                        </p>
                      )}
                      {addr.instructions && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          "{addr.instructions}"
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-menu-${addr.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => openEditDialog(addr)}
                          data-testid={`menu-edit-${addr.id}`}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {!addr.isDefault && (
                          <DropdownMenuItem
                            onClick={() => setDefaultMutation.mutate(addr.id)}
                            data-testid={`menu-default-${addr.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Set as Default
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteAddressId(addr.id)}
                          data-testid={`menu-delete-${addr.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Separator />

        <div className="text-center text-sm text-muted-foreground">
          <p>Your default address will be pre-selected during checkout.</p>
        </div>
      </main>

      <Dialog open={isAddDialogOpen || !!editingAddress} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setEditingAddress(null);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingAddress ? 'Edit Address' : 'Add New Address'}
            </DialogTitle>
            <DialogDescription>
              {editingAddress ? 'Update your delivery address details.' : 'Save a new delivery location.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Select
                value={formData.label}
                onValueChange={(value: AddressLabel) => setFormData(prev => ({ ...prev, label: value }))}
              >
                <SelectTrigger data-testid="select-label">
                  <SelectValue placeholder="Select a label" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="home" data-testid="option-home">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      Home
                    </div>
                  </SelectItem>
                  <SelectItem value="work" data-testid="option-work">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Work
                    </div>
                  </SelectItem>
                  <SelectItem value="other" data-testid="option-other">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Other
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.label === 'other' && (
              <div className="space-y-2">
                <Label htmlFor="customLabel">Custom Label</Label>
                <Input
                  id="customLabel"
                  placeholder="e.g., Mom's House, Gym, School"
                  value={formData.customLabel}
                  onChange={(e) => setFormData(prev => ({ ...prev, customLabel: e.target.value }))}
                  data-testid="input-custom-label"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Address</Label>
              <GooglePlacesInput
                value={formData.address}
                onChange={handleAddressChange}
                onLocationSelect={handleLocationSelect}
                placeholder="Search for an address"
                data-testid="input-address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apartment">Apartment/Suite/Floor (Optional)</Label>
              <Input
                id="apartment"
                placeholder="e.g., Apt 4B, Suite 100, Floor 3"
                value={formData.apartment}
                onChange={(e) => setFormData(prev => ({ ...prev, apartment: e.target.value }))}
                data-testid="input-apartment"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Delivery Instructions (Optional)</Label>
              <Textarea
                id="instructions"
                placeholder="e.g., Ring the doorbell, leave at the door, gate code 1234"
                value={formData.instructions}
                onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                className="resize-none"
                rows={2}
                data-testid="textarea-instructions"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setEditingAddress(null);
                resetForm();
              }}
              disabled={isPending}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || !formData.address || (formData.lat === 0 && formData.lng === 0)}
              data-testid="button-save"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingAddress ? 'Update' : 'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteAddressId} onOpenChange={(open) => !open && setDeleteAddressId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Address?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this delivery address from your saved locations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAddressId && deleteMutation.mutate(deleteAddressId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
