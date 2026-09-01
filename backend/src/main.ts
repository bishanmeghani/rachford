import { FlowsheetNode, FlowsheetEdge } from './types/types.ts';
import { executeWithRecycle } from './solver/recycle.ts';

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(req.url);

    if (req.method === "POST" && url.pathname === "/simulate") {
        try {
            const body = await req.json();
            const { nodes, edges, components } = body;
            const { streams, log, converged, iterations, nodeResults } = executeWithRecycle(nodes as FlowsheetNode[], edges as FlowsheetEdge[], components as string[]);
            
            return new Response(JSON.stringify({ status: converged ? "Success" : "NotConverged", iterations, streams, log, nodeResults }, null, 2), { headers: corsHeaders });
            
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            return new Response(JSON.stringify({ status: "Failed", error: errorMessage }), {
                status: 500,
                headers: corsHeaders
            });
        }
    }

    return new Response(JSON.stringify({ status: "Not Found" }), {
        status: 404,
        headers: corsHeaders
    });
});