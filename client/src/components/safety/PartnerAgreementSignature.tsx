import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, CheckCircle, Pen, Type, Download, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface PartnerAgreementSignatureProps {
  version?: string;
  onSuccess?: () => void;
  className?: string;
}

interface PartnerAgreement {
  id: string;
  partnerId: string;
  partnerType: string;
  version: string;
  signedAt: string;
  signatureData?: string;
  signatureMethod: string;
  isValid: boolean;
}

export function PartnerAgreementSignature({ version = "1.0", onSuccess, className = "" }: PartnerAgreementSignatureProps) {
  const [signatureMethod, setSignatureMethod] = useState<"typed" | "drawn">("typed");
  const [typedSignature, setTypedSignature] = useState("");
  const [drawnSignature, setDrawnSignature] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToConduct, setAgreedToConduct] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const { toast } = useToast();

  const { data: existingAgreement, isLoading } = useQuery<{ success: boolean; agreement: PartnerAgreement | null }>({
    queryKey: ["/api/policy-safety/partner-agreement/my"],
  });

  const { data: codeOfConduct } = useQuery<{ success: boolean; codeOfConduct: any }>({
    queryKey: ["/api/policy-safety/code-of-conduct/active"],
  });

  const signMutation = useMutation({
    mutationFn: async () => {
      const signatureData = signatureMethod === "typed" ? typedSignature : drawnSignature;
      return apiRequest("/api/policy-safety/partner-agreement/sign", {
        method: "POST",
        body: JSON.stringify({
          version,
          signatureData,
          signatureMethod,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Agreement Signed",
        description: "Thank you for signing the partner agreement.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/policy-safety/partner-agreement/my"] });
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to sign agreement. Please try again.",
        variant: "destructive",
      });
    },
  });

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setDrawnSignature(canvas.toDataURL());
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDrawnSignature(null);
  };

  const canSign = agreedToTerms && agreedToConduct && (
    (signatureMethod === "typed" && typedSignature.length >= 2) ||
    (signatureMethod === "drawn" && drawnSignature)
  );

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/2" />
            <div className="h-24 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (existingAgreement?.agreement?.isValid) {
    return (
      <Card className={`border-green-200 ${className}`}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-500" />
            <CardTitle>Partner Agreement Signed</CardTitle>
          </div>
          <CardDescription>You have already signed the partner agreement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div>
                <p className="font-medium">Agreement Version</p>
                <p className="text-sm text-muted-foreground">v{existingAgreement.agreement.version}</p>
              </div>
              <Badge className="bg-green-500">Active</Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Signed on</p>
                <p className="font-medium">
                  {format(new Date(existingAgreement.agreement.signedAt), "MMM d, yyyy h:mm a")}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Signature Method</p>
                <p className="font-medium capitalize">{existingAgreement.agreement.signatureMethod}</p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full" data-testid="button-download-agreement">
            <Download className="h-4 w-4 mr-2" />
            Download Copy
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Partner Agreement
        </CardTitle>
        <CardDescription>Please review and sign the partner agreement to continue</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            This agreement is required to operate as a SafeGo partner. Please read carefully before signing.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="p-4 border rounded-lg">
            <h4 className="font-medium mb-2">Partner Terms & Conditions</h4>
            <ScrollArea className="h-32">
              <div className="text-sm text-muted-foreground space-y-2">
                <p>By signing this agreement, you agree to:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Follow all SafeGo policies and guidelines</li>
                  <li>Maintain professional conduct at all times</li>
                  <li>Provide accurate and truthful information</li>
                  <li>Keep your account information secure</li>
                  <li>Report any safety incidents immediately</li>
                  <li>Accept SafeGo's commission and payment terms</li>
                </ul>
              </div>
            </ScrollArea>
          </div>

          {codeOfConduct?.codeOfConduct && (
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">{codeOfConduct.codeOfConduct.title}</h4>
              <ScrollArea className="h-32">
                <div className="text-sm text-muted-foreground">
                  <p>{codeOfConduct.codeOfConduct.summary || "Please review our code of conduct for partners."}</p>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="agree-terms"
              checked={agreedToTerms}
              onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              data-testid="checkbox-agree-terms"
            />
            <Label htmlFor="agree-terms" className="text-sm">
              I have read and agree to the Partner Terms & Conditions
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="agree-conduct"
              checked={agreedToConduct}
              onCheckedChange={(checked) => setAgreedToConduct(checked as boolean)}
              data-testid="checkbox-agree-conduct"
            />
            <Label htmlFor="agree-conduct" className="text-sm">
              I agree to follow the SafeGo Code of Conduct
            </Label>
          </div>
        </div>

        <Tabs value={signatureMethod} onValueChange={(v) => setSignatureMethod(v as "typed" | "drawn")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="typed" data-testid="tab-typed">
              <Type className="h-4 w-4 mr-2" />
              Type Signature
            </TabsTrigger>
            <TabsTrigger value="drawn" data-testid="tab-drawn">
              <Pen className="h-4 w-4 mr-2" />
              Draw Signature
            </TabsTrigger>
          </TabsList>
          <TabsContent value="typed" className="mt-4">
            <div className="space-y-2">
              <Label>Type your full legal name</Label>
              <Input
                placeholder="Your Full Name"
                value={typedSignature}
                onChange={(e) => setTypedSignature(e.target.value)}
                className="text-xl font-signature"
                style={{ fontFamily: "cursive" }}
                data-testid="input-typed-signature"
              />
            </div>
          </TabsContent>
          <TabsContent value="drawn" className="mt-4">
            <div className="space-y-2">
              <Label>Draw your signature below</Label>
              <div className="border rounded-lg p-2 bg-white">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={120}
                  className="w-full cursor-crosshair border rounded"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  data-testid="canvas-signature"
                />
              </div>
              <Button variant="outline" size="sm" onClick={clearCanvas} data-testid="button-clear-signature">
                Clear
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={() => signMutation.mutate()}
          disabled={!canSign || signMutation.isPending}
          data-testid="button-sign-agreement"
        >
          {signMutation.isPending ? "Signing..." : "Sign Agreement"}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default PartnerAgreementSignature;
