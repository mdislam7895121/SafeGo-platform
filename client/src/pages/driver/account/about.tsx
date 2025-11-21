import { Link } from "wouter";
import { ArrowLeft, Info, Shield, FileText, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/driver/account">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">About</h1>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Info className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">SafeGo Driver</h2>
            <p className="text-muted-foreground mb-4">Version 2.0.0 (Build 2024.11)</p>
            <p className="text-sm text-muted-foreground">
              © 2024 SafeGo Global. All rights reserved.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Legal & Support</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <button className="flex items-center gap-3 w-full p-3 hover-elevate active-elevate-2 rounded-lg text-left" data-testid="button-terms">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span>Terms of Service</span>
            </button>
            <button className="flex items-center gap-3 w-full p-3 hover-elevate active-elevate-2 rounded-lg text-left" data-testid="button-privacy-policy">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <span>Privacy Policy</span>
            </button>
            <button className="flex items-center gap-3 w-full p-3 hover-elevate active-elevate-2 rounded-lg text-left" data-testid="button-contact-support">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <span>Contact Support</span>
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open Source Licenses</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" data-testid="button-licenses">
              View Licenses
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
