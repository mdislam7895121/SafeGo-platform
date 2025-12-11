import { Link } from "wouter";
import { ArrowLeft, Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

const languages = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
];

export default function LanguageSettings() {
  const { toast } = useToast();

  const { data: preferences } = useQuery({
    queryKey: ["/api/driver/preferences"],
  });

  const currentLang = preferences?.preferredLanguage || "en";

  const updateLanguageMutation = useMutation({
    mutationFn: async (preferredLanguage: string) => {
      const result = await apiRequest("/api/driver/preferences/language", {
        method: "PATCH",
        body: JSON.stringify({ preferredLanguage }),
        headers: { "Content-Type": "application/json" },
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/preferences"] });
      toast({ title: "Language preference updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update language preference",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSelectLanguage = (langCode: string) => {
    if (langCode !== currentLang) {
      updateLanguageMutation.mutate(langCode);
    }
  };

  return (
    <div className="bg-background">
      <div className="bg-primary text-primary-foreground p-6">
        <div className="flex items-center gap-4">
          <Link href="/driver/account">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Language</h1>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>App Language</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleSelectLanguage(lang.code)}
                disabled={updateLanguageMutation.isPending}
                className="flex items-center justify-between w-full p-4 hover-elevate active-elevate-2 rounded-lg text-left"
                data-testid={`button-lang-${lang.code}`}
              >
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{lang.name}</p>
                    <p className="text-sm text-muted-foreground">{lang.nativeName}</p>
                  </div>
                </div>
                {lang.code === currentLang && (
                  <Check className="h-5 w-5 text-primary" />
                )}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
