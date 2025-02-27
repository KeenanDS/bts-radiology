
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, ListPlus, CheckCircle, CalendarDays, Plus, Minus, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/admin/Sidebar";

interface ScheduledPost {
  id: string;
  scheduled_for: string;
  num_posts: number;
  topics: string[];
  auto_generate_topics: boolean;
  auto_fact_check: boolean;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

const SchedulerPage = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [numPosts, setNumPosts] = useState(1);
  const [autoGenerateTopics, setAutoGenerateTopics] = useState(true);
  const [autoFactCheck, setAutoFactCheck] = useState(true);
  const [topics, setTopics] = useState<string[]>([]);
  const [customTopics, setCustomTopics] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchScheduledPosts();
  }, []);

  const fetchScheduledPosts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("scheduled_posts")
        .select("*")
        .order("scheduled_for", { ascending: true });

      if (error) {
        throw error;
      }

      // Transform the data to match our ScheduledPost interface
      const formattedPosts: ScheduledPost[] = (data || []).map((post: any) => ({
        id: post.id,
        scheduled_for: post.scheduled_for,
        num_posts: post.num_posts,
        topics: Array.isArray(post.topics) ? post.topics : [],
        auto_generate_topics: post.auto_generate_topics,
        auto_fact_check: post.auto_fact_check,
        status: post.status,
        created_at: post.created_at,
        completed_at: post.completed_at,
        error_message: post.error_message
      }));

      setScheduledPosts(formattedPosts);
    } catch (error) {
      console.error("Error fetching scheduled posts:", error);
      toast({
        title: "Error",
        description: "Failed to fetch scheduled posts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!date) {
      toast({
        title: "Error",
        description: "Please select a date for scheduling.",
        variant: "destructive",
      });
      return;
    }

    // Parse topics if manual entry is selected
    let parsedTopics: string[] = [];
    if (!autoGenerateTopics) {
      // Split by newlines and filter out empty lines
      parsedTopics = customTopics
        .split("\n")
        .map(topic => topic.trim())
        .filter(topic => topic.length > 0);

      if (parsedTopics.length === 0) {
        toast({
          title: "Error",
          description: "Please enter at least one topic.",
          variant: "destructive",
        });
        return;
      }

      if (parsedTopics.length < numPosts) {
        toast({
          title: "Warning",
          description: `You've requested ${numPosts} posts but only provided ${parsedTopics.length} topics. Additional topics will be auto-generated.`,
        });
      }
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("scheduled_posts")
        .insert([
          {
            scheduled_for: format(date, "yyyy-MM-dd"),
            num_posts: numPosts,
            topics: !autoGenerateTopics ? parsedTopics : [],
            auto_generate_topics: autoGenerateTopics,
            auto_fact_check: autoFactCheck,
          },
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: `Successfully scheduled ${numPosts} post(s) for ${format(date, "MMMM d, yyyy")}.`,
      });

      // Reset form
      setDate(new Date());
      setNumPosts(1);
      setAutoGenerateTopics(true);
      setAutoFactCheck(true);
      setCustomTopics("");
      
      // Refresh the scheduled posts list
      fetchScheduledPosts();
    } catch (error) {
      console.error("Error scheduling posts:", error);
      toast({
        title: "Error",
        description: "Failed to schedule posts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-blue-900/20 text-blue-400 border-blue-800">Pending</Badge>;
      case "processing":
        return <Badge variant="outline" className="bg-orange-900/20 text-orange-400 border-orange-800">Processing</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-900/20 text-green-400 border-green-800">Completed</Badge>;
      case "failed":
        return <Badge variant="outline" className="bg-red-900/20 text-red-400 border-red-800">Failed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0a0b17]">
      <Sidebar />
      
      <div className="flex-1 p-6 bg-gradient-to-br from-[#0a0b17] via-[#111936] to-[#0a0b17]">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Post Scheduler</h1>
              <p className="text-gray-400 mt-1">Schedule automatic blog post generation</p>
            </div>
          </div>

          <Separator className="bg-[#2a2f4d] opacity-50" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Scheduler Form */}
            <Card className="col-span-1 bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
              <CardHeader>
                <CardTitle className="text-white">Schedule New Posts</CardTitle>
                <CardDescription className="text-gray-400">
                  Set up your automated post generation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Date Picker */}
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-sm text-gray-300">Schedule Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal bg-[#1a1f3d] border-[#2a2f4d] text-white hover:bg-[#2a2f5d]"
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : "Select a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-[#1a1f3d] border-[#2a2f4d]">
                      <CalendarComponent
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        initialFocus
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        className="bg-[#1a1f3d] text-white"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Number of Posts */}
                <div className="space-y-2">
                  <Label htmlFor="numPosts" className="text-sm text-gray-300">Number of Posts</Label>
                  <div className="flex items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setNumPosts(Math.max(1, numPosts - 1))}
                      className="bg-[#1a1f3d] border-[#2a2f4d] text-white hover:bg-[#2a2f5d]"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="w-12 mx-2 text-center text-white font-bold">
                      {numPosts}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setNumPosts(Math.min(3, numPosts + 1))}
                      className="bg-[#1a1f3d] border-[#2a2f4d] text-white hover:bg-[#2a2f5d]"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Auto Generate Topics Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoGenerateTopics" className="text-sm text-gray-300">Auto-generate Topics</Label>
                    <p className="text-[10px] text-gray-500">Let AI choose blog topics</p>
                  </div>
                  <Switch
                    id="autoGenerateTopics"
                    checked={autoGenerateTopics}
                    onCheckedChange={setAutoGenerateTopics}
                  />
                </div>

                {/* Manual Topics Input (conditionally displayed) */}
                {!autoGenerateTopics && (
                  <div className="space-y-2">
                    <Label htmlFor="topics" className="text-sm text-gray-300">
                      Enter Topics (one per line)
                    </Label>
                    <Textarea
                      id="topics"
                      value={customTopics}
                      onChange={(e) => setCustomTopics(e.target.value)}
                      placeholder="5 Ways to Advance Your Radiology Career in 2024
How AI is Transforming Medical Imaging"
                      className="min-h-[120px] bg-[#1a1f3d] border-[#2a2f4d] text-white"
                    />
                  </div>
                )}

                {/* Auto Fact Check Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoFactCheck" className="text-sm text-gray-300">Auto Fact Check</Label>
                    <p className="text-[10px] text-gray-500">Automatically check facts after generation</p>
                  </div>
                  <Switch
                    id="autoFactCheck"
                    checked={autoFactCheck}
                    onCheckedChange={setAutoFactCheck}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full bg-[#2a2f5d] hover:bg-[#3a3f7d] text-white"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Clock className="mr-2 h-4 w-4 animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    <>
                      <Calendar className="mr-2 h-4 w-4" />
                      Schedule Posts
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            {/* Scheduled Posts */}
            <Card className="col-span-1 lg:col-span-2 bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
              <CardHeader>
                <CardTitle className="text-white">Scheduled Posts</CardTitle>
                <CardDescription className="text-gray-400">
                  View and manage your scheduled post generations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="py-8 text-center">
                    <Clock className="h-8 w-8 animate-spin mx-auto text-gray-500 mb-2" />
                    <p className="text-gray-500">Loading scheduled posts...</p>
                  </div>
                ) : scheduledPosts.length === 0 ? (
                  <div className="py-12 text-center">
                    <ListPlus className="h-12 w-12 mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-400">No scheduled posts yet</p>
                    <p className="text-gray-500 text-sm mt-2">Use the form to schedule your first blog post generation</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {scheduledPosts.map((post) => (
                      <div key={post.id} className="p-4 rounded-md bg-[#1a1f3d] border border-[#2a2f4d]">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center mb-2">
                              <CalendarDays className="h-4 w-4 text-blue-400 mr-2" />
                              <span className="text-white font-medium">
                                {new Date(post.scheduled_for).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                            <div className="text-sm text-gray-400 mb-2">
                              {post.num_posts} post{post.num_posts > 1 ? "s" : ""} to generate
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {post.auto_generate_topics ? (
                                <Badge variant="outline" className="bg-purple-900/20 text-purple-400 border-purple-800">Auto Topics</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-indigo-900/20 text-indigo-400 border-indigo-800">Manual Topics</Badge>
                              )}
                              {post.auto_fact_check ? (
                                <Badge variant="outline" className="bg-cyan-900/20 text-cyan-400 border-cyan-800">Auto Fact Check</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-gray-900/20 text-gray-400 border-gray-800">No Fact Check</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            {getStatusBadge(post.status)}
                            {post.error_message && (
                              <div className="mt-2 text-xs text-red-400 max-w-[200px] text-right">
                                {post.error_message}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {!post.auto_generate_topics && post.topics.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-[#2a2f4d]">
                            <p className="text-xs text-gray-500 mb-1">Topics:</p>
                            <div className="flex flex-wrap gap-1">
                              {post.topics.map((topic, index) => (
                                <Badge key={index} variant="outline" className="bg-[#2a2f5d] text-white border-[#3a3f7d]">
                                  {topic}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
};

export default SchedulerPage;
