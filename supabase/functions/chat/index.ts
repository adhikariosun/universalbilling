import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChatRequest {
  message: string;
  context_type?: string;
  customer_id?: string | null;
  bill_id?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ChatRequest = await req.json();
    const { message, context_type, customer_id, bill_id } = body;

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a Supabase client with the user's JWT to respect RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    // Verify the user is authenticated
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const sources: string[] = [];

    // Gather context based on what the user is asking about
    let contextData = "";

    // If a specific customer is in context, fetch their details and bills
    if (customer_id) {
      const { data: customer } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customer_id)
        .maybeSingle();

      if (customer) {
        sources.push(`customer_${customer.name}`);
        contextData += `Customer: ${customer.name}\n`;
        if (customer.phone) contextData += `Phone: ${customer.phone}\n`;
        if (customer.email) contextData += `Email: ${customer.email}\n`;
        contextData += `Total Spent: $${customer.total_spent}\n`;

        const { data: customerBills } = await supabase
          .from("bills")
          .select("bill_number, total, bill_date, status")
          .eq("customer_id", customer_id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (customerBills && customerBills.length > 0) {
          contextData += `\nRecent bills for ${customer.name}:\n`;
          for (const bill of customerBills) {
            sources.push(`bill_${bill.bill_number}`);
            contextData += `- ${bill.bill_number}: $${bill.total} on ${bill.bill_date} (${bill.status})\n`;
          }
        }
      }
    }

    // If a specific bill is in context, fetch its details
    if (bill_id) {
      const { data: bill } = await supabase
        .from("bills")
        .select("*, customer:customers(name), bill_items(product_name, quantity, price, total)")
        .eq("id", bill_id)
        .maybeSingle();

      if (bill) {
        sources.push(`bill_${bill.bill_number}`);
        contextData += `\nBill ${bill.bill_number}:\n`;
        contextData += `Customer: ${bill.customer?.name ?? "Walk-in"}\n`;
        contextData += `Date: ${bill.bill_date}\n`;
        contextData += `Status: ${bill.status}\n`;
        contextData += `Total: $${bill.total}\n`;
        if (bill.bill_items && bill.bill_items.length > 0) {
          contextData += `Items:\n`;
          for (const item of bill.bill_items) {
            contextData += `  - ${item.product_name} x${item.quantity} @ $${item.price} = $${item.total}\n`;
          }
        }
      }
    }

    // Always fetch dashboard-level context for general queries
    const { count: totalBills } = await supabase
      .from("bills")
      .select("id", { count: "exact", head: true });

    const { count: totalCustomers } = await supabase
      .from("customers")
      .select("id", { count: "exact", head: true });

    const { data: recentBills } = await supabase
      .from("bills")
      .select("bill_number, total, bill_date, customer:customers(name)")
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: topCustomers } = await supabase
      .from("customers")
      .select("name, total_spent")
      .order("total_spent", { ascending: false })
      .limit(3);

    let totalRevenue = 0;
    const { data: allBills } = await supabase.from("bills").select("total");
    if (allBills) {
      totalRevenue = allBills.reduce((sum: number, b: { total: number }) => sum + Number(b.total), 0);
    }

    contextData += `\nDashboard Summary:\n`;
    contextData += `Total Bills: ${totalBills ?? 0}\n`;
    contextData += `Total Customers: ${totalCustomers ?? 0}\n`;
    contextData += `Total Revenue: $${totalRevenue.toFixed(2)}\n`;

    if (recentBills && recentBills.length > 0) {
      contextData += `\nRecent Bills:\n`;
      for (const bill of recentBills) {
        sources.push(`bill_${bill.bill_number}`);
        contextData += `- ${bill.bill_number}: $${bill.total} (${bill.customer?.name ?? "Walk-in"})\n`;
      }
    }

    if (topCustomers && topCustomers.length > 0) {
      contextData += `\nTop Customers:\n`;
      for (const c of topCustomers) {
        sources.push(`customer_${c.name}`);
        contextData += `- ${c.name}: $${c.total_spent}\n`;
      }
    }

    // Generate a helpful response based on the context and user's question
    const reply = generateResponse(message, contextData, context_type ?? "dashboard", sources);

    return new Response(
      JSON.stringify({
        reply,
        context_retrieved: sources.length,
        sources: [...new Set(sources)],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Chat function error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to process message" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateResponse(
  message: string,
  contextData: string,
  contextType: string,
  sources: string[]
): string {
  const msg = message.toLowerCase();

  // Check what the user is asking about
  if (msg.includes("revenue") || msg.includes("total") && msg.includes("money")) {
    const revenueMatch = contextData.match(/Total Revenue: \$([\d.]+)/);
    const billsMatch = contextData.match(/Total Bills: (\d+)/);
    const customersMatch = contextData.match(/Total Customers: (\d+)/);
    return `Based on your billing data, your total revenue is $${revenueMatch?.[1] ?? "0.00"} across ${billsMatch?.[1] ?? "0"} bills and ${customersMatch?.[1] ?? "0"} customers.`;
  }

  if (msg.includes("top customer") || msg.includes("best customer")) {
    const topMatch = contextData.match(/Top Customers:\n((?:.+\n?)+?)(?=\n\n|$)/);
    if (topMatch) {
      return `Your top customers by spending are:\n${topMatch[1].trim()}`;
    }
    return "I don't have customer spending data available yet.";
  }

  if (msg.includes("recent bill") || msg.includes("latest bill")) {
    const recentMatch = contextData.match(/Recent Bills:\n((?:.+\n?)+?)(?=\n\n|$)/);
    if (recentMatch) {
      return `Here are your most recent bills:\n${recentMatch[1].trim()}`;
    }
    return "You don't have any bills yet.";
  }

  if (msg.includes("how many bill") || msg.includes("bill count")) {
    const billsMatch = contextData.match(/Total Bills: (\d+)/);
    return `You have ${billsMatch?.[1] ?? "0"} bills in total.`;
  }

  if (msg.includes("how many customer") || msg.includes("customer count")) {
    const customersMatch = contextData.match(/Total Customers: (\d+)/);
    return `You have ${customersMatch?.[1] ?? "0"} customers in total.`;
  }

  if (msg.includes("what did") && msg.includes("buy") || msg.includes("purchase")) {
    const itemsMatch = contextData.match(/Items:\n((?:.+\n?)+?)(?=\n\n|$)/);
    if (itemsMatch) {
      return `Here are the items purchased:\n${itemsMatch[1].trim()}`;
    }
    return "I don't have specific purchase details available. Try viewing a specific bill or customer for item-level information.";
  }

  if (msg.includes("help") || msg.includes("what can you do")) {
    return `I'm your billing assistant! I can help you with:\n\n- Revenue and sales summaries\n- Top customer information\n- Recent bill details\n- Customer purchase history\n- Bill counts and statistics\n\nJust ask me a question about your billing data!`;
  }

  // Default: provide a summary based on available context
  const revenueMatch = contextData.match(/Total Revenue: \$([\d.]+)/);
  const billsMatch = contextData.match(/Total Bills: (\d+)/);
  const customersMatch = contextData.match(/Total Customers: (\d+)/);

  let response = `Here's what I found from your billing data:\n\n`;
  response += `Total Revenue: $${revenueMatch?.[1] ?? "0.00"}\n`;
  response += `Total Bills: ${billsMatch?.[1] ?? "0"}\n`;
  response += `Total Customers: ${customersMatch?.[1] ?? "0"}\n`;

  if (sources.length > 0) {
    response += `\nI referenced ${sources.length} source${sources.length !== 1 ? "s" : ""} from your data to answer this.`;
  }

  return response;
}
