import { supabase } from './supabaseClient';

export interface Section {
    id: string;
    name: string;
    node_id: string;
    icon: string | null;
    category?: string;
    description?: string;
    // We optionally include coordinates for backwards compatibility or easy access
    x?: number;
    z?: number;
}

// Fallback data matching the new schema structure
// Node IDs must match the fallback nodes in mapData.ts
const FALLBACK_SECTIONS: Section[] = [
    { id: 's1', name: 'Billing', node_id: 'n016', icon: '💳', x: 4, z: 2 },
    { id: 's2', name: 'Electronics', node_id: 'n011', icon: '📱', x: 8, z: 6 },
    { id: 's3', name: 'Groceries', node_id: 'n007', icon: '🛒', x: -8, z: 6 },
    { id: 's4', name: 'Clothing', node_id: 'n013', icon: '👕', x: 8, z: 10 },
];

export async function fetchSections(): Promise<Section[]> {
    if (!supabase) {
        console.info('[AR Nav] Supabase not configured — using fallback sections');
        return FALLBACK_SECTIONS;
    }

    try {
        // We join with navigation_nodes to get x,z for convenience
        const { data, error } = await supabase
            .from('sections')
            .select(`
                id,
                name,
                node_id,
                icon,
                navigation_nodes (
                    x,
                    z
                )
            `)
            .order('name');

        if (error) {
            console.error('[AR Nav] Supabase fetch error:', error.message);
            return FALLBACK_SECTIONS;
        }

        interface SectionRow {
            id: string;
            name: string;
            node_id: string;
            icon: string | null;
            navigation_nodes: { x: number; z: number } | null;
        }

        return (data as unknown as SectionRow[]).map((item) => ({
            id: item.id,
            name: item.name,
            node_id: item.node_id,
            icon: item.icon,
            x: item.navigation_nodes?.x,
            z: item.navigation_nodes?.z,
        }));
    } catch (err) {
        console.error('[AR Nav] Failed to fetch sections:', err);
        return FALLBACK_SECTIONS;
    }
}

/**
 * Fetch sections for a specific store (uses the published version).
 */
export async function fetchSectionsForStore(storeId: string): Promise<Section[]> {
    if (!supabase) {
        return FALLBACK_SECTIONS;
    }

    try {
        // 1. Get published version
        const { data: version, error: vError } = await supabase
            .from('store_versions')
            .select('id')
            .eq('store_id', storeId)
            .eq('is_published', true)
            .order('version_number', { ascending: false })
            .limit(1)
            .single();

        if (vError || !version) {
            console.warn('[AR Nav] No published version found for store', storeId);
            return FALLBACK_SECTIONS;
        }

        // 2. Get floors for this version
        const { data: floors, error: fError } = await supabase
            .from('floors')
            .select('id')
            .eq('store_version_id', version.id);

        if (fError || !floors || floors.length === 0) {
            console.warn('[AR Nav] No floors found for version', version.id);
            return FALLBACK_SECTIONS;
        }

        const floorIds = floors.map((f: { id: string }) => f.id);

        // 3. Get all node IDs on these floors
        const { data: nodes, error: nError } = await supabase
            .from('navigation_nodes')
            .select('id')
            .in('floor_id', floorIds);

        if (nError || !nodes || nodes.length === 0) {
            console.warn('[AR Nav] No nodes found on floors', floorIds);
            return [];
        }

        const nodeIds = nodes.map((n: { id: string }) => n.id);

        // 4. Get sections linked to those nodes (via node_id, NOT floor_id)
        const { data, error } = await supabase
            .from('sections')
            .select(`
                id,
                name,
                node_id,
                icon,
                category,
                description,
                navigation_nodes (
                    x,
                    z
                )
            `)
            .in('node_id', nodeIds)
            .order('name');

        if (error) {
            console.warn('[AR Nav] Section fetch error:', error?.message);
            return FALLBACK_SECTIONS;
        }

        // Fallback: if no sections are linked to real nodes, return ALL sections
        // (they may have placeholder node_ids from initial seeding)
        let sectionData = data;
        if (!sectionData || sectionData.length === 0) {
            console.info('[AR Nav] No sections matched via node_id. Falling back to all sections.');
            const { data: allSections, error: allErr } = await supabase
                .from('sections')
                .select(`
                    id,
                    name,
                    node_id,
                    icon,
                    category,
                    description,
                    navigation_nodes (
                        x,
                        z
                    )
                `)
                .order('name');
            if (allErr || !allSections) return FALLBACK_SECTIONS;
            sectionData = allSections;
        }

        interface StoreSectionRow {
            id: string;
            name: string;
            node_id: string;
            icon: string | null;
            category?: string;
            description?: string;
            navigation_nodes: { x: number; z: number } | null;
        }

        return (sectionData as unknown as StoreSectionRow[]).map((item) => ({
            id: item.id,
            name: item.name,
            node_id: item.node_id,
            icon: item.icon,
            category: item.category,
            description: item.description,
            x: item.navigation_nodes?.x,
            z: item.navigation_nodes?.z,
        }));
    } catch (err) {
        console.error('[AR Nav] Failed to fetch store sections:', err);
        return FALLBACK_SECTIONS;
    }
}

export function getSectionById(
    sections: Section[],
    id: string
): Section | undefined {
    return sections.find((s) => s.id === id);
}
