
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";
import { ArrowUpDown, Download, FileDown, Check, Clock, AlertTriangle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/admin/Sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FactCheckIssue {
  claim: string;
  issue: string;
  suggestion?: string;
}

interface FactCheckResult {
  id: string;
  issues: FactCheckIssue[];
  checked_at: string;
}

interface RawFactCheckResult {
  id: string;
  issues: Json;
  checked_at: string;
}

interface BlogPost {
  id: string;
  title: string;
  content: string;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
  fact_check_results?: FactCheckResult | null;
  scheduled_post_id?: string | null;
}

interface ScheduledPost {
  id: string;
  scheduled_for: string;
  num_posts: number;
  topics: string[];
  auto_generate_topics: boolean;
  auto_fact_check: boolean;
  status: string;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

const BlogPostsPage = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingScheduled, setLoadingScheduled] = useState(true);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [pdfGenerating, setPdfGenerating] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPosts();
    fetchScheduledPosts();
  }, [sortOrder]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("blog_posts")
        .select(`
          *,
          fact_check_results (
            id,
            issues,
            checked_at
          )
        `)
        .order("updated_at", { ascending: sortOrder === "asc" });

      if (error) {
        throw error;
      }

      // Process and transform the data to match our BlogPost interface
      const processedPosts: BlogPost[] = (data || []).map((post: any) => {
        // Handle fact check results type conversion
        let factCheckResults = null;
        if (post.fact_check_results) {
          const rawResults = post.fact_check_results as RawFactCheckResult;
          factCheckResults = {
            id: rawResults.id,
            checked_at: rawResults.checked_at,
            // Properly map the issues array with type safety
            issues: Array.isArray(rawResults.issues) 
              ? rawResults.issues.map((issue: any): FactCheckIssue => ({
                  claim: issue.claim || "",
                  issue: issue.issue || "",
                  suggestion: issue.suggestion
                }))
              : []
          };
        }

        return {
          id: post.id,
          title: post.title,
          content: post.content,
          meta_description: post.meta_description,
          created_at: post.created_at,
          updated_at: post.updated_at,
          fact_check_results: factCheckResults,
          scheduled_post_id: post.scheduled_post_id
        };
      });

      setPosts(processedPosts);
    } catch (error) {
      console.error("Error fetching posts:", error);
      toast({
        title: "Error",
        description: "Failed to fetch blog posts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduledPosts = async () => {
    setLoadingScheduled(true);
    try {
      const { data, error } = await supabase
        .from("scheduled_posts")
        .select("*")
        .order("scheduled_for", { ascending: true });

      if (error) {
        throw error;
      }

      // Process and transform the data to match our ScheduledPost interface
      const processedScheduledPosts: ScheduledPost[] = (data || []).map((post: any) => ({
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

      setScheduledPosts(processedScheduledPosts);
    } catch (error) {
      console.error("Error fetching scheduled posts:", error);
      toast({
        title: "Error",
        description: "Failed to fetch scheduled posts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingScheduled(false);
    }
  };

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const downloadAsMarkdown = (post: BlogPost) => {
    const mdContent = `# ${post.title}\n\n${post.content}`;
    const blob = new Blob([mdContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${post.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Success",
      description: "Markdown file downloaded successfully!",
    });
  };

  const downloadAsPDF = async (post: BlogPost) => {
    try {
      setPdfGenerating(post.id);
      toast({
        title: "Processing",
        description: "Converting to PDF, please wait...",
      });

      const { data, error } = await supabase.functions.invoke("markdown-to-pdf", {
        body: JSON.stringify({
          title: post.title,
          content: post.content,
        }),
      });

      if (error) {
        console.error("PDF generation error:", error);
        throw new Error("Failed to generate PDF");
      }

      if (!data?.pdfBase64) {
        throw new Error("No PDF data received");
      }

      const binary = atob(data.pdfBase64);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      
      const blob = new Blob([array], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${post.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "PDF downloaded successfully!",
      });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again or download as Markdown instead.",
        variant: "destructive",
      });
    } finally {
      setPdfGenerating(null);
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
              <h1 className="text-2xl font-bold text-white tracking-tight">Blog Posts</h1>
              <p className="text-gray-400 mt-1">Manage and download your blog posts</p>
            </div>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSortOrder}
                className="bg-[#1a1f3d] border-[#2a2f4d] text-white hover:bg-[#2a2f5d]"
              >
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Sort by {sortOrder === "asc" ? "Oldest" : "Newest"}
              </Button>
              
              <Link to="/admin/scheduler">
                <Button
                  variant="default"
                  size="sm"
                  className="bg-[#2a2f5d] hover:bg-[#3a3f7d] text-white"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Scheduler
                </Button>
              </Link>
            </div>
          </div>

          <Separator className="bg-[#2a2f4d] opacity-50" />

          <Tabs defaultValue="posts" className="w-full">
            <TabsList className="bg-[#1a1f3d] mb-6">
              <TabsTrigger
                value="posts"
                className="data-[state=active]:bg-[#2a2f5d] data-[state=active]:text-white"
              >
                Published
              </TabsTrigger>
              <TabsTrigger
                value="scheduled"
                className="data-[state=active]:bg-[#2a2f5d] data-[state=active]:text-white"
              >
                Scheduled
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="posts" className="mt-0">
              <div className="space-y-4">
                {loading ? (
                  <p className="text-center text-gray-400">Loading blog posts...</p>
                ) : posts.length === 0 ? (
                  <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
                    <CardContent className="pt-6">
                      <p className="text-center text-gray-400">No blog posts available yet.</p>
                    </CardContent>
                  </Card>
                ) : (
                  posts.map((post) => (
                    <Card key={post.id} className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-xl text-white">{post.title}</CardTitle>
                            <CardDescription className="text-gray-400 mt-1">
                              Last updated: {formatDate(post.updated_at)}
                            </CardDescription>
                          </div>
                          <div className="flex items-center">
                            {post.fact_check_results ? (
                              post.fact_check_results.issues.length === 0 ? (
                                <Badge variant="success" className="flex items-center gap-1">
                                  <Check className="h-3 w-3" />
                                  Fact Checked
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Issues Found
                                </Badge>
                              )
                            ) : (
                              <Badge variant="outline" className="flex items-center gap-1 bg-[#1a1f3d] text-gray-300">
                                <Clock className="h-3 w-3" />
                                Not Checked
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-gray-300 line-clamp-2 mb-4">
                          {post.meta_description || post.content.substring(0, 150) + "..."}
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="text-xs text-gray-400">
                            Created: {formatDate(post.created_at)}
                            {post.scheduled_post_id && (
                              <span className="ml-2 flex items-center gap-1 text-blue-400">
                                <Calendar className="h-3 w-3" /> Auto-generated
                              </span>
                            )}
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadAsMarkdown(post)}
                              className="bg-[#1a1f3d] border-[#2a2f4d] text-white hover:bg-[#2a2f5d]"
                            >
                              <FileDown className="h-4 w-4 mr-1" />
                              Markdown
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadAsPDF(post)}
                              disabled={pdfGenerating === post.id}
                              className="bg-[#1a1f3d] border-[#2a2f4d] text-white hover:bg-[#2a2f5d]"
                            >
                              {pdfGenerating === post.id ? (
                                <Clock className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <Download className="h-4 w-4 mr-1" />
                              )}
                              PDF
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="scheduled" className="mt-0">
              <div className="space-y-4">
                {loadingScheduled ? (
                  <p className="text-center text-gray-400">Loading scheduled posts...</p>
                ) : scheduledPosts.length === 0 ? (
                  <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
                    <CardContent className="pt-6 pb-6 text-center">
                      <p className="text-gray-400">No scheduled posts available yet.</p>
                      <Link to="/admin/scheduler">
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-[#2a2f5d] hover:bg-[#3a3f7d] text-white mt-4"
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule Posts
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ) : (
                  scheduledPosts.map((post) => (
                    <Card key={post.id} className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-xl text-white">Scheduled for {formatDate(post.scheduled_for)}</CardTitle>
                            <CardDescription className="text-gray-400 mt-1">
                              {post.num_posts} post{post.num_posts > 1 ? 's' : ''} to generate
                            </CardDescription>
                          </div>
                          <div>{getStatusBadge(post.status)}</div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2 mb-4">
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
                        
                        {(!post.auto_generate_topics || post.status !== 'pending') && post.topics.length > 0 && (
                          <div className="mt-3 mb-3">
                            <p className="text-xs text-gray-500 mb-2">Topics:</p>
                            <div className="flex flex-wrap gap-1">
                              {post.topics.map((topic, index) => (
                                <Badge key={index} variant="outline" className="bg-[#2a2f5d] text-white border-[#3a3f7d]">
                                  {topic}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center mt-2">
                          <div className="text-xs text-gray-400">
                            Created: {formatDate(post.created_at)}
                            {post.completed_at && (
                              <span className="ml-2">
                                Completed: {formatDate(post.completed_at)}
                              </span>
                            )}
                          </div>
                          {post.error_message && (
                            <div className="text-xs text-red-400">
                              Error: {post.error_message}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Toaster />
    </div>
  );
};

export default BlogPostsPage;
