import { useState, useMemo, useEffect } from "react";
import { X, Plus, Minus, Check, AlertCircle, Flame, Leaf, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export interface MenuItemOption {
  id: string;
  label: string;
  priceDelta: number;
  isDefault: boolean;
  isActive: boolean;
}

export interface MenuItemOptionGroup {
  id: string;
  name: string;
  type: "variant" | "addon" | "size" | "topping" | "sauce" | "drink" | "side";
  isRequired: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  options: MenuItemOption[];
}

export interface UpsellItem {
  id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  shortDescription?: string;
}

export interface MenuItemDetail {
  id: string;
  name: string;
  shortDescription?: string;
  longDescription?: string;
  basePrice: number;
  currency: string;
  imageUrl?: string | null;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isHalal?: boolean;
  isSpicy?: boolean;
  calories?: number;
  preparationTimeMinutes?: number;
  hasVariants: boolean;
  hasAddOns: boolean;
  optionGroups: MenuItemOptionGroup[];
  upsellItems?: UpsellItem[];
}

interface SelectedOption {
  groupId: string;
  groupName: string;
  optionId: string;
  optionLabel: string;
  priceDelta: number;
  quantity: number;
}

interface ItemDetailModalProps {
  item: MenuItemDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (
    item: MenuItemDetail,
    quantity: number,
    selectedOptions: SelectedOption[],
    specialInstructions: string,
    totalPrice: number
  ) => void;
  onUpsellItemClick?: (itemId: string) => void;
}

export default function ItemDetailModal({
  item,
  isOpen,
  onClose,
  onAddToCart,
  onUpsellItemClick,
}: ItemDetailModalProps) {
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<Map<string, SelectedOption[]>>(new Map());

  useEffect(() => {
    if (isOpen && item) {
      setQuantity(1);
      setSpecialInstructions("");
      const initialSelections = new Map<string, SelectedOption[]>();
      item.optionGroups.forEach((group) => {
        const defaultOption = group.options.find((opt) => opt.isDefault && opt.isActive);
        if (defaultOption) {
          initialSelections.set(group.id, [{
            groupId: group.id,
            groupName: group.name,
            optionId: defaultOption.id,
            optionLabel: defaultOption.label,
            priceDelta: defaultOption.priceDelta,
            quantity: 1,
          }]);
        } else if (group.isRequired && group.options.length > 0) {
          const firstActive = group.options.find((opt) => opt.isActive);
          if (firstActive) {
            initialSelections.set(group.id, [{
              groupId: group.id,
              groupName: group.name,
              optionId: firstActive.id,
              optionLabel: firstActive.label,
              priceDelta: firstActive.priceDelta,
              quantity: 1,
            }]);
          }
        }
      });
      setSelectedOptions(initialSelections);
    }
  }, [isOpen, item]);

  const isVariantGroup = (type: string) => 
    ["variant", "size"].includes(type);

  const handleOptionSelect = (group: MenuItemOptionGroup, option: MenuItemOption) => {
    if (!option.isActive) return;

    const newSelections = new Map(selectedOptions);
    const currentSelections = newSelections.get(group.id) || [];

    if (isVariantGroup(group.type) || group.maxSelect === 1) {
      newSelections.set(group.id, [{
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionLabel: option.label,
        priceDelta: option.priceDelta,
        quantity: 1,
      }]);
    } else {
      const existingIndex = currentSelections.findIndex((s) => s.optionId === option.id);
      
      if (existingIndex >= 0) {
        const updated = currentSelections.filter((_, i) => i !== existingIndex);
        newSelections.set(group.id, updated);
      } else {
        if (group.maxSelect && currentSelections.length >= group.maxSelect) {
          toast({
            title: "Maximum reached",
            description: `You can only select up to ${group.maxSelect} ${group.name.toLowerCase()}`,
            variant: "destructive",
          });
          return;
        }
        newSelections.set(group.id, [...currentSelections, {
          groupId: group.id,
          groupName: group.name,
          optionId: option.id,
          optionLabel: option.label,
          priceDelta: option.priceDelta,
          quantity: 1,
        }]);
      }
    }

    setSelectedOptions(newSelections);
  };

  const handleOptionQuantityChange = (groupId: string, optionId: string, delta: number) => {
    const newSelections = new Map(selectedOptions);
    const groupSelections = newSelections.get(groupId) || [];
    const optionIndex = groupSelections.findIndex((s) => s.optionId === optionId);
    
    if (optionIndex >= 0) {
      const newQuantity = groupSelections[optionIndex].quantity + delta;
      if (newQuantity <= 0) {
        const updated = groupSelections.filter((_, i) => i !== optionIndex);
        newSelections.set(groupId, updated);
      } else {
        const group = item?.optionGroups.find((g) => g.id === groupId);
        const maxQty = group?.maxSelect || 10;
        if (newQuantity <= maxQty) {
          groupSelections[optionIndex] = { ...groupSelections[optionIndex], quantity: newQuantity };
          newSelections.set(groupId, [...groupSelections]);
        }
      }
    }
    
    setSelectedOptions(newSelections);
  };

  const isOptionSelected = (groupId: string, optionId: string): boolean => {
    const groupSelections = selectedOptions.get(groupId) || [];
    return groupSelections.some((s) => s.optionId === optionId);
  };

  const getOptionQuantity = (groupId: string, optionId: string): number => {
    const groupSelections = selectedOptions.get(groupId) || [];
    const selection = groupSelections.find((s) => s.optionId === optionId);
    return selection?.quantity || 0;
  };

  const totalOptionsPrice = useMemo(() => {
    let total = 0;
    selectedOptions.forEach((selections) => {
      selections.forEach((s) => {
        total += s.priceDelta * s.quantity;
      });
    });
    return total;
  }, [selectedOptions]);

  const itemTotal = useMemo(() => {
    if (!item) return 0;
    return (item.basePrice + totalOptionsPrice) * quantity;
  }, [item, totalOptionsPrice, quantity]);

  const allRequiredSelected = useMemo(() => {
    if (!item) return false;
    return item.optionGroups
      .filter((g) => g.isRequired)
      .every((g) => {
        const selections = selectedOptions.get(g.id) || [];
        const minSelect = g.minSelect || 1;
        return selections.length >= minSelect;
      });
  }, [item, selectedOptions]);

  const handleAddToCart = () => {
    if (!item) return;
    
    if (!allRequiredSelected) {
      toast({
        title: "Selection required",
        description: "Please make all required selections before adding to cart",
        variant: "destructive",
      });
      return;
    }

    const allSelections: SelectedOption[] = [];
    selectedOptions.forEach((selections) => {
      allSelections.push(...selections);
    });

    onAddToCart(item, quantity, allSelections, specialInstructions, itemTotal);
    onClose();
  };

  if (!item) return null;

  const variantGroups = item.optionGroups.filter((g) => isVariantGroup(g.type));
  const addonGroups = item.optionGroups.filter((g) => !isVariantGroup(g.type));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 overflow-hidden">
        <ScrollArea className="max-h-[90vh]">
          <div className="relative">
            {item.imageUrl ? (
              <div className="relative h-48 sm:h-56 w-full">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
            ) : (
              <div className="h-24 bg-gradient-to-br from-muted to-muted/50" />
            )}
            
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
              onClick={onClose}
              data-testid="button-close-item-detail"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-4 space-y-4">
            <DialogHeader className="space-y-2 text-left">
              <div className="flex items-start justify-between gap-2">
                <DialogTitle className="text-xl font-bold leading-tight">
                  {item.name}
                </DialogTitle>
                <span className="text-lg font-semibold text-primary whitespace-nowrap">
                  ${item.basePrice.toFixed(2)}
                </span>
              </div>
              
              <div className="flex flex-wrap gap-1.5">
                {item.isVegetarian && (
                  <Badge variant="secondary" className="gap-1 text-green-600">
                    <Leaf className="h-3 w-3" />
                    Vegetarian
                  </Badge>
                )}
                {item.isVegan && (
                  <Badge variant="secondary" className="gap-1 text-green-600">
                    <Leaf className="h-3 w-3" />
                    Vegan
                  </Badge>
                )}
                {item.isHalal && (
                  <Badge variant="secondary" className="gap-1">
                    Halal
                  </Badge>
                )}
                {item.isSpicy && (
                  <Badge variant="secondary" className="gap-1 text-red-500">
                    <Flame className="h-3 w-3" />
                    Spicy
                  </Badge>
                )}
                {item.calories && (
                  <Badge variant="outline" className="text-muted-foreground">
                    {item.calories} cal
                  </Badge>
                )}
              </div>

              {(item.shortDescription || item.longDescription) && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.longDescription || item.shortDescription}
                </p>
              )}
            </DialogHeader>

            <Separator />

            {variantGroups.length > 0 && (
              <div className="space-y-4">
                {variantGroups.map((group) => (
                  <div key={group.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">
                        {group.name}
                        {group.isRequired && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </h4>
                      {group.isRequired && (
                        <Badge variant="outline" className="text-[10px]">Required</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {group.options.filter((o) => o.isActive).map((option) => {
                        const isSelected = isOptionSelected(group.id, option.id);
                        return (
                          <Button
                            key={option.id}
                            variant={isSelected ? "default" : "outline"}
                            className={`h-auto py-2 px-3 justify-start text-left ${!option.isActive ? 'opacity-50' : ''}`}
                            onClick={() => handleOptionSelect(group, option)}
                            disabled={!option.isActive}
                            data-testid={`button-variant-${option.id}`}
                          >
                            <div className="flex flex-col items-start w-full">
                              <span className="text-sm font-medium truncate w-full">
                                {option.label}
                              </span>
                              {option.priceDelta !== 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {option.priceDelta > 0 ? '+' : ''}${option.priceDelta.toFixed(2)}
                                </span>
                              )}
                            </div>
                            {isSelected && (
                              <Check className="h-4 w-4 ml-auto flex-shrink-0" />
                            )}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {addonGroups.length > 0 && (
              <div className="space-y-4">
                <Separator />
                {addonGroups.map((group) => (
                  <div key={group.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">
                        {group.name}
                        {group.isRequired && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </h4>
                      <div className="flex items-center gap-2">
                        {group.maxSelect && group.maxSelect > 1 && (
                          <span className="text-xs text-muted-foreground">
                            Select up to {group.maxSelect}
                          </span>
                        )}
                        {group.isRequired && (
                          <Badge variant="outline" className="text-[10px]">Required</Badge>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {group.options.filter((o) => o.isActive).map((option) => {
                        const isSelected = isOptionSelected(group.id, option.id);
                        const qty = getOptionQuantity(group.id, option.id);
                        const showQtyControls = isSelected && group.maxSelect && group.maxSelect > 1;
                        
                        return (
                          <Card 
                            key={option.id} 
                            className={`cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                            onClick={() => !showQtyControls && handleOptionSelect(group, option)}
                            data-testid={`card-addon-${option.id}`}
                          >
                            <CardContent className="p-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                                  isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'
                                }`}>
                                  {isSelected && <Check className="h-3 w-3" />}
                                </div>
                                <div>
                                  <span className="text-sm font-medium">{option.label}</span>
                                  {option.priceDelta > 0 && (
                                    <span className="text-xs text-muted-foreground ml-2">
                                      +${option.priceDelta.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              {showQtyControls && (
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleOptionQuantityChange(group.id, option.id, -1)}
                                    data-testid={`button-addon-minus-${option.id}`}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-6 text-center text-sm font-medium">{qty}</span>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleOptionQuantityChange(group.id, option.id, 1)}
                                    data-testid={`button-addon-plus-${option.id}`}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <h4 className="font-medium text-sm">Special Instructions</h4>
              <Textarea
                placeholder="Add any special requests (allergies, preferences, etc.)"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                className="resize-none text-sm"
                rows={2}
                data-testid="input-special-instructions"
              />
            </div>

            {item.upsellItems && item.upsellItems.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-1.5">
                    <Info className="h-4 w-4 text-primary" />
                    You might also like
                  </h4>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {item.upsellItems.map((upsell) => (
                      <Card 
                        key={upsell.id}
                        className="flex-shrink-0 w-32 cursor-pointer hover-elevate"
                        onClick={() => onUpsellItemClick?.(upsell.id)}
                        data-testid={`card-upsell-${upsell.id}`}
                      >
                        <CardContent className="p-2">
                          {upsell.imageUrl ? (
                            <img 
                              src={upsell.imageUrl} 
                              alt={upsell.name}
                              className="w-full h-20 object-cover rounded mb-2"
                            />
                          ) : (
                            <div className="w-full h-20 bg-muted rounded mb-2" />
                          )}
                          <p className="text-xs font-medium truncate">{upsell.name}</p>
                          <p className="text-xs text-primary font-medium">${upsell.price.toFixed(2)}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="sticky bottom-0 bg-background border-t p-4 space-y-3">
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                data-testid="button-quantity-minus"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-xl font-bold w-8 text-center">{quantity}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={() => setQuantity(quantity + 1)}
                disabled={quantity >= 99}
                data-testid="button-quantity-plus"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={handleAddToCart}
              disabled={!allRequiredSelected}
              data-testid="button-add-to-cart"
            >
              {!allRequiredSelected ? (
                <span className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Make required selections
                </span>
              ) : (
                <>
                  Add to Cart - ${itemTotal.toFixed(2)}
                </>
              )}
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
