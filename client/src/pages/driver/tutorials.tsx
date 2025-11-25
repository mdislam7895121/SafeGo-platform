import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  BookOpen, 
  Play, 
  CheckCircle2, 
  Clock, 
  Filter,
  Car,
  Utensils,
  DollarSign,
  Shield,
  Settings,
  Loader2,
  Video,
  GraduationCap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Tutorial {
  id: string;
  title: string;
  description: string;
  duration: string;
  category: string;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  viewed: boolean;
}

interface TutorialsResponse {
  tutorials: Tutorial[];
  categories: string[];
  totalViewed: number;
  totalTutorials: number;
}

const CATEGORY_ICONS: Record<string, any> = {
  rides: Car,
  food: Utensils,
  earnings: DollarSign,
  safety: Shield,
  general: Settings,
};

const CATEGORY_LABELS: Record<string, string> = {
  rides: "Rides",
  food: "Food Delivery",
  earnings: "Earnings",
  safety: "Safety",
  general: "General",
};

export default function DriverTutorials() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);

  const { data, isLoading } = useQuery<TutorialsResponse>({
    queryKey: ["/api/driver/tutorials", selectedCategory],
    queryFn: async () => {
      const url = selectedCategory === "all" 
        ? "/api/driver/tutorials"
        : `/api/driver/tutorials?category=${selectedCategory}`;
      const token = localStorage.getItem("safego_token");
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch tutorials");
      return res.json();
    },
  });

  const markViewedMutation = useMutation({
    mutationFn: async (tutorialId: string) => {
      return await apiRequest(`/api/driver/tutorials/${tutorialId}/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/tutorials"] });
    },
  });

  const handleWatchTutorial = (tutorial: Tutorial) => {
    setSelectedTutorial(tutorial);
    if (!tutorial.viewed) {
      markViewedMutation.mutate(tutorial.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const tutorials = data?.tutorials || [];
  const categories = data?.categories || [];
  const totalViewed = data?.totalViewed || 0;
  const totalTutorials = data?.totalTutorials || 0;
  const progressPercent = totalTutorials > 0 ? Math.round((totalViewed / totalTutorials) * 100) : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-tutorials-title">
            <GraduationCap className="h-7 w-7 text-primary" />
            Training Videos
          </h1>
          <p className="text-muted-foreground">Learn everything you need to succeed as a SafeGo driver</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Your Progress</span>
                <span className="text-sm text-muted-foreground">
                  {totalViewed} of {totalTutorials} watched
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" data-testid="progress-tutorials" />
            </div>
            {progressPercent === 100 && (
              <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                All Complete
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
        <TabsList className="w-full flex flex-wrap justify-start gap-1 h-auto p-1 bg-muted/50">
          <TabsTrigger 
            value="all" 
            className="data-[state=active]:bg-background"
            data-testid="tab-all"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            All
          </TabsTrigger>
          {categories.map((category) => {
            const Icon = CATEGORY_ICONS[category] || BookOpen;
            return (
              <TabsTrigger 
                key={category} 
                value={category}
                className="data-[state=active]:bg-background"
                data-testid={`tab-${category}`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {CATEGORY_LABELS[category] || category}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-6">
          {tutorials.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No tutorials found in this category</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tutorials.map((tutorial) => {
                const CategoryIcon = CATEGORY_ICONS[tutorial.category] || BookOpen;
                return (
                  <Card 
                    key={tutorial.id} 
                    className="overflow-hidden hover-elevate cursor-pointer group"
                    onClick={() => handleWatchTutorial(tutorial)}
                    data-testid={`card-tutorial-${tutorial.id}`}
                  >
                    <div className="relative aspect-video bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                      <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Play className="h-6 w-6 text-primary ml-1" />
                      </div>
                      {tutorial.viewed && (
                        <div className="absolute top-2 right-2">
                          <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Watched
                          </Badge>
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2">
                        <Badge variant="secondary">
                          <CategoryIcon className="h-3 w-3 mr-1" />
                          {CATEGORY_LABELS[tutorial.category] || tutorial.category}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-1 line-clamp-1">{tutorial.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {tutorial.description}
                      </p>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 mr-1" />
                        {tutorial.duration}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedTutorial} onOpenChange={(open) => !open && setSelectedTutorial(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedTutorial?.title}</DialogTitle>
            <DialogDescription>{selectedTutorial?.description}</DialogDescription>
          </DialogHeader>
          
          <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 rounded-lg flex flex-col items-center justify-center">
            <Video className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-2">Video Coming Soon</p>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              This tutorial video is being prepared. Check back later for the full content.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-4">
              <Badge variant="secondary">
                <Clock className="h-3 w-3 mr-1" />
                {selectedTutorial?.duration}
              </Badge>
              {selectedTutorial?.viewed && (
                <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Watched
                </Badge>
              )}
            </div>
            <Button variant="outline" onClick={() => setSelectedTutorial(null)} data-testid="button-close-tutorial">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
