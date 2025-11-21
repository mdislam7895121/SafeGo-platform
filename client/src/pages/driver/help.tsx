import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle, MessageCircle, Phone, Mail, FileText } from "lucide-react";

export default function DriverHelp() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold mb-2">Help Center</h1>
        <p className="text-muted-foreground">
          Get support and find answers to common questions
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Live Chat Support
            </CardTitle>
            <CardDescription>Chat with our support team in real-time</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" data-testid="button-live-chat">
              Start Chat
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Call Us
            </CardTitle>
            <CardDescription>Speak to a support representative</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" data-testid="button-call">
              +880 1XXX-XXXXXX
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Support
            </CardTitle>
            <CardDescription>Send us an email</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" data-testid="button-email">
              support@safego.com
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              FAQ & Guides
            </CardTitle>
            <CardDescription>Browse common questions and guides</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" data-testid="button-faq">
              View FAQs
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Common Topics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <span>How do I update my vehicle documents?</span>
            <Button variant="ghost" size="sm">View</Button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <span>Understanding my earnings and commission</span>
            <Button variant="ghost" size="sm">View</Button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <span>How to handle passenger issues?</span>
            <Button variant="ghost" size="sm">View</Button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <span>Tax information and reporting</span>
            <Button variant="ghost" size="sm">View</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
