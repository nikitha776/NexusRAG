// Mock data for development and testing
// Replace with real API calls in production

import type { Workspace, Document, ChatMessage } from "@/types";

export const MOCK_WORKSPACES: Workspace[] = [
  {
    id: "ws-1",
    name: "Marketing Strategy",
    description: "Analysis of Q1 marketing campaigns and competitor strategies",
    created_at: "2024-06-01T10:00:00Z",
    updated_at: "2024-06-15T14:30:00Z",
    document_count: 12,
  },
  {
    id: "ws-2",
    name: "Product Research",
    description: "Customer feedback and market research documents",
    created_at: "2024-05-15T09:00:00Z",
    updated_at: "2024-06-14T16:45:00Z",
    document_count: 8,
  },
  {
    id: "ws-3",
    name: "Legal Documents",
    description: "Contracts, NDAs, and legal agreements",
    created_at: "2024-04-10T11:20:00Z",
    updated_at: "2024-06-10T13:15:00Z",
    document_count: 15,
  },
];

export const MOCK_DOCUMENTS: Document[] = [
  {
    id: "doc-1",
    filename: "Q1_Marketing_Report.pdf",
    file_type: "application/pdf",
    file_size: 2.5 * 1024 * 1024, // 2.5 MB
    status: "ready",
    chunk_count: 24,
    created_at: "2024-06-14T10:00:00Z",
  },
  {
    id: "doc-2",
    filename: "Competitor_Analysis.docx",
    file_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    file_size: 1.8 * 1024 * 1024, // 1.8 MB
    status: "ready",
    chunk_count: 18,
    created_at: "2024-06-13T14:30:00Z",
  },
  {
    id: "doc-3",
    filename: "Campaign_Performance.xlsx",
    file_type: "application/vnd.ms-excel",
    file_size: 0.5 * 1024 * 1024, // 0.5 MB
    status: "processing",
    chunk_count: 0,
    created_at: "2024-06-15T11:00:00Z",
  },
  {
    id: "doc-4",
    filename: "Social_Media_Metrics.pdf",
    file_type: "application/pdf",
    file_size: 3.2 * 1024 * 1024, // 3.2 MB
    status: "ready",
    chunk_count: 32,
    created_at: "2024-06-12T09:45:00Z",
  },
  {
    id: "doc-5",
    filename: "Budget_Allocation.txt",
    file_type: "text/plain",
    file_size: 0.1 * 1024 * 1024, // 0.1 MB
    status: "error",
    chunk_count: 0,
    created_at: "2024-06-11T16:20:00Z",
  },
  {
    id: "doc-6",
    filename: "Customer_Testimonials.pdf",
    file_type: "application/pdf",
    file_size: 1.2 * 1024 * 1024, // 1.2 MB
    status: "ready",
    chunk_count: 15,
    created_at: "2024-06-10T13:15:00Z",
  },
];

export const MOCK_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "msg-1",
    role: "user",
    content: "Summarize the key findings from the marketing reports",
    citations: null,
    selected_doc_ids: ["doc-1", "doc-2"],
    created_at: "2024-06-15T10:00:00Z",
  },
  {
    id: "msg-2",
    role: "assistant",
    content:
      "Based on the Q1 marketing report and competitor analysis, here are the key findings:\n\n**Campaign Performance:**\n- Email campaigns achieved 28% open rate (above industry average of 21%)\n- Social media engagement increased by 45% compared to Q4\n- Conversion rate improved to 3.2% from previous 2.8%\n\n**Competitor Insights:**\n- Main competitors launched 3 new product lines\n- Average ad spend increased by 12% across the board\n- Content marketing focus shifted to video content\n\n**Recommendations:**\n1. Increase video content production\n2. Expand email segmentation strategy\n3. Monitor competitor pricing changes",
    citations: [
      {
        document_id: "doc-1",
        filename: "Q1_Marketing_Report.pdf",
        chunk_content: "Email campaigns achieved 28% open rate, social media engagement increased by 45%...",
        score: 0.95,
      },
      {
        document_id: "doc-2",
        filename: "Competitor_Analysis.docx",
        chunk_content: "Main competitors launched 3 new product lines, average ad spend increased by 12%...",
        score: 0.88,
      },
    ],
    selected_doc_ids: ["doc-1", "doc-2"],
    created_at: "2024-06-15T10:05:00Z",
  },
  {
    id: "msg-3",
    role: "user",
    content: "What budget should we allocate to social media vs email marketing?",
    citations: null,
    selected_doc_ids: ["doc-1", "doc-4"],
    created_at: "2024-06-15T10:10:00Z",
  },
  {
    id: "msg-4",
    role: "assistant",
    content:
      "Based on the performance metrics and current allocation:\n\n**Current Allocation:**\n- Social Media: 40% of budget\n- Email Marketing: 35% of budget\n- Other channels: 25%\n\n**Performance Data:**\n- Social media ROI: 4.2x (based on engagement and conversion metrics)\n- Email marketing ROI: 3.8x (based on open rates and click-through rates)\n\n**Recommendation:**\nIncrease social media budget to 45% and maintain email at 35%, reallocating 10% from other underperforming channels. This aligns with the superior ROI and growing engagement metrics we're seeing.\n\nExpected impact: 8-12% increase in overall campaign ROI",
    citations: [
      {
        document_id: "doc-4",
        filename: "Social_Media_Metrics.pdf",
        chunk_content: "Social media engagement metrics show 45% increase with strong conversion patterns...",
        score: 0.92,
      },
    ],
    selected_doc_ids: ["doc-1", "doc-4"],
    created_at: "2024-06-15T10:15:00Z",
  },
];

export const MOCK_USER = {
  email: "user@example.com",
  user_metadata: {
    name: "Sarah Anderson",
    avatar_url: null,
  },
};
