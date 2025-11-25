import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Car,
  Camera,
  Edit2,
  Save,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Upload,
  Eye,
  EyeOff,
  Calendar,
  Palette,
  Hash,
  FileText,
  ChevronLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface VehicleInfo {
  make: string;
  model: string;
  year: string;
  color: string;
  licensePlate: string;
  vin: string;
  registrationExpiry: string;
  insuranceExpiry: string;
}

interface VehiclePhoto {
  type: "front" | "back" | "side";
  url: string | null;
  status: "not_submitted" | "pending" | "approved" | "rejected";
}

const STORAGE_KEY = "safego-driver-vehicle-info";
const PHOTOS_STORAGE_KEY = "safego-driver-vehicle-photos";

const VEHICLE_MAKES = [
  "Toyota", "Honda", "Ford", "Chevrolet", "Nissan", "Hyundai", "Kia", 
  "Volkswagen", "BMW", "Mercedes-Benz", "Audi", "Lexus", "Mazda", 
  "Subaru", "Jeep", "Ram", "GMC", "Tesla", "Volvo", "Acura", "Infiniti",
  "Cadillac", "Buick", "Lincoln", "Chrysler", "Dodge", "Other"
];

const VEHICLE_COLORS = [
  "White", "Black", "Silver", "Gray", "Red", "Blue", "Brown", "Beige",
  "Green", "Yellow", "Orange", "Gold", "Purple", "Other"
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => (CURRENT_YEAR - i).toString());

function getExpiryStatus(dateString: string): { status: "valid" | "warning" | "expired" | "missing"; label: string; daysLeft?: number } {
  if (!dateString) {
    return { status: "missing", label: "Not Set" };
  }
  
  const expiryDate = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const diffTime = expiryDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { status: "expired", label: "Expired", daysLeft: diffDays };
  } else if (diffDays <= 30) {
    return { status: "warning", label: `Expires in ${diffDays} days`, daysLeft: diffDays };
  } else {
    return { status: "valid", label: "Valid", daysLeft: diffDays };
  }
}

function StatusBadge({ completed }: { completed: boolean }) {
  return (
    <Badge 
      variant="outline" 
      className={completed 
        ? "bg-green-50 dark:bg-green-950 text-green-600 border-0" 
        : "bg-yellow-50 dark:bg-yellow-950 text-yellow-600 border-0"
      }
    >
      {completed ? (
        <>
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Completed
        </>
      ) : (
        <>
          <AlertTriangle className="w-3 h-3 mr-1" />
          Missing
        </>
      )}
    </Badge>
  );
}

function PhotoStatusBadge({ status }: { status: string }) {
  const config = {
    not_submitted: { icon: Upload, color: "text-gray-600", bg: "bg-gray-50 dark:bg-gray-900", label: "Not Submitted" },
    pending: { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950", label: "Pending" },
    approved: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950", label: "Approved" },
    rejected: { icon: X, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950", label: "Rejected" },
  };
  
  const c = config[status as keyof typeof config] || config.not_submitted;
  const Icon = c.icon;
  
  return (
    <Badge variant="outline" className={`${c.color} ${c.bg} border-0`}>
      <Icon className="w-3 h-3 mr-1" />
      {c.label}
    </Badge>
  );
}

function ExpiryBadge({ dateString }: { dateString: string }) {
  const { status, label } = getExpiryStatus(dateString);
  
  const config = {
    valid: { color: "text-green-600", bg: "bg-green-50 dark:bg-green-950", icon: CheckCircle2 },
    warning: { color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950", icon: AlertTriangle },
    expired: { color: "text-red-600", bg: "bg-red-50 dark:bg-red-950", icon: AlertTriangle },
    missing: { color: "text-gray-600", bg: "bg-gray-50 dark:bg-gray-900", icon: Calendar },
  };
  
  const c = config[status];
  const Icon = c.icon;
  
  return (
    <Badge variant="outline" className={`${c.color} ${c.bg} border-0`}>
      <Icon className="w-3 h-3 mr-1" />
      {label}
    </Badge>
  );
}

function VehicleInfoCard({
  label,
  value,
  icon: Icon,
  onSave,
  options,
  isMasked,
  placeholder,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<any>;
  onSave: (value: string) => void;
  options?: string[];
  isMasked?: boolean;
  placeholder?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [showValue, setShowValue] = useState(false);
  
  const displayValue = isMasked && value && !showValue 
    ? "*".repeat(Math.max(0, value.length - 4)) + value.slice(-4)
    : value;

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  return (
    <Card className="hover-elevate" data-testid={`card-vehicle-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`p-2 rounded-lg flex-shrink-0 ${value ? "bg-primary/10" : "bg-muted"}`}>
              <Icon className={`w-4 h-4 ${value ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-muted-foreground">{label}</span>
                <StatusBadge completed={!!value} />
              </div>
              
              {isEditing ? (
                <div className="space-y-2">
                  {options ? (
                    <Select value={editValue} onValueChange={setEditValue}>
                      <SelectTrigger className="h-9" data-testid={`select-${label.toLowerCase().replace(/\s/g, "-")}`}>
                        <SelectValue placeholder={placeholder || `Select ${label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder={placeholder || `Enter ${label}`}
                      className="h-9"
                      data-testid={`input-${label.toLowerCase().replace(/\s/g, "-")}`}
                    />
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave} data-testid={`button-save-${label.toLowerCase().replace(/\s/g, "-")}`}>
                      <Save className="w-3 h-3 mr-1" />
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancel}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${value ? "text-foreground" : "text-muted-foreground italic"}`}>
                    {displayValue || "Not set"}
                  </span>
                  {isMasked && value && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setShowValue(!showValue)}
                    >
                      {showValue ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {!isEditing && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setIsEditing(true)}
              data-testid={`button-edit-${label.toLowerCase().replace(/\s/g, "-")}`}
            >
              <Edit2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ExpiryCard({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  return (
    <Card className="hover-elevate" data-testid={`card-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className={`p-2 rounded-lg flex-shrink-0 ${value ? "bg-primary/10" : "bg-muted"}`}>
              <Calendar className={`w-4 h-4 ${value ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-muted-foreground">{label}</span>
                <ExpiryBadge dateString={value} />
              </div>
              
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    type="date"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-9 max-w-[200px]"
                    data-testid={`input-${label.toLowerCase().replace(/\s/g, "-")}`}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave}>
                      <Save className="w-3 h-3 mr-1" />
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <span className={`font-medium ${value ? "text-foreground" : "text-muted-foreground italic"}`}>
                  {value ? new Date(value).toLocaleDateString() : "Not set"}
                </span>
              )}
            </div>
          </div>
          
          {!isEditing && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setIsEditing(true)}
              data-testid={`button-edit-${label.toLowerCase().replace(/\s/g, "-")}`}
            >
              <Edit2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PhotoUploadCard({
  label,
  photo,
  onUpload,
}: {
  label: string;
  photo: VehiclePhoto;
  onUpload: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("File size must be less than 10MB");
        return;
      }
      onUpload(file);
    }
  };

  return (
    <>
      <Card className="hover-elevate" data-testid={`card-photo-${photo.type}`}>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${photo.url ? "bg-primary/10" : "bg-muted"}`}>
                  <Camera className={`w-4 h-4 ${photo.url ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <span className="font-medium">{label}</span>
              </div>
              <PhotoStatusBadge status={photo.status} />
            </div>
            
            {photo.url ? (
              <div className="space-y-2">
                <div 
                  className="relative w-full h-32 bg-muted rounded-lg overflow-hidden cursor-pointer group"
                  onClick={() => setPreviewOpen(true)}
                >
                  <img 
                    src={photo.url} 
                    alt={label} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid={`button-replace-${photo.type}`}
                >
                  <Upload className="w-3 h-3 mr-1" />
                  Replace Photo
                </Button>
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Click to upload</p>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG (max 10MB)</p>
              </div>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              data-testid={`input-photo-${photo.type}`}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          {photo.url && (
            <img 
              src={photo.url} 
              alt={label} 
              className="w-full max-h-[70vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function DriverVehicle() {
  const { toast } = useToast();
  
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {
      make: "",
      model: "",
      year: "",
      color: "",
      licensePlate: "",
      vin: "",
      registrationExpiry: "",
      insuranceExpiry: "",
    };
  });

  const [photos, setPhotos] = useState<VehiclePhoto[]>(() => {
    const saved = localStorage.getItem(PHOTOS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [
      { type: "front", url: null, status: "not_submitted" },
      { type: "back", url: null, status: "not_submitted" },
      { type: "side", url: null, status: "not_submitted" },
    ];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicleInfo));
  }, [vehicleInfo]);

  useEffect(() => {
    localStorage.setItem(PHOTOS_STORAGE_KEY, JSON.stringify(photos));
  }, [photos]);

  const { data: driverData, isLoading } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const updateVehicleInfo = (field: keyof VehicleInfo, value: string) => {
    setVehicleInfo(prev => ({ ...prev, [field]: value }));
    toast({
      title: "Saved",
      description: `${field.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase())} updated successfully.`,
    });
  };

  const handlePhotoUpload = (type: "front" | "back" | "side", file: File) => {
    const url = URL.createObjectURL(file);
    setPhotos(prev => prev.map(p => 
      p.type === type ? { ...p, url, status: "pending" } : p
    ));
    toast({
      title: "Photo Uploaded",
      description: `Vehicle ${type} photo uploaded and pending review.`,
    });
  };

  const requiredFields = ["make", "model", "year", "color", "licensePlate"];
  const completedFields = requiredFields.filter(f => !!vehicleInfo[f as keyof VehicleInfo]);
  const completedPhotos = photos.filter(p => p.url);
  
  const totalRequired = requiredFields.length + 3;
  const totalCompleted = completedFields.length + completedPhotos.length;
  const progressPercent = Math.round((totalCompleted / totalRequired) * 100);

  const isComplete = totalCompleted === totalRequired;

  useEffect(() => {
    const checklistKey = "safego-driver-checklist-completed";
    const saved = localStorage.getItem(checklistKey);
    const checklist = saved ? JSON.parse(saved) : {};
    
    if (isComplete !== checklist.vehicleInfo) {
      checklist.vehicleInfo = isComplete;
      localStorage.setItem(checklistKey, JSON.stringify(checklist));
    }
  }, [isComplete]);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Vehicle Information
          </h1>
          <p className="text-muted-foreground mt-1">
            Add and manage your vehicle details to start driving with SafeGo
          </p>
        </div>
        <Link href="/driver/getting-started">
          <Button variant="outline" size="sm">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        </Link>
      </div>

      <Card data-testid="card-progress-summary">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg">Completion Status</CardTitle>
            <Badge 
              variant="outline" 
              className={isComplete 
                ? "bg-green-50 dark:bg-green-950 text-green-600 border-0" 
                : "bg-yellow-50 dark:bg-yellow-950 text-yellow-600 border-0"
              }
            >
              {isComplete ? (
                <>
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Complete
                </>
              ) : (
                <>
                  <Clock className="w-3 h-3 mr-1" />
                  In Progress
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Progress value={progressPercent} className="h-2" data-testid="progress-vehicle" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {totalCompleted} of {totalRequired} items completed
              </span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Vehicle Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <VehicleInfoCard
            label="Vehicle Make"
            value={vehicleInfo.make}
            icon={Car}
            onSave={(v) => updateVehicleInfo("make", v)}
            options={VEHICLE_MAKES}
            placeholder="Select make"
          />
          <VehicleInfoCard
            label="Vehicle Model"
            value={vehicleInfo.model}
            icon={Car}
            onSave={(v) => updateVehicleInfo("model", v)}
            placeholder="Enter model"
          />
          <VehicleInfoCard
            label="Vehicle Year"
            value={vehicleInfo.year}
            icon={Calendar}
            onSave={(v) => updateVehicleInfo("year", v)}
            options={YEARS}
            placeholder="Select year"
          />
          <VehicleInfoCard
            label="Color"
            value={vehicleInfo.color}
            icon={Palette}
            onSave={(v) => updateVehicleInfo("color", v)}
            options={VEHICLE_COLORS}
            placeholder="Select color"
          />
          <VehicleInfoCard
            label="License Plate"
            value={vehicleInfo.licensePlate}
            icon={Hash}
            onSave={(v) => updateVehicleInfo("licensePlate", v)}
            placeholder="Enter license plate"
          />
          <VehicleInfoCard
            label="VIN"
            value={vehicleInfo.vin}
            icon={FileText}
            onSave={(v) => updateVehicleInfo("vin", v)}
            isMasked={true}
            placeholder="Enter VIN (17 characters)"
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Document Expiry Dates</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <ExpiryCard
            label="Registration Expiry"
            value={vehicleInfo.registrationExpiry}
            onSave={(v) => updateVehicleInfo("registrationExpiry", v)}
          />
          <ExpiryCard
            label="Insurance Expiry"
            value={vehicleInfo.insuranceExpiry}
            onSave={(v) => updateVehicleInfo("insuranceExpiry", v)}
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Vehicle Photos</h2>
        <p className="text-sm text-muted-foreground">
          Upload clear photos of your vehicle from different angles
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <PhotoUploadCard
            label="Front View"
            photo={photos.find(p => p.type === "front")!}
            onUpload={(file) => handlePhotoUpload("front", file)}
          />
          <PhotoUploadCard
            label="Back View"
            photo={photos.find(p => p.type === "back")!}
            onUpload={(file) => handlePhotoUpload("back", file)}
          />
          <PhotoUploadCard
            label="Side View"
            photo={photos.find(p => p.type === "side")!}
            onUpload={(file) => handlePhotoUpload("side", file)}
          />
        </div>
      </div>

      {isComplete && (
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-600 mb-3" />
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-1">
              Vehicle Information Complete
            </h3>
            <p className="text-sm text-green-700 dark:text-green-300">
              All required vehicle details and photos have been submitted
            </p>
          </CardContent>
        </Card>
      )}

      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground">
          Need help?{" "}
          <Link href="/driver/support-help-center" className="text-primary hover:underline">
            Contact Support
          </Link>
        </p>
      </div>
    </div>
  );
}
