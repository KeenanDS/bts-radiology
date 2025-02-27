import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUpDown, Download, FileDown, Check, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/admin/Sidebar";

interface BlogPost {
  id: string;
  title: string;
  content: string;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
  fact_check_results?: {
    id: string;
    issues: Array<{
      claim: string;
      issue: string;
      suggestion?: string;
    }>;
    checked_at: string;
  } | null;
}

const BlogPostsPage = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [pdfGenerating, setPdfGenerating] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPosts();
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

      setPosts(data || []);
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
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSortOrder}
              className="bg-[#1a1f3d] border-[#2a2f4d] text-white hover:bg-[#2a2f5d]"
            >
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Sort by {sortOrder === "asc" ? "Oldest" : "Newest"}
            </Button>
          </div>

          <Separator className="bg-[#2a2f4d] opacity-50" />

          <div className="mt-6 space-y-4">
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
        </div>
      </div>
      <Toaster />
    </div>
  );
};

export default BlogPostsPage;
