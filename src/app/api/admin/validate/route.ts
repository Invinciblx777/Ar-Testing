import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(request: Request) {
    if (!supabase) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    try {
        const body = await request.json();
        const { versionId } = body;

        if (!versionId) return NextResponse.json({ error: 'versionId required' }, { status: 400 });

        // Fetch Floors
        const { data: floors, error: fErr } = await supabase
            .from('floors')
            .select('id')
            .eq('store_version_id', versionId);

        if (fErr) throw fErr;
        if (!floors || floors.length === 0) {
            return NextResponse.json({
                valid: false,
                errors: ['No floors found in this version.']
            });
        }

        const floorIds = floors.map((f: { id: string }) => f.id);

        // Fetch Nodes, Edges, Sections
        const [nodesRes, edgesRes, sectionsRes] = await Promise.all([
            supabase.from('navigation_nodes').select('*').in('floor_id', floorIds),
            supabase.from('navigation_edges').select('from_node, to_node').in('floor_id', floorIds),
            supabase.from('sections').select('*').in('floor_id', floorIds),
        ]);

        if (nodesRes.error) throw nodesRes.error;
        if (edgesRes.error) throw edgesRes.error;
        if (sectionsRes.error) throw sectionsRes.error;

        const nodes = nodesRes.data || [];
        const edges = edgesRes.data || [];
        const sections = sectionsRes.data || [];

        const errors: string[] = [];

        // 1. Check for Entrance
        const entrance = nodes.find((n: any) => n.type === 'entrance');
        if (!entrance) {
            errors.push('Map is missing an "entrance" node.');
        }

        // 2. Check for at least 1 destination
        if (sections.length === 0) {
            errors.push('Map has no destinations. Please add at least one destination anchor.');
        }

        // 3. Valid Node Links
        const nodeIds = new Set(nodes.map((n: any) => n.id));
        let invalidLinks = 0;
        for (const sec of sections) {
            if (!nodeIds.has(sec.node_id)) {
                invalidLinks++;
            }
        }
        if (invalidLinks > 0) {
            errors.push(`${invalidLinks} destination(s) are linked to missing or invalid nodes.`);
        }

        // 4. Graph Connectivity
        if (entrance && nodes.length > 0) {
            const adj = new Map<string, string[]>();
            for (const n of nodes) adj.set(n.id, []);
            for (const e of edges) {
                if (adj.has(e.from_node) && adj.has(e.to_node)) {
                    adj.get(e.from_node)!.push(e.to_node);
                    adj.get(e.to_node)!.push(e.from_node);
                }
            }

            const visited = new Set<string>();
            const queue = [entrance.id];
            visited.add(entrance.id);

            while (queue.length > 0) {
                const current = queue.shift()!;
                const neighbors = adj.get(current) || [];
                for (const n of neighbors) {
                    if (!visited.has(n)) {
                        visited.add(n);
                        queue.push(n);
                    }
                }
            }

            const unreachableDestinations = sections.filter((sec: any) => !visited.has(sec.node_id) && nodeIds.has(sec.node_id));
            if (unreachableDestinations.length > 0) {
                errors.push(`${unreachableDestinations.length} destination(s) cannot be reached from the entrance. Ensure all edges are connected.`);
            }

            if (visited.size < nodes.length) {
                const isolatedCount = nodes.length - visited.size;
                errors.push(`Warning: There are ${isolatedCount} isolated node(s) not connected to the main network.`);
            }
        }

        return NextResponse.json({
            valid: errors.length === 0,
            errors,
            stats: {
                nodes: nodes.length,
                edges: edges.length,
                destinations: sections.length
            }
        });

    } catch (err: any) {
        console.error('[API Validate]', err);
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
}
