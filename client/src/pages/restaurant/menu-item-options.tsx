import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Check,
  X,
  Save,
  AlertCircle,
  Settings2,
  DollarSign,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { z } from "zod";

type MenuOption = {
  id: string;
  optionGroupId: string;
  label: string;
  priceDelta: number | string;
  isDefault: boolean;
  isActive: boolean;
};

type MenuOptionGroup = {
  id: string;
  restaurantId: string;
  itemId: string;
  name: string;
  type: string;
  isRequired: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  options: MenuOption[];
};

type MenuItem = {
  id: string;
  name: string;
  hasVariants: boolean;
  hasAddOns: boolean;
  basePrice: number | string;
};

const groupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(["variant", "addon"]),
  isRequired: z.boolean(),
  minSelect: z.number().int().min(0).nullable(),
  maxSelect: z.number().int().min(0).nullable(),
});

const optionSchema = z.object({
  label: z.string().min(1, "Label is required").max(100),
  priceDelta: z.number().min(-1000).max(1000),
  isDefault: z.boolean(),
  isActive: z.boolean().optional(),
});

export default function MenuItemOptions() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/restaurant/menu-item-options/:itemId");
  const itemId = params?.itemId;

  const [editingGroup, setEditingGroup] = useState<MenuOptionGroup | null>(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [deleteOptionId, setDeleteOptionId] = useState<string | null>(null);

  const [newGroupForm, setNewGroupForm] = useState({
    name: "",
    type: "variant" as "variant" | "addon",
    isRequired: true,
    minSelect: 1,
    maxSelect: 1,
  });

  const [newOptionForm, setNewOptionForm] = useState<{
    groupId: string;
    label: string;
    priceDelta: string;
    isDefault: boolean;
  } | null>(null);

  const { data: itemData, isLoading: itemLoading } = useQuery<{ item: MenuItem }>({
    queryKey: ["/api/restaurant/menu/items", itemId],
  });

  const { data: optionGroupsData, isLoading: groupsLoading } = useQuery<{ optionGroups: MenuOptionGroup[] }>({
    queryKey: ["/api/restaurant/menu/option-groups", { itemId }],
    enabled: !!itemId,
  });

  const optionGroups = optionGroupsData?.optionGroups || [];
  const item = itemData?.item;

  const createGroupMutation = useMutation({
    mutationFn: async (data: z.infer<typeof groupSchema> & { itemId: string }) => {
      return apiRequest("/api/restaurant/menu/option-groups", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/menu/option-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/menu/items", itemId] });
      setNewGroupOpen(false);
      setNewGroupForm({ name: "", type: "variant", isRequired: true, minSelect: 1, maxSelect: 1 });
      toast({ title: "Option group created", duration: 2000 });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<z.infer<typeof groupSchema>> & { id: string }) => {
      return apiRequest(`/api/restaurant/menu/option-groups/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/menu/option-groups"] });
      setEditingGroup(null);
      toast({ title: "Option group updated", duration: 2000 });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/restaurant/menu/option-groups/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/menu/option-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/menu/items", itemId] });
      setDeleteGroupId(null);
      toast({ title: "Option group deleted", duration: 2000 });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createOptionMutation = useMutation({
    mutationFn: async (data: { optionGroupId: string } & z.infer<typeof optionSchema>) => {
      return apiRequest("/api/restaurant/menu/options", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/menu/option-groups"] });
      setNewOptionForm(null);
      toast({ title: "Option added", duration: 2000 });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateOptionMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<z.infer<typeof optionSchema>> & { id: string }) => {
      return apiRequest(`/api/restaurant/menu/options/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/menu/option-groups"] });
      toast({ title: "Option updated", duration: 2000 });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteOptionMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/restaurant/menu/options/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/menu/option-groups"] });
      setDeleteOptionId(null);
      toast({ title: "Option deleted", duration: 2000 });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateGroup = () => {
    if (!itemId) return;
    const result = groupSchema.safeParse(newGroupForm);
    if (!result.success) {
      toast({ title: "Validation error", description: result.error.errors[0].message, variant: "destructive" });
      return;
    }
    createGroupMutation.mutate({ ...result.data, itemId });
  };

  const handleAddOption = () => {
    if (!newOptionForm) return;
    const result = optionSchema.safeParse({
      ...newOptionForm,
      priceDelta: parseFloat(newOptionForm.priceDelta) || 0,
    });
    if (!result.success) {
      toast({ title: "Validation error", description: result.error.errors[0].message, variant: "destructive" });
      return;
    }
    createOptionMutation.mutate({ optionGroupId: newOptionForm.groupId, ...result.data });
  };

  const isLoading = itemLoading || groupsLoading;

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Item not found</h2>
            <p className="text-muted-foreground mb-4">The menu item could not be found.</p>
            <Link href="/restaurant/menu">
              <Button>Back to Menu</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const variantGroups = optionGroups.filter((g) => g.type === "variant");
  const addonGroups = optionGroups.filter((g) => g.type === "addon");

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={`/restaurant/menu-edit/${itemId}`}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Variants & Add-ons</h1>
            <p className="text-muted-foreground text-sm">{item.name}</p>
          </div>
        </div>
        <Button onClick={() => setNewGroupOpen(true)} data-testid="button-add-group">
          <Plus className="h-4 w-4 mr-2" />
          Add Option Group
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Option Groups
          </CardTitle>
          <CardDescription>
            Create variant groups (e.g., Size) or add-on groups (e.g., Extra toppings) for this item.
            Variants require a single selection; add-ons allow multiple selections.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {optionGroups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Settings2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No option groups yet</p>
              <p className="text-sm">Click "Add Option Group" to create variants or add-ons</p>
            </div>
          ) : (
            <div className="space-y-4">
              {variantGroups.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Variants (Single Selection)
                  </h3>
                  {variantGroups.map((group) => (
                    <OptionGroupCard
                      key={group.id}
                      group={group}
                      onEdit={() => setEditingGroup(group)}
                      onDelete={() => setDeleteGroupId(group.id)}
                      onAddOption={() =>
                        setNewOptionForm({ groupId: group.id, label: "", priceDelta: "0", isDefault: false })
                      }
                      onToggleOption={(optionId, isActive) =>
                        updateOptionMutation.mutate({ id: optionId, isActive })
                      }
                      onDeleteOption={(optionId) => setDeleteOptionId(optionId)}
                      onSetDefault={(optionId) => updateOptionMutation.mutate({ id: optionId, isDefault: true })}
                    />
                  ))}
                </div>
              )}

              {addonGroups.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Add-ons (Multiple Selection)
                  </h3>
                  {addonGroups.map((group) => (
                    <OptionGroupCard
                      key={group.id}
                      group={group}
                      onEdit={() => setEditingGroup(group)}
                      onDelete={() => setDeleteGroupId(group.id)}
                      onAddOption={() =>
                        setNewOptionForm({ groupId: group.id, label: "", priceDelta: "0", isDefault: false })
                      }
                      onToggleOption={(optionId, isActive) =>
                        updateOptionMutation.mutate({ id: optionId, isActive })
                      }
                      onDeleteOption={(optionId) => setDeleteOptionId(optionId)}
                      onSetDefault={(optionId) => updateOptionMutation.mutate({ id: optionId, isDefault: true })}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={newGroupOpen} onOpenChange={setNewGroupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Option Group</DialogTitle>
            <DialogDescription>
              Create a new group for variants or add-ons. You can add options after creating the group.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Group Name</Label>
              <Input
                placeholder="e.g., Size, Toppings, Sides"
                value={newGroupForm.name}
                onChange={(e) => setNewGroupForm((f) => ({ ...f, name: e.target.value }))}
                data-testid="input-group-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={newGroupForm.type}
                onValueChange={(v: "variant" | "addon") => setNewGroupForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger data-testid="select-group-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="variant">Variant (single selection)</SelectItem>
                  <SelectItem value="addon">Add-on (multiple selection)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Required?</Label>
              <Switch
                checked={newGroupForm.isRequired}
                onCheckedChange={(v) => setNewGroupForm((f) => ({ ...f, isRequired: v }))}
                data-testid="switch-required"
              />
            </div>
            {newGroupForm.type === "addon" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Min Select</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newGroupForm.minSelect}
                    onChange={(e) =>
                      setNewGroupForm((f) => ({ ...f, minSelect: parseInt(e.target.value) || 0 }))
                    }
                    data-testid="input-min-select"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Select</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newGroupForm.maxSelect}
                    onChange={(e) =>
                      setNewGroupForm((f) => ({ ...f, maxSelect: parseInt(e.target.value) || 0 }))
                    }
                    data-testid="input-max-select"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewGroupOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup} disabled={createGroupMutation.isPending} data-testid="button-create-group">
              {createGroupMutation.isPending ? "Creating..." : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!newOptionForm} onOpenChange={(o) => !o && setNewOptionForm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Option</DialogTitle>
            <DialogDescription>Add a new option to this group.</DialogDescription>
          </DialogHeader>
          {newOptionForm && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Option Label</Label>
                <Input
                  placeholder="e.g., Small, Medium, Large"
                  value={newOptionForm.label}
                  onChange={(e) => setNewOptionForm((f) => f && { ...f, label: e.target.value })}
                  data-testid="input-option-label"
                />
              </div>
              <div className="space-y-2">
                <Label>Price Adjustment ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newOptionForm.priceDelta}
                  onChange={(e) => setNewOptionForm((f) => f && { ...f, priceDelta: e.target.value })}
                  data-testid="input-option-price"
                />
                <p className="text-xs text-muted-foreground">
                  Positive adds to base price, negative reduces it
                </p>
              </div>
              <div className="flex items-center justify-between">
                <Label>Default Selection?</Label>
                <Switch
                  checked={newOptionForm.isDefault}
                  onCheckedChange={(v) => setNewOptionForm((f) => f && { ...f, isDefault: v })}
                  data-testid="switch-default"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOptionForm(null)}>
              Cancel
            </Button>
            <Button onClick={handleAddOption} disabled={createOptionMutation.isPending} data-testid="button-add-option">
              {createOptionMutation.isPending ? "Adding..." : "Add Option"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteGroupId} onOpenChange={(o) => !o && setDeleteGroupId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Option Group?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this option group and all its options. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteGroupId && deleteGroupMutation.mutate(deleteGroupId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-group"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteOptionId} onOpenChange={(o) => !o && setDeleteOptionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Option?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this option. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteOptionId && deleteOptionMutation.mutate(deleteOptionId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-option"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editingGroup && (
        <EditGroupDialog
          group={editingGroup}
          onClose={() => setEditingGroup(null)}
          onSave={(updates) => updateGroupMutation.mutate({ id: editingGroup.id, ...updates })}
          isPending={updateGroupMutation.isPending}
        />
      )}
    </div>
  );
}

function OptionGroupCard({
  group,
  onEdit,
  onDelete,
  onAddOption,
  onToggleOption,
  onDeleteOption,
  onSetDefault,
}: {
  group: MenuOptionGroup;
  onEdit: () => void;
  onDelete: () => void;
  onAddOption: () => void;
  onToggleOption: (optionId: string, isActive: boolean) => void;
  onDeleteOption: (optionId: string) => void;
  onSetDefault: (optionId: string) => void;
}) {
  return (
    <Card data-testid={`option-group-${group.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium">{group.name}</h4>
            <Badge variant={group.type === "variant" ? "default" : "secondary"}>
              {group.type === "variant" ? "Variant" : "Add-on"}
            </Badge>
            {group.isRequired && <Badge variant="outline">Required</Badge>}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit} data-testid={`button-edit-group-${group.id}`}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={onDelete}
              data-testid={`button-delete-group-${group.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {group.options.length === 0 ? (
          <p className="text-sm text-muted-foreground">No options yet</p>
        ) : (
          <div className="space-y-2">
            {group.options.map((opt) => (
              <div
                key={opt.id}
                className={`flex items-center justify-between gap-2 p-2 rounded-md border ${
                  !opt.isActive ? "opacity-50 bg-muted/50" : ""
                }`}
                data-testid={`option-${opt.id}`}
              >
                <div className="flex items-center gap-2">
                  {opt.isDefault && (
                    <Badge variant="outline" className="text-xs">
                      Default
                    </Badge>
                  )}
                  <span className={opt.isActive ? "" : "line-through"}>{opt.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {Number(opt.priceDelta) > 0 && "+"}
                    {Number(opt.priceDelta) !== 0 && `$${Number(opt.priceDelta).toFixed(2)}`}
                  </span>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={opt.isActive}
                      onCheckedChange={(v) => onToggleOption(opt.id, v)}
                      data-testid={`switch-option-active-${opt.id}`}
                    />
                    {!opt.isDefault && group.type === "variant" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onSetDefault(opt.id)}
                        title="Set as default"
                        data-testid={`button-set-default-${opt.id}`}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => onDeleteOption(opt.id)}
                      data-testid={`button-delete-option-${opt.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button variant="outline" size="sm" className="mt-3 w-full" onClick={onAddOption} data-testid={`button-add-option-to-${group.id}`}>
          <Plus className="h-4 w-4 mr-2" />
          Add Option
        </Button>
      </CardContent>
    </Card>
  );
}

function EditGroupDialog({
  group,
  onClose,
  onSave,
  isPending,
}: {
  group: MenuOptionGroup;
  onClose: () => void;
  onSave: (updates: Partial<z.infer<typeof groupSchema>>) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    name: group.name,
    type: group.type as "variant" | "addon",
    isRequired: group.isRequired,
    minSelect: group.minSelect ?? 0,
    maxSelect: group.maxSelect ?? 0,
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Option Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Group Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              data-testid="input-edit-group-name"
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v: "variant" | "addon") => setForm((f) => ({ ...f, type: v }))}>
              <SelectTrigger data-testid="select-edit-group-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="variant">Variant (single selection)</SelectItem>
                <SelectItem value="addon">Add-on (multiple selection)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>Required?</Label>
            <Switch
              checked={form.isRequired}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isRequired: v }))}
              data-testid="switch-edit-required"
            />
          </div>
          {form.type === "addon" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Min Select</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.minSelect}
                  onChange={(e) => setForm((f) => ({ ...f, minSelect: parseInt(e.target.value) || 0 }))}
                  data-testid="input-edit-min-select"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Select</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.maxSelect}
                  onChange={(e) => setForm((f) => ({ ...f, maxSelect: parseInt(e.target.value) || 0 }))}
                  data-testid="input-edit-max-select"
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave({
                name: form.name,
                type: form.type,
                isRequired: form.isRequired,
                minSelect: form.type === "addon" ? form.minSelect : null,
                maxSelect: form.type === "addon" ? form.maxSelect : null,
              })
            }
            disabled={isPending}
            data-testid="button-save-group"
          >
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
