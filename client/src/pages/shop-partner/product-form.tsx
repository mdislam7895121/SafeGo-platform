import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Package, Camera, ChevronLeft, Loader2, Check, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const productCategories = [
  { value: "grocery", label: "মুদি সামগ্রী" },
  { value: "snacks", label: "স্ন্যাকস" },
  { value: "beverages", label: "পানীয়" },
  { value: "personal_care", label: "ব্যক্তিগত যত্ন" },
  { value: "household", label: "গৃহস্থালি" },
  { value: "electronics", label: "ইলেকট্রনিক্স" },
  { value: "clothing", label: "পোশাক" },
  { value: "medicine", label: "ওষুধ" },
  { value: "stationery", label: "স্টেশনারি" },
  { value: "other", label: "অন্যান্য" },
];

const unitOptions = [
  { value: "piece", label: "পিস" },
  { value: "kg", label: "কেজি" },
  { value: "gram", label: "গ্রাম" },
  { value: "liter", label: "লিটার" },
  { value: "pack", label: "প্যাক" },
  { value: "box", label: "বক্স" },
  { value: "dozen", label: "ডজন" },
];

const productSchema = z.object({
  productName: z.string().min(2, "পণ্যের নাম লিখুন"),
  price: z.number().min(1, "সঠিক দাম লিখুন"),
  category: z.string().min(1, "ক্যাটাগরি নির্বাচন করুন"),
  description: z.string().optional(),
  unit: z.string().optional(),
  stockQuantity: z.number().optional(),
});

export default function ProductForm() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/shop-partner/products/:id");
  const productId = params?.id;
  const isEdit = productId && productId !== "new";
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: existingProduct, isLoading: productLoading } = useQuery<{ product: any }>({
    queryKey: ["/api/shop-partner/products", productId],
    enabled: !!isEdit,
  });

  const form = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      productName: "",
      price: 0,
      category: "",
      description: "",
      unit: "piece",
      stockQuantity: undefined as number | undefined,
    },
  });

  useEffect(() => {
    if (existingProduct?.product) {
      const p = existingProduct.product;
      form.reset({
        productName: p.productName,
        price: Number(p.price),
        category: p.category,
        description: p.description || "",
        unit: p.unit || "piece",
        stockQuantity: p.stockQuantity || undefined,
      });
      if (p.imageUrl) {
        setImagePreview(p.imageUrl);
      }
    }
  }, [existingProduct, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEdit) {
        return apiRequest(`/api/shop-partner/products/${productId}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
      } else {
        return apiRequest("/api/shop-partner/products", {
          method: "POST",
          body: JSON.stringify(data),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop-partner/products"] });
      toast({
        title: "সফল!",
        description: isEdit ? "পণ্য আপডেট হয়েছে।" : "পণ্য সংরক্ষণ হয়েছে।",
      });
      navigate("/shop-partner/products");
    },
    onError: (error: any) => {
      toast({
        title: "ত্রুটি",
        description: error.message || "পণ্য সংরক্ষণ ব্যর্থ হয়েছে।",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/shop-partner/products/${productId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop-partner/products"] });
      toast({
        title: "সফল!",
        description: "পণ্য মুছে ফেলা হয়েছে।",
      });
      navigate("/shop-partner/products");
    },
  });

  const handleSubmit = (data: any) => {
    saveMutation.mutate(data);
  };

  if (isEdit && productLoading) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      <Button
        variant="ghost"
        className="mb-4 gap-2"
        onClick={() => navigate("/shop-partner/products")}
        data-testid="button-back"
      >
        <ChevronLeft className="h-5 w-5" />
        পণ্য তালিকা
      </Button>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <Package className="h-6 w-6 text-primary" />
            {isEdit ? "পণ্য সম্পাদনা" : "নতুন পণ্য যোগ করুন"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="productName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">পণ্যের নাম</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="যেমন: চিনি ১ কেজি"
                        className="h-12 text-base"
                        data-testid="input-product-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">দাম (৳)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">
                          ৳
                        </span>
                        <Input
                          {...field}
                          type="number"
                          placeholder="0"
                          className="h-14 text-2xl font-bold pl-10"
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          data-testid="input-product-price"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">ক্যাটাগরি</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 text-base" data-testid="select-category">
                          <SelectValue placeholder="ক্যাটাগরি নির্বাচন করুন" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {productCategories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value} className="text-base">
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <Label className="text-base mb-3 block">পণ্যের ছবি</Label>
                <div className="flex items-center gap-4">
                  {imagePreview ? (
                    <div className="h-24 w-24 rounded-xl overflow-hidden border-2 border-dashed">
                      <img src={imagePreview} alt="Product" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-24 w-24 rounded-xl border-2 border-dashed flex items-center justify-center bg-muted/50">
                      <Camera className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 text-base"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.capture = "environment";
                      input.onchange = (e: any) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (e) => {
                            setImagePreview(e.target?.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      };
                      input.click();
                    }}
                    data-testid="button-upload-image"
                  >
                    <Camera className="h-5 w-5 mr-2" />
                    ছবি তুলুন
                  </Button>
                </div>
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">বর্ণনা (ঐচ্ছিক)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="পণ্যের বিবরণ লিখুন..."
                        className="min-h-20 text-base resize-none"
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">মাপ/ইউনিট</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 text-base" data-testid="select-unit">
                            <SelectValue placeholder="ইউনিট" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {unitOptions.map((unit) => (
                            <SelectItem key={unit.value} value={unit.value} className="text-base">
                              {unit.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="stockQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">স্টক পরিমাণ</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          placeholder="ঐচ্ছিক"
                          className="h-12 text-base"
                          onChange={(e) =>
                            field.onChange(e.target.value ? Number(e.target.value) : undefined)
                          }
                          value={field.value ?? ""}
                          data-testid="input-stock"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-14 text-lg"
                  disabled={saveMutation.isPending}
                  data-testid="button-save"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-5 w-5 mr-2" />
                      সেভ করুন
                    </>
                  )}
                </Button>

                {isEdit && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="w-full h-12 text-destructive hover:text-destructive"
                        data-testid="button-delete"
                      >
                        <Trash2 className="h-5 w-5 mr-2" />
                        পণ্য মুছুন
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>আপনি কি নিশ্চিত?</AlertDialogTitle>
                        <AlertDialogDescription>
                          এই পণ্যটি স্থায়ীভাবে মুছে যাবে। এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>বাতিল</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate()}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "মুছে ফেলুন"
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
